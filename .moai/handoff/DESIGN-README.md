# Handoff: usherinmaking 리뉴얼 (오키나와 웨딩 포토 스튜디오)

## Overview

오키나와에서 활동하는 한국인 여성 사진작가 **usherinmaking**의 웹사이트 리뉴얼입니다.
기존에는 **LOCATION(야외 로케이션 촬영)** 단일 사업이었으나, **STUDIO(실내 스튜디오)** 가 새로 생기면서 이를 두 개의 동등한 축으로 재구성했습니다.

핵심 목표 3가지:
1. LOCATION / STUDIO 2대 축 구조로 사이트를 다시 짠다
2. 3개 언어(日本語 기본 / English / 한국어)를 각각 독립된 본문으로 운영한다
3. Instagram에 쌓인 사진을 **전량 자동 수집 → 관리자가 전시할 것만 선택 → 자사 도메인에서 서빙** 하는 파이프라인을 만든다 (임베드·아웃링크 사용 안 함, SEO/AEO 손실 방지)

## About the Design Files

이 번들의 `.dc.html` 파일들은 **HTML로 만든 디자인 레퍼런스(프로토타입)** 입니다. 그대로 배포할 프로덕션 코드가 아닙니다.
목표는 이 디자인들을 **타깃 코드베이스의 환경에서 재현**하는 것입니다. 현재 코드베이스가 없다면 아래 "권장 스택"을 참고해 프레임워크를 선택하고 그 위에 구현하세요.

각 파일은 하나의 캔버스 위에 여러 화면(카드)을 나열한 형태입니다. 카드 하나 = 실제 페이지 하나입니다. 카드 바깥의 배지·라벨(`dv-*` 클래스)은 리뷰용 UI이므로 구현 대상이 아닙니다.

## Fidelity

**High-fidelity (hifi)** — 색상·타이포그래피·간격·문구가 모두 확정된 상태입니다. 픽셀 단위로 재현하되, 코드베이스의 기존 컴포넌트/유틸리티가 있다면 그것으로 대체하세요.
단, `Renewal Wireframes.dc.html` 만 **low-fidelity** (구조·플로우 참고용)입니다.

---

## 권장 스택

| 항목 | 권장 | 이유 |
|---|---|---|
| 프레임워크 | **Next.js (App Router) + TypeScript** | 기존 배포가 Vercel. ISR로 승인 즉시 정적 재생성. 이미지 최적화 내장 |
| 호스팅 | Vercel | 현행 유지 |
| DB | Postgres (Neon / Supabase) + Prisma | 사진·카테고리·문의·플랜을 관계형으로 |
| 이미지 저장 | 오브젝트 스토리지 (S3 / R2) + CDN | 인스타 원본을 자사 보관, AVIF/WebP 다중 사이즈 재인코딩 |
| 수집 | Vercel Cron → Instagram Graph API | 6시간 주기 전량 수집 |
| AI 분류 | 서버 사이드 배치 (이미지 → 카테고리/alt 추천) | 추천만, 확정은 관리자 |
| 국제화 | next-intl 또는 App Router의 `[locale]` 세그먼트 | /ja /en /ko + hreflang |
| 폼/메일 | DB 저장 + 메일·LINE 알림 (Resend 등) | **DB가 원본, 메일은 알림** |

---

## 확정된 사업 규칙 (반드시 지킬 것)

- 브랜드 표기는 한 단어 **usherinmaking** (띄어쓰기 없음). 헤더·푸터·OG는 텍스트가 아니라 **로고 이미지(SVG)**
- 드레스 브랜드명 없음 — DRESS 페이지는 컬렉션만
- **자동 예약·캘린더 예약 기능 없음.** 문의 → 상담으로만 확정. RESERVE 페이지는 삭제하고 그 자리에 PHOTOGRAPHER
- LOCATION은 **지역이 아니라 촬영 카테고리** 기준 (WEDDING / ANNIVERSARY)
- LOCATION과 STUDIO는 완전 분리. "우천 시 스튜디오로 대체" 같은 문구 없음
- 인스타그램 **임베드·아웃링크 사용 안 함**. 사진은 전부 자사 도메인에서 서빙
- **이메일 주소는 사이트에 노출하지 않는다.** 언어별 채널: KO = 카카오톡 + Instagram / JA = LINE + Instagram / EN = Instagram. 공통은 문의 폼(DB 저장)
- 근거 없는 수치·사실 금지. 미확정은 `（要確認）` / `(to be confirmed)` / `(확인 필요)` 로 표기

