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

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

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
    '/((?!_next|api|admin|images|brand|favicon.png|apple-touch-icon.png|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
