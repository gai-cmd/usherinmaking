import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin';
import { signOut } from '@/auth';
import { checkAdminPageAccess } from '@/server/auth';
import s from '../layout.module.css';

/**
 * 관리자 화면은 절대 정적으로 굳히지 않는다.
 *
 * SSO 환경변수 없이 빌드하면 게이트가 세션을 읽기 전에 빠져나가고, 그러면 Next가
 * 이 경로를 정적 페이지로 프리렌더한다. 그 상태로 환경변수를 채워 배포하면
 * 요청마다 게이트가 도는 대신 빌드 시점의 HTML이 그대로 나가 인증이 무력화된다.
 */
export const dynamic = 'force-dynamic';

/**
 * 관리자 인증 게이트.
 *
 * 로그인 화면(/admin/login)은 이 그룹 바깥에 있으므로 이 게이트에 막히지 않는다.
 * 통과하지 못하면 children을 렌더하지 않고 로그인으로 보낸다 —
 * 서버 컴포넌트가 데이터를 읽기 전에 끊어야 의미가 있다.
 */
export default async function AdminAppLayout({ children }: { children: ReactNode }) {
  const access = await checkAdminPageAccess();

  if (!access.allowed) {
    redirect('/admin/login');
  }

  async function signOutAdmin() {
    'use server';
    await signOut({ redirectTo: '/admin/login' });
  }

  return (
    <div className={s.shell}>
      <AdminNav />
      <div className={s.main}>
        {!access.guarded ? (
          <p className={s.unguarded} role="alert">
            <strong>인증 미설정</strong> {access.reason}
          </p>
        ) : (
          <div className={s.session}>
            <span className={s.sessionEmail}>{access.email}</span>
            <form action={signOutAdmin}>
              <button type="submit" className={s.signOut}>
                로그아웃
              </button>
            </form>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
