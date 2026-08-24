import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from '@/lib/i18n';
import { connectRecipient } from '@/server/kakao-report';
import { logAdminAction } from '@/server/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 동의 완료 화면. 수신자 본인이 보는 한 장짜리 안내다. */
function page(title: string, body: string, ok: boolean): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<body style="font-family:system-ui,sans-serif;max-width:420px;margin:80px auto;padding:0 20px;text-align:center;color:#3f3a33">
<h1 style="font-size:20px">${ok ? '✅' : '⚠️'} ${title}</h1>
<p style="line-height:1.8;color:#5f584e">${body}</p>
</body>`,
    { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state') ?? '';
  const [state, ...whoParts] = stateParam.split(':');
  const who = whoParts.join(':') || '이름없음';
  const cookieState = req.cookies.get('kakao_oauth_state')?.value;

  if (!code) {
    return page('동의가 취소되었습니다', '카카오 동의 화면에서 취소하셨습니다. 다시 시도하려면 받은 링크를 다시 열어 주세요.', false);
  }
  if (!cookieState || cookieState !== state) {
    return page('확인 실패', '요청 출처를 확인할 수 없습니다. 받은 링크를 처음부터 다시 열어 주세요.', false);
  }

  const result = await connectRecipient(code, `${SITE_URL}/api/kakao/callback`, who);
  if (!result.ok) {
    return page('연결 실패', result.reason, false);
  }

  // 토큰 값은 로그에 넣지 않는다 — 누가 연결됐는지만.
  await logAdminAction('카카오 보고서 수신 연결', who);

  const res = page(
    '카카오톡 연결 완료',
    `이제 매일 아침 9시, <b>${who}</b> 님의 카카오톡 "나와의 채팅"으로 데일리 인사이트 요약이 도착합니다. 이 창은 닫으셔도 됩니다.`,
    true,
  );
  res.cookies.delete('kakao_oauth_state');
  return res;
}
