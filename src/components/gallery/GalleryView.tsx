import Link from 'next/link';
import { path, type Locale } from '@/lib/i18n';
import { getPageCopy } from '@/server/page-content';
import { filterBy, getPublishedPhotos, groupByShoot, type PhotoContent } from '@/server/photos-content';
import { TAXONOMIES, selectionSegments, termsFor, type Selection } from '@/content/taxonomy';
import { FilterBar } from './FilterBar';
import { ShootGrid } from './ShootGrid';
import { GALLERY, countLabel, moreLabel } from './content';
import s from './GalleryView.module.css';

// 4열 그리드의 배수로 맞춘다 — 한 페이지가 항상 꽉 찬 줄로 끝나야
// 마지막 줄 빈 칸(그걸 카드 늘리기로 메꾸는 편법)이 생기지 않는다.
export const PAGE_SIZE = 16;

/**
 * 칩에 붙는 숫자 — 현재 선택에 그 term을 더했을 때 남는 사진 수.
 * 사진 목록을 인자로 받는다: DB 조회를 칩마다 반복하지 않기 위해서다.
 */
function termCounts(
  photos: PhotoContent[],
  locale: Locale,
  selection: Selection,
): Record<string, number> {
  const base = selectionSegments(selection);
  // 단위는 촬영 묶음이다 — 목록이 묶음 단위로 그려지므로 칩 숫자도 같은 자로 재야
  // "스튜디오 36인데 눌렀더니 9개" 같은 어긋남이 없다.
  const counts: Record<string, number> = { __all: groupByShoot(photos).length };

  // 모든 축에 숫자를 붙인다 — 눌러 봐야 아는 칩은 눌리지 않는다.
  // 같은 축의 기존 선택은 빼고 센다: 칩을 누르면 그 축이 갈아끼워지는 동작과 같은 셈법이다.
  for (const taxonomy of TAXONOMIES) {
    for (const term of termsFor(taxonomy.key, locale)) {
      const segments = base.filter((slug) => slug !== selection[taxonomy.key]?.slug);
      counts[term.slug] = groupByShoot(filterBy(photos, [...segments, term.slug])).length;
    }
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
  // DB 우선 · 시드 폴백. 한 번만 읽고 아래 필터·집계가 그 결과를 나눠 쓴다.
  const all = await getPublishedPhotos();
  const photos = filterBy(all, segments);
  // 낱장을 촬영 단위로 접는다 — 목록의 한 칸이 사진 한 장이 아니라 촬영 한 건이 된다.
  // 페이지 단위도 촬영 기준이다: "15장 더" 가 아니라 "촬영 15건 더".
  const shoots = groupByShoot(photos);
  const shown = shoots.slice(0, PAGE_SIZE * page);
  const hasMore = shown.length < shoots.length;
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

      <FilterBar locale={locale} selection={selection} counts={termCounts(all, locale, selection)} />

      <div className={`u-wrap ${s.status}`}>
        <p className={s.count}>
          <span className="u-num">{countLabel(shoots.length, locale)}</span>
          <span className={s.pathHint}>{currentPath}</span>
        </p>
        <p className={s.sort}>{GALLERY.sort}</p>
      </div>

      <div className={`u-wrap ${s.body}`}>
        {shown.length > 0 ? (
          <ShootGrid locale={locale} shoots={shown} columns={4} priorityCount={4} />
        ) : (
          <p className={`u-body ${s.empty}`}>{text['empty']}</p>
        )}

        {hasMore && (
          <p className={s.more}>
            <Link href={`${currentPath}?page=${page + 1}`} className="u-btn" data-tap>
              {moreLabel(shown.length + PAGE_SIZE > shoots.length ? shoots.length : shown.length + PAGE_SIZE, shoots.length, locale)}
            </Link>
          </p>
        )}

        <p className={`u-meta ${s.note}`}>{text['filterNote']}</p>
      </div>
    </>
  );
}
