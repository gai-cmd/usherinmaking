import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * 관리자 인증 — 구글 SSO.
 *
 * 비밀번호를 우리가 보관하지 않는다는 것이 이 방식의 요점이다.
 * 구글에 로그인할 수 있다고 해서 관리자가 되는 것은 아니고,
 * 아래 허용 목록에 있는 계정만 통과한다.
 *
 * 허용 목록을 환경변수에 두는 이유:
 * DB에 두면 관리자 화면을 통해 목록 자체를 바꿀 수 있게 되어, 세션 하나가 털렸을 때
 * 공격자가 스스로를 멤버로 추가할 수 있다. 환경변수는 배포 권한이 있어야 바꿀 수 있으므로
 * 애플리케이션 침해와 권한 부여가 분리된다.
 * (DB 연결 후에도 AdminMember 테이블은 "표시용 목록"이고, 통과 판정은 여기가 유지한다.)
 */

/** 쉼표로 구분한 허용 이메일. 대소문자와 공백은 무시한다. */
function allowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.toLowerCase());
}

/**
 * 구글 자격 증명 + 세션 서명키 + 허용 목록이 모두 갖춰졌는지.
 * AUTH_SECRET까지 함께 보는 이유: 빠지면 로그인 시점에 불투명한 런타임 오류가 나는데,
 * 그보다는 "설정되지 않았다"고 화면에서 먼저 말해 주는 편이 고치기 쉽다.
 */
export function isSsoConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET &&
      process.env.AUTH_SECRET &&
      allowedEmails().length > 0,
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // 계정 선택 화면을 항상 띄운다 — 공용 기기에서 이전 계정으로 조용히 들어가는 것을 막는다.
      authorization: { params: { prompt: 'select_account' } },
    }),
  ],

  // DB 어댑터 없이 JWT 세션을 쓴다. 세션 테이블이 없으므로 DB 연결 전에도 동작한다.
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },

  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },

  callbacks: {
    /**
     * 여기가 실제 관문이다.
     * 구글이 검증한 이메일이면서 허용 목록에 있어야만 세션이 만들어진다.
     */
    signIn({ profile }) {
      // 구글이 소유를 확인하지 않은 주소는 신뢰하지 않는다.
      if (profile?.email_verified === false) return false;
      return isAllowedAdminEmail(profile?.email);
    },

    /** 토큰이 재발급될 때마다 다시 확인한다 — 멤버에서 빠지면 다음 요청부터 막힌다. */
    jwt({ token }) {
      token.isAdmin = isAllowedAdminEmail(token.email);
      return token;
    },

    session({ session, token }) {
      session.user.isAdmin = token.isAdmin === true;
      return session;
    },
  },

  trustHost: true,
});
