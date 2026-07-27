'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * 마지막 안전망. 루트 레이아웃 자체가 깨졌거나 아래쪽 경계가 잡지 못한 오류가 여기까지 온다.
 *
 * 이 자리에서는 레이아웃이 살아 있다고 가정할 수 없다. 로케일도 알 수 없고 헤더·푸터도 없다.
 * 그래서 root not-found.tsx 와 같은 방식으로 <html>/<body>를 직접 그리고, 세 언어를 한 줄에
 * 나란히 적는다 — 어느 언어 사용자가 보더라도 무슨 일이 일어났는지는 읽히게 하려는 것이다.
 *
 * 링크는 절대 경로 하나만 둔다. 로케일을 모르는 상태에서 path() 로 경로를 만들면
 * 틀린 곳으로 보낼 수 있고, 미들웨어가 브라우저 언어를 보고 알아서 로케일을 붙여 준다.
 *
 * 오류 원문은 여기서도 내보내지 않는다. digest 만 보여준다.
 */
export default function GlobalError({
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
    <html lang="ja">
      <body>
        <meta name="robots" content="noindex, nofollow" />
        <main
          style={{
            minHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            padding: '80px 18px',
            textAlign: 'center',
          }}
        >
          <p className="u-label">ERROR</p>
          <h1 className="u-display">Something went wrong</h1>
          <p className="u-body">
            問題が発生しました / Something went wrong / 문제가 발생했습니다
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <button type="button" onClick={reset} className="u-btn-dark" data-tap>
              Try again
            </button>
            {/*
              여기만 Link 를 쓰지 않는다. 이 화면이 떴다는 것은 루트 레이아웃이 무너졌다는
              뜻이고, Link 의 클라이언트 이동은 그 깨진 트리 안에 그대로 머문다.
              문서를 통째로 다시 받아야 복구된다 — 하드 내비게이션이 목적이다.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="u-btn" data-tap>
              HOME
            </a>
          </div>

          {error.digest && (
            <p className="u-meta">
              Reference — <span style={{ wordBreak: 'break-all' }}>{error.digest}</span>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
