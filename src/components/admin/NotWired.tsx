import type { ReactNode } from 'react';
import s from './NotWired.module.css';

/**
 * "아직 연결되지 않음"을 화면에 명시하는 표시.
 *
 * DB가 붙기 전까지 저장 경로가 없는 화면이 많다. 가짜 성공 토스트 대신 이걸 쓴다.
 * what에는 무엇이 안 되는지, hint에는 무엇이 붙으면 풀리는지를 적는다.
 */
export function NotWired({
  what,
  hint,
  tone = 'info',
}: {
  what: string;
  hint?: ReactNode;
  tone?: 'info' | 'warn';
}) {
  return (
    <p className={`${s.root} ${tone === 'warn' ? s.warn : s.info}`} role="status">
      <span className={s.mark}>미연결</span>
      <span>
        {what}
        {hint ? <span className={s.hint}> — {hint}</span> : null}
      </span>
    </p>
  );
}

/** 쓰기 시도 실패를 그대로 보여 주는 인라인 표시. 성공했다고 쓰지 않기 위한 짝. */
export function WriteResultNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className={`${s.root} ${s.warn}`} role="alert">
      <span className={s.mark}>저장 안 됨</span>
      <span>{message}</span>
    </p>
  );
}
