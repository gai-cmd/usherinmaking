'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Locale } from '@/lib/i18n';
import type { Shoot } from '@/server/photos-content';
import f from './DressCollection.module.css';
import g from '@/components/gallery/PhotoGrid.module.css';
import s from './DressSets.module.css';

/**
 * @usherindress 수집분을 인스타 게시물 그대로 **세트 카드**로 보여준다.
 *
 * 갤러리의 촬영 격자와 같은 문법이다 — 표지 한 장 + "사진 N장". 다른 점은 상세 페이지가
 * 없다는 것: 카드를 누르면 **모달**로 세트가 뜬다(드레스는 룩북이라 주소까지는 과하다).
 * 목록 위쪽에 펼치는 방식은 버렸다 — 목록 중간에서 고른 세트를 보려고 다시 위로
 * 스크롤해야 했기 때문이다. 모달은 어디서 눌러도 그 자리에서 열리고 닫힌다.
 * 분류는 세트 단위다 — 시각 분석이 게시물 하나에 하나의 판정을 내린다.
 */

const CATEGORIES = [
  { slug: 'styling', label: { ja: 'スタイリング', en: 'Styling', ko: '스타일링' } },
  { slug: 'fitting', label: { ja: '試着', en: 'Fitting', ko: '시착' } },
  { slug: 'korean-dress', label: { ja: '韓国ドレス', en: 'Korean Dress', ko: '한국드레스' } },
  { slug: 'cover-ups', label: { ja: 'カバーアップ', en: 'CoverUps', ko: '커버업' } },
  { slug: 'american-dress', label: { ja: 'アメリカドレス', en: 'American', ko: '아메리카드레스' } },
] as const;

const ALL_LABEL: Record<Locale, string> = { ja: 'すべて', en: 'All', ko: '전체' };
const COUNT_LABEL: Record<Locale, (n: number) => string> = {
  ko: (n) => `사진 ${n}장`,
  ja: (n) => `写真 ${n}枚`,
  en: (n) => `${n} photos`,
};
const MORE_LABEL: Record<Locale, string> = { ja: 'もっと見る', en: 'Show more', ko: '더 보기' };
const CLOSE_LABEL: Record<Locale, string> = { ja: '閉じる', en: 'Close', ko: '닫기' };

const PAGE = 24;

export function DressSets({ locale, shoots }: { locale: Locale; shoots: Shoot[] }) {
  const [filter, setFilter] = useState<string>('all');
  const [shown, setShown] = useState(PAGE);
  const [openKey, setOpenKey] = useState<string | null>(null);

  // 세트의 분류 = 세트 안 사진들이 가진 분류의 합집합.
  const matches = (shoot: Shoot) =>
    filter === 'all' || shoot.photos.some((p) => p.terms.includes(filter));

  const filtered = shoots.filter(matches);
  const visible = filtered.slice(0, shown);
  const open = openKey ? filtered.find((sh) => sh.key === openKey) : null;

  const pick = (next: string) => {
    setFilter(next);
    setShown(PAGE);
    setOpenKey(null);
  };

  // 모달이 뜬 동안 ESC 로 닫고, 뒤 페이지 스크롤을 잠근다 — 모달 안만 스크롤되게.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenKey(null);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className={f.filters} role="group">
        {(['all', ...CATEGORIES.map((c) => c.slug)] as const).map((slug) => {
          const label =
            slug === 'all' ? ALL_LABEL[locale] : CATEGORIES.find((c) => c.slug === slug)!.label[locale];
          const n =
            slug === 'all'
              ? shoots.length
              : shoots.filter((sh) => sh.photos.some((p) => p.terms.includes(slug))).length;
          return (
            <button
              key={slug}
              type="button"
              aria-pressed={filter === slug}
              className={`${f.filter} ${filter === slug ? f.on : ''}`}
              onClick={() => pick(slug)}
              data-tap
            >
              {label} <span className="u-num">{n}</span>
            </button>
          );
        })}
      </div>

      {/* 모달 — 게시물 하나의 사진 전부. 배경 클릭·ESC·닫기 버튼으로 닫는다. */}
      {open && (
        <div
          className={s.overlay}
          role="dialog"
          aria-modal="true"
          aria-label={open.cover.alt[locale]}
          onClick={(e) => e.target === e.currentTarget && setOpenKey(null)}
        >
          <div className={s.modal}>
            <div className={s.openHead}>
              <span className={s.openTitle}>{open.cover.alt[locale]}</span>
              <button type="button" className={s.close} onClick={() => setOpenKey(null)} data-tap>
                {CLOSE_LABEL[locale]} ✕
              </button>
            </div>
            <ul className={`${g.grid} ${s.modalGrid}`} data-columns={2}>
              {open.photos.map((photo) => (
                <li key={photo.id} className={g.cell}>
                  <span className={g.link}>
                    {/* 릴스는 펼친 자리에서 바로 재생한다 — 포스터만 보이면 정지 사진과 구별되지 않는다. */}
                    {photo.mediaType === 'video' && photo.videoUrl ? (
                      <video
                        src={photo.videoUrl}
                        poster={photo.src}
                        controls
                        playsInline
                        preload="metadata"
                        className={g.image}
                      />
                    ) : (
                      <Image
                        src={photo.src}
                        alt={photo.alt[locale]}
                        width={photo.width}
                        height={photo.height}
                        sizes="(max-width: 767px) 92vw, 440px"
                        className={g.image}
                      />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <ul className={g.grid} data-columns={4}>
        {visible.map((shoot) => (
          <li key={shoot.key} className={g.cell}>
            <button
              type="button"
              className={`${g.link} ${s.card}`}
              onClick={() => setOpenKey(openKey === shoot.key ? null : shoot.key)}
              aria-expanded={openKey === shoot.key}
              data-tap
            >
              <Image
                src={shoot.cover.src}
                alt={shoot.cover.alt[locale]}
                width={shoot.cover.width}
                height={shoot.cover.height}
                sizes="(max-width: 767px) 50vw, 25vw"
                className={g.image}
              />
              {shoot.cover.mediaType === 'video' && (
                <span className={g.play} aria-hidden="true">
                  ▶
                </span>
              )}
              {shoot.photos.length > 1 && (
                <span className={g.count}>{COUNT_LABEL[locale](shoot.photos.length)}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {filtered.length > shown && (
        <div className={s.moreWrap}>
          <button type="button" className={s.more} onClick={() => setShown((n) => n + PAGE)} data-tap>
            {MORE_LABEL[locale]} ({filtered.length - shown})
          </button>
        </div>
      )}
    </>
  );
}
