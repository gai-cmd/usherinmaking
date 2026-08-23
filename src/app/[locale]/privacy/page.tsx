import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LOCALES, SITE_URL, alternates, isLocale, path, type Locale, metaDescription } from '@/lib/i18n';
import {
  PRIVACY_CLAUSES,
  PRIVACY_DATES,
  PRIVACY_INTRO,
  PRIVACY_SUBTITLE,
  PRIVACY_TITLE,
} from './content';
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

  const description: Record<Locale, string> = {
    ja: 'usherinmaking がメッセージでのお問い合わせを通じて取得する個人情報の取り扱いについて定めた方針です。',
    en: 'How usherinmaking handles the personal information received through messages you send us.',
    ko: 'usherinmaking이 메신저 문의를 통해 취득하는 개인정보의 취급을 정한 방침입니다.',
  };

  return {
    title: PRIVACY_TITLE[locale],
    description: metaDescription(description[locale]),
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'privacy')}`,
      languages: alternates('privacy'),
    },
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <article className={s.root}>
      <header className={`u-wrap ${s.head}`}>
        <p className="u-label">PRIVACY POLICY</p>
        <h1 className={`u-h2 ${s.title}`}>{PRIVACY_TITLE[locale]}</h1>
        <p className={s.subtitle}>{PRIVACY_SUBTITLE[locale]}</p>
        {/* 정의형 리드 — 이 페이지가 무엇을 정하는지 첫 문단에서 답한다 */}
        <p className={s.intro}>{PRIVACY_INTRO[locale]}</p>
      </header>

      <div className={`u-wrap ${s.body}`}>
        {PRIVACY_CLAUSES.map((clause) => (
          <section key={clause.no} className={s.clause}>
            <p className={`u-num ${s.no}`}>{clause.no}</p>
            <div>
              <h2 className={s.heading}>{clause.heading[locale]}</h2>
              {clause.body.map((p, i) => (
                <p key={i} className={s.para}>
                  {p[locale]}
                </p>
              ))}
            </div>
          </section>
        ))}

        <p className={s.dates}>{PRIVACY_DATES[locale]}</p>
      </div>
    </article>
  );
}
