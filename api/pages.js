// Vercel Serverless Function — /api/pages  （契約 v4 / エージェントA 所有）
// ページ本文（page-hero / statement / editorial / photos など）の取得・保存。
//
//   - GET  /api/pages?path=X            → 公開可。{ path, regions }（既定値 + KV 値のマージ）
//   - POST /api/pages   (要トークン)     → { path, regions } を部分マージ保存（リージョン単位で置換）
//
// 既定値は scripts/extract_page_defaults.py が静的 HTML から抽出した
//   api/_lib/page_defaults.json（fs.readFileSync(new URL(...)) でバンドル同梱を保証）。
// 保存は store.js（KV があれば KV、無ければ /tmp JSON）。キーは "uim:pages"。
//
// en/ ページは別エントリではなく、同じ path キーの値に ja/en 両方を保持する
//   （プレビュー・ベイクが経路を見て locale を選択）。よって path は en/ を取り除いた
//   ルート相対（ルートは index.html）に正規化する。
//
// リージョン値の型（region_map.json と同形）:
//   text  : { "<field>": { ja, en }, ... }
//   lines : { "lines": [ { "text": { ja, en }, "dim": bool }, ... ] }
//   photos: { "items": [ { "src", "caption": { ja, en } }, ... ] }
//
// トークン検証は api/admin.js / api/content.js と同方式（ADMIN_PASSWORD 由来の HMAC）。

import crypto from 'node:crypto';
import fs from 'node:fs';
import store from './_lib/store.js';

const PAGES_KEY = 'uim:pages';

// ─── 既定値の読み込み（バンドル同梱を保証） ────────────────────────────────
let PAGE_DEFAULTS = {};
try {
  PAGE_DEFAULTS = JSON.parse(
    fs.readFileSync(new URL('./_lib/page_defaults.json', import.meta.url), 'utf8')
  );
} catch (e) {
  console.error('[pages] page_defaults.json の読み込みに失敗（空で継続）', e);
  PAGE_DEFAULTS = {};
}

