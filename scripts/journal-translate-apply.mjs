/**
 * 번역본(JSON) → 저널 DB 반영.
 *
 * 번역 자체는 사람(또는 에이전트)이 하고, 이 도구는 **넣는 일만** 한다.
 * 기계 번역 API 를 부르지 않는 이유: 이 글들은 작가 본인의 목소리라 문체가 내용의 일부이고,
 * 사실(장소·시기·가격)이 틀리면 안 되기 때문이다.
 *
 * 입력 JSON 형식 — 배열, 항목 하나가 글 하나의 한 언어:
 *   [{ "slug": "...", "locale": "ja", "title": "...", "body": "..." }, ...]
 *
 * body 규칙 (한국어판과 같아야 화면이 같은 모양으로 그려진다):
 *   - 문단은 빈 줄 두 개로 나눈다
 *   - 사진 줄은 `![alt](url)` — **url 은 한국어판과 글자 하나까지 같아야 한다**(같은 파일을 가리킴)
 *   - 인용은 `> ` 로 시작
 *
 * 검증: url 이 한국어판에 없는 것이면 그 글은 넣지 않고 거른다 — 오타로 깨진 이미지가 나가는 것을 막는다.
 *
 * 실행:
 *   node scripts/journal-translate-apply.mjs translations/ja-batch1.json --dry
 *   node scripts/journal-translate-apply.mjs translations/ja-batch1.json
 */

import fs from 'node:fs';
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

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const FILE = args.find((a) => !a.startsWith('--'));

if (!FILE) {
  console.error('사용법: node scripts/journal-translate-apply.mjs <번역.json> [--dry]');
  process.exit(1);
}

const imageUrls = (body) => [...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);

const main = async () => {
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다.');

  const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  console.log(`${FILE} — ${items.length}건${DRY ? ' (드라이런)' : ''}\n`);

  let ok = 0;
  const problems = [];

  for (const it of items) {
    const { slug, locale, title, body } = it;

    if (!slug || !locale || !title?.trim() || !body?.trim()) {
      problems.push(`${slug ?? '?'}/${locale ?? '?'} — 필드 누락`);
      continue;
    }
    if (locale === 'ko') {
      problems.push(`${slug}/ko — 한국어는 원문이라 이 도구로 덮지 않는다`);
      continue;
    }

    const source = await prisma.journalPost.findUnique({
      where: { slug_locale: { slug, locale: 'ko' } },
    });
    if (!source) {
      problems.push(`${slug}/${locale} — 한국어 원문이 없습니다`);
      continue;
    }

    // 사진 주소 대조. 번역하며 URL 이 손상되면 깨진 이미지가 그대로 공개된다.
    const src = new Set(imageUrls(source.body));
    const bad = imageUrls(body).filter((u) => !src.has(u));
    if (bad.length) {
      problems.push(`${slug}/${locale} — 한국어판에 없는 사진 주소 ${bad.length}개: ${bad[0].slice(0, 60)}…`);
      continue;
    }

    if (DRY) {
      console.log(`[dry] ${slug} / ${locale}`);
      console.log(`      ${title}`);
      console.log(`      본문 ${body.length}자 · 사진 ${imageUrls(body).length}장`);
      ok++;
      continue;
    }

    await prisma.journalPost.upsert({
      where: { slug_locale: { slug, locale } },
      update: { title, body },
      create: {
        slug,
        locale,
        category: source.category,
        title,
        body,
        cover: source.cover,
        planCode: source.planCode,
        source: source.source,
        isSample: false,
        // 한국어판과 같은 날짜로 맞춘다 — 같은 촬영의 기록이므로 언어마다 날짜가 다를 이유가 없다.
        publishedAt: source.publishedAt,
      },
    });
    console.log(`  넣음 ${slug} / ${locale} — ${title.slice(0, 40)}`);
    ok++;
  }

  console.log(`\n반영 ${ok}건${problems.length ? ` · 문제 ${problems.length}건` : ''}`);
  for (const p of problems) console.log(`  ⚠️ ${p}`);

  if (!DRY) {
    const counts = await prisma.journalPost.groupBy({ by: ['locale'], _count: true });
    console.log('\nDB 언어별 글 수:', counts.map((c) => `${c.locale} ${c._count}`).join(' · '));
    await prisma.$disconnect();
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
