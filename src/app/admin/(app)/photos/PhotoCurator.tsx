'use client';

import { useMemo, useState } from 'react';
import { Badge, SuggestionBadge, WriteResultNotice, formatDate, formatDimensions } from '@/components/admin';
import { LOCALES, type Locale } from '@/lib/i18n';
import {
  missingAltLocales,
  type Localized,
  type Photo,
  type PhotoStatus,
  type TaxonomyOption,
} from '@/lib/photo-types';
import s from './PhotoCurator.module.css';

const LOCALE_LABEL: Record<Locale, string> = { ja: 'JA', en: 'EN', ko: 'KO' };

type Props = {
  photos: Photo[];
  taxonomies: TaxonomyOption[];
  initialPhotoId?: string;
};

type ApiError = { error?: { code?: string; message?: string } };

/**
 * 그리드 선택 + 우측 상세 패널.
 *
 * 쓰기는 전부 /api/admin/photos/* 를 실제로 호출하고, DB가 붙어 있으면 실제로 저장된다.
 * 실패하면 그 사유를 화면에 그대로 띄운다 — 성공 토스트를 흉내내지 않는다.
 * (전시 전제 조건 위반은 422, DB 미연결은 501 로 돌아온다.)
 */
export function PhotoCurator({ photos, taxonomies, initialPhotoId }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | undefined>(initialPhotoId ?? photos[0]?.id);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 편집 중인 alt는 로컬 초안. 저장이 안 되므로 이동하면 사라진다는 점을 패널에 적어 둔다.
  const [altDraft, setAltDraft] = useState<Record<string, Partial<Localized>>>({});

  const active = useMemo(() => photos.find((p) => p.id === activeId), [photos, activeId]);
  const activeAlt: Localized = useMemo(() => {
    if (!active) return { ja: '', en: '', ko: '' };
    return { ...active.alt, ...(altDraft[active.id] ?? {}) } as Localized;
  }, [active, altDraft]);

  const missing = missingAltLocales(activeAlt);
  const canPublish = missing.length === 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function call(url: string, body: unknown) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        setNotice(data.error?.message ?? `요청이 실패했습니다 (HTTP ${res.status}).`);
        return;
      }
      // 성공 경로는 저장 계층이 붙은 뒤에만 도달한다. 그때 목록 갱신을 붙인다.
      setNotice(null);
    } catch {
      setNotice('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(id: string, status: PhotoStatus) {
    return call(`/api/admin/photos/${id}/status`, { status });
  }

  function bulkAction(action: 'publish' | 'archive' | 'delete') {
    if (selected.size === 0) return;
    setBusy(true);
    setNotice(null);
    fetch('/api/admin/photos/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [...selected], action }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as ApiError & { count?: number };
        if (!res.ok) {
          setNotice(data.error?.message ?? `요청이 실패했습니다 (HTTP ${res.status}).`);
          return;
        }
        if (action === 'delete') {
          // 지운 사진은 목록에서 사라져야 한다. 선택도 함께 비운다 —
          // 이미 없는 사진이 선택된 채로 남으면 다음 일괄 작업이 404 로 막힌다.
          setSelected(new Set());
          setNotice(`${data.count ?? 0}건을 삭제했습니다. 동기화해도 다시 들어오지 않습니다.`);
        }
      })
      .catch(() => setNotice('서버에 연결하지 못했습니다.'))
      .finally(() => setBusy(false));
  }

  function bulkStatus(status: PhotoStatus) {
    bulkAction(status === 'PUBLISHED' ? 'publish' : 'archive');
  }

  /**
   * 삭제는 되돌릴 수 없다(행이 사라지고 수집 제외 목록에 오른다).
   * 그래서 버튼 한 번으로는 실행하지 않고, 확인을 한 단계 둔다.
   */
  function confirmDelete() {
    if (selected.size === 0) return;
    const ok = window.confirm(
      `선택한 ${selected.size}건을 갤러리에서 삭제합니다.\n\n` +
        `· 사이트와 관리자 목록에서 사라집니다\n` +
        `· 인스타 동기화가 돌아도 다시 들어오지 않습니다\n` +
        `· 원본 파일은 미디어 보관함에 남습니다\n\n` +
        `되돌릴 수 없습니다. 계속할까요?`,
    );
    if (ok) bulkAction('delete');
  }

  const selectedMissingAlt = [...selected].filter((id) => {
    const p = photos.find((x) => x.id === id);
    return p ? missingAltLocales({ ...p.alt, ...(altDraft[id] ?? {}) }).length > 0 : false;
  });

  return (
    <div className={s.root}>
      <div className={s.gridPane}>
        <div className={s.bulkBar}>
          <span className={s.bulkCount}>{selected.size}건 선택중</span>
          <button
            type="button"
            className={s.bulkPrimary}
            disabled={selected.size === 0 || busy || selectedMissingAlt.length > 0}
            title={
              selectedMissingAlt.length > 0
                ? `alt가 3개 언어 모두 채워지지 않은 사진이 ${selectedMissingAlt.length}건 있습니다`
                : undefined
            }
            onClick={() => bulkStatus('PUBLISHED')}
          >
            전시하기
          </button>
          <button type="button" className={s.bulkGhost} disabled title="분류 일괄 지정이 아직 연결되지 않았습니다">
            카테고리 일괄 지정
          </button>
          <button
            type="button"
            className={s.bulkQuiet}
            disabled={selected.size === 0 || busy}
            onClick={() => bulkStatus('ARCHIVED')}
          >
            보관
          </button>
          <button type="button" className={s.bulkQuiet} disabled title="AI alt 생성이 아직 연결되지 않았습니다">
            alt 일괄 생성
          </button>
          <button
            type="button"
            className={s.bulkDanger}
            disabled={selected.size === 0 || busy}
            title="갤러리에서 지우고 다시 수집되지 않게 합니다"
            onClick={confirmDelete}
          >
            삭제 · 수집 제외
          </button>
        </div>

        {selected.size > 0 && selectedMissingAlt.length > 0 ? (
          <p className={s.blockNote}>
            선택 항목 중 {selectedMissingAlt.length}건은 alt가 비어 있어 전시할 수 없습니다. 상세 패널에서 JA · EN · KO를
            모두 채워 주세요.
          </p>
        ) : null}

        <WriteResultNotice message={notice} />

        {photos.length === 0 ? (
          <p className={s.empty}>조건에 맞는 사진이 없습니다.</p>
        ) : (
          <ul className={s.grid}>
            {photos.map((p) => {
              const checked = selected.has(p.id);
              const isActive = p.id === activeId;
              return (
                <li
                  key={p.id}
                  className={`${s.card} ${checked ? s.cardChecked : ''} ${isActive ? s.cardActive : ''}`}
                >
                  <div className={s.frame}>
                    <button
                      type="button"
                      className={s.preview}
                      onClick={() => setActiveId(p.id)}
                      aria-label={`${formatDate(p.takenAt)} 사진 상세 열기`}
                    >
                      {/* 관리자 화면은 noindex이고 원본 호스트가 유동적이라 next/image 대신 img를 쓴다 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.originalUrl} alt="" loading="lazy" decoding="async" />
                    </button>
                    <label className={s.check}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p.id)}
                        aria-label={`${formatDate(p.takenAt)} 사진 선택`}
                      />
                      <span aria-hidden="true">{checked ? '✓' : ''}</span>
                    </label>
                    {p.lowRes ? <span className={s.lowres}>저해상도 · 원본 교체 필요</span> : null}
                  </div>

                  <div className={s.tags}>
                    {p.aiSuggestion?.map((sg) => (
                      <SuggestionBadge key={`${sg.taxonomyId}:${sg.termId}`} label={sg.label} score={sg.score} />
                    ))}
                    {p.terms.length > 0
                      ? p.terms.map((t) => (
                          <Badge key={t.termId} tone="default">
                            {t.label.ko}
                          </Badge>
                        ))
                      : null}
                    {missingAltLocales(p.alt).length > 0 ? <Badge tone="warn">alt 미완성</Badge> : null}
                  </div>

                  <p className={s.meta}>
                    {formatDate(p.takenAt)} · {formatDimensions(p.width, p.height)}
                    {p.igMediaId ? '' : ' · 수동 업로드'}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <aside className={s.detail}>
        {!active ? (
          <p className={s.empty}>사진을 선택하면 여기에 상세가 표시됩니다.</p>
        ) : (
          <>
            <h2 className={s.detailTitle}>선택한 사진</h2>
            <div className={s.detailImage}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.originalUrl} alt="" loading="lazy" decoding="async" />
            </div>

            <p className={s.caption}>
              {active.caption ? `캡션「${active.caption}」` : '캡션 없음'}
              <span className={s.captionMeta}>
                {formatDate(active.takenAt)} · {formatDimensions(active.width, active.height)}
                {active.lowRes ? ' · 저해상도' : ''}
              </span>
            </p>

            <h3 className={s.sectionLabel}>CATEGORY</h3>
            <div className={s.fields}>
              {taxonomies.map((tx) => {
                const currentTerm = active.terms.find((t) => t.taxonomyId === tx.id);
                return (
                  <label key={tx.id} className={s.field}>
                    <span className={s.fieldLabel}>{tx.label.ko}</span>
                    <select
                      className={s.select}
                      defaultValue={currentTerm?.termId ?? ''}
                      disabled
                      title="분류 저장이 아직 연결되지 않았습니다"
                    >
                      <option value="">미지정</option>
                      {tx.terms.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label.ko}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>

            <h3 className={s.sectionLabel}>
              ALT <span className={s.required}>3개 언어 필수</span>
            </h3>
            <div className={s.fields}>
              {LOCALES.map((l) => (
                <label key={l} className={s.field}>
                  <span className={s.fieldLabel}>
                    {LOCALE_LABEL[l]}
                    {missing.includes(l) ? <em className={s.missingMark}>비어 있음</em> : null}
                  </span>
                  <textarea
                    className={s.textarea}
                    rows={2}
                    maxLength={300}
                    value={activeAlt[l]}
                    placeholder={l === 'ja' ? '沖縄 スタジオ セルフウェディング' : ''}
                    onChange={(e) =>
                      setAltDraft((prev) => ({
                        ...prev,
                        [active.id]: { ...(prev[active.id] ?? {}), [l]: e.target.value },
                      }))
                    }
                  />
                </label>
              ))}
            </div>

            <div className={s.actions}>
              <button
                type="button"
                className={s.primary}
                disabled={!canPublish || busy}
                title={canPublish ? undefined : `alt 미완성: ${missing.map((m) => LOCALE_LABEL[m]).join(', ')}`}
                onClick={() => changeStatus(active.id, 'PUBLISHED')}
              >
                전시하기
              </button>
              <button
                type="button"
                className={s.ghost}
                disabled={busy}
                onClick={() => changeStatus(active.id, 'ARCHIVED')}
              >
                보관
              </button>
              <button
                type="button"
                className={s.quiet}
                disabled={active.status !== 'PUBLISHED' || busy}
                title={active.status === 'PUBLISHED' ? undefined : '전시중인 사진만 대표컷이 될 수 있습니다'}
                onClick={() =>
                  call(`/api/admin/photos/${active.id}`, { isCover: true })
                }
              >
                대표컷
              </button>
            </div>

            {!canPublish ? (
              <p className={s.blockNote}>
                alt가 {missing.map((m) => LOCALE_LABEL[m]).join(' · ')} 에서 비어 있어 전시할 수 없습니다. AI가 만든
                초안도 관리자가 확인해야 전시됩니다.
              </p>
            ) : null}

            <p className={s.footNote}>
              전시 = 사이트 공개 / 보관 = 서버에는 남지만 비공개. 미선별과 보관은 프론트에 나가지 않습니다.
              <br />
              입력한 alt는 저장 경로가 붙기 전까지 이 화면을 벗어나면 사라집니다.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
