import { createSign } from 'node:crypto';

/**
 * Google Search Console 에 사이트맵을 (재)제출한다.
 *
 * 구글은 사이트맵 ping 엔드포인트를 2023년에 폐지했고 IndexNow 에도 참여하지 않는다.
 * 남은 공식 자동화 경로는 Search Console API 의 sitemaps.submit 하나다. 같은 주소를
 * 다시 제출하면 구글이 그 사이트맵을 다시 읽으러 온다 — "새 글이 있으니 와서 보라"는
 * 신호를 구글에게 프로그램으로 보내는 유일한 방법이다.
 *
 * 자격 증명은 GCP 서비스 계정 JSON 이다(GSC_SERVICE_ACCOUNT_JSON). 그 계정의 이메일을
 * Search Console 속성에 사용자로 추가해 두어야 한다. 외부 라이브러리 없이 JWT 를 직접
 * 서명한다 — 이 한 가지 호출을 위해 googleapis 전체를 들이는 것은 과하다.
 *
 * 증명이 없으면 조용히 건너뛴다. 증명을 넣기 전까지는 수동 제출(1회)로 충분하고,
 * 없다고 크론 전체가 실패한 것처럼 보여서는 안 된다.
 */

const SCOPE = 'https://www.googleapis.com/auth/webmasters';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

type ServiceAccount = { client_email: string; private_key: string };

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const sig = signer.sign(sa.private_key, 'base64url');
  const assertion = `${header}.${claims}.${sig}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('access_token 없음');
  return json.access_token;
}

export type SubmitResult =
  | { status: 'submitted'; property: string; sitemap: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };

/**
 * @param property  Search Console 속성. 도메인 속성이면 `sc-domain:usherinmaking.com`,
 *                  URL 접두어 속성이면 `https://usherinmaking.com/`.
 * @param sitemapUrl 제출할 사이트맵 절대 주소.
 */
export async function submitSitemap(property: string, sitemapUrl: string): Promise<SubmitResult> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) return { status: 'skipped', reason: 'GSC_SERVICE_ACCOUNT_JSON 미설정' };

  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) {
      throw new Error('서비스 계정 JSON 에 client_email/private_key 가 없음');
    }
    const token = await accessToken(sa);
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    // 성공은 204 No Content 다.
    if (res.status !== 204 && !res.ok) {
      throw new Error(`submit ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return { status: 'submitted', property, sitemap: sitemapUrl };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}
