// 사진 alt 3개 언어 일괄 생성 준비·반영 도구 — vision-terms.mjs 와 같은 구조.
//
// 현재 alt 는 인스타 캡션 첫 줄이 세 언어에 그대로 복사돼 있다(언어별로 같은 문장).
// 시각 분석 에이전트가 사진을 보고 언어별 자연문 alt 를 쓰면 (apply) 검증해 반영한다.
//
// 실행:
//   node scripts/alt-generate.mjs export --out /tmp/uim-alt [--batch 40] [--account main]
//   node scripts/alt-generate.mjs apply  --from '/tmp/uim-alt/result-*.json'
//
// export 는 기존 분류용 썸네일(/tmp/uim-classify*/img)을 재사용하고 없는 것만 내려받는다.

import { mkdir, writeFile, readFile, access, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'node:fs/promises';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import sharp from 'sharp';

config({ path: '.env.local' });
config();

const args = process.argv.slice(2);
const mode = args[0];
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL 이 없습니다.');
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const REUSE_DIRS = ['/tmp/uim-classify2/img', '/tmp/uim-classify/img'];

async function exportBatches() {
  const out = args[args.indexOf('--out') + 1];
  if (!out) throw new Error('--out <dir> 이 필요합니다.');
  const BATCH = Number(args[args.indexOf('--batch') + 1]) || 40;

  await mkdir(path.join(out, 'img'), { recursive: true });

  const photos = await prisma.photo.findMany({
    where: {
      igMediaId: { not: null },
      igAccount: args.includes('--account') ? args[args.indexOf('--account') + 1] : 'main',
    },
    orderBy: [{ shootKey: 'asc' }, { shootOrder: 'asc' }],
    select: {
      id: true,
      originalUrl: true,
      shootKey: true,
      caption: true,
      terms: { select: { term: { select: { slug: true } } } },
    },
  });
  console.log(`대상 ${photos.length}건 — 썸네일 준비 중…`);

  const rows = [];
  let reused = 0;
  let fetched = 0;
  let failed = 0;
  for (const p of photos) {
    const file = path.join(out, 'img', `${p.id}.jpg`);
    try {
      let done = false;
      for (const dir of REUSE_DIRS) {
        const prev = path.join(dir, `${p.id}.jpg`);
        try {
          await access(prev);
          await copyFile(prev, file);
          reused += 1;
          done = true;
          break;
        } catch {
          /* 다음 후보 */
        }
      }
      if (!done) {
        const res = await fetch(p.originalUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        await sharp(buf).resize({ width: 512, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(file);
        fetched += 1;
      }
      rows.push({
        id: p.id,
        file,
        shootKey: p.shootKey,
        // 캡션은 배경 사실 확인용(장소명·행사)이다. 광고 상용구는 에이전트가 무시한다.
        caption: (p.caption ?? '').slice(0, 280) || null,
        terms: p.terms.map((t) => t.term.slug),
      });
    } catch (e) {
      failed += 1;
      console.log(`  실패 ${p.id} — ${e.message}`);
    }
  }

  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));
  for (let b = 0; b + 1 < batches.length; b++) {
    const last = batches[b].at(-1);
    while (batches[b + 1][0] && batches[b + 1][0].shootKey && batches[b + 1][0].shootKey === last.shootKey) {
      batches[b].push(batches[b + 1].shift());
    }
  }

  for (const [i, batch] of batches.entries()) {
    const f = path.join(out, `batch-${String(i + 1).padStart(2, '0')}.json`);
    await writeFile(f, JSON.stringify(batch, null, 1));
    console.log(`  ${f} — ${batch.length}건`);
  }
  console.log(`완료: 재사용 ${reused} · 신규 ${fetched} · 실패 ${failed} · 배치 ${batches.length}개`);
}

async function applyResults() {
  const pattern = args[args.indexOf('--from') + 1];
  if (!pattern) throw new Error("--from '<glob>' 이 필요합니다.");

  const items = [];
  const bad = [];
  let files = 0;
  for await (const f of glob(pattern)) {
    files += 1;
    for (const item of JSON.parse(await readFile(f, 'utf8'))) {
      const alt = item.alt ?? {};
      const ok =
        typeof alt.ja === 'string' && alt.ja.trim() &&
        typeof alt.en === 'string' && alt.en.trim() &&
        typeof alt.ko === 'string' && alt.ko.trim();
      // 세 언어가 다 있어야 반영한다 — 빈 언어를 덮어써서 alt 를 잃지 않기 위해서다.
      if (ok) items.push({ id: item.id, alt: { ja: alt.ja.trim(), en: alt.en.trim(), ko: alt.ko.trim() } });
      else bad.push(item.id);
    }
  }
  if (files === 0) throw new Error(`결과 파일이 없습니다: ${pattern}`);
  console.log(`결과 파일 ${files}개 → 반영 대상 ${items.length}건 · 불완전 ${bad.length}건`);
  if (bad.length) console.log(`  불완전(세 언어 미충족): ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ' …' : ''}`);

  let updated = 0;
  for (const item of items) {
    await prisma.photo.update({ where: { id: item.id }, data: { alt: item.alt } });
    updated += 1;
    if (updated % 100 === 0) console.log(`  ${updated}/${items.length}`);
  }
  console.log(`반영 완료: ${updated}건`);
}

try {
  if (mode === 'export') await exportBatches();
  else if (mode === 'apply') await applyResults();
  else {
    console.error('사용법: alt-generate.mjs export --out <dir> | apply --from <glob>');
    process.exit(1);
  }
} finally {
  await prisma.$disconnect();
}
