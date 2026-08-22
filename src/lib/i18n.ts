// 3개 언어를 각각 독립된 본문으로 운영한다. ja 기본, en, ko.
// 번역이 아니라 언어권별 본문이므로 여기서는 "구조"만 공유한다.

export const LOCALES = ['ja', 'en', 'ko'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ja';

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

/** <html lang> 속성값 */
export const HTML_LANG: Record<Locale, string> = {
  ja: 'ja-JP',
  en: 'en',
  ko: 'ko-KR',
};

/** 페이지 키 → 로케일별 URL 세그먼트. 요금 페이지는 전 로케일 'plan' (구 /en/plans 는 redirect). */
export const ROUTE_SEGMENT = {
  home: { ja: '', en: '', ko: '' },
  studio: { ja: 'studio', en: 'studio', ko: 'studio' },
  location: { ja: 'location', en: 'location', ko: 'location' },
  dress: { ja: 'dress', en: 'dress', ko: 'dress' },
  plan: { ja: 'plan', en: 'plan', ko: 'plan' },
  photographer: { ja: 'photographer', en: 'photographer', ko: 'photographer' },
  journal: { ja: 'journal', en: 'journal', ko: 'journal' },
  gallery: { ja: 'gallery', en: 'gallery', ko: 'gallery' },
  contact: { ja: 'contact', en: 'contact', ko: 'contact' },
  privacy: { ja: 'privacy', en: 'privacy', ko: 'privacy' },
  tokushoho: { ja: 'tokushoho', en: 'tokushoho', ko: 'tokushoho' },
} as const satisfies Record<string, Record<Locale, string>>;

export type PageKey = keyof typeof ROUTE_SEGMENT;

/**
 * 로케일 + 페이지 키 → 절대 경로. 갤러리/저널 하위 세그먼트는 rest로 이어붙인다.
 * 선행 슬래시는 join 밖에서 붙인다 — 배열 안에 빈 문자열로 넣으면 filter(Boolean)이
 * 그것마저 걸러내어 상대 경로가 되고, canonical·hreflang까지 전부 어긋난다.
 */
export function path(locale: Locale, page: PageKey, ...rest: string[]): string {
  const seg = ROUTE_SEGMENT[page][locale];
  return `/${[locale, seg, ...rest].filter(Boolean).join('/')}`;
}

/**
 * 촬영후기가 존재하는 언어.
 *
 * 이 글들은 작가가 한국어로 쓴 촬영 기록이다. 기계적으로 옮긴 일본어·영어판을 두면
 * 원문의 목소리가 사라진 글이 남고, 언어마다 정본이 갈려 어느 쪽이 진짜인지 흐려진다.
 * 그래서 촬영후기는 한국어에만 둔다 — `NAVER_BLOG_NOTICE_LOCALE` 과 같은 판단이다.
 *
 * 이 값 하나가 내비게이션(헤더·푸터), hreflang, 사이트맵을 모두 통제한다.
 * 다른 언어로도 열고 싶어지면 여기에 로케일을 더하면 된다.
 */
export const JOURNAL_LOCALES: readonly Locale[] = ['ko'];

/**
 * 스튜디오 페이지가 존재하는 언어.
 *
 * 한국 고객 상품(usherinmaking.com/korean)에는 스튜디오 플랜이 없다 — 웨딩·기타 촬영
 * 두 갈래의 로케이션 상품뿐이다. 그래서 한국어에는 스튜디오 페이지를 두지 않는다.
 * 이 값 하나가 내비게이션·hreflang·사이트맵·정적 생성을 모두 통제한다
 * (`JOURNAL_LOCALES` 와 같은 구조). `/ko/studio` 로 들어오는 옛 링크는
 * next.config 의 리다이렉트가 `/ko/location` 으로 보낸다.
 */
export const STUDIO_LOCALES: readonly Locale[] = ['ja', 'en'];

/**
 * 갈림길 홈(`/{locale}`)을 두는 언어.
 *
 * 홈은 LOCATION / STUDIO 중 어디로 갈지 고르게 하는 화면이다. 한국어에는 고를 것이
 * 하나뿐(로케이션)이라 그 갈림길이 의미가 없어, **`/ko/location` 이 한국어의 메인**이다.
 * `/ko` 로 오는 링크는 next.config 가 그쪽으로 넘긴다.
 *
 * 이 값이 hreflang 과 사이트맵을 통제한다. ko 를 홈 쪽에 남겨 두면 `/ja` 와 `/ja/location`
 * 두 페이지가 같은 `/ko/location` 을 자기 한국어판이라 주장해 hreflang 상호 지정이 깨진다.
 */
export const HOME_LOCALES: readonly Locale[] = ['ja', 'en'];

/**
 * 그 언어의 첫 화면 주소. 로고·홈 버튼·언어 전환은 전부 이 함수를 쓴다 —
 * `path(locale, 'home')` 을 그대로 쓰면 한국어에서 리다이렉트를 한 번 더 타게 된다.
 */
export function homePath(locale: Locale): string {
  return HOME_LOCALES.includes(locale) ? path(locale, 'home') : path(locale, 'location');
}

/** 헤더 내비게이션 — 순서 고정, 라벨만 언어별. `locales` 가 있으면 그 언어에서만 보인다. */
export const NAV: { key: PageKey; label: Record<Locale, string>; locales?: readonly Locale[] }[] = [
  { key: 'studio', label: { ja: 'STUDIO', en: 'STUDIO', ko: '스튜디오' }, locales: STUDIO_LOCALES },
  { key: 'location', label: { ja: 'LOCATION', en: 'LOCATION', ko: '로케이션' } },
  // 스튜디오·로케이션에서 찍은 것을 한데 모아 보는 페이지라 그 둘 바로 뒤에 둔다.
  { key: 'gallery', label: { ja: 'GALLERY', en: 'GALLERY', ko: '갤러리' } },
  { key: 'dress', label: { ja: 'DRESS', en: 'DRESS', ko: '드레스' } },
  { key: 'plan', label: { ja: 'PLAN', en: 'PLANS', ko: '플랜' } },
  { key: 'photographer', label: { ja: 'PHOTOGRAPHER', en: 'PHOTOGRAPHER', ko: '작가 소개' } },
  { key: 'journal', label: { ja: 'JOURNAL', en: 'JOURNAL', ko: '촬영후기' }, locales: JOURNAL_LOCALES },
  { key: 'contact', label: { ja: 'CONTACT', en: 'CONTACT', ko: '문의' } },
];

/** 그 언어에서 실제로 보여줄 메뉴만. 헤더와 푸터가 같은 결과를 쓰도록 한 곳에서 거른다. */
export function navFor(locale: Locale) {
  return NAV.filter((item) => !item.locales || item.locales.includes(locale));
}

/** 언어 전환 버튼 표기 */
export const LOCALE_LABEL: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  ko: '한국어',
};

