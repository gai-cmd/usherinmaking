import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n';

const LOCALE_COOKIE = 'uim_locale';

/** Accept-Language 헤더에서 지원 로케일 중 가장 앞선 것을 고른다. */
function pickLocale(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return DEFAULT_LOCALE;
}

/**
 * 관리자 사전 차단.
 *
 * 레이아웃 가드만으로는 자식 페이지의 실행을 막지 못한다 — App Router에서 자식 세그먼트는
 * 부모의 조건과 무관하게 렌더되고, 그 결과가 같은 응답의 RSC 페이로드에 실려 나간다.
 * 여기서 세션 쿠키가 아예 없는 요청을 렌더 이전에 돌려보낸다.
 *
 * 이건 값싼 사전 필터일 뿐이고 최종 판정이 아니다. 쿠키가 위조되었거나 만료되었어도
 * 여기는 통과하므로, 각 페이지의 checkAdminPageAccess()가 여전히 권위 있는 검사다.
 */
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];

function guardAdmin(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin')) return null;

  // 관리자는 로케일 경로 밖에 있다. 아래 로케일 로직으로 흘러가면 /ko/admin 으로 바뀌어
  // 존재하지 않는 경로가 되므로, 판정이 끝나면 여기서 응답을 확정해 돌려준다.
  const isLogin = pathname === '/admin/login' || pathname.startsWith('/admin/login/');
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.get(name)?.value);

  if (isLogin || hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const adminRedirect = guardAdmin(req);
  if (adminRedirect) return adminRedirect;

  const hasLocale = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return NextResponse.next();

  // 선택한 언어는 쿠키에 저장하고, 없으면 브라우저 언어로 감지한다.
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    cookie && (LOCALES as readonly string[]).includes(cookie)
      ? (cookie as Locale)
      : pickLocale(req.headers.get('accept-language'));

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  url.search = search;

  const res = NextResponse.redirect(url);
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return res;
}

export const config = {
  matcher: [
    // 정적 자산과 API, 파일 확장자가 있는 경로는 건드리지 않는다.
    // /admin 은 제외하지 않는다 — 미인증 요청을 렌더 이전에 돌려보내야 하기 때문이다.
    '/((?!_next|api|images|brand|favicon.png|apple-touch-icon.png|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
