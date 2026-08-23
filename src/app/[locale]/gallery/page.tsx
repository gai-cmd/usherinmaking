import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactCta } from '@/components/ContactCta';
import { GalleryView } from '@/components/gallery/GalleryView';
import { GALLERY } from '@/components/gallery/content';
import { LOCALES, SITE_URL, alternates, isLocale, path, type Locale, metaDescription } from '@/lib/i18n';
import { breadcrumbLd, collectionPageLd, ldJson } from '@/lib/structured-data';

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
    description: metaDescription(GALLERY.definition[locale]),
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

  // 목록 페이지라는 것과 사이트 안의 위치를 검색엔진에 알린다. 작품 하나하나는
  // 상세 페이지가 ImageObject 로 말하므로 여기서는 묶음만 선언한다.
  const ld = ldJson(
    collectionPageLd(locale, 'gallery', TITLE[locale], GALLERY.definition[locale]),
    breadcrumbLd(locale, [{ name: TITLE[locale], page: 'gallery' }]),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <GalleryView locale={locale} selection={{}} page={pageNumber} />
      <ContactCta locale={locale} />
    </>
  );
}
