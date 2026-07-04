# SEO / AEO 관리 (편집 가이드)

모든 페이지의 메타태그·구조화 데이터(JSON-LD)는 **`seo/seo.json` 한 곳**에서 관리합니다.
HTML을 직접 고치지 말고, 이 JSON을 수정한 뒤 스크립트를 실행하세요.

## 사용법

```bash
# 1) 현재 페이지들에서 값 추출 → seo.json 생성 (최초 1회 또는 재동기화 시)
python3 seo/build_seo.py extract

# 2) seo.json 편집 후, 전 페이지에 반영
python3 seo/build_seo.py apply
```

`apply`는 각 HTML의 `<!-- SEO:START --> … <!-- SEO:END -->` 구간만 다시 씁니다.
폰트·스타일시트 등 나머지 `<head>`는 건드리지 않습니다. 여러 번 실행해도 중복되지 않습니다.

## seo.json 구조

```jsonc
{
  "_site": {                      // 모든 페이지 공통 (사업자 정보)
    "name": "usher in making",
    "baseUrl": "https://usherinmaking.jp/",
    "businessType": "PhotographyBusiness",
    "logo": "...png",
    "description": "...",
    "areaServed": "Okinawa, Japan",
    "sameAs": ["https://instagram.com/usherinmaking", "..."],
    "defaultOgImage": "...jpg"
  },
  "pages": {
    "index.html": {
      "slug": "",                 // canonical = baseUrl + slug
      "title": "...",             // <title> / og:title / twitter:title
      "description": "...",       // meta description / og / twitter
      "keywords": "...",
      "ogType": "website",
      "ogImage": "...jpg",        // 비우면 defaultOgImage 사용
      "website": true             // → WebSite 스키마 출력 (홈에만)
    },
    "dress-annabel-white.html": {
      "slug": "product/annabel-white/",
      "title": "...", "description": "...",
      "breadcrumb": [["HOME","https://usherinmaking.jp/"],
                     ["DRESS","https://usherinmaking.jp/dress/"],
                     ["Annabel White","https://usherinmaking.jp/product/annabel-white/"]],
      "product": { "name": "Annabel White", "image": "...jpg", "description": "..." }
    },
    "gallery-family.html": {
      "slug": "portfolio/.../",
      "breadcrumb": [ ... ],
      "gallery": ["url1.jpg", "url2.jpg", "..."]   // → ImageGallery 스키마
    },
    "plan.html": {
      "faq": [["質問1","回答1"], ["質問2","回答2"]]   // → FAQPage 스키마 (AEO)
    }
  }
}
```

## 자동 출력되는 구조화 데이터 (AEO)

| 조건 | 스키마 |
|---|---|
| 모든 페이지 | `LocalBusiness`(PhotographyBusiness) |
| `"website": true` | `WebSite` |
| `"breadcrumb"` 존재 | `BreadcrumbList` |
| `"product"` 존재 | `Product` |
| `"gallery"` 존재 | `ImageGallery` |
| `"faq"` 존재 | `FAQPage` |

## 페이지 추가 시
`pages`에 새 항목을 추가하고 `python3 seo/build_seo.py apply` 실행.

## 함께 관리하면 좋은 것
- `sitemap.xml`, `robots.txt` (프로젝트 루트) — 페이지 추가 시 함께 갱신하세요.

## 2026-07-04 추가 규칙

- **FAQ 가시 섹션 자동 베이크**: `pages[*].faq`가 있으면 `apply`가 head의 FAQPage JSON-LD와 함께 본문에도 `<!-- FAQ:START --> … <!-- FAQ:END -->` 가시 Q&A 섹션을 주입합니다 (Google 구조화 데이터 정책: 마크업 내용은 화면에 보여야 함). faq는 `[["질문","답"], …]` 쌍 배열과 `[{"q":{ja,en},"a":{ja,en}}, …]` i18n 객체 두 형식 모두 지원.
- **noAlternate**: en/ 대역이 없는 페이지(privacy.html, tokushoho.html)는 항목에 `"noAlternate": true`를 두면 hreflang·og:locale:alternate를 내보내지 않습니다.
- **baseUrl 단일 소스**: `scripts/build_sitemap.py`와 `scripts/bake_blog.py`도 `_site.baseUrl`을 읽습니다. **커스텀 도메인 이전 시 변경 지점**: ① `_site.baseUrl` ② `robots.txt`의 Sitemap 줄 — 이 두 곳뿐입니다 (변경 후 `apply` + `python3 scripts/build_sitemap.py` 실행).
- **저자(E-E-A-T)**: `_site.authorName`에 촬영자 이름을 넣으면 블로그 기사 JSON-LD 저자가 Organization → Person(+about 링크)으로 전환됩니다.
- **미기입 항목(효과 큰 순)**: `_site`의 `telephone` / `email` / `address`(addressLocality·postalCode·streetAddress) / `geo`(위도·경도) / `openingHours` / `authorName`. 채우고 `apply` 한 번이면 전 페이지 반영.
