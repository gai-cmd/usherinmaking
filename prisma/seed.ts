/**
 * 시드 스크립트 — src/content/* 의 현재 값을 DB로 옮긴다.
 *
 * 두 번 돌려도 안전하다(멱등). 모든 쓰기가 스키마에 이미 있는 자연 유일키를 기준으로 한
 * upsert 다: Plan.code / Taxonomy.key / Term(taxonomyId, slug) / JournalPost(slug, locale).
 * 자연 유일키가 없는 Option · Faq 는 손으로 지은 안정된 id 를 명시해 같은 행을 다시 쓴다.
 *
 * 실행: npm run db:seed   (DATABASE_URL 이 있어야 한다)
 *
 * 값을 여기서 다시 적지 않는다 — src/server/plans.ts 의 seedPlans() / seedOptions(),
 * src/server/journal.ts 의 seedJournalRows(), src/server/faq.ts 의 SEED_FAQS 를 그대로 쓴다.
 * 화면이 폴백으로 보여 주는 값과 DB에 들어가는 값이 갈라지지 않게 하기 위해서다.
 */

import path from 'node:path';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';

// .env.local 이 먼저다 — vercel env pull 이 내려주는 로컬 값이 배포 기본값을 이긴다.
config({ path: '.env.local' });
config();

const ROOT = process.cwd();

