/**
 * 브라우저 저장본의 사진 → 갤러리 Photo 등록 (월별 아카이브 채우기).
 *
 * **네이버에 접속하지 않는다.** 저장본만 읽는다.
 * **이미 스토리지에 올라간 파일을 재사용한다** — 저널 취입(naver-backup-import.mjs)이 올린
 * MediaAsset 을 파일 크기로 되찾아 쓰므로 같은 사진을 두 번 올리지 않는다.
 *
 * 분류(term)를 붙이는 근거:
 *   place   — 글 카테고리(studio 면 스튜디오, 그 밖은 로케이션)
 *   session — 글 카테고리(가족·기념일·만삭 등)
 *   mood    — ① 촬영 월(글 날짜) ② 날씨·시간대(본문에 실제로 쓰인 낱말)
 *
 * 날씨는 **본문이 말한 것만** 붙인다. 사진을 보고 판단하지 않는다 —
 * 코드가 사진 내용을 단정하면 없는 사실이 된다(alt 에서 이미 한 번 걸러낸 실수다).
 *
 * 실행:
 *   node scripts/naver-backup-photos.mjs --dry
 *   node scripts/naver-backup-photos.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';
import { parseBackupDir } from './naver-backup-parse.mjs';

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
const BACKUP_DIR = `${process.env.HOME}/Downloads/naver_blog`;

/* ------------------------------------------------------------ 분류 규칙 */

/** 글 카테고리 판정 — 취입 스크립트와 같은 규칙을 쓴다(분류가 어긋나면 안 된다). */
function siteCategory(title) {
  if (/스튜디오|실내촬영|하우스/.test(title)) return 'studio';
  if (/태교|만삭|돌촬영|돌기념|돌스냅|백일|200일|두돌|칠순|환갑|기념여행|기념일|가족스냅|대가족|가족촬영|아기|베이비|여행기록/.test(title))
    return 'anniversary';
  if (/드레스|웨딩룩|의상|소품|부케|한복/.test(title)) return 'dress';
  if (/팁|준비물|가이드|추천|노하우|알아두면|주의|예약|일정|모집|날씨|시간대|비용|가격|문의|이유|필수|방법|체크|정보|계절|시즌/.test(title))
    return 'tips';
  return 'location';
}

/** place 축 — 스튜디오 글만 스튜디오, 나머지는 야외 로케이션이다. */
const placeTerm = (category) => (category === 'studio' ? 'studio' : 'location');

/**
 * session 축 — 무엇을 찍은 촬영인가. 본문·제목에 실제로 쓰인 낱말로만 정한다.
 * 하나도 맞지 않으면 붙이지 않는다(억지로 채우지 않는다).
 */
function sessionTerms(text) {
  const out = [];
  if (/만삭|태교/.test(text)) out.push('maternity');
  if (/가족|대가족|돌|백일|칠순|환갑|아기/.test(text)) out.push('family');
  if (/기념일|결혼기념|주년/.test(text)) out.push('anniversary');
  if (/데이트스냅|커플스냅/.test(text)) out.push('couples');
  // 본식 전 · 리마인드 · 셀프는 2026-08 에 'wedding' 하나로 합쳤다.
  if (/웨딩스냅|본식|채플|전촬영|웨딩촬영|셀프웨딩|리마인드/.test(text)) out.push('wedding');
  return [...new Set(out)];
}

/**
 * mood 축의 날씨·시간대. **본문이 말한 것만.**
 * 오래된 term(sunny/cloudy)과 화면이 쓰는 term(clear-day/cloudy-day)은 뜻이 같으므로 함께 붙인다 —
 * 어느 쪽 주소로 들어와도 같은 사진이 나오게 하기 위해서다.
 */
function weatherTerms(text) {
  const out = [];
  if (/노을|선셋|일몰|석양|sunset/i.test(text)) out.push('sunset');
  if (/우중|비가|빗속|장마|우천/.test(text)) out.push('rain');
  if (/벚꽃|사쿠라/.test(text)) out.push('cherry-blossom');
  if (/흐린|흐림|구름|먹구름/.test(text)) out.push('cloudy-day', 'cloudy');
  if (/맑은|쾌청|화창|햇살|땡볕|폭염/.test(text)) out.push('clear-day', 'sunny');
  return [...new Set(out)];
}

/* ------------------------------------------------------------ alt / story */

const KIND_BY_CATEGORY = {
  studio: '스튜디오 촬영',
  location: '로케이션 촬영',
  dress: '드레스 촬영',
  tips: '촬영 기록',
  anniversary: '기념일 촬영',
};
const KIND_JA = {
  studio: 'スタジオ撮影',
  location: 'ロケーション撮影',
  dress: 'ドレス撮影',
  tips: '撮影の記録',
  anniversary: '記念日の撮影',
};
const KIND_EN = {
  studio: 'studio session',
  location: 'location session',
  dress: 'dress session',
  tips: 'shoot notes',
  anniversary: 'anniversary session',
};