---

## 정보 구조 (IA)

```
HOME  (좌우 반반 스플릿 게이트: LOCATION | STUDIO)
├─ STUDIO            실내
│   ├─ 세트 4개: アーチ窓・自然光 / ドレスルーム / ヴィンテージ コーナー / モノトーン コーナー
│   ├─ 촬영 당일 스케줄 6단계
│   ├─ STUDIO PLAN 01~04
│   └─ 아쿠세스 (구글맵 임베드 + 주차 2대)
├─ LOCATION          실외 — 카테고리 기준
│   ├─ WEDDING       본식 전 웨딩 / 리마인드 웨딩 / 셀프 웨딩 / 스튜디오+로케이션
│   ├─ ANNIVERSARY   가족 / 백일·돌(JA: 七五三) / 만삭 / 커플 / 기념일 / 프로필
│   └─ 월별 아카이브 (맑은 날·흐린 날·벚꽃·노을·비)
├─ DRESS             컬렉션 + 대여 조건 + 고르는 순서
├─ PLAN              스튜디오/로케이션/기념사진/헤어메이크업 탭 + 옵션표 + 계약 흐름 + 취소 규정
├─ PHOTOGRAPHER      작가 소개 (RESERVE 자리)
├─ JOURNAL           촬영후기 (목록 / 상세)
├─ GALLERY           전체 목록 (필터) / 작품 상세
├─ CONTACT           폼 + 언어별 메신저
└─ 404               noindex
```

### URL 설계

| 페이지 | /ja (기본) | /en | /ko |
|---|---|---|---|
| 홈 | `/ja` | `/en` | `/ko` |
| 스튜디오 | `/ja/studio` | `/en/studio` | `/ko/studio` |
| 로케이션 | `/ja/location` | `/en/location` | `/ko/location` |
| 드레스 | `/ja/dress` | `/en/dress` | `/ko/dress` |
| 요금 | `/ja/plan` | `/en/plans` | `/ko/plan` |
| 작가 소개 | `/ja/photographer` | `/en/photographer` | `/ko/photographer` |
| 촬영후기 | `/ja/journal` `/ja/journal/[slug]` | 동일 | 동일 |
| 갤러리 | `/ja/gallery` `/ja/gallery/[slug]` | 동일 | 동일 |
| 문의 | `/ja/contact` | `/en/contact` | `/ko/contact` |

- 갤러리 **필터는 쿼리스트링이 아니라 경로**로: `/ja/gallery/studio/self-wedding`, `/ko/gallery/location/family` 등. 각 조합은 독립 페이지 + canonical
- 언어 감지: 최초 진입 시 `Accept-Language` / `navigator.language` 로 자동 리다이렉트, 헤더에서 수동 전환 가능, 선택은 쿠키에 저장
- 모든 페이지에 `hreflang` 상호 지정 + `x-default`

---

## 화면별 사양

카드는 데스크톱 **1200px**, 모바일 **375px** 기준으로 그려져 있습니다. 브레이크포인트는 **375 / 768 / 1024 / 1280+** 4단계.

### 1. HOME
- **헤더**: 로고 SVG 중앙 정렬(데스크톱) / 좌측(모바일), 그 아래 가로 내비. 우측 끝 언어 전환
- **히어로**: `display:grid; grid-template-columns:1fr 1fr; height:600px`. 좌 LOCATION / 우 STUDIO. 각 패널 = 배경 이미지 + 하단 그라데이션(`linear-gradient(to top, rgba(30,26,22,.5), transparent 55%)`) + 카피 + 아웃라인 버튼. **패널 전체가 링크** (`/ja/location`, `/ja/studio`)
- 모바일에서는 위아래 2단, 각 250px (두 패널이 한 화면에 다 들어오게)
- **h1 + 정의형 리드문**: 히어로 바로 아래. AEO의 핵심이므로 이미지가 아닌 실제 텍스트
- 이후 순서: STUDIO PLAN(4열) → 옵션 + 상세 CTA → 스튜디오 세트 4 → LOCATION PLAN(3열) + 주의사항 → 최근 작품(인스타 선별) → PHOTOGRAPHER → FAQ → CONTACT
- 모바일 하단 **sticky CTA 2버튼** (44px 이상)

