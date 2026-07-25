import type { Metadata } from 'next';
import { Fragment } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ContactCta } from '@/components/ContactCta';
import { DressCollection } from '@/components/dress/DressCollection';
import { LOCALES, SITE_URL, alternates, isLocale, path, type Locale } from '@/lib/i18n';
import * as C from './content';
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
  if (!isLocale(locale)) notFound();

  return {
    title: C.META_TITLE[locale],
    description: C.HERO.lead[locale],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'dress')}`,
      languages: alternates('dress'),
    },
  };
}

export default async function DressPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <>
      {/* 히어로 — 왼쪽 사진 520px, 오른쪽에 정의형 리드문 */}
      <header className={s.hero}>
        <div className={s.heroImg}>
          <Image
            src="/images/studio/IMG_0698.png"
            alt={C.HERO.imageAlt[locale]}
            fill
            priority
            sizes="(max-width: 767px) 100vw, 54vw"
            className={s.heroImgInner}
          />
        </div>
        <div className={s.heroText}>
          <p className="u-label">{C.HERO.label}</p>
          <h1 className={`u-display ${s.h1}`}>{title(locale)}</h1>
          <p className={s.lead}>{C.HERO.lead[locale]}</p>
        </div>
      </header>

      <section className="u-section">
        <div className="u-wrap">
          <div className={s.collHead}>
            <p className="u-label">{C.COLLECTION.label}</p>
            <h2 className={`u-h2 ${s.collTitle}`}>{C.COLLECTION.title[locale]}</h2>
          </div>
          <DressCollection locale={locale} />
        </div>
      </section>

      <section className="u-section u-section--alt">
        <div className={`u-wrap ${s.two}`}>
          <div>
            <p className="u-label">{C.RENTAL.label}</p>
            <h2 className={`u-h2 ${s.collTitle}`}>{C.RENTAL.title[locale]}</h2>
            <dl className={s.rental}>
              {C.RENTAL.rows.map((row) => (
                <div key={row.head[locale]} className={s.rentalRow}>
                  <dt className={s.rentalHead}>{row.head[locale]}</dt>
                  <dd className={`u-num ${s.rentalBody}`}>{row.body[locale]}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <p className="u-label">{C.FITTING.label}</p>
            <h2 className={`u-h2 ${s.collTitle}`}>{C.FITTING.title[locale]}</h2>
            <ol className={s.flow}>
              {C.FITTING.steps[locale].map((step, i) => (
                <li key={step} className={s.flowStep}>
                  <span className={`u-num ${s.flowNo}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <ContactCta locale={locale} />
    </>
  );
}

/** ja / en 은 두 줄로 끊어 쓰는 타이틀이라 개행을 살린다. */
function title(locale: Locale) {
  return C.HERO.title[locale].split('\n').map((line, i) => (
    <Fragment key={line}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}
