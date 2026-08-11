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
/** 목록을 전량 훑는다. 옛 글까지 가져올 때 필요하다(기본은 최신 6쪽). */
const ALL = args.includes('--all');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 10;
// 기본은 최근 1년. 오래된 글일수록 사진 해상도와 문체가 지금 사이트와 어긋난다.
const SINCE =
  args[args.indexOf('--since') + 1]?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ??
  new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
// 얇은 글 기준. 기본값(400자·3장)은 SEO 판단 문서에서 온 값이라 함부로 낮추지 않는다 —
// 낮출 때는 무엇을 얻고 무엇을 잃는지 세어 보고 정한다.
const MIN_CHARS = Number(args[args.indexOf('--min-chars') + 1]) || 400;
const MIN_IMAGES = Number(args[args.indexOf('--min-images') + 1]) || 3;

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

/**
 * 일시적 네트워크 실패(ETIMEDOUT 등)에 짧게 물러났다 다시 건다.
 * 276건짜리 실행이 140건째의 타임아웃 한 번으로 통째로 죽었다 — 재시도 없이는
 * 긴 실행이 가장 약한 요청 하나에 볼모로 잡힌다. 4xx/5xx 는 재시도 대상이 아니다.
 */
async function fetchRetry(url, init, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e;
      if (i < attempts) await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
  throw last;
}

