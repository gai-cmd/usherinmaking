/**
 * 네이버 블로그 → 촬영후기(KO) **실제 취입**. DB 와 Blob 에 쓴다.
 *
 * SEO 판단(.moai/handoff/DECISION-BLOG-IMPORT-SEO.md)에 따라 **원문 복사가 아니라 정리본**으로 넣는다:
 *   ① 제목의 검색 키워드 껍데기 제거      ② 첫 줄에 그 촬영이 무엇이었는지 한 문장
 *   ③ 본문 끝에 원문 링크 명시(출처)      ④ 이미지는 Blob 재호스팅(네이버 직링크 금지)
 *   ⑤ 얇은 글(본문 400자 미만·이미지 3장 미만)은 후보에서 뺀다
 *
 * 사실은 손대지 않는다 — 문단 순서와 내용은 원문 그대로 옮기고, 위 다섯 가지만 더한다.
 *
 * 실행: node scripts/naver-journal-import.mjs [--limit 10] [--dry]
 *   --dry 를 붙이면 무엇을 넣을지만 출력하고 DB·Blob 에 쓰지 않는다.
 */

import path from 'node:path';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const ROOT = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return { url: pathToFileURL(path.join(ROOT, 'src', `${specifier.slice(2)}.ts`)).href, shortCircuit: true };
    }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      try {
        return nextResolve(specifier, context);
      } catch (err) {
        if (path.extname(specifier) === '') return nextResolve(`${specifier}.ts`, context);
        throw err;
      }
    }
    return nextResolve(specifier, context);
  },
});

const BLOG_ID = 'usherinmaking';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 10;

/* ---------------------------------------------------------------- 원문 읽기 */

const stripTags = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/​/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

async function get(url, referer) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...(referer && { Referer: referer }) } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

const parseLoose = (t) => JSON.parse(t.slice(t.indexOf('{')).replace(/"pagingHtml"\s*:\s*"(?:[^"\\]|\\.)*",?/g, ''));

async function listPage(n) {
  const t = await get(
    `https://blog.naver.com/PostTitleListAsync.naver?blogId=${BLOG_ID}` +
      `&viewdate=&currentPage=${n}&categoryNo=0&parentCategoryNo=&countPerPage=30`,
    `https://blog.naver.com/${BLOG_ID}`,
  );
  return parseLoose(t);
}

async function fetchPost(logNo) {
  const html = await get(`https://blog.naver.com/PostView.naver?blogId=${BLOG_ID}&logNo=${logNo}`);
  const paras = [...html.matchAll(/<p class="se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
  const images = [...new Set([...html.matchAll(/data-lazy-src="([^"]+)"/g)].map((m) => m[1]))].filter((u) =>
    /postfiles|blogfiles/.test(u),
  );
  return { paras, images };
}

/* ---------------------------------------------------------------- 정리 규칙 */

/** 검색 노출용 키워드 껍데기를 벗긴다. 벗긴 뒤가 너무 짧으면 원제목을 살린다. */
function cleanTitle(raw) {
  let t = raw
    .replace(/^[{[(][^}\])]*[}\])]\s*/, '')
    .replace(/[:：]?\s*(by\s*)?어셔린메이킹\s*/gi, ' ')
    .replace(/\s*_\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,:：—-]+|[\s,:：—-]+$/g, '')
    .trim();
  // 남은 것이 여전히 키워드 나열이면(쉼표 2개 이상) 가장 뒤 조각을 제목으로 삼는다.
  if ((t.match(/,/g) || []).length >= 2) {
    const tail = t.split(/[,:：]/).map((x) => x.trim()).filter(Boolean).pop();
    if (tail && tail.length >= 6) t = tail;
  }
  return t.length >= 4 ? t : raw.trim();
}

