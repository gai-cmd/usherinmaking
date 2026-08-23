import { SITE_URL, homePath, path, type Locale, type PageKey } from '@/lib/i18n';

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

/** 두 JSON-LD 를 한 script 로 내보낼 때의 직렬화. `</script>` 가 본문에 섞여도 깨지지 않게 한다. */
export function ldJson(...objects: object[]): string {
  return JSON.stringify(objects.length === 1 ? objects[0] : objects).replace(/</g, '\\u003c');
}
