import { SITE_URL, homePath, path, type Locale, type PageKey } from '@/lib/i18n';
import { BRAND, STUDIO_INFO } from '@/content/site';

/**
 * 목록·안내 페이지용 구조화 데이터.
 *
 * 작품·저널 상세는 각자 ImageObject / BlogPosting 을 갖고, 홈·플랜·스튜디오는
 * LocalBusiness / Service / FAQPage 를 갖는다. 그 사이의 목록 페이지(갤러리·저널)와
 * 안내 페이지(드레스)에는 아무것도 없었다 — 검색엔진이 "이 페이지가 사이트 안에서
 * 어디쯤인지" 읽을 단서가 빠진 자리다. BreadcrumbList 가 그 위치를, CollectionPage 가
 * 이 페이지가 목록이라는 것을 말한다. 전부 schema.org 표준 타입이다.
 */

type Crumb = { name: string; page: PageKey };

export function breadcrumbLd(locale: Locale, crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'usherinmaking', item: `${SITE_URL}${homePath(locale)}` },
      ...crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: c.name,
        item: `${SITE_URL}${path(locale, c.page)}`,
      })),
    ],
  };
}

export function collectionPageLd(locale: Locale, page: PageKey, name: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${SITE_URL}${path(locale, page)}`,
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', name: 'usherinmaking', url: SITE_URL },
  };
}

export function webPageLd(locale: Locale, page: PageKey, name: string, description: string) {
  return { ...collectionPageLd(locale, page, name, description), '@type': 'WebPage' };
}

/* ------------------------------------------------------------------ */
/* 사업 주체 — Organization / LocalBusiness                              */
/* ------------------------------------------------------------------ */

/** 브랜드의 공식 채널. 같은 주체임을 검색·AI 엔진에 알리는 sameAs 의 원천이다. */
export const BRAND_SAME_AS = [
  `https://www.instagram.com/${BRAND.instagram}/`,
  'https://www.instagram.com/usherindress/',
  'https://blog.naver.com/usherinmaking',
  // 구글 비즈니스 프로필(지도 업체 카드)과 LINE 공식계정. 검색엔진이 사이트·지도·SNS 를
  // 한 주체로 묶는 근거가 된다 — 브랜드명 검색에서 지식 패널이 이 목록을 참조한다.
  STUDIO_INFO.map.place,
  'https://line.me/R/ti/p/8Udy1kYg1l',
] as const;

/**
 * 검색어 사전 — 구조화 데이터의 keywords / alternateName 에만 쓴다.
 *
 * 화면에 보이는 문장은 작가의 말투를 지키느라 "오키나와에서 스냅 촬영" 처럼 조사가 들어가고,
 * 일본어는 "ウェディングフォト" 어순을 쓴다. 그런데 손님이 실제로 검색창에 치는 말은
 * "오키나와 웨딩스냅", "沖縄 フォトウェディング" 처럼 붙여 쓰거나 어순이 다르다.
 * 이 사전은 그 간극을 메운다 — 본문을 건드리지 않고, 검색엔진만 읽는 자리에 정확한 형태를 둔다.
 *
 * 전부 이 사이트가 실제로 하는 일을 다른 말로 쓴 것이다. 하지 않는 서비스는 넣지 않는다.
 */
export const SEARCH_TERMS: Record<Locale, readonly string[]> = {
  ko: [
    '오키나와 스냅',
    '오키나와 웨딩스냅',
    '오키나와 웨딩 스냅',
    '오키나와 웨딩촬영',
    '오키나와 허니문 스냅',
    '오키나와 셀프웨딩',
    '오키나와 커플 스냅',
    '오키나와 가족사진',
    '오키나와 만삭 촬영',
    '오키나와 한국인 작가',
  ],
  ja: [
    '沖縄 フォトウェディング',
    '沖縄 ウェディングフォト',
    '沖縄 前撮り',
    '沖縄 ロケーションフォト',
    '沖縄 スナップ',
    '沖縄 セルフウェディング',
    '沖縄 マタニティフォト',
    '沖縄 家族写真',
    '沖縄 記念日 撮影',
    '沖縄 韓国人 カメラマン',
  ],
  en: [
    'Okinawa wedding photographer',
    'Okinawa wedding photography',
    'Okinawa elopement photographer',
    'Okinawa pre-wedding photos',
    'Okinawa couple photoshoot',
    'Okinawa family photographer',
    'Okinawa maternity photos',
    'Okinawa photographer',
  ],
};

