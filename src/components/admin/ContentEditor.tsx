'use client';

import { useState } from 'react';

import { AdminButton, WriteResultNotice } from '@/components/admin';
import { LOCALES, LOCALE_SHORT, type Locale } from '@/lib/i18n';

import s from './ContentEditor.module.css';

/**
 * 문구 자리 하나를 세 언어로 나란히 편집한다.
 *
 * ja / en / ko 는 서로의 번역이 아니라 각각 독립된 본문이다. 그래서 한 칸을 채워도
 * 다른 칸은 그대로 두고, 아직 손대지 않은 칸에는 "코드 기본값"이라고 적는다.
 * 빈 곳을 일본어로 대신 메우면 번역 누락이 영영 눈에 띄지 않는다.
 *
 * 저장은 언어 단위다 — 한 언어를 고치다 실패해도 다른 두 언어는 영향을 받지 않는다.
 */

export type SlotLocaleValue = {
  value: string;
  source: 'default' | 'override';
  updatedBy: string | null;
  /** ISO 문자열. Date 를 그대로 넘기지 않는 편이 직렬화 경계에서 안전하다. */
  updatedAt: string | null;
};

type Props = {
  page: string;
  slot: string;
  label: string;
  kind: 'short' | 'long' | 'list';
  maxLength: number;
  values: Record<Locale, SlotLocaleValue>;
};

type Status = { kind: 'idle' } | { kind: 'pending' } | { kind: 'saved' } | { kind: 'failed'; message: string };

const KIND_LABEL: Record<Props['kind'], string> = {
  short: '한 줄',
  long: '문단',
  list: '줄 목록',
};

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(d);
}

async function send(method: 'PUT' | 'DELETE', body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch('/api/admin/content', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;

    const payload = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    return payload?.error?.message ?? `요청이 실패했습니다 (${res.status}).`;
  } catch {
    return '서버에 연결하지 못했습니다.';
  }
}

export function ContentEditorSlot({ page, slot, label, kind, maxLength, values }: Props) {
  const [drafts, setDrafts] = useState<Record<Locale, string>>(() =>
    Object.fromEntries(LOCALES.map((l) => [l, values[l].value])) as Record<Locale, string>,
  );
  // 저장 직후에도 화면이 서버 값을 다시 받기 전까지는 상태가 낡는다.
  // 무엇이 덮어쓰기인지는 저장 결과를 반영해 여기서 따로 들고 있는다.
  const [sources, setSources] = useState<Record<Locale, 'default' | 'override'>>(() =>
    Object.fromEntries(LOCALES.map((l) => [l, values[l].source])) as Record<
      Locale,
      'default' | 'override'
    >,
  );
  const [status, setStatus] = useState<Record<Locale, Status>>(() =>
    Object.fromEntries(LOCALES.map((l) => [l, { kind: 'idle' }])) as Record<Locale, Status>,
  );

  const setDraft = (locale: Locale, next: string) =>
    setDrafts((prev) => ({ ...prev, [locale]: next }));
  const setSource = (locale: Locale, next: 'default' | 'override') =>
    setSources((prev) => ({ ...prev, [locale]: next }));
  const setStatusFor = (locale: Locale, next: Status) =>
    setStatus((prev) => ({ ...prev, [locale]: next }));

  async function save(locale: Locale) {
    setStatusFor(locale, { kind: 'pending' });
    const message = await send('PUT', { page, slot, locale, value: drafts[locale] });
    if (message) {
      setStatusFor(locale, { kind: 'failed', message });
      return;
    }
    // 빈 값 저장은 서버에서 삭제로 처리된다 — 화면 표시도 기본값으로 맞춘다.
    setSource(locale, drafts[locale].trim() ? 'override' : 'default');
    setStatusFor(locale, { kind: 'saved' });
  }

  async function reset(locale: Locale) {
    setStatusFor(locale, { kind: 'pending' });
    const message = await send('DELETE', { page, slot, locale });
    if (message) {
      setStatusFor(locale, { kind: 'failed', message });
      return;
    }
    setSource(locale, 'default');
    setStatusFor(locale, { kind: 'saved' });
    // 되돌린 뒤의 기본값은 서버만 안다. 새로고침 전까지는 안내로 대신한다.
  }

  const overridden = LOCALES.filter((l) => sources[l] === 'override').length;

  return (
    <section className={s.slot}>
      <header className={s.slotHead}>
        <div className={s.slotName}>
          <b>{label}</b>
          <code className={s.key}>{slot}</code>
        </div>
        <div className={s.slotMeta}>
          <span className={s.kind}>{KIND_LABEL[kind]}</span>
          <span className={overridden === 0 ? s.dim : undefined}>
            {overridden === 0 ? '3개 언어 모두 코드 기본값' : `3개 언어 중 ${overridden}개 수정됨`}
          </span>
        </div>
      </header>

      {kind === 'list' ? (
        <p className={s.hint}>줄바꿈 한 번이 항목 하나입니다. 빈 줄은 무시됩니다.</p>
      ) : null}

      <div className={s.locales}>
        {LOCALES.map((locale) => {
          const initial = values[locale];
          const draft = drafts[locale];
          const state = status[locale];
          const dirty = draft !== initial.value;
          const isOverride = sources[locale] === 'override';
          const when = formatWhen(initial.updatedAt);
          const busy = state.kind === 'pending';

          return (
            <div key={locale} className={isOverride ? s.col : `${s.col} ${s.colDefault}`}>
              <div className={s.colHead}>
                <span className={s.locale}>{LOCALE_SHORT[locale]}</span>
                <span className={isOverride ? s.tagOverride : s.tagDefault}>
                  {isOverride ? '수정됨' : '코드 기본값'}
                </span>
              </div>

              {kind === 'short' ? (
                <input
                  className={s.input}
                  value={draft}
                  maxLength={maxLength}
                  disabled={busy}
                  onChange={(e) => {
                    setDraft(locale, e.target.value);
                    setStatusFor(locale, { kind: 'idle' });
                  }}
                />
              ) : (
                <textarea
                  className={s.textarea}
                  value={draft}
                  maxLength={maxLength}
                  rows={kind === 'list' ? 5 : 4}
                  disabled={busy}
                  onChange={(e) => {
                    setDraft(locale, e.target.value);
                    setStatusFor(locale, { kind: 'idle' });
                  }}
                />
              )}

              <div className={s.colFoot}>
                <span className={draft.length > maxLength * 0.9 ? s.countWarn : s.count}>
                  {draft.length} / {maxLength}
                </span>
                <div className={s.colActions}>
                  <AdminButton variant="primary" onClick={() => save(locale)} disabled={!dirty || busy}>
                    저장
                  </AdminButton>
                  <AdminButton
                    variant="quiet"
                    onClick={() => reset(locale)}
                    disabled={!isOverride || busy}
                    title="이 언어를 코드 기본값으로 되돌립니다"
                  >
                    기본값으로
                  </AdminButton>
                </div>
              </div>

              {initial.updatedBy || when ? (
                <p className={s.by}>
                  마지막 수정 {initial.updatedBy ?? '기록 없음'}
                  {when ? ` · ${when}` : ''}
                </p>
              ) : null}

              {state.kind === 'saved' ? (
                <p className={s.saved} role="status">
                  저장했습니다. 공개 페이지도 갱신됩니다 — 되돌린 값은 새로고침 후 보입니다.
                </p>
              ) : null}

              <WriteResultNotice message={state.kind === 'failed' ? state.message : null} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
