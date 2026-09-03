import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // 인스타 수집분을 자사 스토리지로 이관하기 전 임시 참조 (구현 시 자사 도메인으로 교체)
      { protocol: 'https', hostname: 'usherinmaking.vercel.app' },
      // 관리자 업로드 사진(Vercel Blob) — 이미지 슬롯·작품 그리드가 DB 사진을 그릴 때 필요.
      // 와일드카드(*.public.blob…)는 타인의 스토어까지 이미지 최적화기에 허용해 열린 프록시가
      // 되므로 금지 — 이 프로젝트의 스토어(store_1TWhNaMSDw7uymz2) 서브도메인 하나만 고정한다.
      { protocol: 'https', hostname: '1twhnamsdw7uymz2.public.blob.vercel-storage.com' },
    ],
  },
  async redirects() {
    return [
      // 구 사이트에서 삭제된 페이지 — RESERVE 자리에 PHOTOGRAPHER
      { source: '/reserve.html', destination: '/ja/photographer', permanent: true },
      { source: '/reserve', destination: '/ja/photographer', permanent: true },
      // 요금 페이지 en 세그먼트를 plan 으로 통일하며 남긴 구 주소
      { source: '/en/plans', destination: '/en/plan', permanent: true },
      /*
       * 구 사이트의 한국어 페이지 주소. 네이버 블로그 글 수십 편이 본문에 이 주소를
       * 평문으로 박아 뒀고(우리 저널로 옮겨온 30편 중 12편), 네이버 원본은 우리가
       * 고칠 수 없다. 도메인이 넘어온 뒤에도 그 링크들이 계속 닿도록 /ko 로 넘긴다.
       */
      // 한국어 메인은 갈림길 홈이 아니라 로케이션이다 (i18n HOME_LOCALES).
      // 구 사이트 링크는 리다이렉트를 두 번 타지 않도록 여기서 바로 보낸다.
      { source: '/korean', destination: '/ko/location', permanent: true },
      { source: '/korean/:path*', destination: '/ko/:path*', permanent: true },
      { source: '/ko', destination: '/ko/location', permanent: true },
      /*
       * 한국어 스튜디오 페이지는 만들지 않는다(STUDIO_LOCALES) — 한국 고객 상품에
       * 스튜디오 플랜이 없기 때문이다. 그동안 색인됐거나 공유된 주소가 404 로 떨어지지
       * 않도록 로케이션으로 넘긴다. 구 주소 리다이렉트(/korean/*)가 여기로 이어질 수도 있다.
       */
      { source: '/ko/studio', destination: '/ko/location', permanent: true },
      /*
       * 촬영 종류 필터 통합(2026-08) — 본식 전 웨딩 · 리마인드 웨딩 · 셀프 웨딩을
       * 'wedding' 하나로 합쳤다. 갤러리 필터는 쿼리스트링이 아니라 경로이므로
       * 사라진 슬러그가 곧 죽은 주소가 된다. 앞(장소)·뒤(세트/계절) 세그먼트가
       * 붙는 조합까지 네 가지 모양을 모두 넘긴다.
       */
      ...['remind-wedding', 'self-wedding'].flatMap((old) => [
        {
          source: `/:locale/gallery/${old}`,
          destination: '/:locale/gallery/wedding',
          permanent: true,
        },
        {
          source: `/:locale/gallery/${old}/:mood`,
          destination: '/:locale/gallery/wedding/:mood',
          permanent: true,
        },
        {
          source: `/:locale/gallery/:place/${old}`,
          destination: '/:locale/gallery/:place/wedding',
          permanent: true,
        },
        {
          source: `/:locale/gallery/:place/${old}/:mood`,
          destination: '/:locale/gallery/:place/wedding/:mood',
          permanent: true,
        },
      ]),
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          {
            key: 'Content-Security-Policy',
            // @MX:DEBT: script-src에 'unsafe-inline' 유지 — 구 정적 사이트보다 약해진 지점
            // @MX:CEILING: Next.js 부트스트랩 인라인 스크립트를 허용해야 페이지가 동작한다
            // @MX:UPGRADE: middleware에서 nonce를 발급해 'strict-dynamic'으로 전환.
            //   단 nonce는 전 페이지를 동적 렌더링으로 만들므로, 정적 마케팅 페이지의
            //   캐시 이득과 저울질한 뒤 결정할 것.
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'self'",
              "form-action 'self'",
              "img-src 'self' data: blob: https:",
              // 릴스 mp4 는 자사 Blob 스토어에서만 재생한다
              "media-src 'self' https://1twhnamsdw7uymz2.public.blob.vercel-storage.com",
              // dev 는 소스맵·HMR 이 eval 을 쓴다 — 막으면 하이드레이션이 죽어
              // 클릭이 무반응이 된다(로컬 전용, 프로덕션 헤더에는 붙지 않는다).
              // GA4 태그는 googletagmanager 에서 내려온다 — 'self' 만으로는 브라우저가
              // 스크립트 로드를 거부해서, 태그를 심어도 수집이 한 건도 일어나지 않는다.
              `script-src 'self' 'unsafe-inline' https://*.googletagmanager.com${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
              // 애플 시스템 서체를 쓰므로 외부 폰트 도메인을 열 필요가 없다
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              // 구글맵 임베드 (아쿠세스 · 문의 페이지)
              'frame-src https://www.google.com https://maps.google.com',
              // 수집 비콘(/g/collect)이 나가는 곳. script-src 만 열고 여기를 닫아두면
              // 스크립트는 뜨는데 히트가 전송되지 않아 여전히 "수신된 데이터 없음"이 된다.
              "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // 관리자는 색인 대상이 아니다
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