/** 브랜드의 다른 표기. 검색자가 한글로 치거나 띄어쓰기를 달리 해도 같은 주체로 묶인다. */
export const BRAND_ALTERNATE_NAMES = ['어셔린메이킹', 'usherin making', 'Usherin Making'] as const;

/** 사이트 전역에서 하나뿐인 Organization 노드의 @id. 다른 스키마가 provider/creator 로 참조한다. */
export const ORG_ID = `${SITE_URL}/#organization`;

/** 전 페이지 공통의 주소. STUDIO_INFO 가 원본이며 여기서만 PostalAddress 로 쪼갠다. */
function postalAddress() {
  return {
    '@type': 'PostalAddress',
    addressCountry: 'JP',
    addressRegion: 'Okinawa',
    addressLocality: 'Kitanakagusuku, Nakagami District',
    postalCode: '901-2302',
    streetAddress: '1868 Toguchi',
  };
}

/**
 * 독립 Organization. 브랜드 지식 패널·엔티티 일관성의 기준점이다.
 * 모든 언어 페이지가 같은 @id 를 내보내므로 검색엔진이 세 언어를 한 주체로 묶는다.
 */
export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: BRAND.name,
    alternateName: [...BRAND_ALTERNATE_NAMES],
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/logo.png` },
    sameAs: [...BRAND_SAME_AS],
    telephone: STUDIO_INFO.phoneIntl,
    address: postalAddress(),
    // 세 언어로 응대한다는 사실. 한국어·일본어·영어 검색 모두에서 이 주체가 답할 수 있음을 뜻한다.
    knowsLanguage: ['ja', 'en', 'ko'],
  };
}

export type LocalBusinessInput = {
  locale: Locale;
  /** 페이지의 설명문을 그대로 쓴다 — 별도 문구를 만들지 않는다. */
  description: string;
  /** 대표 이미지 절대 URL */
  image: string;
  /** 관리자 설정의 좌표. 없으면 geo 를 내보내지 않는다 — 지어내지 않는다. */
  geo?: { lat: number; lng: number } | null;
  /** 플랜 가격으로 만든 Offer 목록. 페이지별로 다르다. */
  offers: object[];
};

/**
 * 지역 검색용 LocalBusiness. 세 언어 모두 같은 @id 로 같은 사업장을 가리킨다.
 *
 * openingHours 는 넣지 않는다 — 상담 후 일정을 잡는 예약제라 고정 영업시간이라는
 * 사실이 없다. 없는 사실을 구조화 데이터로 적으면 검색 결과에 거짓 영업시간이 뜬다.
 * priceRange 는 플랜 최저가~최고가(¥25,000~¥150,000)를 그대로 적는다.
 */
export function localBusinessLd(input: LocalBusinessInput) {
  const { locale, description, image, geo, offers } = input;
  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': `${SITE_URL}/#business`,
    name: BRAND.name,
    alternateName: [...BRAND_ALTERNATE_NAMES],
    description,
    // 검색자가 실제로 치는 형태. 본문은 작가 말투를 지키고, 검색엔진용 자리에만 정확 형태를 둔다.
    keywords: SEARCH_TERMS[locale].join(', '),
    url: `${SITE_URL}${homePath(locale)}`,
    logo: `${SITE_URL}/brand/logo.png`,
    image,
    sameAs: [...BRAND_SAME_AS],
    parentOrganization: { '@id': ORG_ID },
    telephone: STUDIO_INFO.phoneIntl,
    address: postalAddress(),
    ...(geo
      ? { geo: { '@type': 'GeoCoordinates', latitude: geo.lat, longitude: geo.lng } }
      : {}),
    // 촬영 지역. 스튜디오 주소와 별개로 "오키나와 전역"에서 촬영한다는 사실이다.
    areaServed: { '@type': 'AdministrativeArea', name: 'Okinawa, Japan' },
    priceRange: '¥25,000 - ¥150,000',
    knowsLanguage: ['ja', 'en', 'ko'],
    amenityFeature: {
      '@type': 'LocationFeatureSpecification',
      name: STUDIO_INFO.parking[locale],
      value: true,
    },
    makesOffer: offers,
  };
}

/** 두 JSON-LD 를 한 script 로 내보낼 때의 직렬화. `</script>` 가 본문에 섞여도 깨지지 않게 한다. */
export function ldJson(...objects: object[]): string {
  return JSON.stringify(objects.length === 1 ? objects[0] : objects).replace(/</g, '\\u003c');
}
