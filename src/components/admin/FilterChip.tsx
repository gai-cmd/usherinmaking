import Link from 'next/link';
import type { ReactNode } from 'react';
import s from './FilterChip.module.css';

export type FilterChipProps = {
  href: string;
  active?: boolean;
  children: ReactNode;
  /** 우측에 붙는 건수 */
  count?: number;
};

/**
 * 필터 칩. 상태를 클라이언트에 두지 않고 URL 쿼리로 옮긴다 —
 * 새로고침·공유·뒤로가기가 그냥 동작하고, 목록 필터링은 서버가 한다.
 */
export function FilterChip({ href, active = false, children, count }: FilterChipProps) {
  return (
    <Link href={href} className={active ? `${s.chip} ${s.active}` : s.chip} data-tap>
      {children}
      {typeof count === 'number' ? <span className={s.count}>{count}</span> : null}
    </Link>
  );
}
