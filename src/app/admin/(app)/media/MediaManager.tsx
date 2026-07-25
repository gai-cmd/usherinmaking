'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge, WriteResultNotice, formatDate, formatDimensions } from '@/components/admin';
import { Uploader, type UploadedAsset, type UploaderLimits } from '@/components/admin/Uploader';
import { LOCALES, type Locale } from '@/lib/i18n';
import s from './MediaManager.module.css';

/**
 * 미디어 라이브러리 + 페이지 이미지 슬롯 배선.
 *
 * 흐름은 한 방향이다: 올린다 → 고른다 → 자리에 건다.
 * 슬롯에 걸 때 alt 3개 언어를 요구하는 것은 서버(page-images.setPageImage)가 강제한다.
 * 여기서는 같은 규칙으로 버튼을 잠가 두어, 눌러 놓고 422를 받는 왕복을 줄일 뿐이다.
 *
 * 모든 쓰기는 실제 API 호출이다. 실패하면 서버 메시지를 그대로 띄우고 목록을 바꾸지 않는다.
 */

export type AssetView = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  size: number | null;
  lowRes: boolean;
  source: string;
  createdAt: string;
};

export type SlotView = {
  page: string;
  slot: string;
  label: string;
  group: string;
  hint: string | null;
  bound: boolean;
  currentUrl: string | null;
  currentAlt: Record<Locale, string> | null;
  fallbackUrl: string | null;
  updatedAt: string | null;
};

type Props = {
  limits: UploaderLimits;
  assets: AssetView[];
  slots: SlotView[];
  /** DB가 붙어 있는지. 안 붙어 있으면 업로드 자체가 막힌다. */
  dbReady: boolean;
  storageReady: boolean;
};

const EMPTY_ALT: Record<Locale, string> = { ja: '', en: '', ko: '' };
const LOCALE_LABEL: Record<Locale, string> = { ja: 'JA', en: 'EN', ko: 'KO' };

type ApiError = { error?: { message?: string } };

