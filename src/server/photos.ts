// 사진 저장소 계층.
//
// 읽기는 아래 시드에서, 쓰기는 전부 NotImplementedError로 막아 둔다.
// 함수 시그니처와 필드 이름은 prisma/schema.prisma의 Photo / Term / PhotoTerm과 맞춰 두었으므로
// 시드 읽기를 Prisma 호출로 바꾸는 것만으로 드롭인 교체가 된다.
//
// TODO(seed): src/content/photos.ts · src/content/taxonomy.ts 가 생기면 SEED_PHOTOS / SEED_TAXONOMIES를
// 그쪽 import로 교체한다. 작성 시점에 두 파일이 없어 타입을 여기에 로컬 정의했다.

import { AppError, NotImplementedError, NotFoundError } from './errors';
import { isLowRes, type VariantMap } from '@/lib/image-contract';
import { LOCALES, type Locale } from '@/lib/i18n';
import {
  isAltComplete,
  missingAltLocales,
  type AiSuggestion,
  type Localized,
  type Photo,
  type PhotoCounts,
  type PhotoFilter,
  type PhotoStatus,
  type PhotoTermRef,
  type TaxonomyOption,
} from '@/lib/photo-types';
import { PHOTOS as CONTENT_PHOTOS } from '@/content/photos';
import { TAXONOMIES, TERMS } from '@/content/taxonomy';

/* ============================ 타입 (schema.prisma 대응) ============================ */

export * from '@/lib/photo-types';

/** UNSORTED · ARCHIVED는 프론트에 절대 나가지 않는다. 프론트 조회는 이 함수만 쓴다. */
export function isPubliclyVisible(photo: Pick<Photo, 'status'>): boolean {
  return photo.status === 'PUBLISHED';
}

/* ============================ 시드 ============================ */
//
// 갤러리 시드(src/content/photos.ts)를 관리자 스키마 모양으로 변환해서 쓴다.
// 관리자가 전시로 올린 사진이 곧 프론트에 나오는 그 사진이어야 하므로 시드를 둘로 두지 않는다.
//
// 다만 content 쪽 Photo는 프론트 표시용이라 관리자 전용 필드(igMediaId · variants · lowRes ·
// aiSuggestion · isCover)가 없다. 없는 값은 지어내지 않고 아래 규칙으로 채운다:
//   - variants: 빈 맵 (파생본이 아직 생성되지 않았다)
//   - lowRes: width/height로 그대로 판정한다. 시드의 치수는 public/images 실제 파일과 일치하고
//             (확인함) 전 건이 장변 2000px 미만이므로, 이 자산들은 실제로 저해상도가 맞다.
//             경고를 끄면 진짜 문제를 가리는 셈이라 끄지 않는다 — 원본 재업로드가 필요한 상태다.
//   - aiSuggestion: null (수집 단계를 거치지 않은 자산)
// 수집 큐(INGEST_QUEUE)는 인스타 수집 경로를 대신할 관리자 전용 시드다.

const ZERO_ALT: Localized = { ja: '', en: '', ko: '' };

/** content의 Partial 라벨을 3개 언어로 채운다. 없는 언어는 ja → slug 순으로 대체. */
function fillLabel(label: Partial<Record<Locale, string>>, fallback: string): Localized {
  return {
    ja: label.ja ?? fallback,
    en: label.en ?? label.ja ?? fallback,
    ko: label.ko ?? label.ja ?? fallback,
  };
}

const SEED_TAXONOMIES: TaxonomyOption[] = TAXONOMIES.map((tx) => ({
  id: tx.key,
  key: tx.key,
  label: tx.label,
  terms: TERMS.filter((t) => t.taxonomy === tx.key)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((t) => ({ id: t.key, slug: t.slug, label: fillLabel(t.label, t.slug) })),
}));

/** term slug → 조인 결과. content 쪽 photo.terms가 slug 배열이라 여기서 해석한다. */
function termRefBySlug(slug: string): PhotoTermRef | null {
  const term = TERMS.find((t) => t.slug === slug);
  if (!term) return null;
  return {
    taxonomyId: term.taxonomy,
    taxonomyKey: term.taxonomy,
    termId: term.key,
    slug: term.slug,
    label: fillLabel(term.label, term.slug),
  };
}

function termRefByKey(key: string): PhotoTermRef | null {
  const term = TERMS.find((t) => t.key === key);
  return term ? termRefBySlug(term.slug) : null;
}

