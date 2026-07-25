import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EnquiryForm } from '@/components/contact/EnquiryForm';
import { CHANNELS, STUDIO_INFO, TBC, NAVER_BLOG_NOTICE_LOCALE } from '@/content/site';
import { LOCALES, SITE_URL, UI, alternates, isLocale, path, type Locale } from '@/lib/i18n';
import { CONTACT } from './content';
import s from './page.module.css';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

const TITLE: Record<Locale, string> = {
  ja: 'お問い合わせ',
  en: 'Contact',
  ko: '문의',
};

/** 언어마다 구분점이 다르다 — EN 페이지에 일본어 중점을 쓰지 않는다. */
const DOT: Record<Locale, string> = { ja: ' ・ ', en: ' · ', ko: ' · ' };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  return {
    title: TITLE[locale],
    description: CONTACT.definition[locale],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'contact')}`,
      languages: alternates('contact'),
    },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const channels = CHANNELS[locale];
  const showNaverBlog = locale === NAVER_BLOG_NOTICE_LOCALE;

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: CONTACT.faq.map((item) => ({
      '@type': 'Question',
      name: item.q[locale],
      acceptedAnswer: { '@type': 'Answer', text: item.a[locale] },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />

      <header className={`u-section u-center ${s.hero}`}>
        <div className="u-wrap">
          <p className="u-label">{CONTACT.eyebrow}</p>
          <h1 className={`u-display ${s.title}`}>{CONTACT.title[locale]}</h1>
          <p className={`u-lead ${s.definition}`}>{CONTACT.definition[locale]}</p>
          {CONTACT.lead[locale].map((line) => (
            <p key={line} className={`u-body ${s.lead}`}>
              {line}
            </p>
          ))}
        </div>
      </header>

      <div className={s.layout}>
        {/* 모바일에서는 메신저 카드가 폼보다 위에 온다 */}
        <section className={s.direct}>
          <p className="u-label">{CONTACT.directLabel}</p>
          <h2 className={`u-h2 ${s.blockTitle}`}>{CONTACT.directTitle[locale]}</h2>

          <ul className={s.channels}>
            {channels.map((channel) => {
              const body = (
                <>
                  <span className={s.channelName}>{channel.label[locale]}</span>
                  {channel.note[locale] && (
                    <span className={s.channelNote}>{channel.note[locale]}</span>
                  )}
                </>
              );

              return (
                <li key={channel.id}>
                  {/* 폼은 같은 페이지 안이라 앵커로 잇는다. 외부 채널 주소는 아직 없다. */}
                  {channel.id === 'form' ? (
                    <a
                      href="#enquiry-form"
                      className={s.channel}
                      data-primary={channel.primary || undefined}
                      data-tap
                    >
                      {body}
                      <span className={s.channelOpen}>OPEN →</span>
                    </a>
                  ) : (
                    <div className={s.channel} data-primary={channel.primary || undefined}>
                      {body}
                    </div>
                  )}
                </li>
              );
            })}

            {showNaverBlog && (
              <li>
                <div className={s.channel}>
                  <span className={s.channelName}>{CONTACT.naverBlog.label[locale]}</span>
                  <span className={s.channelNote}>{CONTACT.naverBlog.note[locale]}</span>
                </div>
              </li>
            )}
          </ul>

          <p className={`u-meta ${s.noBooking}`}>{UI.noAutoBooking[locale]}</p>
        </section>

        <section className={s.formCol} id="enquiry-form">
          <p className="u-label">{CONTACT.formLabel}</p>
          <h2 className={`u-h2 ${s.blockTitle}`}>{CONTACT.formTitle[locale]}</h2>
          <EnquiryForm locale={locale} />
        </section>

        <section className={s.faq}>
          <p className="u-label">{CONTACT.faqLabel}</p>
          <div className={s.faqList}>
            {CONTACT.faq.map((item) => (
              <details key={item.q.en} className={s.faqItem}>
                <summary className={s.faqQuestion} data-tap>
                  {item.q[locale]}
                  <span aria-hidden="true" className={s.faqMark}>
                    +
                  </span>
                </summary>
                <p className={s.faqAnswer}>{item.a[locale]}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={s.studio}>
          <h2 className={s.studioTitle}>{CONTACT.studioTitle[locale]}</h2>
          <p className={s.studioBody}>
            {CONTACT.studioRegion[locale]} <span className={s.tbc}>{TBC[locale]}</span>
            <br />
            {STUDIO_INFO.parking[locale]}
            {DOT[locale]}
            {CONTACT.landmark[locale]}
            <br />
            {STUDIO_INFO.languages[locale]}
          </p>

          {/* TODO(map): 주소 확정 후 Google 지도 iframe으로 교체한다. 확인 전에는 위치를 단정하지 않는다. */}
          <div className={s.map}>
            <div className={s.mapCanvas} aria-hidden="true" />
            <p className={s.mapCaption}>{CONTACT.mapCaption[locale]}</p>
          </div>
        </section>
      </div>

      <p className={`u-wrap ${s.footnote}`}>{CONTACT.footnote[locale]}</p>
    </>
  );
}
