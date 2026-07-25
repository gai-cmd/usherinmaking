// api/_lib/blog.js — ブログ記事の共通ヘルパー
// ---------------------------------------------------------------------------
//   - スラッグ生成 / 記事の正規化（保存スキーマの一元化）
//   - Naver ブログ RSS の取得・解析（記事一覧）
//   - Naver PostView から本文・画像・日付を抽出（下書き作成用）
// すべて Node 標準の fetch を使用（外部依存なし）。抽出は完璧を狙わず、
// 「管理画面で校正できる十分な下書き」を作ることを目的とする。
// ---------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';

export const POSTS_KEY = 'uim:posts';

export const POST_STATUSES = ['draft', 'published'];

// ─── スラッグ ────────────────────────────────────────────────────────────────
// ASCII の見出しがあればそれを、無ければ logNo / 乱数で一意なスラッグを作る。
export function slugify(input, fallbackSeed = '') {
  let s = String(input || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (!s) {
    const seed = String(fallbackSeed || '').replace(/[^a-z0-9]/gi, '').slice(-8);
    s = 'post-' + (seed || randomBytes(4).toString('hex'));
  }
  return s;
}

export function genId() {
  return 'post_' + randomBytes(6).toString('hex');
}

// ─── i18n ───────────────────────────────────────────────────────────────────
function i18n(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return {
      ja: typeof v.ja === 'string' ? v.ja : '',
      en: typeof v.en === 'string' ? v.en : '',
      ko: typeof v.ko === 'string' ? v.ko : '',
    };
  }
  const s = v == null ? '' : String(v);
  return { ja: s, en: '', ko: '' };
}

const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ─── 記事の正規化（保存・読み出し両方で使用） ─────────────────────────────────
export function normalizePost(p, i = 0) {
  const o = p && typeof p === 'object' ? p : {};
  const status = POST_STATUSES.includes(o.status) ? o.status : 'draft';
  const tags = Array.isArray(o.tags)
    ? o.tags.map((t) => String(t).slice(0, 40)).filter(Boolean).slice(0, 20)
    : [];
  return {
    id: String(o.id || genId()).slice(0, 40),
    slug: slugify(o.slug || '', o.id || String(i + 1)),
    status,
    category: String(o.category || '').slice(0, 60),
    tags,
    cover: String(o.cover || '').slice(0, 600),
    date: isYmd(o.date) ? o.date : '',
    author: String(o.author || 'usher in making').slice(0, 80),
    title: clampI18n(i18n(o.title), 200),
    excerpt: clampI18n(i18n(o.excerpt), 600),
    body: clampI18n(i18n(o.body), 60000),
    source: o.source && typeof o.source === 'object'
      ? { logNo: String(o.source.logNo || '').slice(0, 40), url: String(o.source.url || '').slice(0, 300) }
      : null,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : '',
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : '',
  };
}

function clampI18n(m, max) {
  return {
    ja: String(m.ja || '').slice(0, max),
    en: String(m.en || '').slice(0, max),
    ko: String(m.ko || '').slice(0, max),
  };
}

// 一覧表示用の軽量フィールド（公開 API の list / 管理一覧で使用）。
export function postSummary(p) {
  return {
    id: p.id,
    slug: p.slug,
    status: p.status,
    category: p.category,
    tags: p.tags,
    cover: p.cover,
    date: p.date,
    title: p.title,
    excerpt: p.excerpt,
    updatedAt: p.updatedAt,
    hasJa: !!(p.body && p.body.ja),
    hasEn: !!(p.body && p.body.en),
  };
}

// ─── HTML サニタイズ（抽出本文用：許可タグのみ・属性は src/href/alt のみ） ───────
const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption']);

