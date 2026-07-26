# usherinmaking — 다음 세션 인계

새 세션에서 이 파일부터 읽으면 이어받을 수 있다.
마지막 갱신: 2026-07-26 · 커밋 `0aef1a4`

---

## 한 문장 요약

오키나와 웨딩 스튜디오 사이트를 Next.js 15로 전면 재구축해 **프로덕션 배포까지 끝냈고**,
지금은 "관리자에서 사진·문구를 직접 고칠 수 있게" 만드는 CMS 단계 중반이다.

---

## 지금 상태

| | |
|---|---|
| 브랜치 | `feat/renewal-nextjs` — origin 푸시됨. **main 병합 안 함** |
| 프로덕션 | https://usherinmaking.vercel.app — 배포 완료·동작 중 |
| 빌드 | `npm test` (tsc + eslint) 0 errors, `npm run build` 성공 |
| 마지막 커밋 | `0aef1a4` CMS 편집기·미디어·인스타 통합 |

## 계정 (중요)

`gh auth` 가 회사 계정으로 넘어가 있으면 push 가 403 난다. 확인부터 할 것.

```bash
gh auth status                    # Active account 확인
gh auth switch --user gai-cmd     # 개인 계정으로
```

| | |
|---|---|
| GitHub | **`gai-cmd`** (개인). 회사는 `kc-gai` — 혼동 금지 |
| Vercel | `gai-cmd` / 팀 `gai-cmds-projects` |
| 저장소 | https://github.com/gai-cmd/usherinmaking |

---

## 인프라 (이미 붙어 있음)

| 리소스 | 상태 |
|---|---|
| Neon Postgres `usherinmaking-db` | ● 연결됨. free · ap-southeast-1. 스키마 push 완료 |
| Vercel Blob | ● `BLOB_READ_WRITE_TOKEN` 존재 |
| Vercel Cron | 등록됨 — `/api/cron/ingest-instagram` 6시간 주기 |
| Upstash Redis | 구 사이트 잔재. 새 코드는 안 씀 |

로컬에서 DB를 쓰려면:

```bash
vercel env pull .env.local          # DATABASE_URL 등 내려받기
set -a; . ./.env.local; set +a      # 셸에 주입 (npx prisma 는 이게 있어야 함)
npx prisma generate && npx prisma db push
```

> **Prisma 7 주의** — 접속 URL은 `prisma/schema.prisma` 가 아니라 `prisma.config.ts` 와
> `src/server/db.ts` 의 Neon 어댑터가 들고 있다. 스키마에 `url` 을 다시 넣으면 validate 가 깨진다.
> 마이그레이션은 비풀링(`DATABASE_URL_UNPOOLED`), 런타임은 풀링(`DATABASE_URL`).

## 아직 채워야 하는 환경변수

값이 없으면 관리자와 인스타는 **열리지 않고 닫힌다** (의도된 동작이다).

```
AUTH_GOOGLE_ID          Google Cloud Console → OAuth 클라이언트 ID (웹)
AUTH_GOOGLE_SECRET      리디렉션 URI: https://usherinmaking.vercel.app/api/auth/callback/google
AUTH_SECRET             openssl rand -base64 32
ADMIN_ALLOWED_EMAILS    관리자 구글 계정, 쉼표 구분 — 이 목록이 곧 멤버 명부다
IG_USER_ID              Instagram Graph API
IG_ACCESS_TOKEN
CRON_SECRET             크론 무단 호출 차단
RESEND_API_KEY          문의 알림 메일 (없어도 저장은 됨)
```

---

## 절대 어기면 안 되는 것

`README.md` 의 "지켜야 하는 사업 규칙" 표와 `.moai/handoff/DESIGN-RULES.md` 가 SSOT다.
특히 반복해서 실수하기 쉬운 것들:

- LOCATION / STUDIO 완전 분리 — "우천 시 스튜디오 대체" 문구 금지
- 자동 예약 없음. 문의 → 상담으로만 확정
- 인스타 임베드·아웃링크 금지. 사진은 자사 도메인에서만
- 3개 언어는 서로의 번역이 아니라 **독립 본문**. 기계번역으로 채우지 말 것
- **이메일 주소를 사이트 어디에도 노출하지 말 것.** 채널은 KO=카카오톡 / JA=LINE / **EN=Instagram**
- 관리자 가드는 **페이지 컴포넌트 첫 줄**. 레이아웃 가드만으로는 자식 실행을 못 막는다 (실측 확인됨)
- 쓰기 경로가 안 붙었으면 성공한 척하지 말 것 (`NotImplementedError` / 503)
- **클라이언트 컴포넌트는 `@/server/*` 를 import 하지 말 것.** sharp·Prisma 가 브라우저 번들로
  끌려가 빌드가 깨진다. 타입이 필요하면 `@/lib/photo-types` · `@/lib/image-contract` 를 쓴다

