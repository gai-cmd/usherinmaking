// Photo.slug 일회성 백필.
//
// slug 칼럼을 뒤늦게 추가했기 때문에, 그 전에 들어온 사진들은 slug 가 비어 있다.
// 비어 있으면 화면이 id 를 주소로 쓰는데(photoHref), 읽을 수도 공유할 수도 없는 주소가 된다.
// 여기서 영문 alt 로부터 한 번 채워 준다. 이미 slug 가 있는 행은 건드리지 않는다.
//
// 실행:
//   node scripts/backfill-photo-slugs.mjs           → dry-run (아무것도 쓰지 않는다)
//   node scripts/backfill-photo-slugs.mjs --apply   → 실제 반영
//
// 주의: slug 규칙은 src/server/ai-draft.ts 의 slugFromAlt 와 같아야 한다.
// 이 파일은 한 번 쓰고 끝나는 도구라 로직을 옮겨 적었다 — 규칙을 바꾸면 그쪽이 정본이다.

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

config({ path: '.env.local' });
config();

const SLUG_MAX = 60;

function slugFromAlt(altEn) {
  const base = String(altEn ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base.length === 0) return null;
  if (base.length <= SLUG_MAX) return base;

  const cut = base.slice(0, SLUG_MAX);
  const lastDash = cut.lastIndexOf('-');
  return lastDash > 0 ? cut.slice(0, lastDash) : cut;
}

const apply = process.argv.includes('--apply');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL 이 없습니다.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  // 이미 쓰이고 있는 slug 는 피해야 한다 — unique 제약이 걸려 있다.
  const taken = new Set(
    (await prisma.photo.findMany({ where: { slug: { not: null } }, select: { slug: true } })).map(
      (r) => r.slug,
    ),
  );

  const rows = await prisma.photo.findMany({
    where: { slug: null },
    select: { id: true, alt: true, takenAt: true },
    orderBy: { takenAt: 'asc' },
  });

  const plan = [];
  const skipped = [];

  for (const row of rows) {
    const base = slugFromAlt(row.alt?.en);
    if (!base) {
      // 영문 alt 가 비었거나 ASCII 로 남는 글자가 없다. 주소는 id 로 남는다.
      skipped.push(row.id);
      continue;
    }

    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
    taken.add(slug);
    plan.push({ id: row.id, slug });
  }

  console.log(`대상 ${rows.length}건 · 생성 ${plan.length}건 · 생략 ${skipped.length}건`);
  console.log('--- 앞 10건 ---');
  for (const p of plan.slice(0, 10)) console.log(`  ${p.slug}`);
  if (skipped.length > 0) console.log(`생략된 id: ${skipped.slice(0, 5).join(', ')}`);

  if (!apply) {
    console.log('\n(dry-run: 아무것도 쓰지 않았습니다. 반영하려면 --apply)');
  } else {
    let done = 0;
    for (const p of plan) {
      await prisma.photo.update({ where: { id: p.id }, data: { slug: p.slug } });
      done += 1;
    }
    console.log(`\n반영 완료: ${done}건`);
  }
} finally {
  await prisma.$disconnect();
}
