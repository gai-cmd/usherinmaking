'use client';

import { useState } from 'react';

import { AdminButton, WriteResultNotice } from '@/components/admin';

import s from './plans.module.css';

/**
 * 플랜 편집 폼.
 *
 * 세금 표기가 이 화면의 핵심 안전장치다. 스튜디오는 모니터 가격이라 税込 표기 근거가 없고,
 * 로케이션·기념사진은 税込이다. 두 성격이 섞이면 표시 가격 자체가 오표기가 되므로
 * scope 를 바꾸는 즉시 기대값을 다시 계산해 어긋남을 눈에 보이게 띄운다.
 */

export type EditablePlan = {
  code: string;
  scope: string;
  price: number;
  listPrice: number | null;
  taxIncluded: boolean;
  cuts: number | null;
  order: number;
  durationJa: string;
  titleJa: string;
};

const SCOPE_LABEL: Record<string, string> = {
  STUDIO: '스튜디오',
  LOCATION: '로케이션',
  ANNIVERSARY: '기념사진',
  HAIRMAKE: '헤어메이크업',
};

function expectedTaxIncluded(scope: string): boolean {
  return scope === 'LOCATION' || scope === 'ANNIVERSARY';
}

type State =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'failed'; message: string };

export function PlanEditor({
  plan,
  affectedRoutes,
}: {
  plan: EditablePlan;
  affectedRoutes: string[];
}) {
  const [scope, setScope] = useState(plan.scope);
  const [price, setPrice] = useState(String(plan.price));
  const [listPrice, setListPrice] = useState(plan.listPrice === null ? '' : String(plan.listPrice));
  const [taxIncluded, setTaxIncluded] = useState(plan.taxIncluded);
  const [state, setState] = useState<State>({ kind: 'idle' });

  const expected = expectedTaxIncluded(scope);
  const conflict =
    taxIncluded === expected
      ? null
      : expected
        ? `${SCOPE_LABEL[scope] ?? scope} 가격은 税込입니다. 税込 표기를 켜 주세요.`
        : `${SCOPE_LABEL[scope] ?? scope} 가격은 모니터 가격이라 税込 표기 근거가 없습니다.`;

  async function save() {
    setState({ kind: 'pending' });
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: plan.code,
          scope,
          price: Number(price),
          listPrice: listPrice === '' ? null : Number(listPrice),
          taxIncluded,
          cuts: plan.cuts,
          order: plan.order,
          // 제목·소요시간·포함내역의 다국어 편집은 번역 화면 담당이라 여기서는 그대로 되보낸다.
          title: { ja: plan.titleJa, en: '', ko: '' },
          duration: { ja: plan.durationJa, en: '', ko: '' },
          includes: { ja: [], en: [], ko: [] },
        }),
      });

      if (res.ok) {
        setState({ kind: 'idle' });
        return;
      }
      const payload = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setState({
        kind: 'failed',
        message: payload?.error?.message ?? `요청이 실패했습니다 (${res.status}).`,
      });
    } catch {
      setState({ kind: 'failed', message: '서버에 연결하지 못했습니다.' });
    }
  }

  return (
    <div>
      <div className={s.fieldGrid}>
        <label className={s.field}>
          <span className={s.fieldLabel}>대상 (scope)</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={s.input}>
            {Object.entries(SCOPE_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>정가</span>
          <input
            className={s.input}
            inputMode="numeric"
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value.replace(/[^\d]/gu, ''))}
            placeholder="없으면 비워 둡니다"
          />
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>
            {expected ? '판매 가격' : '모니터 가격'}
          </span>
          <input
            className={`${s.input} ${s.inputStrong}`}
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/gu, ''))}
          />
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>컷 수</span>
          <input className={s.input} value={plan.cuts ?? '—'} readOnly />
        </label>
      </div>

      {/* 세금 표기는 scope 에 종속된다. 체크박스 옆에 항상 기대값을 같이 보여 준다. */}
      <div className={conflict ? `${s.taxRow} ${s.taxRowConflict}` : s.taxRow}>
        <label className={s.checkRow}>
          <input
            type="checkbox"
            checked={taxIncluded}
            onChange={(e) => setTaxIncluded(e.target.checked)}
          />
          <span>税込 표기를 붙인다</span>
        </label>
        <span className={s.taxExpected}>
          {SCOPE_LABEL[scope] ?? scope} 기준: {expected ? '税込 표기 있음' : '税込 표기 없음 (모니터 가격)'}
        </span>
        {conflict ? <p className={s.taxConflict}>{conflict}</p> : null}
      </div>

      <div className={s.affected}>
        <p className={s.affectedTitle}>이 변경이 닿는 주소 {affectedRoutes.length}건</p>
        <ul className={s.affectedList}>
          {affectedRoutes.map((r) => (
            <li key={r}>
              <code>{r}</code>
            </li>
          ))}
        </ul>
      </div>

      <div className={s.rowActions}>
        <AdminButton variant="primary" onClick={save} disabled={state.kind === 'pending' || !!conflict}>
          공개하기
        </AdminButton>
      </div>

      <WriteResultNotice message={state.kind === 'failed' ? state.message : null} />
    </div>
  );
}
