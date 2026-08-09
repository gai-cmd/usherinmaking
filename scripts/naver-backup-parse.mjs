/**
 * 브라우저로 저장한 네이버 글(HTML) → 구조화된 글 데이터.
 *
 * **네이버에 접속하지 않는다.** 사람이 브라우저에서 직접 저장한 파일만 읽는다.
 * 자동 수집을 금지하는 네이버 약관을 피하기 위한 설계이며, 이 규칙을 깨지 말 것.
 *
 * 에디터가 두 세대다. 하나만 지원하면 절반이 본문 0자로 잡혀 "얇은 글"로 오판된다
 * (실제로 그 오판 때문에 298건 중 218건이 버려졌다):
 *   신형 SmartEditor ONE — <p class="se-text-paragraph">
 *   구형 SmartEditor 2   — <p class="se_textarea"> (제목은 <h3 class="se_textarea">)
 *
 * 이미지도 세대별로 다르다. 구형은 파일명이 한글이고 80px 썸네일이 섞여 오므로
 * 실제 해상도로 걸러야 한다 — 파일 크기만 보면 썸네일이 통과한다.
 *
 * 이 파일은 읽기만 한다. DB·스토리지 쓰기는 naver-backup-import.mjs 가 한다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** 본문 사진으로 인정할 최소 장변. 구형 글의 80px 썸네일 스트립을 걸러낸다. */
const MIN_IMAGE_EDGE = 400;

/* ---------------------------------------------------------------- HTML 유틸 */

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

/** 태그를 벗기고 눈에 보이는 텍스트만 남긴다. 제로폭 공백(네이버가 자주 넣는다)도 제거. */
const stripTags = (s) =>
  decode(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/​/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/* ---------------------------------------------------------------- 본문 추출 */

/**
 * 문단을 순서대로 뽑는다. 신형을 먼저 시도하고, 없으면 구형으로 떨어진다.
 * 두 형식이 한 파일에 섞이는 경우는 없었다(40건 실측).
 */
function extractParagraphs(html) {
  const neo = [...html.matchAll(/<p class="se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
  if (neo.length) return { paragraphs: neo, editor: 'se-one' };

  // 구형 — 제목은 <h3>, 인용은 <blockquote>, 본문은 <p>. 본문만 가져온다.
  const old = [...html.matchAll(/<p[^>]*class="[^"]*se_textarea[^"]*"[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
  return { paragraphs: old, editor: old.length ? 'se-2' : 'unknown' };
}

/** og:title 이 가장 안정적이다 — 본문 첫 줄은 제목을 반복하기도 하고 안 하기도 한다. */
function extractTitle(html, paragraphs) {
  const og = html.match(/<meta[^>]+property="og:title"[^>]*content="([^"]*)"/);
  if (og) return decode(og[1]).trim();
  const h3 = html.match(/<h3[^>]*class="[^"]*se_textarea[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
  if (h3) return stripTags(h3[1]);
  return paragraphs[0] ?? '';
}

/** 발행일. 화면에 찍힌 "2018. 2. 4. 18:13" 형태를 읽는다. */
function extractDate(html) {
  const meta = html.match(/<meta[^>]+property="og:(?:article:)?published_time"[^>]*content="([^"]*)"/);
  if (meta) {
    const d = new Date(meta[1]);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const m = html.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*\d{1,2}:\d{2}/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return null;
}

/* ---------------------------------------------------------------- 이미지 */

/** 퍼센트 인코딩이 UTF-8 이 아닐 수 있다(구형 글은 EUC-KR). 실패하면 원본을 그대로 쓴다. */
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** 실제 픽셀 크기를 읽는다. HTML 의 width 속성은 표시 크기라 원본과 다를 수 있다. */
function imageSize(file) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0);
    const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0);
    return { width: w, height: h };
  } catch {
    return { width: 0, height: 0 };
  }
}

/**
 * 본문에 실린 순서대로 이미지를 모은다.
 *
 * 순서가 중요하다 — 첫 장이 표지가 되고, 본문 배치도 원문 순서를 따라야 한다.
 * 프로필 아이콘·이모티콘·SNS 아이콘이 같은 폴더에 섞여 있으므로 해상도로 거른다.
 */
function extractImages(html, filesDir) {
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(/<img[^>]+src="\.\/([^"]+)"[^>]*>/g)) {
    const raw = m[1].replace(/&amp;/g, '&');

    // 구형 글의 파일명은 EUC-KR 퍼센트 인코딩이라 decodeURIComponent 가 던진다.
    // 디코드본과 원본 두 형태를 모두 시도한다 — 어느 쪽으로 저장됐는지는 글마다 다르다.
    const file = [safeDecode(raw), raw]
      .map((r) => path.join(path.dirname(filesDir), r))
      .find((p) => fs.existsSync(p));
    if (!file) continue;

    const name = path.basename(file);
    if (seen.has(name)) continue;
    seen.add(name);
    if (fs.statSync(file).size < 20_000) continue; // 아이콘·이모티콘

    const { width, height } = imageSize(file);
    if (Math.max(width, height) < MIN_IMAGE_EDGE) continue; // 80px 썸네일 스트립

    // 원문이 alt 를 달아둔 경우가 드물게 있다. 있으면 참고용으로 들고 간다.
    const alt = m[0].match(/\salt="([^"]*)"/)?.[1] ?? '';
    if (alt === '프로필') continue;

    out.push({ file, name, width, height, originalAlt: decode(alt).trim() });
  }
  return out;
}

