# usherinmaking — 다음 세션 인계

새 세션에서 이 파일부터 읽으면 이어받을 수 있다.
마지막 갱신: 2026-07-27 · 커밋 `db6b0f4` 이후

---

## 지금 당장 할 일 (세션 시작 직후)

**없다.** 7/27 세션의 커밋 7개가 전부 프로덕션에 반영·검증됐다. 미푸시 0, 커밋 안 된 변경 0.

### 7/27 세션에서 한 일 (커밋 7개)

| 커밋 | 내용 |
|---|---|
| `de6092b` | 린트 경고 21건 → 0. 렌더 산출물 불변 확인 |
| `bbc8974` | 오류·로딩 경계 신설 — 3개 언어 오류 화면 · global-error · 관리자 경계/골격 |
| `93a8307` | 문의 폼 남용 방어 — 미끼 필드(refCode) · 중복 억제 |
| `75ce671` | 요금 페이지 제목 단계 끊김 수정 (보이지 않는 h2) |
| `2a50863` | 분할 섹션 2곳 컨테이너 폭 — 스튜디오 access · 홈 photographer |
| `db6b0f4` | **히어로·대표 사진 6자리를 관리자 슬롯으로 + 이미지 저장 시 재검증** |
| `5c0bf20`·`8c8bda8`·`8cbc0a0` | 인계 문서 갱신 |

### 다음 세션이 오해하기 쉬운 것 두 가지

**1. 관리자 쓰기는 이미 살아 있다.** `NotImplementedError` 대부분은
`!isDatabaseConfigured()` 조건 안이고 그 함수는 `Boolean(process.env.DATABASE_URL)` 이다.
프로덕션에 값이 있으므로 사진·FAQ·플랜·분류 쓰기는 동작한다. 조건 없이 막힌 것은
`settings.ts` 와 `dress.ts` 둘뿐이며, 둘 다 모델을 일부러 안 만든 항목이다.
**병목은 코드가 아니라 관리자 로그인(Google OAuth)이다.**

**2. 이미지 슬롯 저장에는 재검증이 붙어 있다(7/27 추가).** 공개 페이지가 전부 정적이라
저장만으로는 화면이 안 바뀐다. `revalidateImageSurfaces()` 가 걸린 주소를 무효화하고
`revalidated` 를 응답에 실어 보낸다 — 화면이 "반영됨"이라 말하려면 이 값이 true 여야 한다.
**새 슬롯을 추가할 때 `affectedRoutes()` 에도 그 페이지를 넣을 것.** 빠뜨리면 저장은
되는데 화면이 안 바뀌는 닫힌 고리가 된다.

### 승격 절차 (다음에 커밋했을 때 쓸 것)

```bash
vercel ls usherinmaking | head -8            # 최신 Preview 가 Ready 인지
vercel inspect <그 URL> | grep created       # 커밋 시각과 대조
vercel promote <그 URL> --yes                # 재빌드가 돈다 — 즉시 안 바뀜
```

> **`vercel promote` 는 별칭만 옮기는 게 아니라 프로덕션 타깃으로 재빌드한다.**
> 새 배포가 Building → Ready 가 되고 나서야 별칭이 옮겨간다(약 50초). 승격 직후
> 공개 주소를 확인하면 옛 내용이 나오는 게 정상이다. 이걸 몰라 "승격이 안 먹었다"고
> 오진할 수 있다.

