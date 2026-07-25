'use client';

import { useState } from 'react';

import { AdminButton, WriteResultNotice } from '@/components/admin';

import s from './taxonomy.module.css';

/**
 * 용어 편집 — 슬러그가 핵심이다.
 *
 * 갤러리 필터는 쿼리스트링이 아니라 경로다. 그래서 슬러그는 공개 URL 세그먼트이고,
 * 바꾸는 순간 색인된 주소가 끊긴다. 형식 검증은 입력 즉시 하고,
 * 변경 자체는 무엇이 끊기는지 서버에서 받아 확인을 거친 뒤에만 진행한다.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function slugError(slug: string): string | null {
  if (!slug) return '슬러그를 입력해 주세요.';
  if (slug.length > 48) return '슬러그는 48자를 넘을 수 없습니다.';
  if (!SLUG_PATTERN.test(slug)) {
    return '소문자 영문·숫자·하이픈만 쓸 수 있습니다 (예: arch-window).';
  }
  return null;
}

type State =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'confirm'; message: string; breaking: string[] }
  | { kind: 'failed'; message: string };

export function TermEditor({
  taxonomyKey,
  termId,
  currentSlug,
  order,
  parentGroup,
  label,
}: {
  taxonomyKey: string;
  termId: string;
  currentSlug: string;
  order: number;
  parentGroup: string | null;
  label: Record<string, string | undefined>;
}) {
  const [slug, setSlug] = useState(currentSlug);
  const [state, setState] = useState<State>({ kind: 'idle' });

  const formatError = slugError(slug);
  const changed = slug !== currentSlug;

  async function save(acknowledge: boolean) {
    setState({ kind: 'pending' });
    try {
      const res = await fetch('/api/admin/taxonomy/terms', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          taxonomyKey,
          termId,
          slug,
          label,
          order,
          parentGroup,
          acknowledgeSlugChange: acknowledge,
        }),
      });

      if (res.ok) {
        setState({ kind: 'idle' });
        return;
      }

      const payload = (await res.json().catch(() => null)) as
        | { error?: { code?: string; message?: string; details?: { breaking?: string[] } } }
        | null;

      if (res.status === 409 && payload?.error?.code === 'SLUG_CHANGE_UNCONFIRMED') {
        setState({
          kind: 'confirm',
          message: payload.error.message ?? '슬러그 변경 확인이 필요합니다.',
          breaking: payload.error.details?.breaking ?? [],
        });
        return;
      }

      setState({
        kind: 'failed',
        message: payload?.error?.message ?? `요청이 실패했습니다 (${res.status}).`,
      });
    } catch {
      setState({ kind: 'failed', message: '서버에 연결하지 못했습니다.' });
    }
  }

  return (
    <div className={s.editor}>
      <label className={s.field}>
        <span className={s.fieldLabel}>슬러그 (공개 URL 세그먼트)</span>
        <input
          className={formatError && slug ? `${s.input} ${s.inputBad}` : s.input}
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setState({ kind: 'idle' });
          }}
          aria-invalid={Boolean(formatError)}
        />
      </label>

      {formatError ? <p className={s.slugError}>{formatError}</p> : null}

      {changed && !formatError ? (
        <p className={s.slugWarn}>
          살아 있는 주소가 바뀝니다. <code>/{'{locale}'}/gallery/{currentSlug}</code> →{' '}
          <code>/{'{locale}'}/gallery/{slug}</code>
        </p>
      ) : null}

      <div className={s.rowActions}>
        <AdminButton
          variant="primary"
          onClick={() => save(false)}
          disabled={!changed || Boolean(formatError) || state.kind === 'pending'}
        >
          슬러그 저장
        </AdminButton>
      </div>

      {state.kind === 'confirm' ? (
        <div className={s.confirmBox} role="status">
          <p className={s.confirmMsg}>{state.message}</p>
          {state.breaking.length ? (
            <ul className={s.breakingList}>
              {state.breaking.slice(0, 12).map((u) => (
                <li key={u}>
                  <code>{u}</code>
                </li>
              ))}
              {state.breaking.length > 12 ? (
                <li className={s.breakingMore}>외 {state.breaking.length - 12}건</li>
              ) : null}
            </ul>
          ) : null}
          <div className={s.rowActions}>
            <AdminButton variant="primary" onClick={() => save(true)}>
              끊기는 주소를 확인했습니다 — 계속
            </AdminButton>
            <AdminButton variant="quiet" onClick={() => setState({ kind: 'idle' })}>
              취소
            </AdminButton>
          </div>
        </div>
      ) : null}

      <WriteResultNotice message={state.kind === 'failed' ? state.message : null} />
    </div>
  );
}