---

## CMS 읽기 경로 — 연결 완료 (이 세션)

**들어왔을 때 상태**: 관리자 화면은 DB에 저장까지 정상 동작했지만 **공개 페이지가 그 값을 읽는 코드가 한 줄도 없었다.**
`resolvePageImages` 는 자기 파일 밖 호출자가 0곳, `getPageCopy` 는 관리자 화면에서만 쓰였다.
관리자에서 "저장됨"이 뜨고 사이트는 그대로인, 닫힌 고리였다. 지금은 양쪽이 이어져 있다.

| 영역 | 상태 | 근거 |
|---|---|---|
| 사진 슬롯 | ● 연결됨 — home·studio·location·dress·photographer | DB 행 넣고 재빌드 → 해당 사진과 DB alt 가 렌더에 나옴 |
| 문구 슬롯 | ● 연결됨 — 9개 페이지 95슬롯 중 94개 도달 | 전 슬롯에 표식값 삽입 후 렌더 산출물에서 역추적 |
| 회귀 | ● 없음 | DB 빈 상태에서 정적 산출물 118개 변경 전후 대조 → 차이 0건 |
| 시드 | ● 반영됨 | plan 9 · option 4 · taxonomy 3 · term 16 · journal 21 · faq 3 |
| Blob 업로드 | ○ **여전히 미검증** | `BLOB_READ_WRITE_TOKEN` 이 빈 문자열이라 아무도 실업로드를 못 해봤다 |
| 인스타 | ○ 미검증 | 토큰 없음 |

`gallery/empty`(결과 0건 화면 문구)도 도달을 확인했다. 0건이 되는 URL 은
**`/ko/gallery/location/anniversary`** 다 — 로케이션 축에 기념일 촬영이 아직 한 장도 없다.
처음에 못 찾았던 이유는 `Selection` 이 축마다 term **하나**를 갖는 구조인데 배열을 넘겨
가짜 0을 얻었기 때문이다. 필터 화면의 카운트 칩("로케이션 0")이 0건 조합을 찾는 가장 빠른 단서다.

### 새로 생긴 규약

- `src/lib/image-slot.ts` — 클라이언트 컴포넌트가 `@/server/page-images` 를 타입 목적으로도 import 하지 않도록
  둔 경계 모듈. `pickImage(images, slot, locale, 폴백경로, 폴백alt)` 가 "DB → 코드 폴백 → null" 3단계를 한곳에서 정리한다.
- `photographer/portrait` 슬롯의 폴백을 `null` 로 바꿨다. 그 자리는 `[ PORTRAIT ]` 자리표시이고,
  스튜디오 실내컷을 폴백으로 걸면 "이 사람이 작가"라는 거짓 정보가 된다.
- 홈의 세트 그리드는 `studio` 페이지 슬롯을 함께 읽는다. 한 장을 갈아끼웠는데 홈에만 옛 사진이 남지 않게 하려는 것이다.

**검증 방법**(다음 세션도 이 방식을 쓸 것): 타입 통과는 동작 보증이 아니다. 두 방향을 다 본다 —
① DB 가 빈 상태에서 렌더 산출물이 변경 전과 같은가(회귀 없음), ② DB 에 값을 넣으면 화면이 바뀌는가(연결됨).
①만 보면 배선 안 된 코드가 그대로 통과한다.

## 남은 일 (우선순위)