// URL のスキームを許可リストで検証（javascript: / data: / vbscript: 等を遮断）。
//   img src : http(s) と ルート相対（/…）のみ
//   a href  : http(s)・mailto・ルート相対・ページ内アンカーのみ
function safeUrl(url, { allowMailto = false } = {}) {
  // 制御文字・空白（タブ・改行等）はブラウザがスキーム判定前に無視するため除去して判定する。
  const u = String(url || '').trim().replace(/[\u0000-\u0020\u007f]/g, '');
  if (!u) return '';
  if (/^(?:https?:)?\/\//i.test(u)) return u;          // http(s) / protocol-relative
  if (u.startsWith('/') || u.startsWith('#')) return u; // ルート相対・アンカー
  if (allowMailto && /^mailto:/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';        // その他スキームは拒否
  return u;                                             // 相対パス
}

export function sanitizeHtml(html) {
  let s = String(html || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  // タグを許可リストでフィルタし、属性を絞る
  s = s.replace(/<(\/?)([a-z0-9]+)([^>]*)>/gi, (m, close, tag, attrs) => {
    tag = tag.toLowerCase();
    if (!ALLOWED.has(tag)) return '';
    if (close) return `</${tag}>`;
    if (tag === 'img') {
      const raw = (attrs.match(/\bsrc\s*=\s*"([^"]+)"/i) || attrs.match(/\bdata-lazy-src\s*=\s*"([^"]+)"/i) || [])[1] || '';
      const src = safeUrl(raw);
      const alt = (attrs.match(/\balt\s*=\s*"([^"]*)"/i) || [])[1] || '';
      if (!src) return '';
      return `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
    }
    if (tag === 'a') {
      const raw = (attrs.match(/\bhref\s*=\s*"([^"]+)"/i) || [])[1] || '';
      const href = safeUrl(raw, { allowMailto: true });
      return href ? `<a href="${href}" target="_blank" rel="noopener">` : '<a>';
    }
    return `<${tag}>`;
  });
  // 空段落・連続空白の整理
  s = s.replace(/<p>\s*<\/p>/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCp(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;|&#8201;|&thinsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/[​ ﻿]/g, ' ').replace(/\s+/g, ' ').trim();
}
function safeCp(n) {
  try { return Number.isFinite(n) ? String.fromCodePoint(n) : ''; } catch { return ''; }
}

// ─── Naver RSS 取得・解析 ─────────────────────────────────────────────────────
export async function fetchRss(blogId) {
  const id = (blogId || 'usherinmaking').replace(/[^a-z0-9_-]/gi, '');
  const url = `https://rss.blog.naver.com/${id}.xml`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) {
    const e = new Error(`Naver RSS の取得に失敗しました (${res.status})。`);
    e.status = res.status;
    throw e;
  }
  const xml = await res.text();
  const items = [];
  const reItem = /<item>([\s\S]*?)<\/item>/g;
  let m;
  const cdata = (block, tag) => {
    const r = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i').exec(block);
    return r ? r[1].trim() : '';
  };
  while ((m = reItem.exec(xml))) {
    const b = m[1];
    const link = cdata(b, 'link');
    const logNo = (link.match(/\/(\d{6,})(?:[?#]|$)/) || [])[1] || '';
    const descRaw = cdata(b, 'description');
    const thumb = (descRaw.match(/<img[^>]+src="([^"]+)"/i) || [])[1] || '';
    items.push({
      logNo,
      title: decodeEntities(cdata(b, 'title')),
      link: link.replace(/\?.*$/, ''),
      category: decodeEntities(cdata(b, 'category')),
      tags: decodeEntities(cdata(b, 'tag')),
      pubDate: cdata(b, 'pubDate'),
      date: toYmd(cdata(b, 'pubDate')),
      excerpt: stripTags(decodeEntities(descRaw)).slice(0, 200),
      thumbnail: thumb,
    });
  }
  return items;
}

function toYmd(rfc) {
  // RFC822 "Thu, 21 May 2026 17:55:33 +0900" → "2026-05-21"（Date.now 非依存）
  const M = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const r = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/.exec(String(rfc || ''));
  if (!r) return '';
  const dd = r[1].padStart(2, '0');
  return `${r[3]}-${M[r[2]] || '01'}-${dd}`;
}

// ─── Naver PostView 本文抽出 ─────────────────────────────────────────────────
export async function fetchPostBody(blogId, logNo) {
  const id = (blogId || 'usherinmaking').replace(/[^a-z0-9_-]/gi, '');
  const no = String(logNo).replace(/[^0-9]/g, '');
  if (!no) throw new Error('logNo가 올바르지 않습니다.');
  const url = `https://blog.naver.com/PostView.naver?blogId=${id}&logNo=${no}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  if (!res.ok) {
    const e = new Error(`Naver 本文の取得に失敗しました (${res.status})。`);
    e.status = res.status;
    throw e;
  }
  const html = await res.text();
  const ogTitle = decodeEntities((html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) || [])[1] || '');
  const ogImage = (html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i) || [])[1] || '';

  // se-main-container の本文を抽出（取れなければ postViewArea にフォールバック）。
  let container = sliceContainer(html, 'se-main-container') || sliceContainer(html, 'se_component_wrap') || '';
  // 段落と画像を文書順にトークナイズして本文 HTML を再構成。
  const parts = [];
  const re = /<p[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>|<img\b[^>]*>/gi;
  let t;
  const seen = new Set();
  while ((t = re.exec(container))) {
    if (t[1] !== undefined) {
      const txt = stripTags(decodeEntities(t[1]));
      if (txt) parts.push(`<p>${txt}</p>`);
    } else {
      const tag = t[0];
      const src = (tag.match(/\bdata-lazy-src="([^"]+)"/i) || tag.match(/\bsrc="([^"]+)"/i) || [])[1] || '';
      if (src && /pstatic\.net|phinf|blogfiles|postfiles/i.test(src) && !seen.has(src)) {
        seen.add(src);
        const clean = src.replace(/\?type=\w+$/, '?type=w966');
        parts.push(`<figure><img src="${clean}" alt="" loading="lazy" decoding="async"></figure>`);
      }
    }
  }
  const body = parts.join('\n');
  return {
    title: ogTitle,
    cover: ogImage,
    body,
    images: Array.from(seen),
    url: `https://blog.naver.com/${id}/${no}`,
  };
}

// クラス名でブロックの内側を粗く切り出す（最初の一致から末尾側の妥当な範囲）。
function sliceContainer(html, className) {
  const start = html.search(new RegExp(`<div[^>]*class="[^"]*${className}[^"]*"`, 'i'));
  if (start === -1) return '';
  // 開始 div から、フッター/コメント領域が始まる手前までを大まかに採用。
  let tail = html.slice(start);
  const cut = tail.search(/<div[^>]*class="[^"]*(?:post_footer|area_comment|se-comment|wrap_postcomment|post_btns)/i);
  if (cut > 0) tail = tail.slice(0, cut);
  return tail;
}

export default {
  POSTS_KEY,
  POST_STATUSES,
  slugify,
  genId,
  normalizePost,
  postSummary,
  sanitizeHtml,
  fetchRss,
  fetchPostBody,
};
