import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin';
import { checkAdminPageAccess } from '@/server/auth';
import '../globals.css';
import './admin-tokens.css';
import s from './layout.module.css';

// 관리자는 [locale] 밖에 있으므로 <html>/<body>를 직접 렌더한다(루트 레이아웃은 통과만 시킨다).
// 관리자 UI 언어는 한국어 고정. 편집 대상 콘텐츠는 원래 언어를 유지한다.
export const metadata: Metadata = {
  title: 'usherinmaking 관리자',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await checkAdminPageAccess();

  return (
    <html lang="ko">
      <body className="uim-admin">
        {access.allowed ? (
          <div className={s.shell}>
            <AdminNav />
            <div className={s.main}>
              {!access.guarded ? (
                <p className={s.unguarded} role="alert">
                  <strong>인증 미설정</strong> {access.reason}
                </p>
              ) : null}
              {children}
            </div>
          </div>
        ) : (
          // 차단 시에는 자식을 렌더하지 않는다 — 서버 컴포넌트가 데이터를 읽기 전에 끊긴다.
          <div className={s.locked}>
            <h1 className={s.lockedTitle}>usherinmaking 관리자</h1>
            <p className={s.lockedBody}>{access.reason}</p>
          </div>
        )}
      </body>
    </html>
  );
}