const MONTH_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * 3개 언어 alt. **사진을 보지 않고 쓰므로 아는 것만 쓴다** — 글 제목(작가 본인의 설명),
 * 지역, 촬영 종류, 시기. 사진별 개별 묘사는 관리자 화면에서 사람이 채우는 편이 정확하다.
 */
function buildAlt(post, category, index, total) {
  const text = `${post.titleRaw} ${post.paragraphs.join(' ')}`;
  const ja기 = /미야코지마/.test(text);
  const [y, m] = post.date.split('-');
  const mi = Number(m);
  const nth = total > 1 ? ` ${index + 1}/${total}` : '';
  const head = post.title.length > 36 ? `${post.title.slice(0, 36)}…` : post.title;

  return {
    ko: `${head} — ${ja기 ? '미야코지마' : '오키나와'} ${KIND_BY_CATEGORY[category]}, ${y}년 ${mi}월${nth}`,
    ja: `${head} — ${ja기 ? '宮古島' : '沖縄'}での${KIND_JA[category]}、${y}年${mi}月${nth}`,
    en: `${head} — ${ja기 ? 'Miyakojima' : 'Okinawa'} ${KIND_EN[category]}, ${MONTH_EN[mi - 1]} ${y}${nth}`,
  };
}

/* ------------------------------------------------------------ 실행 */

const main = async () => {
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다.');

  // 이미 올라간 파일을 되찾기 위한 색인. 같은 사진을 두 번 올리지 않는다.
  const assets = await prisma.mediaAsset.findMany({
    where: { uploadedBy: 'naver-backup-import' },
    select: { url: true, size: true, width: true, height: true },
  });
  const bySize = new Map();
  for (const a of assets) if (a.size) bySize.set(a.size, a);
  console.log(`스토리지에 올라간 취입 사진 ${assets.length}장 (크기 색인 ${bySize.size}개)`);

  // 분류 term 은 DB 에 있어야 붙일 수 있다. 없으면 만들지 않고 건너뛴다(스키마를 임의로 늘리지 않는다).
  const terms = await prisma.term.findMany({ select: { id: true, slug: true } });
  const termId = new Map(terms.map((t) => [t.slug, t.id]));
  console.log(`DB 분류 term ${terms.length}개`);

  const posts = parseBackupDir(BACKUP_DIR).filter((p) => p.logNo && p.date && p.images.length);

  let created = 0;
  let skipped = 0;
  let noAsset = 0;
  const missingTerms = new Set();

  for (const p of posts) {
    const category = siteCategory(p.titleRaw);
    const text = `${p.titleRaw} ${p.paragraphs.join(' ')}`;
    const mm = p.date.slice(5, 7);

    const slugs = [
      placeTerm(category),
      ...sessionTerms(text),
      ...weatherTerms(text),
      `month-${mm}`,
    ];

    const ids = [];
    for (const s of slugs) {
      const id = termId.get(s);
      if (id) ids.push(id);
      else missingTerms.add(s);
    }

    for (const [i, img] of p.images.entries()) {
      const size = fs.statSync(img.file).size;
      const asset = bySize.get(size);
      if (!asset) {
        noAsset++;
        continue;
      }

      const exists = await prisma.photo.findFirst({ where: { originalUrl: asset.url } });
      if (exists) {
        skipped++;
        continue;
      }

      const alt = buildAlt(p, category, i, p.images.length);

      if (DRY) {
        if (created < 3) {
          console.log(`\n[dry] ${path.basename(img.file)}`);
          console.log(`   alt.ko : ${alt.ko}`);
          console.log(`   alt.ja : ${alt.ja}`);
          console.log(`   alt.en : ${alt.en}`);
          console.log(`   분류    : ${slugs.join(', ')}`);
        }
        created++;
        continue;
      }

      await prisma.photo.create({
        data: {
          originalUrl: asset.url,
          variants: {},
          width: asset.width ?? img.width,
          height: asset.height ?? img.height,
          takenAt: new Date(`${p.date}T12:00:00+09:00`),
          status: 'PUBLISHED',
          // 장변 2000px 미만이면 관리자 화면이 원본 교체를 유도한다. 저장본은 800px 이라 해당한다.
          lowRes: Math.max(img.width, img.height) < 2000,
          alt,
          terms: { create: ids.map((id) => ({ termId: id })) },
        },
      });
      created++;
    }
  }

  console.log(
    `\n등록 ${created}장 · 이미 있어 건너뜀 ${skipped}장` +
      (noAsset ? ` · 스토리지에서 못 찾음 ${noAsset}장` : ''),
  );
  if (missingTerms.size) {
    console.log(`\n⚠️ DB 에 없는 분류: ${[...missingTerms].join(', ')}`);
    console.log('   (taxonomy 를 DB 에 반영하는 시드가 먼저 돌아야 붙습니다)');
  }
  await prisma.$disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
