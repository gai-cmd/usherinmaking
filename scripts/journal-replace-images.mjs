/**
 * 사장님이 직접 가져온 **원본 사진**으로 저널·갤러리 이미지를 교체한다.
 *
 * 왜 필요한가: 네이버 저장본은 800px 로 줄어든 사본이라 표지에서 확대되면 뭉개진다.
 * 네이버에서 원본을 다시 긁는 것은 약관이 금지한 자동 수집이므로, 촬영 원본을 직접 넣는다.
 *
 * **폴더만 주면 된다.** 글마다 사진을 골라 넣을 필요가 없다 —
 * 파일명·촬영일(EXIF)·기존 순서로 짝을 찾고, 확신이 서지 않는 것은 건드리지 않고 보고한다.
 *
 * 짝짓는 순서 (앞의 것이 맞으면 뒤는 보지 않는다):
 *   ① 파일명에 네이버 글번호가 들어 있다        예) 224359035554-1.jpg
 *   ② 폴더 이름이 글번호다                      예) 224359035554/IMG_0001.jpg
 *   ③ 파일 EXIF 촬영일이 글 날짜와 같은 달이다  (하루 이틀 차이는 흔하다)
 *
 * ①②는 순서까지 확실하므로 바로 교체하고, ③은 후보만 제시한다 —
 * 같은 달 사진이 여러 장이면 어느 것이 몇 번째 사진인지 코드가 알 수 없기 때문이다.
 *
 * 실행:
 *   node scripts/journal-replace-images.mjs ~/Pictures/usherin-originals --dry
 *   node scripts/journal-replace-images.mjs ~/Pictures/usherin-originals
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
const DIR = args.find((a) => !a.startsWith('--'));

if (!DIR) {
  console.error('사용법: node scripts/journal-replace-images.mjs <원본폴더> [--dry]');
  process.exit(1);
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** 폴더를 재귀로 훑어 이미지 파일만 모은다. */
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (IMAGE_EXT.has(path.extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

function dimensions(file) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return {
      width: Number(out.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0),
      height: Number(out.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0),
    };
  } catch {
    return { width: 0, height: 0 };
  }
}

