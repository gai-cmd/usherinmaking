# usherinmaking モニター募集 リデザイン (2026-07-12 실사 반영)

대상: https://usherinmaking.jp/plan/モニター募集/ 본문 이벤트 이미지 3종
지시(오너): ① 맨 하단 갈색 기간 띠 삭제 ② 사이트 컨셉으로 신규 디자인 ③ 2가지 버전 제작
히어로 이미지: **usherinmaking.jp 자체 실사** (오너 지시로 AI 생성본에서 교체 — AI 금지)
  - Wedding=okiswedding_usherin-0314(정원 커플) / Maternity=…-0280-1(残波岬 등대) / Memorial=…-0174(해변 4인 가족)
  - 원본 heroes/real/, 변환 heroes/hero-*.png + _deliverables/hero-*.jpg (밴드 object-fit:cover)

## 산출물 (`_deliverables/`)

### V1 — 이미지 버전 (히어로 사진 + 정밀 렌더 카드, 819x1023)
- `02_wedding-3.png` — Wedding Photo (Plan.01/02)
- `03_maternity-3.png` — Maternity Photo (Plan.03)
- `04_memorial-3.png` — Memorial Photo (Plan.04)
- 변경점: 원본 갈색 「기간/가격개정」 띠 삭제 → "USHERIN MAKING · Okinawa" 브랜드 푸터로 교체,
  상단에 **실사 히어로 사진**(아치형 밴드) 추가. 텍스트·가격은 렌더로 정확 재현(원본 100% 일치).
- WP 교체: 미디어 라이브러리의 기존 02/03/04_*-2.png 를 이 파일들로 교체(같은 슬롯).

### V2 — 텍스트 기반 버전 (WP 커스텀 HTML 블록) ← 권장
- `wp-embed-inline.html` — 타이틀 배너 + 히어로 3장 + 텍스트 플랜을 하나로 합친 통합 소스.
  모든 스타일 인라인 + `.uim` 스코프 !important 방어 → 테마 CSS가 못 덮음. 반응형 3단계(860/680/460px).
- `monitor-title.png/jpg` (1600x640) — 상단 타이틀 배너(실사 웨딩 배경). 업로드는 .jpg.
- 이미지 4장(monitor-title/hero-*.jpg)은 `uploads/2026/07/` 경로로 업로드하면 코드 수정 없이 자동 매칭.
- 사용: WP 편집기 → 커스텀HTML 블록 → wp-embed-inline.html 전체 붙여넣기.

## 참고
- 기간/가격개정 문구는 양 버전 모두 의도적으로 제외(오너 지시).
- 히어로 원본: `heroes/real/*.jpg` (usherinmaking.jp 자체 실사, EXIF copyright=어셔린메이킹).
- 재생성: `scripts/_tmp/uim-heroes.mjs`(실사→hero) → `uim-render-cards.ts` + `uim-render-banner.ts`.
  렌더는 kiosk-crm node_modules 필요 → `~/work/KC-CRM/kiosk-asset/kiosk-crm/scripts/_tmp/` 에 복사해 실행.
- 검증: `scripts/_tmp/uim-verify.mjs` → `qa/_verify_{900,680,390}.png` (적대 테마 CSS 아래 렌더).
- ~~`gen-heroes.sh`~~ (AI 생성, 폐기 → `.DEPRECATED-ai`).
