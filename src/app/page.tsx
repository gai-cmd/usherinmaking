import type { Metadata } from 'next';
import { HOME } from '@/app/[locale]/home-content';
import { META as LOCATION_META } from '@/app/[locale]/location/content';
import { HTML_LANG, LOCALES, LOCALE_LABEL, SITE_URL, homePath, metaDescription, type Locale } from '@/lib/i18n';
import { BRAND_SAME_AS, ldJson, organizationLd } from '@/lib/structured-data';

/**
 * 루트 `/` — 검색 봇 전용 갈림길 페이지.
 *
 * 사람은 미들웨어가 Accept-Language 로 언어 페이지에 보내므로 이 화면을 볼 일이 거의 없다.
 * 검색 봇(특히 네이버)은 루트에서 307 을 받으면 "이 주소엔 제목이 없다" 고 판정하기 때문에,
 * 봇에게는 여기서 제목·설명·OG·hreflang 을 직접 내보낸다. 문장은 각 언어 홈의 메타를
 * 그대로 재사용한다 — 새 문구를 짓지 않는다.
 *
 * 영어 메타를 대표로 쓰는 이유: 미들웨어의 언어 감지 폴백이 en 이라, 언어를 알 수 없는
 * 방문자(=봇)에게 보여 주는 언어와 같아야 일관된다.
 */

const REP: Locale = 'en';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: `${HOME[REP].meta.title} | usherinmaking` },
  description: metaDescription(HOME[REP].meta.description),
  alternates: {
    canonical: SITE_URL,
    languages: {
      ...Object.fromEntries(
        LOCALES.map((l) => [HTML_LANG[l], `${SITE_URL}${homePath(l)}`]),
      ),
      'x-default': SITE_URL,
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'usherinmaking',
    title: HOME[REP].meta.title,
    description: metaDescription(HOME[REP].meta.description),
    url: SITE_URL,
    images: [{ url: `${SITE_URL}/brand/og.png` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME[REP].meta.title,
    description: metaDescription(HOME[REP].meta.description),
  },
};

/** 언어별 홈 메타 — 한국어 홈은 /ko/location 이므로 그쪽 메타를 쓴다. */
function metaFor(l: Locale): { title: string; description: string } {
  if (l === 'ko') {
    return { title: LOCATION_META.title.ko, description: LOCATION_META.description.ko };
  }
  return HOME[l].meta;
}

export default function RootPage() {
  return (
    <html lang={HTML_LANG[REP]}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(organizationLd()) }} />
        <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>usherinmaking</h1>
          <p style={{ color: '#5f584e', lineHeight: 1.8, marginBottom: 28 }}>{HOME[REP].meta.description}</p>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 14 }}>
            {LOCALES.map((l) => {
              const m = metaFor(l);
              return (
                <li key={l}>
                  <a href={homePath(l)} hrefLang={HTML_LANG[l]} lang={l} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    <span style={{ fontSize: 11, letterSpacing: '0.2em', color: '#8a6a3f' }}>{LOCALE_LABEL[l]}</span>
                    <span style={{ display: 'block', fontSize: 16, marginTop: 2 }}>{m.title}</span>
                    <span style={{ display: 'block', fontSize: 13, color: '#5f584e', lineHeight: 1.7 }}>{m.description}</span>
                  </a>
                </li>
              );
            })}
          </ul>
          <p style={{ marginTop: 28, fontSize: 12, color: '#8a6a3f' }}>
            {BRAND_SAME_AS.map((u) => (
              <a key={u} href={u} rel="me" style={{ marginRight: 12, color: 'inherit' }}>
                {u.replace('https://', '').replace(/\/$/, '')}
              </a>
            ))}
          </p>
        </main>
      </body>
    </html>
  );
}
