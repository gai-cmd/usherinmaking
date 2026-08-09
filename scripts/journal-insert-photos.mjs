/**
 * 네이버 취입 때 빠진 사진을 저널 글 본문에 되돌려 넣는다.
 *
 * 왜 필요한가: naver-journal-import 는 글마다 사진을 한두 장만 건져왔다.
 * 본문은 열 장면 넘게 서술하는데 사진이 두 장뿐인 글이 많다.
 * journal-replace-images 는 "있는 자리를 더 좋은 파일로 바꾸는" 도구라
 * 자리 자체를 늘리지 못한다 — 그 빈자리를 채우는 것이 이 스크립트다.
 *
 * 사진과 문단의 짝은 사람이 정한다. 코드가 사진 내용을 읽을 수 없으므로
 * 배치표(JSON)를 받아 그대로 옮긴다.
 *
 * 배치표 형식:
 *   {
 *     "slug": "dress-2016-06-624516",
 *     "dir": "/절대경로/사진폴더",
 *     "alt": { "ko": "...", "ja": "...", "en": "..." },   // "N/총장수" 가 뒤에 붙는다
 *     "inserts": [
 *       { "after": 3, "file": "a.jpeg" },                 // after = 사진을 뺀 본문 문단 번호
 *       { "after": 7, "reuse": "https://...기존주소" }    // 이미 올라간 사진은 자리만 옮긴다
 *     ]
 *   }
 *
 * 본문에 이미 있던 사진 문단은 전부 걷어낸 뒤 배치표대로 다시 깐다.
 * 세 언어의 문단 수가 다르면 배치가 어긋나므로 그 자리에서 멈춘다.
 *
 * 실행:
 *   node scripts/journal-insert-photos.mjs plan.json --dry
 *   node scripts/journal-insert-photos.mjs plan.json
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
const PLAN_PATH = args.find((a) => !a.startsWith('--'));

if (!PLAN_PATH) {
  console.error('사용법: node scripts/journal-insert-photos.mjs <배치표.json> [--dry]');
  process.exit(1);
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

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

const isImagePara = (p) => /^!\[[^\]]*\]\([^)]+\)$/.test(p.trim());

const main = async () => {
  const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다.');

  const rows = await prisma.journalPost.findMany({ where: { slug: plan.slug } });
  if (!rows.length) throw new Error(`글을 찾지 못했습니다: ${plan.slug}`);

  // 사진을 걷어낸 본문 문단. 세 언어가 같은 구조여야 같은 자리에 넣을 수 있다.
  const textParas = {};
  for (const r of rows) {
    textParas[r.locale] = r.body.split(/\n{2,}/).filter((p) => !isImagePara(p));
  }
  const counts = [...new Set(Object.values(textParas).map((a) => a.length))];
  if (counts.length !== 1) {
    console.error('언어별 문단 수가 다릅니다 — 배치가 어긋나므로 멈춥니다.');
    for (const [loc, a] of Object.entries(textParas)) console.error(`  ${loc}: ${a.length}문단`);
    process.exit(1);
  }
  const paraCount = counts[0];

  for (const ins of plan.inserts) {
    if (ins.after < 0 || ins.after >= paraCount) {
      throw new Error(`배치표의 after=${ins.after} 가 문단 범위(0~${paraCount - 1}) 밖입니다.`);
    }
  }

  const total = plan.inserts.length + 1; // 표지 1장을 포함한 총 장수
  console.log(`${plan.slug} — 언어 ${rows.length}개 · 본문 문단 ${paraCount}개`);
  console.log(`표지 1장 + 본문 ${plan.inserts.length}장 = 총 ${total}장${DRY ? '  (드라이런 — 쓰지 않습니다)' : ''}\n`);

  // 파일을 먼저 다 확인한다. 중간에 없는 파일이 나오면 절반만 반영되기 때문이다.
  for (const ins of plan.inserts) {
    if (ins.reuse) continue;
    const full = path.join(plan.dir, ins.file);
    if (!fs.existsSync(full)) throw new Error(`파일이 없습니다: ${full}`);
  }

  const { uploadMedia } = DRY ? { uploadMedia: null } : await import('@/server/media');

  // 배치표 순서대로 주소를 확보한다. 표지는 건드리지 않는다.
  const placed = [];
  for (let i = 0; i < plan.inserts.length; i++) {
    const ins = plan.inserts[i];
    const n = i + 2; // 표지가 1/N 이므로 본문은 2/N 부터
    if (ins.reuse) {
      console.log(`  [${n}/${total}] 문단 ${ins.after} 뒤 ← (기존 사진 자리 이동)`);
      placed.push({ ...ins, url: ins.reuse, n });
      continue;
    }
    const full = path.join(plan.dir, ins.file);
    const { width, height } = dimensions(full);
    if (DRY) {
      console.log(`  [${n}/${total}] 문단 ${ins.after} 뒤 ← ${ins.file} (${width}x${height})`);
      placed.push({ ...ins, url: `DRY://${ins.file}`, n });
      continue;
    }
    const bytes = fs.readFileSync(full);
    const up = await uploadMedia({
      bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      filename: `journal-${plan.slug}-${n}${path.extname(full).toLowerCase()}`,
      mimeType: MIME[path.extname(full).toLowerCase()] ?? 'image/jpeg',
      uploadedBy: 'journal-insert-photos',
      source: 'manual',
    });
    console.log(`  [${n}/${total}] 문단 ${ins.after} 뒤 ← ${ins.file} (${width}x${height}) 업로드 완료`);
    placed.push({ ...ins, url: up.asset.url, n });
  }

  // 문단 사이에 사진을 끼워 넣어 본문을 다시 만든다.
  for (const r of rows) {
    const paras = textParas[r.locale];
    const out = [];
    for (let i = 0; i < paras.length; i++) {
      out.push(paras[i]);
      for (const p of placed.filter((x) => x.after === i)) {
        const alt = `${plan.alt[r.locale] ?? plan.alt.en} ${p.n}/${total}`;
        out.push(`![${alt}](${p.url})`);
      }
    }
    const body = out.join('\n\n');
    if (DRY) {
      const before = (r.body.match(/!\[/g) ?? []).length;
      const after = (body.match(/!\[/g) ?? []).length;
      console.log(`  ${r.locale}: 본문 사진 ${before}장 → ${after}장`);
      continue;
    }
    await prisma.journalPost.update({ where: { id: r.id }, data: { body } });
    console.log(`  ${r.locale}: 본문 갱신 완료`);
  }

  console.log(DRY ? '\n드라이런 종료 — 아무것도 쓰지 않았습니다.' : '\n반영 완료.');
  await prisma.$disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
