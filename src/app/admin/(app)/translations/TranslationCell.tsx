'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import s from './translations.module.css';

/**
 * 번역 한 칸. 편집 가능한 항목(플랜)만 입력칸이 되고, 코드가 원본인 항목은 값과 힌트만 보인다.
 *
 * 저장은 칸 단위다 — 한 언어의 한 값. 빈 값을 일본어로 대신 채워 보여 주지 않는다.
 * reviewed 는 항상 true 로 보낸다: 이 칸에 친 글은 사람이 쓴 것이다. 기계 초안이 들어오는
 * 경로는 따로 있고(requestMachineDraft), 그쪽은 사람이 확인하기 전엔 저장되지 않는다.
 */
export function TranslationCell({
  fieldKey,
  locale,
  value,
  editable,
  editHint,
  multiline,
}: {
  fieldKey: string;
  locale: Locale;
  value: string;
  editable: boolean;
  editHint?: string;
  /** 포함사항처럼 줄 단위 목록인 칸 */
  multiline: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = draft !== value;
  const empty = !value.trim();

  if (!editable) {
    return empty ? (
      <span className={s.missing} title={editHint}>
        미작성 — {editHint ?? '이 화면에서 고칠 수 없음'}
      </span>
    ) : (
      <span className={s.value} lang={locale} title={editHint}>
        {value}
      </span>
    );
  }

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/translations', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: fieldKey, locale, value: draft, reviewed: true }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? body?.message ?? `저장 실패 (${res.status})`);
      setMsg('저장됨');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={s.editCell}>
      {multiline ? (
        <textarea
          className={s.editInput}
          lang={locale}
          rows={3}
          value={draft}
          placeholder="한 줄에 한 항목"
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : (
        <input
          className={s.editInput}
          lang={locale}
          value={draft}
          placeholder={empty ? '미작성 — 입력 필요' : undefined}
          onChange={(e) => setDraft(e.target.value)}
        />
      )}
      <span className={s.editFoot}>
        <button
          type="button"
          className={s.editSave}
          onClick={save}
          disabled={busy || !dirty}
          data-tap
        >
          {busy ? '저장 중…' : '저장'}
        </button>
        {msg && <span className={s.editMsg}>{msg}</span>}
      </span>
    </span>
  );
}
