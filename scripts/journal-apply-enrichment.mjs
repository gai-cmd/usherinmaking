/**
 * 촬영후기 본문 보강 적용기.
 *
 * docs/seo/journal-enrichment.json 의 { slug: { draft, note } } 를 읽어 note 가 채워진 글에만
 * "draft + note" 문단을 본문 맨 앞(첫 사진 앞)에 넣는다. note 가 빈 글은 건너뛴다 —
 * 메타데이터로 만든 뼈대 문장만으로는 얇은 글이 두꺼워지지 않고, 197편이 같은 틀의
 * 문장을 갖게 되어 오히려 보일러플레이트로 읽힌다.
 *
 * 실행: node scripts/journal-apply-enrichment.mjs          (dry-run: 바뀔 글만 출력)
 *       node scripts/journal-apply-enrichment.mjs --apply  (DB 반영)
 * 이미 같은 문단이 들어간 글은 다시 넣지 않는다(멱등).
 */
import { config } from 'dotenv';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

config({ path: '.env.local', quiet: true });
const apply = process.argv.includes('--apply');
const map = JSON.parse(fs.readFileSync('docs/seo/journal-enrichment.json', 'utf8'));
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

let changed = 0, skipped = 0;
for (const [slug, e] of Object.entries(map)) {
  const note = (e.note ?? '').trim();
  if (!note) { skipped++; continue; }
  const para = `${e.draft.trim()}\n\n${note}`;
  const row = await prisma.journalPost.findFirst({ where: { slug, locale: 'ko' } });
  if (!row) { console.warn('없음:', slug); continue; }
  if (row.body.includes(note)) continue;
  const body = `${para}\n\n${row.body}`;
  changed++;
  console.log(`${apply ? '반영' : '예정'}: ${slug} — ${e.title}`);
  if (apply) await prisma.journalPost.update({ where: { id: row.id }, data: { body } });
}
console.log(`\n${apply ? '반영' : '예정'} ${changed}편 · note 비어 건너뜀 ${skipped}편`);
await prisma.$disconnect();
