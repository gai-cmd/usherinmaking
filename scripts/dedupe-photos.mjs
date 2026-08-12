// 중복 사진 정리 — 지각 해시(dHash) 기반.
//
// 같은 사진이 여러 게시물에 다시 올라오면 인스타 media id 가 달라서 수집 단계의 중복 방지가
// 통하지 않는다. 그래서 파일 내용을 직접 본다: 각 사진을 9×8 회색조로 줄여 가로 인접 픽셀의
// 대소를 64비트로 적고(dHash), 해밍 거리가 임계 이하면 같은 사진으로 묶는다.
// 워터마크 위치나 해상도가 달라도 같은 컷이면 잡힌다.
//
// 동영상(릴스)은 판정 대상에서 뺀다. 릴스의 포스터는 같은 촬영의 스틸 컷과 거의 같은 그림이라
// 화면 비교로는 반드시 중복으로 잡히는데, 둘은 서로 다른 매체다 — 보관하면 릴스가 갤러리에서 사라진다.
// (2026-08-11 실측: 27장 후보 중 1장이 릴스였다.)
//
// 남길 한 장(원본)을 고르는 기준 — 순서대로:
//   1) 해상도가 큰 것 (720×900 축소본보다 1440×1800 원본)
//   2) 저해상도 딱지(lowRes)가 없는 것
//   3) 먼저 촬영된 것 (원 게시물이 재게시본보다 앞선다)
//   4) 먼저 수집된 것 (createdAt)
// 나머지는 ARCHIVED 로 내린다 — 삭제하지 않는다. 서버에 원본은 그대로 남고 공개 갤러리에서만 빠진다.
//
// 실행:
//   node scripts/dedupe-photos.mjs            → 드라이런. 아무것도 쓰지 않고 묶음만 보고한다.
//   node scripts/dedupe-photos.mjs --apply    → 중복본을 ARCHIVED 로 내린다.
//   옵션: --threshold=5 (해밍 거리 임계, 기본 5) --account=main|dress --status=PUBLISHED
//         --force  해시 실패율 상한을 무시하고 반영 (실패가 정말 깨진 파일일 때만)

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import sharp from 'sharp';

config({ path: '.env.local' });
config();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
/** 해시 실패가 이 비율을 넘으면 반영을 막는다. 판정 못 한 사진을 "중복 아님"으로 쓰지 않기 위해서다. */
const FAIL_LIMIT = 0.05;
/** 실패가 정말 깨진 파일 때문임을 확인했을 때의 탈출구. */
const FORCE = args.includes('--force');
const argOf = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const THRESHOLD = Number(argOf('threshold', '5'));
const ACCOUNT = argOf('account', 'main');
const STATUS = argOf('status', 'PUBLISHED');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL 이 없습니다.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

/** 9×8 회색조 → 가로 인접 픽셀 비교 64비트. BigInt 로 들고 다닌다. */
async function dhash(bytes) {
  const raw = await sharp(Buffer.from(bytes))
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();

  let bits = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = raw[y * 9 + x];
      const right = raw[y * 9 + x + 1];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits;
}

