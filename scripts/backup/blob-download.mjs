// Vercel Blob 전체를 로컬로 내려받는다. 사진·영상 원본이 여기 산다 — 서버가 죽으면
// DB 에는 주소만 남고 실체가 사라진다. 경로(pathname)를 그대로 보존해 복원 시
// 같은 주소로 다시 올릴 수 있게 한다.
//
// 사용: node scripts/backup/blob-download.mjs <대상 폴더>
// 같은 크기의 파일이 이미 있으면 건너뛴다 — 끊겨도 다시 돌리면 이어받는다.
import { list } from '@vercel/blob';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const dest = process.argv[2];
if (!dest) { console.error('대상 폴더가 필요합니다'); process.exit(1); }

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const token = env.BLOB_READ_WRITE_TOKEN;
if (!token) { console.error('.env.local 에 BLOB_READ_WRITE_TOKEN 이 없습니다'); process.exit(1); }

// 1) 목록 전부 수집 — manifest 가 곧 복원 대장이다
const blobs = [];
let cursor;
do {
  const r = await list({ token, cursor, limit: 1000 });
  blobs.push(...r.blobs);
  cursor = r.hasMore ? r.cursor : undefined;
  process.stderr.write(`\r목록 수집 ${blobs.length}`);
} while (cursor);
console.error('');
mkdirSync(dest, { recursive: true });
writeFileSync(join(dest, 'manifest.json'), JSON.stringify(blobs, null, 1));

// 2) 내려받기 — 동시 16개. 실패는 모아서 마지막에 보고하고 종료 코드로 알린다.
const CONC = 16;
let done = 0, skipped = 0; const failed = [];
const total = blobs.reduce((a, b) => a + b.size, 0);
async function one(b) {
  const file = join(dest, 'files', b.pathname);
  if (existsSync(file) && statSync(file).size === b.size) { skipped++; return; }
  mkdirSync(dirname(file), { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(b.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
      if (statSync(file).size !== b.size) throw new Error('크기 불일치');
      done++;
      return;
    } catch (e) {
      if (attempt === 3) failed.push({ pathname: b.pathname, error: String(e) });
    }
  }
}
let i = 0;
async function worker() {
  while (i < blobs.length) {
    const b = blobs[i++];
    await one(b);
    if ((done + skipped) % 200 === 0) process.stderr.write(`\r${done + skipped}/${blobs.length} (실패 ${failed.length})`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.error('');
console.log(`받음 ${done} · 이미 있어 건너뜀 ${skipped} · 실패 ${failed.length} · 총 ${(total / 1024 / 1024).toFixed(0)} MB`);
if (failed.length) { writeFileSync(join(dest, 'failed.json'), JSON.stringify(failed, null, 1)); process.exit(2); }