export function MediaManager({ limits, assets, slots, dbReady, storageReady }: Props) {
  const router = useRouter();

  // 업로드 직후의 자산은 서버 갱신을 기다리지 않고 바로 그리드에 얹는다.
  const [fresh, setFresh] = useState<AssetView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState<Record<Locale, string>>(EMPTY_ALT);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allAssets = useMemo(() => {
    const seen = new Set(fresh.map((a) => a.id));
    return [...fresh, ...assets.filter((a) => !seen.has(a.id))];
  }, [assets, fresh]);

  const selected = allAssets.find((a) => a.id === selectedId) ?? null;

  const groups = useMemo(() => {
    const out: { name: string; items: SlotView[] }[] = [];
    for (const slot of slots) {
      const bucket = out.find((g) => g.name === slot.group);
      if (bucket) bucket.items.push(slot);
      else out.push({ name: slot.group, items: [slot] });
    }
    return out;
  }, [slots]);

  const onUploaded = useCallback((a: UploadedAsset) => {
    setFresh((prev) => [
      {
        id: a.id,
        url: a.url,
        width: a.width,
        height: a.height,
        size: a.size,
        lowRes: a.lowRes,
        source: a.source,
        createdAt: a.createdAt,
      },
      ...prev,
    ]);
    setSelectedId(a.id);
  }, []);

  const altMissing = LOCALES.filter((l) => altDraft[l].trim().length === 0);

  async function bind(slot: SlotView) {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/media/slots', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          page: slot.page,
          slot: slot.slot,
          url: selected.url,
          width: selected.width,
          height: selected.height,
          alt: altDraft,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        setNotice(data.error?.message ?? `저장에 실패했습니다 (HTTP ${res.status}).`);
        return;
      }
      setOpenSlot(null);
      setAltDraft(EMPTY_ALT);
      router.refresh();
    } catch {
      setNotice('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function unbind(slot: SlotView) {
    setBusy(true);
    setNotice(null);
    try {
      const qs = new URLSearchParams({ page: slot.page, slot: slot.slot });
      const res = await fetch(`/api/admin/media/slots?${qs}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        setNotice(data.error?.message ?? `해제에 실패했습니다 (HTTP ${res.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setNotice('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(asset: AssetView) {
    // 되돌릴 수 없는 삭제라 한 번 확인한다. 슬롯에 걸린 이미지도 함께 사라진다.
    const usedBy = slots.filter((sl) => sl.currentUrl === asset.url);
    const warning =
      usedBy.length > 0
        ? `\n\n지금 ${usedBy.length}개 자리에 걸려 있습니다 (${usedBy.map((u) => u.label).join(', ')}). 지우면 그 자리는 기본 이미지로 돌아갑니다.`
        : '';
    if (!window.confirm(`이 이미지를 삭제할까요? 되돌릴 수 없습니다.${warning}`)) return;

    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/media/${asset.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ApiError;
        setNotice(data.error?.message ?? `삭제에 실패했습니다 (HTTP ${res.status}).`);
        return;
      }
      setFresh((prev) => prev.filter((a) => a.id !== asset.id));
      if (selectedId === asset.id) setSelectedId(null);
      router.refresh();
    } catch {
      setNotice('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function openBinder(slot: SlotView) {
    setOpenSlot(slot.page + '::' + slot.slot);
    // 이미 걸려 있던 alt가 있으면 그대로 이어서 고치게 한다.
    setAltDraft(slot.currentAlt ?? EMPTY_ALT);
    setNotice(null);
  }

  return (
    <div className={s.wrap}>
      <section className={s.col}>
        <h2 className={s.h}>업로드</h2>

        {!storageReady || !dbReady ? (
          <p className={s.blocked}>
            {!storageReady
              ? '스토리지(BLOB_READ_WRITE_TOKEN)가 설정되지 않아 업로드할 수 없습니다.'
              : 'DB가 연결되지 않아 업로드를 기록할 수 없습니다.'}
          </p>
        ) : (
          <Uploader limits={limits} onUploaded={onUploaded} />
        )}

        <h2 className={s.h}>
          라이브러리 <span className={s.count}>{allAssets.length}</span>
        </h2>

        {allAssets.length === 0 ? (
          <p className={s.empty}>아직 올린 이미지가 없습니다. 위에서 올려 주세요.</p>
        ) : (
          <ul className={s.grid}>
            {allAssets.map((a) => (
              <li
                key={a.id}
                className={`${s.cell} ${selectedId === a.id ? s.cellOn : ''}`}
              >
                <button
                  type="button"
                  className={s.cellPick}
                  onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
                  aria-pressed={selectedId === a.id}
                  data-tap
                >
                  {/* next/image 는 원격 호스트 허용 설정이 필요하다. 관리자 썸네일이라 img로 둔다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt="" loading="lazy" decoding="async" className={s.img} />
                  <span className={s.meta}>{formatDimensions(a.width ?? 0, a.height ?? 0)}</span>
                </button>
                <span className={s.flags}>
                  {a.lowRes ? <Badge tone="warn">저해상도</Badge> : null}
                </span>
                <button
                  type="button"
                  className={s.del}
                  onClick={() => void remove(a)}
                  disabled={busy}
                  title="삭제"
                  data-tap
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={s.col}>
        <h2 className={s.h}>페이지 이미지 자리</h2>
        <p className={s.lead}>
          {selected
            ? '왼쪽에서 고른 이미지를 아래 자리에 겁니다. 3개 언어 alt를 넣어야 게시됩니다.'
            : '왼쪽에서 이미지를 먼저 고르면 자리에 걸 수 있습니다.'}
        </p>

        {notice ? <WriteResultNotice message={notice} /> : null}

        {groups.map((g) => (
          <div key={g.name} className={s.group}>
            <h3 className={s.groupName}>{g.name}</h3>
            <ul className={s.slots}>
              {g.items.map((slot) => {
                const key = slot.page + '::' + slot.slot;
                const open = openSlot === key;
                const preview = slot.currentUrl ?? slot.fallbackUrl;
                return (
                  <li key={key} className={s.slot}>
                    <div className={s.slotHead}>
                      <span className={s.thumb}>
                        {preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={preview} alt="" loading="lazy" className={s.thumbImg} />
                        ) : (
                          <span className={s.thumbEmpty}>없음</span>
                        )}
                      </span>

                      <span className={s.slotText}>
                        <span className={s.slotLabel}>{slot.label}</span>
                        <span className={s.slotKey}>
                          {slot.page} / {slot.slot}
                        </span>
                        {slot.hint ? <span className={s.slotHint}>{slot.hint}</span> : null}
                        <span className={s.slotState}>
                          {slot.bound ? (
                            <>
                              <Badge tone="dark">교체됨</Badge>
                              {slot.updatedAt ? (
                                <span className={s.slotWhen}>
                                  {formatDate(new Date(slot.updatedAt))}
                                </span>
                              ) : null}
                              {!slot.currentAlt ? <Badge tone="warn">alt 미완성</Badge> : null}
                            </>
                          ) : (
                            <span className={s.slotWhen}>
                              {slot.fallbackUrl ? '기본 이미지 사용 중' : '이미지 없음'}
                            </span>
                          )}
                        </span>
                      </span>

                      <span className={s.slotActions}>
                        <button
                          type="button"
                          className={s.act}
                          onClick={() => (open ? setOpenSlot(null) : openBinder(slot))}
                          disabled={!selected || busy}
                          title={selected ? undefined : '왼쪽에서 이미지를 먼저 고르세요'}
                          data-tap
                        >
                          {open ? '닫기' : '이 자리에 걸기'}
                        </button>
                        {slot.bound ? (
                          <button
                            type="button"
                            className={s.actGhost}
                            onClick={() => void unbind(slot)}
                            disabled={busy}
                            data-tap
                          >
                            해제
                          </button>
                        ) : null}
                      </span>
                    </div>

                    {open && selected ? (
                      <div className={s.binder}>
                        <div className={s.binderPreview}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={selected.url} alt="" className={s.binderImg} />
                          <span className={s.binderMeta}>
                            {formatDimensions(selected.width ?? 0, selected.height ?? 0)}
                            {selected.lowRes ? ' · 저해상도' : ''}
                          </span>
                        </div>

                        <div className={s.altFields}>
                          {LOCALES.map((l) => (
                            <label key={l} className={s.altField}>
                              <span className={s.altLabel}>{LOCALE_LABEL[l]} alt</span>
                              <input
                                className={s.altInput}
                                value={altDraft[l]}
                                maxLength={300}
                                onChange={(e) =>
                                  setAltDraft((prev) => ({ ...prev, [l]: e.target.value }))
                                }
                                placeholder={`${LOCALE_LABEL[l]} 대체 텍스트`}
                              />
                            </label>
                          ))}
                        </div>

                        <div className={s.binderFoot}>
                          <span className={s.binderNote}>
                            {altMissing.length > 0
                              ? `alt 미입력: ${altMissing.map((l) => LOCALE_LABEL[l]).join(' · ')}`
                              : '3개 언어 모두 입력되었습니다.'}
                          </span>
                          <button
                            type="button"
                            className={s.actPrimary}
                            onClick={() => void bind(slot)}
                            disabled={busy || altMissing.length > 0}
                            data-tap
                          >
                            {busy ? '저장 중…' : '저장하고 게시'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
