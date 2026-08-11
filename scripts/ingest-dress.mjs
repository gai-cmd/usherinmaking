// @usherindress 수집 — 드레스 컬렉션 전용 독립 스크립트.
//
// 본체 크론(ingest.ts)과 일부러 분리했다: ig-token 의 자동연장·Setting 키가 작품 계정
// 단일 구조라, 검증 없이 다계정으로 넓히면 잘 돌고 있는 크론을 흔든다. 드레스는
// 룩북이라 수집 빈도도 낮으니, 네이버 취입과 같은 "필요할 때 돌리는 도구"로 둔다.
//
// 필요한 환경변수: IG_DRESS_ACCESS_TOKEN · IG_DRESS_USER_ID (+ 기존 Blob·DB 설정)
// 토큰(60일)의 연장은 이 스크립트가 하지 않는다 — 만료되면 재발급해 갈아끼운다.
//
// 실행:
//   node scripts/ingest-dress.mjs --dry            → 무엇을 받을지만 (쓰기 없음)
//   node scripts/ingest-dress.mjs [--limit 30]     → 수집 (UNSORTED 로 저장)
//   node scripts/ingest-dress.mjs --publish        → 수집 + 곧장 전시(PUBLISHED)
//
// --publish 를 둔 이유: 드레스 사진의 문안은 캡션 원문이 그대로 alt·story 가 되므로
// (작품 갤러리와 같은 규칙), 별도 선별 없이 룩북 전체를 올리는 운영도 성립한다.

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

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const PUBLISH = args.includes('--publish');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 30;

const accessToken = process.env.IG_DRESS_ACCESS_TOKEN?.trim();
const userId = process.env.IG_DRESS_USER_ID?.trim();
if (!accessToken || !userId) {
  console.error('IG_DRESS_ACCESS_TOKEN / IG_DRESS_USER_ID 가 없습니다 (.env.local 확인).');
  console.error('@usherindress 는 프로페셔널 계정이어야 하고, 본계정과 같은 절차로 발급합니다.');
  process.exit(1);
}

const { fetchInstagramMedia } = await import('@/lib/instagram');
const { downloadOriginal, probeImageDimensions, storeOriginal } = await import('@/lib/image-pipeline');
const { prisma, isDatabaseConfigured } = await import('@/server/db');
const { LOW_RES_MIN_LONG_EDGE } = await import('@/lib/image-contract');
if (!isDatabaseConfigured()) {
  console.error('DATABASE_URL 이 없습니다.');
  process.exit(1);
}

/** 캡션 첫 줄(해시태그·멘션 줄 제외). 본체 ingest 의 문안 규칙과 같다 — 번역하지 않는다. */
function altFromCaption(caption) {
  if (!caption) return null;
  for (const line of String(caption).split('\n')) {
    const t = line.trim();
    if (t && !/^[#@]/.test(t)) {
      const v = t.length > 120 ? t.slice(0, 120) : t;
      return { ja: v, en: v, ko: v };
    }
  }
  return null;
}

try {
  console.log(`@usherindress 조회 중… (계정 ${userId.slice(-4)})`);
  const media = await fetchInstagramMedia({ userId, accessToken });
  const photos = media.filter((m) => m.mediaUrl);

  const known = new Set(
    (
      await prisma.photo.findMany({
        where: { igAccount: 'dress' },
        select: { igMediaId: true },
      })
    ).map((p) => p.igMediaId),
  );
  const fresh = photos.filter((m) => !known.has(m.id)).slice(0, LIMIT);
  console.log(`전체 ${photos.length}장 · 이미 있음 ${known.size} · 이번에 ${fresh.length}장 (limit ${LIMIT})`);

  if (DRY) {
    for (const m of fresh.slice(0, 8)) {
      console.log(`  [dry] ${m.id} shoot=${m.parentId} #${m.order} ${(m.caption ?? '').split('\n')[0].slice(0, 40)}`);
    }
    console.log('(dry-run: 아무것도 쓰지 않았습니다)');
    process.exit(0);
  }

  let created = 0;
  let failed = 0;
  for (const m of fresh) {
    try {
      const bytes = await downloadOriginal(m.mediaUrl);
      const ext = /\.png(\?|$)/i.test(m.mediaUrl) ? 'png' : 'jpg';
      const originalUrl = await storeOriginal(`photos/dress/${m.id}.${ext}`, bytes);
      const { width, height } = await probeImageDimensions(bytes);
      const alt = altFromCaption(m.caption);
      const story = m.caption?.trim() ? { ja: m.caption.trim(), en: m.caption.trim(), ko: m.caption.trim() } : null;

      await prisma.photo.create({
        data: {
          igAccount: 'dress',
          igMediaId: m.id,
          originalUrl,
          // 드레스 격자는 원본을 next/image 가 직접 최적화한다 — 파생본 계획이 없다.
          variants: [],
          width,
          height,
          // 관리자 화면의 원본 교체 유도 신호. 여기서 안 넣으면 기본값 false 로 남아
          // 실제로 작은 사진이 경고 없이 지나간다(드레스 수집분 46건이 그랬다).
          lowRes: Math.max(width, height) < LOW_RES_MIN_LONG_EDGE,
          caption: m.caption ?? null,
          takenAt: new Date(m.timestamp),
          // alt 없이 PUBLISH 하지 않는다 — 작품 갤러리와 같은 접근성 규칙이다.
          status: PUBLISH && alt ? 'PUBLISHED' : 'UNSORTED',
          alt: alt ?? { ja: '', en: '', ko: '' },
          ...(story ? { story } : {}),
          shootKey: m.parentId,
          shootOrder: m.order,
        },
        select: { id: true },
      });
      created += 1;
      if (created % 10 === 0) console.log(`  …${created}장`);
    } catch (e) {
      failed += 1;
      console.log(`  실패 ${m.id} — ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`완료: 저장 ${created} · 실패 ${failed}${PUBLISH ? ' · 상태 PUBLISHED(alt 있는 것만)' : ' · 상태 UNSORTED'}`);
} finally {
  await prisma.$disconnect();
}