1. **Blob 업로드 — 원인 규명 완료, 남은 것은 설정 토글 하나**

   `BLOB_READ_WRITE_TOKEN` 이 빈 값인 것은 실수가 아니라 **이 프로젝트가 OIDC 방식으로 붙어 있기
   때문**이다. Vercel 문서 기준 OIDC 가 기본이고 권장이며, SDK 가 `VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`
   를 자동으로 읽는다. 둘 다 `.env.local` 에 이미 들어 있다.

   문제는 코드였다. `isBlobConfigured()` 가 정적 토큰만 보고, `put()` 에 `token` 을 강제로 넘겨
   OIDC 경로를 스스로 막고 있었다. 그래서 **전 환경에서 업로드가 꺼져 있었다** — 스토어 파일 수 0개가 그 증거다.
   지금은 둘 다 인정하도록 고쳤다(정적 토큰이 있으면 그것, 없으면 SDK 가 OIDC 를 찾는다).

   고친 뒤 로컬에서 실제 업로드를 시도하니 SDK 가 OIDC 로 요청을 보냈고 스토어가 이렇게 거부했다:
   `OIDC is enabled for this project, but not for the "development" environment`.
   즉 **프로덕션·프리뷰는 열려 있고 development 만 닫혀 있다.**

   → 로컬 검증을 열려면: Blob 스토어 → Projects 탭 → Connect to Project 에서 **Development 환경을
   포함**해 연결한 뒤 `vercel env pull .env.local`. 스토어 대시보드:
   `https://vercel.com/gai-cmds-projects/~/stores/blob/store_1TWhNaMSDw7uymz2`

   **아직 확인 못 한 것**: 업로드가 실제로 성공하는 것을 어느 환경에서도 보지 못했다.
   프로덕션은 OIDC 가 열려 있다고 스토어가 말하지만, 관리자 화면이 SSO 미설정으로 닫혀 있어
   업로드를 눌러 볼 수가 없다. "코드 경로가 열렸다"까지가 확인된 사실이다.
2. **관리자 로그인** — `AUTH_GOOGLE_ID` / `AUTH_SECRET` / `ADMIN_ALLOWED_EMAILS` 는 **어느 환경에도
   아예 없다**(`vercel env ls` 목록에 없음, 미생성). 구글 클라우드 콘솔에서 OAuth 클라이언트를
   만들어야 하는데 그건 계정 소유자만 할 수 있다. 그래서 관리자 화면을 사람이 열어본 적이 없고,
   이번 세션도 서버 함수 단위로만 검증했다
3. **알림** — 코드는 붙었다(`src/server/notify.ts`, Resend REST 호출). `RESEND_API_KEY` 가 없으면
   건너뛰었다고 로그만 남기고 정상 종료한다. 키가 없어 실제 발송 경로는 한 번도 실행되지 않았다.
   `NOTIFY_TO`(수신 주소)와 `RESEND_FROM`(발신 주소, 도메인 검증 후)도 함께 필요하다
4. **main 병합** — 준비되면 PR 또는 직접

### 시안과 다르게 남겨 둔 것 (판단이 필요한 열린 항목)

- **페이지별 CTA vs 공용 CTA** — 시안은 스튜디오·로케이션 등 페이지마다 다른 상담 유도 문구를 쓴다
  (예: JA "プランをご覧のうえ、フォーム・LINE・Instagram からご連絡ください。"). 실제 사이트는
  `src/components/ContactCta.tsx` 의 공용 문구 하나를 모든 페이지에 쓴다. 공용 문구도 사업 규칙
  (자동 예약 없음·이메일 비노출)에 어긋나지 않아 그대로 뒀다. 페이지별로 나누려면 컴포넌트에
  prop 을 추가해야 하므로, 문구 손질이 아니라 설계 변경이다 — 사람이 결정할 항목으로 남긴다

## 아직 못 받은 자산 (전부 미확정 토큰으로 표시 중)

- 스튜디오 **주소** — 일본어 표기 + 영문 표기 **2종** 필요 (하나를 기계번역하면 안 됨)
- 나하공항에서 소요시간 · 구글맵 좌표 (단축링크는 받았으나 크롤링 불가)
- 대표 이메일 · 로고 SVG · 작가 포트레이트 · 드레스 개별 컷
- 촬영후기 실제 원고 — 네이버가 외부 접근을 막아 미반영. 현재 전부 샘플(배지 표시)

---

## 시안 (문구의 출처)

`~/Downloads/Usher in Making 리뉴얼 디자인.zip` (7/26 03:54판)
카드 11개는 그 이전판과 **동일**하고 README만 갱신됐다. 사본을 저장소에 넣어 뒀다:

```
.moai/handoff/DESIGN-README.md    IA · 화면 사양 · 토큰 · 데이터 모델
.moai/handoff/DESIGN-RULES.md     브랜드 · 구조 · 언어 · 사진 규칙
```

Claude Design에서 수정한 카피는 zip에 아직 반영되지 않았다. 새 zip이나 `.dc.html` 을 받으면
기존과 diff 해서 **차이분만** 반영할 것.

## 참고 문서

```
README.md                              스택 · 사업 규칙 · 구글 SSO 설정 절차
.moai/specs/SPEC-UIM-RENEWAL-001/      SPEC · plan · 인수 조건 (AC 표)
.moai/handoff/BRIEF.md                 프론트 구현 규약
.moai/handoff/BRIEF-ADMIN.md           관리자 규약
.moai/handoff/BRIEF-CMS.md             DB 배선 현황 · "DB 우선 · 시드 폴백" 패턴
```
