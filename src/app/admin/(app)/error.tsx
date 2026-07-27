'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import s from './state.module.css';

/**
 * 관리자 화면 오류 경계.
 *
 * 관리자 페이지는 매 요청마다 DB를 조회하므로 공개 사이트보다 오류가 날 여지가 크다.
 * 경계가 없으면 이 오류가 global-error 까지 올라가 레이아웃째 날아가고, 그러면
 * 운영자는 어느 화면에서 무엇이 실패했는지 알 수 없게 된다. 여기서 잡아 두면
 * 네비게이션은 살아 있는 채로 본문만 오류 상태가 된다.
 *
 * 관리자에게도 오류 원문은 보여주지 않는다. 운영자라 해도 화면에 스택이 뜨면
 * 어깨너머로 새어 나갈 수 있고, 추적에 필요한 것은 digest 하나면 충분하다.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={s.root} role="alert">
      <p className={s.label}>오류</p>
      <h1 className={s.title}>화면을 불러오지 못했습니다</h1>
      <p className={s.body}>
        데이터를 읽는 중에 문제가 생겼습니다. 다시 시도하면 대부분 해결됩니다.
        <br />
        반복되면 아래 식별자를 남겨 두세요 — 서버 로그의 같은 값과 대조해 원인을 찾을 수 있습니다.
      </p>

      <div className={s.actions}>
        <button type="button" onClick={reset} className={s.btn}>
          다시 시도
        </button>
        <Link href="/admin" className={s.btn}>
          대시보드로
        </Link>
      </div>

      <p className={s.meta}>
        오류 식별자 — {error.digest ?? '기록되지 않음'}
      </p>
    </div>
  );
}
