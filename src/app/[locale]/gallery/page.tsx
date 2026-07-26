import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactCta } from '@/components/ContactCta';
import { GalleryView } from '@/components/gallery/GalleryView';
import { GALLERY } from '@/components/gallery/content';
import { LOCALES, SITE_URL, alternates, isLocale, path, type Locale } from '@/lib/i18n';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/** 다른 페이지와 같은 관례 — 키워드 + 로케일 구분자 + 오키나와를 담은 설명구. */
const TITLE: Record<Locale, string> = {
  ja: 'ギャラリー ・ 沖縄の撮影作品',
  en: 'Gallery — photo work in Okinawa',
  ko: '갤러리 · 오키나와 촬영 작품',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  return {
    title: TITLE[locale],
    description: GALLERY.definition[locale],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'gallery')}`,
      languages: alternates('gallery'),
    },
  };
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { page } = await searchParams;
  const pageNumber = Math.max(1, Number(page) || 1);

  return (
    <>
      <GalleryView locale={locale} selection={{}} page={pageNumber} />
      <ContactCta locale={locale} />
    </>
  );
}
