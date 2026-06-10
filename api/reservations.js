// Vercel Serverless Function — /api/reservations
// 予約カレンダー (booking calendar) backend.
//
//   GET  /api/reservations?month=YYYY-MM
//        → { month, capacity, reserved: ["YYYY-MM-DD", …], full: ["YYYY-MM-DD", …] }
//          `reserved`/`full` は当月で受付済み（＝満席）の日付。フロントは灰色で無効化する。
//
//   POST /api/reservations   { date, plan, name, contact, message, _hp }
//        → 201 { ok:true, id } / 409 既に予約済み / 400 入力不備
//          同じ日付の重複予約を検証（1日1組）。受付時に Resend でスタジオへ通知（env 設定時）。
//
// ───────────────────────────────────────────────────────────────
// 保存について:
//   保存先は api/_lib/store.js が一元管理（KV があれば KV、無ければ /tmp JSON）。
//   キーは KEYS.reservations（"uim:reservations"）。管理画面（api/admin.js）も
//   同じキー・同じスキーマで読むので、受け付けた予約がそのまま一覧に表示される。
//   統一スキーマ（ご予約）:
//     { id, name, email, contact, plan, date, message, createdAt }
//   （加えて重複/キャンセル判定用に status を保持。email は contact 入力が
//     メール形式のときに自動で埋める。）
//
// ───────────────────────────────────────────────────────────────
// メール通知（任意）— Vercel の Environment Variables に設定:
//   RESEND_API_KEY      https://resend.com（無料枠あり）
//   RESERVE_TO          通知先（未設定時は CONTACT_TO にフォールバック）
//   RESERVE_FROM        差出人（任意・検証済みドメイン推奨）
//
// 1日の受付上限（capacityPerDay）と休業日（blockedDates）は uim:content から読む。
// store.getContent() が未保存時の既定値（RESERVE_DAILY_CAPACITY 反映）も面倒を見る。

import store, { KEYS } from './_lib/store.js';

// 受信ボディの上限（PII・スパム対策）。
export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const loadAll = () => store.list(KEYS.reservations);

const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMonth = (s) => typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);
const isEmail = (s) => typeof s === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

// 件名（subject）に使う名前から CR/LF・制御文字を除去（ヘッダーインジェクション対策）。
function sanitizeHeader(s) {
  return String(s).replace(/[\r\n\t\f\v -]/g, ' ').trim();
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('[reservations]', e);
    return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
}

// ── GET: 当月の予約状況（満席日）を返す ──────────────────────────
async function handleGet(req, res) {
  const month = (req.query && req.query.month) || '';
  if (!isMonth(month))
    return res.status(400).json({ error: 'month は YYYY-MM 形式で指定してください。' });

  const [all, content] = await Promise.all([loadAll(), store.getContent()]);
  const capacity = content.capacityPerDay;

  // 当月かつ未キャンセルの予約を日付ごとに集計
  const counts = {};
  for (const r of all) {
    if (r && r.status !== 'cancelled' && isYmd(r.date) && r.date.startsWith(month + '-')) {
      counts[r.date] = (counts[r.date] || 0) + 1;
    }
  }
  // full = (予約数 ≥ capacity の日付) ∪ content.blockedDates（当月分）
  const byCount = Object.keys(counts).filter((d) => counts[d] >= capacity);
  const blocked = content.blockedDates.filter((d) => d.startsWith(month + '-'));
  const full = Array.from(new Set([...byCount, ...blocked])).sort();

  // キャッシュさせない（状況が即時反映されるように）
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    month,
    capacity,
    reserved: full,   // 後方互換のため両キーで返す
    full,
  });
}

