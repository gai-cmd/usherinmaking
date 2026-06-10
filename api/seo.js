// Vercel Serverless Function — /api/seo  （契約 v4 / エージェントA 所有）
// ページの SEO/AEO メタ（title / description / keywords / ogType / ogImage /
// breadcrumb / product / gallery / faq）の取得・保存。
//
//   - GET  /api/seo?path=X            → 公開可。{ path, seo }（既定値 + KV 値のマージ）
//   - POST /api/seo   (要トークン)     → { path, seo } を部分マージ保存（トップレベルキー単位）
//
// 既定値は scripts/extract_page_defaults.py が seo/seo.json から変換した
//   api/_lib/seo_defaults.json。保存は store.js、キーは "uim:seo"。
//
// ロケール: title/description などは locale 別に別キー（"about.html" = ja、
//   "en/about.html" = en）で保持する（seo.json の構造踏襲）。よって path は en/ を
//   保持したまま正規化する。faq の q/a のみ { ja, en } 二言語で持つ。
//
// トークン検証は api/admin.js / api/content.js と同方式。

import fs from 'node:fs';
import store from './_lib/store.js';
import { verifyToken } from './_lib/auth.js';

const SEO_KEY = 'uim:seo';

let SEO_DEFAULTS = {};
try {
  SEO_DEFAULTS = JSON.parse(
    fs.readFileSync(new URL('./_lib/seo_defaults.json', import.meta.url), 'utf8')
  );
} catch (e) {
  console.error('[seo] seo_defaults.json の読み込みに失敗（空で継続）', e);
  SEO_DEFAULTS = {};
}

// ─── トークン検証は api/_lib/auth.js に集約（ADMIN_TOKEN_SECRET / ADMIN_PASSWORD 由来） ───

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// SEO は en/ をロケール別キーとして保持するため、ここでは en/ を残す。
function normalizePath(raw) {
  let p = (raw == null ? '' : String(raw)).trim();
  p = p.split(/[?#]/)[0];
  if (p.startsWith('/')) p = p.slice(1);
  if (p === '' || p === 'index') p = 'index.html';
  if (p === 'en' || p === 'en/' || p === 'en/index') p = 'en/index.html';
  if (!/^(en\/)?[a-z0-9][a-z0-9._-]*\.html$/i.test(p)) return null;
  return p;
}

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

// ─── SEO パッチの検証（指定キーのみ・トップレベル部分マージ） ─────────────────
const STR_FIELDS = {
  title: 300,
  description: 1000,
  keywords: 600,
  ogType: 60,
  ogImage: 500,
  slug: 200,
};

function validateSeoPatch(patch) {
  if (!isPlainObject(patch))
    return { error: 'seo는 객체로 지정해 주세요.' };
  const out = {};

  for (const [k, max] of Object.entries(STR_FIELDS)) {
    if (!(k in patch)) continue;
    const val = patch[k];
    if (typeof val !== 'string')
      return { error: `seo.${k}은(는) 문자열로 지정해 주세요.` };
    out[k] = val.slice(0, max);
  }

  if ('breadcrumb' in patch) {
    const b = patch.breadcrumb;
    if (!Array.isArray(b)) return { error: 'seo.breadcrumb는 배열로 지정해 주세요.' };
    const bc = [];
    for (let i = 0; i < b.length; i++) {
      const row = b[i];
      if (!Array.isArray(row) || row.length !== 2)
        return { error: `seo.breadcrumb[${i}]은(는) [명칭, URL]의 2요소 배열로 지정해 주세요.` };
      bc.push([String(row[0] || '').slice(0, 200), String(row[1] || '').slice(0, 500)]);
    }
    out.breadcrumb = bc;
  }

  if ('gallery' in patch) {
    const g = patch.gallery;
    if (!Array.isArray(g)) return { error: 'seo.gallery는 배열로 지정해 주세요.' };
    out.gallery = g.map((s) => String(s || '').slice(0, 500)).slice(0, 200);
  }

  if ('product' in patch) {
    const p = patch.product;
    if (!isPlainObject(p)) return { error: 'seo.product는 객체로 지정해 주세요.' };
    out.product = {
      name: String(p.name || '').slice(0, 200),
      image: String(p.image || '').slice(0, 500),
      description: String(p.description || '').slice(0, 1000),
    };
  }

  if ('faq' in patch) {
    const f = patch.faq;
    if (!Array.isArray(f)) return { error: 'seo.faq는 배열로 지정해 주세요.' };
    if (f.length > 50) return { error: 'seo.faq는 최대 50건까지입니다.' };
    const faq = [];
    for (let i = 0; i < f.length; i++) {
      const qa = f[i];
      if (!isPlainObject(qa))
        return { error: `seo.faq[${i}]은(는) { q, a }(으)로 지정해 주세요.` };
      faq.push({ q: toI18n(qa.q), a: toI18n(qa.a) });
    }
    out.faq = faq;
  }

  return { value: out };
}

function mergedSeo(path, storedAll) {
  const base = isPlainObject(SEO_DEFAULTS[path]) ? SEO_DEFAULTS[path] : {};
  const stored = storedAll && isPlainObject(storedAll[path]) ? storedAll[path] : {};
  const out = { ...base, ...stored };
  if (!Array.isArray(out.faq)) out.faq = [];
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const path = normalizePath(req.query && req.query.path);
      if (!path) return res.status(400).json({ error: 'path가 올바르지 않습니다.' });
      const storedAll = await store.get(SEO_KEY, null);
      return res.status(200).json({ path, seo: mergedSeo(path, storedAll) });
    }

    if (req.method === 'POST') {
      if (!verifyToken(req)) {
        return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해 주세요.' });
      }
      const body =
        req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');

      const path = normalizePath(body.path);
      if (!path) return res.status(400).json({ error: 'path가 올바르지 않습니다.' });

      const r = validateSeoPatch(body.seo);
      if (r.error) return res.status(400).json({ error: r.error });

      const storedAll = isPlainObject(await store.get(SEO_KEY, null))
        ? await store.get(SEO_KEY, null)
        : {};
      const cur = isPlainObject(storedAll[path]) ? storedAll[path] : {};
      storedAll[path] = { ...cur, ...r.value };

      try {
        await store.set(SEO_KEY, storedAll);
      } catch (e) {
        console.error('[seo] write failed (read-only fs?)', e);
        return res.status(500).json({ error: '저장에 실패했습니다. 운영 환경에서는 Vercel KV를 사용해 주세요.' });
      }
      return res.status(200).json({ ok: true, path, seo: mergedSeo(path, storedAll) });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('[seo]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