> **커밋 시각이 아니라 push 시각과 대조할 것.** git 트리거 빌드는 커밋이 아니라 push 가
> 유발한다. 커밋해 두고 몇 시간 뒤에 push 하면 커밋 시각과는 몇 시간이 벌어지지만
> push 시각과는 1~3초다. push 시각은 `git reflog show --date=iso origin/<브랜치>` 로 본다.
>
> ```bash
> git reflog show --date=iso origin/feat/renewal-nextjs | head -3
> ```
>
> 실측: `1bdd221` push 09:08:07 → 배포 09:08:10 (3초) · `ab66753` 23:18:01 → 23:18:02 (1초)
> · `7913b22` 23:00:27 → 23:00:29 (2초). CLI 직접 배포든 git 트리거든 1~3초로 같다.
>
> (이 문서의 이전 판은 "git push 트리거는 10초 이상 걸린다"고 적었는데 틀렸다.
> 커밋 시각과 대조한 탓에 생긴 착시였다. 배포 방식이 아니라 **대조 대상**이 문제였다 —
> 아래 로고 절의 "측정 대상을 잘못 잡으면 검사를 통과해도 화면은 틀린다"와 같은 실수다.)

> **가장 강한 검증은 시각이 아니라 내용이다.** 공개 주소의 실제 CSS/HTML 을 받아
> 바뀐 값을 직접 확인할 것. 프리뷰 URL 은 배포 보호로 302 가 걸려 받을 수 없으니,
> 프리뷰 단계에서는 시각 대조로 후보를 좁히고 **승격 후 공개 주소에서 내용 확인**한다.
> 틀렸으면 `vercel promote <직전 프로덕션 URL> --yes` 로 되돌린다.

```bash
# 내용 검증 예 — 공개 주소에서 CSS 를 받아 바뀐 규칙을 직접 확인
curl -s https://usherinmaking.vercel.app/ko -o /tmp/p.html
for C in $(grep -o '/_next/static/css/[a-z0-9]*\.css' /tmp/p.html | sort -u); do
  curl -s "https://usherinmaking.vercel.app$C" | grep -o 'logoImg[^{]*{[^}]*}'
done
```

프리뷰 URL 은 커밋마다 새로 생기고 각자 그 시점으로 굳는다. 이전 세션에서 사용자가
7시간 전 프리뷰 주소를 보며 "안 보인다"고 한 일이 있었다.
**공개 주소는 `https://usherinmaking.vercel.app` 하나뿐이다.**

승격 후에는 브라우저가 옛 CSS 를 들고 있을 수 있다. `?v=2` 를 붙이거나 시크릿 창으로 확인한다.

---

## 한 문장 요약

오키나와 웨딩 스튜디오 사이트를 Next.js 15로 전면 재구축해 **프로덕션 배포까지 끝냈고**,
지금은 "관리자에서 사진·문구를 직접 고칠 수 있게" 만드는 CMS 단계 중반이다.

---

## 지금 상태

