usherinmaking モニター募集 — WP 붙여넣기 소스 (2026-07-12 실사 반영)

■ 최종 붙여넣기 파일 (이것만 쓰면 됨)
  wp-embed-inline.html
   - 히어로 사진 3장 + 텍스트 플랜을 하나로 합친 통합 소스
   - 모든 스타일을 각 요소에 인라인화 → 테마의 기존 CSS가 덮어쓰지 못함
   - 추가로 <style>에 .uim 스코프 !important 방어 규칙 → 테마가 img/h3/h4/ul에
     !important 를 걸어도 히어로 보더·헤딩 색/폰트·불릿까지 유지 (900/680/390px 검증 완료)
   - 반응형 3단계: 860px(패딩·밴드 축소) / 680px(2단→1단) / 460px(타이포·밴드 축소)
   - 사용: WP 固定ページ 편집 → 블록추가 → 「カスタムHTML」 → 파일 전체 붙여넣기

■ 업로드할 이미지 4개 (メディア에 올린 뒤, 아래 경로로 자동 매칭)
  monitor-title.jpg   (타이틀 배너 1600x640)
  hero-wedding.jpg    (Wedding 히어로)
  hero-maternity.jpg  (Maternity 히어로)
  hero-memorial.jpg   (Memorial 히어로)
  ※ src 기본 경로 = usherinmaking.jp/wp-content/uploads/2026/07/
    → 같은 경로/파일명으로 업로드하면 코드 수정 없이 바로 표시됨

■ 히어로는 전부 usherinmaking.jp 자체 실사 (AI 생성 아님, 오너 지시)
  Wedding   : /wp-content/uploads/2021/05/…okiswedding_usherin-0314.jpg (정원 커플, 밝은 톤)
  Maternity : /wp-content/uploads/2021/05/…스냅_어셔린메이킹-0280-1.jpg (残波岬 등대, 임산부)
  Memorial  : /wp-content/uploads/2021/05/…스냅어셔린메이킹-0174.jpg (해변 4인 가족)
  - 원본은 heroes/real/ 에 보관. 밴드는 object-fit:cover → 데스크톱 상하 트리밍, 모바일 거의 원본

■ 대안: 이미지 카드 버전 (텍스트까지 이미지로 박힌 형태)
  02_wedding-3.png / 03_maternity-3.png / 04_memorial-3.png (819x1023)
   - 기존 본문 이미지(-2.png)를 이 3장으로 교체하면 끝(코드 불필요)
   - 히어로는 위 실사와 동일. 단, 텍스트가 이미지라 SEO·수정성은 wp-embed-inline.html 이 유리

■ 공통: 맨 하단 갈색 기간/가격개정 띠는 삭제, 브랜드 푸터로 교체(오너 지시)

※ 업로드는 반드시 .jpg 사용 (WP 서버가 webp 미지원).
※ 검증 스냅샷은 ../qa/_verify_{900,680,390}.png (적대적 테마 CSS 아래 렌더).
