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

## 진행 중인 작업 (CMS 단계)

에이전트 4개를 병렬로 돌려 뼈대가 들어왔다. **각 화면이 실제로 동작하는지는 미검증**이다.

| 영역 | 들어온 것 | 남은 것 |
|---|---|---|
| 문구 편집 | `/admin/content`, `/admin/content/[page]`, `src/server/page-content.ts` | 슬롯 커버리지 확인, 저장→반영 실측 |
| 사진 교체 | `/admin/media`, `Uploader`, `src/server/page-images.ts` | **Blob 실업로드 검증**, 공개 페이지가 슬롯을 읽는지 |
| 인스타 | `src/lib/instagram.ts`, `src/server/ingest.ts` | 토큰 없이 503 나는지, 토큰 있을 때 실동작 |
| DB 배선 | 문의·INBOX 완료 | 플랜·분류·후기·드레스·설정 진행 중 |

**검증 방법**: 로컬에서 `.env.local` 주입 후 `npm run build && npx next start`,
관리자에 로그인해 실제로 저장·업로드해 볼 것. 타입 통과는 동작 보증이 아니다.

## 남은 일 (우선순위)

1. **사진 교체 경로 실검증** — 사용자가 전량 교체 예정. 이게 제일 급하다
2. **문구 편집기 실검증** — 저장이 공개 페이지에 반영되는지 (ISR revalidate 포함)
3. **`<title>` 정리** — 시안에 없는 항목이라 지어냈고 표기가 들쭉날쭉하다
4. **알림** — 문의 저장은 되지만 메일/LINE 은 아직 seam
5. **main 병합** — 준비되면 PR 또는 직접

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