| | |
|---|---|
| 브랜치 | `feat/renewal-nextjs` — origin 푸시됨. **main 병합 안 함** |
| 프로덕션 | https://usherinmaking.vercel.app — 배포 `nwjrm16lr`, HEAD 반영·내용 검증됨 |
| 빌드 | `npm test` (tsc + eslint) **0 errors · 0 warnings**, `npm run build` 성공 |
| 마지막 커밋 | 로고 렌더 높이 + 인계 갱신 (전부 승격 완료) |

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
| Vercel Blob | ● **OIDC 방식**. 정적 토큰은 빈 값이 정상. Development 까지 연결 완료 |
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
AUTH_GOOGLE_ID          Google Cloud Console → OAuth 클라이언트 ID (웹)   ← 사람만 발급 가능
AUTH_GOOGLE_SECRET      리디렉션 URI: https://usherinmaking.vercel.app/api/auth/callback/google
ADMIN_ALLOWED_EMAILS    관리자 구글 계정, 쉼표 구분 — 이 목록이 곧 멤버 명부다
AUTH_SECRET             ✅ Vercel 3개 환경 모두 등록 완료 (7/27)
IG_USER_ID              Instagram Graph API
IG_ACCESS_TOKEN
CRON_SECRET             ⏸ 일부러 비워 둠 — 아래 이유 참조
RESEND_API_KEY          문의 알림 메일 (없어도 저장은 됨)
NOTIFY_TO               알림 수신 주소
RESEND_FROM             발신 주소 (비우면 Resend 예시 주소)
```

> **`CRON_SECRET` 을 일부러 비워 둔 이유.** 이 값을 넣으면 크론이 인증을 통과해
> 실제로 수집을 시도하는데, `IG_USER_ID`·`IG_ACCESS_TOKEN` 이 없으므로 매번 실패한다.
> 그런데 `runInstagramIngest` 는 환경변수 검사보다 **먼저** `startRun()` 으로 실행 기록을
> 만들고 그 뒤에 실패 처리를 한다. 즉 6시간마다 실패한 IngestRun 행이 하루 4건씩 쌓인다.
> 비워 두면 `requireCronSecret` 이 인증 단계에서 끊고 기록도 남지 않는다.
> **인스타 토큰을 받는 시점에 두 토큰과 `CRON_SECRET` 을 같이 넣을 것.**

### 정리한 구 사이트 변수 (7/27 삭제)

현재 코드가 한 줄도 읽지 않는 것을 전수 검색으로 확인한 뒤 지웠다. 살아 있는 자격 증명을
쓰지도 않으면서 발급된 채 두는 것이 위험이기 때문이다.

`ADMIN_PASSWORD` · `ADMIN_TOKEN_SECRET` · `DEPLOY_HOOK_URL` · `BLOB_WEBHOOK_PUBLIC_KEY`
· `KV_URL` · `KV_REDIS_URL` · `KV_REST_API_URL` · `KV_REST_API_TOKEN` · `KV_REST_API_READ_ONLY_TOKEN`

`BLOB_WEBHOOK_PUBLIC_KEY` 는 검증키만 있고 웹훅 핸들러 자체가 코드에 없었다.
`KV_*` 는 Upstash Redis 다 — 나중에 IP 레이트리밋을 넣기로 하면 다시 만들어야 한다.
삭제 전 목록은 `.moai/state/verify/reboot-20260727/30-env-before-cleanup.txt` 에 있다.

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

## 레이아웃 폭 — 이번 세션의 마지막 작업

시안 1200px 캔버스와 apple.com/jp 실측(같은 뷰포트에서 본문 단락 840px), 그리고 사용자가
지정한 zoellife.com(배경 전폭 + 콘텐츠 가운데 컨테이너)을 근거로 **폭을 세 단계로 나눴다.**

| 단계 | 토큰 | 대상 |
|---|---|---|
| 전폭 | — | 섹션 배경·경계선만 (`u-section`, 헤더/푸터 root) |
| 컨테이너 | `--content-max: 1200px` | 히어로 포함 모든 시각 블록·카드·표 |
| 글줄 | `--reading-max: 840px` | 이어 읽는 문장 |

**폭 검사할 때 주의**: "이미지 하나가 1200 을 넘는가" 로 훑으면 분할 레이아웃을 놓친다.
드레스 히어로·작가 인트로·문의 2단은 각 절반이 1200 미만이라 그 기준을 빠져나갔고,
사용자가 화면을 보내 줘서야 드러났다. **`display:grid` 인 컨테이너를 폭 기준으로 훑을 것.**

> **이 실수는 두 번 났다.** 7/26 에 4곳을 고칠 때 스튜디오 `.access` 와 홈 `.photographer`
> 가 남았고, 7/27 에 사용자가 다시 화면을 보내 줘서 드러났다. 원인은 매번 같다 —
> "그리드 컨테이너를 보라"는 말만 있고 **재는 방법이 없어서** 눈으로 훑었기 때문이다.
> 다음부터는 아래를 브라우저 콘솔에 붙여 넣어 **재고** 판단할 것. 넓은 뷰포트에서 실행한다.
>
> ```js
> // 폭이 --content-max 를 넘으면서 내용을 담은 grid·flex 요소만 골라낸다
> const c = parseFloat(getComputedStyle(document.documentElement)
>   .getPropertyValue('--content-max')) || 1200;
> [...document.querySelectorAll('body *')].filter(e => {
>   const s = getComputedStyle(e);
>   if (s.display !== 'grid' && s.display !== 'flex') return false;
>   if (e.getBoundingClientRect().width <= c + 2) return false;
>   return (e.innerText || '').trim() !== '' || e.querySelector('img');
> }).map(e => e.className + ' ' + Math.round(e.getBoundingClientRect().width) + 'px');
> ```
>
> **걸린 것을 전부 고치면 안 된다.** `PlanTabs .strip` 과 `JournalList .filter` 는
> `justify-content: center` + `border-bottom` 조합이라 내용은 가운데 모으고 경계선만
> 전폭으로 긋는 구조다. 규약("전폭은 섹션 배경·경계선만")에 맞으므로 그대로 두어야 한다.
> 걸린 요소마다 **내용이 넓은가, 경계선만 넓은가** 를 구분할 것.
>
> 경계선을 가진 분할 섹션은 `max-width: var(--content-max); margin-inline: auto;` 두 줄만
> 더한다. 경계선도 함께 좁아지지만 `dress .hero` · `photographer .intro` 가 이미 그렇게
> 배포돼 있으므로 그쪽에 맞추는 것이 일관된다.

모바일(375·768) 실렌더 — **확인 완료.** 9페이지 × 2뷰포트 전부 수평 문서 오버플로 0,
2단 그리드(드레스 히어로·작가 인트로·문의 폼) 모두 1단으로 접힘, 헤더 75/91px.
갤러리 필터 칩과 스튜디오 세트 목록이 우측으로 넘치는 건 자체 스크롤 컨테이너 안이다
(문서 오버플로 0 이 그 증거).

**검사 방법(다음에도 이걸 쓸 것).** 브라우저 창 리사이즈는 OS 최소 창폭에 걸려 375 뷰포트에
도달하지 못한다(창 263 요청 → 뷰포트 1645). 시스템 Chrome 을 쓰는 Playwright 로 정확한
뷰포트를 잡는다 — `chromium.launch({ channel: 'chrome' })`. 브라우저 바이너리 다운로드도,
저장소 의존성 추가도 필요 없다. 페이지마다 `documentElement.scrollWidth - innerWidth` 를
재고 뷰포트 밖으로 나간 요소를 모아 보면, 스크린샷을 다 열어보지 않고도 후보를 좁힐 수 있다.
다만 **오버플로 0 은 "안 깨졌다"까지만 말한다** — 읽히는지·균형이 맞는지는 눈으로 봐야 한다.

## 로고 크기 — 시각 크기는 박스 높이가 아니라 잉크 몸통으로 잰다

사용자가 "로고가 메뉴에 비해 너무 작아 균형이 안 맞는다"고 지적했다. 원인은 값이 작아서가
아니라 **측정 기준이 틀려서**였다.

자산 `public/brand/logo.png` (1170×288) 을 픽셀 단위로 재 보면, 스크립트 서체의
어센더·디센더 스워시가 박스 높이를 전부 쓰고 **실제로 읽히는 글자 몸통은 총높이의 28.8%**
뿐이다. 그래서 `height: 24px` 은 그 24px 중 약 7px 만 글자라는 뜻이고, 내비 대문자 13px 의
**0.53배**로 보였다. 수치상으로는 "24px 로고"였지만 눈에는 메뉴 절반이었다.

| 렌더 높이 | 글자 몸통 | 내비 13px 대비 | 폭 |
|---|---|---|---|
| 24px (기존) | 6.9px | 0.53× | 98px |
| **64px** (현재, 데스크톱) | 18.4px | 1.42× | 260px |
| **48px** (현재, ≤767px) | 13.8px | 1.06× | 195px |

64 를 고른 이유는 자산 비율 4.0625 로 정수 폭이 나오고(64×4.0625=260) 브랜드가 메뉴보다
확실히 앞서기 때문이다. `next/image` 의 `width`/`height` 프롭도 195×48 → 260×64 로 올렸다 —
**안 올리면 260px 로 키울 때 레티나에서 흐려진다**(srcset 이 옛 폭 기준으로 생성된다).
프로덕션에서 dpr 2 로 640px 원본이 서빙되는 것까지 확인했다.

**규약**: 아이콘·워드마크의 시각 크기를 조정할 때는 박스 높이를 보지 말고 잉크 몸통을 재라.
스워시가 큰 스크립트는 박스 높이와 체감 크기가 3배 이상 벌어진다. 폭 검사에서
"`display:grid` 컨테이너를 훑어라"와 같은 계열의 실수다 — **측정 대상을 잘못 잡으면
검사를 통과해도 화면은 틀린다.**

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
| Blob 업로드 | ● **검증됨** | 원본→sharp 파생본→공개 URL HTTP 200 까지 확인, 테스트 객체 삭제 |
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

### 이미지 슬롯 현황 (7/27 기준)

**관리자에서 갈아끼울 수 있는 자리 — 17개.** `PAGE_IMAGE_SLOTS` 가 그 전부다.

| 페이지 | 슬롯 |
|---|---|
| home | `hero.location` · `hero.studio` · `photographer`(7/27 추가) |
| studio | `hero`·`access`(7/27 추가) · `set.*` 4개 |
| location | `hero`(7/27 추가) · `category.wedding` · `category.anniversary` |
| dress | `collection.white/color/vintage/maternity` |
| photographer | `portrait` · `gallery.1~3`(7/27 추가) |

**작품 그리드 3곳 — 사진 풀 연결 완료 (8/1).**
홈 `RECENT_WORKS`, 스튜디오 `WORKS.images`, 로케이션 `WORKS.images` 는 이제
`@/server/works` 의 `getWorksImages(surface)` 를 읽는다. 선별 규칙:

- 홈 = PUBLISHED 전체 최신 5장 · 스튜디오 = `studio` 태그 5장 · 로케이션 = `location` 태그 5장
- **전부/전무 폴백**: DB 사진이 그리드 정원을 못 채우면 기존 코드 배열이 통째로 나온다
  (절반만 채우면 두 소스에서 같은 사진이 겹칠 수 있고, DB 빈 상태 렌더 불변도 깨진다)
- 사진 상태·태그·alt 변경 API 가 홈·스튜디오·로케이션 9경로를 revalidate 하고
  `revalidated` 를 응답에 실어 보낸다 (이미지 슬롯과 같은 규칙)
- next.config 에 Blob 도메인(`*.public.blob.vercel-storage.com`)을 remotePatterns 에 추가 —
  없으면 업로드 사진이 next/image 에서 거부된다 (이미지 슬롯에도 잠재해 있던 문제)

검증(8/1): ① DB 빈 상태 9페이지 정규화 대조 차이 0 + 대조군 DIFF 검출 확인,
② 표식 사진 10건 주입 → 3표면 선별·렌더 산출물 모두 반영 확인 → 전량 삭제·폴백 복귀 확인.
증거: `.moai/state/verify/works-grid-20260801/`.

**검증 방법**(다음 세션도 이 방식을 쓸 것): 타입 통과는 동작 보증이 아니다. 두 방향을 다 본다 —
① DB 가 빈 상태에서 렌더 산출물이 변경 전과 같은가(회귀 없음), ② DB 에 값을 넣으면 화면이 바뀌는가(연결됨).
①만 보면 배선 안 된 코드가 그대로 통과한다.

> **①을 잴 때 HTML 해시를 그대로 비교하면 안 된다.** Next 는 빌드 ID와 청크 해시를 HTML 에
> 심으므로 코드가 같아도 118개가 전부 다르게 나온다. 정규화 절차는 이렇다 —
> `/_next/static/…` 경로, 16자 이상 hex, `<!--빌드ID-->`, `\"b\":\"빌드ID\"` 를 치환한 뒤
> **스트리밍 페이로드(`self.__next_f.push`) 를 걷어내고 남은 DOM** 을 대조한다.
> 메타데이터는 그 페이로드 안에 있으므로, `content`/`children`/`href`/`alt`/`hrefLang` 값만
> 따로 뽑아 정렬 비교한다. 청크 참조 번호(`$L16` → `$L15`)가 밀리는 것은 모듈을 지우면
> 번들 그래프 순서가 바뀌기 때문이며 내용 변화가 아니다 — 여기서 오진하기 쉽다.

