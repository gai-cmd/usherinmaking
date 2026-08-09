/**
 * 이미 취입된 저널 글에서 **독립된 꼬리말 문단**만 걷어낸다.
 *
 * 꼬리말 제거가 없던 시절의 취입분(초기 네이버 취입 4건)에는 연락처·자사 URL·저작권 표시가
 * 문단 하나로 통째 남아 있다. 이 도구는 그것만 지운다.
 *
 * **본문에 섞인 홍보 문장은 건드리지 않는다.** 긴 문단 안에 "홈피로 문의주세요"가 섞인 경우가 있는데
 * (예: 1,928자짜리 문단), 그런 문단을 지우면 본문이 통째로 사라진다. 문장 단위로 도려내는 것도
 * 하지 않는다 — 어디까지가 홍보이고 어디부터가 내용인지 코드가 판단할 수 없기 때문이다.
 * 그런 글은 목록으로 뽑아 사람에게 넘긴다.
 *
 * 실행:
 *   node scripts/journal-strip-boilerplate.mjs --dry   무엇을 지울지만 출력
 *   node scripts/journal-strip-boilerplate.mjs
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

/** 문단 전체가 이것뿐일 때만 지운다. 길이 상한이 안전장치다. */
const STANDALONE_BOILERPLATE = [
  /^\(C\)\s*\d{4}\.?\s*usherinmaking\.?\s*All\s*Rights\s*Reserved\.?$/i,
  /^https?:\/\/(?:www\.)?usherinmaking\.com\/?\S*$/i,
  /^www\.usherinmaking\.com\/?\S*$/i,
  /^카톡\s*아이디\s*\S+(로\s*문의주세요~?)?$/,
  /^\(?예약\s*가능\s*시간[^)]*\)?$/,
  /^홈페이지\s*Q&A\s*게시판으로$/,

  /* ---- 외부 유도 (번역 전 정리) ----
   *
   * 네이버·인스타로 나가는 링크와 "더 많은 사진은 클릭↓↓↓" 유도 문구.
   * 우리 사이트에서 원문 플랫폼으로 권위를 흘려보내는 링크이고, 번역본에 그대로 실리면
   * 누를 곳 없는 문장이 3개 언어에 복제된다. 문단 전체가 이것일 때만 버린다.
   */
  /^https?:\/\/\S*(?:instagram\.com|blog\.naver\.com|naver\.me)\S*$/i,
  // "더 많은 사진은 클릭↓↓↓" 계열. 앞에 수식어(예: "우중전")가 붙는 경우가 있어
  // 문장 어디서 시작하든 '…사진은 … 클릭 + 화살표'로 끝나면 유도 문구로 본다.
  // 뒤에 다른 내용이 이어지면 `$` 때문에 매칭되지 않으므로 본문은 안전하다.
  /^\S*\s*(?:보다\s*)?(?:더\s*)?많은\s*사진은\s*(?:아래\s*)?클릭\s*[!~.↓↙▼\s]*$/,
  /^(?:더\s*많은\s*사진은\s*)?아래\s*클릭\s*[!~.↓↙▼\s]*$/,
  /^[↓↙▼\s]+$/,

  /* 링크는 이미 지웠는데 유도 문구만 남은 경우. 가리킬 곳이 없으니 문장으로서 뜻이 없다.
   * 번역본에도 그대로 복제되므로 3개 언어를 함께 잡는다. 화살표로 끝나는 형태만 지운다 —
   * 화살표가 없으면 본문 문장일 수 있다. */
  // 조사가 붙는 형태가 제각각이다("링크 클릭", "릴스로 확인하세여") — 조사를 넓게 받는다.
  /^.{0,40}(?:링크|릴스|영상|여기)\s*(?:로|를|에서)?\s*(?:클릭|확인|보기)\S*\s*[!~.↓↙▼\s]*$/,
  /^.{0,60}(?:click|check|see)\s+(?:the\s+)?(?:link|reel|video)?\s*(?:below|here)?\s*[!~.↓↙▼\s]*$/i,
  /^.{0,60}(?:リンク|リール|動画)\s*を?\s*(?:クリック|チェック|ご覧)\S*\s*[!~.↓↙▼\s]*$/,
  /^(?:촬영구성\s*)?견적은\s*(?:아래\s*)?(?:링크\s*에?|공지\s*확인)\s*[.~!]*$/,
];

