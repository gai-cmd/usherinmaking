import { logAdminAction } from '@/server/activity';
import { isDatabaseConfigured, prisma } from '@/server/db';
import { NotFoundError, NotImplementedError } from '@/server/errors';
import { LOCALES, type Locale } from '@/lib/i18n';
import {
  CATEGORY_LABEL,
  JOURNAL_POSTS,
  type JournalCategory,
  type JournalPost as ContentPost,
} from '@/content/journal';

/**
 * 촬영후기 리포지터리.
 *
 * 읽기는 공개 페이지와 같은 원본(@/content/journal)을 쓴다 — 시드를 두 벌 두면
 * 관리자 화면과 공개 페이지가 서로 다른 글을 보여 주게 된다.
 * 필드 이름은 prisma/schema.prisma 의 JournalPost 에 맞춰 여기서 변환한다.
 *
 * 언어별로 독립된 본문이므로 한 글(slug)이 로케일 수만큼의 레코드로 존재한다
 * (@@unique([slug, locale])). 번역 테이블이 따로 없는 것도 같은 이유다.
 *
 * 읽기는 DB 우선 · 시드 폴백이다. DB에 글이 한 건이라도 있으면 DB가 이긴다.
 */

export type JournalSource = 'naver-blog' | 'manual';
export type { JournalCategory };

/** prisma JournalPost 와 같은 모양으로 정규화한 레코드 */
export type JournalPost = {
  id: string;
  slug: string;
  locale: Locale;
  category: JournalCategory;
  title: string;
  body: string;
  cover: string;
  planCode: string | null;
  /**
   * 네이버에서 가져온 글인지 직접 쓴 글인지.
   * @/content/journal 에는 이 필드가 없어서 지금은 전부 null 이다.
   * 수집 seam 이 붙으면 그때 기록된다 — 임의로 '네이버'라고 적지 않는다.
   */
  source: JournalSource | null;
  /** 시안의 글은 전부 샘플이다. 실제 원고로 교체되기 전까지 배지로 표시한다. */
  isSample: boolean;
  publishedAt: Date | null;
  /** 화면 표기에 쓰는 원본 문자열 ('2026-07' 또는 '2026-07-18') */
  publishedAtRaw: string | null;
};

export const JOURNAL_CATEGORIES: JournalCategory[] = [
  'studio',
  'location',
  'dress',
  'tips',
  'anniversary',
];

/** 관리자 UI 는 한국어이므로 카테고리도 한국어 라벨로 보여 준다. */
export const JOURNAL_CATEGORY_LABEL: Record<JournalCategory, string> = {
  studio: CATEGORY_LABEL.studio.ko,
  location: CATEGORY_LABEL.location.ko,
  dress: CATEGORY_LABEL.dress.ko,
  tips: CATEGORY_LABEL.tips.ko,
  anniversary: CATEGORY_LABEL.anniversary.ko,
};

/* -------------------------------------------------------------- 변환 */

/** 'YYYY-MM' 은 그 달 1일로 본다. 타임존은 사이트 기준인 JST. */
function toDate(publishedAt: string): Date {
  const full = publishedAt.length === 7 ? `${publishedAt}-01` : publishedAt;
  return new Date(`${full}T00:00:00+09:00`);
}

/** 본문 블록을 편집기용 평문으로 편다. 이미지 블록은 캡션만 남는다. */
function blocksToText(post: ContentPost): string {
  return post.body
    .map((b) => {
      if (b.kind === 'p') return b.text;
      if (b.kind === 'quote') return `> ${b.text}`;
      return b.caption;
    })
    .filter((t) => t.trim().length > 0)
    .join('\n\n');
}

function normalize(post: ContentPost): JournalPost {
  return {
    id: `${post.slug}:${post.locale}`,
    slug: post.slug,
    locale: post.locale,
    category: post.category,
    title: post.title,
    body: blocksToText(post),
    cover: post.cover.src,
    planCode: post.planCode || null,
    source: null,
    isSample: post.isSample === true,
    publishedAt: post.publishedAt ? toDate(post.publishedAt) : null,
    publishedAtRaw: post.publishedAt || null,
  };
}

