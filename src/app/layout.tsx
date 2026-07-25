import type { ReactNode } from 'react';

// 모든 페이지는 /[locale] 아래에 있으므로 <html>/<body>는 로케일 레이아웃이 렌더한다.
// 루트는 통과만 시킨다 (Next.js i18n 라우팅 표준 패턴).
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
