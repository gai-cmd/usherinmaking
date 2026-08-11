import type { Locale } from '@/lib/i18n';
import type { Plan } from '@/content/site';
import s from './PlanCard.module.css';

const TAX_LABEL: Record<Locale, string> = { ja: '税込', en: 'tax included', ko: '세금 포함' };

/** 금액은 반드시 --ff-num(SF). 세리프 대제목 서체의 올드스타일 숫자는 표에서 높이가 어긋난다. */
export function PlanCard({ plan, locale }: { plan: Plan; locale: Locale }) {
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
    </article>
  );
}
