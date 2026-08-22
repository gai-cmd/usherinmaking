import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactCta } from '@/components/ContactCta';
import { GalleryView } from '@/components/gallery/GalleryView';
import { GALLERY } from '@/components/gallery/content';
import { filterBy, getPublishedPhotos } from '@/server/photos-content';
import {
  AXIS_ORDER,
  parseFilter,
  selectionSegments,
  staticFilterCombinations,
  termLabel,
  type Selection,
  type Term,
} from '@/content/taxonomy';
import { SITE_URL, alternates, isLocale, path, type Locale } from '@/lib/i18n';

/**
 * 필터 조합마다 실제 URL을 갖는다 — /ja/gallery/studio/wedding 형태.
 * 단일 term과 place 짝만 미리 만들고, 나머지 유효 조합은 요청 시 렌더링한다.
 */
export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  return staticFilterCombinations(params.locale).map((filter) => ({ filter }));
}

/** 선택된 term을 축 순서대로 돌려준다 */
function selectedTerms(selection: Selection): Term[] {
  return AXIS_ORDER.map((axis) => selection[axis]).filter((term): term is Term => Boolean(term));
}

function selectionLabel(selection: Selection, locale: Locale): string {
  return selectedTerms(selection)
    .map((term) => termLabel(term, locale))
    .join(' · ');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; filter: string[] }>;
}): Promise<Metadata> {
  const { locale, filter } = await params;
  if (!isLocale(locale)) return {};

  const selection = parseFilter(filter, locale);
  if (!selection) return {};

  const segments = selectionSegments(selection);
  const label = selectionLabel(selection, locale);
  const count = filterBy(await getPublishedPhotos(), segments).length;

  const description: Record<Locale, string> = {
    ja: `${label}の写真 ${count}件。${GALLERY.definition.ja}`,
    en: `${count} photographs filed under ${label}. ${GALLERY.definition.en}`,
    ko: `${label} 사진 ${count}장. ${GALLERY.definition.ko}`,
  };

  return {
    title: `${label} | ${locale === 'ja' ? 'ギャラリー' : locale === 'ko' ? '갤러리' : 'Gallery'}`,
    description: description[locale],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'gallery', ...segments)}`,
      languages: alternates('gallery', ...segments),
    },
  };
}

export default async function GalleryFilterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; filter: string[] }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, filter } = await params;
  if (!isLocale(locale)) notFound();

  const selection = parseFilter(filter, locale);
  if (!selection) notFound();

  // 정규 순서가 아닌 주소는 중복 URL이 되므로 받아주지 않는다
  const segments = selectionSegments(selection);
  if (segments.join('/') !== filter.join('/')) notFound();

  const { page } = await searchParams;
  const pageNumber = Math.max(1, Number(page) || 1);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: GALLERY.title[locale],
        item: `${SITE_URL}${path(locale, 'gallery')}`,
      },
      ...selectedTerms(selection).map((term, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        name: termLabel(term, locale),
        item: `${SITE_URL}${path(locale, 'gallery', ...segments.slice(0, index + 1))}`,
      })),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <GalleryView locale={locale} selection={selection} page={pageNumber} />
      <ContactCta locale={locale} />
    </>
  );
}
