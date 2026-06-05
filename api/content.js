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
import store, { KEYS } from './_lib/store.js';

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

// ─── 既定コンテンツ ──────────────────────────────────────────────────────
const DEFAULT_CONTENT = {
  notice: '梅雨明けの7月は予約が混み合います。お早めにお問い合わせください。',
  plans: [
    {
      id: 'wedding',
      title: 'ウェディングフォト',
      desc: '沖縄の海と空を背景に、おふたりだけの一日を残します。',
      price: '¥120,000〜',
    },
    {
      id: 'family',
      title: 'ファミリーフォト',
      desc: '七五三・お宮参り・記念日に。ご家族の自然な表情を撮影します。',
      price: '¥60,000〜',
    },
    {
      id: 'anniversary',
      title: 'アニバーサリー',
      desc: '結婚記念日や誕生日など、節目の瞬間をかたちに。',
      price: '¥80,000〜',
    },
  ],
  updatedAt: '',
};

async function readContent() {
  const obj = await store.get(KEYS.content, DEFAULT_CONTENT);
  return obj && typeof obj === 'object' ? obj : DEFAULT_CONTENT;
}
async function writeContent(obj) {
  await store.set(KEYS.content, obj);
}

// 入力をサニタイズ（想定フィールドのみ通す）
function sanitize(body) {
  const out = { notice: '', plans: [], updatedAt: new Date().toISOString() };
  out.notice = (body.notice || '').toString().slice(0, 2000);
  const plans = Array.isArray(body.plans) ? body.plans.slice(0, 20) : [];
  out.plans = plans.map((p, i) => ({
    id: (p.id || `plan-${i + 1}`).toString().slice(0, 60),
    title: (p.title || '').toString().slice(0, 120),
    desc: (p.desc || '').toString().slice(0, 600),
    price: (p.price || '').toString().slice(0, 60),
  }));
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // 公開: サイト表示用にも使えるよう認証不要
      return res.status(200).json(await readContent());
    }

    if (req.method === 'POST') {
      if (!verifyToken(bearer(req))) {
        return res.status(401).json({ error: '認証が必要です。再度ログインしてください。' });
      }
      const body =
        req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const next = sanitize(body);
      try {
        await writeContent(next);
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
