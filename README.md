# usher in making — 沖縄ウェディングフォト (static site + Vercel)

워드프레스에서 이전한 **정적 사이트**입니다. GitHub → **Vercel** 배포 기준으로 구성돼 있습니다.
(나중에 Cafe24 웹호스팅으로 보완 예정.)

## 로컬 미리보기
```bash
python3 -m http.server 8080
# http://localhost:8080/index.html
```

## 구조
```
*.html                  페이지 (메인 8 + 갤러리 22 + 드레스 8)  ※ siano.html은 디자인 데모
css/site.css            전 페이지 공용 스타일 (애플식 다이나믹 + 반응형)
js/site.js              헤더/모바일메뉴/스크롤 연출
images/                 로고 + images/up/ (원본에서 내려받은 사진 281장)
api/contact.js          Vercel 서버리스 문의폼 (지금은 미사용 스캐폴드)
seo/                    SEO/AEO 중앙 관리 (seo.json + build_seo.py) — seo/README.md 참고
scripts/localize_images.py   원격 이미지 → images/up/ 다운로드+치환
vercel.json             Vercel 설정 (보안 헤더, 이미지 캐시)
sitemap.xml / robots.txt
```

## Vercel 배포 (GitHub 연동)
1. GitHub에 새 repo 생성 후 push:
   ```bash
   git remote add origin https://github.com/<계정>/usherinmaking.git
   git branch -M main
   git push -u origin main
   ```
2. [vercel.com](https://vercel.com) → **Add New… → Project** → 이 repo import.
   - Framework Preset: **Other** (정적). Build Command 비움. Output Directory 비움(루트).
3. Deploy. `*.vercel.app` URL이 바로 생깁니다.

### Cafe24 도메인 연결 (나중에)
Vercel 프로젝트 → **Settings → Domains** 에 도메인 추가 → 안내되는 값으로
Cafe24 DNS의 A/CNAME 레코드를 변경. (또는 네임서버를 Vercel로 변경)

## 문의폼 (선택 — 나중에 폼 추가 시)
현재 CONTACT는 원본처럼 **LINE / Instagram** 안내 방식이라 폼이 없습니다.
폼을 추가하면 `api/contact.js`(서버리스)가 바로 처리합니다. Vercel **Environment Variables**:
| 변수 | 설명 |
|---|---|
| `RESEND_API_KEY` | [resend.com](https://resend.com) 무료 키 |
| `CONTACT_TO` | 문의 수신 이메일 |
| `CONTACT_FROM` | (선택) 인증된 발신 주소 |
프런트: `fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,message})})`

## SEO / AEO 편집
`seo/seo.json` 수정 → `python3 seo/build_seo.py apply` (자세히는 `seo/README.md`).

## 이미지 로컬화
`python3 scripts/localize_images.py` — 원격(usherinmaking.jp) 이미지를 `images/up/`로 받아
`src`/`url()`을 `/images/up/...`로 치환. 새 원격 이미지를 추가했을 때 다시 실행하면 됩니다.

## 신규 기능 (문의 / 예약 / 관리자 / 영문 / 법무)
2026-06 추가된 동적·법무 기능과 도달 경로입니다.

| 기능 | 공개 페이지 | API (서버리스) | 프런트 JS | 도달 경로 |
|---|---|---|---|---|
| **문의 폼** | `contact.html` | `api/contact.js` | `js/contact-form.js` | 헤더/푸터 `CONTACT` |
| **예약(撮影日カレンダー)** | `reserve.html`, `en/reserve.html` | `api/reservations.js` | `js/reserve.js` | 헤더/푸터 `RESERVE` |
| **관리자(예약 관리, noindex)** | `admin.html` | `api/admin.js` | `js/admin.js` | 직접 URL만 (메뉴/사이트맵 비노출) |
| **콘텐츠 API** | — | `api/content.js` | — | 예약 가용일/콘텐츠 제공 |
| **영문(EN)** | `en/*.html` (`en/reserve.html` 포함) | — | — | 각 페이지 우상단 `JP / EN` 전환 |
| **법무 표기** | `privacy.html`(プライバシーポリシー), `tokushoho.html`(特定商取引法に基づく表記) | — | — | 공용 푸터 링크 |

- **내비/푸터**: 공개 메인 페이지(헤더 nav)에 `RESERVE` 추가, 공용 푸터에 `RESERVE` + 법무 2종 링크 추가.
- **언어 전환**: `reserve.html` ↔ `en/reserve.html` 의 `JP / EN` 링크로 상호 연결(hreflang 반영).
- **admin 비공개**: `admin.html` 은 `robots.txt` 에서 `Disallow`, `<meta robots noindex>`, 사이트맵 제외.

### 예약/관리자 운영 절차
1. 방문자가 `reserve.html` 캘린더에서 빈 날짜·플랜 선택 → 폼 전송 (`api/reservations.js`).
2. 관리자가 `admin.html` 에서 들어온 예약을 확인·승인/마감 처리 (`api/admin.js`).
3. 가용일 변경은 콘텐츠/예약 API(`api/content.js`, `api/reservations.js`)를 통해 캘린더에 반영.
4. 정식 예약은 LINE 상담 + 촬영료 50% 입금으로 확정 (페이지 안내 문구 기준).
> 환경변수·서비스 계정 등 운영 상세는 `docs/OPERATIONS.md` 참고.

## 알아둘 점 (다음 보완 후보)
- **og:image / JSON-LD image** 와 일부 메타는 아직 `usherinmaking.jp` 절대경로를 가리킵니다.
  실제 도메인 확정 후 새 도메인 절대경로로 바꾸는 게 좋습니다 (구 WP 종료 대비).
- **placeholder 이미지**: 원본에 사진이 없던 일부 칸은 `picsum.photos` 임시 이미지입니다.
- 다운로드 실패 1건: `…/2021/07/셔리드레스2-300x300.jpg` (원본 404) — 해당 썸네일만 원격 유지.
- **canonical**은 구 WP URL 구조(`/about/`, `/portfolio/…/`)를 가리킵니다. 정적 파일명은
  `about.html` 등 평면 구조라, 실도메인 URL 구조 확정 시 정렬을 권장합니다.
- `en/`(영문) 페이지는 주요 페이지가 생성됨(`en/reserve.html` 포함). 나머지 하위 상세 페이지는 순차 보완 예정.
- **법무 본문**(`privacy.html`·`tokushoho.html`)의 사업자명·주소·연락처 등 실제 값 확인/갱신 필요.
```
```
