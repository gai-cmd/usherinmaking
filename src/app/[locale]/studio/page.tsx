import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/Section';
import { PlanCard } from '@/components/PlanCard';
import { ContactCta } from '@/components/ContactCta';
import { STUDIO_SETS, STUDIO_PLANS, STUDIO_INFO, TBC } from '@/content/site';
import { LOCALES, SITE_URL, alternates, isLocale, path, type Locale } from '@/lib/i18n';
import { pickImage } from '@/lib/image-slot';
import { getPageCopy, toLines } from '@/server/page-content';
import { resolvePageImages } from '@/server/page-images';
import { ACCESS, FLOW, HERO, PLANS, SET_COPY, WORKS } from './content';
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
  const text = await getPageCopy('studio', locale);

  return {
    title: text['meta.title'],
    description: text['meta.description'],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'studio')}`,
      languages: alternates('studio'),
    },
    openGraph: {
      title: text['meta.title'],
      description: text['meta.description'],
      url: `${SITE_URL}${path(locale, 'studio')}`,
      images: [{ url: HERO.image }],
    },
  };
}

/** 주소를 아직 못 받았으면 TBC 토큰이 그대로 들어 있다 — 지도 임베드 가부의 유일한 기준. */
function resolvedAddress(locale: Locale): string | null {
  const value = STUDIO_INFO.address[locale];
  return value === TBC[locale] ? null : value;
}

export default async function StudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const address = resolvedAddress(locale);
  const [text, images] = await Promise.all([
    getPageCopy('studio', locale),
    resolvePageImages('studio'),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: text['meta.title'],
    description: text['meta.description'],
    serviceType: 'Indoor wedding photography',
    url: `${SITE_URL}${path(locale, 'studio')}`,
    areaServed: { '@type': 'Place', name: 'Okinawa, Japan' },
    provider: { '@type': 'Organization', name: 'usherinmaking', url: SITE_URL },
    offers: STUDIO_PLANS.map((plan) => ({
      '@type': 'Offer',
      name: plan.title[locale],
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
          src={HERO.image}
          alt={HERO.alt[locale]}
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

      {/* 정의형 리드문 — 페이지 상단의 실제 텍스트여야 AI 검색에 인용된다 */}
      <section className={`u-section ${s.leadSection}`}>
        <div className="u-wrap">
          <h1 className={`u-lead ${s.lead}`}>
            {toLines(text['lead']).map((line, i) => (
              <span key={line} className={s.leadLine}>
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

      <Section label="SETS" title={text['sets.title']} aside={text['sets.lead']}>
        <ul className={s.sets}>
          {STUDIO_SETS.map((set) => {
            const copy = SET_COPY[set.slug];
            const image = pickImage(images, `set.${set.slug}`, locale, set.image, copy.alt[locale]);
            return (
              <li key={set.slug} className={s.set}>
                {image && (
                  <div className={`u-arch ${s.setFigure}`}>
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes="(max-width: 767px) 60vw, 25vw"
                      className={s.setImage}
                    />
                  </div>
                )}
                <h3 className={s.setTitle}>{copy.title[locale]}</h3>
                <p className={s.setBody}>{copy.body[locale]}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <section className={`u-section u-section--alt ${s.flowSection}`}>
        <div className="u-wrap">
          <div className={s.flowHead}>
            <p className="u-label">FLOW</p>
            <h2 className="u-h2">{text['flow.title']}</h2>
          </div>
          <ol className={s.flow}>
            {FLOW.steps.map((step) => (
              <li key={step.no} className={s.step}>
                <span className={`u-num ${s.stepNo}`}>{step.no}</span>
                <span className={s.stepBody}>
                  <span className={s.stepTitle}>{step.title[locale]}</span>
                  <span className={s.stepNote}>{step.note[locale]}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Section
        label={PLANS.label[locale]}
        title={text['plans.title']}
        aside={
          <Link href={path(locale, 'plan')} className="u-btn" data-tap>
            {text['plans.link']}
          </Link>
        }
      >
        <div className={s.plans}>
          {STUDIO_PLANS.map((plan) => (
            <PlanCard key={plan.code} plan={plan} locale={locale} />
          ))}
        </div>
      </Section>

      <section className={s.access}>
        <div className={s.accessFigure}>
          <Image
            src={ACCESS.image}
            alt={ACCESS.alt[locale]}
            fill
            sizes="(max-width: 767px) 100vw, 50vw"
            className={s.accessImage}
          />
        </div>
        <div className={s.accessBody}>
          <p className="u-label">ACCESS</p>
          <h2 className={`u-h2 ${s.accessTitle}`}>{text['access.title']}</h2>

          <dl className={s.accessList}>
            <div className={s.accessRow}>
              <dt>{ACCESS.labels.address[locale]}</dt>
              <dd>
                {ACCESS.region[locale]} <span className={s.tbc}>{TBC[locale]}</span>
              </dd>
            </div>
            <div className={s.accessRow}>
              <dt>{ACCESS.labels.parking[locale]}</dt>
              <dd>{ACCESS.parking[locale]}</dd>
            </div>
            <div className={s.accessRow}>
              <dt>{ACCESS.labels.landmark[locale]}</dt>
              <dd>{text['access.landmark']}</dd>
            </div>
            <div className={s.accessRow}>
              <dt>{ACCESS.labels.languages[locale]}</dt>
              <dd>{ACCESS.languages[locale]}</dd>
            </div>
          </dl>

          {/* 주소가 없으면 지도를 부르지 않고 안내 블록으로 대체한다 */}
          {address ? (
            <div className={s.map}>
              <iframe
                title={ACCESS.mapTitle[locale]}
                src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className={s.mapFrame}
              />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                className={s.mapLink}
                target="_blank"
                rel="noreferrer"
                data-tap
              >
                {ACCESS.mapOpen[locale]}
              </a>
            </div>
          ) : (
            <p className={s.mapPending}>{ACCESS.mapPending[locale]}</p>
          )}
        </div>
      </section>

      <Section
        label="GALLERY"
        title={text['works.title']}
        alt
        aside={
          <Link href={path(locale, 'gallery', 'studio')} className="u-link" data-tap>
            {WORKS.viewAll[locale]}
          </Link>
        }
      >
        <ul className={s.works}>
          {WORKS.images.map((src) => (
            <li key={src} className={s.work}>
              <Image
                src={src}
                alt={WORKS.alt[locale]}
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
