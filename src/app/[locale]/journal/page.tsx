import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContactCta } from '@/components/ContactCta';
import { JournalList } from '@/components/journal/JournalList';
import {
  CATEGORY_LABEL,
  JOURNAL_UI,
  SAMPLE_BADGE,
  featuredPost,
  formatDate,
  listPosts,
  usedCategories,
} from '@/content/journal';
import { LOCALES, SITE_URL, alternates, isLocale, path } from '@/lib/i18n';
import { getPageCopy, toLines } from '@/server/page-content';
import { getJournalContentPosts } from '@/server/journal-content';
import s from './page.module.css';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const text = await getPageCopy('journal', locale);
  return {
    title: text['meta.title'],
    description: text['meta.description'],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'journal')}`,
      languages: alternates('journal'),
    },
    openGraph: {
      title: `${text['meta.title']} | usherinmaking`,
      description: text['meta.description'],
      url: `${SITE_URL}${path(locale, 'journal')}`,
      type: 'website',
    },
  };
}

export default async function JournalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const ui = JOURNAL_UI[locale];
  const text = await getPageCopy('journal', locale);
  // 관리자·네이버 취입분은 DB 에 있다. 없으면 코드 시드가 그대로 나온다.
  const all = await getJournalContentPosts();
  const featured = featuredPost(locale, all);
  // 대표 글은 위에서 크게 보여주므로 그리드에서는 뺀다.
  const rest = listPosts(locale, all).filter((p) => p.slug !== featured?.slug);

  return (
    <>
      <section className={s.head}>
        <div className="u-wrap">
          <p className="u-label">{ui.eyebrow}</p>
          <h1 className={`u-display ${s.title}`}>{text['heading']}</h1>
          {/* 글이 전부 샘플이라는 사실을 목록 맨 위에서 밝힌다 */}
          <p className={s.sampleBadge}>{SAMPLE_BADGE[locale]}</p>
          <p className={s.lead}>
            {toLines(text['lead']).map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
          {/* 네이버 블로그 안내는 한국어 페이지에만 */}
          {text['naverNote'] && <p className={s.naverNote}>{text['naverNote']}</p>}
        </div>
      </section>

      {featured && (
        <section className={s.featuredSection}>
          <div className="u-wrap">
            {/* 대표 글은 이미지·본문 전체가 하나의 링크다 */}
            <Link href={path(locale, 'journal', featured.slug)} className={s.featured}>
              <span className={s.featuredImage}>
                <Image
                  src={featured.cover.src}
                  alt={featured.cover.alt}
                  fill
                  priority
                  sizes="(max-width: 767px) 100vw, 55vw"
                />
              </span>
              <span className={s.featuredBody}>
                <span className={s.featuredMeta}>
                  {CATEGORY_LABEL[featured.category][locale]}
                  <span className={`u-num ${s.featuredDate}`}>
                    {' '}
                    · {formatDate(featured.publishedAt)}
                  </span>
                </span>
                <span className={s.featuredTitle}>{featured.title}</span>
                <span className={s.featuredExcerpt}>{featured.excerpt}</span>
                <span className={s.readMore}>{ui.readMore}</span>
              </span>
            </Link>
          </div>
        </section>
      )}

      <section className={s.listSection}>
        <JournalList locale={locale} posts={rest} categories={usedCategories(locale, all)} />
      </section>

      <ContactCta locale={locale} />
    </>
  );
}
