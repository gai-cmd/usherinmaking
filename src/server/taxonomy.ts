import type { Taxonomy as SeedTaxonomy, Term as SeedTerm, TaxonomyKey } from '@/content/taxonomy';
import {
  AXIS_ORDER,
  TAXONOMIES,
  TERMS,
  staticFilterCombinations,
  termsFor,
} from '@/content/taxonomy';
import type { Locale } from '@/lib/i18n';
import { LOCALES, path } from '@/lib/i18n';

import { logAdminAction } from '@/server/activity';
import { isDatabaseConfigured, prisma } from '@/server/db';
import { NotFoundError, NotImplementedError } from '@/server/errors';

/**
 * 분류(축 · 용어) 저장소 — 관리자용.
 *
 * 읽기는 DB 우선 · src/content/taxonomy.ts 폴백이다.
 *
 * 주의: 공개 갤러리는 아직 src/content/taxonomy.ts 를 동기적으로 읽는다. 그래서 아래
 * 동기 헬퍼들(termUrls / slugChangeWarning / findSlugConflict)은 의도적으로 content 를 본다 —
 * 그것이 지금 살아 있는 공개 URL 공간이기 때문이다. 저장 경로의 중복 검사는 그것만으로
 * 부족하므로 DB 까지 함께 보는 findSlugConflictInDb 를 따로 둔다.
 *
 * 이 화면이 조심해야 하는 것은 두 가지다.
 *
 *  1) 갤러리 필터는 쿼리스트링이 아니라 경로다. Term.slug 가 곧 공개 URL 세그먼트이므로
 *     슬러그를 바꾸면 살아 있는 주소가 끊긴다. termUrls() 로 어떤 주소가 생기는지 보여주고,
 *     slugChangeWarning() 으로 무엇이 깨지는지 먼저 알린다.
 *  2) 번역이 없는 로케일에서는 그 용어가 필터에서 통째로 사라진다(termsFor 의 규칙).
 *     즉 "미번역"은 표기 누락이 아니라 기능 누락이다 — missingLocales() 가 이를 표면화한다.
 */

export type { TaxonomyKey };

/** prisma/schema.prisma model Term 에 대응. label 은 Json { ja, en, ko } 의 부분집합. */
export type AdminTerm = {
  /** content 의 Term.key. Prisma 이관 시 Term.id 가 된다. */
  id: string;
  taxonomyKey: TaxonomyKey;
  slug: string;
  label: Partial<Record<Locale, string>>;
  order: number;
  /** 상위 그룹 이름 (mood 축의 set / season). Prisma 의 parentId 자기참조와는 모양이 다르다. */
  parentGroup: string | null;
  /** 라벨이 비어 이 로케일의 필터에서 빠지는 언어 */
  missingLocales: Locale[];
  /** 이 용어가 실제로 노출되는 언어 */
  visibleLocales: Locale[];
};

/** prisma/schema.prisma model Taxonomy 에 대응. */
export type AdminTaxonomy = {
  id: TaxonomyKey;
  key: TaxonomyKey;
  label: Record<Locale, string>;
  order: number;
  terms: AdminTerm[];
  /**
   * URL 세그먼트 순서에서 이 축이 차지하는 자리. place → session → mood 로 고정이며
   * 순서가 곧 주소 규칙이라 임의로 못 바꾼다.
   */
  axisIndex: number;
  /** 하위 그룹이 있는 축 (mood 는 set / season 으로 갈린다) */
  groups: string[];
};

/* ------------------------------------------------------------------ */
/* 슬러그                                                              */
/* ------------------------------------------------------------------ */

/** 소문자 영숫자와 하이픈만. 경로 세그먼트로 그대로 쓰이므로 인코딩이 필요 없어야 한다. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 48 && SLUG_PATTERN.test(slug);
}

/** 형식 오류 사유. 통과하면 null. */
export function slugError(slug: string): string | null {
  if (!slug) return '슬러그를 입력해 주세요.';
  if (slug.length > 48) return '슬러그는 48자를 넘을 수 없습니다.';
  if (!SLUG_PATTERN.test(slug)) {
    return '소문자 영문·숫자·하이픈만 쓸 수 있습니다 (예: arch-window).';
  }
  return null;
}

/**
 * 슬러그는 축이 달라도 전체에서 유일해야 한다.
 * parseFilter 가 세그먼트를 축 구분 없이 findTerm(slug) 로 해석하기 때문이다.
 */
export function findSlugConflict(slug: string, exceptTermId?: string): AdminTerm | null {
  const hit = TERMS.find((t) => t.slug === slug && t.key !== exceptTermId);
  return hit ? toAdminTerm(hit) : null;
}

