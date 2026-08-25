import { isDatabaseConfigured, prisma } from '@/server/db';
import { LOCALES, type Locale } from '@/lib/i18n';
import {
  JOURNAL_POSTS,
  type JournalBlock,
  type JournalCategory,
  type JournalPost,
} from '@/content/journal';

/**
 * 공개 저널 화면이 읽는 글 목록. **DB 우선 · 시드 폴백.**
 *
 * 이 모듈이 없던 동안 공개 목록·상세는 `@/content/journal` 의 코드 시드만 봤다.
 * 관리자와 네이버 취입은 DB(JournalPost)에 쓰는데 화면은 그걸 읽지 않아,
 * "저장은 되는데 사이트는 그대로"인 닫힌 고리였다 — 이미지 슬롯·작품 그리드와 같은 계열의 누락이다.
 *
 * DB 행은 화면 타입보다 정보가 적다(본문이 한 덩이 문자열이고, 표지 alt·발췌가 없다).
 * 아래 해석기가 그 차이를 메운다. 되돌릴 수 없는 것은 시드 전용 기능인 2컷 비교(`pair`) 블록뿐이며,
 * 취입 글은 이 블록을 쓰지 않는다.
 */

/** 화면 타입과 같은 모양 (content/journal.ts 의 JournalPost). */
export type JournalContentPost = JournalPost;

const CATEGORIES: JournalCategory[] = ['studio', 'location', 'dress', 'tips', 'anniversary'];
const isCategory = (v: string): v is JournalCategory => (CATEGORIES as string[]).includes(v);
const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

/** 사진 한 장 블록의 직렬화 형태 — `![alt](src)` 한 줄. 마크다운 이미지 문법 그대로다. */
const FIGURE_LINE = /^!\[([^\]]*)\]\((\S+)\)$/;

/**
 * 곁말 블록 — 문단 전체가 `*…*` 로 감싸인 것. 취입 글 첫 줄의 출처 표시가 이 모양이다.
 * 양끝 별표를 떼어 화면에 노출되지 않게 한다(별표가 그대로 찍히던 것을 고친 자리다).
 * 원문에 `***강조***` 처럼 여러 겹으로 쓰인 경우가 있어 별표는 몇 개든 벗긴다.
 */
const NOTE_LINE = /^\*+([^*][\s\S]*?[^*])\*+$/;

/** 질문–답 블록 — `Q: …` 줄 다음에 `A: …`. 답은 여러 줄이어도 된다(같은 문단 안에서). */
const FAQ_BLOCK = /^Q:\s*(.+)\nA:\s*([\s\S]+)$/;

/**
 * DB 의 본문 문자열을 블록으로 되돌린다. 직렬화 규칙(`server/journal.ts` 의 blocksToText)의 역이다:
 * 빈 줄로 문단을 나누고, `> ` 로 시작하면 인용, `![alt](src)` 한 줄이면 사진으로 읽는다.
 *
 * 사진을 별도 칼럼이 아니라 본문 문자열 안에 두는 이유: 사진이 문단 사이 **어디에** 놓였는지가
 * 글의 흐름이기 때문이다. 배열을 따로 두면 순서를 잃는다.
 */
function toBlocks(body: string): JournalBlock[] {
  return body
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map<JournalBlock>((t) => {
      const fig = t.match(FIGURE_LINE);
      if (fig) return { kind: 'figure', image: { src: fig[2], alt: fig[1] } };
      if (t.startsWith('> ')) return { kind: 'quote', text: t.slice(2).trim() };
      const faq = t.match(FAQ_BLOCK);
      if (faq) return { kind: 'faq', q: faq[1].trim(), a: faq[2].trim() };
      const note = t.match(NOTE_LINE);
      if (note) return { kind: 'note', text: note[1].trim() };
      return { kind: 'p', text: t };
    });
}