/** content 시드(YYYY-MM-DD)는 JST 기준 촬영일이다. */
function jstDate(day: string): Date {
  return new Date(`${day}T09:00:00+09:00`);
}

/** 갤러리 시드 → 관리자 스키마. */
function fromContent(p: (typeof CONTENT_PHOTOS)[number]): Photo {
  const takenAt = jstDate(p.takenAt);
  return {
    id: p.id,
    igMediaId: null,
    originalUrl: p.src,
    variants: { avif: {}, webp: {} },
    width: p.width,
    height: p.height,
    caption: null,
    takenAt,
    status: p.status,
    lowRes: isLowRes(p.width, p.height),
    alt: p.alt,
    story: p.story,
    aiSuggestion: null,
    isCover: false,
    terms: p.terms.map(termRefBySlug).filter((t): t is PhotoTermRef => t !== null),
    createdAt: takenAt,
    updatedAt: takenAt,
  };
}

/* ---------- 수집 큐 (관리자 전용 시드) ---------- */
//
// TODO(seed): 인스타 수집 크론이 붙으면 이 배열은 통째로 사라진다.
// 선별 화면이 실제로 처리할 대상이 있어야 검증이 되므로, 미선별 상태의 자산을 여기에 둔다.
// width/height는 원본 픽셀 기준이라 저해상도 판정(isLowRes)이 그대로 유효하다.

type QueueInput = {
  id: string;
  file: string;
  width: number;
  height: number;
  takenAt: string;
  caption?: string;
  alt?: Localized;
  /** [term key, 확신도] */
  ai?: [string, number][];
  /** 수동 업로드는 인스타 id가 없다 */
  manual?: boolean;
};

const INGEST_QUEUE: QueueInput[] = [
  {
    id: 'ig-0766',
    file: '0050ef5841c8d683.jpg',
    width: 4032,
    height: 3024,
    takenAt: '2026-06-14',
    caption: '白のスタジオで、朝の光',
    ai: [
      ['place-studio', 0.92],
      ['mood-arch-window', 0.88],
    ],
  },
  {
    id: 'ig-0695',
    file: '0051a0b1de106d89.jpg',
    width: 3024,
    height: 4032,
    takenAt: '2026-06-12',
    ai: [
      ['place-studio', 0.96],
      ['mood-dress-room', 0.91],
    ],
  },
  {
    id: 'ig-0a12',
    file: '00eaf9577f08d529.jpg',
    width: 4032,
    height: 2688,
    takenAt: '2026-06-09',
    ai: [
      ['place-location', 0.97],
      ['session-wedding', 0.89],
    ],
  },
  {
    id: 'ig-0b31',
    file: '0170d5a0e7228d65.jpg',
    width: 2048,
    height: 1365,
    takenAt: '2026-06-08',
    ai: [['place-location', 0.74]],
  },
  {
    id: 'ig-0746',
    file: '02c9c4f3dac1040e.jpg',
    width: 4032,
    height: 3024,
    takenAt: '2026-06-05',
    ai: [
      ['place-studio', 0.81],
      ['mood-vintage', 0.77],
    ],
  },
  {
    id: 'ig-0747',
    file: '02fb78524fa5bc2e.jpg',
    width: 3024,
    height: 4032,
    takenAt: '2026-06-03',
    ai: [['place-studio', 0.86]],
  },
  {
    id: 'ig-0c55',
    file: '0311d30740475506.jpg',
    width: 4032,
    height: 2688,
    takenAt: '2026-05-30',
    ai: [
      ['place-location', 0.88],
      ['session-family', 0.84],
    ],
  },
  {
    // 인스타 저장본이라 장변 2000px 미만 — 원본 교체 대상
    id: 'ig-0698',
    file: '06373e83a2698794.jpg',
    width: 1080,
    height: 1350,
    takenAt: '2026-05-28',
    ai: [['place-studio', 0.79]],
  },
  {
    id: 'up-0001',
    file: '0b6debff684b6199.jpg',
    width: 5472,
    height: 3648,
    takenAt: '2026-06-15',
    manual: true,
    // 수동 업로드도 alt 초안 없이 같은 미선별 큐로 들어온다
  },
];

