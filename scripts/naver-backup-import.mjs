/**
 * 브라우저 저장본 → 저널 DB 취입 (한국어).
 *
 * **네이버에 접속하지 않는다.** 사람이 저장한 파일만 읽는다 — 약관이 금지하는 자동 수집을 피한다.
 *
 * SEO 판단(.moai/handoff/DECISION-BLOG-IMPORT-SEO.md)에 따라 원문 복사가 아니라 정리본으로 넣는다:
 *   ① 제목의 검색 키워드 껍데기 제거        ② 첫 줄·본문 끝에 출처 명시
 *   ③ 이미지는 자사 스토리지 재호스팅        ④ 사진마다 alt (접근성 + AEO)
 *
 * 사실은 손대지 않는다. 문단 순서와 내용은 원문 그대로 옮기고 위 네 가지만 더한다.
 *
 * **날짜와 공개 여부는 한 칸을 공유한다**(publishedAt). 원본 날짜는 월별 아카이브와
 * JSON-LD datePublished 가 쓰는 값이라 반드시 살려야 하므로, 취입 = 공개가 된다.
 * 대량 발행 신호를 피하는 방법은 "한 번에 다 넣지 않는 것"이다 — 그래서 --limit 이 있다.
 *
 * 실행:
 *   node scripts/naver-backup-import.mjs --dry              무엇이 들어갈지만 출력
 *   node scripts/naver-backup-import.mjs --limit 10         10건만 실제 취입
 *   node scripts/naver-backup-import.mjs --only 224359035554
 */

import path from 'node:path';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';
import { parseBackupDir } from './naver-backup-parse.mjs';

config({ path: '.env.local' });
config();

const ROOT = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return {
        url: pathToFileURL(path.join(ROOT, 'src', `${specifier.slice(2)}.ts`)).href,
        shortCircuit: true,
      };
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
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const BACKUP_DIR = args[args.indexOf('--dir') + 1]?.startsWith('/')
  ? args[args.indexOf('--dir') + 1]
  : `${process.env.HOME}/Downloads/naver_blog`;
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const ONLY = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;

/* ------------------------------------------------------------ 카테고리 */

/**
 * 사이트 5개 카테고리. `naver-backup-candidates.mjs` 와 같은 규칙을 쓴다 —
 * 사용자가 목록에서 본 분류와 실제 취입 분류가 어긋나면 안 된다.
 */
function siteCategory(title) {
  const t = title;
  if (/스튜디오|실내촬영|하우스/.test(t)) return 'studio';
  if (/태교|만삭|돌촬영|돌기념|돌스냅|백일|200일|두돌|칠순|환갑|기념여행|기념일|가족스냅|대가족|가족촬영|아기|베이비|여행기록/.test(t))
    return 'anniversary';
  if (/드레스|웨딩룩|의상|소품|부케|한복/.test(t)) return 'dress';
  if (/팁|준비물|가이드|추천|노하우|알아두면|주의|예약|일정|모집|날씨|시간대|비용|가격|문의|이유|필수|방법|체크|정보|계절|시즌/.test(t))
    return 'tips';
  return 'location';
}

const PLAN_BY_CATEGORY = {
  studio: 'studio-01',
  location: 'location-basic',
  dress: 'location-basic',
  tips: 'location-basic',
  anniversary: 'location-basic',
};

/** URL 로 쓸 안정된 slug. 글번호 뒷자리를 붙여 충돌과 재실행을 모두 막는다. */
const slugOf = (category, date, logNo) =>
  `${category}-${date.slice(0, 7)}-${String(logNo).slice(-6)}`;

/* ------------------------------------------------------------ alt 생성 */

const KIND_BY_CATEGORY = {
  studio: '스튜디오 촬영',
  location: '로케이션 촬영',
  dress: '드레스 촬영',
  tips: '촬영 기록',
  anniversary: '기념일 촬영',
};

/**
 * 사진 alt. **사진을 보지 않고 쓰므로, 아는 것만 쓴다.**
 *
 * 처음에는 본문에서 장소 낱말을 찾아 "세소코에서 진행한"처럼 붙이려 했다가 드라이런에서 걸렀다 —
 * 스튜디오 글에 "바다에서 진행한 스튜디오 촬영"이 붙었고, 예약 공지 글에 "채플에서"가 붙었다.
 * 본문 어딘가에 나온 낱말이 그 사진의 촬영지라는 보장이 없다. 코드가 장소를 단정하면 없는 사실이 된다.
 *
 * 그래서 확실한 것만 조합한다:
 *   글 제목(작가 본인이 쓴 그 촬영의 설명) + 지역(취입 필터가 보장) + 촬영 종류(제목에서 분류) + 시기.
 * 사진별 개별 묘사는 사람이 관리자 화면에서 채우는 편이 정확하다.
 */
