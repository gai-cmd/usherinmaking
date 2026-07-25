import type { Locale } from '@/lib/i18n';

/**
 * 갤러리 분류 체계.
 * 나중에 DB(taxonomy / term 테이블)로 옮길 것을 전제로 한 모양이다.
 * term 한 줄이 곧 DB 한 행 — key / slug / 번역 label / order / parent.
 * 번역이 없는 로케일에서는 그 term 자체가 노출되지 않는다(= 그 언어의 필터에 없다).
 */

export type TaxonomyKey = 'place' | 'session' | 'mood';

export type Term = {
  /** DB 고유 키 */
  key: string;
  taxonomy: TaxonomyKey;
  /** URL 세그먼트 — 언어와 무관하게 동일하다 */
  slug: string;
  /** 로케일별 표시명. 없는 로케일에서는 이 term을 노출하지 않는다. */
  label: Partial<Record<Locale, string>>;
  order: number;
  /** 상위 그룹. mood 축만 set / season 두 그룹으로 갈린다. */
  parent?: string;
};

export type Taxonomy = {
  key: TaxonomyKey;
  order: number;
  /** 필터 행 왼쪽 축 라벨 */
  label: Record<Locale, string>;
};

/** 축 순서 = URL 세그먼트 순서. place → session → mood 로 고정한다. */
export const TAXONOMIES: Taxonomy[] = [
  { key: 'place', order: 1, label: { ja: '場所', en: 'PLACE', ko: '장소' } },
  { key: 'session', order: 2, label: { ja: '撮影', en: 'SESSION', ko: '촬영' } },
  { key: 'mood', order: 3, label: { ja: 'セット 季節', en: 'SET SEASON', ko: '세트 계절' } },
];

export const TERMS: Term[] = [
  /* ---- place ---- */
  {
    key: 'place-studio',
    taxonomy: 'place',
    slug: 'studio',
    order: 1,
    label: { ja: 'スタジオ', en: 'Studio', ko: '스튜디오' },
  },
  {
    key: 'place-location',
    taxonomy: 'place',
    slug: 'location',
    order: 2,
    label: { ja: 'ロケーション', en: 'Location', ko: '로케이션' },
  },

  /* ---- session ---- */
  {
    key: 'session-wedding',
    taxonomy: 'session',
    slug: 'wedding',
    order: 1,
    label: { ja: 'ウェディング・前撮り', en: 'Wedding', ko: '본식 전 웨딩' },
  },
  {
    // 한국어 카드에만 있는 항목이라 ko 번역만 둔다.
    key: 'session-remind-wedding',
    taxonomy: 'session',
    slug: 'remind-wedding',
    order: 2,
    label: { ko: '리마인드 웨딩' },
  },
  {
    key: 'session-self-wedding',
    taxonomy: 'session',
    slug: 'self-wedding',
    order: 3,
    label: { ja: 'セルフウェディング', en: 'Self-wedding', ko: '셀프 웨딩' },
  },
  {
    key: 'session-maternity',
    taxonomy: 'session',
    slug: 'maternity',
    order: 4,
    label: { ja: 'マタニティ', en: 'Maternity', ko: '만삭' },
  },
  {
    key: 'session-anniversary',
    taxonomy: 'session',
    slug: 'anniversary',
    order: 5,
    label: { ja: '記念日', en: 'Anniversary', ko: '기념일' },
  },
  {
    key: 'session-family',
    taxonomy: 'session',
    slug: 'family',
    order: 6,
    label: { ja: '家族・七五三', en: 'Family', ko: '가족 · 백일 · 돌' },
  },
  {
    key: 'session-couples',
    taxonomy: 'session',
    slug: 'couples',
    order: 7,
    label: { ja: 'デート', en: 'Couples', ko: '커플' },
  },

  /* ---- mood · set (스튜디오 세트 slug는 STUDIO_SETS와 맞춘다) ---- */
  {
    key: 'mood-arch-window',
    taxonomy: 'mood',
    slug: 'arch-window',
    order: 1,
    parent: 'set',
    label: { ja: 'アーチ窓 ・ 自然光', en: 'Arched window', ko: '아치 창' },
  },
  {
    key: 'mood-dress-room',
    taxonomy: 'mood',
    slug: 'dress-room',
    order: 2,
    parent: 'set',
    label: { ja: 'ドレスルーム', en: 'Dress room', ko: '드레스룸' },
  },
  {
    key: 'mood-vintage',
    taxonomy: 'mood',
    slug: 'vintage-corner',
    order: 3,
    parent: 'set',
    label: { ja: 'ヴィンテージ', en: 'Vintage', ko: '빈티지' },
  },
  {
    key: 'mood-monotone',
    taxonomy: 'mood',
    slug: 'monotone-corner',
    order: 4,
    parent: 'set',
    label: { ja: 'モノトーン', en: 'Monotone', ko: '모노톤' },
  },

  /* ---- mood · season ---- */
  {
    key: 'mood-sunny',
    taxonomy: 'mood',
    slug: 'sunny',
    order: 5,
    parent: 'season',
    label: { ja: '晴れの日', en: 'Sunny', ko: '맑은 날' },
  },
  {
    key: 'mood-cloudy',
    taxonomy: 'mood',
    slug: 'cloudy',
    order: 6,
    parent: 'season',
    label: { ja: '曇りの日', en: 'Cloudy', ko: '흐린 날' },
  },
  {
    key: 'mood-sunset',
    taxonomy: 'mood',
    slug: 'sunset',
    order: 7,
    parent: 'season',
    label: { ja: 'サンセット', en: 'Sunset', ko: '노을' },
  },
];