// JOURNAL_POSTS 는 slug + locale 한 행씩의 평면 배열이다 (Prisma @@unique([slug, locale]) 와 같은 모양).
// 로케일별 정렬은 여기서 신경 쓰지 않는다 — 아래에서 곧바로 slug 로 묶고 다시 정렬한다.
function seedRows(): JournalPost[] {
  return JOURNAL_POSTS.map(normalize);
}

type DbPost = {
  id: string;
  slug: string;
  locale: string;
  category: string;
  title: string;
  body: string;
  cover: string;
  planCode: string | null;
  source: string | null;
  isSample: boolean;
  publishedAt: Date | null;
};

/** 화면 표기용 날짜 문자열. DB 는 시각을 들고 있으므로 사이트 기준(JST) 날짜로 자른다. */
function toRawDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function fromDb(row: DbPost): JournalPost {
  return {
    id: row.id,
    slug: row.slug,
    locale: row.locale as Locale,
    category: row.category as JournalCategory,
    title: row.title,
    body: row.body,
    cover: row.cover,
    planCode: row.planCode,
    source: (row.source as JournalSource | null) ?? null,
    isSample: row.isSample,
    publishedAt: row.publishedAt,
    publishedAtRaw: row.publishedAt ? toRawDate(row.publishedAt) : null,
  };
}

/** 모든 레코드. DB에 한 건이라도 있으면 DB가 원본이다. */
async function allRows(): Promise<JournalPost[]> {
  if (isDatabaseConfigured()) {
    const rows = await prisma.journalPost.findMany({ orderBy: { publishedAt: 'desc' } });
    if (rows.length > 0) return rows.map((r) => fromDb(r as DbPost));
  }
  return seedRows();
}

/* -------------------------------------------------------------- 읽기 */

export type JournalStatus = 'published' | 'draft';

export function statusOf(post: JournalPost): JournalStatus {
  return post.publishedAt ? 'published' : 'draft';
}

export type ListJournalOptions = {
  status?: JournalStatus;
  locale?: Locale;
  category?: JournalCategory;
  source?: JournalSource;
  /** 3개 언어가 다 차지 않은 글만 */
  untranslatedOnly?: boolean;
  sampleOnly?: boolean;
};

/** 같은 slug 를 가진 로케일 묶음 — 관리자는 이 단위로 본다 */
export type JournalGroup = {
  slug: string;
  category: JournalCategory;
  planCode: string | null;
  isSample: boolean;
  sources: JournalSource[];
  posts: Partial<Record<Locale, JournalPost>>;
  /** 본문이 아직 없는 언어. 이 화면의 존재 이유다. */
  missingLocales: Locale[];
  filledLocales: Locale[];
  status: JournalStatus;
  publishedAtRaw: string | null;
};

const ALL: Locale[] = [...LOCALES];

function toGroups(rows: JournalPost[]): JournalGroup[] {
  const bySlug = new Map<string, JournalPost[]>();
  for (const p of rows) {
    const arr = bySlug.get(p.slug) ?? [];
    arr.push(p);
    bySlug.set(p.slug, arr);
  }

  return [...bySlug.entries()].map(([slug, group]) => {
    const byLocale: Partial<Record<Locale, JournalPost>> = {};
    for (const r of group) byLocale[r.locale] = r;

    const head = group[0];
    // 제목이 비어 있으면 레코드가 있어도 "아직 없음"으로 센다.
    const filled = ALL.filter((l) => byLocale[l] && byLocale[l]!.title.trim().length > 0);

    return {
      slug,
      category: head.category,
      planCode: head.planCode,
      isSample: group.some((r) => r.isSample),
      sources: [...new Set(group.map((r) => r.source).filter((s): s is JournalSource => !!s))],
      posts: byLocale,
      missingLocales: ALL.filter((l) => !filled.includes(l)),
      filledLocales: filled,
      status: group.some((r) => r.publishedAt) ? 'published' : 'draft',
      publishedAtRaw: head.publishedAtRaw,
    };
  });
}

