import Link from 'next/link';
import { LOCALES, LOCALE_LABEL, path } from '@/lib/i18n';
import './globals.css';

/**
 * 로케일 밖에서 걸린 404 (예: /foo). 여기서는 언어를 알 수 없고
 * 헤더·푸터도 없는 자리이므로 최소한만 보여주고 각 언어 홈으로 보낸다.
 * 루트 레이아웃이 통과만 시키므로 <html>/<body>는 이 파일이 직접 그린다.
 */
export default function RootNotFound() {
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
          <p className="u-label">404</p>
          <h1 className="u-display">Page not found</h1>
          <p className="u-body">
            ページが見つかりません / Page not found / 페이지를 찾을 수 없습니다
          </p>
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {LOCALES.map((l) => (
              <Link key={l} href={path(l, 'home')} className="u-btn" hrefLang={l} data-tap>
                {LOCALE_LABEL[l]}
              </Link>
            ))}
          </nav>
        </main>
      </body>
    </html>
  );
}