function fromQueue(q: QueueInput): Photo {
  const takenAt = jstDate(q.takenAt);
  return {
    id: q.id,
    igMediaId: q.manual ? null : `ig_${q.id}`,
    originalUrl: `/images/up/${q.file}`,
    variants: { avif: {}, webp: {} },
    width: q.width,
    height: q.height,
    caption: q.caption ?? null,
    takenAt,
    status: 'UNSORTED',
    lowRes: isLowRes(q.width, q.height),
    alt: q.alt ?? ZERO_ALT,
    story: null,
    aiSuggestion:
      q.ai?.map(([termKey, score]) => {
        const ref = termRefByKey(termKey);
        return {
          taxonomyId: ref?.taxonomyId ?? 'unknown',
          termId: termKey,
          label: ref?.label.ko ?? termKey,
          score,
        };
      }) ?? null,
    isCover: false,
    terms: [],
    createdAt: takenAt,
    updatedAt: takenAt,
  };
}

const SEED_PHOTOS: Photo[] = [...INGEST_QUEUE.map(fromQueue), ...CONTENT_PHOTOS.map(fromContent)];

/* ============================ 읽기 ============================ */

function hasNoTerms(p: Photo): boolean {
  return p.terms.length === 0;
}

export async function listPhotos(filter: PhotoFilter = {}): Promise<Photo[]> {
  // TODO(prisma): prisma.photo.findMany({ where, orderBy, include: { terms: { include: { term: true } } } })
  let rows = SEED_PHOTOS.slice();

  if (filter.status) rows = rows.filter((p) => p.status === filter.status);
  if (filter.untagged) rows = rows.filter(hasNoTerms);
  if (filter.lowRes) rows = rows.filter((p) => p.lowRes);
  if (filter.missingAlt) rows = rows.filter((p) => !isAltComplete(p.alt));

  rows.sort((a, b) =>
    filter.sort === 'oldest'
      ? a.takenAt.getTime() - b.takenAt.getTime()
      : b.takenAt.getTime() - a.takenAt.getTime(),
  );
  return rows;
}

export async function getPhoto(id: string): Promise<Photo | null> {
  // TODO(prisma): prisma.photo.findUnique({ where: { id }, include: { terms: ... } })
  return SEED_PHOTOS.find((p) => p.id === id) ?? null;
}

export async function countPhotos(): Promise<PhotoCounts> {
  // TODO(prisma): prisma.photo.groupBy({ by: ['status'], _count: true }) + 조건별 count
  const all = SEED_PHOTOS;
  const publishedByPlace: Record<string, number> = {};
  for (const p of all) {
    if (p.status !== 'PUBLISHED') continue;
    const place = p.terms.find((t) => t.taxonomyKey === 'place');
    const key = place ? place.label.en : 'UNSET';
    publishedByPlace[key] = (publishedByPlace[key] ?? 0) + 1;
  }

  return {
    unsorted: all.filter((p) => p.status === 'UNSORTED').length,
    published: all.filter((p) => p.status === 'PUBLISHED').length,
    archived: all.filter((p) => p.status === 'ARCHIVED').length,
    missingAlt: all.filter((p) => !isAltComplete(p.alt)).length,
    lowRes: all.filter((p) => p.lowRes).length,
    untagged: all.filter(hasNoTerms).length,
    needsAttention: all.filter((p) => !isAltComplete(p.alt) || p.lowRes).length,
    total: all.length,
    publishedByPlace,
  };
}

/** 분류 드롭다운용. TODO(taxonomy): 카테고리 관리 화면이 생기면 그쪽 모듈로 옮긴다. */
export async function listPhotoTaxonomies(): Promise<TaxonomyOption[]> {
  // TODO(prisma): prisma.taxonomy.findMany({ include: { terms: { orderBy: { order: 'asc' } } } })
  return SEED_TAXONOMIES;
}

/** 스토리지 사용량. 아직 계산할 근거가 없으므로 null을 돌려주고 화면이 "미연결"로 표시한다. */
export async function getStorageUsage(): Promise<{ originals: number; bytes: number | null }> {
  return { originals: SEED_PHOTOS.length, bytes: null };
}

/* ============================ 쓰기 (전부 미연결) ============================ */
//
// 아래 함수는 어떤 경우에도 성공을 반환하지 않는다. 검증은 실제로 수행하고 —
// 규칙 위반은 지금도 정확히 걸러진다 — 저장 직전에 NotImplementedError로 끊는다.

export type StatusChange = { id: string; status: PhotoStatus };