/** 로케일 단위 목록 */
export async function listJournalPosts(opts: ListJournalOptions = {}): Promise<JournalPost[]> {
  // 필터는 메모리에서 건다. 관리자 목록은 전체를 언어 묶음으로 재구성해야 해서
  // 어차피 전량을 읽고, 글 수가 WHERE 절을 나눌 만큼 많지 않다.
  let rows = await allRows();
  if (opts.status) rows = rows.filter((r) => statusOf(r) === opts.status);
  if (opts.locale) rows = rows.filter((r) => r.locale === opts.locale);
  if (opts.category) rows = rows.filter((r) => r.category === opts.category);
  if (opts.source) rows = rows.filter((r) => r.source === opts.source);
  if (opts.sampleOnly) rows = rows.filter((r) => r.isSample);
  return rows.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
}

/** 관리자 목록은 언어 묶음 단위 — 어느 언어가 비었는지가 핵심 정보이기 때문이다. */
export async function listJournalGroups(opts: ListJournalOptions = {}): Promise<JournalGroup[]> {
  const rows = await listJournalPosts({ ...opts, locale: undefined, status: undefined });
  let groups = toGroups(rows);
  if (opts.status) groups = groups.filter((g) => g.status === opts.status);
  if (opts.untranslatedOnly) groups = groups.filter((g) => g.missingLocales.length > 0);
  return groups.sort((a, b) => (b.publishedAtRaw ?? '').localeCompare(a.publishedAtRaw ?? ''));
}

export async function getJournalPost(slug: string, locale: Locale): Promise<JournalPost | null> {
  if (isDatabaseConfigured()) {
    const row = await prisma.journalPost.findUnique({ where: { slug_locale: { slug, locale } } });
    if (row) return fromDb(row as DbPost);
  }
  return seedRows().find((p) => p.slug === slug && p.locale === locale) ?? null;
}

export async function getJournalGroup(slug: string): Promise<JournalGroup | null> {
  const rows = (await allRows()).filter((p) => p.slug === slug);
  if (rows.length === 0) return null;
  return toGroups(rows)[0] ?? null;
}

export type JournalCounts = {
  total: number;
  published: number;
  draft: number;
  untranslated: number;
  sample: number;
};

/** 상단 필터 칩 숫자. 시안의 34 / 18 / 10 / 6 은 예시이므로 실제 데이터에서 센다. */
export async function countJournal(): Promise<JournalCounts> {
  const groups = await listJournalGroups();
  return {
    total: groups.length,
    published: groups.filter((g) => g.status === 'published').length,
    draft: groups.filter((g) => g.status === 'draft').length,
    untranslated: groups.filter((g) => g.missingLocales.length > 0).length,
    sample: groups.filter((g) => g.isSample).length,
  };
}

/* ----------------------------------------------- 네이버 블로그 가져오기 (seam) */

/**
 * 네이버 블로그 수집 연결 상태.
 * 자격증명이 아직 없다. 없는 상태를 "설정 안 됨"으로 정확히 돌려주고,
 * 절대로 가져온 척한 글을 만들어내지 않는다.
 */
export type NaverImportConfig = {
  configured: boolean;
  blogId: string | null;
  lastSyncedAt: Date | null;
  reason?: string;
};

export function getNaverImportConfig(): NaverImportConfig {
  const blogId = process.env.NAVER_BLOG_ID ?? null;
  const hasCredentials = Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);

  if (!blogId || !hasCredentials) {
    return {
      configured: false,
      blogId,
      lastSyncedAt: null,
      reason: !blogId
        ? 'NAVER_BLOG_ID 환경변수가 설정되지 않았습니다.'
        : 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.',
    };
  }

  // 마지막 동기화 시각은 아직 읽을 수 없다. IngestRun 에는 어떤 수집인지 구분하는
  // 칼럼이 없어서 인스타 수집 기록을 네이버 동기화 시각으로 내보내게 된다.
  // 없는 값을 지어내느니 null 로 둔다 (스키마 갭 — 인계 보고 참고).
  return { configured: true, blogId, lastSyncedAt: null };
}

export type NaverImportResult =
  | { ok: false; reason: string }
  | { ok: true; fetched: number; created: number; skipped: number };

/**
 * 네이버 블로그에서 글을 가져온다.
 * 자격증명이 없으면 그 사실만 돌려준다 — 빈 성공도, 가짜 글도 만들지 않는다.
 * 가져온 글은 반드시 임시저장(publishedAt: null)으로 들어간다. 자동 게시는 없다.
 */