/** 언어 전환 버튼 축약 표기 (헤더 우측) */
export const LOCALE_SHORT: Record<Locale, string> = { ja: 'JA', en: 'EN', ko: 'KO' };

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usherinmaking.vercel.app';

/** hreflang 상호 지정용 alternates 맵 */
export function alternates(page: PageKey, ...rest: string[]) {
  // 언어가 제한된 페이지(촬영후기·스튜디오)는 있는 언어만 가리킨다 —
  // 없는 주소를 hreflang 으로 선언하면 검색엔진이 404 를 대안 언어로 읽는다.
  const available =
    page === 'journal'
      ? JOURNAL_LOCALES
      : page === 'studio'
        ? STUDIO_LOCALES
        : page === 'home'
          ? HOME_LOCALES
          : LOCALES;
  const languages: Record<string, string> = {};
  for (const l of available) languages[HTML_LANG[l]] = `${SITE_URL}${path(l, page, ...rest)}`;
  const xDefault = available.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : available[0];
  languages['x-default'] = `${SITE_URL}${path(xDefault, page, ...rest)}`;
  return languages;
}

/** 공통 UI 문자열 — 페이지 본문이 아니라 버튼/라벨 수준만 공유한다. */
export const UI = {
  contactCta: { ja: 'お問い合わせ', en: 'CONTACT', ko: '문의하기' },
  viewMore: { ja: 'MORE', en: 'MORE', ko: '더 보기' },
  viewAll: { ja: 'VIEW ALL', en: 'VIEW ALL', ko: '전체 보기' },
  backHome: { ja: 'ホームへ', en: 'BACK TO HOME', ko: '홈으로' },
  menu: { ja: 'MENU', en: 'MENU', ko: '메뉴' },
  close: { ja: '閉じる', en: 'CLOSE', ko: '닫기' },
  noAutoBooking: {
    ja: '自動予約・カレンダー予約はありません。お問い合わせいただいたあと、ご相談のうえで確定します。',
    en: 'There’s no automatic or calendar booking. Every session is confirmed through a conversation after you get in touch.',
    ko: '자동 예약 · 캘린더 예약은 없습니다. 문의를 주시면 상담을 통해 일정을 확정해 드립니다.',
  },
} as const satisfies Record<string, Record<Locale, string>>;