/** 블로그 분류 + 본문 키워드로 사이트 카테고리(5종)를 정한다. */
function categoryOf(naverCategory, text) {
  if (naverCategory === '웨딩룩') return 'dress';
  if (/태교|만삭|돌기념|돌촬영|칠순|환갑|백일|200일|두돌|기념일/.test(text)) return 'anniversary';
  if (/드레스|의상/.test(text)) return 'dress';
  if (/스튜디오|실내/.test(text)) return 'studio';
  if (/준비물|팁|가이드|알아두면|주의/.test(text)) return 'tips';
  return 'location';
}

const PLAN_BY_CATEGORY = {
  studio: 'studio-01',
  location: 'location-basic',
  dress: 'location-basic',
  tips: 'location-basic',
  anniversary: 'location-basic',
};

/** URL 로 쓸 수 있는 안정된 slug. 원문 글번호를 붙여 충돌과 재실행을 모두 막는다. */
const slugOf = (category, date, logNo) => `${category}-${date.slice(0, 7)}-${String(logNo).slice(-6)}`;

/**
 * 본문을 만든다. **원문 문단은 손대지 않고 출처 한 줄만 뒤에 더한다.**
 *
 * 앞에 요약 한 줄을 자동으로 붙이려다 드라이런에서 잡았다 — 거제(한국) 촬영 글에
 * "오키나와에서 진행한"이 붙었다. 장소·촬영 종류를 코드가 단정하면 없는 사실을 만든다.
 * 원문 첫 문단이 대개 그 역할을 하므로, 요약 문장은 사람이 넣을 때까지 비워 둔다.
 */
function buildBody(paras, meta) {
  const source = `> 이 글은 작가가 네이버 블로그에 남긴 촬영 기록(${meta.date})을 옮겨 정리한 것입니다. 원문: ${meta.link}`;
  return [...paras, source].join('\n\n');
}

const KIND_BY_CATEGORY = {
  studio: '스튜디오 촬영',
  location: '로케이션 촬영',
  dress: '드레스 촬영',
  tips: '촬영 준비',
  anniversary: '기념일 촬영',
};

/* ---------------------------------------------------------------- 실행 */

