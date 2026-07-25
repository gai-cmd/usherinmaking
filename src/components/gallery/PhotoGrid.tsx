import Image from 'next/image';
import Link from 'next/link';
import { path, type Locale } from '@/lib/i18n';
import type { Photo } from '@/content/photos';
import s from './PhotoGrid.module.css';

/**
 * 사진 격자. 첫 줄만 priority를 주고 나머지는 lazy(next/image 기본).
 * 사진은 전부 자사 도메인에서 나온다 — 외부 임베드 없음.
 */
export function PhotoGrid({
  locale,
  photos,
  columns = 5,
  priorityCount = 0,
}: {
  locale: Locale;
  photos: Photo[];
  columns?: 3 | 4 | 5;
  priorityCount?: number;
}) {
  return (
    <ul className={s.grid} data-columns={columns}>
      {photos.map((photo, index) => (
        <li key={photo.id} className={s.cell}>
          <Link href={path(locale, 'gallery', 'g', photo.slug)} className={s.link}>
            <Image
              src={photo.src}
              alt={photo.alt[locale]}
              width={photo.width}
              height={photo.height}
              sizes={`(max-width: 767px) 50vw, ${Math.round(100 / columns)}vw`}
              className={s.image}
              priority={index < priorityCount}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
