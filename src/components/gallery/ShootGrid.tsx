import Image from 'next/image';
import Link from 'next/link';
import { path, type Locale } from '@/lib/i18n';
import type { Shoot } from '@/server/photos-content';
import s from './PhotoGrid.module.css';

/** 카드에 붙는 "사진 N장" 표시. 한 장짜리 묶음에는 붙이지 않는다 — 숫자가 정보가 되지 못한다. */
const COUNT_LABEL: Record<Locale, (n: number) => string> = {
  ko: (n) => `사진 ${n}장`,
  ja: (n) => `写真 ${n}枚`,
  en: (n) => `${n} photos`,
};

/**
 * 촬영 격자. 한 칸이 사진 한 장이 아니라 **촬영 한 건**이다.
 *
 * 블로그가 "한 포스팅에 사진 여러 장"인 것과 같은 모양으로, 낱장이 흩어져 보이던 목록을
 * 촬영 단위로 접는다. 카드를 누르면 그 촬영의 대표 사진 상세로 가고, 거기서 나머지를 이어 본다.
 */
export function ShootGrid({
  locale,
  shoots,
  columns = 4,
  priorityCount = 0,
}: {
  locale: Locale;
  shoots: Shoot[];
  columns?: 3 | 4 | 5;
  priorityCount?: number;
}) {
  return (
    <ul className={s.grid} data-columns={columns}>
      {shoots.map((shoot, index) => (
        <li key={shoot.key} className={s.cell}>
          <Link href={path(locale, 'gallery', 'g', shoot.cover.slug)} className={s.link}>
            <Image
              src={shoot.cover.src}
              alt={shoot.cover.alt[locale]}
              width={shoot.cover.width}
              height={shoot.cover.height}
              sizes={`(max-width: 767px) 50vw, ${Math.round(100 / columns)}vw`}
              className={s.image}
              priority={index < priorityCount}
            />
            {shoot.cover.mediaType === 'video' && (
              <span className={s.play} aria-hidden="true">
                ▶
              </span>
            )}
            {shoot.photos.length > 1 && (
              <span className={s.count}>{COUNT_LABEL[locale](shoot.photos.length)}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