const main = async () => {
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!DRY && !isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다 (.env.local 확인).');

  // 분류표
  const catText = await get(`https://m.blog.naver.com/rego/CategoryList.naver?blogId=${BLOG_ID}`, `https://m.blog.naver.com/${BLOG_ID}`);
  const cats = new Map(
    JSON.parse(catText.slice(catText.indexOf('{'))).result.mylogCategoryList.map((c) => [String(c.categoryNo), c.categoryName]),
  );

  // 목록 — 최신 쪽부터 훑어 후보가 채워지면 멈춘다(전량 조회는 불필요).
  const first = await listPage(1);
  const pages = Math.ceil(Number(first.totalCount) / 30);
  const rows = [...first.postList];
  for (let n = 2; n <= Math.min(pages, 6) && rows.length < 180; n++) {
    rows.push(...(await listPage(n)).postList);
    await new Promise((r) => setTimeout(r, 300));
  }

  const isoDate = (s) => {
    const m = decodeURIComponent(String(s)).match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
    return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : null;
  };

  const candidates = rows
    .map((p) => ({
      logNo: String(p.logNo),
      titleRaw: decodeURIComponent(String(p.title)).replace(/\+/g, ' '),
      naverCategory: cats.get(String(p.categoryNo)) ?? '',
      date: isoDate(p.addDate),
    }))
    .filter((r) => r.date && r.date >= '2016-01-01' && ['스냅', '웨딩룩'].includes(r.naverCategory));

  console.log(`후보 ${candidates.length}건 (2016년 이후 · 스냅/웨딩룩) → 상위에서 ${LIMIT}건 선별\n`);

  const picked = [];
  for (const c of candidates) {
    if (picked.length >= LIMIT) break;
    let post;
    try {
      post = await fetchPost(c.logNo);
    } catch (e) {
      console.log(`  건너뜀 ${c.logNo} — ${e.message}`);
      continue;
    }
    await new Promise((r) => setTimeout(r, 350));

    const paras = post.paras.slice(1); // 첫 문단은 제목 반복
    const chars = paras.join('').length;
    // ⑤ 얇은 글 제외 — SEO 판단 근거 문서의 기준 그대로
    const text = `${c.titleRaw} ${paras.join(' ')}`;
    // 이 사이트는 오키나와·미야코지마 촬영을 다룬다. 그 밖의 지역(예: 거제) 글이 섞이면
    // 사이트 문맥과 어긋나므로 후보에서 뺀다 — 드라이런에서 실제로 한 건 걸렸다.
    // 단순 언급 유무로는 부족했다 — 거제 촬영 공지가 "오키나와로 복귀합니다" 한 줄 때문에
    // 통과해 실제로 취입됐다(오키나와 3회 vs 거제 13회). 다른 지역명이 더 자주 나오면 뺀다.
    const okinawaHits = (text.match(/오키나와|미야코지마|okinawa/gi) || []).length;
    const elsewhereHits = (text.match(/거제|제주|여수|부산|통영|강릉|발리|괌|사이판/g) || []).length;
    if (okinawaHits === 0 || elsewhereHits >= okinawaHits) {
      console.log(`  제외 ${c.date} (오키나와 ${okinawaHits}회 vs 타지역 ${elsewhereHits}회) ${c.titleRaw.slice(0, 26)}`);
      continue;
    }
    if (chars < 400 || post.images.length < 3) {
      console.log(`  제외 ${c.date} (본문 ${chars}자 · 이미지 ${post.images.length}장) ${c.titleRaw.slice(0, 30)}`);
      continue;
    }
    const category = categoryOf(c.naverCategory, text);
    picked.push({ ...c, paras, images: post.images, chars, category });
    console.log(`  선택 ${c.date} · ${category} · ${chars}자 · 이미지 ${post.images.length}장`);
  }

  console.log(`\n선별 ${picked.length}건\n`);

  const { uploadMedia } = DRY ? { uploadMedia: null } : await import('@/server/media');

  for (const p of picked) {
    const title = cleanTitle(p.titleRaw);
    const slug = slugOf(p.category, p.date, p.logNo);
    const link = `https://blog.naver.com/${BLOG_ID}/${p.logNo}`;
    const body = buildBody(p.paras, {
      date: p.date,
      dateLabel: `${p.date.slice(0, 4)}년 ${Number(p.date.slice(5, 7))}월`,
      kind: KIND_BY_CATEGORY[p.category],
      link,
    });

    if (DRY) {
      console.log(`[dry] ${slug}\n      제목: ${title}\n      표지: ${p.images[0].slice(0, 70)}…\n      본문 ${body.length}자`);
      continue;
    }

    // ④ 표지 이미지를 자사 스토리지로 옮긴다. 네이버 직링크는 규칙 위반이고 언제든 끊긴다.
    const res = await fetch(p.images[0], { headers: { 'User-Agent': UA, Referer: link } });
    if (!res.ok) {
      console.log(`  이미지 실패 ${slug} — HTTP ${res.status}, 건너뜀`);
      continue;
    }
    const bytes = await res.arrayBuffer();
    const up = await uploadMedia({
      bytes,
      filename: `naver-${p.logNo}.jpg`,
      mimeType: res.headers.get('content-type')?.split(';')[0] || 'image/jpeg',
      uploadedBy: 'naver-journal-import',
      source: 'manual',
    });

    await prisma.journalPost.upsert({
      where: { slug_locale: { slug, locale: 'ko' } },
      update: { title, body, cover: up.asset.url, category: p.category, source: 'naver-blog', isSample: false },
      create: {
        slug,
        locale: 'ko',
        category: p.category,
        title,
        body,
        cover: up.asset.url,
        planCode: PLAN_BY_CATEGORY[p.category],
        source: 'naver-blog',
        isSample: false,
        publishedAt: new Date(`${p.date}T09:00:00+09:00`),
      },
    });
    console.log(`  넣음 ${slug} — ${title.slice(0, 40)}`);
  }

  if (!DRY) {
    const n = await prisma.journalPost.count();
    console.log(`\nDB JournalPost 총 ${n}건`);
    await prisma.$disconnect();
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