export async function importFromNaverBlog(): Promise<NaverImportResult> {
  const config = getNaverImportConfig();
  if (!config.configured) {
    return { ok: false, reason: config.reason ?? '네이버 블로그 연동이 설정되지 않았습니다.' };
  }
  // TODO(naver): 실제 수집 구현.
  throw new NotImplementedError('네이버 블로그 수집');
}

/* -------------------------------------------------------------- 쓰기 */

export type JournalPostInput = {
  slug: string;
  locale: Locale;
  category: JournalCategory;
  title: string;
  body: string;
  cover: string;
  planCode: string | null;
  isSample: boolean;
  /** 어디서 온 글인지. 수집 경로만 채우고, 손으로 쓴 글은 비워 둔다. */
  source?: JournalSource | null;
};

/**
 * 저장. publishedAt 은 여기서 건드리지 않는다 —
 * 본문을 고쳤다는 이유로 글이 공개되거나 내려가면 안 되기 때문이다.
 * 공개 여부는 publishJournalPost / unpublishJournalPost 만 바꾼다.
 */
export async function upsertJournalPost(input: JournalPostInput): Promise<JournalPost> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('촬영후기 저장');

  const data = {
    category: input.category,
    title: input.title,
    body: input.body,
    cover: input.cover,
    planCode: input.planCode,
    isSample: input.isSample,
    ...(input.source !== undefined ? { source: input.source } : {}),
  };

  const row = await prisma.journalPost.upsert({
    where: { slug_locale: { slug: input.slug, locale: input.locale } },
    // 새 글은 임시저장으로 들어간다. 자동 게시는 없다.
    create: { slug: input.slug, locale: input.locale, ...data },
    update: data,
  });

  await logAdminAction('촬영후기 저장', `${input.slug}:${input.locale}`, {
    category: input.category,
    isSample: input.isSample,
  });

  return fromDb(row as DbPost);
}

/** 게시. 가져온 글은 자동 게시되지 않으므로 반드시 이 경로를 거친다. */
export async function publishJournalPost(slug: string, locale: Locale): Promise<JournalPost> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('촬영후기 게시');

  const existing = await prisma.journalPost.findUnique({
    where: { slug_locale: { slug, locale } },
    select: { publishedAt: true },
  });
  if (!existing) throw new NotFoundError(`글을 찾을 수 없습니다 (${slug} / ${locale}).`);

  const row = await prisma.journalPost.update({
    where: { slug_locale: { slug, locale } },
    // 이미 게시된 글을 다시 누르면 최초 게시 시각을 덮어쓰지 않는다.
    data: { publishedAt: existing.publishedAt ?? new Date() },
  });

  await logAdminAction('촬영후기 게시', `${slug}:${locale}`);
  return fromDb(row as DbPost);
}

export async function unpublishJournalPost(slug: string, locale: Locale): Promise<JournalPost> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('촬영후기 게시 취소');

  const exists = await prisma.journalPost.findUnique({
    where: { slug_locale: { slug, locale } },
    select: { id: true },
  });
  if (!exists) throw new NotFoundError(`글을 찾을 수 없습니다 (${slug} / ${locale}).`);

  const row = await prisma.journalPost.update({
    where: { slug_locale: { slug, locale } },
    data: { publishedAt: null },
  });

  await logAdminAction('촬영후기 게시 취소', `${slug}:${locale}`);
  return fromDb(row as DbPost);
}

/** 카테고리는 글 단위 속성이므로 같은 slug 의 모든 언어에 함께 적용한다. */
export async function setJournalCategory(slug: string, category: JournalCategory): Promise<number> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('카테고리 지정');

  const { count } = await prisma.journalPost.updateMany({ where: { slug }, data: { category } });
  if (count === 0) throw new NotFoundError(`글을 찾을 수 없습니다 (${slug}).`);

  await logAdminAction('촬영후기 카테고리 지정', slug, { category, count });
  return count;
}

/** 샘플 표시 해제 — 실제 원고로 교체했을 때만 쓴다. */
export async function clearSampleFlag(slug: string): Promise<number> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('샘플 표시 해제');

  const { count } = await prisma.journalPost.updateMany({
    where: { slug },
    data: { isSample: false },
  });
  if (count === 0) throw new NotFoundError(`글을 찾을 수 없습니다 (${slug}).`);

  await logAdminAction('촬영후기 샘플 표시 해제', slug, { count });
  return count;
}
