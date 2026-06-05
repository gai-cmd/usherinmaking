# usher in making — 운영 / 서비스 정보 (Service & Account Registry)

> 목적: 이 사이트 운영에 쓰는 **계정·서비스를 잊지 않기 위한 기록**.
> ⚠️ 비밀번호·API 키 등 **민감정보는 여기에 적지 마세요** (비밀번호 관리자에 보관). 여기엔 "어디에 무엇이 있는지"만 적습니다.
> 최종 업데이트: 2026-06-06

## 코드 / 배포
| 항목 | 값 |
|---|---|
| **GitHub 저장소** | https://github.com/gai-cmd/usherinmaking (계정: `gai-cmd`) |
| **배포 플랫폼** | **Vercel** — 위 GitHub 저장소를 import해서 자동 배포 (push 시 재배포) |
| Vercel 프로젝트 설정 | Framework: Other(정적) / Build Command 비움 / Output 루트 |
| **도메인 + 웹호스팅** | **Cafe24** (도메인 보유). 1차는 Vercel 배포 → 추후 Cafe24로 보완 예정 |
| 운영 도메인(목표) | https://usherinmaking.jp |
| 담당 이메일 | gai@kaflixcloud.co.jp |

## 도메인 연결 (나중에)
- Vercel 프로젝트 → Settings → Domains 에 `usherinmaking.jp` 추가
- 안내되는 A/CNAME 값으로 **Cafe24 DNS** 변경 (또는 네임서버를 Vercel로)

## 문의폼(선택, 미사용 중) — `api/contact.js`
- 활성화하려면 Vercel **Environment Variables**: `RESEND_API_KEY`, `CONTACT_TO`, (선택)`CONTACT_FROM`
- 메일 발송 서비스: **Resend** (https://resend.com) 가입 필요 — 키는 비밀번호 관리자에 보관

## SNS / 연락 채널 (사이트에 연결됨)
| 채널 | 링크 / ID |
|---|---|
| Instagram | https://www.instagram.com/usherinmaking/ (@usherinmaking) |
| LINE | https://line.me/ti/p/8Udy1kYg1l (ID: usherinmaking) |
| KakaoTalk | http://qr.kakao.com/talk/YdBfdGeaBd1EXL3ZVVpEJrSpzMU- (ID: amipaek) |
| Naver Blog | https://blog.naver.com/moya100 |
| Facebook | https://www.facebook.com/okinawaphotography |

## 신규 기능 — 문의 / 예약 / 관리자 / 영문 / 법무 (2026-06)
| 기능 | 공개 경로 | API | 비고 |
|---|---|---|---|
| 문의 폼 | `/contact.html` | `/api/contact` (`api/contact.js`) | Resend 발송, 헤더/푸터 `CONTACT` |
| 예약 캘린더 | `/reserve.html`, `/en/reserve.html` | `/api/reservations` (`api/reservations.js`) | 헤더/푸터 `RESERVE`, `js/reserve.js` |
| 관리자(예약관리) | `/admin.html` | `/api/admin` (`api/admin.js`) | **noindex·검색 비노출**, 직접 URL 접근만 |
| 콘텐츠/가용일 | — | `/api/content` (`api/content.js`) | 캘린더 가용일·콘텐츠 제공 |
| 영문(EN) | `/en/*.html` | — | 페이지 우상단 `JP / EN` 전환 |
| 법무 표기 | `/privacy.html`, `/tokushoho.html` | — | 공용 푸터 링크(全페이지) |

### 운영 절차
1. **예약 접수**: 방문자가 `/reserve.html` 에서 날짜·플랜 선택 후 폼 전송 → `/api/reservations` 기록.
2. **확인/처리**: 운영자가 `/admin.html` 접속 → 예약 목록 확인, 승인/마감(가용일 닫기) → `/api/admin`.
3. **가용일 관리**: 마감/오픈 처리하면 `/api/content`·`/api/reservations` 를 통해 캘린더에 반영.
4. **확정**: LINE 상담 + 촬영료 50% 입금으로 정식 확정.
5. **admin 보호**: `robots.txt` `Disallow: /admin.html` + `Disallow: /api/`, `admin.html` `noindex`, 사이트맵 제외. URL을 공개 공유하지 말 것.

### 예약/관리자 환경변수 (Vercel)
- 문의: `RESEND_API_KEY`, `CONTACT_TO`, (선택)`CONTACT_FROM`
- 예약/관리자: `api/reservations.js`·`api/admin.js` 가 요구하는 저장소/인증 키(관리자 토큰 등)는 코드 확인 후 Vercel **Environment Variables** 로 설정. 키 값은 비밀번호 관리자에 보관.

## 자주 쓰는 작업
- 로컬 미리보기: `python3 -m http.server 8080` → http://localhost:8080/index.html
- SEO 갱신: `python3 seo/build_seo.py extract && python3 scripts/og_cleanup.py && python3 seo/build_seo.py apply`
- 이미지 로컬화: `python3 scripts/localize_images.py`
- 배포: `git push` (Vercel 자동 배포)