/** EXIF 촬영일. 없으면 파일 수정일로 떨어진다(원본을 복사해 오면 수정일이 바뀌므로 참고용). */
function shotDate(file) {
  try {
    const out = execFileSync('mdls', ['-name', 'kMDItemContentCreationDate', '-raw', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out && out !== '(null)') return out.slice(0, 10);
  } catch {
    /* mdls 가 없거나 색인되지 않은 파일 */
  }
  return null;
}

/** 파일 경로 어디엔가 든 네이버 글번호(9자리 이상). 폴더명·파일명 모두 본다. */
const logNoIn = (p) => p.match(/(\d{9,})/)?.[1] ?? null;

const main = async () => {
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다.');

  const files = walk(path.resolve(DIR.replace('~', process.env.HOME)));
  console.log(`원본 폴더에서 이미지 ${files.length}장 발견${DRY ? ' (드라이런 — 쓰지 않습니다)' : ''}\n`);

  const posts = await prisma.journalPost.findMany({
    where: { source: 'naver-blog', locale: 'ko' },
    orderBy: { publishedAt: 'asc' },
  });

  // 글 → 네이버 글번호. 본문 끝 출처 줄에 들어 있다.
  const byLogNo = new Map();
  for (const p of posts) {
    const n = p.body.match(/blog\.naver\.com\/usherinmaking\/(\d+)/)?.[1];
    if (n) byLogNo.set(n, p);
  }

  // ①② 글번호로 확실히 짝지어지는 것
  const matched = new Map(); // logNo -> 파일 목록(이름 순)
  const leftover = [];
  for (const f of files) {
    const n = logNoIn(f);
    if (n && byLogNo.has(n)) {
      const arr = matched.get(n) ?? [];
      arr.push(f);
      matched.set(n, arr);
    } else leftover.push(f);
  }
  for (const arr of matched.values()) arr.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  console.log(`글번호로 확정된 글 ${matched.size}건 · 사진 ${[...matched.values()].flat().length}장`);
  console.log(`짝을 못 찾은 사진 ${leftover.length}장\n`);

  // ③ 남은 것은 촬영월로 후보만 제시한다 — 순서를 코드가 정할 수 없어 교체하지 않는다.
  if (leftover.length) {
    const byMonth = new Map();
    for (const f of leftover) {
      const d = shotDate(f);
      if (!d) continue;
      const m = d.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
    }
    if (byMonth.size) {
      console.log('── 촬영월로만 짐작되는 사진 (교체하지 않음, 참고용) ──');
      for (const [m, c] of [...byMonth].sort()) {
        const cands = posts.filter((p) => p.publishedAt?.toISOString().slice(0, 7) === m);
        console.log(`  ${m}: 사진 ${c}장 → 같은 달 글 ${cands.length}건 ${cands.map((p) => p.slug).join(', ') || '(없음)'}`);
      }
      console.log('  → 파일명이나 폴더명에 글번호를 넣어 주시면 자동으로 교체됩니다.\n');
    }
  }

  if (matched.size === 0) {
    console.log('교체할 것이 없습니다. 파일명 또는 폴더명에 네이버 글번호를 넣어 주세요.');
    console.log('예) 224359035554/IMG_0001.jpg  또는  224359035554-1.jpg');
    await prisma.$disconnect();
    return;
  }

  const { uploadMedia } = DRY ? { uploadMedia: null } : await import('@/server/media');
  let replaced = 0;
  let skipped = 0;

  for (const [logNo, list] of matched) {
    const post = byLogNo.get(logNo);
    // 본문에 실린 사진 주소를 순서대로 뽑는다. 표지는 그중 첫 장이다.
    const urls = [...post.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
    const slots = [post.cover, ...urls];

    if (list.length < slots.length) {
      console.log(`  ${post.slug} — 사진 ${list.length}장 / 자리 ${slots.length}개 · 있는 만큼만 교체`);
    }

    for (let i = 0; i < Math.min(list.length, slots.length); i++) {
      const file = list[i];
      const { width, height } = dimensions(file);
      // 저장본(800px)보다 크지 않으면 교체할 이유가 없다.
      if (Math.max(width, height) <= 800) {
        skipped++;
        continue;
      }

      if (DRY) {
        console.log(`  [dry] ${post.slug} #${i} ← ${path.basename(file)} (${width}x${height})`);
        replaced++;
        continue;
      }

      const bytes = fs.readFileSync(file);
      const up = await uploadMedia({
        bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        filename: `original-${logNo}-${i + 1}${path.extname(file).toLowerCase()}`,
        mimeType: MIME[path.extname(file).toLowerCase()] ?? 'image/jpeg',
        uploadedBy: 'journal-replace-images',
        source: 'manual',
      });

      const oldUrl = slots[i];
      // 모든 언어의 본문과 표지에서 옛 주소를 새 주소로 바꾼다 — 번역본도 같은 파일을 가리킨다.
      const rows = await prisma.journalPost.findMany({ where: { slug: post.slug } });
      for (const r of rows) {
        await prisma.journalPost.update({
          where: { id: r.id },
          data: {
            body: r.body.split(oldUrl).join(up.asset.url),
            cover: r.cover === oldUrl ? up.asset.url : r.cover,
          },
        });
      }
      // 갤러리 쪽 사진도 같은 파일을 보게 한다.
      await prisma.photo.updateMany({
        where: { originalUrl: oldUrl },
        data: { originalUrl: up.asset.url, width, height, lowRes: Math.max(width, height) < 2000 },
      });

      console.log(`  교체 ${post.slug} #${i} ← ${path.basename(file)} (${width}x${height})`);
      replaced++;
    }
  }

  console.log(`\n교체 ${replaced}장${skipped ? ` · 건너뜀 ${skipped}장(저장본보다 크지 않음)` : ''}`);
  if (!DRY) {
    console.log('\n표지 폭 상한이 800px 로 낮춰져 있습니다. 원본이 충분히 크면');
    console.log('src/app/[locale]/journal/[slug]/page.module.css 의 .cover max-width 를 되돌리세요.');
  }
  await prisma.$disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
