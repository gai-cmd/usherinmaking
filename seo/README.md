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
