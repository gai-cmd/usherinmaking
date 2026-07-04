#!/usr/bin/env node
// scripts/import_naver_local.mjs — Naver 블로그 → blog_posts.json 로컬 임포트
// ---------------------------------------------------------------------------
// 관리 화면(/admin.html)의 [가져오기]와 같은 파이프라인을 로컬에서 실행한다:
//   Naver RSS → 본문 추출 → sanitize → Gemini 번역(ja/en) → blog_posts.json
// 생성된 blog_posts.json 은
//   - python3 scripts/bake_blog.py 로 정적 페이지에 베이크되고
//   - KV(uim:posts)가 비어 있을 때 vercel_build.py 의 폴백으로도 쓰인다.
//
// 사용법:
//   GEMINI_API_KEY=... node scripts/import_naver_local.mjs [개수=15]
//
// 번역 노트: 이미지/figure 태그는 ⟦IMG n⟧ 플레이스홀더로 치환한 뒤 번역하고
// 복원한다 (토큰 절약 + URL 훼손 방지). 원문 제목이 키워드 나열식이므로
// 대상 언어에서는 자연스러운 마케팅 제목으로 다듬도록 지시한다.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchRss, fetchPostBody, sanitizeHtml, slugify, genId, normalizePost } from '../api/_lib/blog.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'blog_posts.json');
const LIMIT = Number(process.argv[2] || 15);
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const PAUSE_MS = 6500; // 무료 티어 10 RPM 준수

if (!KEY) {
  console.error('GEMINI_API_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 이미지 플레이스홀더 ──────────────────────────────────────────────────────
function maskImages(html) {
  const blocks = [];
  const masked = String(html || '').replace(/<figure>[\s\S]*?<\/figure>|<img\b[^>]*>/gi, (m) => {
    blocks.push(m);
    return `⟦IMG${blocks.length}⟧`;
  });
  return { masked, blocks };
}
function unmaskImages(text, blocks) {
  let out = String(text || '');
  blocks.forEach((b, i) => {
    out = out.replace(new RegExp(`⟦\\s*IMG\\s*${i + 1}\\s*⟧`, 'g'), b);
  });
  // 남은 플레이스홀더(모델이 누락 표기한 것)는 제거
  out = out.replace(/⟦\s*IMG\s*\d+\s*⟧/g, '');
  return out;
}

// ── Gemini 호출 ──────────────────────────────────────────────────────────────
async function gemini(system, user) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(KEY)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: 6000, temperature: 0.3 },
      }),
    });
    if (res.status === 429 || res.status >= 500) {
      console.log(`  … Gemini ${res.status}, ${20 * (attempt + 1)}s 대기 후 재시도`);
      await sleep(20000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p.text || '').join('').trim();
  }
  throw new Error('Gemini: 재시도 초과');
}

function extractJson(s) {
  if (!s) return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  if (fenced) s = fenced[1];
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

const LANG = { ja: '日本語 (Japanese)', en: 'English' };

async function translate(fields, target) {
  const system =
    `You are the localization editor for "usher in making", a wedding & anniversary photo studio in Okinawa, Japan ` +
    `(the only Korean female photographer team in Okinawa; soft Korean-style photography). ` +
    `Translate the given Korean blog post into ${LANG[target]}. ` +
    `RULES: (1) The Korean TITLE is a keyword list — do NOT translate it literally; write ONE natural, elegant marketing title ` +
    `in ${LANG[target]} that reflects the content (keep place names such as Okinawa / Miyakojima). ` +
    `(2) EXCERPT: one or two natural sentences summarizing the post. ` +
    `(3) BODY: translate the visible text naturally; keep the ⟦IMG n⟧ placeholders EXACTLY where they are — never remove, merge or renumber them; keep all other HTML tags as-is. ` +
    `(4) Do not translate the brand name "usher in making" / "usherinmaking" / "어셔린메이킹" → always "usher in making". ` +
    `(5) Return ONLY JSON: {"title":"...","excerpt":"...","body":"..."}.`;
  const user = `Translate into ${LANG[target]}. Return JSON only.\n\n` + JSON.stringify(fields, null, 2);
  const parsed = extractJson(await gemini(system, user));
  if (!parsed || typeof parsed.body !== 'string') throw new Error('번역 JSON 파싱 실패');
  return parsed;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
const items = (await fetchRss('usherinmaking')).slice(0, LIMIT);
console.log(`RSS ${items.length}건 가져오기 시작 (번역 모델: ${MODEL})`);

// 기존 파일이 있으면 이어서(재실행 안전)
let posts = [];
if (fs.existsSync(OUT)) {
  try { posts = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { posts = []; }
}
const seen = new Set(posts.map((p) => p.source && p.source.logNo).filter(Boolean));

let n = 0;
for (const it of items) {
  n++;
  if (!it.logNo || seen.has(it.logNo)) { console.log(`[${n}/${items.length}] skip (중복) ${it.logNo}`); continue; }
  console.log(`[${n}/${items.length}] ${it.date} ${it.title.slice(0, 40)}…`);
  let data;
  try { data = await fetchPostBody('usherinmaking', it.logNo); }
  catch (e) { console.log('  ! 본문 추출 실패:', e.message); continue; }

  const bodyKo = sanitizeHtml(data.body);
  const { masked, blocks } = maskImages(bodyKo);
  const fields = { title: data.title || it.title, excerpt: it.excerpt || '', body: masked };

  let ja, en;
  try {
    ja = await translate(fields, 'ja');
    await sleep(PAUSE_MS);
    en = await translate(fields, 'en');
    await sleep(PAUSE_MS);
  } catch (e) {
    console.log('  ! 번역 실패, 이 글은 건너뜀:', e.message);
    continue;
  }

  const post = normalizePost({
    id: genId(),
    slug: slugify(en.title || '', it.logNo),
    status: 'published',
    category: 'Snap',
    cover: data.cover || it.thumbnail || '',
    date: it.date || '',
    author: 'usher in making',
    title: { ko: fields.title, ja: ja.title || '', en: en.title || '' },
    excerpt: { ko: fields.excerpt, ja: ja.excerpt || '', en: en.excerpt || '' },
    body: {
      ko: bodyKo,
      ja: sanitizeHtml(unmaskImages(ja.body, blocks)),
      en: sanitizeHtml(unmaskImages(en.body, blocks)),
    },
    source: { logNo: it.logNo, url: it.link },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  posts.push(post);
  seen.add(it.logNo);
  fs.writeFileSync(OUT, JSON.stringify(posts, null, 2)); // 진행 중 저장(중단 대비)
  console.log(`  ✓ ja: ${ja.title.slice(0, 40)} / en: ${en.title.slice(0, 40)}`);
}

console.log(`완료: ${posts.length}건 → ${path.relative(ROOT, OUT)}`);
console.log('다음: python3 scripts/bake_blog.py && python3 seo/build_seo.py apply && python3 scripts/build_sitemap.py');
