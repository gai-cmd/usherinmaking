// 임시 통합 확인 스크립트 — 실행 후 삭제한다.
// uploadMedia()가 하는 순서를 그대로 재현한다:
//   판독(sharp) → 원본 업로드(blob) → 파생본 인코딩·업로드 → MediaAsset 기록 → 조회 → 삭제.
// '@/' 별칭은 node가 못 푸므로 같은 라이브러리를 직접 호출한다.

import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { put, del } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

config({ path: '.env.local' });

const token = process.env.BLOB_READ_WRITE_TOKEN;
const dbUrl = process.env.DATABASE_URL;
console.log('BLOB token present:', Boolean(token));
console.log('DATABASE_URL present:', Boolean(dbUrl));

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: dbUrl }) });

const bytes = await readFile('public/images/up/0f62c6d466bcea42.jpg');
const meta = await sharp(bytes).metadata();
console.log('probe:', meta.width, 'x', meta.height, meta.format, `${bytes.length} bytes`);

const id = randomUUID();
const key = `photos/${id}/original.jpg`;

const original = await put(key, bytes, {
  access: 'public',
  token,
  contentType: 'image/jpeg',
  addRandomSuffix: false,
  allowOverwrite: true,
});
console.log('original uploaded:', original.url);

const avif = await sharp(bytes)
  .rotate()
  .resize({ width: 400, withoutEnlargement: true })
  .avif({ quality: 50 })
  .toBuffer();
const rendition = await put(`photos/${id}/400.avif`, avif, {
  access: 'public',
  token,
  contentType: 'image/avif',
  addRandomSuffix: false,
  allowOverwrite: true,
});
console.log('rendition uploaded:', rendition.url, `(${avif.length} bytes)`);

const fetched = await fetch(original.url);
console.log('GET original:', fetched.status, fetched.headers.get('content-type'));

const row = await prisma.mediaAsset.create({
  data: {
    url: original.url,
    pathname: key,
    mimeType: 'image/jpeg',
    size: bytes.length,
    width: meta.width,
    height: meta.height,
    source: 'manual',
    uploadedBy: 'roundtrip-test',
  },
});
console.log('MediaAsset created:', row.id);

const listed = await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 3 });
console.log('MediaAsset rows visible to list query:', listed.length);

const pi = await prisma.pageImage.upsert({
  where: { page_slot: { page: 'home', slot: 'hero.location' } },
  create: {
    page: 'home',
    slot: 'hero.location',
    url: original.url,
    width: meta.width,
    height: meta.height,
    alt: { ja: 'テスト', en: 'test', ko: '테스트' },
    updatedBy: 'roundtrip-test',
  },
  update: { url: original.url, alt: { ja: 'テスト', en: 'test', ko: '테스트' } },
});
console.log('PageImage upserted:', pi.page, '/', pi.slot, JSON.stringify(pi.alt));

const readBack = await prisma.pageImage.findUnique({
  where: { page_slot: { page: 'home', slot: 'hero.location' } },
});
console.log('PageImage read back:', readBack?.url === original.url ? 'URL matches' : 'MISMATCH');

await prisma.pageImage.deleteMany({ where: { page: 'home', slot: 'hero.location' } });
await prisma.mediaAsset.delete({ where: { id: row.id } });
await del([original.url, rendition.url], { token });
console.log('cleanup done');

const gone = await fetch(original.url);
console.log('GET original after delete:', gone.status);

await prisma.$disconnect();
