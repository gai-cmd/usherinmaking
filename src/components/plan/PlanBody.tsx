import type { Metadata } from 'next';
import { Fragment, type ReactNode } from 'react';
import { PlanCard } from '@/components/PlanCard';
import { ContactCta } from '@/components/ContactCta';
import {
  ANNIVERSARY_PLANS,
  LOCATION_NOTES,
  LOCATION_PLANS,
  type Plan,
} from '@/content/site';
import { SITE_URL, alternates, path, type Locale } from '@/lib/i18n';
import { getPageCopy, toLines, type PageCopy } from '@/server/page-content';
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
      : // 스튜디오 플랜은 이 페이지에 없다 — 스튜디오 페이지의 구조화 데이터가 정본이다.
        [...LOCATION_PLANS, ...ANNIVERSARY_PLANS];
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

/** 한 페이지에 이어 붙이는 플랜 묶음 (구 탭 하나에 해당) */
type PlanGroup = { id: string; label: string; panel: ReactNode };

function LocationPanel({ locale, text }: { locale: Locale; text: PageCopy }) {
  // en 은 카드 세 장의 상품명이 모두 같아 제목이 정보를 주지 못한다 — 등급명을 제목 자리로 올린다.
  const plans =
    locale === 'en'
      ? LOCATION_PLANS.map((plan) => {
          const copy = C.EN_LOCATION_CARD[plan.code];
          return {
            ...plan,
            title: { ...plan.title, en: `${plan.badge} PLAN` },
            badge: '',
            duration: copy ? { ...plan.duration, en: copy.duration } : plan.duration,
            includes: copy ? { ...plan.includes, en: copy.includes } : plan.includes,
          };
        })
      : LOCATION_PLANS;

  return (
    <div className="u-wrap">
      <div className={s.grid}>
        {plans.map((plan) => (
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

/** 제목은 절 머리(그룹 헤더)가 이미 달고 있다 — 여기서는 같은 말을 두 번 쓰지 않는다. */
function HairPanel({ locale, heading }: { locale: Locale; heading: string }) {
  const title = C.HAIR.title[locale];
  return (
    <div className={`u-wrap ${s.hair}`}>
      {title !== heading && <p className={s.hairSub}>{title}</p>}
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
  options,
}: {
  plans: Plan[];
  notes: string[];
  /** 있으면 노트를 라벨 달린 안내 박스로 묶는다 — 맨줄 문장 나열은 성의 없어 보인다 */
  noticeLabel?: string;
  /**
   * 이 촬영에 붙일 수 있는 옵션. 별도 절로 빼면 배경 띠가 갈리면서 다른 이야기처럼 보인다 —
   * 옵션은 이 플랜들에 붙는 것이므로 같은 절 안, 플랜 카드 바로 아래에 둔다.
   */
  options?: { title: string; head: readonly string[]; rows: C.OptionRow[]; footNotes?: string[] };
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

      {options && (
        <div className={s.optInline}>
          <h3 className={s.optInlineTitle}>{options.title}</h3>
          <table className={s.table}>
            <thead>
              <tr>
                {options.head.map((cell) => (
                  <th key={cell} scope="col">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {options.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td className={`u-num ${s.optPrice}`}>{row.price}</td>
                  <td className={s.optNote}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {options.footNotes?.map((line) => (
            <p key={line} className={s.optNote}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- 본문 ---------------- */

export async function PlanBody({ locale }: { locale: Locale }) {
  const text = await getPageCopy('plan', locale);
  // ko 는 한국 고객 전용 상품(웨딩/기타 · 원화)이라 묶음 구성 자체가 다르다.
  // 탭으로 접어 두면 한 번에 한 묶음만 보인다 — 전부 한 페이지에 이어서 편다.
  const groups: PlanGroup[] =
    locale === 'ko'
      ? [
          {
            id: 'wedding',
            label: C.KO_TABS.wedding,
            panel: (
              <KoPlansPanel
                plans={C.KO_WEDDING_PLANS}
                notes={[C.KO_WEDDING_NOTE]}
                options={{
                  title: text['option.title'],
                  head: C.OPTION_SECTION.head[locale],
                  rows: C.optionRows(locale),
                  footNotes: C.KO_OPTION_NOTES,
                }}
              />
            ),
          },
          {
            id: 'etc',
            label: C.KO_TABS.etc,
            panel: <KoPlansPanel plans={C.KO_ETC_PLANS} notes={C.KO_ETC_NOTES} noticeLabel="공통사항" />,
          },
        ]
      : [
          // 스튜디오 플랜은 스튜디오 페이지가 정본이라 이 페이지에서는 빼고,
          // 헤어메이크업은 로케이션 촬영에 붙는 옵션이라 기념사진 앞에 둔다.
          { id: 'location', label: C.TABS.location[locale], panel: <LocationPanel locale={locale} text={text} /> },
          {
            id: 'hair',
            label: C.TABS.hair[locale],
            panel: <HairPanel locale={locale} heading={C.TABS.hair[locale]} />,
          },
          {
            id: 'anniversary',
            label: C.TABS.anniversary[locale],
            panel: <AnniversaryPanel locale={locale} text={text} />,
          },
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
      <section aria-label={C.PLAN_LIST_SECTION[locale]}>
        {groups.map((group) => (
          <Fragment key={group.id}>
            <section id={`plan-${group.id}`} className={s.group}>
              <div className={`u-wrap ${s.groupHead}`}>
                <h2 className={`u-h2 ${s.groupTitle}`}>{group.label}</h2>
              </div>
              {group.panel}
            </section>
          </Fragment>
        ))}
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
