// 사진을 "눈으로 보고" 분류하기 위한 준비·반영 도구 — 일회성.
//
// 배경: EXIF 는 네이버·인스타가 지워서 없다(실측). 캡션 키워드(backfill-photo-terms.mjs)로는
// 날씨·스튜디오 세트처럼 사진을 봐야 아는 축을 채울 수 없다. 그래서 시각 분석이 맡는다:
// 이 스크립트는 (export) 썸네일과 배치 목록을 만들고, 시각 분석 에이전트가 사진을 본 뒤
// 결과 JSON 을 쓰면 (apply) 그것을 검증해 DB 에 붙인다. 분석 자체는 이 파일 밖에서 일어난다.
//
// 실행:
//   node scripts/vision-terms.mjs export --out /tmp/uim-classify [--batch 40]
//   node scripts/vision-terms.mjs apply  --from '/tmp/uim-classify/result-*.json'
//
// apply 는 DB 에 실존하는 term 만 받는다 — 에이전트가 지어낸 slug 는 여기서 걸러 떨어진다.
// 이미 붙은 분류는 덮지 않는다(skipDuplicates). 한 사진에 여러 term 이 붙는 것은 정상이다 —
// PhotoTerm 이 다대다이고, 묶음(캐러셀) 안에 성격이 다른 사진이 섞이는 것이 실제 데이터다.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
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

async function exportBatches() {
  const out = args[args.indexOf('--out') + 1];
  if (!out) throw new Error('--out <dir> 이 필요합니다.');
  const BATCH = Number(args[args.indexOf('--batch') + 1]) || 40;

  await mkdir(path.join(out, 'img'), { recursive: true });

  // 같은 촬영(shootKey)은 같은 배치에 두어야 에이전트가 앞뒤 사진을 근거로 판단할 수 있다.
  const photos = await prisma.photo.findMany({
    // --account dress 를 주면 드레스 계정만. 기본은 작품(main) — 두 컬렉션을 섞어 뽑지 않는다.
    where: { igMediaId: { not: null }, igAccount: args[args.indexOf('--account') + 1] || 'main' },
    orderBy: [{ shootKey: 'asc' }, { shootOrder: 'asc' }],
    select: { id: true, originalUrl: true, takenAt: true, shootKey: true },
  });
  console.log(`대상 ${photos.length}건 — 썸네일 생성 중…`);

  const rows = [];
  let failed = 0;
  for (const p of photos) {
    const file = path.join(out, 'img', `${p.id}.jpg`);
    try {
      const res = await fetch(p.originalUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // 512px 이면 구도·날씨·세트를 읽기에 충분하고 토큰은 원본의 몇 분의 일이다.
      await sharp(buf).resize({ width: 512, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(file);
      rows.push({ id: p.id, file, shootKey: p.shootKey, takenAt: p.takenAt?.toISOString() ?? null });
    } catch (e) {
      failed += 1;
      console.log(`  실패 ${p.id} — ${e.message}`);
    }
  }

  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));
  // 촬영이 배치 경계에 걸리면 앞 배치로 당긴다 — 한 촬영이 두 에이전트에 갈리지 않게.
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
  console.log(`완료: 썸네일 ${rows.length}건 · 실패 ${failed}건 · 배치 ${batches.length}개`);
}

async function applyResults() {
  const pattern = args[args.indexOf('--from') + 1];
  if (!pattern) throw new Error("--from '<glob>' 이 필요합니다.");

  const terms = await prisma.term.findMany({
    select: { id: true, slug: true, taxonomy: { select: { key: true } } },
  });
  const idOf = new Map(terms.map((t) => [`${t.taxonomy.key}:${t.slug}`, t.id]));

  // 맑음/흐림은 같은 뜻의 slug 가 두 벌이다(sunny·clear-day / cloudy·cloudy-day) —
  // 월별 아카이브 링크를 깨지 않으려 남긴 설계로, taxonomy.ts 가 "사진에는 두 이름을
  // 함께 붙인다"고 정했다. 에이전트는 한 이름만 내면 되고 나머지는 여기서 따라 붙인다.
  const MIRROR = {
    'mood:sunny': 'mood:clear-day',
    'mood:cloudy': 'mood:cloudy-day',
  };

  const plan = [];
  const rejected = new Map();
  let files = 0;
  for await (const f of glob(pattern)) {
    files += 1;
    const items = JSON.parse(await readFile(f, 'utf8'));
    for (const item of items) {
      const keys = new Set(item.terms ?? []);
      for (const key of [...keys]) if (MIRROR[key]) keys.add(MIRROR[key]);
      for (const key of keys) {
        const termId = idOf.get(key);
        if (!termId) {
          rejected.set(key, (rejected.get(key) ?? 0) + 1);
          continue;
        }
        plan.push({ photoId: item.id, termId });
      }
    }
  }
  if (files === 0) throw new Error(`결과 파일이 없습니다: ${pattern}`);

  console.log(`결과 파일 ${files}개 → 부착 ${plan.length}건`);
  if (rejected.size) {
    console.log('DB 에 없는 slug 라 버린 것:');
    for (const [k, n] of rejected) console.log(`  ${k} × ${n}`);
  }

  const CHUNK = 200;
  for (let i = 0; i < plan.length; i += CHUNK) {
    await prisma.photoTerm.createMany({ data: plan.slice(i, i + CHUNK), skipDuplicates: true });
  }
  console.log('반영 완료');
}

try {
  if (mode === 'export') await exportBatches();
  else if (mode === 'apply') await applyResults();
  else {
    console.error('사용법: vision-terms.mjs export --out <dir> | apply --from <glob>');
    process.exit(1);
  }
} finally {
  await prisma.$disconnect();
}
