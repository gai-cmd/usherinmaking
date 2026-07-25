import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/i18n';

// GEO/AEO의 전제는 특별한 AI 전용 파일이 아니라 "크롤 가능·색인 가능"이다.
// 따라서 여기서 하는 일은 관리자·API를 막고 sitemap을 가리키는 것뿐이다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
