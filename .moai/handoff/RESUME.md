# usherinmaking — 다음 세션 인계

다른 아이디/세션에서 이어받을 때 이 파일부터 읽으면 된다.

## 지금 상태

- 브랜치 `feat/renewal-nextjs`, `origin` 에 푸시됨. **main 병합은 아직 안 함**
- 프로덕션 배포 완료 — https://usherinmaking.vercel.app
- Vercel 프로젝트 `gai-cmds-projects/usherinmaking` 에 로컬 링크됨 (`.vercel/`)

## 계정

| | |
|---|---|
| GitHub | `gai-cmd` (개인). `gh auth switch` 로 전환 — 회사 계정은 `kc-gai` |
| Vercel | `gai-cmd` / 팀 `gai-cmds-projects` |
| 저장소 | https://github.com/gai-cmd/usherinmaking |

## 인프라 (이미 붙어 있음)

| 리소스 | 상태 |
|---|---|
| Neon Postgres `usherinmaking-db` | ● 연결됨. free · ap-southeast-1. 스키마 push 완료 |
| Vercel Blob | ● `BLOB_READ_WRITE_TOKEN` 존재 |
| Upstash Redis (구 사이트 잔재) | ● 있으나 새 코드는 안 씀 |
| Vercel Cron | 등록됨 — `/api/cron/ingest-instagram` 6시간 주기 |

로컬에서 DB를 쓰려면:

```bash
vercel env pull .env.local          # DATABASE_URL 등 내려받기
set -a; . ./.env.local; set +a      # 셸에 주입
npx prisma generate && npx prisma db push
```

Prisma 7이라 접속 URL은 `prisma/schema.prisma` 가 아니라 **`prisma.config.ts`** 와
`src/server/db.ts` 의 Neon 어댑터가 들고 있다. 스키마에 `url` 을 다시 넣으면 validate 가 깨진다.

## 아직 채워야 하는 환경변수

관리자와 인스타는 값이 없으면 **열리지 않고 닫힌다** (의도된 동작).

```
AUTH_GOOGLE_ID          Google Cloud Console → OAuth 클라이언트 ID (웹)
AUTH_GOOGLE_SECRET      리디렉션 URI: https://usherinmaking.vercel.app/api/auth/callback/google
AUTH_SECRET             openssl rand -base64 32
ADMIN_ALLOWED_EMAILS    관리자 구글 계정, 쉼표 구분
IG_USER_ID              Instagram Graph API
IG_ACCESS_TOKEN
CRON_SECRET             크론 무단 호출 차단
```

## 설계상 절대 어기면 안 되는 것

`README.md` 의 "지켜야 하는 사업 규칙" 표가 SSOT다. 특히:

- LOCATION / STUDIO 완전 분리 — "우천 시 스튜디오 대체" 문구 금지
- 자동 예약 없음. 문의 → 상담으로만 확정
- 인스타 임베드·아웃링크 금지. 사진은 자사 도메인에서만
- 3개 언어는 서로의 번역이 아니라 독립 본문. 기계번역으로 채우지 말 것
- 이메일 주소를 캐시·색인될 수 있는 출력에 넣지 말 것 (`maskEmail`)
- 관리자 가드는 **페이지 컴포넌트 첫 줄**. 레이아웃 가드만으로는 자식 실행을 못 막는다 (실측 확인됨)
- 쓰기 경로가 안 붙었으면 성공한 척하지 말 것 (`NotImplementedError` / 503)

## 남은 일

1. **시안 문구 갱신** — Claude Design 수정본이 아직 미반영. 현재는 `~/Downloads/Usher in Making 리뉴얼 디자인.zip` (7/26 01:38) 기준. zip 이나 `.dc.html` 을 받으면 차이분만 반영
2. **타이틀 정리** — `<title>` 은 시안에 없는 항목이라 지어낸 것이고 표기가 들쭉날쭉하다
3. **사진 교체** — 관리자 업로드 경로가 붙으면 전량 교체 예정
4. **알림** — 문의 저장은 되지만 메일/LINE 알림은 아직 seam. `RESEND_API_KEY` 미설정
5. **main 병합** — 준비되면 PR 또는 직접 병합

## 참고 문서

```
README.md                              스택 · 사업 규칙 · 설정 절차
.moai/specs/SPEC-UIM-RENEWAL-001/      SPEC · plan · 인수 조건
.moai/handoff/BRIEF.md                 프론트 구현 규약
.moai/handoff/BRIEF-ADMIN.md           관리자 규약
.moai/handoff/BRIEF-CMS.md             DB 배선 현황 · DB우선/시드폴백 패턴
```