/** 목록 카드용 발췌. DB 에 발췌 칼럼이 없으므로 첫 문단에서 만든다. */
function toExcerpt(blocks: JournalBlock[]): string {
  // 사진 블록은 발췌가 될 수 없다 — 글머리가 사진인 취입 글에서 발췌가 비는 것을 막는다.
  const first = blocks.find((b) => b.kind === 'p' || b.kind === 'quote');
  const text = first && 'text' in first ? first.text : '';
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

type Row = {
  slug: string;
  locale: string;
  category: string;
  title: string;
  body: string;
  cover: string;
  planCode: string | null;
  isSample: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
};

/** DB 는 시각을 들고 있고 화면은 문자열을 쓴다. 사이트 기준(JST) 날짜로 자른다. */
function toDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * "얇은 글" 판정 — noindex 대상은 **정말 비어 있는 글뿐**이다.
 *
 * 처음에는 SEO 문서의 400자를 그대로 썼는데, 그 기준이면 취입분 대부분이 색인에서
 * 빠져 "검색되라고 가져온 콘텐츠가 검색이 안 되는" 자기모순이 된다(사용자 지적).
 * 이 블로그 글의 실체는 사진이다 — 사진이 여럿이면 그 페이지의 콘텐츠는 사진이고,
 * 고유 이미지 + 고유 제목 + 날짜 + 구조화 데이터가 있으면 얇은 페이지가 아니다.
 * 검색 평가를 깎는 것은 "아무것도 없는 페이지"이지 "글자가 적은 사진 글"이 아니다.
 *
 * 따라서 글자도 거의 없고(200자 미만) 사진도 몇 장 없는(3장 미만) 글만 얇다고 본다.
 * 그 글들만 noindex + 사이트맵 제외되고, 나머지는 전부 색인·사이트맵에 실린다.
 */
const THIN_BODY_CHARS = 200;
const THIN_MIN_IMAGES = 3;

function bodyChars(blocks: JournalBlock[]): number {
  return blocks.reduce((n, b) => {
    if (b.kind === 'p' || b.kind === 'quote') return n + b.text.length;
    if (b.kind === 'faq') return n + b.q.length + b.a.length;
    return n;
  }, 0);
}

function imageCount(blocks: JournalBlock[]): number {
  return blocks.filter((b) => b.kind === 'figure' || b.kind === 'pair').length;
}

function fromDb(row: Row): JournalContentPost | null {
  // 로케일·카테고리가 화면이 아는 값이 아니면 그리지 않는다 — 지어내는 것보다 빼는 편이 안전하다.
  if (!isLocale(row.locale) || !isCategory(row.category)) return null;
  if (!row.title.trim() || !row.body.trim()) return null;

  const blocks = toBlocks(row.body);
  const thin = bodyChars(blocks) < THIN_BODY_CHARS && imageCount(blocks) < THIN_MIN_IMAGES;
  return {
    ...(thin ? { thin: true } : {}),
    slug: row.slug,
    locale: row.locale,
    category: row.category,
    title: row.title,
    excerpt: toExcerpt(blocks),
    body: blocks,
    // DB 에 표지 alt 칼럼이 없다. 제목을 그대로 쓴다 — 그 글이 쓰인 언어라 규칙에 맞는다.
    cover: { src: row.cover, alt: row.title },
    planCode: row.planCode ?? '',
    publishedAt: row.publishedAt ? toDateString(row.publishedAt) : '',
    updatedAt: toDateString(row.updatedAt),
    ...(row.isSample ? { isSample: true as const } : {}),
  };
}

/**
 * 공개 화면이 부르는 유일한 진입점. DB 에 글이 한 건이라도 있으면 DB 가 이기고,
 * 없거나 DB 가 없으면 코드 시드가 그대로 나간다(빈 화면을 만들지 않는다).
 * 조회가 실패해도 공개 페이지를 죽이지 않는다 — 폴백으로 계속 나간다.
 */
/**
 * 조회 결과를 잠깐 들고 있는다.
 *
 * 저널도 정적 생성이라 글 하나를 그릴 때마다 이 함수를 부르는데, 그때마다 본문(body)까지
 * 담긴 67행을 통째로 내려받는다. 사진 쪽과 같은 이유로 Neon 데이터 전송 쿼터를 먹는다
 * (2026-08-10 빌드 로그의 53000 오류). 빌드 동안은 한 번만 읽고 나눠 쓴다.
 */
const CACHE_TTL_MS = 60_000;
/**
 * 실패했을 때의 유예. DB 가 죽어 있으면 정적 생성 페이지 수백 개가 저마다 접속을 시도한다
 * (2026-08-10 빌드에서 546회). 짧게 쉬었다 다시 본다 — 회복은 여전히 몇 초 안에 반영된다.
 */
const FAIL_TTL_MS = 5_000;
let failedAt = 0;
let cache: { at: number; data: JournalContentPost[] } | null = null;

/** 글을 바꾼 직후 같은 프로세스에서 다시 읽어야 할 때 쓴다. */
export function forgetJournalContentPosts(): void {
  cache = null;
}

export async function getJournalContentPosts(): Promise<JournalContentPost[]> {
  if (!isDatabaseConfigured()) return JOURNAL_POSTS;
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (failedAt && Date.now() - failedAt < FAIL_TTL_MS) return JOURNAL_POSTS;
  try {
    const rows = await prisma.journalPost.findMany({ orderBy: { publishedAt: 'desc' } });
    if (rows.length === 0) return JOURNAL_POSTS;
    const posts = rows.map((r) => fromDb(r as Row)).filter((p): p is JournalContentPost => p !== null);
    const result = posts.length > 0 ? posts : JOURNAL_POSTS;
    cache = { at: Date.now(), data: result };
    return result;
  } catch (err) {
    // 실패는 캐시하지 않는다 — DB 가 돌아오면 다음 호출이 바로 성공해야 한다.
    failedAt = Date.now();
    console.error('[journal-content] 조회 실패 — 시드로 렌더합니다', err);
    return JOURNAL_POSTS;
  }
}
