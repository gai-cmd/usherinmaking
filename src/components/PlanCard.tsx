import type { Locale } from '@/lib/i18n';
import type { Plan, PlanOptionGroup } from '@/content/site';
import s from './PlanCard.module.css';

const TAX_LABEL: Record<Locale, string> = { ja: '税込', en: 'tax included', ko: '세금 포함' };
const OPTION_LABEL: Record<Locale, string> = { ja: 'OPTION', en: 'ADD-ONS', ko: 'OPTION' };

/** 금액은 반드시 --ff-num(SF). 세리프 대제목 서체의 올드스타일 숫자는 표에서 높이가 어긋난다. */
export function PlanCard({
  plan,
  locale,
  options,
}: {
  plan: Plan;
  locale: Locale;
  /** 이 플랜에 붙는 옵션. 넘기면 카드 안에 함께 실린다 — 플랜과 옵션은 한 세트다. */
  options?: PlanOptionGroup;
}) {
  return (
    <article className={s.root}>
      <p className={s.badge}>{plan.badge}</p>
      <h3 className={s.title}>{plan.title[locale]}</h3>
      <p className={s.duration}>{plan.duration[locale]}</p>

      <p className={s.price}>
        {plan.listPrice && (
          <span className={`u-num ${s.list}`}>¥{plan.listPrice.toLocaleString('en-US')}</span>
        )}
        <span className="u-num">{plan.priceText ?? `¥${plan.price.toLocaleString('en-US')}`}</span>
        {plan.taxIncluded && <span className={s.tax}>{TAX_LABEL[locale]}</span>}
      </p>

      {plan.includes[locale].length > 0 && (
        <ul className={s.includes}>
          {plan.includes[locale].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {options && (
        <div className={s.options}>
          <p className={s.optionLabel}>{OPTION_LABEL[locale]}</p>
          <ul className={s.optionList}>
            {options.items.map((item) => (
              <li key={item.label.en} className={s.optionRow}>
                <span>{item.label[locale]}</span>
                <span className="u-num">{item.price[locale]}</span>
              </li>
            ))}
          </ul>
          {options.note && <p className={s.optionNote}>{options.note[locale]}</p>}
        </div>
      )}
    </article>
  );
}
