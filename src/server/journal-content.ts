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

/**
 * DB 의 본문 문자열을 블록으로 되돌린다. 직렬화 규칙(`server/journal.ts` 의 blocksToText)의 역이다:
 * 빈 줄로 문단을 나누고, `> ` 로 시작하는 문단은 인용으로 읽는다.
 */
function toBlocks(body: string): JournalBlock[] {
  return body
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map<JournalBlock>((t) =>
      t.startsWith('> ') ? { kind: 'quote', text: t.slice(2).trim() } : { kind: 'p', text: t },
    );
}

/** 목록 카드용 발췌. DB 에 발췌 칼럼이 없으므로 첫 문단에서 만든다. */
function toExcerpt(blocks: JournalBlock[]): string {
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

function fromDb(row: Row): JournalContentPost | null {
  // 로케일·카테고리가 화면이 아는 값이 아니면 그리지 않는다 — 지어내는 것보다 빼는 편이 안전하다.
  if (!isLocale(row.locale) || !isCategory(row.category)) return null;
  if (!row.title.trim() || !row.body.trim()) return null;

  const blocks = toBlocks(row.body);
  return {
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
    ...(row.isSample ? { isSample: true as const } : {}),
  };
}

/**
 * 공개 화면이 부르는 유일한 진입점. DB 에 글이 한 건이라도 있으면 DB 가 이기고,
 * 없거나 DB 가 없으면 코드 시드가 그대로 나간다(빈 화면을 만들지 않는다).
 * 조회가 실패해도 공개 페이지를 죽이지 않는다 — 폴백으로 계속 나간다.
 */
export async function getJournalContentPosts(): Promise<JournalContentPost[]> {
  if (!isDatabaseConfigured()) return JOURNAL_POSTS;
  try {
    const rows = await prisma.journalPost.findMany({ orderBy: { publishedAt: 'desc' } });
    if (rows.length === 0) return JOURNAL_POSTS;
    const posts = rows.map((r) => fromDb(r as Row)).filter((p): p is JournalContentPost => p !== null);
    return posts.length > 0 ? posts : JOURNAL_POSTS;
  } catch (err) {
    console.error('[journal-content] 조회 실패 — 시드로 렌더합니다', err);
    return JOURNAL_POSTS;
  }
}
