import Image from 'next/image';
import Link from 'next/link';
import { path } from '@/lib/i18n';
import { NAVER_NOTICE } from '@/app/[locale]/home-content';
import s from './NaverNotice.module.css';

/**
 * 네이버 블로그 안내는 한국어 페이지에만 노출한다 (ja/en 렌더 금지).
 * 블로그 주소가 아직 확정되지 않아 외부 링크는 걸지 않고, 사이트 안의 촬영후기로만 보낸다.
 */
export function NaverNotice() {
  return (
    <section className="u-section u-section--alt">
      <div className={`u-wrap ${s.root}`}>
        <div>
          <p className="u-label">{NAVER_NOTICE.label}</p>
          <h2 className={`u-h2 ${s.title}`}>{NAVER_NOTICE.title}</h2>
          <p className={s.body}>{NAVER_NOTICE.body[0]}</p>
          <p className={s.sub}>{NAVER_NOTICE.body[1]}</p>
          <p className={s.actions}>
            <Link href={path('ko', 'journal')} className="u-btn-dark" data-tap>
              {NAVER_NOTICE.cta}
            </Link>
          </p>
        </div>

        <ul className={s.cards}>
          {NAVER_NOTICE.cards.map((card) => (
            <li key={card.src} className={s.card}>
              <span className={s.thumb}>
                <Image
                  src={card.src}
                  alt={card.alt}
                  fill
                  sizes="(max-width: 767px) 45vw, 20vw"
                  className={s.image}
                />
              </span>
              <span className={s.cardTitle}>{card.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
