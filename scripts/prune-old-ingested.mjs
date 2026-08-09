// 하한(INGEST_SINCE)보다 오래된 인스타 수집분 정리 — 일회성 도구.
//
// 하한을 도입하기 전에 받아 둔 옛 사진을 지운다. 지우는 대상은 두 조건을 모두 만족하는 것만이다:
//   1) 인스타에서 온 것 (igMediaId 가 있다)
//   2) 아직 미선별 (UNSORTED) — 관리자가 전시로 고른 사진은 절대 건드리지 않는다
// 두 번째 조건이 안전장치다. 사람이 고른 사진을 날짜만 보고 지우면 안 된다.
//
// 실행:
//   node scripts/prune-old-ingested.mjs 2024-01-01           → dry-run
//   node scripts/prune-old-ingested.mjs 2024-01-01 --apply   → 실제 삭제

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { list, del } from '@vercel/blob';

config({ path: '.env.local' });
config();

const since = process.argv[2];
const apply = process.argv.includes('--apply');

if (!since || Number.isNaN(new Date(since).getTime())) {
  console.error('사용법: node scripts/prune-old-ingested.mjs <YYYY-MM-DD> [--apply]');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL 이 없습니다.');
  process.exit(1);
}

// @vercel/blob 은 토큰이 없으면 OIDC(VERCEL_OIDC_TOKEN + BLOB_STORE_ID)로도 동작한다.
const blobAuth = process.env.BLOB_READ_WRITE_TOKEN
  ? { token: process.env.BLOB_READ_WRITE_TOKEN }
  : { storeId: process.env.BLOB_STORE_ID };

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const rows = await prisma.photo.findMany({
    where: { igMediaId: { not: null }, status: 'UNSORTED', takenAt: { lt: new Date(since) } },
    select: { id: true, igMediaId: true, takenAt: true },
    orderBy: { takenAt: 'asc' },
  });

  // 안전 확인: 같은 조건에서 미선별이 아닌 것이 있으면 알려만 준다(지우지 않는다).
  const protectedCount = await prisma.photo.count({
    where: { igMediaId: { not: null }, status: { not: 'UNSORTED' }, takenAt: { lt: new Date(since) } },
  });

  console.log(`${since} 이전 · 인스타 수집분 · 미선별: ${rows.length}건`);
  if (protectedCount > 0) {
    console.log(`(전시/보관 상태라 건드리지 않는 것: ${protectedCount}건)`);
  }
  if (rows.length > 0) {
    const first = rows[0], last = rows[rows.length - 1];
    console.log(`기간: ${first.takenAt.toISOString().slice(0, 10)} ~ ${last.takenAt.toISOString().slice(0, 10)}`);
  }

  if (!apply) {
    console.log('\n(dry-run: 아무것도 지우지 않았습니다. 실행하려면 --apply)');
  } else {
    let blobs = 0;
    for (const r of rows) {
      // 원본과 파생본이 photos/<igMediaId>/ 아래 한 묶음으로 있다. 접두사로 통째로 지운다.
      const prefix = `photos/${r.igMediaId}/`;
      try {
        const { blobs: found } = await list({ prefix, ...blobAuth });
        if (found.length > 0) {
          await del(found.map((b) => b.url), blobAuth);
          blobs += found.length;
        }
      } catch (err) {
        // 파일 삭제 실패로 행까지 남기면 고아 행이 생긴다. 로그만 남기고 행은 지운다.
        console.warn('  blob 삭제 실패(행은 삭제 진행):', prefix, err?.message ?? err);
      }
    }
    const { count } = await prisma.photo.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    console.log(`\n삭제 완료: DB ${count}행 · Blob 파일 ${blobs}개`);
  }
} finally {
  await prisma.$disconnect();
}
