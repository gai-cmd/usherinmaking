import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContactCta } from '@/components/ContactCta';
import { LOCALES, SITE_URL, alternates, isLocale, path, type Locale } from '@/lib/i18n';
import { PHOTOGRAPHER } from './content';
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
  const c = PHOTOGRAPHER[locale];
  return {
    title: c.meta.title,
    description: c.meta.description,
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'photographer')}`,
      languages: alternates('photographer'),
    },
    openGraph: {
      title: `${c.meta.title} | usherinmaking`,
      description: c.meta.description,
      url: `${SITE_URL}${path(locale, 'photographer')}`,
      type: 'profile',
    },
  };
}

/**
 * 예약 페이지 자리를 대신하는 작가 소개.
 * 구조화 데이터는 확인된 사실만 담는다 — 포트레이트가 없으므로 image 는 넣지 않는다.
 */
function profileJsonLd(locale: Locale) {
  const c = PHOTOGRAPHER[locale];
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    inLanguage: locale,
    url: `${SITE_URL}${path(locale, 'photographer')}`,
    mainEntity: {
      '@type': 'Person',
      name: 'usherinmaking',
      jobTitle: c.eyebrow,
      description: c.intro.join(' '),
      knowsLanguage: ['ko', 'ja', 'en'],
      areaServed: 'Okinawa, Japan',
      url: `${SITE_URL}${path(locale, 'photographer')}`,
    },
  };
}

export default async function PhotographerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const c = PHOTOGRAPHER[locale];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd(locale)) }}
      />

      {/* 인트로 — 좌 포트레이트 자리, 우 정의형 도입 문단 */}
      <section className={s.intro}>
        <div className={s.portrait} aria-hidden>
          <span className={s.portraitLabel}>{c.portraitPlaceholder}</span>
        </div>

        <div className={s.introBody}>
          <p className="u-label">{c.eyebrow}</p>
          <h1 className={`u-display ${s.title}`}>{c.title}</h1>
          <p className={s.lead}>
            {c.intro.map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>

          <dl className={s.facts}>
            {c.facts.map((f) => (
              <div key={f.label} className={s.fact}>
                <dt className={s.factLabel}>{f.label}</dt>
                <dd className={s.factValue}>{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 이름의 유래 */}
      <section className={`u-section u-section--alt ${s.name}`}>
        <div className="u-wrap">
          <p className="u-label">{c.name.label}</p>
          <p className={`u-lead ${s.nameLead}`}>
            {c.name.lines.map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
          <p className={s.nameNote}>
            {c.name.note.map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* 촬영 방식 3가지 */}
      <section className="u-section">
        <div className="u-wrap">
          <div className={s.howHead}>
            <p className="u-label">{c.how.label}</p>
            <h2 className={`u-h2 ${s.howTitle}`}>{c.how.title}</h2>
          </div>
          <ul className={s.points}>
            {c.how.points.map((p) => (
              <li key={p.title} className={s.point}>
                <h3 className={s.pointTitle}>{p.title}</h3>
                <p className={s.pointBody}>{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3분할 이미지 — 거터 없이 화면 폭 전체 */}
      <section className={s.split}>
        {c.gallery.map((img) => (
          <div key={img.src} className={s.splitCell}>
            <Image src={img.src} alt={img.alt} fill sizes="(max-width: 767px) 50vw, 33vw" />
          </div>
        ))}
      </section>

      {/* 상담 언어 + SNS */}
      <section className="u-section u-section--alt">
        <div className={`u-wrap ${s.guestGrid}`}>
          <div>
            <p className="u-label">{c.guests.label}</p>
            <h2 className={`u-h2 ${s.guestTitle}`}>{c.guests.title}</h2>
            <p className={s.guestBody}>
              {c.guests.body.map((line, i) => (
                <span key={line}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </p>
          </div>

          <div>
            <p className="u-label">{c.follow.label}</p>
            <h2 className={`u-h2 ${s.guestTitle}`}>{c.follow.title}</h2>
            <ul className={s.rows}>
              {c.follow.rows.map((row) => {
                const body = (
                  <>
                    <span className={s.rowLabel}>
                      {row.label} <span className={s.rowNote}>{row.note}</span>
                    </span>
                    {row.page && <span className={s.rowOpen}>OPEN →</span>}
                  </>
                );
                return (
                  <li key={row.label} className={s.row}>
                    {row.page ? (
                      <Link href={path(locale, row.page)} className={s.rowLink} data-tap>
                        {body}
                      </Link>
                    ) : (
                      // 인스타그램은 아웃링크를 걸지 않는다 — 계정만 표기한다.
                      <span className={s.rowLink}>{body}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className={s.rowsNote}>{c.follow.note}</p>
          </div>
        </div>
      </section>

      <ContactCta locale={locale} />
    </>
  );
}