function buildAlt(post, category, index, total) {
  const text = `${post.titleRaw} ${post.paragraphs.join(' ')}`;
  const region = /미야코지마/.test(text) ? '미야코지마' : '오키나와';
  const [y, m] = post.date.split('-');
  const nth = total > 1 ? ` ${index + 1}/${total}` : '';
  // 제목이 길면 잘라 쓴다 — alt 는 스크린리더가 한 번에 읽는 단위라 짧을수록 좋다.
  const head = post.title.length > 40 ? `${post.title.slice(0, 40)}…` : post.title;
  return `${head} — ${region} ${KIND_BY_CATEGORY[category]}, ${y}년 ${Number(m)}월${nth}`;
}

/* ------------------------------------------------------------ 꼬리말 정리 */

/**
 * 네이버 블로그용 서명·연락처·홍보 꼬리말을 걷어낸다.
 *
 * 왜 필요한가: 자기 홈페이지 안에서 "홈피로 오세요 www.usherinmaking.com"은 말이 되지 않고,
 * 카톡 아이디·예약 시간 같은 정보는 사이트의 문의 페이지가 이미 정본으로 들고 있다.
 * 두 곳에 다른 값이 적히면 어느 쪽이 맞는지 알 수 없게 된다.
 *
 * **본문을 지우지 않도록 두 겹으로 막는다:**
 *   ① 문단 통째 삭제는 뒤쪽 8문단 안에서만 한다 — 글 중간의 진짜 내용은 건드릴 수 없다.
 *   ② 어디서든 지우는 것은 저작권 표시와 자사 URL 뿐 — 오해의 여지가 없는 것만.
 */

/** 어디에 있든 걷어내는 조각. 이것만은 본문일 수 없다. */
const INLINE_NOISE = [
  /\(C\)\s*\d{4}\.?\s*usherinmaking\.?\s*All\s*Rights\s*Reserved\.?/gi,
  /https?:\/\/(?:www\.)?usherinmaking\.com\S*/gi,
  /(?<![\w.])www\.usherinmaking\.com\S*/gi,
];

/** 뒤쪽에서만 문단째 버리는 신호. 짧고, 아래 중 하나에 해당하면 홍보·연락처 블록으로 본다. */
const TAIL_SIGNALS = [
  /카톡\s*아이디/, /카카오톡\s*아이디/, /예약\s*문의/, /상담\s*주세요/, /문의\s*주세요/,
  /홈피/, /홈페이지\s*Q&A/, /Q&A\s*게시판/, /예약\s*가능\s*시간/, /견적\s*확인/,
  /상품\s*구성\s*견적/, /전문\s*여성\s*일인\s*작가/, /여성일인작가/, /일인\s*여성\s*작가/,
];

/** 문단이 해시태그 나열뿐인가 — 네이버 검색용 꼬리표라 홈페이지에서는 의미가 없다. */
function isHashtagOnly(t) {
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  return words.filter((w) => w.startsWith('#')).length / words.length >= 0.7;
}

function stripBoilerplate(paragraphs) {
  // ① 어디서든: 저작권 표시와 자사 URL 제거
  let out = paragraphs.map((t) => {
    let s = t;
    for (const re of INLINE_NOISE) s = s.replace(re, ' ');
    return s.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  });

  // ② 뒤쪽 8문단 안에서만: 홍보·연락처·해시태그 문단을 버린다
  const guard = Math.max(0, out.length - 8);
  for (let i = out.length - 1; i >= guard; i--) {
    const t = out[i];
    if (!t) {
      out.splice(i, 1);
      continue;
    }
    const promo = TAIL_SIGNALS.some((re) => re.test(t));
    // 길면 진짜 내용에 연락처가 섞인 것이다 — 통째로 버리지 않고 남긴다.
    if ((promo && t.length <= 140) || isHashtagOnly(t)) out.splice(i, 1);
  }

  return out.filter(Boolean);
}

/* ------------------------------------------------------------ 본문 조립 */

/**
 * 본문을 만든다. **원문 문단은 손대지 않고** 출처 두 줄과 사진만 더한다.
 *
 * 앞에 요약 한 줄을 코드가 지어내려던 이전 시도는 드라이런에서 잡혔다 — 거제 촬영 글에
 * "오키나와에서 진행한"이 붙었다. 장소·촬영 종류를 코드가 단정하면 없는 사실을 만든다.
 * 그래서 출처 표시만 넣고, 요약 문장은 사람이 다듬을 때까지 비워 둔다.
 *
 * 사진은 문단 사이에 고르게 끼운다. 원문의 정확한 위치는 저장본에서 복원할 수 없지만,
 * 문단 끝에 몰아넣는 것보다 읽는 흐름에 가깝다.
 */
