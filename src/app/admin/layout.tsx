import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../globals.css';
import './admin-tokens.css';

// 관리자는 [locale] 밖에 있으므로 <html>/<body>를 직접 렌더한다(루트 레이아웃은 통과만 시킨다).
// 관리자 UI 언어는 한국어 고정. 편집 대상 콘텐츠는 원래 언어를 유지한다.
//
// 인증 게이트는 여기가 아니라 (app)/layout.tsx 에 있다.
// 로그인 화면이 게이트 안쪽에 있으면 자기 자신에게 막히기 때문이다.
export const metadata: Metadata = {
  title: 'usherinmaking 관리자',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="uim-admin">{children}</body>
    </html>
  );
}
