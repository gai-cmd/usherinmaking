import Image from 'next/image';
import Link from 'next/link';
import { path, type Locale } from '@/lib/i18n';
import type { WorkImage } from '@/lib/work-image';
import { termLabel, termsFor } from '@/content/taxonomy';
import { HOME } from '@/app/[locale]/home-content';
import s from './RecentWorks.module.css';

const ALL: Record<Locale, string> = { ja: 'ALL', en: 'ALL', ko: 'ALL' };

/**
 * 인스타그램에서 고른 작품을 자사 도메인 이미지로 직접 서빙한다.
 * 임베드·아웃링크는 쓰지 않는다.
 * 칩은 갤러리의 촬영(session) 축과 같은 원본을 쓰고, 누르면 그 필터의 갤러리로 간다 —
 * 옛 하드코딩(BEACH/FOREST…)은 존재하지 않는 분류라 아무것도 하지 못했다.
 * 사진 목록은 페이지가 @/server/works 에서 골라 내려준다 — 폴백 판단은 거기서 한다.
 */
export function RecentWorks({ locale, works }: { locale: Locale; works: WorkImage[] }) {
  const copy = HOME[locale].works;

  return (
    <>
      <ul className={s.chips}>
        <li>
          <Link href={path(locale, 'gallery', 'location')} className={s.chipCurrent} data-tap>
            {ALL[locale]}
          </Link>
        </li>
        {termsFor('session', locale).map((term) => (
          <li key={term.slug}>
            <Link
              href={path(locale, 'gallery', 'location', term.slug)}
              className={s.chip}
              data-tap
            >
              {termLabel(term, locale)}
            </Link>
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
