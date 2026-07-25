import Link from 'next/link';
import type { ReactNode } from 'react';
import s from './StatTile.module.css';

/**
 * 대시보드 숫자 타일.
 *
 * value가 null이면 "미연결"로 렌더한다 — 계산할 근거가 없는 지표를 0으로 보여 주면
 * 관리자가 "처리할 게 없다"로 읽는다. 그건 거짓말이다.
 */
export function StatTile({
  label,
  value,
  hint,
  href,
  hintTone = 'muted',
  notWiredReason,
}: {
  label: string;
  value: number | null;
  hint?: ReactNode;
  href?: string;
  hintTone?: 'muted' | 'accent';
  /** value가 null일 때 왜 셀 수 없는지 */
  notWiredReason?: string;
}) {
  const body = (
    <>
      <span className={s.label}>{label}</span>
      {value === null ? (
        <span className={s.notWired}>미연결</span>
      ) : (
        <span className={s.value}>{value.toLocaleString('ko-KR')}</span>
      )}
      {value === null ? (
        <span className={s.hintMuted}>{notWiredReason ?? '아직 집계할 수 없습니다.'}</span>
      ) : hint ? (
        <span className={hintTone === 'accent' ? s.hintAccent : s.hintMuted}>{hint}</span>
      ) : null}
    </>
  );

  if (href && value !== null) {
    return (
      <Link href={href} className={`${s.tile} ${s.link}`}>
        {body}
      </Link>
    );
  }
  return <div className={s.tile}>{body}</div>;
}
