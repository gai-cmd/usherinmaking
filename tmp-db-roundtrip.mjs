// 임시 확인 스크립트 — 실행 후 삭제한다.
// Blob 토큰이 없어 업로드는 못 하므로, sharp 판독/인코딩과 MediaAsset·PageImage 왕복만 확인한다.

import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

config({ path: '.env.local' });

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

const bytes = await readFile('public/images/up/0f62c6d466bcea42.jpg');
const meta = await sharp(bytes).metadata();
console.log('sharp probe:', meta.width, 'x', meta.height, meta.format, `${bytes.length} bytes`);

const avif = await sharp(bytes)
  .rotate()
  .resize({ width: 400, withoutEnlargement: true })
  .avif({ quality: 50 })
  .toBuffer();
console.log('AVIF encode:', avif.length, 'bytes (from', bytes.length + ')');

const webp = await sharp(bytes)
  .rotate()
  .resize({ width: 800, withoutEnlargement: true })
  .webp({ quality: 72 })
  .toBuffer();
console.log('WebP encode:', webp.length, 'bytes');

const id = randomUUID();
const fakeUrl = `https://roundtrip.invalid/photos/${id}/original.jpg`;

const row = await prisma.mediaAsset.create({
  data: {
    url: fakeUrl,
    pathname: `photos/${id}/original.jpg`,
    mimeType: 'image/jpeg',
    size: bytes.length,
    width: meta.width,
    height: meta.height,
    source: 'manual',
    uploadedBy: 'roundtrip-test',
  },
});
console.log('MediaAsset created:', row.id, row.width + 'x' + row.height);

const listed = await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
console.log('MediaAsset list query returned:', listed.length, 'row(s)');

const pi = await prisma.pageImage.upsert({
  where: { page_slot: { page: 'home', slot: 'hero.location' } },
  create: {
    page: 'home',
    slot: 'hero.location',
    url: fakeUrl,
    width: meta.width,
    height: meta.height,
    alt: { ja: 'テスト', en: 'test', ko: '테스트' },
    updatedBy: 'roundtrip-test',
  },
  update: { url: fakeUrl, alt: { ja: 'テスト', en: 'test', ko: '테스트' } },
});
console.log('PageImage upsert:', pi.page, '/', pi.slot, JSON.stringify(pi.alt));

const readBack = await prisma.pageImage.findMany({ where: { page: 'home' } });
console.log(
  'PageImage findMany(page=home):',
  readBack.length,
  'row(s), url matches:',
  readBack[0]?.url === fakeUrl,
);

await prisma.pageImage.deleteMany({ where: { page: 'home', slot: 'hero.location' } });
await prisma.mediaAsset.delete({ where: { id: row.id } });
const after = await prisma.pageImage.findMany({ where: { page: 'home', slot: 'hero.location' } });
console.log('after cleanup, PageImage rows for that slot:', after.length);

await prisma.$disconnect();
