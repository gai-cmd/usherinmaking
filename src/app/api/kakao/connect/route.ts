import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from '@/lib/i18n';
import { authorizeUrl, kakaoConfig } from '@/server/kakao-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 카카오톡 보고서 수신 동의 시작점.
 *
 * 수신자 본인이 브라우저에서 이 주소를 열면 카카오 로그인·동의 화면으로 넘어간다.
 * ?who=<이름표> 로 누구의 연결인지 표시한다 (예: /api/kakao/connect?who=amipaek).
 * 관리자 인증을 걸지 않는 이유: 동의하는 사람이 관리자가 아니라 수신자 본인이고,
 * 이 경로가 하는 일은 카카오 공식 동의 화면으로 보내는 것뿐이다. 토큰은 콜백에서만 생긴다.
 */
export async function GET(req: NextRequest) {
  const { ready, restKey } = kakaoConfig();
  if (!restKey) {
    return NextResponse.json(
      { error: 'KAKAO_REST_API_KEY 미설정 — 카카오 개발자 앱을 먼저 만들어야 합니다.' },
      { status: 503 },
    );
  }
  if (!ready) {
    return NextResponse.json({ error: 'SERVICE_VAULT_KEY 미설정 — 토큰을 봉인할 수 없습니다.' }, { status: 503 });
  }

  const who = (req.nextUrl.searchParams.get('who') ?? '').trim().slice(0, 40);
  if (!who) {
    return NextResponse.json({ error: '?who=<이름표> 가 필요합니다 (예: ?who=amipaek)' }, { status: 400 });
  }

  // CSRF 방지: state 를 쿠키와 쿼리에 함께 싣고 콜백에서 대조한다.
  const state = randomBytes(16).toString('hex');
  const redirectUri = `${SITE_URL}/api/kakao/callback`;

  const res = NextResponse.redirect(authorizeUrl(redirectUri, `${state}:${who}`));
  res.cookies.set('kakao_oauth_state', state, {
    path: '/api/kakao',
    maxAge: 600,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
  });
  return res;
}