/* ---------------------------------------------------------------- 정리 규칙 */

/**
 * 검색 노출용 키워드 껍데기를 벗긴다.
 * `{오키나와스냅,오키나와커플스냅,세미웨딩:어셔린메이킹}오키나와셀프웨딩, 웨딩스냅의 피날레`
 *   → `오키나와셀프웨딩, 웨딩스냅의 피날레`
 *
 * 벗긴 뒤가 너무 짧으면 원제목을 살린다 — 제목 전체가 키워드인 글이 있다.
 */
export function cleanTitle(raw) {
  let t = raw
    .replace(/^\s*[{[(][^}\])]*[}\])]\s*/, '') // 앞머리 중괄호 묶음
    .replace(/[:：]?\s*(by\s*)?어셔린메이킹\s*/gi, ' ')
    .replace(/\s*_\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,:：—·-]+|[\s,:：—·-]+$/g, '')
    .trim();

  // 여전히 키워드 나열이면(쉼표 2개 이상) 가장 뒤 조각이 대개 진짜 제목이다.
  if ((t.match(/,/g) || []).length >= 2) {
    const tail = t
      .split(/[,:：]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .pop();
    if (tail && tail.length >= 6) t = tail;
  }
  return t.length >= 4 ? t : raw.replace(/\s+/g, ' ').trim();
}

/* ---------------------------------------------------------------- 진입점 */

/** 저장 폴더 하나를 읽어 글 목록을 돌려준다. */
export function parseBackupDir(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.html'))
    .sort();

  return files.map((f) => {
    const full = path.join(dir, f);
    const html = fs.readFileSync(full, 'utf8');
    const logNo = path.basename(f).match(/(\d{9,})/)?.[1] ?? null;
    const filesDir = full.replace(/\.html$/i, '_files');

    const { paragraphs, editor } = extractParagraphs(html);
    const titleRaw = extractTitle(html, paragraphs);

    // 첫 문단이 제목을 그대로 반복하면 본문에서 뺀다(두 에디터 모두에서 발생).
    const body =
      paragraphs.length && paragraphs[0].replace(/\s/g, '') === titleRaw.replace(/\s/g, '')
        ? paragraphs.slice(1)
        : paragraphs;

    const images = fs.existsSync(filesDir) ? extractImages(html, filesDir) : [];

    return {
      logNo,
      file: full,
      editor,
      titleRaw,
      title: cleanTitle(titleRaw),
      date: extractDate(html),
      paragraphs: body,
      chars: body.join('').length,
      images,
      link: logNo ? `https://blog.naver.com/usherinmaking/${logNo}` : null,
    };
  });
}

/* ---------------------------------------------------------------- CLI */

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? `${process.env.HOME}/Downloads/naver_blog`;
  const posts = parseBackupDir(dir);

  console.log(`${dir}\n읽은 파일 ${posts.length}건\n`);
  console.log('글번호        형식     날짜        본문   이미지  제목');
  console.log('───────────  ───────  ──────────  ─────  ─────  ────');
  for (const p of posts) {
    console.log(
      `${String(p.logNo).padEnd(12)} ${p.editor.padEnd(7)} ${String(p.date).padEnd(10)} ` +
        `${String(p.chars).padStart(5)}  ${String(p.images.length).padStart(5)}  ${p.title.slice(0, 40)}`,
    );
  }

  const bad = posts.filter((p) => p.chars < 400 || !p.date || p.editor === 'unknown');
  console.log(
    `\n본문 ${posts.reduce((a, p) => a + p.chars, 0).toLocaleString()}자 · ` +
      `이미지 ${posts.reduce((a, p) => a + p.images.length, 0)}장 · 점검 필요 ${bad.length}건`,
  );
  for (const p of bad) {
    console.log(`  ⚠️ ${p.logNo} — 본문 ${p.chars}자 · 날짜 ${p.date} · 형식 ${p.editor}`);
  }
}
