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

// ─── 契約 v2: フロントコンテンツ DB 化（studio / hero / event） ───────────────
// 注意: 保存先の正規化（_lib/store.js の normalizeContent）は v1 キーしか通さない。
//   そのため v2 フィールドは「raw（生の保存値）」に直接書き込み、GET でも raw から
//   読み戻して補完する（store.js は契約上このエージェントの所有外＝変更しない）。

// studio は契約記載の実運用リンクを既定値とする（email のみ空）。
const STUDIO_DEFAULTS = {
  line: 'https://line.me/ti/p/8Udy1kYg1l',
  instagram: 'https://www.instagram.com/usherinmaking/',
  kakao: 'http://qr.kakao.com/talk/YdBfdGeaBd1EXL3ZVVpEJrSpzMU-',
  blog: 'https://blog.naver.com/moya100',
  email: '',
};
// hero / event は空・無効が既定（= フロントは静的 HTML を維持）。
const HERO_DEFAULTS = { eyebrow: '', title: '', subtitle: '' };
const EVENT_DEFAULTS = { enabled: false, title: '', body: '', period: '' };

const STUDIO_KEYS = ['line', 'instagram', 'kakao', 'blog', 'email'];
const HERO_KEYS = ['eyebrow', 'title', 'subtitle'];
const HERO_MAXLEN = 200;
const EVENT_MAXLEN = { title: 200, body: 2000, period: 200 };

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isHttpUrl = (s) => /^https?:\/\/.+/i.test(s);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// GET 用: raw の値を契約どおりの完全な構造へ補完（欠損キーは既定値）。
function fillStudio(raw) {
  const s = isPlainObject(raw) ? raw : {};
  const out = { ...STUDIO_DEFAULTS };
  for (const k of STUDIO_KEYS) if (typeof s[k] === 'string') out[k] = s[k];
  return out;
}
function fillHero(raw) {
  const h = isPlainObject(raw) ? raw : {};
  const out = { ...HERO_DEFAULTS };
  for (const k of HERO_KEYS) if (typeof h[k] === 'string') out[k] = h[k];
  return out;
}
function fillEvent(raw) {
  const e = isPlainObject(raw) ? raw : {};
  return {
    enabled: e.enabled === true,
    title: typeof e.title === 'string' ? e.title : EVENT_DEFAULTS.title,
    body: typeof e.body === 'string' ? e.body : EVENT_DEFAULTS.body,
    period: typeof e.period === 'string' ? e.period : EVENT_DEFAULTS.period,
  };
}

// POST 用: 既存値（existing）に patch を「オブジェクト単位で」部分マージ＋検証。
//   存在しないキーは既存値を保持（shallow merge で studio 全体が消えないように）。
function validateStudio(existing, patch) {
  if (!isPlainObject(patch))
    return { error: 'studio はオブジェクト形式で指定してください。' };
  const out = { ...existing };
  for (const k of STUDIO_KEYS) {
    if (!(k in patch)) continue;
    const val = patch[k];
    if (typeof val !== 'string')
      return { error: `studio.${k} は文字列（空文字または URL）で指定してください。` };
    const s = val.trim();
    if (s === '') {
      out[k] = '';
      continue;
    }
    if (k === 'email') {
      if (!isEmail(s)) return { error: 'studio.email はメールアドレス形式で指定してください。' };
      out[k] = s.slice(0, 200);
    } else {
      if (!isHttpUrl(s))
        return { error: `studio.${k} は http:// または https:// で始まる URL を指定してください。` };
      out[k] = s.slice(0, 500);
    }
  }
  return { value: out };
}

function validateHero(existing, patch) {
  if (!isPlainObject(patch))
    return { error: 'hero はオブジェクト形式で指定してください。' };
  const out = { ...existing };
  for (const k of HERO_KEYS) {
    if (!(k in patch)) continue;
    const val = patch[k];
    if (typeof val !== 'string')
      return { error: `hero.${k} は文字列で指定してください。` };
    if (val.length > HERO_MAXLEN)
      return { error: `hero.${k} は${HERO_MAXLEN}文字以内で指定してください。` };
    out[k] = val;
  }
  return { value: out };
}

function validateEvent(existing, patch) {
  if (!isPlainObject(patch))
    return { error: 'event はオブジェクト形式で指定してください。' };
  const out = { ...existing };
  if ('enabled' in patch) {
    if (typeof patch.enabled !== 'boolean')
      return { error: 'event.enabled は true / false で指定してください。' };
    out.enabled = patch.enabled;
  }
  for (const k of ['title', 'body', 'period']) {
    if (!(k in patch)) continue;
    const val = patch[k];
    if (typeof val !== 'string')
      return { error: `event.${k} は文字列で指定してください。` };
    if (val.length > EVENT_MAXLEN[k])
      return { error: `event.${k} は${EVENT_MAXLEN[k]}文字以内で指定してください。` };
    out[k] = val;
  }
  return { value: out };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // 公開: サイト表示用にも使えるよう認証不要。基本構造を必ず保証。
      // store.getContent() は v1 キーのみ正規化して返すため、v2（studio/hero/event）は
      // 生の保存値から読み戻し、欠損時は既定値で補完して常に完全な構造を返す（後方互換）。
      const base = await store.getContent();
      const raw = await store.get(KEYS.content, null);
      return res.status(200).json({
        ...base,
        studio: fillStudio(raw && raw.studio),
        hero: fillHero(raw && raw.hero),
        event: fillEvent(raw && raw.event),
      });
    }

    if (req.method === 'POST') {
      if (!verifyToken(bearer(req))) {
        return res.status(401).json({ error: '認証が必要です。再度ログインしてください。' });
      }
      const body =
        req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');

      // 現在のコンテンツに対する「部分マージ」。指定されたキーのみ上書き。
      const current = await store.getContent();
      const raw = await store.get(KEYS.content, null);
      const next = { ...current };
      // v2 フィールドは raw から読み戻して next に積む（保存時に消えないように。
      // store.set にはこの next 全体を渡すので studio/hero/event も永続化される）。
      next.studio = fillStudio(raw && raw.studio);
      next.hero = fillHero(raw && raw.hero);
      next.event = fillEvent(raw && raw.event);

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
      if ('studio' in body) {
        const r = validateStudio(next.studio, body.studio);
        if (r.error) return res.status(400).json({ error: r.error });
        next.studio = r.value;
      }
      if ('hero' in body) {
        const r = validateHero(next.hero, body.hero);
        if (r.error) return res.status(400).json({ error: r.error });
        next.hero = r.value;
      }
      if ('event' in body) {
        const r = validateEvent(next.event, body.event);
        if (r.error) return res.status(400).json({ error: r.error });
        next.event = r.value;
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
