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
// 1日に受け付ける上限組数。1 にすると「1日1組（同日重複不可）」。
const DAILY_CAPACITY = Number(process.env.RESERVE_DAILY_CAPACITY || 1);

import store, { KEYS } from './_lib/store.js';

const loadAll = () => store.list(KEYS.reservations);

const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMonth = (s) => typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);
const isEmail = (s) => typeof s === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

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

  const all = await loadAll();

  // 当月かつ未キャンセルの予約を日付ごとに集計
  const counts = {};
  for (const r of all) {
    if (r && r.status !== 'cancelled' && isYmd(r.date) && r.date.startsWith(month + '-')) {
      counts[r.date] = (counts[r.date] || 0) + 1;
    }
  }
  const full = Object.keys(counts).filter((d) => counts[d] >= DAILY_CAPACITY).sort();

  // キャッシュさせない（状況が即時反映されるように）
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    month,
    capacity: DAILY_CAPACITY,
    reserved: full,   // 後方互換のため両キーで返す
    full,
  });
}

// ── POST: 予約作成（同日重複検証）────────────────────────────────
async function handlePost(req, res) {
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

  // 過去日は不可
  const todayYmd = new Date().toISOString().slice(0, 10);
  if (date < todayYmd)
    return res.status(400).json({ error: '過去の日付はご予約いただけません。' });

  const all = await loadAll();

  // 同日重複検証
  const sameDay = all.filter(
    (r) => r && r.status !== 'cancelled' && r.date === date
  ).length;
  if (sameDay >= DAILY_CAPACITY)
    return res.status(409).json({ error: 'その日は既に受付終了（満席）です。別の日をお選びください。' });

  // email は専用入力が無いため、連絡先がメール形式なら自動で採用（無ければ空）。
  const email = isEmail(contact) ? contact : (isEmail(body.email) ? body.email.trim() : '');

  // 統一スキーマ（{ id, name, email, contact, plan, date, message, createdAt } + status）
  const record = {
    id: store.genId('r'),
    name,
    email,
    contact,
    plan: plan || '(未選択)',
    date,
    message,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await store.push(KEYS.reservations, record);

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
          subject: `【ご予約申込】${date}／${name} 様`,
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
      if (!r.ok) console.error('[reservations] resend error:', await r.text());
    } catch (e) {
      console.error('[reservations] mail failed:', e); // 通知失敗でも予約自体は受付済み
    }
  } else {
    console.log('[reservations] received (mail not configured):', record.id, date);
  }

  return res.status(201).json({ ok: true, id: record.id, date });
}
