/**
 * 사진에 **촬영 묶음**(shootKey / shootOrder)을 채운다.
 *
 * 갤러리를 "사진 낱장 나열"이 아니라 "촬영 1건 = 카드 1개"로 보여주기 위한 것이다.
 * 블로그가 한 포스팅에 사진 여러 장을 담는 것과 같은 모양이다.
 *
 * **묶는 근거는 추측이 아니다.** 취입 글의 표지와 본문에 사진 주소가 그대로 들어 있어서,
 * 사진 → 어느 글에서 왔는지를 100% 되찾을 수 있다(145/145장 확인). 그 글의 slug 를 묶음 이름으로 쓴다.
 * 순서도 마찬가지로 본문에 실린 순서 그대로다 — 표지가 0, 본문 사진이 1부터.
 *
 * 글에서 오지 않은 사진(관리자가 낱장으로 올린 것)은 건드리지 않는다.
 * 묶음이 비어 있으면 화면에서 그 사진 한 장이 곧 하나의 묶음으로 취급된다.
 *
 * 실행:
 *   node scripts/photos-backfill-shoot.mjs --dry
 *   node scripts/photos-backfill-shoot.mjs
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

  // 한국어판을 기준으로 삼는다 — 번역본은 같은 사진 주소를 가리키므로 어느 쪽을 봐도 같다.
  const posts = await prisma.journalPost.findMany({
    where: { locale: 'ko' },
    select: { slug: true, cover: true, body: true, publishedAt: true },
  });

  /** 사진 주소 → { 묶음 이름, 순서 } */
  const owner = new Map();
  for (const p of posts) {
    // 표지가 0번. 본문 사진이 실린 순서대로 1번부터.
    const urls = [p.cover, ...[...p.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1])];
    urls.forEach((url, i) => {
      // 표지가 본문 첫 장과 같은 파일이면 먼저 잡은 쪽(표지=0)을 유지한다.
      if (!owner.has(url)) owner.set(url, { key: p.slug, order: i });
    });
  }

  const photos = await prisma.photo.findMany({
    select: { id: true, originalUrl: true, shootKey: true, shootOrder: true },
  });

  let set = 0;
  let already = 0;
  let orphan = 0;
  const groups = new Map();

  for (const ph of photos) {
    const own = owner.get(ph.originalUrl);
    if (!own) {
      orphan++;
      continue;
    }
    groups.set(own.key, (groups.get(own.key) ?? 0) + 1);

    if (ph.shootKey === own.key && ph.shootOrder === own.order) {
      already++;
      continue;
    }
    if (!DRY) {
      await prisma.photo.update({
        where: { id: ph.id },
        data: { shootKey: own.key, shootOrder: own.order },
      });
    }
    set++;
  }

  console.log(`사진 ${photos.length}장${DRY ? ' (드라이런 — 쓰지 않습니다)' : ''}`);
  console.log(`  묶음 지정 ${set}장 · 이미 맞음 ${already}장 · 글에서 오지 않은 사진 ${orphan}장(그대로 둠)`);
  console.log(`\n촬영 묶음 ${groups.size}개`);

  const sizes = [...groups.values()].sort((a, b) => b - a);
  if (sizes.length) {
    console.log(`  묶음당 사진: 최대 ${sizes[0]}장 · 중앙 ${sizes[Math.floor(sizes.length / 2)]}장 · 1장짜리 ${sizes.filter((x) => x === 1).length}개`);
    console.log('\n  큰 묶음 5개:');
    for (const [k, n] of [...groups].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`    ${k.padEnd(30)} ${n}장`);
    }
  }

  await prisma.$disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
