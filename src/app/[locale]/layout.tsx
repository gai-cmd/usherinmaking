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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'usherinmaking', template: '%s | usherinmaking' },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
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