## 진단으로 바로잡은 인식 (7/27)

인계 문서가 "관리자 쓰기가 전부 막혀 있다"고 적어 온 것은 **DB 연결 이전 기준이라 지금과
맞지 않는다.** `NotImplementedError` 대부분은 `!isDatabaseConfigured()` 조건 안에 있고,
그 함수는 `Boolean(process.env.DATABASE_URL)` 이다. 프로덕션에 DATABASE_URL 이 있으므로
조건은 거짓이고, **사진·FAQ·플랜·분류 쓰기 경로는 이미 살아 있다.**

조건 없이 던지는 것은 `settings.ts` 와 `dress.ts` 둘뿐이며, 이 둘은 모델을 일부러 만들지
않기로 한 항목이다(아래 "모델을 일부러 만들지 않은 화면 3개" 참조).

즉 관리자 기능은 만들어져 있고 쓰기도 되는데 **로그인이 안 되어 아무도 도달하지 못하는**
상태다. 최대 병목은 코드가 아니라 Google OAuth 클라이언트다.

규모도 기록해 둔다 — 관리자 화면 24개, 관리자 API 20개. 공개 사이트는 118페이지 전부
정적이고 동적 라우트는 전부 `/admin` 과 `/api` 아래에 있다.

보안은 전부 닫히는 쪽으로 설계돼 있다. `requireAdmin` 은 SSO 미설정을 통과로 해석하지
않고 막고, `requireCronSecret` 은 시크릿이 없으면 엔드포인트를 비활성화한다.
공개 영역 이메일 노출은 0건이다.