/**
 * 앱 코드는 두 가지를 Node 가 모르는 방식으로 쓴다: '@/...' 별칭과 확장자 없는 상대경로.
 * 둘 다 번들러(tsconfig paths / moduleResolution bundler)가 풀어 주던 것이라 여기서 대신 푼다.
 * 이 훅이 등록된 뒤에야 앱 모듈을 부를 수 있어서 아래 import 는 전부 동적이다.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return {
        url: pathToFileURL(path.join(ROOT, 'src', `${specifier.slice(2)}.ts`)).href,
        shortCircuit: true,
      };
    }

    // './db' 처럼 확장자가 없는 상대경로. 원래 해석을 먼저 시도하고, 없으면 .ts 로 다시 찾는다.
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      try {
        return nextResolve(specifier, context);
      } catch (err) {
        if (path.extname(specifier) === '') {
          return nextResolve(`${specifier}.ts`, context);
        }
        throw err;
      }
    }

    return nextResolve(specifier, context);
  },
});

async function main() {
  const { isDatabaseConfigured, prisma } = await import('@/server/db');
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL 이 없습니다. .env.local 을 확인해 주세요 (vercel env pull).');
  }

  const { expectedTaxIncluded, seedOptions, seedPlans } = await import('@/server/plans');
  const { seedJournalRows } = await import('@/server/journal');
  const { SEED_FAQS } = await import('@/server/faq');
  const { TAXONOMIES, TERMS } = await import('@/content/taxonomy');

  /* ---------------------------------------------------------------- 플랜 */

  const plans = seedPlans();

  // 가격 표기는 이 사이트에서 가장 사고가 나기 쉬운 값이다.
  // 스튜디오는 모니터 가격이라 税込 표기 근거가 없고 로케이션·기념사진은 税込이다.
  // 시드가 그 구분을 흐리면 잘못된 가격이 그대로 공개되므로, 어긋나면 아무것도 넣지 않고 멈춘다.
  for (const p of plans) {
    const expected = expectedTaxIncluded(p.scope);
    if (p.taxIncluded !== expected) {
      throw new Error(
        `[seed] ${p.code}: 세금 표기가 규칙과 다릅니다 (scope=${p.scope}, taxIncluded=${p.taxIncluded}, 기대=${expected}).`,
      );
    }
  }

  for (const p of plans) {
    const data = {
      scope: p.scope,
      title: p.title,
      listPrice: p.listPrice,
      price: p.price,
      taxIncluded: p.taxIncluded,
      duration: p.duration,
      cuts: p.cuts,
      includes: p.includes,
      order: p.order,
    };
    await prisma.plan.upsert({
      where: { code: p.code },
      create: { code: p.code, ...data },
      update: data,
    });
  }
  console.info(`[seed] Plan ${plans.length}건`);

  /* ---------------------------------------------------------------- 옵션 */

  const options = seedOptions();

  for (const o of options) {
    const data = { label: o.label, price: o.price, note: o.note, order: o.order };
    // Option 에는 자연 유일키가 없다. seedOptions() 가 주는 안정된 id 를 그대로 쓴다.
    await prisma.option.upsert({
      where: { id: o.id },
      create: { id: o.id, ...data },
      update: data,
    });

    const linked = await prisma.plan.findMany({
      where: { code: { in: o.planCodes } },
      select: { id: true },
    });

    // 조인은 통째로 다시 쓴다 — 두 번째 실행에서 지난 연결이 남으면 안 된다.
    await prisma.planOption.deleteMany({ where: { optionId: o.id } });
    if (linked.length > 0) {
      await prisma.planOption.createMany({
        data: linked.map((pl) => ({ optionId: o.id, planId: pl.id })),
      });
    }
  }
  console.info(`[seed] Option ${options.length}건`);

  /* ------------------------------------------------------------ 분류 축 */

  for (const tx of TAXONOMIES) {
    await prisma.taxonomy.upsert({
      where: { key: tx.key },
      create: { key: tx.key, label: tx.label, order: tx.order },
      update: { label: tx.label, order: tx.order },
    });
  }
  console.info(`[seed] Taxonomy ${TAXONOMIES.length}건`);

  /* -------------------------------------------------------------- 용어 */

  const taxonomyIdByKey = new Map(
    (await prisma.taxonomy.findMany({ select: { id: true, key: true } })).map((t) => [t.key, t.id]),
  );

  for (const term of TERMS) {
    const taxonomyId = taxonomyIdByKey.get(term.taxonomy);
    if (!taxonomyId) throw new Error(`[seed] 축을 찾을 수 없습니다: ${term.taxonomy}`);

    // parent('set' / 'season')는 넣지 않는다. 그 둘은 실제 용어가 아니라 화면 묶음 이름이라
    // Term 행이 없고, Term 에는 그것을 담을 group 칼럼이 없다 (인계 보고의 스키마 갭).
    const data = { label: term.label, order: term.order };
    await prisma.term.upsert({
      where: { taxonomyId_slug: { taxonomyId, slug: term.slug } },
      create: { id: term.key, taxonomyId, slug: term.slug, ...data },
      update: data,
    });
  }
  console.info(`[seed] Term ${TERMS.length}건`);

  /* ---------------------------------------------------------- 촬영후기 */

  const posts = seedJournalRows();

  for (const post of posts) {
    const data = {
      category: post.category,
      title: post.title,
      body: post.body,
      cover: post.cover,
      planCode: post.planCode,
      source: post.source,
      // 시안 원고는 전부 샘플이다. 이 표시가 살아 있어야 실제 고객 이야기와 구분된다.
      isSample: post.isSample,
      publishedAt: post.publishedAt,
    };
    await prisma.journalPost.upsert({
      where: { slug_locale: { slug: post.slug, locale: post.locale } },
      create: { slug: post.slug, locale: post.locale, ...data },
      update: data,
    });
  }
  console.info(
    `[seed] JournalPost ${posts.length}건 (샘플 ${posts.filter((p) => p.isSample).length}건)`,
  );

  /* --------------------------------------------------------------- FAQ */

  for (const faq of SEED_FAQS) {
    const data = {
      question: faq.question,
      answer: faq.answer,
      page: faq.page,
      order: faq.order,
    };
    await prisma.faq.upsert({
      where: { id: faq.id },
      create: { id: faq.id, ...data },
      update: data,
    });
  }
  console.info(`[seed] Faq ${SEED_FAQS.length}건`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[seed] 실패', err);
  process.exit(1);
});
