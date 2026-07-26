# usherinmaking — 오키나와 웨딩 포토 스튜디오

오키나와에서 활동하는 한국인 여성 사진작가 **usherinmaking** 의 웹사이트입니다.
**Next.js 15 App Router + TypeScript** 로 재구축했습니다.

기존 정적 HTML 사이트는 `legacy/` 에 그대로 보존되어 있습니다.

---

## 무엇이 바뀌었나

기존 사이트는 **LOCATION(야외 로케이션 촬영) 단일 사업** 을 전제로 만들어졌습니다.
**STUDIO(실내 스튜디오)** 가 새로 생기면서, 한 축을 다른 축 아래에 두는 구조로는 두 사업을
동등하게 보여줄 수 없게 되어 정보 구조부터 다시 짰습니다.

1. **LOCATION / STUDIO 2대 축** — 완전히 분리된 두 사업. 서로를 대체하지 않습니다.
2. **3개 언어 독립 본문** — 日本語(기본) / English / 한국어. 서로의 번역이 아닙니다.
3. **인스타그램 파이프라인** — 전량 자동 수집 → 관리자가 전시할 것만 선택 → 자사 도메인에서 서빙.
   임베드·아웃링크를 쓰지 않아 검색·AI 인용 노출을 잃지 않습니다.

---

## 시작하기

```bash
npm install
cp .env.example .env.local   # 값을 채운 뒤
npm run dev                  # http://localhost:3000
```

`/` 로 들어가면 브라우저 언어를 감지해 `/ja` `/en` `/ko` 중 하나로 보냅니다.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run typecheck` | 타입 검사 (`tsc --noEmit`) |
| `npm run lint` | ESLint |

---

## 구조

```
src/
  app/
    [locale]/            공개 페이지 — ja | en | ko
      page.tsx             HOME (좌우 반반 스플릿 게이트)
      studio/              STUDIO — 세트 4개 · 촬영 당일 스케줄 · 아쿠세스
      location/            LOCATION — WEDDING / ANNIVERSARY 카테고리 · 월별 아카이브
      dress/               DRESS — 컬렉션만 (브랜드명 없음)
      plan/ plans/         요금 — en 만 /plans, ja·ko 는 /plan
      photographer/        작가 소개 (구 RESERVE 자리)
      journal/             촬영후기 목록 · 상세
      gallery/             갤러리 — 필터가 경로다 (/gallery/studio/self-wedding)
      contact/             문의 폼 + 언어별 메신저
      privacy/ tokushoho/  법적 고지
    admin/               관리자 (UI 한국어, noindex)
    api/                 문의 · 관리자 · 인스타 수집 크론
    sitemap.ts robots.ts
  components/            공용 UI + 페이지별 컴포넌트
  content/               콘텐츠 모듈 (DB 이관 전 단일 출처)
  server/                레포지토리 계층 — Prisma 이관 지점
  lib/i18n.ts            로케일 · 경로 · hreflang
  middleware.ts          언어 감지 리다이렉트