### 2. STUDIO
히어로(500px) → 정의형 리드 → 세트 4개(아치형 마스크: `border-radius:140px 140px 0 0`) → 촬영 당일 스케줄 6단계 → STUDIO PLAN 4열 → 아쿠세스(사진 + 구글맵) → 스튜디오 작품 → CONTACT

### 3. LOCATION
히어로(500px) → 정의형 리드 → **카테고리 2장**(WEDDING / ANNIVERSARY, 아치 마스크 400px) → 각 카테고리 내역 칩 + 월별 아카이브 → LOCATION PLAN 3열 + 주의사항 → 작품 그리드 → CONTACT

### 4. PLAN
탭(스튜디오/로케이션/기념사진/헤어메이크업) → 플랜 카드 2×2(포함 내역 전체) → **옵션 표**(옵션 / 가격 / 대상 플랜·비고 3열) → 헤어메이크업 요금 → 계약 흐름 4단계 → 취소·우천 규정

### 5. DRESS
좌 이미지 + 우 리드(520px) → 컬렉션 그리드 4 + 필터 → 대여 조건 표 → 고르는 순서 4단계 → CONTACT

### 6. PHOTOGRAPHER
좌 포트레이트(600px, **사진 미수령 — placeholder**) + 우 소개 → 이름의 유래 → 촬영 방식 3 → 이미지 3분할 → 언어 안내 + SNS → CONTACT

### 7. JOURNAL
목록: 피처드 1 + 3열 카드 6 + 카테고리 필터. 상세: 900px 읽기 폭, 인용문(좌측 브라스 보더), 2컷 비교 + 캡션, **글 하단에 해당 플랜 CTA**, 관련 글 3
※ 현재 글 내용은 전부 **샘플**입니다 (배지로 표시). 실제 원고로 교체 필요

### 8. GALLERY
필터 3축(장소 / 촬영 종류 / 세트·계절) → 5열 그리드 → MORE.
상세: 대형 이미지 + 스토리 1문단 + 메타(플랜·소요시간·세트·드레스) + 「이 분위기로 상담」 CTA + 같은 세트 작품

### 9. CONTACT
좌 폼(이름·이메일·촬영 종류 칩·희망 날짜·인원·답변 언어·상담 내용) + 우 메신저 카드 / FAQ / 스튜디오 정보 + 구글맵.
**언어별 채널** (이메일 주소는 노출하지 않음): KO = 카카오톡 + Instagram / JA = LINE + Instagram / EN = Instagram. 공통은 문의 폼(DB 저장). 1순위 채널만 검은 블록으로 강조.
하단에 "자동 예약 없음" 명시. 모바일은 메신저 카드를 폼보다 **위**에 배치

### 10. 404
좌 이미지 + 우 안내 + 주요 페이지 4카드. `noindex`

---

## Design Tokens

```
/* Color */
--bg            #FAF8F4   기본 배경
--bg-alt        #F4F1EA   섹션 교차 배경 (배경색은 이 2개만 사용)
--text          #2E2A25
--text-body     #3F3A33
--muted         #5F584E   본문 보조 (6.6:1)
--muted-2       #6F685C   메타·라벨 (4.5:1) — 이보다 밝게 쓰지 말 것
--brass         #8A6A3F   포인트 (4.7:1)
--hairline      #E2DDD3
--hairline-2    #ECE7DD   표 내부 구분선
--placeholder   #E6E1D6   이미지 자리표시자
--dark          #2E2A25   버튼 배경 / 다크 섹션
```

