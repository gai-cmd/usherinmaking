import Image from 'next/image';
import Link from 'next/link';
import { path, type Locale } from '@/lib/i18n';
import type { WorkImage } from '@/lib/work-image';
import { HOME } from '@/app/[locale]/home-content';
import s from './RecentWorks.module.css';

/**
 * 인스타그램에서 고른 작품을 자사 도메인 이미지로 직접 서빙한다.
 * 임베드·아웃링크는 쓰지 않는다. 칩은 지금은 표시 전용이고,
 * 실제 필터링은 갤러리 페이지가 담당한다.
 * 사진 목록은 페이지가 @/server/works 에서 골라 내려준다 — 폴백 판단은 거기서 한다.
 */
export function RecentWorks({ locale, works }: { locale: Locale; works: WorkImage[] }) {
  const copy = HOME[locale].works;

  return (
    <>
      <ul className={s.chips}>
        {copy.filters.map((chip, i) => (
          <li key={chip} className={i === 0 ? s.chipCurrent : s.chip}>
            {chip}
          </li>
        ))}
      </ul>

      <ul className={s.grid}>
        {works.map((work) => (
          <li key={work.src} className={s.cell}>
            <Image
              src={work.src}
              alt={work.alt[locale]}
              fill
              sizes="(max-width: 767px) 50vw, 20vw"
              className={s.image}
            />
          </li>
        ))}
      </ul>

      <p className={s.more}>
        <Link href={path(locale, 'gallery')} className="u-btn" data-tap>
          {copy.viewAll}
        </Link>
      </p>
    </>
  );
}
