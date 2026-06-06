// Vercel Serverless Function — /api/content
// サイトの編集可能コンテンツ（プラン・料金・お知らせ）の取得／保存。
//
//   - GET  /api/content                → 公開可。現在のコンテンツを返す。
//   - POST /api/content (要トークン)    → コンテンツを上書き保存。
//
// トークン検証ロジックは api/admin.js と同じ方式（ADMIN_PASSWORD 由来の HMAC 署名）。
// コンテンツの保存先は api/_lib/store.js が一元管理（KV があれば KV、無ければ /tmp JSON）。
// キーは KEYS.content（"uim:content"）。

import crypto from 'node:crypto';
import store, { KEYS, normalizePlan } from './_lib/store.js';

// ─── トークン検証（admin.js と同方式・自己完結） ───────────────────────
function secret() {
  return process.env.ADMIN_PASSWORD || '';
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
  const expected = crypto.createHmac('sha256', secret()).update(exp).digest('base64url');
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Date.now() < Number(exp);
}
function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ─── POST の部分マージ用バリデーション ─────────────────────────────────────
// 各検証関数は { value } か { error } を返す（error があれば 400 で返却）。
function validateNotice(v) {
  if (v == null || typeof v !== 'object' || Array.isArray(v))
    return { error: 'notice はオブジェクト形式で指定してください。' };
  return {
    value: {
      enabled: v.enabled === true,
      text: (v.text == null ? '' : String(v.text)).slice(0, 2000),
      link: (v.link == null ? '' : String(v.link)).slice(0, 500),
    },
  };
}

function validatePlans(v) {
  if (!Array.isArray(v)) return { error: 'plans は配列で指定してください。' };
  if (v.length > 50) return { error: 'plans は最大50件までです。' };
  const out = [];
  for (let i = 0; i < v.length; i++) {
    const p = v[i];
    if (!p || typeof p !== 'object')
      return { error: `plans[${i}] はオブジェクト形式で指定してください。` };
    if (!String(p.name || '').trim())
      return { error: `plans[${i}] の name（プラン名）は必須です。` };
    if (!String(p.price || '').trim())
      return { error: `plans[${i}] の price（料金）は必須です。` };
    out.push(normalizePlan(p, i));
  }
  return { value: out };
}

function validateBlockedDates(v) {
  if (!Array.isArray(v)) return { error: 'blockedDates は配列で指定してください。' };
  for (const d of v) {
    if (!isYmd(d))
      return { error: 'blockedDates は YYYY-MM-DD 形式の日付のみ指定できます。' };
  }
  return { value: Array.from(new Set(v)).sort() };
}

function validateCapacity(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1)
    return { error: 'capacityPerDay は1以上の整数で指定してください。' };
  return { value: Math.floor(n) };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // 公開: サイト表示用にも使えるよう認証不要。基本構造を必ず保証。
      return res.status(200).json(await store.getContent());
    }

    if (req.method === 'POST') {
      if (!verifyToken(bearer(req))) {
        return res.status(401).json({ error: '認証が必要です。再度ログインしてください。' });
      }
      const body =
        req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');

      // 現在のコンテンツに対する「部分マージ」。指定されたキーのみ上書き。
      const current = await store.getContent();
      const next = { ...current };

      if ('notice' in body) {
        const r = validateNotice(body.notice);
        if (r.error) return res.status(400).json({ error: r.error });
        next.notice = r.value;
      }
      if ('plans' in body) {
        const r = validatePlans(body.plans);
        if (r.error) return res.status(400).json({ error: r.error });
        next.plans = r.value;
      }
      if ('blockedDates' in body) {
        const r = validateBlockedDates(body.blockedDates);
        if (r.error) return res.status(400).json({ error: r.error });
        next.blockedDates = r.value;
      }
      if ('capacityPerDay' in body) {
        const r = validateCapacity(body.capacityPerDay);
        if (r.error) return res.status(400).json({ error: r.error });
        next.capacityPerDay = r.value;
      }
      next.updatedAt = new Date().toISOString();

      try {
        await store.set(KEYS.content, next);
      } catch (e) {
        console.error('[content] write failed (read-only fs?)', e);
        return res
          .status(500)
          .json({ error: '保存に失敗しました。本番では Vercel KV をご利用ください。' });
      }
      return res.status(200).json({ ok: true, content: next });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('[content]', e);
    return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
}