/**
 * DB까지 포함한 중복 검사.
 *
 * 스키마의 @@unique 는 [taxonomyId, slug] 라서 축이 다르면 같은 슬러그가 들어간다.
 * 그런데 parseFilter 는 세그먼트를 축 구분 없이 해석하므로 축이 달라도 겹치면 주소가 무너진다.
 * 그 간극을 여기서 막는다.
 */
export async function findSlugConflictInDb(
  slug: string,
  exceptTermId?: string,
): Promise<{ taxonomyKey: string; slug: string } | null> {
  if (!isDatabaseConfigured()) return null;

  const row = await prisma.term.findFirst({
    where: { slug, ...(exceptTermId ? { NOT: { id: exceptTermId } } : {}) },
    select: { slug: true, taxonomy: { select: { key: true } } },
  });
  return row ? { taxonomyKey: row.taxonomy.key, slug: row.slug } : null;
}

/* ------------------------------------------------------------------ */
/* URL                                                                 */
/* ------------------------------------------------------------------ */

export type TermUrl = { locale: Locale; url: string };

/**
 * 용어 하나가 단독으로 만들어 내는 공개 주소.
 * 번역이 없는 로케일에서는 그 용어가 필터에 없으므로 주소도 생기지 않는다.
 */
export function termUrls(slug: string): TermUrl[] {
  return LOCALES.filter((locale) => TERMS.some((t) => t.slug === slug && t.label[locale])).map(
    (locale) => ({ locale, url: path(locale, 'gallery', slug) }),
  );
}

/**
 * 이 슬러그가 들어가는 모든 공개 주소 — 단독 + 조합.
 * 슬러그를 바꿀 때 실제로 끊기는 주소 목록이다.
 */
export function termUrlsIncludingCombinations(slug: string): TermUrl[] {
  const out: TermUrl[] = [];
  for (const locale of LOCALES) {
    for (const combo of staticFilterCombinations(locale)) {
      if (combo.includes(slug)) out.push({ locale, url: path(locale, 'gallery', ...combo) });
    }
  }
  return out;
}

/**
 * 슬러그 변경 경고. 바꾸면 기존 주소가 죽으므로 편집 화면이 반드시 이걸 띄운다.
 * 변경이 없으면 null.
 */
export function slugChangeWarning(
  before: string,
  after: string,
): { message: string; breaking: string[] } | null {
  if (before === after) return null;
  const breaking = termUrlsIncludingCombinations(before).map((u) => u.url);
  return {
    message: `슬러그를 바꾸면 지금 공개된 갤러리 주소 ${breaking.length}건이 끊깁니다. 리디렉션을 함께 준비해 주세요.`,
    breaking,
  };
}

/* ------------------------------------------------------------------ */
/* 변환                                                                */
/* ------------------------------------------------------------------ */

function toAdminTerm(t: SeedTerm): AdminTerm {
  const visibleLocales = LOCALES.filter((l) => Boolean(t.label[l]?.trim()));
  return {
    id: t.key,
    taxonomyKey: t.taxonomy,
    slug: t.slug,
    label: t.label,
    order: t.order,
    parentGroup: t.parent ?? null,
    missingLocales: LOCALES.filter((l) => !visibleLocales.includes(l)),
    visibleLocales,
  };
}

function toAdminTaxonomy(tx: SeedTaxonomy): AdminTaxonomy {
  const terms = TERMS.filter((t) => t.taxonomy === tx.key)
    .sort((a, b) => a.order - b.order)
    .map(toAdminTerm);

  const groups = [...new Set(terms.map((t) => t.parentGroup).filter((g): g is string => !!g))];

  return {
    id: tx.key,
    key: tx.key,
    label: tx.label,
    order: tx.order,
    terms,
    axisIndex: AXIS_ORDER.indexOf(tx.key),
    groups,
  };
}

/* ------------------------------------------------------------------ */
/* DB 매핑                                                             */
/* ------------------------------------------------------------------ */

type DbTerm = {
  id: string;
  slug: string;
  label: unknown;
  order: number;
  parent?: { slug: string } | null;
};

type DbTaxonomy = {
  id: string;
  key: string;
  label: unknown;
  order: number;
  terms?: DbTerm[];
};

/** Json 라벨 → 로케일별 부분 맵. 빈 문자열은 "없음"으로 본다 (그 언어의 필터에서 빠진다). */
function toLabelMap(value: unknown): Partial<Record<Locale, string>> {
  const src = (value ?? {}) as Record<string, unknown>;
  const out: Partial<Record<Locale, string>> = {};
  for (const l of LOCALES) {
    const v = src[l];
    if (typeof v === 'string' && v.trim().length > 0) out[l] = v;
  }
  return out;
}

