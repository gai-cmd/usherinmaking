/**
 * 촬영(session) 축 통합 — remind-wedding · self-wedding → wedding (2026-08).
 *
 * 세 필터가 고르는 쪽에서 구분되지 않아 하나로 합쳤다(src/content/taxonomy.ts).
 * 코드에서 term 을 지워도 DB 는 그대로이므로(taxonomy-sync 는 지우지 않는다)
 * 사진 연결을 먼저 옮긴 뒤 낡은 term 행을 지운다.
 *
 * 순서: 사진 재연결 → 옛 연결 삭제 → 옛 term 삭제.
 * 사진이 한 장이라도 옛 term 에 남아 있으면 term 을 지우지 않는다.
 *
 * 실행:
 *   node scripts/session-merge-wedding.mjs --dry
 *   node scripts/session-merge-wedding.mjs
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

const DRY = process.argv.includes('--dry');
const OLD_SLUGS = ['remind-wedding', 'self-wedding'];
const NEW_SLUG = 'wedding';

const main = async () => {
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다.');

  const terms = await prisma.term.findMany({
    where: { slug: { in: [...OLD_SLUGS, NEW_SLUG] } },
    select: { id: true, slug: true, taxonomyId: true, _count: { select: { photos: true } } },
  });

  const target = terms.find((t) => t.slug === NEW_SLUG);
  if (!target) throw new Error(`'${NEW_SLUG}' term 이 DB 에 없습니다.`);
  const olds = terms.filter((t) => OLD_SLUGS.includes(t.slug));

  console.log(`대상 ${NEW_SLUG} (사진 ${target._count.photos}장)${DRY ? ' — 드라이런' : ''}`);
  for (const t of olds) console.log(`  ← ${t.slug} (사진 ${t._count.photos}장)`);
  if (olds.length === 0) {
    console.log('옮길 term 이 없습니다. 이미 통합된 상태입니다.');
    await prisma.$disconnect();
    return;
  }

  const links = await prisma.photoTerm.findMany({
    where: { termId: { in: olds.map((t) => t.id) } },
    select: { photoId: true },
  });
  const photoIds = [...new Set(links.map((l) => l.photoId))];

  const already = await prisma.photoTerm.findMany({
    where: { termId: target.id, photoId: { in: photoIds } },
    select: { photoId: true },
  });
  const alreadySet = new Set(already.map((p) => p.photoId));
  const toAdd = photoIds.filter((id) => !alreadySet.has(id));

  console.log(
    `\n옛 term 에 걸린 사진 ${photoIds.length}장 · 이미 ${NEW_SLUG} 인 사진 ${alreadySet.size}장 · 새로 붙일 사진 ${toAdd.length}장`,
  );

  if (DRY) {
    console.log(`\n(드라이런) 연결 ${links.length}건 삭제 · term ${olds.length}개 삭제 예정`);
    await prisma.$disconnect();
    return;
  }

  const created = await prisma.photoTerm.createMany({
    data: toAdd.map((photoId) => ({ photoId, termId: target.id })),
    skipDuplicates: true,
  });
  console.log(`\n연결 추가 ${created.count}건`);

  const removed = await prisma.photoTerm.deleteMany({
    where: { termId: { in: olds.map((t) => t.id) } },
  });
  console.log(`옛 연결 삭제 ${removed.count}건`);

  for (const t of olds) {
    const left = await prisma.photoTerm.count({ where: { termId: t.id } });
    if (left > 0) {
      console.log(`  ⚠️ ${t.slug} 에 아직 사진 ${left}장 — term 을 지우지 않았습니다.`);
      continue;
    }
    await prisma.term.delete({ where: { id: t.id } });
    console.log(`  − term 삭제 ${t.slug}`);
  }

  const after = await prisma.term.findUnique({
    where: { id: target.id },
    select: { _count: { select: { photos: true } } },
  });
  console.log(`\n${NEW_SLUG} 최종 ${after?._count.photos}장`);

  await prisma.$disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