```
/* Type */
JA 제목·본문   'Zen Old Mincho', serif
JA UI·보조     'Zen Kaku Gothic New', sans-serif
KO 제목        'Nanum Myeongjo', serif
KO 본문·UI     'Noto Sans KR', sans-serif
EN 본문·UI     'Jost', sans-serif        ← EN은 명조 쓰지 않음
공통 디스플레이 'Cormorant Garamond', serif (영문 대제목 전용)
숫자·금액       Jost  ← 한국어 페이지에서 Cormorant를 쓰면 올드스타일 숫자가 어긋나 보임. 금액은 반드시 Jost
```

주요 스케일: 대제목 `300 54–62px/1.1 Cormorant` · 섹션 제목 `300 38–40px/1.2 Cormorant` · h1 리드 `400 26px/2.1 명조` · 본문 `400 13–13.5px/2.1` · 라벨 `400 10px/1 Jost, letter-spacing .4em` · 메타 `400 11.5–12px/1.9`

```
/* Spacing */
섹션 상하 패딩   데스크톱 56–74px / 모바일 30px
좌우 거터        데스크톱 54px / 모바일 18px
그리드 gap       12–24px
카드 내부        18–36px
```

```
/* Radius & Motion */
아치 마스크      border-radius: 140px 140px 0 0   (데스크톱 세트 카드)
                 border-radius: 200px 200px 0 0   (로케이션 카테고리 카드)
                 border-radius: 75–120px 75–120px 0 0 (모바일)
그 외            0 (사각형 유지)
그림자           사용하지 않음. 구분은 1px hairline으로
트랜지션         180–240ms ease — 링크 밑줄, 버튼 반전 정도로 최소화
```

**모바일 규칙**: 모든 탭 타겟 **최소 44px** (`min-height:44px; box-sizing:border-box; display:flex; align-items:center`). 가로 스와이프 캐러셀은 카드가 살짝 잘려 보이게(어피던스), 단 **텍스트 칩이 잘리면 안 됨**.

**문장부호 규칙**: 영문 페이지에 `・`(U+30FB) `／` `〜` `　`(전각공백) 금지. 한국어 페이지에 `＋`(전각 플러스) 금지 — ASCII `+`, `·`, `/` 사용.

---

## 데이터 모델 (제안)

```prisma
model Photo {
  id           String   @id @default(cuid())
  igMediaId    String?  @unique      // 인스타 원본 id (수동 업로드는 null)
  originalUrl  String                // 자사 스토리지 원본
  variants     Json                  // { avif: {400,800,1600}, webp: {...} }
  width        Int
  height       Int
  caption      String?
  takenAt      DateTime
  status       PhotoStatus @default(UNSORTED)  // UNSORTED | PUBLISHED | ARCHIVED
  lowRes       Boolean  @default(false)
  alt          Json                  // { ja, en, ko }
  story        Json?                 // 작품 상세 1문단 { ja, en, ko }
  aiSuggestion Json?                 // [{ taxonomyId, termId, score }]
  terms        PhotoTerm[]
  isCover      Boolean  @default(false)
}

model Taxonomy {         // 축: place / shootType / set / season …  관리자가 추가 가능
  id       String @id @default(cuid())
  key      String @unique
  label    Json
  order    Int
  terms    Term[]
}

model Term {
  id         String @id @default(cuid())
  taxonomyId String
  slug       String            // URL 세그먼트
  label      Json              // { ja, en, ko }
  parentId   String?           // 세트는 STUDIO 하위 등
  order      Int
  photos     PhotoTerm[]
}

model Plan {
  id        String @id @default(cuid())
  code      String @unique     // studio-01 …
  scope     Scope              // STUDIO | LOCATION | ANNIVERSARY
  title     Json
  listPrice Int?
  price     Int
  taxIncluded Boolean          // 로케이션·기념사진만 true
  duration  Json
  cuts      Int?
  includes  Json               // string[] per locale
  order     Int
  options   PlanOption[]
}

model Option {
  id       String @id @default(cuid())
  label    Json
  price    Json               // { amount, suffix } 또는 범위
  note     Json
  plans    PlanOption[]
}

model Inquiry {
  id        String @id @default(cuid())
  name      String
  email     String
  locale    String            // ja | en | ko
  shootType String
  dates     String?
  people    String?
  message   String
  status    InquiryStatus @default(NEW)  // NEW | WAITING | DONE | HOLD | SPAM
  memo      String?
  createdAt DateTime @default(now())
  repliedAt DateTime?
}

model JournalPost {
  id        String @id @default(cuid())
  slug      String @unique
  locale    String
  category  String
  title     String
  body      String
  cover     String
  planCode  String?           // 글 하단 CTA에 쓸 플랜
  source    String?           // naver-blog | manual
  publishedAt DateTime?
}
```