/**
 * mood 축의 set / season 묶음.
 *
 * 스키마는 상위를 Term 자기참조(parentId)로 표현하는데 'set' / 'season' 은 실제 용어가 아니라
 * 화면 묶음 이름이라 Term 행이 없다. 그래서 DB 행에는 담기지 않는다.
 * 묶음이 코드에 고정된 표시 규칙인 동안은 슬러그로 코드에서 되찾는다.
 * (Term 에 group 칼럼이 생기면 이 폴백은 사라진다 — 인계 보고의 스키마 갭)
 */
function groupFromCode(slug: string): string | null {
  return TERMS.find((t) => t.slug === slug)?.parent ?? null;
}

function termFromDb(row: DbTerm, taxonomyKey: TaxonomyKey): AdminTerm {
  const label = toLabelMap(row.label);
  const visibleLocales = LOCALES.filter((l) => Boolean(label[l]));
  return {
    id: row.id,
    taxonomyKey,
    slug: row.slug,
    label,
    order: row.order,
    parentGroup: row.parent?.slug ?? groupFromCode(row.slug),
    missingLocales: LOCALES.filter((l) => !visibleLocales.includes(l)),
    visibleLocales,
  };
}

function taxonomyFromDb(row: DbTaxonomy): AdminTaxonomy {
  // DB 의 key 는 자유 문자열이지만 content 의 TaxonomyKey 는 3개짜리 유니온이다.
  // 축을 늘리려면 그 타입이 먼저 넓어져야 한다 (인계 보고의 스키마·타입 갭).
  const key = row.key as TaxonomyKey;
  const terms = (row.terms ?? []).map((t) => termFromDb(t, key));
  return {
    id: key,
    key,
    label: Object.fromEntries(
      LOCALES.map((l) => {
        const src = (row.label ?? {}) as Record<string, unknown>;
        return [l, typeof src[l] === 'string' ? (src[l] as string) : ''];
      }),
    ) as Record<Locale, string>,
    order: row.order,
    terms,
    axisIndex: AXIS_ORDER.indexOf(key),
    groups: [...new Set(terms.map((t) => t.parentGroup).filter((g): g is string => !!g))],
  };
}

const TAXONOMY_INCLUDE = {
  terms: {
    orderBy: { order: 'asc' },
    select: {
      id: true,
      slug: true,
      label: true,
      order: true,
      parent: { select: { slug: true } },
    },
  },
} as const;

/* ------------------------------------------------------------------ */
/* 읽기 — DB 우선, 시드 폴백                                            */
/* ------------------------------------------------------------------ */

export async function listTaxonomies(): Promise<AdminTaxonomy[]> {
  if (isDatabaseConfigured()) {
    const rows = await prisma.taxonomy.findMany({
      orderBy: { order: 'asc' },
      include: TAXONOMY_INCLUDE,
    });
    if (rows.length > 0) return rows.map((r) => taxonomyFromDb(r as DbTaxonomy));
  }
  return [...TAXONOMIES].sort((a, b) => a.order - b.order).map(toAdminTaxonomy);
}

export async function getTaxonomy(key: string): Promise<AdminTaxonomy | null> {
  if (isDatabaseConfigured()) {
    const row = await prisma.taxonomy.findUnique({ where: { key }, include: TAXONOMY_INCLUDE });
    if (row) return taxonomyFromDb(row as DbTaxonomy);
  }
  const tx = TAXONOMIES.find((t) => t.key === key);
  return tx ? toAdminTaxonomy(tx) : null;
}

export async function getTerm(slug: string): Promise<AdminTerm | null> {
  if (isDatabaseConfigured()) {
    const row = await prisma.term.findFirst({
      where: { slug },
      select: {
        id: true,
        slug: true,
        label: true,
        order: true,
        parent: { select: { slug: true } },
        taxonomy: { select: { key: true } },
      },
    });
    if (row) return termFromDb(row as DbTerm, row.taxonomy.key as TaxonomyKey);
  }
  const t = TERMS.find((x) => x.slug === slug);
  return t ? toAdminTerm(t) : null;
}

