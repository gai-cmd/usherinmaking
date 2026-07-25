// Vercel Serverless Function — /api/admin
// 管理者ログイン + 保護されたデータ取得（お問い合わせ・ご予約の一覧）。
//
//   - 認証: ADMIN_PASSWORD 環境変数で照合し、HMAC 署名トークンを発行・検証。
//   - 保存: api/_lib/store.js が一元管理（KV があれば KV、無ければ /tmp JSON）。
//
// お問い合わせ／ご予約の受信フォーム側（api/contact.js / api/reservations.js）が
// 同じキー（KEYS.contacts / KEYS.reservations）・同じスキーマで push するため、
// ここではそのまま読み出すだけで実データが一覧に表示される。
//   統一スキーマ（お問い合わせ）: { id, name, email, date, message, createdAt }
//   統一スキーマ（ご予約）      : { id, name, email, contact, plan, date, message, createdAt }
//
// 環境変数:
//   ADMIN_PASSWORD   管理画面のログインパスワード（未設定時は安全のためログイン不可）
//
// エンドポイント（?action= で分岐）:
//   POST /api/admin?action=login              { password }      → { token, expiresIn }
//   GET  /api/admin?action=verify             (Bearer)          → { ok }
//   GET  /api/admin?action=stats              (Bearer)          → { inquiries, reservations, recent }
//   GET  /api/admin?action=contacts                             → { items: [...] }
//   GET  /api/admin?action=reservations                         → { items: [...] }
//   POST /api/admin?action=update-contact     (Bearer) {id,status} → { ok, item }
//   POST /api/admin?action=update-reservation (Bearer) {id,status} → { ok, item }

import store, {
  KEYS,
  CONTACT_STATUSES,
  RESERVATION_STATUSES,
  normalizeContact,
  normalizeReservation,
} from './_lib/store.js';
import { signToken, verifyToken, safeEqual } from './_lib/auth.js';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 時間有効

// ─── トークン（自己検証） ───────────────────────────────────────────────
// 署名・検証は api/_lib/auth.js に集約（形式は従来と同一）。
// ログイン照合のパスワードは ADMIN_PASSWORD を直接使う。
function adminPassword() {
  return process.env.ADMIN_PASSWORD || '';
}

// action → 共通ストアキーの対応
const KEY_FOR = {
  contacts: KEYS.contacts,
  reservations: KEYS.reservations,
};

// 共通ストアから読み出す（SEED／ダミー無し。未受信なら空配列）。
// 後方互換: 古いレコードに status が無ければ読み出し時に既定値を補う。
async function readStore(kind) {
  const arr = await store.list(KEY_FOR[kind]);
  const norm = kind === 'contacts' ? normalizeContact : normalizeReservation;
  return arr.map(norm);
}

// createdAt 降順
function byCreatedAtDesc(x, y) {
  return String(y.createdAt || '').localeCompare(String(x.createdAt || ''));
}

// id の該当レコードの status を更新して保存（後勝ち回避のため配列ごと読み書き）。
async function updateStatus(kind, id, status) {
  const key = KEY_FOR[kind];
  const arr = await store.list(key);
  const idx = arr.findIndex((x) => x && x.id === id);
  if (idx === -1) return null;
  const updated = { ...arr[idx], status, updatedAt: new Date().toISOString() };
  arr[idx] = updated;
  await store.set(key, arr);
  return kind === 'contacts' ? normalizeContact(updated) : normalizeReservation(updated);
}

// ─── ハンドラ ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const action = (req.query && req.query.action) || '';

  try {
    // --- ログイン ---
    if (action === 'login') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      // ブルートフォース対策: 同一IPからのログイン試行を 10分あたり 10回までに制限。
      //   （KV 利用時のみ有効。store.rateLimit は KV 無し=dev では no-op で許可。）
      const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || '').trim() || 'unknown';
      const rl = await store.rateLimit('login', ip, 10, 600);
      if (!rl.ok) {
        res.setHeader('Retry-After', '600');
        return res.status(429).json({ error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
      }
      if (!adminPassword()) {
        return res.status(500).json({ error: '서버가 설정되지 않았습니다.' });
      }
      const body =
        req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const password = (body.password || '').toString();
      // タイミング安全な照合（両辺を sha256 でハッシュしてから比較）
      if (!safeEqual(password, adminPassword())) {
        return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      }
      return res.status(200).json({ token: signToken(TOKEN_TTL_MS), expiresIn: TOKEN_TTL_MS });
    }

    // --- 以降は要トークン ---
    const authed = verifyToken(req);

    if (action === 'verify') {
      return res.status(authed ? 200 : 401).json({ ok: authed });
    }

    if (!authed) {
      return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해 주세요.' });
    }

    if (action === 'contacts' || action === 'reservations') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      const items = (await readStore(action)).slice().sort(byCreatedAtDesc);
      return res.status(200).json({ items });
    }

    // --- ダッシュボード統計 ---
    if (action === 'stats') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      const contacts = await readStore('contacts');
      const reservations = await readStore('reservations');
      // 「今後の予定」判定はスタジオ所在地（沖縄 = JST）基準
      const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

      const inquiries = {
        total: contacts.length,
        new: contacts.filter((c) => c.status === 'new').length,
      };
      const resStats = {
        total: reservations.length,
        pending: reservations.filter((r) => r.status === 'pending').length,
        // 予定: 未キャンセルで撮影日が今日以降
        upcoming: reservations.filter(
          (r) => r.status !== 'cancelled' && r.date && r.date >= today
        ).length,
      };

      const recent = [
        ...contacts.map((c) => ({
          type: 'contact',
          id: c.id,
          name: c.name || '',
          summary: (c.message || '').toString().slice(0, 80),
          createdAt: c.createdAt || '',
        })),
        ...reservations.map((r) => ({
          type: 'reservation',
          id: r.id,
          name: r.name || '',
          summary: [r.plan, r.date].filter(Boolean).join(' / ').slice(0, 80),
          createdAt: r.createdAt || '',
        })),
      ]
        .sort(byCreatedAtDesc)
        .slice(0, 10);

      return res.status(200).json({ inquiries, reservations: resStats, recent });
    }

    // --- ステータス更新 ---
    if (action === 'update-contact' || action === 'update-reservation') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      const body =
        req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const id = (body.id || '').toString().trim();
      const status = (body.status || '').toString().trim();
      const kind = action === 'update-contact' ? 'contacts' : 'reservations';
      const valid = kind === 'contacts' ? CONTACT_STATUSES : RESERVATION_STATUSES;

      if (!id) return res.status(400).json({ error: 'id는 필수입니다.' });
      if (!valid.includes(status))
        return res
          .status(400)
          .json({ error: `status는 ${valid.join(' / ')} 중 하나를 지정해 주세요.` });

      const item = await updateStatus(kind, id, status);
      if (!item)
        return res.status(404).json({ error: '대상 레코드를 찾을 수 없습니다.' });
      return res.status(200).json({ ok: true, item });
    }

    return res.status(400).json({ error: '알 수 없는 action입니다.' });
  } catch (e) {
    console.error('[admin]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