## 남은 일 (우선순위)

> **0. 최우선 — 관리자 로그인.** 이것 하나가 관리자 화면 24개를 통째로 막고 있다.
> 필요한 것은 Google Cloud Console 의 OAuth 클라이언트 2개(`AUTH_GOOGLE_ID`·
> `AUTH_GOOGLE_SECRET`)와 관리자 이메일 목록(`ADMIN_ALLOWED_EMAILS`)뿐이다.
> `AUTH_SECRET` 은 7/27 에 등록해 뒀다. 리디렉션 URI 는
> `https://usherinmaking.vercel.app/api/auth/callback/google`.
> **계정 소유자만 발급할 수 있어 에이전트가 대신할 수 없다.**
>
> **0-b. 사용자가 미룬 항목 (7/27 결정).** 사업자 정보를 관리자에서 넣으려면 Settings
> 모델이 필요한데 지금 만들지 않기로 했다. 그래서 **주소·특정상거래법 6개 항목은
> 관리자에서 넣을 수 없다** — 코드 상수이고 관리자와 연결돼 있지 않다.
> 특정상거래법 페이지는 사업자 정보 6개가 "(확인 필요)"로 공개 노출 중이므로,
> 채우지 않을 거면 페이지를 내리는 편이 낫다. 채널은 코드에 두고 사업자 정보만
> DB 로 올리는 절충안이 논의됐다(채널을 DB 로 옮기면 관리자 세션 탈취 시 바꿔치기 위험).
> 모델 추가 시 주의 — 프로덕션 Neon 에 이미 데이터가 있고 이 프로젝트는 마이그레이션
> 파일 없이 `db push` 만 써 왔다.