---

## 인스타그램 파이프라인

```
Cron (6h)
  └─ Instagram Graph API: 계정 @usherinmaking 게시물 전량 조회
      └─ 신규만 다운로드 (최대 해상도) → 오브젝트 스토리지에 원본 보관
          └─ AI 배치: 카테고리 추천 + alt 초안 (ja/en/ko)
              └─ status = UNSORTED 로 DB 저장
                  └─ 관리자 "전시 선별" 화면에서 체크 → PUBLISHED
                      └─ AVIF/WebP 다중 사이즈 생성 → CDN
                          └─ ISR 재검증 (해당 갤러리 경로들)
```

- **수동 업로드**도 같은 큐(UNSORTED)로 들어옴
- `PUBLISHED` 만 프론트 노출. `ARCHIVED` 는 서버에 남지만 비공개
- 「최근 작품」은 PUBLISHED 중 `takenAt` 최신순 자동 — 오래된 사진이 남지 않음
- 저해상도(장변 2000px 미만 등)는 경고 배지 + 원본 교체 업로드 유도
- alt는 반드시 3개 언어. 파일명도 의미 있는 슬러그로

---

## 관리자 (UI는 한글, 콘텐츠는 원 언어 유지)

관리자 화면은 `Admin Design.dc.html` 에 10화면(턴1 5개 + 턴2 5개)이 있습니다.

1. **대시보드** — 미선별 / 전시중 / 신규 문의 / 요대응(alt 미설정·미번역) + 최근 활동
2. **사진 수집 · 전시 선별** — 그리드 + 체크박스, AI 추천 배지(신뢰도 %), 우측 상세 패널(카테고리 드롭다운·alt·전시/보관/대표컷), 일괄 처리
3. **문의 INBOX** — 상태 탭, 좌측 목록 + 우측 상세, 답변 템플릿, **문의 → FAQ 승격** 버튼, 메모. DB가 원본이고 메일·LINE은 알림
4. **플랜 · 옵션** — 수정 시 홈·상세 동시 반영, 상세 페이지 미리보기
5. **카테고리 관리** — 축 추가 시 갤러리 필터와 URL 자동 생성
6. **번역 JA/EN/KO** — 미번역 자동 표시
7. **SEO / AEO** — 페이지별 정의형 리드문 편집, alt 미설정 목록, 구조화 데이터 상태
8. **촬영후기** — 네이버 블로그 자동 가져오기 → 임시저장 → 사진 교체·문장 정리·번역 → 게시
9. **번역 JA/EN/KO** — 키별 3열 대조, 미번역 하이라이트, 기계번역은 초안까지만
10. **드레스 관리** — 목록 + 우측 상세(사진·3언어 설명·사이즈·추가요금·공개여부)
11. **설정** — 로고 교체, 주소(일본어 표기 / 영문 표기 각각), 주차, 구글맵 좌표, 언어별 상담 채널 URL
12. **미디어 라이브러리 · 활동 로그** — 저해상도·alt 미설정 필터, 스토리지 용량, 최근 활동

---

## SEO / AEO 요구사항

- 페이지마다 **정의형 1문단**(질문 → 답 형태)을 본문 최상단에. AI 검색 인용의 핵심
- 구조화 데이터: `LocalBusiness`(주차·언어·좌표), `Service`, `Photograph` / `ImageObject`(alt·촬영일), `FAQPage`, `BreadcrumbList`
- FAQ는 **실제 문의 문장 그대로** (관리자에서 승격)
- 언어별 독립 본문 (기계번역 티 금지) + hreflang 상호 지정
- 이미지: AVIF/WebP, `width`/`height` 명시, 히어로만 eager, 나머지 `loading="lazy" decoding="async"` — LCP/CLS 관리
- 인스타 임베드 스크립트 미사용 (서드파티 JS 0에 가깝게)

