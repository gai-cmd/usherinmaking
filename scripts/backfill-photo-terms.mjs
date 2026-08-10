// 수집 사진에 분류(term)를 붙인다 — 갤러리 필터가 실제로 동작하게 만드는 일회성 도구.
//
// 왜 필요한가: 인스타 수집분은 term 이 하나도 붙지 않은 채 쌓였다(AI 분류가 401 로 실패).
// 그래서 장소·촬영종류·계절 필터가 화면에는 있는데 어느 사진도 걸러내지 못했다.
//
// 무엇을 근거로 붙이나 — 두 가지뿐이고, 둘 다 지어내지 않는다:
//   ① 월(month-01..12)  : takenAt 을 JST 기준으로 잘라 쓴다. 게시일이므로 100% 확실하다.
//   ② 캡션 키워드        : 원문 캡션에 그 단어가 실제로 있을 때만 붙인다.
//
// EXIF 는 쓸 수 없다 — 네이버·인스타 둘 다 업로드할 때 지운다(실측 확인). 촬영일시도 GPS 도 없다.
// 사진을 봐야 아는 것(맑음/흐림 같은 날씨)은 여기서 다루지 않는다. 캡션이 명시한 것만 붙인다.
//
// 실행:
//   node scripts/backfill-photo-terms.mjs           → dry-run
//   node scripts/backfill-photo-terms.mjs --apply   → 실제 반영
//
// 이미 붙어 있는 term 은 건드리지 않는다(사람이 고친 분류를 덮지 않기 위해서다).

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

config({ path: '.env.local' });
config();

const apply = process.argv.includes('--apply');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL 이 없습니다.');
  process.exit(1);
}

/**
 * 캡션 키워드 규칙 — **캡션이 명시한 사실**만 남긴다.
 *
 * 장소(place)·촬영종류(session의 대부분)는 여기서 다루지 않는다. dry-run 실측으로 확인한
 * 함정: 캡션은 사진 설명이 아니라 홍보문이라 "フォトスタジオ" "前撮り、ファミリーフォト、
 * マタニティ…" 같은 서비스 나열이 거의 모든 게시물에 반복된다(289장 중 wedding 245·studio 141
 * 히트). 그대로 붙이면 로케이션 사진에 스튜디오가 붙는다. 그 축들은 사진을 실제로 보는
 * 시각 분석(vision-terms.mjs 경로)이 맡는다.
 *
 * 남긴 것은 홍보문에 나올 이유가 없는 그날의 사실뿐이다: 비 온 날, 노을, 벚꽃, 흑백 세트,
 * 그리고 칠순·환갑·백일처럼 행사를 특정한 말. "記念写真" 같은 일반 권유는 근거가 못 된다.
 */
const RULES = {
  session: {
    anniversary: /記念日|七五三|還暦|古希|お宮参り|百日|칠순|환갑|백일|돌기념|돌촬영/i,
  },
  mood: {
    rain: /雨の日|雨だから|비온날|비오는날|rainy/i,
    sunset: /夕日|サンセット|夕焼け|노을|sunset/i,
    'cherry-blossom': /桜|벚꽃|cherry blossom/i,
    'monotone-corner': /白黒写真|モノトーン|모노톤|monochrome/i,
  },
};

/** 게시일의 월. 사이트 기준(JST)으로 자른다 — 화면의 다른 날짜 표기와 같은 기준이어야 한다. */
function monthSlugOf(date) {
  const mm = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', month: '2-digit' }).format(date);
  return `month-${mm}`;
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  // term 은 축(taxonomy)마다 slug 가 유일하다. slug → id 로 한 번만 읽어 둔다.
  const terms = await prisma.term.findMany({ select: { id: true, slug: true, taxonomy: { select: { key: true } } } });
  const idOf = new Map(terms.map((t) => [`${t.taxonomy.key}:${t.slug}`, t.id]));

  const photos = await prisma.photo.findMany({
    where: { igMediaId: { not: null } },
    select: {
      id: true,
      takenAt: true,
      alt: true,
      story: true,
      terms: { select: { termId: true } },
    },
  });

  console.log(`대상 사진 ${photos.length}건 (인스타 수집분)\n`);

  const plan = [];
  const hit = new Map(); // 통계용 — 어떤 term 이 몇 장에 붙는지
  let noCaption = 0;

  for (const p of photos) {
    const already = new Set(p.terms.map((t) => t.termId));
    const wanted = new Set();

    if (p.takenAt) {
      const id = idOf.get(`mood:${monthSlugOf(p.takenAt)}`);
      if (id) wanted.add(id);
    }

    // 캡션은 story 가 전문, alt 가 첫 줄이다. 전문을 우선한다.
    const caption = [p.story?.ko, p.story?.ja, p.alt?.ko].filter(Boolean).join(' ');
    if (!caption.trim()) noCaption += 1;

    for (const [axis, rules] of Object.entries(RULES)) {
      for (const [slug, re] of Object.entries(rules)) {
        if (!re.test(caption)) continue;
        const id = idOf.get(`${axis}:${slug}`);
        if (id) wanted.add(id);
      }
    }

    for (const termId of wanted) {
      if (already.has(termId)) continue; // 이미 붙어 있으면 두 번 붙이지 않는다
      plan.push({ photoId: p.id, termId });
      const key = terms.find((t) => t.id === termId);
      hit.set(key.slug, (hit.get(key.slug) ?? 0) + 1);
    }
  }

  const tagged = new Set(plan.map((r) => r.photoId)).size;
  console.log(`붙일 분류 ${plan.length}건 · 대상 사진 ${tagged}건`);
  if (noCaption) console.log(`캡션이 비어 키워드 판정을 못 한 사진 ${noCaption}건 (월은 그대로 붙는다)`);

  console.log('\n--- term 별 부착 수 ---');
  for (const [slug, n] of [...hit.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${slug.padEnd(18)} ${n}`);
  }

  if (!apply) {
    console.log('\n(dry-run: 아무것도 쓰지 않았습니다. 반영하려면 --apply)');
  } else {
    // 왕복을 줄이려 묶는다. 원격 DB 라 기본 5초 제한에 걸리므로 넉넉히 잡는다
    // (publish-ingested.mjs 에서 실측 5,224ms 로 P2028 을 겪었다).
    const CHUNK = 200;
    for (let i = 0; i < plan.length; i += CHUNK) {
      await prisma.photoTerm.createMany({ data: plan.slice(i, i + CHUNK), skipDuplicates: true });
    }
    console.log(`\n반영 완료: ${plan.length}건 부착`);
  }
} finally {
  await prisma.$disconnect();
}
