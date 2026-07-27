import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/Section';
import { PlanCard } from '@/components/PlanCard';
import { ContactCta } from '@/components/ContactCta';
import { LOCATION_PLANS, LOCATION_NOTES } from '@/content/site';
import { LOCALES, SITE_URL, alternates, isLocale, path } from '@/lib/i18n';
import { pickImage } from '@/lib/image-slot';
import { getPageCopy, toLines } from '@/server/page-content';
import { resolvePageImages } from '@/server/page-images';
import { ARCHIVE, CATEGORIES, DETAILS, HERO, WORKS } from './content';
import s from './page.module.css';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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
  const text = await getPageCopy('location', locale);

  return {
    title: text['meta.title'],
    description: text['meta.description'],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'location')}`,
      languages: alternates('location'),
    },
    openGraph: {
      title: text['meta.title'],
      description: text['meta.description'],
      url: `${SITE_URL}${path(locale, 'location')}`,
      images: [{ url: HERO.image }],
    },
  };
}

export default async function LocationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [text, images] = await Promise.all([
    getPageCopy('location', locale),
    resolvePageImages('location'),
  ]);

  // 히어로는 관리자에서 갈아끼운다. 코드 경로는 폴백일 뿐이다.
  const heroImage = pickImage(images, 'hero', locale, HERO.image, HERO.alt[locale])!;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: text['meta.title'],
    description: text['meta.description'],
    serviceType: 'Outdoor location photography',
    url: `${SITE_URL}${path(locale, 'location')}`,
    areaServed: { '@type': 'Place', name: 'Okinawa, Japan' },
    provider: { '@type': 'Organization', name: 'usherinmaking', url: SITE_URL },
    offers: LOCATION_PLANS.map((plan) => ({
      '@type': 'Offer',
      name: `${plan.badge} — ${plan.title[locale]}`,
      price: plan.price,
      priceCurrency: 'JPY',
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className={s.hero}>
        <Image
          src={heroImage.src}
          alt={heroImage.alt}
          fill
          priority
          sizes="100vw"
          className={s.heroImage}
        />
        <div className={s.heroScrim} />
        <div className={s.heroText}>
          <p className={s.heroEyebrow}>{HERO.eyebrow}</p>
          <p className={`u-display ${s.heroTitle}`}>{HERO.title}</p>
          {text['hero.sub'] && <p className={s.heroSub}>{text['hero.sub']}</p>}
        </div>
      </header>

      {/* 정의형 리드문 — 실제 텍스트로 노출해야 AI 검색에 인용된다 */}
      <section className={`u-section ${s.leadSection}`}>
        <div className="u-wrap">
          <h1 className={`u-lead ${s.lead}`}>
            {toLines(text['lead']).map((line, i) => (
              <span key={line}>
                {line}
                {i < toLines(text['lead']).length - 1 && <br />}
              </span>
            ))}
          </h1>
          <p className={`u-body ${s.leadNote}`}>
            {toLines(text['lead.note']).map((line, i) => (
              <span key={line}>
                {line}
                {i < toLines(text['lead.note']).length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* 지역이 아니라 촬영 종류로 나눈다 */}
      <Section
        label="CATEGORY"
        title={text['category.title']}
        aside={text['category.lead'] || undefined}
      >
        <ul className={s.categories}>
          {CATEGORIES.map((category) => {
            const image = pickImage(
              images,
              `category.${category.slug}`,
              locale,
              category.image,
              category.alt[locale],
            );
            return (
            <li key={category.slug} className={s.category}>
              <Link
                href={path(locale, 'gallery', 'location', category.slug)}
                className={s.categoryLink}
                data-tap
              >
                {image && (
                <span className={`u-arch-lg ${s.categoryFigure}`}>
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 767px) 100vw, 50vw"
                    className={s.categoryImage}
                  />
                </span>
                )}
                <span className={s.categoryEyebrow}>{category.eyebrow}</span>
                <span className={s.categoryTitle}>{category.title[locale]}</span>
                <span className={s.categoryBody}>{category.body[locale]}</span>
                <span className={s.categoryCta}>{category.link[locale]}</span>
              </Link>
            </li>
            );
          })}
        </ul>
      </Section>

      <section className="u-section u-section--alt">
        <div className="u-wrap">
          <div className={s.details}>
            {DETAILS.map((detail) => (
              <div key={detail.eyebrow}>
                <p className="u-label">{detail.eyebrow}</p>
                <h2 className={`u-h2 ${s.detailTitle}`}>{detail.title[locale]}</h2>
                <ul className={s.chips}>
                  {detail.chips[locale].map((chip) => (
                    <li key={chip} className={s.chip}>
                      {chip}
                    </li>
                  ))}
                </ul>
                <p className={s.detailNote}>{detail.note[locale]}</p>
              </div>
            ))}
          </div>

          {/* 월별 아카이브 — 건수 같은 근거 없는 수치는 넣지 않는다 */}
          <div className={s.archive}>
            <p className="u-label">ARCHIVE</p>
            <h2 className={`u-h2 ${s.archiveTitle}`}>{text['archive.title']}</h2>
            <p className={s.archiveLead}>{text['archive.lead']}</p>

            <ul className={s.themes}>
              {ARCHIVE.themes.map((theme) => (
                <li key={theme.slug}>
                  <Link
                    href={path(locale, 'gallery', 'location', theme.slug)}
                    className={`u-link ${s.theme}`}
                    data-tap
                  >
                    {theme.label[locale]}
                  </Link>
                </li>
              ))}
            </ul>

            <ul className={s.months}>
              {MONTHS.map((month) => {
                const slug = `month-${String(month).padStart(2, '0')}`;
                return (
                  <li key={slug}>
                    <Link
                      href={path(locale, 'gallery', 'location', slug)}
                      className={s.month}
                      data-tap
                    >
                      <span className={`u-num ${s.monthNo}`}>
                        {String(month).padStart(2, '0')}
                      </span>
                      <span className={s.monthName}>{ARCHIVE.monthLabel(locale, month)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <Section
        label="PLAN"
        title={text['plans.title']}
        aside={
          <Link href={path(locale, 'plan')} className="u-btn" data-tap>
            {text['plans.link']}
          </Link>
        }
      >
        <div className={s.plans}>
          {LOCATION_PLANS.map((plan) => (
            <PlanCard key={plan.code} plan={plan} locale={locale} />
          ))}
        </div>

        <ul className={s.notes}>
          {LOCATION_NOTES[locale].map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Section>

      <Section
        label={WORKS.label[locale]}
        title={text['works.title']}
        alt
        aside={
          <Link href={path(locale, 'gallery', 'location')} className="u-link" data-tap>
            {WORKS.viewAll[locale]}
          </Link>
        }
      >
        <ul className={s.works}>
          {WORKS.images.map((image) => (
            <li key={image.src} className={s.work}>
              <Image
                src={image.src}
                alt={image.alt[locale]}
                fill
                sizes="(max-width: 767px) 50vw, 20vw"
                className={s.workImage}
              />
            </li>
          ))}
        </ul>
      </Section>

      <ContactCta locale={locale} />
    </>
  );
}