// ─── トークン検証（自己完結） ───────────────────────────────────────────────
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

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// ─── path 正規化（en/ は同一キーに統合、ルートは index.html） ────────────────
//   不正・経路外（../ や / を含む）は null を返す。
function normalizePath(raw) {
  let p = (raw == null ? '' : String(raw)).trim();
  p = p.split(/[?#]/)[0];
  if (p.startsWith('/')) p = p.slice(1);
  if (p.startsWith('en/')) p = p.slice(3);
  if (p === '' || p === 'index') p = 'index.html';
  if (!/^[a-z0-9][a-z0-9._-]*\.html$/i.test(p)) return null;
  return p;
}

// ─── i18n ヘルパ ─────────────────────────────────────────────────────────────
function toI18n(v) {
  if (typeof v === 'string') return { ja: v, en: '' };
  if (isPlainObject(v)) {
    return {
      ja: typeof v.ja === 'string' ? v.ja : '',
      en: typeof v.en === 'string' ? v.en : '',
    };
  }
  return { ja: '', en: '' };
}
function validateI18n(v, label, maxlen) {
  if (typeof v === 'string') {
    if (v.length > maxlen) return { error: `${label}은(는) ${maxlen}자 이내로 입력해 주세요.` };
    return { value: { ja: v, en: '' } };
  }
  if (isPlainObject(v)) {
    const ja = v.ja == null ? '' : v.ja;
    const en = v.en == null ? '' : v.en;
    if (typeof ja !== 'string' || typeof en !== 'string')
      return { error: `${label}의 ja / en은 문자열로 지정해 주세요.` };
    if (ja.length > maxlen || en.length > maxlen)
      return { error: `${label}은(는) ${maxlen}자 이내로 입력해 주세요.` };
    return { value: { ja, en } };
  }
  return { error: `${label}은(는) 문자열 또는 { ja, en }(으)로 지정해 주세요.` };
}

// ─── リージョン値の型検証（text / lines / photos を形から判定） ──────────────
const TEXT_MAXLEN = 4000;
const LINE_MAXLEN = 2000;
const MAX_LINES = 200;
const MAX_ITEMS = 200;
const CAPTION_MAXLEN = 500;

function validateRegion(rid, v) {
  if (!isPlainObject(v)) return { error: `regions.${rid}은(는) 객체로 지정해 주세요.` };

  // lines 型
  if (Array.isArray(v.lines)) {
    if (v.lines.length > MAX_LINES)
      return { error: `regions.${rid}.lines는 최대 ${MAX_LINES}행까지입니다.` };
    const lines = [];
    for (let i = 0; i < v.lines.length; i++) {
      const ln = v.lines[i];
      if (!isPlainObject(ln))
        return { error: `regions.${rid}.lines[${i}]은(는) 객체로 지정해 주세요.` };
      const r = validateI18n(ln.text == null ? '' : ln.text, `regions.${rid}.lines[${i}].text`, LINE_MAXLEN);
      if (r.error) return r;
      lines.push({ text: r.value, dim: ln.dim === true });
    }
    return { value: { lines } };
  }

  // photos 型
  if (Array.isArray(v.items)) {
    if (v.items.length > MAX_ITEMS)
      return { error: `regions.${rid}.items는 최대 ${MAX_ITEMS}건까지입니다.` };
    const items = [];
    for (let i = 0; i < v.items.length; i++) {
      const it = v.items[i];
      if (!isPlainObject(it))
        return { error: `regions.${rid}.items[${i}]은(는) 객체로 지정해 주세요.` };
      const src = String(it.src == null ? '' : it.src).trim();
      if (!(src.startsWith('/images/') || /^https:\/\//i.test(src)))
        return { error: `regions.${rid}.items[${i}].src는 /images/ 또는 https://로 시작해야 합니다.` };
      const cr = validateI18n(it.caption == null ? '' : it.caption, `regions.${rid}.items[${i}].caption`, CAPTION_MAXLEN);
      if (cr.error) return cr;
      items.push({ src: src.slice(0, 500), caption: cr.value });
    }
    return { value: { items } };
  }

  // text 型（各フィールドが { ja, en }）
  const out = {};
  for (const [field, fv] of Object.entries(v)) {
    const r = validateI18n(fv, `regions.${rid}.${field}`, TEXT_MAXLEN);
    if (r.error) return r;
    out[field] = r.value;
  }
  return { value: out };
}

// ─── 既定値 + 保存値のマージ（リージョン単位で保存値が優先） ─────────────────
function mergedRegions(path, storedAll) {
  const base = (PAGE_DEFAULTS[path] && PAGE_DEFAULTS[path].regions) || {};
  const stored = (storedAll && storedAll[path] && storedAll[path].regions) || {};
  return { ...base, ...stored };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const path = normalizePath(req.query && req.query.path);
      if (!path) return res.status(400).json({ error: 'path가 올바르지 않습니다.' });
      const storedAll = await store.get(PAGES_KEY, null);
      return res.status(200).json({ path, regions: mergedRegions(path, storedAll) });
    }

    if (req.method === 'POST') {
      if (!verifyToken(bearer(req))) {
        return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해 주세요.' });
      }
      const body =
        req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');

      const path = normalizePath(body.path);
      if (!path) return res.status(400).json({ error: 'path가 올바르지 않습니다.' });
      if (!isPlainObject(body.regions))
        return res.status(400).json({ error: 'regions는 객체로 지정해 주세요.' });

      // 入力リージョンを型検証
      const validated = {};
      for (const [rid, val] of Object.entries(body.regions)) {
        const r = validateRegion(rid, val);
        if (r.error) return res.status(400).json({ error: r.error });
        validated[rid] = r.value;
      }

      // 既存の保存値（全ページ）を起点にリージョン単位で部分マージ
      const storedAll = isPlainObject(await store.get(PAGES_KEY, null))
        ? await store.get(PAGES_KEY, null)
        : {};
      const cur = isPlainObject(storedAll[path]) ? storedAll[path] : { regions: {} };
      const curRegions = isPlainObject(cur.regions) ? cur.regions : {};
      const nextRegions = { ...curRegions, ...validated };
      storedAll[path] = { regions: nextRegions };

      try {
        await store.set(PAGES_KEY, storedAll);
      } catch (e) {
        console.error('[pages] write failed (read-only fs?)', e);
        return res.status(500).json({ error: '저장에 실패했습니다. 운영 환경에서는 Vercel KV를 사용해 주세요.' });
      }
      // 返却は既定値マージ後の最新（プレビューと同じ見え方）
      return res.status(200).json({ ok: true, path, regions: mergedRegions(path, storedAll) });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('[pages]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