---

## 스크린샷

`screenshots/` 에 각 시안의 첫 화면 캡처가 들어 있습니다. 세부는 반드시 원본 `.dc.html` 을 브라우저로 열어 확인하세요.

## Assets

- `img/s/IMG_*.png` — 스튜디오 실사진 8장의 **560px 축소본**(시안 경량화용). 원본은 `uploads/IMG_*.jpg` (4032px)
  - 0690 아치 창 / 0695 드레스룸(세로) / 0698 드레스 행거 / 0746 빈티지 코너 / 0747 모노톤 코너 / 0766 아치 창(장식) / 0769 아치 너머 드레스룸 / 0789 입구 웰컴 사인
- 로케이션 사진은 현행 사이트(`usherinmaking.vercel.app/images/up/*.jpg`)를 임시 참조 중 — **구현 시 자사 스토리지로 이관 필요**
- `img/logo.png` — 지급받은 로고를 배경 제거·6배 업스케일·트리밍한 것. 195×48 저해상도가 원본이므로 **인쇄·대형 표시용 벡터(SVG)는 별도 제작 필요**

### 아직 받지 못한 것
- 스튜디오 **주소** (일본어 표기 + 영문 표기 2종) · 나하공항에서 소요시간 — 구글맵 단축링크는 받았으나 크롤링 불가로 미반영
- 작가 포트레이트, 드레스 개별 컷
- 테라스 · 메이크업룸 사진 (세트를 6개로 확장 예정)
- 촬영후기 실제 원고 — `blog.naver.com/usherinmaking` 에서 10건을 가져오기로 했으나 네이버가 외부 접근을 막아 미반영. 현재 글은 전부 샘플이며, 구현 시에는 관리자의 「블로그에서 가져오기」(2a 화면)로 처리

---

## Files

| 파일 | 내용 |
|---|---|
| `Home A.dc.html` | JA 홈(확정안) + EN 홈 |
| `Pages A.dc.html` | JA 데스크톱 — STUDIO / LOCATION / PLAN / DRESS / CONTACT / PHOTOGRAPHER / JOURNAL / GALLERY / 404 |
| `Pages A Mobile.dc.html` | JA 모바일 + EN 홈 모바일 |
| `Pages A EN.dc.html` | EN 데스크톱 전 페이지 |
| `Pages A EN Mobile.dc.html` | EN 모바일 |
| `Pages A KO.dc.html` | KO 홈 (데스크톱 + 모바일) |
| `Pages A KO Sub.dc.html` | KO 하위 전 페이지 |
| `Pages A KO Mobile.dc.html` | KO 모바일 |
| `Admin Design.dc.html` | 관리자 5화면 |
| `Sitemap.dc.html` | 전체 구조 요약 |
| `Renewal Wireframes.dc.html` | (lofi) 구조·파이프라인 검토 자료 |
| `CLAUDE.md` | 프로젝트 규칙 요약 — 코드베이스 루트에 그대로 두면 유용 |

브라우저로 열면 바로 보이며, 여러 화면이 한 캔버스에 나열됩니다.

---

## 구현 순서 제안

1. Next.js + i18n 라우팅 골격, 디자인 토큰/폰트 세팅, 공통 헤더·푸터·언어 전환
2. 정적 페이지부터: HOME → STUDIO → LOCATION → PLAN (콘텐츠는 우선 하드코딩 후 DB로 이관)
3. DB 스키마 + 관리자 로그인, 플랜·옵션 CRUD
4. 인스타 수집 크론 + 스토리지 + 이미지 파이프라인
5. 전시 선별 화면 → 갤러리(경로 기반 필터) → 작품 상세
6. 문의 폼 + INBOX + 알림, FAQ 승격
7. JOURNAL, 구조화 데이터, sitemap.xml / robots.txt, 성능 측정
