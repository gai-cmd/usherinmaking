/**
 * 코드의 분류 체계(`src/content/taxonomy.ts`)를 DB(Taxonomy / Term)에 반영한다.
 *
 * 전체 시드(`prisma/seed.ts`)를 돌리면 플랜·저널 시드까지 함께 손대므로,
 * 분류만 필요한 경우를 위해 그 부분만 떼어냈다. upsert 라 여러 번 돌려도 안전하다.
 *
 * **지우지 않는다.** DB 에만 있고 코드에 없는 term 은 그대로 둔다 —
 * 사진이 이미 그 term 에 걸려 있을 수 있고, 지우면 연결이 함께 끊긴다(PhotoTerm cascade).
 * 코드에서 사라진 term 은 목록으로만 알린다.
 *
 * 실행:
 *   node scripts/taxonomy-sync.mjs --dry
 *   node scripts/taxonomy-sync.mjs
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

const main = async () => {
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다.');

  const { TAXONOMIES, TERMS } = await import('@/content/taxonomy');

  console.log(`코드 축 ${TAXONOMIES.length}개 · term ${TERMS.length}개${DRY ? ' (드라이런)' : ''}\n`);

  if (!DRY) {
    for (const tx of TAXONOMIES) {
      await prisma.taxonomy.upsert({
        where: { key: tx.key },
        create: { key: tx.key, label: tx.label, order: tx.order },
        update: { label: tx.label, order: tx.order },
      });
    }
  }

  const taxonomyIdByKey = new Map(
    (await prisma.taxonomy.findMany({ select: { id: true, key: true } })).map((t) => [t.key, t.id]),
  );

  const before = new Set(
    (await prisma.term.findMany({ select: { slug: true } })).map((t) => t.slug),
  );

  let added = 0;
  let updated = 0;
  for (const term of TERMS) {
    const taxonomyId = taxonomyIdByKey.get(term.taxonomy);
    if (!taxonomyId) {
      console.log(`  ⚠️ 축 없음 — ${term.taxonomy} (${term.slug}) 건너뜀`);
      continue;
    }
    const isNew = !before.has(term.slug);
    if (isNew) {
      added++;
      console.log(`  + ${term.taxonomy.padEnd(8)} ${term.slug}`);
    } else {
      updated++;
    }
    if (DRY) continue;

    // parent('set' / 'season')는 넣지 않는다 — 화면 묶음 이름이라 Term 행이 없다.
    const data = { label: term.label, order: term.order };
    await prisma.term.upsert({
      where: { taxonomyId_slug: { taxonomyId, slug: term.slug } },
      create: { id: term.key, taxonomyId, slug: term.slug, ...data },
      update: data,
    });
  }

  const codeSlugs = new Set(TERMS.map((t) => t.slug));
  const orphan = [...before].filter((s) => !codeSlugs.has(s));

  console.log(`\n추가 ${added}개 · 갱신 ${updated}개`);
  if (orphan.length) {
    console.log(`\nDB 에만 있는 term ${orphan.length}개 (지우지 않았습니다): ${orphan.join(', ')}`);
  }

  await prisma.$disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