prisma/schema.prisma     데이터 모델
legacy/                  이전 정적 사이트 (보존)
.moai/specs/             SPEC · 인수 조건
```

### 콘텐츠는 지금 어디에 있나

플랜·가격·세트·상담 채널 같은 확정 사실은 `src/content/site.ts` 한 곳에 있습니다.
페이지는 이 모듈에서 읽어 쓰며, **가격을 페이지에 직접 적지 않습니다.**

`prisma/schema.prisma` 의 필드 이름을 이 모듈들과 맞춰 두었으므로, DB를 붙일 때는
`src/server/*` 의 읽기 함수만 Prisma 호출로 바꾸면 됩니다.

---

## 지켜야 하는 사업 규칙

코드 리뷰에서 이 항목들은 취향이 아니라 **결함 판정 기준** 입니다.

| 규칙 | |
|---|---|
| 브랜드 | 한 단어 `usherinmaking`. 헤더·푸터·OG는 텍스트가 아니라 로고 이미지 |
| 두 축 | LOCATION과 STUDIO는 완전 분리. "우천 시 스튜디오로 대체" 같은 문구를 쓰지 않습니다 |
| LOCATION | 지역이 아니라 **촬영 카테고리** 기준 (WEDDING / ANNIVERSARY) |
| 예약 | **자동 예약·캘린더 예약이 없습니다.** 문의 → 상담으로만 확정합니다 |
| 사진 | 인스타 임베드·아웃링크 사용 안 함. 전부 자사 도메인에서 서빙 |
| 드레스 | 브랜드명 없음. 컬렉션만 |
| 가격 | 스튜디오는 모니터 가격(税込 표기 없음), 로케이션·기념사진만 税込 |
| 상담 채널 | KO = 카카오톡 / JA = LINE / EN = 폼·이메일. **이메일 주소는 노출하지 않습니다** |
| 네이버 블로그 | 한국어 페이지에만 안내합니다 |
| 문의 | **DB가 원본이고 메일은 알림입니다.** 알림 실패가 문의 유실이 되면 안 됩니다 |
| 미확정 사실 | 근거 없는 수치를 쓰지 않고 `（要確認）`/`(to be confirmed)`/`(확인 필요)` 로 표기합니다 |

---

## 디자인

확정안은 **Classic Editorial** 입니다. 토큰은 `src/app/globals.css` 한 곳에 있습니다.

- 배경은 `#FAF8F4` / `#F4F1EA` **두 가지만** 교차합니다
- 포인트는 브라스 `#8A6A3F`
- 서체는 **애플 시스템 서체** 를 씁니다. 웹폰트를 내려받지 않으므로 렌더 차단 요청이 없습니다
  - **세 언어 모두 고딕입니다. 명조·세리프를 쓰지 않습니다** — apple.com/kr 제품 페이지가 기준입니다
  - 라틴 본문 · UI — SF Pro (`-apple-system`)
  - 라틴 대제목 — SF Pro Display. "Location" "Studio" 같은 큰 영문 단어가 여기에 해당합니다
  - 일본어 — 히라기노 고딕 (Hiragino Sans)
  - 한국어 — Apple SD 산돌고딕 Neo
  - **금액·숫자는 언제나 SF의 등폭 숫자** (`u-num`)
  - 비애플 환경에는 각 스택 뒤의 대체 서체가 적용됩니다
  - 제목 서체는 `--ff-heading` 하나로 갈라집니다. `.u-display` · `.u-h2` · `.u-lead` 가 그것을 읽으므로,
    로케일별 제목 서체를 바꾸려면 `:lang()` 블록의 `--ff-heading` 만 고치면 됩니다

> **시안과의 의도된 차이**: `.moai/handoff/DESIGN-README.md` 의 서체표는 웹폰트 기준(Cormorant Garamond ·
> Nanum Myeongjo · Zen Old Mincho)입니다. 실제 구현은 웹폰트를 걷어내고 애플 시스템 서체로 갔고,
> 이후 사용자 지시로 **명조 계열을 전부 고딕으로** 바꿨습니다. 시안 문서는 인계 기록이라 그대로 두고,
> 구현 기준은 이 절입니다.
- 아치가 브랜드 모티프입니다 (`border-radius: 140px 140px 0 0`)
- **그림자를 쓰지 않습니다.** 구분은 1px 헤어라인으로 합니다
- 모바일 탭 타겟은 최소 44px

---

## 관리자 로그인 (구글 SSO)

비밀번호를 우리가 보관하지 않습니다. 구글이 신원을 확인하고, **허용 목록** 이 그중 누가
관리자인지를 정합니다.

### 설정

1. Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → **OAuth 클라이언트 ID (웹 애플리케이션)**
2. 승인된 리디렉션 URI 에 등록:
   - `https://<배포도메인>/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (로컬 개발용)
3. 환경 변수 4개를 채웁니다.

```bash
AUTH_GOOGLE_ID="...apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="..."
AUTH_SECRET="$(openssl rand -base64 32)"
ADMIN_ALLOWED_EMAILS="owner@gmail.com,staff@gmail.com"
```

### 멤버 추가·삭제

`ADMIN_ALLOWED_EMAILS` 에 구글 계정을 쉼표로 추가하고 재배포하면 됩니다. 빼면 다음 요청부터
바로 막힙니다 — 이미 로그인해 둔 세션도 매 요청 목록을 다시 확인합니다.

> 목록을 DB가 아니라 환경 변수에 둔 것은 의도적입니다. DB에 두면 관리자 화면을 통해 목록
> 자체를 바꿀 수 있게 되어, 세션 하나가 털렸을 때 공격자가 스스로를 멤버로 추가할 수 있습니다.
> 환경 변수는 배포 권한이 있어야 바꿀 수 있으므로 침해와 권한 부여가 분리됩니다.
> `prisma/schema.prisma` 의 `AdminMember` 는 명부를 보여주고 마지막 접속을 기록하는
> 표시·감사용이며, 통과 판정의 근거가 아닙니다.

네 값 중 하나라도 비어 있으면 관리자 화면과 API는 **열리지 않고 닫힙니다.** 프로덕션에서
미설정은 통과가 아니라 실패입니다.

---

## SEO / AEO

AI 검색 노출은 특별한 파일이 아니라 **크롤 가능·색인 가능·신뢰 가능** 이라는 기본기에서 나옵니다.
그래서 별도의 AI 전용 스키마를 두지 않고 다음을 지킵니다.

- 페이지마다 본문 최상단에 **정의형 1문단** (질문 → 답 형태). 이미지 안의 글자는 인용되지 않습니다
- 3개 언어 `hreflang` 상호 지정 + `x-default`
- 갤러리 필터가 쿼리스트링이 아니라 **경로** 이므로 각 조합이 독립 색인 대상입니다
- 구조화 데이터: `LocalBusiness` · `Service` · `ImageObject` · `FAQPage` · `BreadcrumbList`
- FAQ는 **실제 문의 문장 그대로** 씁니다 (관리자 INBOX에서 승격)
- 서드파티 JS를 거의 두지 않습니다 (인스타 임베드 스크립트 없음)

---

## 배포

Vercel 기준입니다. `vercel.json` 이 인스타 수집 크론(6시간 주기)을 등록합니다.
보안 헤더와 CSP는 `next.config.ts` 의 `headers()` 에 있습니다.

> CSP의 `script-src` 에 `'unsafe-inline'` 이 남아 있습니다. Next.js 부트스트랩 인라인
> 스크립트 때문이며, nonce 방식으로 올리려면 전 페이지가 동적 렌더링이 되어 정적 캐시 이득을
> 잃습니다. `next.config.ts` 에 `@MX:DEBT` 로 표시해 두었습니다.

---

## 아직 받지 못한 것

값이 도착하면 해당 콘텐츠 모듈만 교체하면 됩니다. 지금은 전부 미확정 토큰으로 표시됩니다.

- 스튜디오 주소 · 공항에서 소요시간
- 대표 이메일 주소
- 로고 SVG (투명 배경) — 현재 원본이 195×48 저해상도라 인쇄·대형 표시에 쓸 수 없습니다
- 작가 포트레이트 · 드레스 개별 컷
- 테라스 · 메이크업룸 사진 (세트를 6개로 확장 예정)
- 촬영후기 실제 원고 — **현재 글은 전부 샘플이며 배지로 표시됩니다**

---

## 데이터베이스

Neon Postgres 가 실제로 붙어 있습니다. 런타임 클라이언트는 `src/server/db.ts` 싱글턴 하나뿐이며,
`new PrismaClient()` 를 직접 만들지 마십시오.

```bash
vercel env pull .env.local          # DATABASE_URL 등 내려받기
set -a; . ./.env.local; set +a      # 셸에 주입 (npx prisma 는 이게 있어야 합니다)
npx prisma generate && npx prisma db push
npm run db:seed                     # src/content/* 의 현재 값을 DB로 옮깁니다
```

`db:seed` 는 **몇 번 돌려도 안전합니다**(멱등). 모든 쓰기가 자연 유일키 기준 upsert 이고,
값을 스크립트에 다시 적지 않고 `src/server/*` 의 시드 함수를 그대로 씁니다 —
화면이 폴백으로 보여 주는 값과 DB에 들어가는 값이 갈라지지 않게 하기 위해서입니다.

> **Prisma 7 주의** — 접속 URL은 `prisma/schema.prisma` 가 아니라 `prisma.config.ts` 와
> `src/server/db.ts` 의 Neon 어댑터가 들고 있습니다. 스키마에 `url` 을 다시 넣으면 validate 가 깨집니다.

### 문구·사진을 관리자에서 고치는 층

DB는 **덮어쓰기 층**입니다. 행이 없으면 코드 기본값(`src/content/*`, 각 페이지 `content.ts`)이 그대로 나갑니다.
통째로 DB로 옮기지 않은 이유는, 행 하나가 비었을 때 화면이 빈칸이 되는 상태를 만들지 않기 위해서입니다.

- 문구 — `src/content/slots.ts` 가 편집 가능한 자리의 계약입니다. 공개 페이지는 `getPageCopy(page, locale)` 로 읽습니다
- 사진 — `src/server/page-images.ts` 의 `resolvePageImages(page)`. 클라이언트 컴포넌트는
  `src/lib/image-slot.ts` 의 `pickImage()` 만 씁니다(서버 모듈을 브라우저 번들로 끌고 오지 않기 위해)

## 아직 연결되지 않은 것

**거짓 성공을 반환하지 않습니다** — 연결되지 않은 쓰기 경로는 `NotImplementedError` 나 503 을 냅니다.

- 오브젝트 스토리지 업로드 — 코드 경로는 완성돼 있으나 `BLOB_READ_WRITE_TOKEN` 이 빈 문자열이라
  **아직 아무도 실업로드를 확인하지 못했습니다.** 사진 교체를 사람이 검증하려면 이것부터 채워야 합니다
- 사진 큐레이션 쓰기 — `src/server/photos.ts` 는 여전히 전부 스텁입니다.
  수동 업로드는 미디어 라이브러리에 들어가고 큐레이션 큐로는 가지 않습니다(화면에 그렇게 표시됩니다)
- 문의 알림 — 저장은 정상이고 메일/LINE 발송만 seam 입니다(`notifyEnquiry`). 알림 실패가 접수 실패를 뒤집지 않습니다
- Instagram Graph API 실호출 · AI 분류 실호출 (자격 증명 없음)
- 관리자 멤버 명부의 DB화 — 로그인은 구글 SSO로 연결되어 있고, 누가 관리자인지는 환경변수 허용 목록이 정합니다
