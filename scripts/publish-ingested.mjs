// 인스타 수집분의 문안을 원문으로 채우고 전시로 올린다 — 일회성 도구.
//
// 번역하지 않기로 했으므로 alt 는 캡션 첫 줄을, story 는 캡션 전문을 그대로 쓴다.
// 3개 언어에 같은 문장이 들어간다 — 언어별로 다른 글을 지어내지 않기 위해서다.
//
// 대상은 igMediaId 가 있는 사진뿐이다. 블로그 취입분(145장)은 이미 사람이 문안을 넣었으므로
// 건드리지 않는다. 이미 ARCHIVED 로 내린 사진도 되살리지 않는다.
//
// 실행:
//   node scripts/publish-ingested.mjs           → dry-run
//   node scripts/publish-ingested.mjs --apply   → 실제 반영
//
// 주의: 문안 규칙은 src/server/ingest.ts 의 firstLineOf / altFromCaption 과 같아야 한다.

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

/** 캡션의 첫 줄. 해시태그·멘션만 있는 줄은 건너뛴다. 자르기만 하고 고쳐 쓰지 않는다. */
function firstLineOf(caption) {
  if (!caption) return '';
  for (const line of String(caption).split('\n')) {
    const t = line.trim();
    if (t && !/^[#@]/.test(t)) return t.length > 120 ? t.slice(0, 120) : t;
  }
  return '';
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const rows = await prisma.photo.findMany({
    where: { igMediaId: { not: null }, status: 'UNSORTED' },
    select: { id: true, caption: true },
  });

  const plan = [];
  const noText = [];
  for (const r of rows) {
    const line = firstLineOf(r.caption);
    const body = r.caption?.trim() || '';
    // 문안이 한 글자도 없으면 전시로 올리지 않는다 — 빈 alt 는 접근성에도 검색에도 해롭다.
    if (!line) { noText.push(r.id); continue; }
    plan.push({ id: r.id, alt: { ja: line, en: line, ko: line }, story: body ? { ja: body, en: body, ko: body } : null });
  }

  console.log(`미선별 인스타 수집분: ${rows.length}건`);
  console.log(`전시로 올릴 수 있는 것: ${plan.length}건`);
  if (noText.length > 0) console.log(`문안 없어 미선별로 남길 것: ${noText.length}건`);
  console.log('--- 제목이 될 첫 줄 샘플 3건 ---');
  for (const p of plan.slice(0, 3)) console.log(`  ${p.alt.ko}`);

  if (!apply) {
    console.log('\n(dry-run: 아무것도 쓰지 않았습니다. 반영하려면 --apply)');
  } else {
    // 행마다 왕복하면 데이터 전송이 그만큼 늘어난다(2026-08-10 Neon 쿼터 소진).
    // 한 트랜잭션에 묶어 왕복을 한 번으로 줄인다.
    const CHUNK = 50;
    for (let i = 0; i < plan.length; i += CHUNK) {
      await prisma.$transaction(
        plan.slice(i, i + CHUNK).map((p) =>
          prisma.photo.update({
            where: { id: p.id },
            data: { alt: p.alt, ...(p.story ? { story: p.story } : {}), status: 'PUBLISHED' },
          }),
        ),
      );
    }
    console.log(`\n반영 완료: ${plan.length}건 전시 전환`);
  }
} finally {
  await prisma.$disconnect();
}
