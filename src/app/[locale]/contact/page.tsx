import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { EnquiryForm } from '@/components/contact/EnquiryForm';
import { CHANNELS, STUDIO_INFO, NAVER_BLOG_NOTICE_LOCALE, type Channel } from '@/content/site';
import { getSiteSettings } from '@/server/settings';
import { LOCALES, SITE_URL, UI, alternates, isLocale, path, type Locale } from '@/lib/i18n';
import { getPageCopy, toLines } from '@/server/page-content';
import { CONTACT } from './content';
import s from './page.module.css';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/** 다른 페이지와 같은 관례. 자동 예약은 없으므로 '상담' 이상으로 쓰지 않는다. */
const TITLE: Record<Locale, string> = {
  ja: 'お問い合わせ ・ 沖縄の撮影相談',
  en: 'Contact — enquiries for Okinawa sessions',
  ko: '문의 · 오키나와 촬영 상담',
};

/** 언어마다 구분점이 다르다 — EN 페이지에 일본어 중점을 쓰지 않는다. */
const MAP_OPEN: Record<Locale, string> = {
  ja: 'マップで開く ↗',
  en: 'Open in Google Maps ↗',
  ko: '지도에서 열기 ↗',
};

const DOT: Record<Locale, string> = { ja: ' ・ ', en: ' · ', ko: ' · ' };

/** 각 채널의 실제 브랜드 로고. 폼은 사이트 자체 채널이라 로고를 두지 않는다. */
const CHANNEL_ICON: Partial<Record<Channel['id'], string>> = {
  kakao: '/images/sns/kakao.png',
  line: '/images/sns/line.png',
  instagram: '/images/sns/instagram.png',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const text = await getPageCopy('contact', locale);

  return {
    title: TITLE[locale],
    description: text['definition'],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'contact')}`,
      languages: alternates('contact'),
    },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = await getPageCopy('contact', locale);

  // 라벨·문구는 코드(CHANNELS)가, 핸들·링크는 관리자 설정이 준다.
  // 링크가 있는 채널만 실제 <a> 가 된다 — 없는 링크를 죽은 버튼으로 두지 않는다.
  const settings = await getSiteSettings();
  const urlById = new Map(settings.channels[locale].map((c) => [c.id, c.url]));
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
          <h1 className={`u-display ${s.title}`}>{text['title']}</h1>
          <p className={`u-lead ${s.definition}`}>{text['definition']}</p>
          {toLines(text['lead']).map((line) => (
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
          <h2 className={`u-h2 ${s.blockTitle}`}>{text['direct.title']}</h2>

          <ul className={s.channels}>
            {channels.map((channel) => {
              const icon = CHANNEL_ICON[channel.id];
              const content = (
                <span className={s.channelMain}>
                  {icon && (
                    <span className={s.channelIcon} data-brand={channel.id} aria-hidden="true">
                      <Image src={icon} alt="" width={20} height={20} className={s.channelIconImg} />
                    </span>
                  )}
                  <span className={s.channelText}>
                    <span className={s.channelName}>{channel.label[locale]}</span>
                    {channel.note[locale] && (
                      <span className={s.channelNote}>{channel.note[locale]}</span>
                    )}
                  </span>
                </span>
              );

              // 로고가 있는 채널만 그 브랜드 색을 입힌다 — 폼은 사이트 자체 채널이라 색을 바꾸지 않는다.
              const brand = icon ? channel.id : undefined;
              const externalUrl = channel.id === 'form' ? null : (urlById.get(channel.id) ?? null);

              return (
                <li key={channel.id}>
                  {/* 폼은 같은 페이지 안이라 앵커로 잇는다. 외부 채널은 관리자 설정에
                      링크가 있을 때만 <a> 가 된다 — 죽은 버튼을 만들지 않는다. */}
                  {channel.id === 'form' ? (
                    <a
                      href="#enquiry-form"
                      className={s.channel}
                      data-primary={channel.primary || undefined}
                      data-tap
                    >
                      {content}
                      <span className={s.channelOpen}>OPEN →</span>
                    </a>
                  ) : externalUrl ? (
                    <a
                      href={externalUrl}
                      className={s.channel}
                      data-primary={channel.primary || undefined}
                      data-brand={brand}
                      target="_blank"
                      rel="noreferrer"
                      data-tap
                    >
                      {content}
                      <span className={s.channelOpen}>OPEN →</span>
                    </a>
                  ) : (
                    <div
                      className={s.channel}
                      data-primary={channel.primary || undefined}
                      data-brand={brand}
                    >
                      {content}
                    </div>
                  )}
                </li>
              );
            })}

            {showNaverBlog &&
              (() => {
                // 네이버는 로고 파일이 없어 공식 초록(#03C75A) 배지에 'N' 글자로 대신한다.
                const naverContent = (
                  <span className={s.channelMain}>
                    <span className={s.channelIcon} data-brand="naver" aria-hidden="true">
                      N
                    </span>
                    <span className={s.channelText}>
                      <span className={s.channelName}>{CONTACT.naverBlog.label[locale]}</span>
                      <span className={s.channelNote}>{CONTACT.naverBlog.note[locale]}</span>
                    </span>
                  </span>
                );

                return settings.naverBlog.url ? (
                  <li>
                    <a
                      href={settings.naverBlog.url}
                      className={s.channel}
                      target="_blank"
                      rel="noreferrer"
                      data-tap
                    >
                      {naverContent}
                      <span className={s.channelOpen}>OPEN →</span>
                    </a>
                  </li>
                ) : (
                  <li>
                    <div className={s.channel}>{naverContent}</div>
                  </li>
                );
              })()}
          </ul>

          <p className={`u-meta ${s.noBooking}`}>{UI.noAutoBooking[locale]}</p>
        </section>

        <section className={s.formCol} id="enquiry-form">
          <p className="u-label">{CONTACT.formLabel}</p>
          <h2 className={`u-h2 ${s.blockTitle}`}>{text['form.title']}</h2>
          <EnquiryForm
            locale={locale}
            privacyNote={text['form.privacyNote']}
            submitLabel={text['form.submit']}
          />
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
            {STUDIO_INFO.address[locale]}
            <br />
            {/* 한국 고객은 스튜디오로 오지 않는다 — 찾아오는 길 대신 거점 안내를 둔다 */}
            {locale === 'ko' ? (
              CONTACT.koStudioNote
            ) : (
              <>
                {STUDIO_INFO.parking[locale]}
                {DOT[locale]}
                {CONTACT.landmark[locale]}
              </>
            )}
            <br />
            {STUDIO_INFO.languages[locale]}
          </p>

          {/* 주소가 확정됐으므로 스튜디오 페이지와 같은 지도를 건다 */}
          <div className={s.map}>
            <iframe
              title={CONTACT.studioTitle[locale]}
              src={STUDIO_INFO.map.embed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className={s.mapFrame}
            />
            <a
              href={STUDIO_INFO.map.place}
              className={s.mapOpen}
              target="_blank"
              rel="noreferrer"
              data-tap
            >
              {MAP_OPEN[locale]}
            </a>
          </div>
        </section>
      </div>

      <p className={`u-wrap ${s.footnote}`}>{CONTACT.footnote[locale]}</p>
    </>
  );
}