async function get(url, referer) {
  const res = await fetchRetry(url, { headers: { 'User-Agent': UA, ...(referer && { Referer: referer }) } });
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

/**
 * 원문을 문단·사진이 **섞인 순서 그대로** 읽는다.
 *
 * 문단과 사진을 각각 훑으면 배열 두 개가 나오고 그 사이 순서를 잃는다 — 사진이 어느 문단
 * 뒤에 있었는지가 사라진다. 정규식 하나로 한 번만 훑으면 matchAll 이 문서 순서대로 주므로
 * 흐름이 보존된다. paras · images 는 기존 호출부를 위해 그 결과에서 뽑아 둔다.
 */
async function fetchPost(logNo) {
  const html = await get(`https://blog.naver.com/PostView.naver?blogId=${BLOG_ID}&logNo=${logNo}`);
  const BLOCK = /<p class="se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>|data-lazy-src="([^"]+)"/g;
  const nodes = [];
  const seen = new Set();
  for (const m of html.matchAll(BLOCK)) {
    if (m[1] !== undefined) {
      const text = stripTags(m[1]);
      if (text) nodes.push({ kind: 'p', text });
    } else if (m[2] && /postfiles|blogfiles/.test(m[2]) && !seen.has(m[2])) {
      seen.add(m[2]); // 같은 사진이 썸네일·본문으로 두 번 실린다
      nodes.push({ kind: 'img', url: m[2] });
    }
  }
  return {
    nodes,
    paras: nodes.filter((n) => n.kind === 'p').map((n) => n.text),
    images: nodes.filter((n) => n.kind === 'img').map((n) => n.url),
  };
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
function buildBody(nodes, meta, blobUrlOf) {
  const out = [];
  let n = 0;
  for (const node of nodes) {
    if (node.kind === 'p') {
      out.push(node.text);
      continue;
    }
    // 표지로 이미 쓴 사진과 내려받기에 실패한 사진은 null 로 돌아온다.
    const url = blobUrlOf(node.url);
    if (!url) continue;
    n += 1;
    // alt 는 제목 + 순번까지만 쓴다. 사진을 보지 않고 장면을 지어내면 없는 사실이 된다 —
    // 본문 문단을 alt 로 돌려쓰는 것도 같은 이유로 하지 않는다(그 문단은 사진 설명이 아니다).
    out.push(`![${meta.title} 사진 ${n}](${url})`);
  }
  const source = `> 이 글은 작가가 네이버 블로그에 남긴 촬영 기록(${meta.date})을 옮겨 정리한 것입니다. 원문: ${meta.link}`;
  return [...out, source].join('\n\n');
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

  /*
   * 목록 — 기본은 최신 6쪽(180건)까지만 본다.
   *
   * 그 상한이 "최근 1년"이라는 기본 하한과 짝이라 평소에는 맞는다. 그런데 옛 글까지
   * 가져오려고 --since 를 내리면 이 상한에 먼저 걸려 2022년 아래로는 닿지 못한다
   * (전체 716건 = 24쪽). --all 을 주면 전량을 훑는다. 쪽마다 300ms 를 쉬는 것은 그대로다.
   */
  const first = await listPage(1);
  const pages = Math.ceil(Number(first.totalCount) / 30);
  const maxPages = ALL ? pages : Math.min(pages, 6);
  const maxRows = ALL ? Number(first.totalCount) : 180;
  const rows = [...first.postList];
  for (let n = 2; n <= maxPages && rows.length < maxRows; n++) {
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
    .filter((r) => r.date && r.date >= SINCE && ['스냅', '웨딩룩'].includes(r.naverCategory));

  console.log(`후보 ${candidates.length}건 (${SINCE} 이후 · 스냅/웨딩룩) → 상위에서 ${LIMIT}건 선별\n`);

  const picked = [];
  /*
   * 이미 취입된 글은 원문 조회 전에 건너뛴다.
   *
   * upsert 라 다시 넣어도 데이터는 안전하지만, 그 "다시"가 글마다 원문 fetch + 사진 전부
   * 재다운로드·재업로드다. 276건 재실행에서 글당 수 분까지 늘어졌다(반복 전량 조회에
   * 네이버가 응답을 늦추는 것으로 보인다). 본문 끝의 원문 링크에 logNo 가 남으므로
   * 그것으로 보유 여부를 판정한다 — 신규 글만 네트워크를 탄다.
   */
  const doneLogNos = new Set(
    (
      await prisma.journalPost.findMany({
        where: { locale: 'ko', source: 'naver-blog' },
        select: { body: true },
      })
    )
      .map((r) => r.body.match(/blog\.naver\.com\/[A-Za-z0-9_-]+\/(\d+)/)?.[1])
      .filter(Boolean),
  );

  for (const c of candidates) {
    if (picked.length >= LIMIT) break;
    if (doneLogNos.has(c.logNo)) continue;
    let post;
    try {
      post = await fetchPost(c.logNo);
    } catch (e) {
      console.log(`  건너뜀 ${c.logNo} — ${e.message}`);
      continue;
    }
    await new Promise((r) => setTimeout(r, 350));

    const paras = post.paras.slice(1); // 첫 문단은 제목 반복
    // 흐름 배열에서도 그 문단 하나를 뺀다. paras 와 어긋나면 글자수 판정과 본문이 달라진다.
    const firstP = post.nodes.findIndex((nd) => nd.kind === 'p');
    const nodes = post.nodes.filter((_, i) => i !== firstP);
    const chars = paras.join('').length;
    // ⑤ 얇은 글 제외 — SEO 판단 근거 문서의 기준 그대로
    const text = `${c.titleRaw} ${paras.join(' ')}`;
    // 이 사이트는 오키나와·미야코지마 촬영을 다룬다. 그 밖의 지역(예: 거제) 글이 섞이면
    // 사이트 문맥과 어긋나므로 후보에서 뺀다 — 드라이런에서 실제로 한 건 걸렸다.
    // 단순 언급 유무로는 부족했다 — 거제 촬영 공지가 "오키나와로 복귀합니다" 한 줄 때문에
    // 통과해 실제로 취입됐다(오키나와 3회 vs 거제 13회). 다른 지역명이 더 자주 나오면 뺀다.
    const okinawaHits = (text.match(/오키나와|미야코지마|okinawa/gi) || []).length;
    const elsewhereHits = (text.match(/거제|제주|여수|부산|통영|강릉|발리|괌|사이판/g) || []).length;
    /*
     * 타지역 글 제외.
     *
     * 원래 조건은 `okinawaHits === 0 || elsewhereHits >= okinawaHits` 였는데, 앞쪽이
     * **"아무 지역도 언급하지 않은 글"까지 타지역으로 몰아냈다** — 드레스 소개처럼 사진 위주라
     * 지명이 안 나오는 글이 여기 걸렸다(전량 조사에서 51건 중 대부분). 지역을 안 적은 것과
     * 다른 지역에서 찍은 것은 다르다. 그래서 **다른 지역이 실제로 더 자주 나올 때만** 뺀다.
     */
    if (elsewhereHits > 0 && elsewhereHits >= okinawaHits) {
      console.log(`  제외 ${c.date} (오키나와 ${okinawaHits}회 vs 타지역 ${elsewhereHits}회) ${c.titleRaw.slice(0, 26)}`);
      continue;
    }
    // 남의 글을 퍼온 스크랩([공유] 접두)은 우리 콘텐츠가 아니다 — 저작권·문맥 둘 다 어긋난다.
    if (/^\s*\[공유\]/.test(c.titleRaw)) {
      console.log(`  제외 ${c.date} (다른 블로그 스크랩) ${c.titleRaw.slice(0, 30)}`);
      continue;
    }
    if (chars < MIN_CHARS || post.images.length < MIN_IMAGES) {
      console.log(`  제외 ${c.date} (본문 ${chars}자 · 이미지 ${post.images.length}장) ${c.titleRaw.slice(0, 30)}`);
      continue;
    }
    const category = categoryOf(c.naverCategory, text);
    picked.push({ ...c, paras, nodes, images: post.images, chars, category });
    console.log(`  선택 ${c.date} · ${category} · ${chars}자 · 이미지 ${post.images.length}장`);
  }

  console.log(`\n선별 ${picked.length}건\n`);

  const { uploadMedia } = DRY ? { uploadMedia: null } : await import('@/server/media');

  for (const p of picked) {
    // 한 글의 실패(이미지 업로드 오류 등)가 나머지 백여 건을 죽이지 않는다.
    // 실패한 글은 다음 실행이 스킵 목록에 없으니 자연히 다시 시도된다.
    try {
    const title = cleanTitle(p.titleRaw);
    const slug = slugOf(p.category, p.date, p.logNo);
    const link = `https://blog.naver.com/${BLOG_ID}/${p.logNo}`;
    const meta = {
      title,
      date: p.date,
      dateLabel: `${p.date.slice(0, 4)}년 ${Number(p.date.slice(5, 7))}월`,
      kind: KIND_BY_CATEGORY[p.category],
      link,
    };
    const coverSrc = p.images[0];

    if (DRY) {
      // 실제로 올리지 않으므로 표지 외 사진은 전부 들어간다고 보고 자릿수만 센다.
      const body = buildBody(p.nodes, meta, (src) => (src === coverSrc ? null : 'blob://dry'));
      const inBody = p.images.length - 1;
      console.log(
        `[dry] ${slug}\n      제목: ${title}\n      표지: ${coverSrc.slice(0, 70)}…\n      본문 ${body.length}자 · 본문 사진 ${inBody}장`,
      );
      continue;
    }

    // ④ 사진을 **전부** 자사 스토리지로 옮긴다. 네이버 직링크는 규칙 위반이고 언제든 끊긴다.
    //    표지 한 장만 옮기던 때에는 본문이 글자만 남아 원문의 흐름이 사라졌다.
    const uploaded = new Map();
    for (const [i, src] of p.images.entries()) {
      const r = await fetchRetry(src, { headers: { 'User-Agent': UA, Referer: link } });
      if (!r.ok) {
        console.log(`  사진 실패 ${slug} #${i + 1} — HTTP ${r.status}, 이 장만 건너뜀`);
        continue;
      }
      const upOne = await uploadMedia({
        bytes: await r.arrayBuffer(),
        filename: `naver-${p.logNo}-${i + 1}.jpg`,
        mimeType: r.headers.get('content-type')?.split(';')[0] || 'image/jpeg',
        uploadedBy: 'naver-journal-import',
        source: 'manual',
      });
      uploaded.set(src, upOne.asset.url);
      await new Promise((rs) => setTimeout(rs, 200)); // 원문 서버에 몰아치지 않는다
    }
    if (!uploaded.has(coverSrc)) {
      console.log(`  표지 실패 ${slug} — 건너뜀`);
      continue;
    }
    const up = { asset: { url: uploaded.get(coverSrc) } };
    // 표지는 본문 위에 따로 크게 걸리므로 본문에서는 뺀다 — 같은 사진이 연달아 두 번 나온다.
    const body = buildBody(p.nodes, meta, (src) => (src === coverSrc ? null : (uploaded.get(src) ?? null)));

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
    } catch (e) {
      console.log(`  실패 ${p.logNo} — ${(e?.message ?? String(e)).slice(0, 80)}`);
    }
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
