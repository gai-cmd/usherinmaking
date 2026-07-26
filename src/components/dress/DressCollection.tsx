'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { pickImage, type PageImageMap } from '@/lib/image-slot';
import {
  CATEGORY_LABEL,
  COLLECTION,
  DRESS_ITEMS,
  type DressCategory,
} from '@/app/[locale]/dress/content';
import s from './DressCollection.module.css';

type Filter = 'all' | DressCategory;

const FILTERS: Filter[] = ['all', 'white', 'color', 'vintage', 'maternity'];

/**
 * 컬렉션 필터. 사진이 아직 없는 항목은 가짜 이미지를 넣지 않고
 * --placeholder 블록에 "DRESS PHOTO" 라벨을 그대로 남긴다.
 */
export function DressCollection({
  locale,
  images,
  pendingNote,
}: {
  locale: Locale;
  images?: PageImageMap;
  /** 관리자가 고칠 수 있는 안내 문구. 없으면 코드 기본값을 쓴다. */
  pendingNote?: string;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const items = DRESS_ITEMS.filter((item) => filter === 'all' || item.id === filter);

  return (
    <>
      <div className={s.filters} role="group">
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            className={`${s.filter} ${filter === id ? s.on : ''}`}
            onClick={() => setFilter(id)}
            data-tap
          >
            {id === 'all' ? COLLECTION.filterAll[locale] : CATEGORY_LABEL[id][locale]}
          </button>
        ))}
      </div>

      <ul className={s.grid}>
        {items.map((item) => (
          <li key={item.id}>
            <div className={s.frame}>
              {(() => {
                // 관리자가 건 사진 → 없으면 코드에 있던 사진 → 그것도 없으면 자리표시.
                // 없는 자리에 가짜 사진을 채우지 않는다는 규칙은 그대로다.
                const image = pickImage(
                  images,
                  `collection.${item.id}`,
                  locale,
                  item.image?.src ?? null,
                  item.image?.alt[locale] ?? item.name[locale],
                );
                return image ? (
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 767px) 50vw, 25vw"
                    className={s.img}
                  />
                ) : (
                  <span className={s.ph}>{COLLECTION.placeholderLabel}</span>
                );
              })()}
            </div>
            <p className={s.name}>{item.name[locale]}</p>
            <p className={s.note}>{item.note[locale]}</p>
          </li>
        ))}
      </ul>

      <p className={s.pending}>{pendingNote ?? COLLECTION.pendingPhotos[locale]}</p>
    </>
  );
}
