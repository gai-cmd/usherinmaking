'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminButton } from '@/components/admin';

type Result = {
  run?: { created?: number; failed?: number };
  remaining?: number;
  error?: { message?: string };
};

/**
 * 드레스 룩북 수동 동기화.
 *
 * 크론은 하루 한 번 돈다 — 새 게시물을 지금 당장 올리고 싶을 때 기다리지 않기 위한 버튼이다.
 * 결과는 문장으로 그대로 보여 준다. 실패를 성공처럼 넘기지 않는다.
 */
export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: 'dress' }),
      });
      const body = (await res.json().catch(() => ({}))) as Result;

      if (!res.ok) {
        setNotice(body.error?.message ?? `동기화에 실패했습니다 (HTTP ${res.status}).`);
        return;
      }

      const created = body.run?.created ?? 0;
      const failed = body.run?.failed ?? 0;
      const remaining = body.remaining ?? 0;
      setNotice(
        created === 0 && failed === 0
          ? '새 게시물이 없습니다.'
          : `신규 ${created}건 수집${failed ? ` · 실패 ${failed}건` : ''}${
              remaining ? ` · 남은 ${remaining}건은 다음 회차` : ''
            }`,
      );
      // 목록은 서버에서 그려진다 — 새로 받은 사진이 보이려면 다시 읽어야 한다.
      router.refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '동기화 요청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {notice && <span aria-live="polite">{notice}</span>}
      <AdminButton onClick={run} disabled={busy}>
        {busy ? '동기화 중…' : '지금 동기화'}
      </AdminButton>
    </>
  );
}