/**
 * URL 만 남은 문단도 버린다 — 위 목록에 없는 도메인이라도 홈페이지 본문에 벌거벗은
 * 링크 한 줄이 남아 있을 이유가 없다. (우리가 넣은 출처 문구는 `>` 로 시작하므로 걸리지 않는다.)
 */
const BARE_URL_ONLY = /^https?:\/\/\S+$/i;

/** 문장 끝에 매달린 해시태그 꼬리. **문장은 남기고 꼬리만** 자른다. */
const TRAILING_HASHTAGS = /(?:\s*#[^\s#]+)+\s*$/;

const MAX_LEN = 120;

/** 출처 문구는 우리가 넣은 것이다 — 절대 지우지 않는다. */
const isOurSourceNote = (t) => t.startsWith('> 이 글은') || t.startsWith('*네이버 블로그에 남긴');

function cleanBody(body) {
  const paras = body.split('\n\n');
  const kept = [];
  const removed = [];
  const trimmed = [];

  for (const raw of paras) {
    const t = raw.trim();
    if (!t) continue;

    // 우리가 넣은 출처 문구와 사진 줄은 손대지 않는다.
    if (isOurSourceNote(t) || t.startsWith('![')) {
      kept.push(t);
      continue;
    }

    if (BARE_URL_ONLY.test(t) || (t.length <= MAX_LEN && STANDALONE_BOILERPLATE.some((re) => re.test(t)))) {
      removed.push(t);
      continue;
    }

    // 문장 끝 해시태그 꼬리만 잘라낸다. 자르고 나서 아무것도 안 남으면 문단째 버린다.
    const cut = t.replace(TRAILING_HASHTAGS, '').trim();
    if (cut !== t) {
      if (!cut) {
        removed.push(t);
        continue;
      }
      trimmed.push({ before: t, after: cut });
      kept.push(cut);
      continue;
    }

    kept.push(t);
  }
  return { body: kept.join('\n\n'), removed, trimmed };
}

/** 본문에 섞여 코드가 손댈 수 없는 홍보 문장. 사람이 볼 목록으로만 뽑는다. */
const EMBEDDED_SIGNAL = /카톡\s*아이디|홈피|All Rights Reserved|www\.usherinmaking\.com/i;

const main = async () => {
  const { prisma, isDatabaseConfigured } = await import('@/server/db');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL 이 없습니다.');

  const rows = await prisma.journalPost.findMany({ where: { source: 'naver-blog' } });
  console.log(`대상 ${rows.length}건${DRY ? ' (드라이런 — 쓰지 않습니다)' : ''}\n`);

  let changed = 0;
  let removedCount = 0;
  const needsHuman = [];

  for (const r of rows) {
    const { body, removed, trimmed } = cleanBody(r.body);

    if (removed.length || trimmed.length) {
      console.log(`[${r.slug}]`);
      for (const t of removed) console.log(`   ✂ 삭제: ${t.replace(/\n/g, ' ').slice(0, 90)}`);
      for (const { before, after } of trimmed) {
        console.log(`   ✎ 꼬리: …${before.slice(-60).replace(/\n/g, ' ')}`);
        console.log(`        → …${after.slice(-40).replace(/\n/g, ' ')}`);
      }
      if (!DRY) {
        await prisma.journalPost.update({ where: { id: r.id }, data: { body } });
      }
      changed++;
      removedCount += removed.length;
    }

    // 남은 본문에 홍보 문장이 섞여 있으면(우리가 넣은 출처 줄 제외) 사람 확인 목록에 올린다.
    const rest = body
      .split('\n\n')
      .filter((t) => !isOurSourceNote(t))
      .filter((t) => EMBEDDED_SIGNAL.test(t));
    if (rest.length) needsHuman.push({ slug: r.slug, paras: rest });
  }

  console.log(`\n정리 ${changed}건 · 제거 문단 ${removedCount}개`);

  if (needsHuman.length) {
    console.log(`\n── 사람 확인 필요 ${needsHuman.length}건 ──`);
    console.log('본문 문단 안에 홍보 문장이 섞여 있습니다. 통째로 지우면 내용이 사라지므로');
    console.log('관리자 화면에서 해당 문장만 직접 다듬어 주세요.\n');
    for (const { slug, paras } of needsHuman) {
      console.log(`  ${slug}`);
      for (const t of paras) console.log(`     ${t.length}자: ${t.replace(/\n/g, ' ').slice(0, 110)}…`);
    }
  }

  await prisma.$disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
