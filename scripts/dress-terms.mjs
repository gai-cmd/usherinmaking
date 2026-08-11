// 드레스 컬렉션 분류 축(dressCollection)과 5개 term 을 DB 에 심는다 — 일회성.
//
// 코드 택소노미(src/content/taxonomy.ts)에 넣지 않는 이유: 그 파일은 갤러리 필터의
// 원본이라 축을 더하면 작품 갤러리 화면에 드레스 축이 나타난다. 드레스 분류는
// 드레스 페이지만 쓰므로 DB 에만 둔다 (taxonomy-sync 는 DB 전용 term 을 지우지 않는다).
//
// 5개 분류는 사용자가 @usherindress 하이라이트 기준으로 지정한 것이다.
//
// 실행: node scripts/dress-terms.mjs

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

config({ path: '.env.local' });
config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL 이 없습니다.');
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const TERMS = [
  { slug: 'styling', order: 0, label: { ja: 'スタイリング', en: 'Styling', ko: '스타일링' } },
  { slug: 'fitting', order: 1, label: { ja: '試着', en: 'Fitting', ko: '시착' } },
  { slug: 'korean-dress', order: 2, label: { ja: '韓国ドレス', en: 'Korean Dress', ko: '한국드레스' } },
  { slug: 'cover-ups', order: 3, label: { ja: 'カバーアップ', en: 'CoverUps', ko: '커버업' } },
  { slug: 'american-dress', order: 4, label: { ja: 'アメリカドレス', en: 'American Dress', ko: '아메리카드레스' } },
];

try {
  const taxonomy = await prisma.taxonomy.upsert({
    where: { key: 'dressCollection' },
    update: {},
    create: {
      key: 'dressCollection',
      label: { ja: 'ドレスコレクション', en: 'Dress Collection', ko: '드레스 컬렉션' },
      order: 99, // 갤러리 축들 뒤 — 화면 순서에 끼어들 일은 없지만 규약은 지킨다
    },
  });

  for (const t of TERMS) {
    await prisma.term.upsert({
      where: { taxonomyId_slug: { taxonomyId: taxonomy.id, slug: t.slug } },
      update: { label: t.label, order: t.order },
      create: { taxonomyId: taxonomy.id, ...t },
    });
    console.log(`  ✅ ${t.slug} (${t.label.ko})`);
  }
  console.log('완료: dressCollection 축 + term 5개');
} finally {
  await prisma.$disconnect();
}
