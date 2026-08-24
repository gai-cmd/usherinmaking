import crypto from 'node:crypto';

/**
 * 구글 API 공용 토큰 발급기.
 *
 * 자격 증명은 GCP 서비스 계정 JSON 하나(GSC_SERVICE_ACCOUNT_JSON)다 — Search Console 재제출과
 * 데일리 보고서(GSC 조회 + GA4 조회)가 같은 계정을 쓴다. 계정을 나눌 이유가 없고,
 * 나누면 "어느 키가 어디에 꽂혀 있는지"가 관리 부담이 된다.
 *
 * 외부 라이브러리 없이 JWT 를 직접 서명한다 — 토큰 발급 하나를 위해 googleapis 전체를
 * 들이는 것은 과하다(search-console.ts 와 같은 판단).
 *
 * 사용 전 준비(사람 손): 서비스 계정 이메일을
 *  - Search Console 속성 → 설정 → 사용자 및 권한 (전체)
 *  - GA4 속성 → 관리 → 속성 액세스 관리 (뷰어)
 * 두 곳에 추가해 두어야 한다.
 */

export type ServiceAccount = { client_email: string; private_key: string };

export function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  } catch {
    return null;
  }
}

function b64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** scope 별 토큰. 만료(1시간) 안에서는 재사용한다 — 크론 한 번에 GSC·GA4 를 연달아 부른다. */
const cache = new Map<string, { token: string; expiresAt: number }>();

export async function googleAccessToken(scope: string): Promise<string> {
  const sa = readServiceAccount();
  if (!sa) throw new Error('GSC_SERVICE_ACCOUNT_JSON 이 설정되지 않았습니다.');

  const hit = cache.get(scope);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({ iss: sa.client_email, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const jwt = `${header}.${claim}.${b64url(signer.sign(sa.private_key.replace(/\\n/g, '\n')))}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`구글 토큰 발급 실패: HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error('구글 토큰 응답에 access_token 이 없습니다.');

  cache.set(scope, {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  });
  return body.access_token;
}
