import type { Metadata } from 'next';
import { SEARCH_TERMS } from '@/lib/structured-data';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { HTML_LANG, LOCALES, SITE_URL, isLocale } from '@/lib/i18n';
import '../globals.css';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * 검색엔진 소유확인 태그.
 *
 * 이 값들은 옛 Wix 사이트(usherinmaking.com)의 HTML 에 박혀 있던 것과 같은 값이다.
 * 도메인을 이 사이트로 돌리는 순간 그 HTML 은 사라지므로, 여기에 같은 값을 옮겨
 * 두지 않으면 Search Console 과 네이버 서치어드바이저의 소유확인이 함께 풀린다.
 * 등록이 풀리면 색인 현황·검색 유입 데이터가 끊기고 재등록까지 공백이 생긴다.
 *
 * 값을 바꾸지 말 것 — 각 도구에 등록된 토큰과 한 글자라도 다르면 확인에 실패한다.
 */
const GOOGLE_SITE_VERIFICATION = 'qar5pssLealM36EvEUxv6LImy0b94Ots9VzoiFTUpIw';
/**
 * 네이버는 호스트마다 별도 사이트로 등록하므로 토큰이 여러 개다. 정본이 아닌 호스트는
 * 전부 usherinmaking.com 으로 308 집결되어 결국 이 페이지가 응답하니, 네이버가
 * 리다이렉트를 따라오는 경우에 대비해 모든 토큰을 함께 내보낸다(메타 태그 중복 허용).
 * 권장 방식인 HTML 파일은 public/naver*.html 에 두었고, 점이 든 경로라 미들웨어의
 * 호스트 리다이렉트를 타지 않아 각 호스트에서 200 으로 바로 나간다.
 */
const NAVER_SITE_VERIFICATION = [
  '9cd087cb75bfafd1c182ed79bed0c84792cec2e0', // usherinmaking.com (옛 Wix 에서 이전)
  'eaf6c233aa8d2013805a14648defdfce8dd68e7b', // www.usherinmaking.com
  'bea0c8543760497312fd42338319fa5381b180b6', // www.usherinmaking.jp
  '566734477f882ab5e1abed8a0f562eaf1d391d86', // www.usherinmaking.co.kr
];

/**
 * 언어별로 달라지는 항목은 keywords 뿐이다. 구글은 이 태그를 무시하지만 네이버·Bing 은
 * 읽는다(Bing 은 구조화 신호를 공식 인정하는 유일한 엔진이다). 화면에는 보이지 않으므로
 * 본문 문구를 건드리지 않고 검색어 정확 형태를 둘 수 있는 자리다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: 'usherinmaking', template: '%s | usherinmaking' },
    icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
    ...(isLocale(locale) ? { keywords: [...SEARCH_TERMS[locale]] } : {}),
    verification: {
      google: GOOGLE_SITE_VERIFICATION,
      // 네이버는 Next.js 가 이름을 아는 항목이 아니라서 other 로 직접 내보낸다.
      other: { 'naver-site-verification': NAVER_SITE_VERIFICATION },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    // 서체는 애플 시스템 서체를 쓰므로 외부 폰트 요청이 없다 (globals.css 참조).
    <html lang={HTML_LANG[locale]}>
      <body>
        <GoogleAnalytics />
        <Header locale={locale} />
        <main>{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
