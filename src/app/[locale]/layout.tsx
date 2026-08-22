import type { Metadata } from 'next';
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
const NAVER_SITE_VERIFICATION = '9cd087cb75bfafd1c182ed79bed0c84792cec2e0';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'usherinmaking', template: '%s | usherinmaking' },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  verification: {
    google: GOOGLE_SITE_VERIFICATION,
    // 네이버는 Next.js 가 이름을 아는 항목이 아니라서 other 로 직접 내보낸다.
    other: { 'naver-site-verification': NAVER_SITE_VERIFICATION },
  },
};

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
        <Header locale={locale} />
        <main>{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
