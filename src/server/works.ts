import { LOCALES } from '@/lib/i18n';
import type { WorkImage } from '@/lib/work-image';
import { isAltComplete, type Photo } from '@/lib/photo-types';
import { listDbPublishedPhotos } from '@/server/photos';
import { RECENT_WORKS } from '@/app/[locale]/home-content';
import { WORKS as STUDIO_WORKS } from '@/app/[locale]/studio/content';
import { WORKS as LOCATION_WORKS } from '@/app/[locale]/location/content';

/**
 * 작품 그리드 3곳(홈·스튜디오·로케이션)의 사진 선별.
 *
 * 관리자 사진 풀(PUBLISHED + 태그)에서 최신순으로 고르되, 그리드 정원을 채우지
 * 못하면 기존 코드 배열을 **통째로** 쓴다. 절반만 DB로 채우면 같은 사진이 두 소스에서
 * 겹칠 수 있고, "DB 빈 상태에서 렌더 불변" 회귀 기준도 깨지기 때문에 전부/전무로 간다.
 *
 * 태그 slug 는 src/content/taxonomy.ts 의 venue 축(studio · location)과 맞춘다.
 */

export type WorksSurface = 'home' | 'studio' | 'location';

/** 스튜디오 폴백은 파일명 배열 + 공용 alt 였다 — 폴백일 때 화면이 지금과 똑같도록 그대로 싼다. */
const STUDIO_FALLBACK: WorkImage[] = STUDIO_WORKS.images.map((src) => ({
  src,
  alt: STUDIO_WORKS.alt,
}));

const SURFACES: Record<WorksSurface, { termSlug: string | null; fallback: WorkImage[] }> = {
  home: { termSlug: null, fallback: RECENT_WORKS },
  studio: { termSlug: 'studio', fallback: STUDIO_FALLBACK },
  location: { termSlug: 'location', fallback: LOCATION_WORKS.images },
};

/** 그리드 셀은 최대 20vw — 800px 파생본이면 충분하다. 파생본이 없으면 원본. */
function displaySrc(photo: Photo): string {
  return (
    photo.variants.webp['800'] ??
    photo.variants.avif['800'] ??
    photo.variants.webp['1600'] ??
    photo.variants.avif['1600'] ??
    photo.originalUrl
  );
}

export async function getWorksImages(surface: WorksSurface): Promise<WorkImage[]> {
  const { termSlug, fallback } = SURFACES[surface];
  const count = fallback.length;
  // PUBLISHED 승격 시 assertPublishable 이 alt 3개 언어를 강제하지만, 승격 뒤 PATCH 로
  // alt 를 비울 수 있어 한 번 더 거른다. 필터를 조회 상한 뒤에 걸면 최신 몇 장의 alt 가
  // 빈 것만으로 그리드 전체가 폴백으로 떨어지므로(GPT 교차 리뷰 P2), 여유분을 가져와
  // 거른 뒤 정원을 채운다. 3배 버퍼 안이 전부 불완전한 극단은 폴백으로 남는다.
  const rows = (await listDbPublishedPhotos(termSlug, count * 3))
    .filter((p) => isAltComplete(p.alt))
    .slice(0, count);
  if (rows.length < count) return fallback;
  return rows.map((p) => ({ src: displaySrc(p), alt: p.alt }));
}

/**
 * 사진 풀 변경(상태·태그·alt)이 작품 그리드에 반영되도록 정적 경로를 재검증한다.
 *
 * page-images.ts 의 revalidateImageSurfaces 와 같은 규칙 — 요청 컨텍스트 밖
 * (스크립트·크론)에서는 revalidatePath 가 던진다. 그 실패로 저장을 되돌리지는 않되
 * revalidated: false 를 그대로 돌려준다. 화면이 "반영됨"이라 말하려면 이 값이 true 여야 한다.
 */
export async function revalidateWorksSurfaces(): Promise<{
  revalidated: boolean;
  routes: string[];
}> {
  const routes = LOCALES.flatMap((l) => [`/${l}`, `/${l}/studio`, `/${l}/location`]);
  try {
    const { revalidatePath } = await import('next/cache');
    for (const r of routes) revalidatePath(r);
    return { revalidated: true, routes };
  } catch {
    return { revalidated: false, routes };
  }
}
