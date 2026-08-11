import type { MetadataRoute } from 'next';
import { JOURNAL_LOCALES, LOCALES, SITE_URL, path, type Locale, type PageKey } from '@/lib/i18n';

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

/** 그 페이지가 실제로 존재하는 언어. 촬영후기만 한국어 전용이다. */
function localesFor(key: PageKey): readonly Locale[] {
  return key === 'journal' ? JOURNAL_LOCALES : LOCALES;
}

/** 페이지가 있는 언어끼리만 hreflang 상호 지정 */
function withAlternates(key: PageKey, ...rest: string[]) {
  const languages: Record<string, string> = {};
  for (const l of localesFor(key)) languages[l] = `${SITE_URL}${path(l, key, ...rest)}`;
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const { key, priority } of PAGES) {
    for (const locale of localesFor(key)) {
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
  entries.push(...(await photoEntries(now)));
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

/**
 * 작품 상세(/gallery/g/<slug>). 필터 조합만 싣던 동안 이 페이지들은 사이트맵에 없었다 —
 * 목록에서 링크는 되지만, 사진이 늘어날수록 발견이 늦어지고 색인에서 누락된다.
 * 사진은 언어를 가리지 않으므로(저널과 달리) 모든 로케일을 서로 hreflang 으로 묶는다.
 */
async function photoEntries(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    // 공개 화면과 같은 곳을 본다. 사이트맵만 다른 소스를 보면 화면과 어긋난다.
    const { getPublishedPhotos, shootCovers } = await import('@/server/photos-content');
    const all = await getPublishedPhotos();
    if (!Array.isArray(all)) return [];

    // 촬영 묶음마다 대표컷 하나만 싣는다. 캐러셀 사진들은 본문(게시물 캡션)이 같아서
    // 전부 실으면 같은 글을 여러 주소로 제출하는 셈이 된다 — 상세 페이지의 canonical 도
    // 대표컷을 가리키므로, 사이트맵이 비대표컷을 싣는 것은 그 신호와 어긋나기까지 한다.
    // 비대표컷 페이지는 여전히 목록에서 링크되어 사람도 검색엔진도 닿을 수 있다.
    const photos = shootCovers(all);

    const out: MetadataRoute.Sitemap = [];
    for (const photo of photos) {
      if (!photo?.slug) continue;
      const languages: Record<string, string> = {};
      for (const l of LOCALES) languages[l] = `${SITE_URL}${path(l, 'gallery', 'g', photo.slug)}`;

      // 촬영일이 있으면 그것이 이 페이지의 갱신 신호다. 매 빌드 now 로 찍으면
      // 모든 사진이 "방금 바뀐 것"처럼 보여 재크롤 우선순위 정보가 사라진다.
      const lastModified = photo.takenAt ? new Date(photo.takenAt) : now;

      for (const locale of LOCALES) {
        out.push({
          url: `${SITE_URL}${path(locale, 'gallery', 'g', photo.slug)}`,
          lastModified,
          changeFrequency: 'monthly',
          priority: 0.4,
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
      getJournalContentPosts?: () => Promise<
        { slug: string; locale: string; publishedAt?: string; updatedAt?: string }[]
      >;
    };
    const posts = await mod.getJournalContentPosts?.();
    if (!Array.isArray(posts)) return [];

    // 촬영후기는 한국어에만 둔다(JOURNAL_LOCALES). 다른 언어판 행이 DB 에 남아 있어도
    // 사이트맵에는 싣지 않는다 — 메뉴에서 뺀 페이지를 검색엔진에 제출하면 앞뒤가 맞지 않는다.
    const known = posts.filter((p) => (JOURNAL_LOCALES as readonly string[]).includes(p.locale));

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
        // 갱신일이 있으면 그것이 정답이다. 발행일을 쓰면 나중에 고친 글이 옛날 글로 보여
        // 재크롤 우선순위가 밀린다. 둘 다 없는 시드 글만 현재 시각으로 둔다.
        lastModified: p.updatedAt ? new Date(p.updatedAt) : p.publishedAt ? new Date(p.publishedAt) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.4,
        alternates: { languages },
      };
    });
  } catch {
    return [];
  }
}
