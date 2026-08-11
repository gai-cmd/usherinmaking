import type { Metadata } from 'next';
import { PlanCard } from '@/components/PlanCard';
import { ContactCta } from '@/components/ContactCta';
import {
  ANNIVERSARY_PLANS,
  LOCATION_NOTES,
  LOCATION_PLANS,
  STUDIO_PLANS,
  type Plan,
} from '@/content/site';
import { SITE_URL, alternates, path, type Locale } from '@/lib/i18n';
import { getPageCopy, toLines, type PageCopy } from '@/server/page-content';
import { PlanTabs, type PlanTab } from './PlanTabs';
import * as C from './content';
import s from './PlanBody.module.css';

/* ---------------- metadata ---------------- */

export async function planMetadata(locale: Locale): Promise<Metadata> {
  const text = await getPageCopy('plan', locale);
  return {
    title: text['meta.title'],
    description: text['hero.lead'],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'plan')}`,
      languages: alternates('plan'),
    },
  };
}

/* ---------------- 구조화 데이터 ---------------- */

/** 스튜디오 요금은 모니터 가격이라 세금 포함 여부를 단정하지 않는다. */
function serviceLd(locale: Locale) {
  // ko 는 한국 고객 전용 상품(원화)만 판다 — JA/EN 플랜을 섞지 않는다.
  const plans =
    locale === 'ko'
      ? [...C.KO_WEDDING_PLANS, ...C.KO_ETC_PLANS]
      : [...STUDIO_PLANS, ...LOCATION_PLANS, ...ANNIVERSARY_PLANS];
  const offers = plans.map((plan) => ({
    '@type': 'Offer',
    name: plan.title[locale],
    price: plan.price,
    priceCurrency: plan.currency ?? 'JPY',
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
function studioPlans(locale: Locale, text: PageCopy): Plan[] {
  return STUDIO_PLANS.map((plan) => ({
    ...plan,
    badge: `${plan.badge} · ${text['monitorPrice']}`,
    duration: C.STUDIO_DURATION[plan.code] ?? plan.duration,
    includes: C.STUDIO_INCLUDES[plan.code] ?? plan.includes,
  }));
}

function StudioPanel({ locale, text }: { locale: Locale; text: PageCopy }) {
  const plans = studioPlans(locale, text);
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

function LocationPanel({ locale, text }: { locale: Locale; text: PageCopy }) {
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
      <p className={s.panelNote}>{text['locationPanel.note']}</p>
    </div>
  );
}

function AnniversaryPanel({ locale, text }: { locale: Locale; text: PageCopy }) {
  return (
    <div className="u-wrap">
      <div className={s.grid}>
        {ANNIVERSARY_PLANS.map((plan) => (
          <div key={plan.code} className={s.cardSlot}>
            <PlanCard plan={plan} locale={locale} />
          </div>
        ))}
      </div>
      <p className={s.panelNote}>{C.ANNIVERSARY_PANEL.surcharge[locale]}</p>
      <p className={s.panelNote}>{text['anniversaryPanel.note']}</p>
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

/* ---------------- ko 전용 패널 (usherinmaking.com/korean 상품 구성) ---------------- */

function KoPlansPanel({
  plans,
  notes,
  noticeLabel,
}: {
  plans: Plan[];
  notes: string[];
  /** 있으면 노트를 라벨 달린 안내 박스로 묶는다 — 맨줄 문장 나열은 성의 없어 보인다 */
  noticeLabel?: string;
}) {
  return (
    <div className="u-wrap">
      <div className={s.grid}>
        {plans.map((plan, i) => (
          <div key={plan.code} className={`${s.cardSlot} ${i === 0 ? s.featured : ''}`}>
            <PlanCard plan={plan} locale="ko" />
          </div>
        ))}
      </div>
      {noticeLabel ? (
        <aside className={s.koNotice}>
          <p className={s.koNoticeLabel}>{noticeLabel}</p>
          <ul className={s.koNoticeList}>
            {notes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </aside>
      ) : (
        notes.map((line) => (
          <p key={line} className={s.panelNote}>
            {line}
          </p>
        ))
      )}
    </div>
  );
}

/* ---------------- 본문 ---------------- */

export async function PlanBody({ locale }: { locale: Locale }) {
  const text = await getPageCopy('plan', locale);
  // ko 는 한국 고객 전용 상품(웨딩/기타 · 원화)이라 탭 구성 자체가 다르다.
  const tabs: PlanTab[] =
    locale === 'ko'
      ? [
          {
            id: 'wedding',
            label: C.KO_TABS.wedding,
            panel: <KoPlansPanel plans={C.KO_WEDDING_PLANS} notes={[C.KO_WEDDING_NOTE]} />,
          },
          {
            id: 'etc',
            label: C.KO_TABS.etc,
            panel: <KoPlansPanel plans={C.KO_ETC_PLANS} notes={C.KO_ETC_NOTES} noticeLabel="공통사항" />,
          },
        ]
      : [
          { id: 'studio', label: C.TABS.studio[locale], panel: <StudioPanel locale={locale} text={text} /> },
          { id: 'location', label: C.TABS.location[locale], panel: <LocationPanel locale={locale} text={text} /> },
          {
            id: 'anniversary',
            label: C.TABS.anniversary[locale],
            panel: <AnniversaryPanel locale={locale} text={text} />,
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
        <p className="u-label">{text['hero.label']}</p>
        <h1 className={`u-display ${s.h1}`}>{text['hero.title']}</h1>
        <p className={s.lead}>{text['hero.lead']}</p>
      </header>

      {/* 카드 제목이 h3 이므로 그 위에 h2 가 있어야 제목 목차가 이어진다.
          시안에는 이 자리에 제목이 없으니 화면에서는 감추고 보조기기에만 읽힌다. */}
      <section aria-labelledby="plan-list-heading">
        <h2 id="plan-list-heading" className="u-visually-hidden">
          {C.PLAN_LIST_SECTION[locale]}
        </h2>
        <PlanTabs tabs={tabs} />
      </section>

      {/* 옵션 표 — 어떤 플랜에 붙일 수 있는지까지 같은 줄에서 읽히게 한다 */}
      <section className="u-section u-section--alt">
        <div className="u-wrap">
          <div className={s.optHead}>
            <p className="u-label">{C.OPTION_SECTION.label[locale]}</p>
            <h2 className={`u-h2 ${s.optTitle}`}>{text['option.title']}</h2>
            {text['option.lead'] && <p className={s.optLead}>{text['option.lead']}</p>}
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
          {locale === 'ko' &&
            C.KO_OPTION_NOTES.map((line) => (
              <p key={line} className={s.optNote}>
                {line}
              </p>
            ))}
        </div>
      </section>

      {/* 계약까지의 4단계 */}
      <section className="u-section">
        <div className="u-wrap">
          <p className="u-label">{C.FLOW.label[locale]}</p>
          <h2 className={`u-h2 ${s.optTitle}`}>{text['flow.title']}</h2>
          <ol className={s.flow}>
            {toLines(text['flow.steps']).map((step, i) => (
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
          <h2 className={`u-h2 ${s.optTitle}`}>{text['notes.title']}</h2>
          {/* 질문 하나가 칸 하나다. 2단에 3문답을 흘리면 왼쪽만 일찍 끝나 어긋나 보인다 */}
          <div className={s.notes}>
            <div className={s.note}>
              {questions && <h3 className={s.q}>{questions[0]}</h3>}
              <p className={s.a}>{text['notes.cancel']}</p>
              <p className={`u-num ${s.scale}`}>{text['notes.cancelScale']}</p>
            </div>
            <div className={s.note}>
              {questions && <h3 className={s.q}>{questions[1]}</h3>}
              <p className={s.a}>{C.NOTES.rain[locale]}</p>
            </div>
            <div className={s.note}>
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
