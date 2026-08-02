import type { MetadataRoute } from 'next';
import { LOCALES, SITE_URL, path, type Locale, type PageKey } from '@/lib/i18n';

// 갤러리 필터가 쿼리스트링이 아니라 경로이므로, 필터 조합 하나하나가 독립 URL이다.
// 여기서 누락되면 그 조합은 색인되지 않는다.
const PAGES: { key: PageKey; priority: number }[] = [
  { key: 'home', priority: 1.0 },
  { key: 'studio', priority: 0.9 },
  { key: 'location', priority: 0.9 },
  { key: 'plan', priority: 0.8 },
  { key: 'dress', priority: 0.7 },
  { key: 'photographer', priority: 0.7 },
  { key: 'gallery', priority: 0.7 },
  { key: 'journal', priority: 0.6 },
  { key: 'contact', priority: 0.8 },
  { key: 'privacy', priority: 0.2 },
  { key: 'tokushoho', priority: 0.2 },
];

/** 모든 페이지에 hreflang 상호 지정 + x-default */
function withAlternates(key: PageKey, ...rest: string[]) {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${SITE_URL}${path(l, key, ...rest)}`;
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const { key, priority } of PAGES) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}${path(locale, key)}`,
        lastModified: now,
        changeFrequency: key === 'home' || key === 'gallery' ? 'weekly' : 'monthly',
        priority,
        alternates: { languages: withAlternates(key) },
      });
    }
  }

  // 갤러리 필터 조합과 작품/저널 상세는 각 콘텐츠 모듈에서 읽어 확장한다.
  // 모듈이 아직 없거나 형태가 달라도 사이트맵 생성 자체는 실패하지 않아야 한다.
  entries.push(...(await galleryFilterEntries(now)));
  entries.push(...(await journalEntries(now)));

  return entries;
}

async function galleryFilterEntries(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    // 필터 조합은 taxonomy 모듈이 정한다. 여기서 축 구조를 다시 추측하면 두 곳이 어긋난다.
    const { staticFilterCombinations, findTerm } = await import('@/content/taxonomy');

    // term은 번역이 있는 로케일에서만 노출된다. 번역이 없는 로케일을 hreflang에 넣으면
    // 존재하지 않는 URL을 가리키게 되므로, 조합마다 실제로 사는 로케일만 상호 지정한다.
    const localesWith = (segments: string[]) =>
      LOCALES.filter((l) => segments.every((slug) => findTerm(slug, l)));

    const out: MetadataRoute.Sitemap = [];
    for (const locale of LOCALES) {
      for (const segments of staticFilterCombinations(locale)) {
        const languages: Record<string, string> = {};
        for (const l of localesWith(segments)) {
          languages[l] = `${SITE_URL}${path(l, 'gallery', ...segments)}`;
        }

        out.push({
          url: `${SITE_URL}${path(locale, 'gallery', ...segments)}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.5,
          alternates: { languages },
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function journalEntries(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    // 공개 화면과 같은 곳을 본다 — 사이트맵만 코드 시드를 보면 관리자·취입 글이
    // 사이트에는 떠 있는데 사이트맵에는 없어, 검색엔진이 새 글을 발견하지 못한다.
    const mod = (await import('@/server/journal-content')) as {
      getJournalContentPosts?: () => Promise<{ slug: string; locale: string; publishedAt?: string }[]>;
    };
    const posts = await mod.getJournalContentPosts?.();
    if (!Array.isArray(posts)) return [];

    const known = posts.filter((p) => (LOCALES as readonly string[]).includes(p.locale));

    // 같은 slug의 여러 언어판은 서로 hreflang으로 묶어야 한다.
    // 묶지 않으면 같은 글의 3개 언어판이 서로 경쟁하는 별개 페이지로 취급된다.
    // 단, 글은 slug+locale 단위이므로 없는 언어판은 넣지 않는다.
    const localesBySlug = new Map<string, Locale[]>();
    for (const p of known) {
      const list = localesBySlug.get(p.slug) ?? [];
      list.push(p.locale as Locale);
      localesBySlug.set(p.slug, list);
    }

    return known.map((p) => {
      const languages: Record<string, string> = {};
      for (const l of localesBySlug.get(p.slug) ?? []) {
        languages[l] = `${SITE_URL}${path(l, 'journal', p.slug)}`;
      }

      return {
        url: `${SITE_URL}${path(p.locale as Locale, 'journal', p.slug)}`,
        lastModified: p.publishedAt ? new Date(p.publishedAt) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.4,
        alternates: { languages },
      };
    });
  } catch {
    return [];
  }
}
