import Link from 'next/link';
import { path, type Locale } from '@/lib/i18n';
import {
  TAXONOMIES,
  selectionSegments,
  termLabel,
  termsFor,
  toggleTerm,
  type Selection,
} from '@/content/taxonomy';
import { GALLERY } from './content';
import s from './FilterBar.module.css';

function href(locale: Locale, selection: Selection): string {
  return path(locale, 'gallery', ...selectionSegments(selection));
}

/**
 * 필터는 쿼리스트링이 아니라 경로다. 칩 하나하나가 실제 URL을 가진 링크이며,
 * 이미 선택된 칩을 다시 누르면 그 축만 해제된다.
 */
export function FilterBar({
  locale,
  selection,
  counts,
}: {
  locale: Locale;
  selection: Selection;
  /** term slug → 그 조건을 더했을 때의 사진 수 */
  counts: Record<string, number>;
}) {
  return (
    <nav className={`u-wrap ${s.root}`} aria-label={GALLERY.eyebrow}>
      {TAXONOMIES.map((taxonomy) => {
        const terms = termsFor(taxonomy.key, locale);
        if (terms.length === 0) return null;

        return (
          <div key={taxonomy.key} className={s.row}>
            <span className={`u-label ${s.axis}`}>{taxonomy.label[locale]}</span>
            <div className={s.chips}>
              {taxonomy.key === 'place' && (
                <Link
                  href={href(locale, {})}
                  className={s.chip}
                  aria-current={Object.keys(selection).length === 0 ? 'page' : undefined}
                  data-selected={Object.keys(selection).length === 0 || undefined}
                  data-tap
                >
                  {GALLERY.all[locale]}
                  <span className={`u-num ${s.count}`}>{counts.__all ?? 0}</span>
                </Link>
              )}

              {terms.map((term, index) => {
                const selected = selection[taxonomy.key]?.slug === term.slug;
                const previous = terms[index - 1];
                // set 그룹과 season 그룹 사이에만 세로 구분선이 들어간다
                const divider = previous && previous.parent !== term.parent;

                return (
                  <span key={term.key} className={s.chipWrap}>
                    {divider && <span className={s.divider} aria-hidden="true" />}
                    <Link
                      href={href(locale, toggleTerm(selection, term))}
                      className={s.chip}
                      aria-current={selected ? 'page' : undefined}
                      data-selected={selected || undefined}
                      data-tap
                    >
                      {termLabel(term, locale)}
                      {taxonomy.key === 'place' && (
                        <span className={`u-num ${s.count}`}>{counts[term.slug] ?? 0}</span>
                      )}
                    </Link>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