/** id 로 조회. 슬러그가 바뀌는 편집에서는 이쪽이 기준이다. */
export async function getTermById(id: string): Promise<AdminTerm | null> {
  if (isDatabaseConfigured()) {
    const row = await prisma.term.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        label: true,
        order: true,
        parent: { select: { slug: true } },
        taxonomy: { select: { key: true } },
      },
    });
    if (row) return termFromDb(row as DbTerm, row.taxonomy.key as TaxonomyKey);
  }
  // 시드에서는 content 의 Term.key 가 id 역할을 한다.
  const t = TERMS.find((x) => x.key === id);
  return t ? toAdminTerm(t) : null;
}

/**
 * 번역이 빠져 특정 언어의 필터에서 사라지는 용어들.
 * 표기 누락이 아니라 그 언어에서 필터 자체가 없어지는 문제라 SEO 화면에서 따로 센다.
 */
export async function listUntranslatedTerms(): Promise<AdminTerm[]> {
  const taxonomies = await listTaxonomies();
  return taxonomies.flatMap((tx) => tx.terms).filter((t) => t.missingLocales.length > 0);
}

/**
 * 지금 정적으로 생성되는 갤러리 필터 주소 전체. sitemap 검증과 SEO 화면이 쓴다.
 * 공개 갤러리가 content 모듈에서 조합을 만들므로 여기서도 같은 곳을 본다 —
 * DB 를 보면 실제로 생성되지 않는 주소를 있다고 말하게 된다.
 */
export async function listAllFilterUrls(): Promise<string[]> {
  const out: string[] = [];
  for (const locale of LOCALES) {
    for (const combo of staticFilterCombinations(locale)) {
      out.push(path(locale, 'gallery', ...combo));
    }
  }
  return out;
}

/** 로케일별 노출 용어 수 — 축 관리 화면 상단 요약. */
export async function countVisibleTerms(): Promise<Record<Locale, number>> {
  const counts = Object.fromEntries(LOCALES.map((l) => [l, 0])) as Record<Locale, number>;
  // 편집 대상과 같은 목록에서 센다. listTaxonomies 가 DB 우선이므로 이 숫자도 함께 따라간다.
  const taxonomies = await listTaxonomies();
  for (const tx of taxonomies) {
    for (const term of tx.terms) {
      for (const locale of term.visibleLocales) counts[locale] += 1;
    }
  }
  return counts;
}

/* ------------------------------------------------------------------ */
/* 쓰기                                                                */
/* ------------------------------------------------------------------ */

export type UpsertTermInput = {
  taxonomyKey: TaxonomyKey;
  /** 기존 용어를 고치는 경우에만. 없으면 새 용어. */
  termId?: string;
  slug: string;
  label: Partial<Record<Locale, string>>;
  order: number;
  parentGroup: string | null;
};

/**
 * 용어 저장. 저장 자체는 아직 안 되지만, 저장 전에 걸러야 하는 규칙은 여기서 이미 돈다.
 * 슬러그가 공개 주소라서, 형식·중복 검사는 DB 연결 여부와 무관하게 항상 유효하다.
 */
export async function upsertTerm(input: UpsertTermInput): Promise<AdminTerm> {
  // 슬러그 규칙은 DB 연결과 무관하게 항상 유효하다 — 그 값이 곧 공개 주소이기 때문이다.
  const err = slugError(input.slug);
  if (err) throw new Error(`용어 저장: ${err}`);

  const conflict = findSlugConflict(input.slug, input.termId);
  if (conflict) {
    throw new Error(
      `용어 저장: 이미 쓰이는 슬러그입니다 (${conflict.taxonomyKey} / ${conflict.slug}). 갤러리 주소가 겹칩니다.`,
    );
  }

  if (!isDatabaseConfigured()) throw new NotImplementedError('용어 저장');

  const dbConflict = await findSlugConflictInDb(input.slug, input.termId);
  if (dbConflict) {
    throw new Error(
      `용어 저장: 이미 쓰이는 슬러그입니다 (${dbConflict.taxonomyKey} / ${dbConflict.slug}). 갤러리 주소가 겹칩니다.`,
    );
  }

  const taxonomy = await prisma.taxonomy.findUnique({
    where: { key: input.taxonomyKey },
    select: { id: true },
  });
  if (!taxonomy) {
    // 축이 없으면 용어를 걸 곳이 없다. 조용히 만들어 내면 축 목록이 코드와 어긋난다.
    throw new NotFoundError(
      `축 '${input.taxonomyKey}' 이 DB에 없습니다. 시드(npm run db:seed)를 먼저 돌려 주세요.`,
    );
  }

  // parentGroup('set' / 'season')은 같은 축에 그 슬러그를 가진 Term 이 있을 때만 저장된다.
  // 저장할 수 없는 값을 새로 지정하려는 요청은 성공한 척하지 않고 막는다.
  let parentId: string | null = null;
  if (input.parentGroup) {
    const parent = await prisma.term.findFirst({
      where: { taxonomyId: taxonomy.id, slug: input.parentGroup },
      select: { id: true },
    });
    if (parent) {
      parentId = parent.id;
    } else if (input.parentGroup !== groupFromCode(input.slug)) {
      throw new NotImplementedError(
        `용어 묶음 '${input.parentGroup}' 저장 (Term 에 group 칼럼이 없습니다)`,
      );
    }
  }

  const before = input.termId ? await getTermById(input.termId) : null;

  const data = {
    slug: input.slug,
    label: input.label,
    order: input.order,
    parentId,
  };

  const row = input.termId
    ? await prisma.term.update({ where: { id: input.termId }, data })
    : await prisma.term.create({ data: { ...data, taxonomyId: taxonomy.id } });

  await logAdminAction('용어 저장', row.id, {
    taxonomyKey: input.taxonomyKey,
    slug: input.slug,
    ...(before && before.slug !== input.slug ? { slugBefore: before.slug } : {}),
  });

  // 슬러그가 바뀌면 옛 주소가 끊긴다. 옛·새 주소를 모두 무효화한다.
  // 리디렉션 등록은 아직 없다 — 색인된 옛 주소는 404 로 남는다 (인계 보고 참고).
  const stale = before && before.slug !== input.slug ? termUrlsIncludingCombinations(before.slug) : [];
  await revalidateGalleryUrls([...stale, ...termUrlsIncludingCombinations(input.slug)]);

  return termFromDb(
    { id: row.id, slug: row.slug, label: row.label, order: row.order, parent: null },
    input.taxonomyKey,
  );
}

