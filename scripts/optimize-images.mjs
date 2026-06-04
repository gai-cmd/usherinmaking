// Image optimizer — runs in GitHub Actions (Node + sharp).
// Re-encodes images in images/up/ in place: cap width at 1280px, JPEG q72 (mozjpeg),
// PNG max compression. Overwrites ONLY when the result is meaningfully smaller, so
// re-runs are idempotent (no churn, no commit loop). Filenames/formats are unchanged,
// so no HTML edits are needed. Fully self-hosted output — no external runtime dependency.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import sharp from 'sharp';

const DIR = 'images/up';
const MAXW = 1280;
const MIN_GAIN = 0.04; // keep new file only if >=4% smaller

let count = 0, saved = 0, scanned = 0;
const files = await readdir(DIR);
for (const f of files) {
  const ext = extname(f).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
  scanned++;
  const p = join(DIR, f);
  const buf = await readFile(p);
  const before = buf.length;
  try {
    const meta = await sharp(buf).metadata();
    let img = sharp(buf, { failOn: 'none' }).rotate();
    if (meta.width && meta.width > MAXW) img = img.resize({ width: MAXW, withoutEnlargement: true });
    const out = ext === '.png'
      ? await img.png({ compressionLevel: 9, palette: true, quality: 78 }).toBuffer()
      : await img.jpeg({ quality: 72, mozjpeg: true }).toBuffer();
    if (out.length < before * (1 - MIN_GAIN)) {
      await writeFile(p, out);
      saved += before - out.length;
      count++;
    }
  } catch (e) {
    console.error('skip', f, e.message);
  }
}
console.log(`scanned ${scanned}, optimized ${count}, saved ${(saved / 1024 / 1024).toFixed(1)} MB`);
