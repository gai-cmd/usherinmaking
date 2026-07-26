import Link from 'next/link';
import { path, type Locale } from '@/lib/i18n';
import { getPageCopy } from '@/server/page-content';
import { PUBLISHED_PHOTOS, filterPhotos } from '@/content/photos';
import { selectionSegments, termsFor, type Selection } from '@/content/taxonomy';
import { FilterBar } from './FilterBar';
import { PhotoGrid } from './PhotoGrid';
import { GALLERY, countLabel, moreLabel } from './content';
import s from './GalleryView.module.css';

export const PAGE_SIZE = 15;

/** 칩에 붙는 숫자 — 현재 선택에 그 term을 더했을 때 남는 사진 수 */
function placeCounts(locale: Locale, selection: Selection): Record<string, number> {
  const base = selectionSegments(selection);
  const counts: Record<string, number> = { __all: PUBLISHED_PHOTOS.length };

  for (const term of termsFor('place', locale)) {
    const segments = base.filter((slug) => slug !== selection.place?.slug);
    counts[term.slug] = filterPhotos([...segments, term.slug]).length;
  }

  return counts;
}

/**
 * 목록 본문. /gallery 와 /gallery/[...filter] 가 같은 화면을 쓰고,
 * 다른 것은 선택 상태와 canonical 뿐이다.
 */
export async function GalleryView({
  locale,
  selection,
  page,
}: {
  locale: Locale;
  selection: Selection;
  page: number;
}) {
  const text = await getPageCopy('gallery', locale);
  const segments = selectionSegments(selection);
  const photos = filterPhotos(segments);
  const shown = photos.slice(0, PAGE_SIZE * page);
  const hasMore = shown.length < photos.length;
  const currentPath = path(locale, 'gallery', ...segments);

  return (
    <>
      <header className={`u-section u-center ${s.hero}`}>
        <div className="u-wrap">
          <p className="u-label">{GALLERY.eyebrow}</p>
          <h1 className={`u-display ${s.title}`}>{text['title']}</h1>
          <p className={`u-lead ${s.definition}`}>{text['definition']}</p>
          <p className={`u-body ${s.lead}`}>{text['lead']}</p>
        </div>
      </header>

      <FilterBar locale={locale} selection={selection} counts={placeCounts(locale, selection)} />

      <div className={`u-wrap ${s.status}`}>
        <p className={s.count}>
          <span className="u-num">{countLabel(photos.length, locale)}</span>
          <span className={s.pathHint}>{currentPath}</span>
        </p>
        <p className={s.sort}>{GALLERY.sort}</p>
      </div>

      <div className={`u-wrap ${s.body}`}>
        {shown.length > 0 ? (
          <PhotoGrid locale={locale} photos={shown} columns={5} priorityCount={5} />
        ) : (
          <p className={`u-body ${s.empty}`}>{text['empty']}</p>
        )}

        {hasMore && (
          <p className={s.more}>
            <Link href={`${currentPath}?page=${page + 1}`} className="u-btn" data-tap>
              {moreLabel(shown.length + PAGE_SIZE > photos.length ? photos.length : shown.length + PAGE_SIZE, photos.length, locale)}
            </Link>
          </p>
        )}

        <p className={`u-meta ${s.note}`}>{text['filterNote']}</p>
      </div>
    </>
  );
}
