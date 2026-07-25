---
id: SPEC-UIM-RENEWAL-001
kind: plan
updated: 2026-07-26
---

# 구현 계획 — SPEC-UIM-RENEWAL-001

## 1. 스택 선택과 근거

| 항목 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | Next.js 15 App Router + TypeScript | 기존 배포가 Vercel. 승인 즉시 정적 재생성(ISR)이 필요하고, 이미지 최적화가 내장 |
| 스타일 | **CSS Modules + CSS 변수** (Tailwind 아님) | 시안이 hifi이고 `font` 단축 표기·정확한 px 값으로 확정되어 있다. 유틸리티 클래스로 옮기면 시안과의 대조가 어려워지고, 토큰이 두 곳(설정 파일 + 클래스)으로 갈린다 |
| 국제화 | `[locale]` 세그먼트 직접 구현 | 3개 언어가 서로의 번역이 아니라 독립 본문이다. 번역 키 사전(next-intl 등)은 "같은 문장의 다른 언어"를 전제하므로 이 구조와 맞지 않는다 |
| DB | Postgres + Prisma (스키마만) | 사진·분류·문의·플랜이 관계형이다. 이번 범위에서는 스키마와 이관 지점까지 |
| 검증 | zod | 이미 의존성에 있고 API 경계 검증에 충분하다 |

### 의존성을 늘리지 않은 것

`next` / `react` / `zod` 외에 아무것도 추가하지 않았다. 탭·필터·폼은 모두 작은
클라이언트 컴포넌트로 충분했고, UI 라이브러리를 넣으면 시안의 확정된 여백·서체와
싸우게 된다.

## 2. 정보 구조 결정

### 2.1 로케일 라우팅

`src/app/layout.tsx` 는 통과만 시키고, `src/app/[locale]/layout.tsx` 가 `<html lang>` 과
`<body>` 를 렌더한다. 루트 레이아웃은 `[locale]` 파라미터를 볼 수 없어 `lang` 을 정할 수
없기 때문이다. 이는 Next.js i18n 라우팅의 표준 형태다.

### 2.2 요금 페이지 세그먼트

`en` 만 `/plans`, `ja`·`ko` 는 `/plan` 이다. `ROUTE_SEGMENT` 가 이 매핑의 단일 출처이고,
`path(locale, 'plan')` 이 알아서 올바른 경로를 만든다.

두 라우트(`plan/`, `plans/`)가 모두 존재하되, 각자 자기 로케일이 아니면 `notFound()` 를
낸다. 그러지 않으면 `/en/plan` 과 `/en/plans` 가 둘 다 200이 되어 canonical이 중복된다.

### 2.3 갤러리 필터

필터를 쿼리스트링이 아니라 경로로 둔 것이 이 SPEC에서 가장 큰 SEO 결정이다.
`?place=studio` 는 색인되지 않지만 `/gallery/studio/self-wedding` 은 독립 페이지다.

축 순서는 `place → session → mood` 로 고정한다. 순서가 어긋나거나 같은 축이 두 번
나오거나 모르는 slug면 404다. 순서를 자유롭게 두면 같은 내용이 여러 URL로 색인된다.

term은 번역이 있는 로케일에서만 노출된다. 따라서 hreflang도 그 term이 실제로 사는
로케일에만 걸어야 한다 — 없는 로케일을 가리키면 존재하지 않는 URL을 상호 지정하게 된다.

## 3. 콘텐츠 배치

```
src/content/site.ts      플랜·가격·세트·채널·스튜디오 정보  ← 여러 페이지가 공유
src/content/taxonomy.ts  갤러리 분류 축과 term
src/content/photos.ts    사진 시드
src/content/journal.ts   촬영후기 시드 (전부 isSample)
src/content/dress.ts     드레스 컬렉션
src/app/[locale]/*/content.ts   해당 페이지만 쓰는 문구
```

가격은 `site.ts` 에만 존재한다. 페이지가 숫자를 직접 적으면 관리자 화면에서 고쳐도
페이지가 따라오지 않으므로, 인수 조건에 grep 검사(AC-BR-05)를 넣었다.

## 4. 서버 계층

```
src/server/photos.ts  inquiries.ts  plans.ts  taxonomy.ts  journal.ts  ...
```