export async function upsertTaxonomy(input: {
  key: string;
  label: Record<Locale, string>;
  order: number;
}): Promise<AdminTaxonomy> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('축 저장');

  const row = await prisma.taxonomy.upsert({
    where: { key: input.key },
    create: { key: input.key, label: input.label, order: input.order },
    update: { label: input.label, order: input.order },
    include: TAXONOMY_INCLUDE,
  });

  await logAdminAction('축 저장', input.key, { order: input.order });
  return taxonomyFromDb(row as DbTaxonomy);
}

/** 공개 주소가 사라지는 작업이다. 호출측이 확인 단계를 먼저 거쳐야 한다. */
export async function deleteTerm(slug: string): Promise<void> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('용어 삭제');

  const row = await prisma.term.findFirst({ where: { slug }, select: { id: true } });
  if (!row) throw new NotFoundError(`용어를 찾을 수 없습니다 (${slug}).`);

  const urls = termUrlsIncludingCombinations(slug);

  // PhotoTerm 은 onDelete: Cascade 로 함께 지워진다. 사진 자체는 남는다.
  await prisma.term.delete({ where: { id: row.id } });

  await logAdminAction('용어 삭제', slug, { brokenUrls: urls.length });
  await revalidateGalleryUrls(urls);
}

export async function reorderTerms(taxonomyKey: TaxonomyKey, termIds: string[]): Promise<void> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('용어 순서 저장');

  const taxonomy = await prisma.taxonomy.findUnique({
    where: { key: taxonomyKey },
    select: { id: true },
  });
  if (!taxonomy) throw new NotFoundError(`축 '${taxonomyKey}' 을 찾을 수 없습니다.`);

  const rows = await prisma.term.findMany({
    where: { id: { in: termIds }, taxonomyId: taxonomy.id },
    select: { id: true },
  });
  const missing = termIds.filter((id) => !rows.some((r) => r.id === id));
  if (missing.length > 0) {
    throw new NotFoundError(`이 축에 없는 용어가 섞여 있습니다: ${missing.join(', ')}`);
  }

  // 순서는 전부 함께 바뀌어야 한다 — 중간에 끊기면 필터 줄이 뒤섞인 채로 공개된다.
  await prisma.$transaction(
    termIds.map((id, order) => prisma.term.update({ where: { id }, data: { order } })),
  );

  await logAdminAction('용어 순서 저장', taxonomyKey, { count: termIds.length });
}

/**
 * 갤러리 주소 무효화. 요청 컨텍스트 밖에서는 revalidatePath 가 던지므로 삼키되,
 * 저장 자체를 되돌리지는 않는다.
 */
async function revalidateGalleryUrls(urls: TermUrl[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    const { revalidatePath } = await import('next/cache');
    for (const u of new Set(urls.map((x) => x.url))) revalidatePath(u);
  } catch (err) {
    console.error('[taxonomy] 갤러리 재검증 실패', err);
  }
}
