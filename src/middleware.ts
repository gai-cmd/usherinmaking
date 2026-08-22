import { NextResponse, type NextRequest } from 'next/server';
import { LOCALES, SITE_URL, type Locale } from '@/lib/i18n';

const LOCALE_COOKIE = 'uim_locale';

/**
 * 어느 언어권에도 속하지 않는 방문자가 받을 언어.
 *
 * DEFAULT_LOCALE('ja')과 일부러 다르다. DEFAULT_LOCALE 은 hreflang 의 x-default,
 * 즉 "이 사이트의 대표 언어판"을 가리키는 SEO 신호다. 반면 여기는 사람을 어디로
 * 보낼지의 문제라, 일본어도 한국어도 못 읽는 방문자에게는 영어판이 맞다.
 * 둘을 하나로 합치면 프랑스어 브라우저가 일본어 페이지를 받는다.
 */
const FALLBACK_LOCALE: Locale = 'en';

/** Accept-Language 헤더에서 지원 로케일 중 가장 앞선 것을 고른다. */
function pickLocale(header: string | null): Locale {
  if (!header) return FALLBACK_LOCALE;
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
  return FALLBACK_LOCALE;
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

/**
 * SSO 자격 증명이 갖춰졌는지. src/auth.ts 의 isSsoConfigured() 와 같은 조건을 본다 —
 * 미들웨어는 엣지에서 돌아 next-auth 를 불러올 수 없으므로 환경변수를 직접 읽는다.
 * 둘 중 하나만 고치면 어긋나므로 같이 고칠 것.
 */
function ssoConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET &&
      process.env.AUTH_SECRET &&
      process.env.ADMIN_ALLOWED_EMAILS,
  );
}

function guardAdmin(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin')) return null;

  // SSO 를 아직 설정하지 않은 개발 환경에서는 통과시킨다.
  // checkAdminPageAccess() 도 같은 조건에서 열어 주는데 여기서 먼저 돌려보내면
  // 두 층의 판정이 어긋나 관리자 화면을 로컬에서도 열 수 없다.
  //
  // NODE_ENV 가 production 이면 이 분기는 절대 타지 않는다. 배포본은 종전과 같이
  // 세션 쿠키가 없으면 로그인으로 돌려보낸다.
  if (!ssoConfigured() && process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

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

/**
 * 정본 호스트. NEXT_PUBLIC_SITE_URL 이 곧 canonical·hreflang·사이트맵이 쓰는 주소이므로,
 * 사람이 실제로 받는 주소도 같아야 두 신호가 어긋나지 않는다.
 */
const CANONICAL_HOST = new URL(SITE_URL).host;

/**
 * 정본이 아닌 호스트로 들어온 요청을 정본으로 넘긴다.
 *
 * 도메인을 붙이고 나면 같은 사이트가 usherinmaking.com 과 usherinmaking.vercel.app
 * 두 주소로 동시에 열린다. 둘 다 열려 있으면 검색엔진에는 같은 내용의 사이트가 두 개
 * 있는 셈이라, 어느 쪽을 실을지 갈리고 링크 신호도 둘로 쪼개진다. canonical 태그는
 * 권고일 뿐 접근 자체를 막지 못하므로, 여기서 주소를 하나로 모은다.
 *
 * 프로덕션에서만 돈다 — 미리보기 배포는 각자의 vercel.app 주소로 열려야 하고,
 * 로컬은 localhost 로 열려야 한다. 정본이 아직 vercel.app 이면(도메인 연결 전)
 * 아무것도 하지 않는다.
 */
function canonicalHost(req: NextRequest): NextResponse | null {
  if (process.env.VERCEL_ENV !== 'production') return null;
  if (CANONICAL_HOST.endsWith('.vercel.app')) return null;

  const host = req.headers.get('host');
  if (!host || host === CANONICAL_HOST) return null;

  const url = req.nextUrl.clone();
  url.host = CANONICAL_HOST;
  url.port = '';
  url.protocol = 'https:';
  // 308 은 메서드와 본문을 보존하는 영구 이동이다. 검색엔진은 301 과 같게 취급한다.
  return NextResponse.redirect(url, 308);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 호스트 정리가 먼저다. 로케일을 붙인 뒤에 호스트를 옮기면 방문자가 리다이렉트를
  // 두 번 타고, 검색엔진에는 그 사슬이 그대로 노출된다.
  const hostRedirect = canonicalHost(req);
  if (hostRedirect) return hostRedirect;

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
