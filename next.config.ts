import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // 인스타 수집분을 자사 스토리지로 이관하기 전 임시 참조 (구현 시 자사 도메인으로 교체)
      { protocol: 'https', hostname: 'usherinmaking.vercel.app' },
    ],
  },
  async redirects() {
    return [
      // 구 사이트에서 삭제된 페이지 — RESERVE 자리에 PHOTOGRAPHER
      { source: '/reserve.html', destination: '/ja/photographer', permanent: true },
      { source: '/reserve', destination: '/ja/photographer', permanent: true },
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
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              'font-src https://fonts.gstatic.com',
              // 구글맵 임베드 (아쿠세스 · 문의 페이지)
              'frame-src https://www.google.com https://maps.google.com',
              "connect-src 'self'",
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
