'use client';

import { useState } from 'react';

import { AdminButton, WriteResultNotice } from '@/components/admin';

import s from './inquiries.module.css';

/**
 * 문의 상세의 쓰기 동작들.
 *
 * 상태 변경과 메모 저장은 DB에 실제로 반영된다(로컬에서 NEW → DONE 반영을 실측했다).
 * 답변 메일 발송과 FAQ 승격은 아직 붙지 않아 서버가 501을 돌려준다.
 * 그 501을 성공처럼 감추지 않고 화면에 그대로 사유를 띄운다 —
 * 관리자가 "저장됐다"고 믿고 창을 닫는 쪽이 훨씬 나쁘다.
 */

type State =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'failed'; message: string }
  | { kind: 'done' };

async function post(url: string, body: unknown, method: 'POST' | 'PATCH'): Promise<State> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return { kind: 'done' };

    const payload = (await res.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;

    return {
      kind: 'failed',
      message: payload?.error?.message ?? `요청이 실패했습니다 (${res.status}).`,
    };
  } catch {
    return { kind: 'failed', message: '서버에 연결하지 못했습니다.' };
  }
}

function Result({ state }: { state: State }) {
  if (state.kind === 'idle' || state.kind === 'pending') return null;
  if (state.kind === 'done') return <p className={s.resultOk}>저장했습니다.</p>;
  return <WriteResultNotice message={state.message} />;
}

/* ------------------------------------------------------------------ */

export function StatusActions({ id, current }: { id: string; current: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function move(status: string) {
    setState({ kind: 'pending' });
    setState(await post(`/api/admin/inquiries/${id}`, { status }, 'PATCH'));
  }

  return (
    <div className={s.statusActions}>
      <div className={s.statusButtons}>
        <AdminButton variant="primary" onClick={() => move('WAITING')} disabled={state.kind === 'pending'}>
          답변하기
        </AdminButton>
        <AdminButton onClick={() => move('DONE')} disabled={state.kind === 'pending' || current === 'DONE'}>
          완료 처리
        </AdminButton>
        <AdminButton variant="quiet" onClick={() => move('HOLD')} disabled={state.kind === 'pending'}>
          보류
        </AdminButton>
        <AdminButton variant="quiet" onClick={() => move('SPAM')} disabled={state.kind === 'pending'}>
          스팸
        </AdminButton>
      </div>
      <Result state={state} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export type Template = { id: string; label: string; body: string };

export function ReplyPanel({ id, templates }: { id: string; templates: Template[] }) {
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function send() {
    setState({ kind: 'pending' });
    setState(await post(`/api/admin/inquiries/${id}/reply`, { body: draft }, 'POST'));
  }

  return (
    <div>
      <div className={s.chips}>
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            className={s.chip}
            onClick={() => setDraft((prev) => (prev ? `${prev}\n${t.body}` : t.body))}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className={s.srOnly} htmlFor="reply-body">
        답변 본문
      </label>
      <textarea
        id="reply-body"
        className={s.textarea}
        rows={5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="템플릿을 눌러 넣거나 직접 작성하세요. 본문은 문의자의 언어로 나갑니다."
      />

      <div className={s.rowActions}>
        <AdminButton variant="primary" onClick={send} disabled={!draft.trim() || state.kind === 'pending'}>
          메일로 발송
        </AdminButton>
        <AdminButton variant="quiet" disabled title="임시 저장도 같은 저장 경로를 씁니다.">
          임시 저장
        </AdminButton>
      </div>

      <Result state={state} />
      <p className={s.note}>
        메일과 LINE은 알림입니다. 발송에 실패해도 문의 자체는 이 목록에 그대로 남습니다.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function PromotePanel({
  id,
  candidates,
  alreadyPromoted,
}: {
  id: string;
  candidates: string[];
  alreadyPromoted: boolean;
}) {
  const [picked, setPicked] = useState(candidates[0] ?? '');
  const [page, setPage] = useState<string>('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function promote() {
    setState({ kind: 'pending' });
    setState(
      await post(
        `/api/admin/inquiries/${id}/promote`,
        { questionVerbatim: picked, page: page || null },
        'POST',
      ),
    );
  }

  if (alreadyPromoted) {
    return <p className={s.note}>이미 FAQ로 올린 문의입니다.</p>;
  }

  if (candidates.length === 0) {
    return (
      <p className={s.note}>
        본문에서 물음표로 끝나는 문장을 찾지 못했습니다. FAQ는 고객이 실제로 쓴 질문 문장만 올립니다.
      </p>
    );
  }

  return (
    <div>
      <p className={s.note}>
        고른 문장이 <b>그대로</b> FAQ에 올라갑니다. 다듬거나 요약하지 마세요 — 고객이 쓴 표현이
        남아야 AI 검색이 우리 답변을 인용합니다.
      </p>

      <ul className={s.candidates}>
        {candidates.map((c) => (
          <li key={c}>
            <label className={s.candidate}>
              <input
                type="radio"
                name="faq-candidate"
                value={c}
                checked={picked === c}
                onChange={() => setPicked(c)}
              />
              <span lang="auto">{c}</span>
            </label>
          </li>
        ))}
      </ul>

      <label className={s.selectRow}>
        <span>노출 페이지</span>
        <select value={page} onChange={(e) => setPage(e.target.value)} className={s.select}>
          <option value="">아직 정하지 않음</option>
          <option value="home">홈</option>
          <option value="studio">스튜디오</option>
          <option value="location">로케이션</option>
          <option value="plan">요금</option>
          <option value="dress">드레스</option>
          <option value="contact">문의</option>
        </select>
      </label>

      <div className={s.rowActions}>
        <AdminButton variant="primary" onClick={promote} disabled={!picked || state.kind === 'pending'}>
          FAQ에 추가
        </AdminButton>
      </div>

      <Result state={state} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function MemoPanel({ id, initial }: { id: string; initial: string }) {
  const [memo, setMemo] = useState(initial);
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function save() {
    setState({ kind: 'pending' });
    setState(await post(`/api/admin/inquiries/${id}`, { memo }, 'PATCH'));
  }

  return (
    <div>
      <label className={s.srOnly} htmlFor="memo-body">
        메모
      </label>
      <textarea
        id="memo-body"
        className={s.textarea}
        rows={3}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="내부 메모. 고객에게 보이지 않습니다."
      />
      <div className={s.rowActions}>
        <AdminButton onClick={save} disabled={memo === initial || state.kind === 'pending'}>
          메모 저장
        </AdminButton>
      </div>
      <Result state={state} />
    </div>
  );
}