/** URL에 쓰이는 축 순서 */
export const AXIS_ORDER: TaxonomyKey[] = ['place', 'session', 'mood'];

/** 축별 선택 상태. 축마다 최대 하나. */
export type Selection = Partial<Record<TaxonomyKey, Term>>;

export function termLabel(term: Term, locale: Locale): string {
  return term.label[locale] ?? term.slug;
}

/** 해당 로케일에 번역이 있는 term만 노출한다. */
export function termsFor(taxonomy: TaxonomyKey, locale: Locale): Term[] {
  return TERMS.filter((t) => t.taxonomy === taxonomy && t.label[locale]).sort(
    (a, b) => a.order - b.order,
  );
}

export function findTerm(slug: string, locale: Locale): Term | undefined {
  return TERMS.find((t) => t.slug === slug && t.label[locale]);
}

/**
 * URL 세그먼트를 선택 상태로 바꾼다.
 * 축 순서가 어긋나거나, 같은 축이 두 번 나오거나, 모르는 slug면 null(→ 404).
 */
export function parseFilter(segments: string[], locale: Locale): Selection | null {
  if (segments.length === 0 || segments.length > AXIS_ORDER.length) return null;

  const selection: Selection = {};
  let axisCursor = 0;

  for (const segment of segments) {
    const term = findTerm(segment, locale);
    if (!term) return null;

    const axisIndex = AXIS_ORDER.indexOf(term.taxonomy);
    if (axisIndex < axisCursor) return null; // 순서 역행 또는 축 중복
    axisCursor = axisIndex + 1;
    selection[term.taxonomy] = term;
  }

  return selection;
}

/** 선택 상태를 정규 순서의 세그먼트 배열로 되돌린다. */
export function selectionSegments(selection: Selection): string[] {
  return AXIS_ORDER.map((axis) => selection[axis]?.slug).filter(
    (slug): slug is string => Boolean(slug),
  );
}

/** 칩 하나를 눌렀을 때의 다음 선택 상태 — 같은 term이면 해제한다. */
export function toggleTerm(selection: Selection, term: Term): Selection {
  const next: Selection = { ...selection };
  if (next[term.taxonomy]?.slug === term.slug) delete next[term.taxonomy];
  else next[term.taxonomy] = term;
  return next;
}

/**
 * 정적 생성 대상 조합.
 * 단일 term + (place × session) + (place × mood)까지만 미리 만들고,
 * 나머지 유효 조합은 요청 시 렌더링한다(조합 폭발 방지).
 */
export function staticFilterCombinations(locale: Locale): string[][] {
  const places = termsFor('place', locale);
  const sessions = termsFor('session', locale);
  const moods = termsFor('mood', locale);

  const combos: string[][] = [
    ...places.map((t) => [t.slug]),
    ...sessions.map((t) => [t.slug]),
    ...moods.map((t) => [t.slug]),
  ];

  for (const place of places) {
    for (const session of sessions) combos.push([place.slug, session.slug]);
    for (const mood of moods) combos.push([place.slug, mood.slug]);
  }

  return combos;
}