1. **Blob 업로드 — ✅ 해결됨 (이번 세션에서 실제 업로드 성공)**

   사용자가 Blob 스토어를 Development 환경까지 연결했고, `isBlobConfigured()` 가 OIDC 를
   인정하도록 코드를 고친 뒤 **실제로 올라갔다.** 50일 된 스토어에 파일이 들어간 것은 그때가 처음이다.
   원본 372KB PNG 업로드 → sharp 재인코딩 → avif/webp 400px 생성 → 공개 URL 이 HTTP 200
   (`image/avif`, 12,943 bytes) 로 서빙되는 것까지 확인하고 테스트 객체 3개를 지웠다.

   OIDC 토큰은 수명이 짧다. 로컬에서 업로드가 갑자기 실패하면 `vercel env pull` 을 다시 하면 된다.
   정적 토큰(`BLOB_READ_WRITE_TOKEN`)은 만들지 않았다 — 필요해지면 스토어 연결 다이얼로그의
   "Add a read-write token env var" 를 켜면 되지만, 장수명 비밀이 하나 늘어난다.

<!-- 이전 진단 기록 (해결 완료) -->
<details><summary>원인 규명 과정</summary>

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

   코드가 정적 토큰만 요구해 OIDC 경로를 스스로 막고 있었다는 것이 결론이었다.
