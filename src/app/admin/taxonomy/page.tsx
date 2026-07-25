import Link from 'next/link';

import { Badge, NotWired, PageHeader, Panel } from '@/components/admin';
import { LOCALE_SHORT, LOCALES } from '@/lib/i18n';
import {
  countVisibleTerms,
  getTermById,
  listAllFilterUrls,
  listTaxonomies,
  listUntranslatedTerms,
  termUrls,
  termUrlsIncludingCombinations,
} from '@/server/taxonomy';

import { TermEditor } from './TermEditor';
import s from './taxonomy.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '카테고리 관리',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ term?: string }>;

export default async function TaxonomyPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const [taxonomies, untranslated, visible, allUrls] = await Promise.all([
    listTaxonomies(),
    listUntranslatedTerms(),
    countVisibleTerms(),
    listAllFilterUrls(),
  ]);

  const selected = sp.term ? await getTermById(sp.term) : null;
  const selectedUrls = selected ? termUrls(selected.slug) : [];
  const selectedAllUrls = selected ? termUrlsIncludingCombinations(selected.slug) : [];

  return (
    <>
      <PageHeader
        title="카테고리 관리"
        description={
          <>
            축을 추가하면 갤러리 필터와 URL이 자동으로 생성됩니다. 갤러리 필터는{' '}
            <b>쿼리스트링이 아니라 경로</b>이므로, 용어의 슬러그가 곧 공개 주소입니다.
          </>
        }
        actions={
          <Link href="/admin/seo" className={s.crossLink}>
            SEO / AEO 점검 →
          </Link>
        }
      />

      <div className={s.summary}>
        <span>
          정적 생성 중인 필터 주소 <b className={s.num}>{allUrls.length}</b>건
        </span>
        {LOCALES.map((l) => (
          <span key={l}>
            {LOCALE_SHORT[l]} 노출 용어 <b className={s.num}>{visible[l]}</b>
          </span>
        ))}
        {untranslated.length > 0 ? (
          <span className={s.summaryWarn}>번역 누락 {untranslated.length}건</span>
        ) : null}
      </div>

      <div className={s.layout}>
        <Panel title="카테고리 축">
          <p className={s.note}>
            축 순서가 곧 주소의 세그먼트 순서입니다 ({taxonomies.map((t) => t.key).join(' → ')}).
            순서를 바꾸면 조합 주소가 전부 달라지므로 여기서는 바꿀 수 없습니다.
          </p>

          <div className={s.axes}>
            {taxonomies.map((tx) => (
              <section key={tx.key} className={s.axis}>
                <div className={s.axisHead}>
                  <span className={s.axisLabel}>
                    {tx.label.ko} <code className={s.axisKey}>{tx.key}</code>
                  </span>
                  <span className={s.axisMeta}>
                    {tx.axisIndex + 1}번째 세그먼트 · 용어 {tx.terms.length}개
                  </span>
                </div>

                {tx.groups.length > 0 ? (
                  <p className={s.axisGroups}>하위 그룹: {tx.groups.join(' / ')}</p>
                ) : null}

                <div className={s.terms}>
                  {tx.terms.map((t) => (
                    <Link
                      key={t.id}
                      href={`/admin/taxonomy?term=${encodeURIComponent(t.id)}`}
                      className={
                        selected?.id === t.id ? `${s.term} ${s.termOn}` : s.term
                      }
                    >
                      <span className={s.termLabel}>
                        {t.label.ko ?? t.label.ja ?? t.label.en ?? t.slug}
                      </span>
                      <code className={s.termSlug}>/{t.slug}</code>
                      {t.missingLocales.length > 0 ? (
                        <Badge tone="warn">
                          {t.missingLocales.map((l) => LOCALE_SHORT[l]).join(' ')} 없음
                        </Badge>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <NotWired
            what="새 축 만들기"
            hint="축 목록이 코드에 고정되어 있습니다. 축 추가는 DB 이관과 함께 열립니다."
          />
        </Panel>

        <div className={s.right}>
          {selected ? (
            <Panel title="선택한 용어">
              <div className={s.selHead}>
                <h3 className={s.selTitle}>
                  {selected.label.ko ?? selected.label.ja ?? selected.slug}
                </h3>
                <Badge tone="muted">{selected.taxonomyKey}</Badge>
              </div>

              <ul className={s.labelList}>
                {LOCALES.map((l) => (
                  <li key={l}>
                    <span className={s.labelLocale}>{LOCALE_SHORT[l]}</span>
                    {selected.label[l]?.trim() ? (
                      <span lang={l}>{selected.label[l]}</span>
                    ) : (
                      <span className={s.labelMissing}>
                        번역 없음 — 이 언어의 갤러리 필터에서 이 용어가 통째로 빠집니다
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <div className={s.urls}>
                <p className={s.fieldLabel}>이 용어가 만드는 주소</p>
                {selectedUrls.length === 0 ? (
                  <p className={s.labelMissing}>
                    노출되는 언어가 없어 생성되는 주소가 없습니다.
                  </p>
                ) : (
                  <ul className={s.urlList}>
                    {selectedUrls.map((u) => (
                      <li key={u.url}>
                        <code>{u.url}</code>
                      </li>
                    ))}
                  </ul>
                )}
                <p className={s.note}>
                  조합 필터까지 포함하면 이 슬러그가 들어가는 주소는 총{' '}
                  <b className={s.num}>{selectedAllUrls.length}</b>건입니다.
                </p>
              </div>

              <TermEditor
                taxonomyKey={selected.taxonomyKey}
                termId={selected.id}
                currentSlug={selected.slug}
                order={selected.order}
                parentGroup={selected.parentGroup}
                label={selected.label}
              />
            </Panel>
          ) : (
            <Panel title="선택한 용어">
              <p className={s.note}>왼쪽에서 용어를 선택하면 슬러그와 생성 주소를 봅니다.</p>
            </Panel>
          )}

          <Panel title="번역 누락">
            {untranslated.length === 0 ? (
              <p className={s.note}>모든 용어에 세 언어 라벨이 있습니다.</p>
            ) : (
              <>
                <p className={s.note}>
                  번역이 없는 언어에서는 그 용어가 필터에 <b>나타나지 않습니다</b>. 표기 누락이
                  아니라 기능 누락입니다.
                </p>
                <ul className={s.missingList}>
                  {untranslated.map((t) => (
                    <li key={t.id}>
                      <Link href={`/admin/taxonomy?term=${encodeURIComponent(t.id)}`}>
                        <code>{t.slug}</code>
                      </Link>
                      <span className={s.missingLocales}>
                        {t.missingLocales.map((l) => LOCALE_SHORT[l]).join(' · ')} 없음
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