export async function updatePhotoStatus(id: string, status: PhotoStatus): Promise<Photo> {
  const photo = await getPhoto(id);
  if (!photo) throw new NotFoundError('사진을 찾을 수 없습니다.');

  // 전시 전제 조건은 스텁 이전에 실제로 검사한다.
  assertPublishable(photo, status);

  // TODO(prisma): prisma.photo.update({ where: { id }, data: { status } })
  throw new NotImplementedError(`사진 상태 변경(${status})`);
}

export async function bulkUpdatePhotoStatus(ids: string[], status: PhotoStatus): Promise<Photo[]> {
  for (const id of ids) {
    const photo = await getPhoto(id);
    if (!photo) throw new NotFoundError(`사진을 찾을 수 없습니다: ${id}`);
    assertPublishable(photo, status);
  }
  // TODO(prisma): prisma.photo.updateMany({ where: { id: { in: ids } }, data: { status } })
  throw new NotImplementedError(`사진 ${ids.length}건 일괄 상태 변경(${status})`);
}

export async function updatePhotoAlt(id: string, alt: Partial<Localized>): Promise<Photo> {
  const photo = await getPhoto(id);
  if (!photo) throw new NotFoundError('사진을 찾을 수 없습니다.');
  // TODO(prisma): prisma.photo.update({ where: { id }, data: { alt: { ...photo.alt, ...alt } } })
  throw new NotImplementedError('alt 저장');
}

export async function setPhotoTerms(id: string, termIds: string[]): Promise<Photo> {
  const photo = await getPhoto(id);
  if (!photo) throw new NotFoundError('사진을 찾을 수 없습니다.');
  // TODO(prisma): deleteMany(PhotoTerm) 후 createMany — 트랜잭션으로 묶는다
  throw new NotImplementedError(`분류 지정(${termIds.length}건)`);
}

export async function setCoverPhoto(id: string): Promise<Photo> {
  const photo = await getPhoto(id);
  if (!photo) throw new NotFoundError('사진을 찾을 수 없습니다.');
  if (photo.status !== 'PUBLISHED') {
    throw new NotImplementedError('대표컷 지정 — 전시중인 사진만 대표컷이 될 수 있습니다');
  }
  // TODO(prisma): 기존 isCover=false로 내린 뒤 대상만 true. 트랜잭션.
  throw new NotImplementedError('대표컷 지정');
}

export type IngestCandidate = {
  igMediaId: string;
  originalUrl: string;
  variants: VariantMap;
  width: number;
  height: number;
  caption: string | null;
  takenAt: Date;
  alt: Localized;
  aiSuggestion: AiSuggestion[] | null;
};

/** 크론이 수집한 결과를 UNSORTED로 저장. 수동 업로드도 같은 큐로 들어온다. */
export async function createIngestedPhotos(items: IngestCandidate[]): Promise<number> {
  // TODO(prisma): prisma.photo.createMany({ data: items.map(...), skipDuplicates: true }) — igMediaId unique로 중복 방지
  throw new NotImplementedError(`수집 사진 ${items.length}건 저장`);
}

/** 이미 수집된 인스타 media id 집합. 크론이 신규만 내려받도록 판단하는 근거. */
export async function knownIgMediaIds(): Promise<Set<string>> {
  // TODO(prisma): prisma.photo.findMany({ select: { igMediaId: true }, where: { igMediaId: { not: null } } })
  return new Set(SEED_PHOTOS.map((p) => p.igMediaId).filter((v): v is string => Boolean(v)));
}

/* ============================ 규칙 검증 ============================ */

/** PUBLISHED로 올릴 때만 alt 3개 언어를 강제한다. 보관·미선별로 내리는 것은 제약 없음. */
export function assertPublishable(photo: Photo, next: PhotoStatus): void {
  if (next !== 'PUBLISHED') return;
  const missing = missingAltLocales(photo.alt);
  if (missing.length > 0) {
    throw new AltIncompleteError(photo.id, missing);
  }
}

/** AppError를 상속하므로 라우트에서 errorResponse에 넘기면 422 + ALT_INCOMPLETE로 나간다. */
export class AltIncompleteError extends AppError {
  constructor(photoId: string, missing: Locale[]) {
    super('ALT_INCOMPLETE', 422, `alt가 비어 있어 전시할 수 없습니다 (${missing.join(', ')}).`, {
      photoId,
      missing,
    });
  }
}
