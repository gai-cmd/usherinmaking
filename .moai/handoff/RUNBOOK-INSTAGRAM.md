# 인스타그램 연동 — 공식 인증 절차 런북

작성: 2026-08-01 · 근거: Meta 공식 문서 실조회(하단 출처)

이 문서는 **사람이 해야 하는 발급 절차**와 **코드가 이미 기대하고 있는 값**을 잇는다.
코드는 이미 다 붙어 있다 — 없는 것은 자격 증명뿐이다.

---

## 코드가 요구하는 값 (이미 구현되어 있음)

| 환경변수 | 쓰는 곳 | 없으면 |
|---|---|---|
| `IG_USER_ID` | `src/lib/instagram.ts` | 크론이 503 으로 끊는다 |
| `IG_ACCESS_TOKEN` | 동일 | 동일 |
| `IG_GRAPH_HOST` | 기본 `graph.facebook.com` | 아래 "어느 경로인가" 참조 |
| `IG_API_VERSION` | 기본 `v25.0` | 버전 고정용(생략 가능) |
| `CRON_SECRET` | `requireCronSecret` | **일부러 비워 둔 상태** — 아래 순서 주의 |

> **`CRON_SECRET` 을 먼저 넣으면 안 된다.** 이 값이 있으면 6시간마다 크론이 인증을 통과해
> 수집을 시도하는데, 토큰이 없으면 매번 실패한 IngestRun 행만 하루 4건씩 쌓인다
> (`runInstagramIngest` 가 환경변수 검사보다 먼저 `startRun()` 을 부른다).
> **토큰 2개와 `CRON_SECRET` 을 같은 시점에 함께 넣을 것.**

---

## 어느 경로인가 — 두 가지가 있고 갱신 방법이 다르다

| 경로 | 호스트 | 토큰 성격 |
|---|---|---|
| **Instagram Login** (비즈니스 계정 직접 로그인) | `graph.instagram.com` | 60일 장기 토큰, `ig_refresh_token` 으로 갱신 |
| **Facebook Login for Business** (페이지 연결 경유) | `graph.facebook.com` ← 코드 기본값 | 페이지 토큰은 무기한도 가능 |

Instagram Login 으로 발급했다면 `IG_GRAPH_HOST=graph.instagram.com` 을 함께 등록해야 한다.

---

## ⚠️ 가장 중요한 함정 — 60일 안에 갱신하지 않으면 **영구 만료**

Instagram Login 장기 토큰은 다음 규칙을 따른다 (공식 문서 확인):

- 갱신된 토큰은 갱신 시점부터 **60일** 유효하다
- 갱신하려면 토큰이 **최소 24시간 지났고 아직 만료 전**이어야 한다
- **60일 동안 한 번도 갱신하지 않은 토큰은 만료되며 더 이상 갱신할 수 없다** — 처음부터 재발급해야 한다

즉 **토큰을 발급해 두고 쓰지 않으면 그대로 죽는다.** 지금처럼 크론이 꺼져 있는 상태에서
토큰만 먼저 넣어 두면 60일 뒤 조용히 무효가 된다. 발급과 가동을 붙여서 진행해야 하는 이유다.

갱신 호출:

```bash
curl -s "https://graph.instagram.com/refresh_access_token\
?grant_type=ig_refresh_token&access_token=<현재_장기_토큰>"
# → { "access_token": "...", "token_type": "bearer", "expires_in": 5183944 }
```

---

## 진행 순서

1. **Meta 개발자 콘솔에서 앱 생성 + Instagram 제품 추가** — 계정 소유자만 가능
2. 인스타 계정을 **비즈니스/크리에이터 계정**으로 전환 (개인 계정은 API 불가)
3. 위 경로 중 하나로 로그인해 **장기 토큰**과 **IG 사용자 ID** 획득
4. Vercel 환경변수에 **`IG_USER_ID` · `IG_ACCESS_TOKEN` (· 필요 시 `IG_GRAPH_HOST`) · `CRON_SECRET` 을 한꺼번에** 등록
5. 크론(`/api/cron/ingest-instagram`, 6시간 주기)이 처음 도는지 확인 — 관리자 수집 화면에 IngestRun 기록이 남는다
6. **갱신 일정을 걸 것** — 60일 벽을 넘기지 않도록 (미구현: 자동 갱신 크론은 아직 없다. 필요하면 만든다)

---

## 아직 안 만든 것

- **자동 갱신 크론** — 위 `refresh_access_token` 을 주기적으로 부르는 경로가 없다.
  토큰 발급이 끝나면 이걸 붙이는 게 다음 작업이다(수동 갱신을 잊으면 영구 만료이므로 사실상 필수).
- **토큰 만료 가시화** — 현재는 만료 시 수집 실패 메시지로만 드러난다.

---

Sources:
- [Refresh Access Token — Instagram Platform](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/)
- [Access Token — Instagram Platform](https://developers.facebook.com/docs/instagram-platform/reference/access_token/)
- [Business Login for Instagram](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login)
