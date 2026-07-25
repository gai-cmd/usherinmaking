'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  CATEGORY_ALL_LABEL,
  CATEGORY_LABEL,
  formatDate,
  type JournalCategory,
  type JournalPost,
} from '@/content/journal';
import { path, type Locale } from '@/lib/i18n';
import s from './JournalList.module.css';

/**
 * 카테고리 필터만 상호작용이 필요해서 이 부분만 클라이언트 컴포넌트로 뗀다.
 * 목록 헤더 · 대표 글 · CONTACT 는 서버에서 그대로 렌더한다.
 */
export function JournalList({
  locale,
  posts,
  categories,
}: {
  locale: Locale;
  posts: JournalPost[];
  categories: JournalCategory[];
}) {
  const [active, setActive] = useState<JournalCategory | 'all'>('all');
  const shown = active === 'all' ? posts : posts.filter((p) => p.category === active);

  return (
    <>
      <div className={s.filter} role="group" aria-label="JOURNAL">
        <button
          type="button"
          className={s.chip}
          data-active={active === 'all' || undefined}
          aria-pressed={active === 'all'}
          onClick={() => setActive('all')}
          data-tap
        >
          {CATEGORY_ALL_LABEL[locale]}
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={s.chip}
            data-active={active === c || undefined}
            aria-pressed={active === c}
            onClick={() => setActive(c)}
            data-tap
          >
            {CATEGORY_LABEL[c][locale]}
          </button>
        ))}
      </div>

      <div className="u-wrap">
        <ul className={s.grid}>
          {shown.map((post) => (
            <li key={post.slug}>
              <Link href={path(locale, 'journal', post.slug)} className={s.card}>
                <span className={s.thumb}>
                  <Image
                    src={post.cover.src}
                    alt={post.cover.alt}
                    fill
                    sizes="(max-width: 767px) 120px, (max-width: 1023px) 50vw, 33vw"
                  />
                </span>
                <span className={s.cardBody}>
                  <span className={s.meta}>
                    {CATEGORY_LABEL[post.category][locale]}
                    <span className={`u-num ${s.date}`}> · {formatDate(post.publishedAt)}</span>
                  </span>
                  <span className={s.cardTitle}>{post.title}</span>
                  <span className={s.excerpt}>{post.excerpt}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