function buildBody(post, category, imageUrls) {
  const [y, m] = post.date.split('-');
  const head = `*네이버 블로그에 남긴 ${y}년 ${Number(m)}월 촬영 기록입니다.*`;
  const foot =
    `> 이 글은 어셔린메이킹이 네이버 블로그에 기록한 촬영 후기(${post.date})를 ` +
    `홈페이지 형식에 맞게 정리한 것입니다. 사진과 내용은 어셔린메이킹의 저작물입니다. ` +
    `원문 보기: https://blog.naver.com/${BLOG_ID}/${post.logNo}`;

  const figures = imageUrls.map(
    ({ url, alt }) => `![${alt}](${url})`,
  );

  // 표지로 쓴 첫 장은 본문에서 뺀다 — 같은 사진이 상단과 본문에 두 번 나오면 어색하다.
  const inBody = figures.slice(1);
  const paras = stripBoilerplate(post.paragraphs);
  const out = [head];

  if (inBody.length === 0) {
    out.push(...paras);
  } else {
    // 문단을 이미지 수 + 1 덩이로 나눠 사이사이에 사진을 넣는다.
    const chunk = Math.max(1, Math.ceil(paras.length / (inBody.length + 1)));
    let fi = 0;
    for (let i = 0; i < paras.length; i += chunk) {
      out.push(...paras.slice(i, i + chunk));
      if (fi < inBody.length) out.push(inBody[fi++]);
    }
    while (fi < inBody.length) out.push(inBody[fi++]); // 남은 사진은 뒤에 붙인다
  }

  out.push(foot);
  return out.join('\n\n');
}

/* ------------------------------------------------------------ 실행 */

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };

const main = async () => {
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!DRY && !isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다 (.env.local 확인).');

  const all = parseBackupDir(BACKUP_DIR);

  const picked = all
    .filter((p) => p.logNo && p.date && p.title)
    .filter((p) => (ONLY ? ONLY.has(p.logNo) : true))
    // 본문이 아예 없는 글(인스타 임베드만 있는 글)은 저널이 될 수 없다.
    .filter((p) => p.paragraphs.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date)) // 오래된 것부터 — 취입 순서를 예측 가능하게
    .slice(0, LIMIT);

  const skipped = all.length - picked.length;
  console.log(
    `저장본 ${all.length}건 → 취입 대상 ${picked.length}건` +
      (skipped ? ` (제외 ${skipped}건: 본문 없음/식별 실패)` : ''),
  );
  console.log(DRY ? '드라이런 — DB·스토리지에 쓰지 않습니다\n' : '');

  const { uploadMedia } = DRY ? { uploadMedia: null } : await import('@/server/media');

  let ok = 0;
  let uploaded = 0;
  for (const p of picked) {
    const category = siteCategory(p.titleRaw);
    const slug = slugOf(category, p.date, p.logNo);

    // 이미지 먼저 — 표지가 없으면 글을 만들지 않는다(빈 표지 카드가 목록에 남는다).
    const urls = [];
    for (const [i, img] of p.images.entries()) {
      const alt = buildAlt(p, category, i, p.images.length);
      if (DRY) {
        urls.push({ url: `(dry)/${img.name}`, alt });
        continue;
      }
      const bytes = fs.readFileSync(img.file);
      const up = await uploadMedia({
        bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        filename: `naver-${p.logNo}-${i + 1}${path.extname(img.name).toLowerCase()}`,
        mimeType: MIME[path.extname(img.name).toLowerCase()] ?? 'image/jpeg',
        uploadedBy: 'naver-backup-import',
        source: 'manual',
      });
      urls.push({ url: up.asset.url, alt });
      uploaded++;
    }

    if (urls.length === 0) {
      console.log(`  건너뜀 ${slug} — 사진이 없습니다`);
      continue;
    }

    const body = buildBody(p, category, urls);

    if (DRY) {
      console.log(
        `[dry] ${slug}\n      제목: ${p.title}\n      ${category} · 본문 ${body.length}자 · 사진 ${urls.length}장\n` +
          `      alt: ${urls[0].alt}`,
      );
      ok++;
      continue;
    }

    await prisma.journalPost.upsert({
      where: { slug_locale: { slug, locale: 'ko' } },
      update: { title: p.title, body, cover: urls[0].url, category, source: 'naver-blog', isSample: false },
      create: {
        slug,
        locale: 'ko',
        category,
        title: p.title,
        body,
        cover: urls[0].url,
        planCode: PLAN_BY_CATEGORY[category],
        source: 'naver-blog',
        isSample: false,
        // 원본 날짜를 살린다 — 월별 아카이브와 JSON-LD datePublished 가 이 값을 쓴다.
        publishedAt: new Date(`${p.date}T09:00:00+09:00`),
      },
    });
    console.log(`  넣음 ${slug} — 사진 ${urls.length}장 — ${p.title.slice(0, 36)}`);
    ok++;
  }

  console.log(`\n취입 ${ok}건 · 업로드 ${uploaded}장`);
  if (!DRY) {
    const n = await prisma.journalPost.count({ where: { locale: 'ko' } });
    console.log(`DB JournalPost(ko) 총 ${n}건`);
    await prisma.$disconnect();
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