</details>
2. **관리자 로그인** — `AUTH_GOOGLE_ID` / `AUTH_SECRET` / `ADMIN_ALLOWED_EMAILS` 는 **어느 환경에도
   아예 없다**(`vercel env ls` 목록에 없음, 미생성). 구글 클라우드 콘솔에서 OAuth 클라이언트를
   만들어야 하는데 그건 계정 소유자만 할 수 있다. 그래서 관리자 화면을 사람이 열어본 적이 없고,
   이번 세션도 서버 함수 단위로만 검증했다
3. **알림** — 코드는 붙었다(`src/server/notify.ts`, Resend REST 호출). `RESEND_API_KEY` 가 없으면
   건너뛰었다고 로그만 남기고 정상 종료한다. 키가 없어 실제 발송 경로는 한 번도 실행되지 않았다.
   `NOTIFY_TO`(수신 주소)와 `RESEND_FROM`(발신 주소, 도메인 검증 후)도 함께 필요하다
4. **main 병합** — 준비되면 PR 또는 직접

### 모델을 일부러 만들지 않은 화면 3개 (드레스 · 설정 · 번역)

관리자 화면은 있는데 `schema.prisma` 에 대응 모델이 없어 쓰기가 전부 `NotImplementedError` 다.
스텁이 "schema.prisma 에 Dress 모델이 없습니다" 처럼 이유까지 말하고 있으므로 거짓 성공은 없다.
**지금 모델을 만들지 않기로 했다.** 이유는 화면마다 다르다.

- **설정** — 상담 채널(KO=카카오톡 / JA=LINE / EN=Instagram)은 편집 대상이 아니라 **사업 규칙**이다.
  DB 로 옮기면 관리자 세션 하나가 털렸을 때 채널을 바꿔치기당할 수 있다. 관리자 허용 목록을
  환경변수에 둔 것과 같은 이유로, 배포 권한이 있어야 바꿀 수 있는 지금 상태가 더 안전하다
- **번역** — 이 사이트의 3개 언어는 서로의 번역이 아니라 각각 독립 본문이다. "번역 관리" 화면은
  JA 를 원본으로 두고 나머지를 채우는 구도라 그 규칙과 전제가 어긋난다. 로케일별 독립 편집은
  `PageContent`(문구 편집기)가 이미 제공한다. 다만 `translations.ts` 의 `canPublish` 가
  `reviewed:false` 인 값의 게시를 막고 있어 지금 상태로도 사고가 나지는 않는다
- **드레스** — 드레스 개별 컷을 아직 받지 못했다. 모델을 먼저 만들면 빈 테이블만 생긴다.
  사진이 들어오고 항목이 확정된 뒤에 만드는 편이 맞다

되짚을 조건: 설정은 "채널을 코드 배포 없이 바꿔야 할 실제 필요"가 생겼을 때, 드레스는 사진을
받았을 때, 번역은 3개 언어 독립 원칙 자체를 바꾸기로 했을 때다.

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
