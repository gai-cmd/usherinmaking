import { prisma, isDatabaseConfigured } from '@/server/db';
import { seal, unseal, isVaultReady, type SealedSecret } from '@/server/service-vault';

/**
 * 카카오톡 "나에게 보내기" 로 데일리 보고서 요약을 전달한다.
 *
 * 카카오에는 임의의 개인 ID 에게 메시지를 보내는 API 가 없다(알림톡은 사업자 심사 + 유료).
 * 유일한 무료 경로가 talk/memo — 본인이 한 번 동의하면 그 사람의 "나와의 채팅"으로
 * 보낼 수 있다. 그래서 수신자마다 1회 OAuth 동의가 필요하고, 그 동의로 받은
 * refresh 토큰을 여기 보관한다.
 *
 * 토큰 수명: refresh 토큰은 2개월이지만 사용할 때마다 연장된다 — 매일 발송이
 * 곧 갱신이므로 방치되지 않는 한 만료되지 않는다. 만료됐다면 그 수신자만 실패로
 * 기록되고 다시 동의 링크를 밟으면 된다.
 *
 * 보관: Setting['kakao-report-tokens'] 에 SERVICE_VAULT_KEY 로 봉인해서 넣는다.
 * 스코프가 talk_message(본인에게 발송)뿐이라 유출 피해가 제한적이지만, 자격 증명을
 * 평문으로 두지 않는 원칙(services.ts)을 따른다.
 */

const STORE_KEY = 'kakao-report-tokens';
const KAUTH = 'https://kauth.kakao.com';
const KAPI = 'https://kapi.kakao.com';

export function kakaoConfig(): { restKey?: string; ready: boolean } {
  const restKey = process.env.KAKAO_REST_API_KEY?.trim();
  return { restKey, ready: Boolean(restKey) && isVaultReady() };
}

/* ------------------------------------------------- 토큰 저장소 */

type TokenRecord = { label: string; sealed: SealedSecret; connectedAt: string };
type TokenStore = Record<string, TokenRecord>;

async function readStore(): Promise<TokenStore> {
  if (!isDatabaseConfigured()) return {};
  try {
    const row = await prisma.setting.findUnique({ where: { key: STORE_KEY }, select: { value: true } });
    return row ? (JSON.parse(row.value) as TokenStore) : {};
  } catch {
    return {};
  }
}

async function writeStore(store: TokenStore): Promise<void> {
  await prisma.setting.upsert({
    where: { key: STORE_KEY },
    update: { value: JSON.stringify(store) },
    create: { key: STORE_KEY, value: JSON.stringify(store) },
  });
}

/** 연결된 수신자 목록 (라벨·연결 시각만 — 토큰은 나가지 않는다). */
export async function listKakaoRecipients(): Promise<{ label: string; connectedAt: string }[]> {
  const store = await readStore();
  return Object.values(store).map((r) => ({ label: r.label, connectedAt: r.connectedAt }));
}

/* ------------------------------------------------- OAuth 연결 */

export function authorizeUrl(redirectUri: string, state: string): string {
  const { restKey } = kakaoConfig();
  const q = new URLSearchParams({
    client_id: restKey ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'talk_message',
    state,
  });
  return `${KAUTH}/oauth/authorize?${q}`;
}

/** 동의 콜백에서 code 를 토큰으로 바꿔 봉인 저장한다. label 은 "누구의 카톡인지" 표시용. */
export async function connectRecipient(
  code: string,
  redirectUri: string,
  label: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { restKey } = kakaoConfig();
  if (!restKey) return { ok: false, reason: 'KAKAO_REST_API_KEY 미설정' };
  if (!isVaultReady()) return { ok: false, reason: 'SERVICE_VAULT_KEY 미설정 — 토큰을 봉인할 수 없어 저장하지 않습니다' };

  const res = await fetch(`${KAUTH}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: restKey,
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, reason: `카카오 토큰 교환 실패 ${res.status} ${detail.slice(0, 150)}` };
  }
  const body = (await res.json()) as { refresh_token?: string };
  if (!body.refresh_token) return { ok: false, reason: '응답에 refresh_token 이 없습니다' };

  const sealed = seal(body.refresh_token);
  if (!sealed) return { ok: false, reason: '토큰 봉인 실패' };

  const store = await readStore();
  store[label] = { label, sealed, connectedAt: new Date().toISOString() };
  await writeStore(store);
  return { ok: true };
}

/* ------------------------------------------------- 발송 */

export type KakaoSendResult = { label: string; sent: boolean; detail?: string };

/**
 * 저장된 모든 수신자에게 요약을 보낸다. 실패는 수신자별로 기록하고 서로 전파하지 않는다.
 * refresh 응답이 새 refresh_token 을 주면 갈아끼운다 — 이것이 토큰을 계속 살아있게 한다.
 */
export async function sendKakaoToAll(text: string, linkUrl: string): Promise<KakaoSendResult[]> {
  const { restKey } = kakaoConfig();
  if (!restKey) return [];
  const store = await readStore();
  const results: KakaoSendResult[] = [];

  for (const rec of Object.values(store)) {
    try {
      const refreshToken = unseal(rec.sealed);
      if (!refreshToken) throw new Error('토큰을 열 수 없음(금고 키 변경?)');

      const tokenRes = await fetch(`${KAUTH}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: restKey,
          refresh_token: refreshToken,
        }),
      });
      if (!tokenRes.ok) throw new Error(`갱신 실패 ${tokenRes.status} — 재동의 필요할 수 있음`);
      const tok = (await tokenRes.json()) as { access_token: string; refresh_token?: string };

      if (tok.refresh_token) {
        const sealed = seal(tok.refresh_token);
        if (sealed) {
          store[rec.label] = { ...rec, sealed };
          await writeStore(store);
        }
      }

      // 기본 텍스트 템플릿은 200자까지다 — 요약 + 링크 버튼 구조.
      const sendRes = await fetch(`${KAPI}/v2/api/talk/memo/default/send`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${tok.access_token}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          template_object: JSON.stringify({
            object_type: 'text',
            text: text.slice(0, 200),
            link: { web_url: linkUrl, mobile_web_url: linkUrl },
            button_title: '사이트 열기',
          }),
        }),
      });
      if (!sendRes.ok) {
        const detail = await sendRes.text().catch(() => '');
        throw new Error(`발송 실패 ${sendRes.status} ${detail.slice(0, 120)}`);
      }
      results.push({ label: rec.label, sent: true });
    } catch (err) {
      results.push({ label: rec.label, sent: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
