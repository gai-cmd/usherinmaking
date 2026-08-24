import Script from 'next/script';

/**
 * GA4 태그. NEXT_PUBLIC_GA4_ID (G-XXXXXXXXXX) 가 설정된 경우에만 로드된다 —
 * 미설정이면 아무것도 렌더하지 않으므로 배포해 두고 ID 만 나중에 꽂으면 된다.
 * afterInteractive 전략이라 페이지 표시 속도에는 영향이 없다.
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA4_ID;
  if (!id) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
