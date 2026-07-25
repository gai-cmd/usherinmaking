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

import { NotImplementedError } from '@/server/errors';

/**
 * 분류(축 · 용어) 저장소 — 관리자용.
 *
 * 읽기는 src/content/taxonomy.ts 를 그대로 쓴다. 그쪽이 공개 갤러리가 실제로 읽는 값이므로,
 * 관리자 화면이 별도 시드를 들면 편집 대상과 노출 대상이 어긋난다.
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
/* 읽기                                                                */
/* ------------------------------------------------------------------ */

export async function listTaxonomies(): Promise<AdminTaxonomy[]> {
  // TODO(prisma): prisma.taxonomy.findMany({ include: { terms: { orderBy: { order: 'asc' } } },
  //                                          orderBy: { order: 'asc' } })
  return [...TAXONOMIES].sort((a, b) => a.order - b.order).map(toAdminTaxonomy);
}

export async function getTaxonomy(key: string): Promise<AdminTaxonomy | null> {
  // TODO(prisma): prisma.taxonomy.findUnique({ where: { key }, include: { terms: true } })
  const tx = TAXONOMIES.find((t) => t.key === key);
  return tx ? toAdminTaxonomy(tx) : null;
}

export async function getTerm(slug: string): Promise<AdminTerm | null> {
  // TODO(prisma): prisma.term.findFirst({ where: { slug } })
  const t = TERMS.find((x) => x.slug === slug);
  return t ? toAdminTerm(t) : null;
}

/** id(=content 의 Term.key) 로 조회. 슬러그가 바뀌는 편집에서는 이쪽이 기준이다. */
export async function getTermById(id: string): Promise<AdminTerm | null> {
  // TODO(prisma): prisma.term.findUnique({ where: { id } })
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

/** 지금 정적으로 생성되는 갤러리 필터 주소 전체. sitemap 검증과 SEO 화면이 쓴다. */
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
  for (const locale of LOCALES) {
    counts[locale] = AXIS_ORDER.reduce((sum, axis) => sum + termsFor(axis, locale).length, 0);
  }
  return counts;
}

/* ------------------------------------------------------------------ */
/* 쓰기 — 미구현                                                        */
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
  const err = slugError(input.slug);
  if (err) throw new Error(`용어 저장: ${err}`);

  const conflict = findSlugConflict(input.slug, input.termId);
  if (conflict) {
    throw new Error(
      `용어 저장: 이미 쓰이는 슬러그입니다 (${conflict.taxonomyKey} / ${conflict.slug}). 갤러리 주소가 겹칩니다.`,
    );
  }

  // TODO(prisma): prisma.term.upsert({ where: { taxonomyId_slug: {...} }, create, update })
  // TODO(isr): 슬러그가 바뀌었다면 slugChangeWarning(before, after).breaking 전체와
  //            새 주소들을 revalidatePath 하고, 옛 주소용 리디렉션을 등록한다.
  //            이 처리를 빼면 색인된 주소가 그대로 404 로 남는다.
  throw new NotImplementedError('용어 저장');
}

export async function upsertTaxonomy(_input: {
  key: string;
  label: Record<Locale, string>;
  order: number;
}): Promise<AdminTaxonomy> {
  // TODO(prisma): prisma.taxonomy.upsert({ where: { key }, create, update })
  // 주의: content/taxonomy.ts 의 TaxonomyKey 는 3개짜리 유니온이라 축을 늘리려면
  //       그 타입이 string 으로 완화되어야 한다. 축 추가는 DB 이관과 함께 열린다.
  throw new NotImplementedError('축 저장');
}

export async function deleteTerm(_slug: string): Promise<void> {
  // TODO(prisma): prisma.term.delete(...) — PhotoTerm 은 onDelete: Cascade 로 함께 지워진다.
  // 공개 주소가 사라지므로 삭제 전 반드시 확인 단계를 둔다.
  throw new NotImplementedError('용어 삭제');
}

export async function reorderTerms(_taxonomyKey: TaxonomyKey, _termIds: string[]): Promise<void> {
  // TODO(prisma): prisma.$transaction(termIds.map((id, order) => prisma.term.update(...)))
  throw new NotImplementedError('용어 순서 저장');
}