function hamming(a, b) {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/** 파생본이 있으면 가장 작은 것을 받는다 — 해시에는 축소본이면 충분하고 훨씬 싸다. */
function smallestVariant(variants, originalUrl) {
  if (!variants || typeof variants !== 'object') return originalUrl;
  let best = null;
  for (const byWidth of Object.values(variants)) {
    if (!byWidth || typeof byWidth !== 'object') continue;
    for (const [w, u] of Object.entries(byWidth)) {
      const width = Number(w);
      if (!Number.isFinite(width) || typeof u !== 'string') continue;
      if (!best || width < best.width) best = { width, url: u };
    }
  }
  return best?.url ?? originalUrl;
}

/** 남길 한 장 고르기. 앞에 오는 것이 이긴다. */
function pickKeeper(group) {
  return [...group].sort((a, b) => {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    if (areaA !== areaB) return areaB - areaA; // 1) 큰 해상도
    if (a.lowRes !== b.lowRes) return a.lowRes ? 1 : -1; // 2) 저해상도 딱지 없는 것
    const t = a.takenAt.getTime() - b.takenAt.getTime();
    if (t !== 0) return t; // 3) 먼저 촬영된 것
    return a.createdAt.getTime() - b.createdAt.getTime(); // 4) 먼저 수집된 것
  })[0];
}

const fmt = (p) =>
  `${p.id.slice(0, 8)} ${p.takenAt.toISOString().slice(0, 10)} ${p.width}×${p.height}` +
  `${p.lowRes ? ' [저해상도]' : ''} ${p.slug ?? '(slug 없음)'}`;

async function main() {
  const rows = await prisma.photo.findMany({
    // 동영상은 제외한다. 위 주석의 이유 — 릴스 포스터는 스틸과 닮을 수밖에 없다.
    where: { status: STATUS, igAccount: ACCOUNT, NOT: { mediaType: 'video' } },
    select: {
      id: true,
      slug: true,
      originalUrl: true,
      variants: true,
      width: true,
      height: true,
      lowRes: true,
      takenAt: true,
      createdAt: true,
      shootKey: true,
    },
    orderBy: { takenAt: 'desc' },
  });

  const videos = await prisma.photo.count({
    where: { status: STATUS, igAccount: ACCOUNT, mediaType: 'video' },
  });

  console.log(
    `대상: ${STATUS} · ${ACCOUNT} 계정 ${rows.length}건 (임계 해밍거리 ${THRESHOLD})` +
      `${videos ? ` · 동영상 ${videos}건은 판정에서 제외` : ''}\n`,
  );

  const hashed = [];
  let failed = 0;
  for (const [i, row] of rows.entries()) {
    const src = smallestVariant(row.variants, row.originalUrl);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      hashed.push({ ...row, hash: await dhash(await res.arrayBuffer()) });
    } catch (err) {
      // 한 장을 못 읽는다고 전체를 멈추지 않는다. 다만 그 사진은 판정 대상에서 빠진다 —
      // 판정 불가를 "중복 아님"으로 바꾸지 않기 위해 건수를 따로 보고한다.
      failed += 1;
      console.warn(`  ! 해시 실패 ${row.id.slice(0, 8)} — ${err.message}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${rows.length} 해시 완료`);
  }

  // 단순 연결 성분. 145장 규모라 O(n²) 로 충분하다.
  const groups = [];
  const seen = new Set();
  for (const a of hashed) {
    if (seen.has(a.id)) continue;
    const group = [a];
    seen.add(a.id);
    for (const b of hashed) {
      if (seen.has(b.id)) continue;
      if (group.some((g) => hamming(g.hash, b.hash) <= THRESHOLD)) {
        group.push(b);
        seen.add(b.id);
      }
    }
    if (group.length > 1) groups.push(group);
  }

  const toArchive = [];
  console.log(`\n=== 중복 묶음 ${groups.length}건 ===\n`);
  for (const [i, group] of groups.entries()) {
    const keeper = pickKeeper(group);
    console.log(`[묶음 ${i + 1}] ${group.length}장`);
    for (const p of group) {
      const mark = p.id === keeper.id ? '  ✓ 남김' : '  → 보관';
      if (p.id !== keeper.id) toArchive.push(p.id);
      console.log(`${mark}  ${fmt(p)}`);
    }
    console.log('');
  }

  console.log(`총 ${rows.length}장 중 해시 실패 ${failed}장.`);

  // 해시를 못 읽은 사진은 판정에서 통째로 빠진다. 그런데 빠진 것은 "중복 아님"과
  // 화면상 구분되지 않아서, 실패가 많아도 요약 한 줄로만 보이고 그대로 반영된다.
  // 2026-08-12 실측: 저장소가 동시 다운로드를 일시 제한해 1,451장 중 734장이 실패했고
  // 중복이 10장 대신 5장만 잡혔다. 재실행하니 실패 0장이었다 — 사진 문제가 아니었다.
  // 그래서 실패가 일정 비율을 넘으면 반영을 막는다. 판정 못 한 것을 "없음"으로 쓰지 않는다.
  const failRate = rows.length > 0 ? failed / rows.length : 0;
  if (failed > 0) {
    console.log(`  → 이 ${failed}장은 판정에서 빠졌습니다 (실패율 ${(failRate * 100).toFixed(1)}%).`);
  }
  console.log(`중복으로 판정되어 보관 대상: ${toArchive.length}장 (남는 공개 사진 ${rows.length - toArchive.length}장)`);

  if (!APPLY) {
    console.log('\n드라이런입니다. 실제로 반영하려면 --apply 를 붙여 다시 실행하세요.');
    return;
  }

  if (failRate > FAIL_LIMIT && !FORCE) {
    console.error(
      `\n중단 — 해시 실패율 ${(failRate * 100).toFixed(1)}% 가 상한 ${(FAIL_LIMIT * 100).toFixed(0)}% 를 넘습니다.` +
        `\n판정하지 못한 사진이 많아, 지금 반영하면 놓친 중복이 남은 채로 "완료"가 됩니다.` +
        `\n대개 저장소의 일시적 제한이므로 잠시 뒤 다시 돌리면 실패가 사라집니다.` +
        `\n실패한 사진이 정말 깨진 것이라 확인했다면 --force 로 넘길 수 있습니다.`,
    );
    process.exitCode = 1;
    return;
  }
  if (toArchive.length === 0) return;

  const result = await prisma.photo.updateMany({
    where: { id: { in: toArchive } },
    data: { status: 'ARCHIVED' },
  });
  console.log(`\n반영 완료 — ${result.count}장을 ARCHIVED 로 내렸습니다 (파일·DB 행은 그대로).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
