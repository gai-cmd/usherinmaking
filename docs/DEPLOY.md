# 배포 가이드 (Vercel + KV)

usher in making 사이트의 배포·데이터 스토어·환경변수·로컬 개발 안내입니다.
정적 HTML/CSS/JS + Vercel 서버리스 함수(`api/*.js`, ESM) 구조입니다.

---

## 1. 아키텍처 요약

- **프론트**: 정적 파일(HTML/CSS/`js/*.js`). 빌드 불필요.
- **백엔드**: `api/*.js` (Vercel Serverless Functions, ES Module).
  - `api/contact.js` — 문의 접수(POST) + Resend 메일 통지
  - `api/reservations.js` — 예약 캘린더 조회(GET) / 예약 접수(POST)
  - `api/content.js` — 사이트 편집 콘텐츠 조회(GET, 공개) / 저장(POST, 토큰 필요)
  - `api/admin.js` — 관리자 로그인 + 문의·예약 목록 조회
- **데이터 스토어**: `api/_lib/store.js` 가 **단일 추상화**로 통일.
  - 키: `uim:contacts` / `uim:reservations` / `uim:content`
  - `KV_REST_API_URL` + `KV_REST_API_TOKEN` 이 **둘 다** 있으면 **Vercel KV**(영속) 사용,
    없으면 `os.tmpdir()` 의 JSON 파일로 **폴백**(서버리스에서는 휘발성).

> 통일 스키마
> - 문의: `{ id, name, email, date, message, createdAt }`
> - 예약: `{ id, name, email, contact, plan, date, message, createdAt }` (+ 내부 `status`)
>
> 작성 측(contact/reservations)과 읽기 측(admin)이 **같은 키·같은 스키마**를 사용하므로
> 관리 화면에 실데이터가 그대로 표시됩니다(이전의 파일명/필드명 불일치 결함 해소).

---

## 2. Vercel 배포

### 2-1. 사전 준비
- GitHub 저장소 연결 또는 Vercel CLI 설치: `npm i -g vercel`
- 이 프로젝트는 빌드 스텝이 없으므로 Framework Preset = **Other**(정적)로 두면 됩니다.

### 2-2. 첫 배포
```bash
# 저장소 루트에서
vercel            # 프리뷰 배포 (대화형으로 프로젝트 연결)
vercel --prod     # 프로덕션 배포
```
또는 GitHub 연동 시 `main` 브랜치 푸시로 자동 배포됩니다.

`api/` 폴더의 각 `.js` 파일이 자동으로 `/api/<파일명>` 엔드포인트가 됩니다.
의존성(`@vercel/kv`, `resend`)은 `package.json` 에 선언되어 있어 Vercel이 설치합니다.

---

## 3. KV 스토어 생성 / 연결

영속 저장(권장)을 위해 Vercel KV(또는 Marketplace의 Redis 호환 스토어)를 연결합니다.

1. Vercel 대시보드 → 프로젝트 → **Storage** 탭.
2. **Create Database** → **KV** (Upstash Redis 기반) 선택 → 이름 입력 후 생성.
3. 생성된 KV를 **현재 프로젝트에 Connect** (Production/Preview/Development 환경 선택).
4. 연결하면 다음 환경변수가 **자동 주입**됩니다:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN` (본 앱에서는 미사용)
5. 재배포하면 `store.js` 가 두 변수를 감지해 자동으로 KV를 사용합니다(코드 수정 불필요).

> **원자성(atomicity) 주의**
> `store.push()` 는 `목록 읽기 → 추가 → 전체 쓰기` 방식이라, 같은 키에 거의 동시에
> 두 건이 들어오면 후입선출로 한 건을 놓칠 수 있습니다(저트래픽 가정의 단순 구현).
> 엄격한 원자성이 필요하면 KV 리스트형(`rpush`/`lrange`) 또는 낙관적 락(버전 기반 set),
> 큐잉으로 전환하세요. 관련 주석은 `api/_lib/store.js` 의 `push()` 에 있습니다.

---

## 4. 환경변수 설정

`.env.example` 을 참고해 Vercel **Settings → Environment Variables** 에 등록합니다.

| 변수 | 용도 | 필수 |
|------|------|------|
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호(HMAC 토큰 서명에도 사용). 미설정 시 로그인 불가 | 관리화면 사용 시 ✅ |
| `RESEND_API_KEY` | Resend API 키(메일 통지). 미설정 시 접수는 성공하되 메일 미발송 | 권장 |
| `CONTACT_TO` | 문의·예약 통지 수신 주소 | 메일 사용 시 ✅ |
| `CONTACT_FROM` | 발신자(검증된 도메인 권장). 미설정 시 샌드박스 | ⬜ |
| `RESERVE_TO` / `RESERVE_FROM` | 예약 통지 전용 수신/발신(미설정 시 CONTACT_* 로 폴백) | ⬜ |
| `RESERVE_DAILY_CAPACITY` | 1일 예약 상한(기본 1) | ⬜ |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | KV 연결 시 자동 주입(영속 저장) | 영속화 시 ✅ |

> 변경 후에는 **재배포**해야 반영됩니다(런타임 env 변경은 새 배포에서 적용).

---

## 5. 로컬 개발

```bash
# 1) 의존성 설치
npm install

# 2) Vercel CLI 로 서버리스 함수까지 로컬 구동
npm i -g vercel
vercel dev        # http://localhost:3000

# 3) 환경변수
cp .env.example .env.local   # 값 채우기 (또는 `vercel env pull .env.local`)
```

- `vercel dev` 는 `api/*.js` 를 실제 서버리스처럼 실행합니다.
- 로컬에서 `KV_*` 를 비워두면 `store.js` 가 자동으로 `os.tmpdir()` JSON 폴백을 사용합니다
  (재시작 시 사라지는 임시 저장이라 개발/데모용으로 충분).
- KV를 로컬에서도 쓰려면 `vercel env pull` 로 KV 변수를 받아 `.env.local` 에 넣으세요.

### 동작 확인
- 문의: `contact.html` 폼 전송 → `/admin.html` 로그인 → "お問い合わせ" 탭에 표시.
- 예약: `reserve.html` 에서 날짜·플랜 선택 후 신청 → "ご予約" 탭에 표시.
- 콘텐츠: `/admin.html` "コンテンツ編集" 탭에서 저장 → `GET /api/content` 에 반영.

> 관리 화면은 실데이터가 0건일 때만 데모 시드(`SEED`)를 보여줍니다.
> 한 건이라도 접수되면 시드 대신 실데이터가 우선 표시됩니다.

---

## 6. 주의 (이 저장소 운영 규칙)

- `html` / `css` / `seo.json` / `vercel.json` / `robots` / `sitemap` / 법무 페이지는
  백엔드 작업 시 건드리지 않습니다.
- 예약 폼에는 별도 email 입력란이 없어, 연락처가 메일 형식이면 `email` 로 자동 채웁니다
  (`js/reserve.js` 와 `api/reservations.js` 양쪽에서 동일 판정).
