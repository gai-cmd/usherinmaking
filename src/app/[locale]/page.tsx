import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/Section';
import { PlanCard } from '@/components/PlanCard';
import { ContactCta } from '@/components/ContactCta';
import { HeroGate } from '@/components/home/HeroGate';
import { RecentWorks } from '@/components/home/RecentWorks';
import { HomeFaq } from '@/components/home/HomeFaq';
import { NaverNotice } from '@/components/home/NaverNotice';
import { StickyCta } from '@/components/home/StickyCta';
import { LOCALES, SITE_URL, alternates, isLocale, path, type Locale } from '@/lib/i18n';
import {
  ANNIVERSARY_PLANS,
  LOCATION_NOTES,
  LOCATION_PLANS,
  NAVER_BLOG_NOTICE_LOCALE,
  STUDIO_OPTIONS,
  STUDIO_PLANS,
  STUDIO_SETS,
  STUDIO_INFO,
  TBC,
} from '@/content/site';
import { HOME } from './home-content';
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
  const { title, description } = HOME[locale].meta;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'home')}`,
      languages: alternates('home'),
    },
    openGraph: {
      type: 'website',
      title: `${title} | usherinmaking`,
      description,
      url: `${SITE_URL}${path(locale, 'home')}`,
      images: [{ url: '/brand/logo.png' }],
    },
  };
}

/** 확정된 사실만 구조화한다. 주소처럼 아직 못 받은 값은 TBC 토큰 그대로 내보낸다. */
function jsonLd(locale: Locale) {
  const copy = HOME[locale];

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${SITE_URL}${path(locale, 'home')}#business`,
      name: 'usherinmaking',
      description: copy.meta.description,
      url: `${SITE_URL}${path(locale, 'home')}`,
      logo: `${SITE_URL}/brand/logo.png`,
      image: `${SITE_URL}/images/studio/IMG_0766.png`,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'JP',
        addressRegion: 'Okinawa',
        streetAddress: TBC[locale],
      },
      knowsLanguage: ['ja', 'en', 'ko'],
      amenityFeature: {
        '@type': 'LocationFeatureSpecification',
        name: STUDIO_INFO.parking[locale],
        value: true,
      },
      makesOffer: [
        {
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: copy.studioPlans.title },
          priceCurrency: 'JPY',
          price: STUDIO_PLANS[0].price,
        },
        {
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: copy.locationPlans.title },
          priceCurrency: 'JPY',
          price: LOCATION_PLANS[0].price,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: copy.faq.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ];
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = HOME[locale];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(locale)) }}
      />

      <HeroGate locale={locale} />

      {/* 정의형 리드문 — 히어로 바로 아래 실제 텍스트로 두는 것이 AI 인용의 1차 표면 */}
      <section className={`u-section ${s.lead}`}>
        <div className="u-wrap">
          <h1 className="u-lead">
            {copy.lead.headline.map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </h1>
          <p className={`u-body ${s.leadSub}`}>
            {copy.lead.sub.map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ---------- STUDIO PLAN ---------- */}
      <Section
        label={copy.studioPlans.label}
        title={copy.studioPlans.title}
        aside={copy.studioPlans.aside}
      >
        <ul className={s.planGrid}>
          {STUDIO_PLANS.map((plan) => (
            <li key={plan.code}>
              <PlanCard plan={plan} locale={locale} />
            </li>
          ))}
        </ul>

        <div className={s.optionBox}>
          <div className={s.optionHead}>
            <p className="u-label">{copy.studioPlans.optionLabel}</p>
            <p className="u-meta">{copy.studioPlans.optionNote}</p>
          </div>

          <ul className={s.optionGrid}>
            {STUDIO_OPTIONS.map((option) => (
              <li key={option.label.en} className={s.option}>
                <span className={s.optionLabel}>{option.label[locale]}</span>
                <span className={`u-num ${s.optionPrice}`}>{option.price[locale]}</span>
              </li>
            ))}
          </ul>

          <div className={s.optionFoot}>
            <p className={s.footNote}>{copy.studioPlans.note}</p>
            <p className={s.footActions}>
              <Link href={path(locale, 'plan')} className="u-btn" data-tap>
                {copy.studioPlans.detail}
              </Link>
            </p>
          </div>
        </div>
      </Section>

      {/* ---------- 스튜디오 세트 ---------- */}
      <Section
        label={copy.sets.label}
        title={copy.sets.title}
        lead={copy.sets.lead}
        aside={
          <Link href={path(locale, 'studio')} className="u-link">
            {copy.sets.cta}
          </Link>
        }
      >
        <ul className={s.setGrid}>
          {STUDIO_SETS.map((set) => (
            <li key={set.slug}>
              <span className={`u-arch ${s.setImage}`}>
                <Image
                  src={set.image}
                  alt={set.title[locale]}
                  fill
                  sizes="(max-width: 767px) 50vw, 25vw"
                  className={s.cover}
                />
              </span>
              <span className={s.setTitle}>{set.title[locale]}</span>
              <span className={s.setNote}>{set.note[locale]}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ---------- LOCATION PLAN ---------- */}
      <Section
        alt
        label={copy.locationPlans.label}
        title={copy.locationPlans.title}
        lead={copy.locationPlans.lead}
        aside={copy.locationPlans.aside}
      >
        <ul className={s.locGrid}>
          {LOCATION_PLANS.map((plan) => (
            <li key={plan.code}>
              <PlanCard plan={plan} locale={locale} />
            </li>
          ))}
        </ul>

        <div className={s.noteBox}>
          <p className="u-label">{copy.locationPlans.notesLabel}</p>
          <ul className={s.noteList}>
            {LOCATION_NOTES[locale].map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>

          <p className={s.anniversaryLabel}>{copy.locationPlans.anniversaryLabel}</p>
          <ul className={s.anniversary}>
            {ANNIVERSARY_PLANS.map((plan) => (
              <li key={plan.code}>
                <span>{plan.title[locale]}</span>
                <span className="u-num">¥{plan.price.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className={s.locActions}>
          <Link href={path(locale, 'location')} className="u-btn" data-tap>
            {copy.locationPlans.detail}
          </Link>
        </p>
      </Section>

      {/* ---------- 최근 작품 ---------- */}
      <Section label={copy.works.label} title={copy.works.title} lead={copy.works.lead}>
        <RecentWorks locale={locale} />
      </Section>

      {/* ---------- PHOTOGRAPHER ---------- */}
      <section className={s.photographer}>
        <div className={s.photographerImage}>
          <Image
            src="/images/studio/IMG_0769.png"
            alt={copy.photographer.alt}
            fill
            sizes="(max-width: 767px) 100vw, 55vw"
            className={s.cover}
          />
        </div>
        <div className={s.photographerBody}>
          <p className="u-label">{copy.photographer.label}</p>
          <p className={`u-h2 ${s.photographerName}`}>{copy.photographer.name}</p>
          <p className={s.photographerText}>
            {copy.photographer.body.map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
          <p className={s.photographerCta}>
            <Link href={path(locale, 'photographer')} className="u-link" data-tap>
              {copy.photographer.cta}
            </Link>
          </p>
        </div>
      </section>

      {/* 네이버 블로그 안내는 한국어 페이지 전용 */}
      {locale === NAVER_BLOG_NOTICE_LOCALE && <NaverNotice />}

      {/* ---------- FAQ ---------- */}
      <Section alt label={copy.faq.label} title={copy.faq.title}>
        <HomeFaq locale={locale} />
      </Section>

      <ContactCta locale={locale} />

      <StickyCta locale={locale} />
    </>
  );
}
