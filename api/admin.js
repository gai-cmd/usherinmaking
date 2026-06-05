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
//   POST /api/admin?action=login   { password }            → { token }
//   GET  /api/admin?action=verify  (Authorization: Bearer) → { ok }
//   GET  /api/admin?action=contacts                        → { items: [...] }
//   GET  /api/admin?action=reservations                    → { items: [...] }

import crypto from 'node:crypto';
import store, { KEYS } from './_lib/store.js';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 時間有効

// ─── トークン（自己検証） ───────────────────────────────────────────────
// 形式: base64url(exp).hmacSHA256(exp, secret)
// 秘密鍵は ADMIN_PASSWORD 由来。パスワードを変えると既存トークンは無効化されます。
function secret() {
  return process.env.ADMIN_PASSWORD || '';
}
function sign(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}
function createToken() {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const payload = Buffer.from(exp).toString('base64url');
  return `${payload}.${sign(exp)}`;
}
function verifyToken(token) {
  if (!token || !secret()) return false;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return false;
  let exp;
  try {
    exp = Buffer.from(payload, 'base64url').toString();
  } catch {
    return false;
  }
  const expected = sign(exp);
  // タイミング安全比較
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Date.now() < Number(exp);
}
function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

// action → 共通ストアキーの対応
const KEY_FOR = {
  contacts: KEYS.contacts,
  reservations: KEYS.reservations,
};

// まだ1件も受信が無いときだけ表示するデモ用サンプル（統一スキーマに準拠）。
// ストアには書き込まず、表示のみ（実データが入れば自動でそちらが優先される）。
const SEED = {
  contacts: [
    {
      id: 'c-demo-1',
      name: '山田 花子',
      email: 'hanako@example.com',
      date: '2026-06-20',
      message: '6月の挙式に合わせてフォトプランを検討しています。空き状況を教えてください。',
      createdAt: '2026-05-28T02:14:00.000Z',
    },
    {
      id: 'c-demo-2',
      name: '佐藤 健',
      email: 'ken.sato@example.com',
      date: '',
      message: '家族写真（七五三）の料金について詳しく知りたいです。',
      createdAt: '2026-06-01T07:42:00.000Z',
    },
  ],
  reservations: [
    {
      id: 'r-demo-1',
      name: '鈴木 美咲',
      email: 'misaki@example.com',
      contact: 'misaki@example.com',
      plan: 'ウェディングフォト / ビーチ',
      date: '2026-07-12',
      message: '午前中の柔らかい光で撮影希望。ドレスは2着。',
      createdAt: '2026-05-30T10:05:00.000Z',
    },
  ],
};

// 共通ストアから読み出す。空（未受信）のときだけデモ用シードを返す。
async function readStore(kind) {
  const arr = await store.list(KEY_FOR[kind]);
  return arr.length ? arr : SEED[kind];
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
      if (!secret()) {
        return res.status(500).json({
          error: 'ADMIN_PASSWORD が設定されていません。Vercel の環境変数を設定してください。',
        });
      }
      const body =
        req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const password = (body.password || '').toString();
      // タイミング安全な照合
      const a = Buffer.from(password);
      const b = Buffer.from(secret());
      const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!ok) {
        return res.status(401).json({ error: 'パスワードが正しくありません。' });
      }
      return res.status(200).json({ token: createToken(), expiresIn: TOKEN_TTL_MS });
    }

    // --- 以降は要トークン ---
    const authed = verifyToken(bearer(req));

    if (action === 'verify') {
      return res.status(authed ? 200 : 401).json({ ok: authed });
    }

    if (!authed) {
      return res.status(401).json({ error: '認証が必要です。再度ログインしてください。' });
    }

    if (action === 'contacts' || action === 'reservations') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      const items = (await readStore(action)).slice().sort((x, y) =>
        String(y.createdAt || '').localeCompare(String(x.createdAt || ''))
      );
      return res.status(200).json({ items });
    }

    return res.status(400).json({ error: '不明な action です。' });
  } catch (e) {
    console.error('[admin]', e);
    return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
}
