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

## 알아둘 점 (다음 보완 후보)
- **og:image / JSON-LD image** 와 일부 메타는 아직 `usherinmaking.jp` 절대경로를 가리킵니다.
  실제 도메인 확정 후 새 도메인 절대경로로 바꾸는 게 좋습니다 (구 WP 종료 대비).
- **placeholder 이미지**: 원본에 사진이 없던 일부 칸은 `picsum.photos` 임시 이미지입니다.
- 다운로드 실패 1건: `…/2021/07/셔리드레스2-300x300.jpg` (원본 404) — 해당 썸네일만 원격 유지.
- **canonical**은 구 WP URL 구조(`/about/`, `/portfolio/…/`)를 가리킵니다. 정적 파일명은
  `about.html` 등 평면 구조라, 실도메인 URL 구조 확정 시 정렬을 권장합니다.
- `en/`(영문) 페이지는 아직 미생성 — hreflang만 선반영돼 있습니다.
```
```
