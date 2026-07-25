import type { DefaultSession } from 'next-auth';

// 허용 목록 통과 여부를 세션과 토큰에 얹는다.
// 화면·라우트가 매번 이메일을 다시 대조하지 않아도 되게 한다.
declare module 'next-auth' {
  interface Session {
    user: { isAdmin: boolean } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isAdmin?: boolean;
  }
}
