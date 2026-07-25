import type { Locale } from '@/lib/i18n';
import { HOME } from '@/app/[locale]/home-content';
import s from './HomeFaq.module.css';

/**
 * 질문·답변을 모두 펼친 채로 둔다. 접어두면 AI 검색이 인용할 본문이 사라진다.
 */
export function HomeFaq({ locale }: { locale: Locale }) {
  const { items } = HOME[locale].faq;

  return (
    <dl className={s.grid}>
      {items.map((item) => (
        <div key={item.q} className={s.row}>
          <dt className={s.q}>{item.q}</dt>
          <dd className={s.a}>{item.a}</dd>
        </div>
      ))}
    </dl>
  );
}
