/**
 * 번역이 필요한 한국어 글을 파일로 내보낸다.
 *
 * 번역 작업이 DB 를 직접 읽지 않게 하기 위한 것이다 — 원문 스냅샷을 파일로 고정해 두면
 * 번역 도중 원문이 바뀌어도 번역본과 어긋나지 않고, 무엇을 근거로 옮겼는지 남는다.
 *
 * 실행:
 *   node scripts/journal-export-source.mjs               번역이 빠진 글 전부
 *   node scripts/journal-export-source.mjs --batches 5   5묶음으로 나눠서
 */

import fs from 'node:fs';
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

const args = process.argv.slice(2);
const BATCHES = args.includes('--batches') ? Number(args[args.indexOf('--batches') + 1]) : 1;
const OUT_DIR = 'translations/source';

const main = async () => {
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다.');

  const rows = await prisma.journalPost.findMany({ orderBy: [{ slug: 'asc' }, { locale: 'asc' }] });
  const bySlug = new Map();
  for (const r of rows) {
    const g = bySlug.get(r.slug) ?? {};
    g[r.locale] = r;
    bySlug.set(r.slug, g);
  }

  // ko 는 있는데 ja 또는 en 이 비어 있는 글만. 이미 번역된 것은 건드리지 않는다.
  const todo = [];
  for (const [slug, g] of bySlug) {
    if (!g.ko) continue;
    const missing = ['ja', 'en'].filter((l) => !g[l] || !g[l].title.trim());
    if (missing.length === 0) continue;
    todo.push({
      slug,
      category: g.ko.category,
      date: g.ko.publishedAt?.toISOString().slice(0, 10) ?? '',
      missing,
      title: g.ko.title,
      body: g.ko.body,
    });
  }

  todo.sort((a, b) => a.date.localeCompare(b.date));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const size = Math.ceil(todo.length / BATCHES);
  const files = [];
  for (let i = 0; i < BATCHES; i++) {
    const chunk = todo.slice(i * size, (i + 1) * size);
    if (chunk.length === 0) continue;
    const file = path.join(OUT_DIR, `batch-${i + 1}.json`);
    fs.writeFileSync(file, JSON.stringify(chunk, null, 2));
    const chars = chunk.reduce((a, p) => a + p.body.length, 0);
    files.push({ file, n: chunk.length, chars });
  }

  console.log(`번역 필요 ${todo.length}건 → ${files.length}묶음\n`);
  for (const f of files) console.log(`  ${f.file}  ${String(f.n).padStart(2)}건 · ${f.chars.toLocaleString()}자`);

  await prisma.$disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