// ── POST: 予約作成（同日重複検証）────────────────────────────────
async function handlePost(req, res) {
  // レート制限（KV があれば 60 秒に 5 回まで。dev は no-op）。
  const ip = String((req.headers && req.headers['x-forwarded-for']) || '')
    .split(',')[0]
    .trim();
  const rl = await store.rateLimit('reserve', ip, 5, 60);
  if (!rl.ok)
    return res.status(429).json({ error: 'リクエストが多すぎます。しばらくしてから再度お試しください。' });

  const body =
    req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');

  if (body._hp) return res.status(200).json({ ok: true }); // ハニーポット

  const date = (body.date || '').trim();
  const plan = (body.plan || '').trim();
  const name = (body.name || '').trim();
  const contact = (body.contact || '').trim();
  const message = (body.message || '').trim();

  if (!isYmd(date))
    return res.status(400).json({ error: 'ご希望の撮影日を選択してください。' });
  if (!name || !contact)
    return res.status(400).json({ error: 'お名前とご連絡先は必須です。' });
  // 入力長の上限（過大入力を弾く）
  if (name.length > 120 || contact.length > 200 || plan.length > 120 || message.length > 4000)
    return res.status(400).json({ error: '入力が長すぎます。' });

  // 過去日は不可
  const todayYmd = new Date().toISOString().slice(0, 10);
  if (date < todayYmd)
    return res.status(400).json({ error: '過去の日付はご予約いただけません。' });

  const [all, content] = await Promise.all([loadAll(), store.getContent()]);
  const capacity = content.capacityPerDay;

  // 休業日（blockedDates）は受付不可
  if (content.blockedDates.includes(date))
    return res.status(409).json({ error: 'その日は撮影の受付を行っておりません。別の日をお選びください。' });

  // 事前の満席判定（高速な早期リターン。確定判定はロック内で再度行う）。
  const sameDay = all.filter(
    (r) => r && r.status !== 'cancelled' && r.date === date
  ).length;
  if (sameDay >= capacity)
    return res.status(409).json({ error: 'その日は既に受付終了（満席）です。別の日をお選びください。' });

  // email は専用入力が無いため、連絡先がメール形式なら自動で採用（無ければ空）。
  const email = isEmail(contact) ? contact : (isEmail(body.email) ? body.email.trim() : '');

  // 統一スキーマ（{ id, name, email, contact, plan, date, message, status, createdAt, updatedAt }）
  const now = new Date().toISOString();
  const record = {
    id: store.genId('r'),
    name,
    email,
    contact,
    plan: plan || '(未選択)',
    date,
    message,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  // ── クリティカルセクション: 同日ロックで「再カウント → push」を原子化 ─────────
  //   非ロック時（dev）はそのまま実行。ロック取得失敗（他リクエストが同日を処理中）は 409。
  let lock;
  try {
    lock = await store.withLock(`uim:reslock:${date}`, 15, async () => {
      const fresh = await loadAll();
      const taken = fresh.filter(
        (r) => r && r.status !== 'cancelled' && r.date === date
      ).length;
      if (taken >= capacity) return { full: true };
      await store.push(KEYS.reservations, record);
      return { full: false };
    });
  } catch (e) {
    console.error('[reservations] save failed:', e);
    return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
  if (lock.busy)
    return res.status(409).json({ error: 'その日は現在ご予約手続き中です。少し時間をおいて再度お試しください。' });
  if (lock.value && lock.value.full)
    return res.status(409).json({ error: 'その日は既に受付終了（満席）です。別の日をお選びください。' });

  // ── スタジオへメール通知（設定時のみ）──────────────────────────
  const KEY = process.env.RESEND_API_KEY;
  const TO = process.env.RESERVE_TO || process.env.CONTACT_TO;
  const FROM = process.env.RESERVE_FROM || 'usher in making <onboarding@resend.dev>';
  if (KEY && TO) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          subject: `【ご予約申込】${date}／${sanitizeHeader(name)} 様`,
          text:
            `新しい撮影予約の申し込みがありました。\n\n` +
            `撮影日　: ${date}\n` +
            `プラン　: ${record.plan}\n` +
            `お名前　: ${name}\n` +
            `ご連絡先: ${contact}\n` +
            `メッセージ:\n${message || '（なし）'}\n\n` +
            `受付ID : ${record.id}\n` +
            `受付時刻: ${record.createdAt}\n`,
        }),
      });
      if (!r.ok) console.error('[reservations] resend error: status', r.status);
    } catch (e) {
      console.error('[reservations] mail failed:', e); // 通知失敗でも予約自体は受付済み
    }
  } else {
    console.log('[reservations] received (mail not configured)');
  }

  return res.status(201).json({ ok: true, id: record.id, date });
}
