# 네이버 블로그 취입 — SEO·AEO 판단 근거

작성: 2026-08-02 · 전부 **직접 실측**했다. 추정이 아니다.

## 한 줄 결론

**그대로 복사하면 SEO 손해, 다시 쓰면 SEO·AEO 둘 다 이득.** 복사와 재작성의 차이가
이 건의 전부다. "몇 건을 올릴까"보다 "어떤 형태로 올릴까"가 결정적이다.

---

## 실측 1 — 네이버는 **모든 AI 크롤러를 차단**한다

`https://blog.naver.com/robots.txt` 원문 (2026-08-02 조회):

```
# BOT ACCESS FOR THE PURPOSES OF AI TRAINING AND RETRIEVAL-AUGMENTED GENERATION (RAG) IS STRICTLY PROHIBITED.
User-agent: GPTBot            Disallow: /
User-agent: OAI-SearchBot     Disallow: /     ← ChatGPT search 노출용
User-agent: PerplexityBot     Disallow: /
User-agent: ClaudeBot         Disallow: /
User-agent: Claude-SearchBot  Disallow: /
User-agent: Google-Extended   Disallow: /
User-agent: meta-externalagent / Applebot-Extended / CCBot  Disallow: /
```

**즉 이 블로그 716건은 지금 ChatGPT·Perplexity·Claude 어디에도 안 보인다.**
12년치 촬영 기록이 AI 답변 시장에서는 존재하지 않는 것과 같다.

→ **AEO 관점에서는 큰 이득이다.** 자사 도메인으로 옮기는 순간 AI 검색에 처음 노출된다.
   우리 사이트 robots.txt 는 이 봇들을 막지 않는다(확인 필요 시 재점검).

## 실측 2 — 반면 **구글에는 정상 색인되고 있다**

Googlebot UA 로 원문을 직접 받아 확인:

```bash
curl -A "Googlebot/2.1" https://blog.naver.com/usherinmaking/224359035554
# → <meta name="robots" content="index,follow">
# → 본문 문단(se-text-paragraph) 19개가 그대로 실려 나온다
```

`robots.txt` 의 `User-agent: *` 차단 목록에 `PostView` 는 **없다**. 즉 구글은 이 글들을
크롤링·색인할 수 있고, 실제로 `index,follow` 가 걸려 있다.

→ **원문이 이미 색인된 상태에서 같은 글을 우리 도메인에 복사하면 중복이 된다.**
   구글은 둘 중 하나를 대표로 고르는데, 2014년부터 쌓인 원문 쪽이 유리하다.
   우리 복사본이 걸러지면 노출도 못 얻고 사이트에 얇은 페이지만 남는다.

## 실측 3 — 원고 상태가 그대로 싣기엔 나쁘다

`scripts/naver-journal-preview.mjs` 50건 표본:

| 문제 | 비율 | 그대로 실으면 |
|---|---|---|
| 제목이 검색 키워드 나열 | 5/50 (10%) | 키워드 스터핑 신호 |
| 본문 200자 미만 | 8/50 (16%) | 얇은 콘텐츠 |
| 본문 0자(이미지뿐) | 1/50 | 빈 페이지 |

273건으로 환산하면 **얇은 글이 약 44건, 제목 손봐야 할 글이 약 27건**이다.

## 공식 근거

구글 스팸 정책은 "출처가 좋아도, 자체 부가가치 없이 긁어온 콘텐츠는 **일부 수정하더라도**
정책 위반이며 그런 사이트를 강등하는 알고리즘이 있다"고 명시한다. 자기 글이라도
**대량 재발행 + 부가가치 없음** 조합은 같은 신호를 낸다.

---

## 그래서 어떻게 하면 되는가

| 방식 | SEO | AEO | 판단 |
|---|---|---|---|
| 원문 그대로 복사 | **마이너스** (중복·얇음) | 플러스 | ✗ |
| 원문에 canonical 을 네이버로 | 중립(가치 전부 네이버로) | 플러스 | ✗ 의미 없음 |
| **재작성 + 출처 링크 + 자사 이미지** | **플러스** | **플러스** | ✓ |

재작성이라 해도 새로 지어내라는 게 아니다. **사실은 그대로 두고** 이것만 하면 된다:

1. **제목을 사람이 읽을 문장으로** — `{오키나와스냅,오키나와커플스냅…}` 껍데기 제거
2. **첫 문단에 그 촬영이 무엇이었는지** 한 문장 — AI 답변이 인용하기 좋은 형태
3. **원문 링크를 본문에 명시** (`원문: 네이버 블로그 2026-07-27`) — 중복이 아니라 출처 있는 정리본이 된다
4. **이미지는 자사 도메인 재호스팅** — 사업 규칙이기도 하고, 네이버 이미지 직링크는 끊긴다
5. **얇은 글은 버리거나 묶는다** — 200자 미만 44건을 한 편으로 합치는 편이 낫다

---

## 남은 판단 (사람)

- 273건 전부를 이 형태로 만들 것인가, 아니면 두꺼운 것부터 나눠 올릴 것인가
  (한 번에 273건 신규 URL 은 그 자체로 대량 발행 신호다)
- 재작성을 누가 할 것인가 — 사실 보존이 걸린 작업이라 자동 생성만으로 끝내면 안 된다

Sources:
- [Scraped content — Google 스팸 정책](https://developers.google.com/search/docs/advanced/guidelines/scraped-content)
- [Handling legitimate cross-domain content duplication](https://developers.google.com/search/blog/2009/12/handling-legitimate-cross-domain)
- [Fix canonicalization issues](https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting)
- `https://blog.naver.com/robots.txt` (2026-08-02 직접 조회)