각 모듈은 **최종 시그니처**로 지금 존재하고, 내부는 `src/content/*` 를 읽는다.
쓰기 경로는 `TODO(prisma)` 로 표시하고 **성공을 반환하지 않는다** — 미구현을 명시적으로
알린다. DB를 붙일 때 이 함수들의 몸통만 바꾸면 되도록 필드 이름을 스키마와 맞췄다.

거짓 성공을 반환하지 않기로 한 이유는, 관리자가 사진을 게시했다고 믿었는데 실제로는
아무 일도 일어나지 않는 상황이 데이터 손실보다 발견이 늦기 때문이다.

## 5. 파이프라인 설계

```
Cron (6h)
  └─ Instagram Graph API 전량 조회
      └─ 신규만 최대 해상도 다운로드 → 오브젝트 스토리지 원본 보관
          └─ AI 배치: 카테고리 추천 + alt 초안 (ja/en/ko)
              └─ status = UNSORTED 로 저장
                  └─ 관리자 전시 선별 → PUBLISHED
                      └─ AVIF/WebP 다중 사이즈 생성 → CDN
                          └─ ISR 재검증
```

자격 증명이 없으므로 각 외부 호출은 `src/lib/image-pipeline.ts` 의 이름 붙은 함수 뒤에
있고, 환경 변수가 없으면 크론은 **503과 사유**를 반환한다. 성공한 것처럼 기록하지 않는다.

크론 자체는 `CRON_SECRET` 으로 가린다. 가리지 않으면 누구나 수집을 트리거할 수 있다.

## 6. 병렬 실행 방식

작업을 **파일 경로로 분할**해 8개 에이전트를 동시에 돌렸다. 동시 쓰기의 실제 위험은
"백그라운드 실행"이 아니라 **같은 파일에 대한 경합**이므로, 겹치지 않는 소유권을 준
것이 안전장치다.

| 담당 | 소유 경로 |
|---|---|
| 홈 | `src/app/[locale]/page.*`, `src/components/home/**` |
| 스튜디오·로케이션 | `src/app/[locale]/{studio,location}/**` |
| 요금·드레스 | `src/app/[locale]/{plan,plans,dress}/**` |
| 작가·후기·404 | `src/app/[locale]/{photographer,journal}/**`, `not-found`, `src/content/journal.ts` |
| 갤러리·문의 | `src/app/[locale]/{gallery,contact}/**`, `src/app/api/contact`, `src/content/{taxonomy,photos}.ts` |
| 관리자 셸·사진 | `src/app/admin/{,photos,media}/**`, `src/components/admin/**`, 파이프라인 |
| 관리자 문의·플랜 | `src/app/admin/{inquiries,plans,taxonomy,seo}/**` |
| 관리자 콘텐츠·설정 | `src/app/admin/{journal,translations,dress,settings}/**` |
| 오케스트레이터 | 토큰·레이아웃·i18n·스키마·sitemap·robots·법적 고지·SPEC |

공유 계약이 어긋나면 파일을 직접 고치지 않고 소유자에게 알린다.
실제로 `JOURNAL_POSTS` 의 형태(평면 배열 대 로케일별 맵)에서 한 번 발생했고,
평면 배열로 정한 이유는 sitemap의 배열 가드가 맵 형태를 조용히 통째로 건너뛰어
저널 URL이 전부 색인에서 빠지기 때문이다.

## 7. 알려진 절충

| 절충 | 이유 | 승격 조건 |
|---|---|---|
| CSP `script-src 'unsafe-inline'` | Next.js 부트스트랩 인라인 스크립트 | nonce 방식은 전 페이지를 동적 렌더링으로 만든다. 정적 캐시 이득과 저울질 후 결정 |
| 관리자 인증이 단일 토큰 | 정식 인증 제공자 미결정 | 운영 시작 전 반드시 교체 |
| 콘텐츠가 TS 모듈 | DB 미연결 | `src/server/*` 몸통 교체로 이관 |
| 로고가 PNG | SVG 원본 미수령 | 인쇄·대형 표시 전 SVG 필요 |

## 8. 검증 순서

1. `npx tsc --noEmit`
2. `npm run build` — 라우트 충돌·누락 export를 여기서 잡는다
3. `npm run lint`
4. 인수 조건 `acceptance.md` 의 grep 감사
5. 배포 후 Lighthouse 실측 (이번 범위 밖)
