import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { checkAdminPageAccess, isAdminAuthConfigured } from '@/server/auth';
import s from './page.module.css';

export const metadata: Metadata = {
  title: '로그인 · usherinmaking 관리자',
  robots: { index: false, follow: false },
};

/** Auth.js가 돌려주는 error 코드를 사람이 읽을 수 있는 문장으로. */
const ERROR_MESSAGE: Record<string, string> = {
  AccessDenied: '이 구글 계정은 관리자 목록에 없습니다. 등록된 계정으로 다시 시도해 주세요.',
  Verification: '로그인 링크가 만료되었습니다. 다시 시도해 주세요.',
  Configuration: '로그인 설정에 문제가 있습니다. 환경변수를 확인해 주세요.',
  OAuthAccountNotLinked: '이미 다른 방식으로 연결된 계정입니다.',
};

/**
 * 관리자 로그인.
 *
 * 인증 게이트가 있는 (app) 그룹 바깥에 있어서, 로그인하지 않은 사람도 이 화면에 닿는다.
 * 이미 통과한 사람은 관리자 홈으로 돌려보낸다 — 로그인 화면에 머무를 이유가 없다.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await checkAdminPageAccess();
  if (access.allowed && access.guarded) redirect('/admin');

  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGE[error] ?? '로그인에 실패했습니다.') : null;
  const configured = isAdminAuthConfigured();

  async function signInWithGoogle() {
    'use server';
    await signIn('google', { redirectTo: '/admin' });
  }

  return (
    <div className={s.root}>
      <h1 className={s.title}>usherinmaking 관리자</h1>

      {message ? (
        <p className={s.error} role="alert">
          {message}
        </p>
      ) : (
        <p className={s.body}>
          {configured
            ? '등록된 구글 계정으로 로그인해 주세요.'
            : access.allowed
              ? '구글 SSO가 설정되지 않아 인증 없이 열려 있습니다. 개발 환경에서만 허용되는 상태입니다.'
              : access.reason}
        </p>
      )}

      {configured ? (
        <>
          <form action={signInWithGoogle}>
            <button type="submit" className={s.button}>
              <GoogleMark />
              구글 계정으로 로그인
            </button>
          </form>
          <p className={s.note}>
            등록된 구글 계정만 들어올 수 있습니다. 계정 추가가 필요하면 사이트 운영자에게 요청해
            주세요.
          </p>
        </>
      ) : (
        <p className={s.note}>
          AUTH_GOOGLE_ID · AUTH_GOOGLE_SECRET · AUTH_SECRET · ADMIN_ALLOWED_EMAILS 를 설정하면 이
          자리에 구글 로그인 버튼이 나타납니다.
        </p>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
