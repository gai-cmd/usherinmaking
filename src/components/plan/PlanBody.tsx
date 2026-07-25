import type { Metadata } from 'next';
import { PlanCard } from '@/components/PlanCard';
import { ContactCta } from '@/components/ContactCta';
import {
  ANNIVERSARY_PLANS,
  LOCATION_NOTES,
  LOCATION_PLANS,
  STUDIO_PLANS,
  TBC,
  type Plan,
} from '@/content/site';
import { SITE_URL, alternates, path, type Locale } from '@/lib/i18n';
import { PlanTabs, type PlanTab } from './PlanTabs';
import * as C from './content';
import s from './PlanBody.module.css';

/* ---------------- metadata ---------------- */

export function planMetadata(locale: Locale): Metadata {
  return {
    title: C.META_TITLE[locale],
    description: C.HERO.lead[locale],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'plan')}`,
      languages: alternates('plan'),
    },
  };
}

/* ---------------- 구조화 데이터 ---------------- */

/** 스튜디오 요금은 모니터 가격이라 세금 포함 여부를 단정하지 않는다. */
function serviceLd(locale: Locale) {
  const offers = [...STUDIO_PLANS, ...LOCATION_PLANS, ...ANNIVERSARY_PLANS].map((plan) => ({
    '@type': 'Offer',
    name: plan.title[locale],
    price: plan.price,
    priceCurrency: 'JPY',
    valueAddedTaxIncluded: plan.taxIncluded,
    url: `${SITE_URL}${path(locale, 'plan')}`,
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: C.META_TITLE[locale],
    name: C.META_TITLE[locale],
    description: C.HERO.lead[locale],
    provider: { '@type': 'LocalBusiness', name: 'usherinmaking' },
    url: `${SITE_URL}${path(locale, 'plan')}`,
    offers,
  };
}

function faqLd(locale: Locale) {
  const questions = C.FAQ_QUESTIONS[locale];
  if (!questions) return null;

  const answers = [
    `${C.NOTES.cancel[locale]} ${C.NOTES.cancelScale[locale]}`,
    C.NOTES.rain[locale],
    `${C.NOTES.typhoon[locale]} ${C.NOTES.typhoonSub[locale]}`,
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((question, i) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answers[i] },
    })),
  };
}

/* ---------------- 패널 ---------------- */

/** site.ts 가격은 그대로 두고, 이 페이지에서만 쓰는 표기(모니터 가격·포함 내역)를 덧입힌다. */
function studioPlans(locale: Locale): Plan[] {
  return STUDIO_PLANS.map((plan) => ({
    ...plan,
    badge: `${plan.badge} · ${C.MONITOR_PRICE[locale]}`,
    duration: C.STUDIO_DURATION[plan.code] ?? plan.duration,
    includes: C.STUDIO_INCLUDES[plan.code] ?? plan.includes,
  }));
}

function StudioPanel({ locale }: { locale: Locale }) {
  const plans = studioPlans(locale);
  return (
    <div className={`u-wrap ${s.grid}`}>
      {plans.map((plan, i) => (
        <div
          key={plan.code}
          className={`${s.cardSlot} ${i === 0 ? s.featured : ''} ${i === 1 ? s.tinted : ''}`}
        >
          <PlanCard plan={plan} locale={locale} />
        </div>
      ))}
    </div>
  );
}

function LocationPanel({ locale }: { locale: Locale }) {
  return (
    <div className="u-wrap">
      <div className={s.grid}>
        {LOCATION_PLANS.map((plan) => (
          <div key={plan.code} className={s.cardSlot}>
            <PlanCard plan={plan} locale={locale} />
          </div>
        ))}
      </div>
      <ul className={s.noteList}>
        {LOCATION_NOTES[locale].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className={s.panelNote}>{C.LOCATION_PANEL.note[locale]}</p>
    </div>
  );
}

function AnniversaryPanel({ locale }: { locale: Locale }) {
  return (
    <div className="u-wrap">
      <div className={s.grid}>
        {ANNIVERSARY_PLANS.map((plan) => (
          <div key={plan.code} className={s.cardSlot}>
            <PlanCard plan={plan} locale={locale} />
          </div>
        ))}
      </div>
      <p className={s.panelNote}>
        {C.ANNIVERSARY_PANEL.unconfirmed[locale]} — {TBC[locale]}
      </p>
      <p className={s.panelNote}>{C.ANNIVERSARY_PANEL.note[locale]}</p>
    </div>
  );
}

function HairPanel({ locale }: { locale: Locale }) {
  return (
    <div className={`u-wrap ${s.hair}`}>
      <p className="u-label">{C.HAIR.label[locale]}</p>
      <h3 className={`u-h2 ${s.hairTitle}`}>{C.HAIR.title[locale]}</h3>
      <dl className={s.hairList}>
        {C.HAIR.shops.map((shop) => (
          <div key={shop.name[locale]} className={s.hairRow}>
            <dt className={s.hairName}>{shop.name[locale]}</dt>
            <dd className={`u-num ${s.hairBody}`}>{shop.body[locale]}</dd>
          </div>
        ))}
      </dl>
      <p className={s.panelNote}>{C.HAIR.common[locale]}</p>
    </div>
  );
}

/* ---------------- 본문 ---------------- */

export function PlanBody({ locale }: { locale: Locale }) {
  const tabs: PlanTab[] = [
    { id: 'studio', label: C.TABS.studio[locale], panel: <StudioPanel locale={locale} /> },
    { id: 'location', label: C.TABS.location[locale], panel: <LocationPanel locale={locale} /> },
    {
      id: 'anniversary',
      label: C.TABS.anniversary[locale],
      panel: <AnniversaryPanel locale={locale} />,
    },
    { id: 'hair', label: C.TABS.hair[locale], panel: <HairPanel locale={locale} /> },
  ];

  const questions = C.FAQ_QUESTIONS[locale];
  const faq = faqLd(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd(locale)) }}
      />
      {faq && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
        />
      )}

      <header className={`u-wrap ${s.hero}`}>
        <p className="u-label">{C.HERO.label[locale]}</p>
        <h1 className={`u-display ${s.h1}`}>{C.HERO.title[locale]}</h1>
        <p className={s.lead}>{C.HERO.lead[locale]}</p>
      </header>

      <PlanTabs tabs={tabs} />

      {/* 옵션 표 — 어떤 플랜에 붙일 수 있는지까지 같은 줄에서 읽히게 한다 */}
      <section className="u-section u-section--alt">
        <div className="u-wrap">
          <div className={s.optHead}>
            <p className="u-label">{C.OPTION_SECTION.label[locale]}</p>
            <h2 className={`u-h2 ${s.optTitle}`}>{C.OPTION_SECTION.title[locale]}</h2>
            {C.OPTION_SECTION.lead[locale] && (
              <p className={s.optLead}>{C.OPTION_SECTION.lead[locale]}</p>
            )}
          </div>

          <table className={s.table}>
            <thead>
              <tr>
                {C.OPTION_SECTION.head[locale].map((cell) => (
                  <th key={cell} scope="col">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {C.optionRows(locale).map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td className={`u-num ${s.optPrice}`}>{row.price}</td>
                  <td className={s.optNote}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 계약까지의 4단계 */}
      <section className="u-section">
        <div className="u-wrap">
          <p className="u-label">{C.FLOW.label[locale]}</p>
          <h2 className={`u-h2 ${s.optTitle}`}>{C.FLOW.title[locale]}</h2>
          <ol className={s.flow}>
            {C.FLOW.steps[locale].map((step, i) => (
              <li key={step} className={s.flowStep}>
                <span className={`u-num ${s.flowNo}`}>{String(i + 1).padStart(2, '0')}</span>
                <span>
                  {step}
                  {i === 1 && <span className={s.flowSub}>{C.FLOW.depositNote[locale]}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 취소 · 우천. ja/en 은 카드에 있는 질문 문장을 그대로 소제목으로 쓴다 */}
      <section className="u-section u-section--alt">
        <div className="u-wrap">
          <p className="u-label">{C.NOTES.label[locale]}</p>
          <h2 className={`u-h2 ${s.optTitle}`}>{C.NOTES.title[locale]}</h2>
          <div className={s.notes}>
            <div>
              {questions && <h3 className={s.q}>{questions[0]}</h3>}
              <p className={s.a}>{C.NOTES.cancel[locale]}</p>
              <p className={`u-num ${s.scale}`}>{C.NOTES.cancelScale[locale]}</p>
            </div>
            <div>
              {questions && <h3 className={s.q}>{questions[1]}</h3>}
              <p className={s.a}>{C.NOTES.rain[locale]}</p>
              {questions && <h3 className={s.q}>{questions[2]}</h3>}
              <p className={s.a}>{C.NOTES.typhoon[locale]}</p>
              <p className={s.aSub}>{C.NOTES.typhoonSub[locale]}</p>
            </div>
          </div>
        </div>
      </section>

      <ContactCta locale={locale} />
    </>
  );
}
