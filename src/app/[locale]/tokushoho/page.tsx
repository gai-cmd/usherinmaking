import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LOCALES, SITE_URL, alternates, isLocale, path, type Locale, metaDescription } from '@/lib/i18n';
import { TBC } from '@/content/site';
import {
  TOKUSHOHO_INTRO,
  TOKUSHOHO_ROWS,
  TOKUSHOHO_TITLE,
  TOKUSHOHO_UPDATED,
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
    ja: '特定商取引法第11条に基づく、usherinmaking の撮影サービスに関する取引条件の表記です。',
    en: 'The terms on which usherinmaking provides photography, as required by Article 11 of the Act on Specified Commercial Transactions.',
    ko: '특정상거래법 제11조에 근거한 usherinmaking 촬영 서비스의 거래 조건 표기입니다.',
  };

  return {
    title: TOKUSHOHO_TITLE[locale],
    description: metaDescription(description[locale]),
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'tokushoho')}`,
      languages: alternates('tokushoho'),
    },
  };
}

export default async function TokushohoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <article className={s.root}>
      <header className={`u-wrap ${s.head}`}>
        <p className="u-label">LEGAL NOTICE</p>
        <h1 className={`u-h2 ${s.title}`}>{TOKUSHOHO_TITLE[locale]}</h1>
        <p className={s.intro}>{TOKUSHOHO_INTRO[locale]}</p>
      </header>

      <div className={`u-wrap ${s.body}`}>
        <dl className={s.list}>
          {TOKUSHOHO_ROWS.map((row) => (
            <div key={row.label.ja} className={s.row}>
              <dt className={s.label}>{row.label[locale]}</dt>
              <dd className={s.value}>
                {/* 사업자 정보를 아직 받지 못한 항목은 비워 두지 않고 미확정으로 명시한다 */}
                {row.pending ? (
                  <span className={s.pending}>{TBC[locale]}</span>
                ) : (
                  row.value?.[locale]
                )}
                {row.note && <span className={s.note}>{row.note[locale]}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <p className={s.updated}>{TOKUSHOHO_UPDATED[locale]}</p>
      </div>
    </article>
  );
}
