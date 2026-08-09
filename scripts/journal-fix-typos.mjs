/**
 * 원문 오타 수정 — 확인된 것만.
 *
 * 작가 본인이 쓴 글이라 표현을 임의로 다듬지 않는다. 여기서 고치는 것은
 * **문맥상 다른 해석이 성립하지 않는 오타뿐**이고, 판단이 갈리는 것은 손대지 않는다.
 *
 * 손대지 않기로 한 것과 그 이유:
 *   `콩버튼`            — 실제로 쓰이는 표현일 수 있다(콩단추 계열). 오타라는 근거가 없다.
 *   `4인까지 추천중서부` — 요금 안내다. "추천 / 중서부"와 "추천중 / 서부" 중 어디서 끊느냐로
 *                         뜻이 달라지는데, 코드가 정할 문제가 아니다. 요금은 특히 위험하다.
 *
 * 번역본도 함께 고친다 — 번역이 오타 상태의 원문을 보고 옮겨진 경우가 있기 때문이다.
 * (예: `일제 고객`을 "일본 고객"으로 옮긴 것 → `실제 고객`이 맞으므로 "실제 고객"으로)
 *
 * 실행:
 *   node scripts/journal-fix-typos.mjs --dry
 *   node scripts/journal-fix-typos.mjs
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

/**
 * 수정 목록. `locales` 를 지정하면 그 언어에만 적용한다.
 * `why` 는 왜 오타로 판단했는지 — 나중에 이 결정을 되짚을 사람을 위한 것이다.
 */
const FIXES = [
  {
    slug: 'dress-2021-10-569021',
    locales: ['ko'],
    from: '일제 고객 착용컷',
    to: '실제 고객 착용컷',
    why: '드레스 카탈로그 글. "일본 고객"이라면 "일본 고객"이라 쓴다. 이 자리의 관용 표현은 "실제 고객 착용컷"이다.',
  },
  // 번역이 오타 상태(일제=일본)를 보고 옮겨졌다. 원문 수정에 맞춰 되돌린다.
  { slug: 'dress-2021-10-569021', locales: ['ja'], from: '日本のお客さま', to: '実際のお客さま', why: '위 수정에 연동' },
  { slug: 'dress-2021-10-569021', locales: ['en'], from: 'a Japanese client', to: 'an actual client', why: '위 수정에 연동' },
  { slug: 'dress-2021-10-569021', locales: ['en'], from: 'Japanese client', to: 'actual client', why: '위 수정에 연동' },

  {
    slug: 'dress-2021-10-569021',
    locales: ['ko'],
    from: 'Sise :',
    to: 'Size :',
    why: 'Size 의 철자 오류. 사이즈 값(S~M)은 건드리지 않는다.',
  },
  {
    slug: 'dress-2021-10-870028',
    locales: ['ko'],
    from: '차이나홀터넷',
    to: '차이나홀터넥',
    why: '드레스 넥라인 용어는 "홀터넥". 뒤에 소재가 따로 적혀 있어 "넷(그물)"이 아니다.',
  },
  {
    slug: 'dress-2021-10-421382',
    locales: ['ko', 'ja', 'en'],
    from: '@uhserinmaking',
    to: '@usherinmaking',
    why: '브랜드명 철자. 사이트·블로그·인스타 모두 usherinmaking 이다.',
  },
  {
    slug: 'anniversary-2026-05-621560',
    locales: ['ko'],
    from: '소도시급 오시카와',
    to: '소도시급 오키나와',
    why: '오키나와 물가를 말하는 문단. 오시카와라는 지명은 없다.',
  },
  {
    slug: 'anniversary-2026-05-621560',
    locales: ['ko'],
    from: '오키나와유일모이',
    to: '오키나와 유일무이',
    why: '"유일무이"의 오타. 앞뒤가 "한국인여성작가입니다"로 이어진다.',
  },
  {
    slug: 'location-2025-10-694030',
    locales: ['ko'],
    from: '원피스 에니의',
    to: '원피스 애니의',
    why: '만화 원피스를 가리킨다. 애니메이션의 "애니".',
  },
  {
    slug: 'anniversary-2025-09-245577',
    locales: ['ko'],
    from: '필수체트',
    to: '필수 체크',
    // 제목과 사진 alt 에 함께 들어 있어 본문 전체를 대상으로 바꾼다.
    why: '"체크"의 오타(ㅋ/ㅌ 인접 오타). 글 내용이 "오키나와 여행에서 빠뜨리지 말 것"이다.',
    alsoTitle: true,
  },
];

const main = async () => {
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다.');

  console.log(`수정 후보 ${FIXES.length}건${DRY ? ' (드라이런 — 쓰지 않습니다)' : ''}\n`);

  let applied = 0;
  let notFound = 0;

  for (const fix of FIXES) {
    for (const locale of fix.locales) {
      const row = await prisma.journalPost.findUnique({
        where: { slug_locale: { slug: fix.slug, locale } },
      });
      if (!row) continue; // 아직 번역되지 않은 언어는 조용히 건너뛴다

      const inBody = row.body.includes(fix.from);
      const inTitle = fix.alsoTitle && row.title.includes(fix.from);
      if (!inBody && !inTitle) {
        notFound++;
        continue;
      }

      const body = inBody ? row.body.split(fix.from).join(fix.to) : row.body;
      const title = inTitle ? row.title.split(fix.from).join(fix.to) : row.title;
      const hits = (inBody ? row.body.split(fix.from).length - 1 : 0) + (inTitle ? 1 : 0);

      console.log(`[${fix.slug} / ${locale}] "${fix.from}" → "${fix.to}"  (${hits}곳)`);
      if (fix.why !== '위 수정에 연동') console.log(`    근거: ${fix.why}`);

      if (!DRY) {
        await prisma.journalPost.update({ where: { id: row.id }, data: { body, title } });
      }
      applied++;
    }
  }

  console.log(`\n적용 ${applied}건${notFound ? ` · 해당 문구 없음 ${notFound}건(이미 수정됐거나 번역 문구가 다름)` : ''}`);
  console.log('\n손대지 않은 것: 콩버튼(오타 근거 없음) · 4인까지 추천중서부(요금 안내, 끊는 위치로 뜻이 달라짐)');

  await prisma.$disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
