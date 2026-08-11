// 사진 저장소 계층.
//
// 읽기는 DB 우선 · 시드 폴백이다 — DB에 행이 한 건이라도 있으면 DB가 이긴다(journal.ts와 같은 패턴).
// 쓰기는 DB가 붙어 있으면 실제로 저장하고, 붙어 있지 않으면 검증까지 마친 뒤 NotImplementedError로 끊는다.
// 성공을 흉내내는 경로는 없다.
//
// TODO(seed): src/content/photos.ts · src/content/taxonomy.ts 가 생기면 SEED_PHOTOS / SEED_TAXONOMIES를
// 그쪽 import로 교체한다. 작성 시점에 두 파일이 없어 타입을 여기에 로컬 정의했다.

import type { Prisma } from '@prisma/client';
import { isDatabaseConfigured, prisma } from '@/server/db';
import { logAdminAction } from '@/server/activity';
import { blockIgMediaIds } from '@/server/ig-blocklist';
import { AppError, NotImplementedError, NotFoundError, ValidationError } from './errors';
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
    igAccount: 'main',
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
    igAccount: 'main',
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

/* ============================ DB 매핑 ============================ */

/** photo.terms 조인 포함. 조회·쓰기 후 재조회 모두 이 include로 통일한다. */
const PHOTO_INCLUDE = {
  terms: { include: { term: { include: { taxonomy: true } } } },
} satisfies Prisma.PhotoInclude;

type DbPhoto = Prisma.PhotoGetPayload<{ include: typeof PHOTO_INCLUDE }>;
type DbPhotoTerm = DbPhoto['terms'][number];

/** Json 칼럼은 unknown이나 다름없이 들어온다. 모양이 아니면 지어내지 않고 fallback으로 떨어뜨린다. */
function readLocalized(raw: unknown, fallback: Localized): Localized {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const out = {} as Localized;
  for (const l of LOCALES) {
    const v = obj[l];
    out[l] = typeof v === 'string' ? v : fallback[l];
  }
  return out;
}

/** story처럼 없어도 되는 다국어 필드. 내용이 하나도 없으면 null. */
function readOptionalLocalized(raw: unknown): Localized | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out = {} as Localized;
  let hasContent = false;
  for (const l of LOCALES) {
    const v = obj[l];
    out[l] = typeof v === 'string' ? v : '';
    if (out[l].length > 0) hasContent = true;
  }
  return hasContent ? out : null;
}

function readVariants(raw: unknown): VariantMap {
  const empty: VariantMap = { avif: {}, webp: {} };
  if (!raw || typeof raw !== 'object') return empty;
  const obj = raw as Record<string, unknown>;
  return {
    avif: obj.avif && typeof obj.avif === 'object' ? (obj.avif as VariantMap['avif']) : {},
    webp: obj.webp && typeof obj.webp === 'object' ? (obj.webp as VariantMap['webp']) : {},
  };
}

function readAiSuggestion(raw: unknown): AiSuggestion[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: AiSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (
      typeof o.taxonomyId === 'string' &&
      typeof o.termId === 'string' &&
      typeof o.label === 'string' &&
      typeof o.score === 'number'
    ) {
      out.push({ taxonomyId: o.taxonomyId, termId: o.termId, label: o.label, score: o.score });
    }
  }
  return out.length > 0 ? out : null;
}

/** term.label(Json)을 읽는다. ja → slug 대체 규칙은 시드 쪽 fillLabel과 맞춰 둔다. */
function readTermLabel(raw: unknown, slug: string): Localized {
  if (!raw || typeof raw !== 'object') return { ja: slug, en: slug, ko: slug };
  const obj = raw as Record<string, unknown>;
  const ja = typeof obj.ja === 'string' ? obj.ja : slug;
  const en = typeof obj.en === 'string' ? obj.en : ja;
  const ko = typeof obj.ko === 'string' ? obj.ko : ja;
  return { ja, en, ko };
}

function fromDbTerm(row: DbPhotoTerm): PhotoTermRef {
  return {
    taxonomyId: row.term.taxonomyId,
    taxonomyKey: row.term.taxonomy.key,
    termId: row.term.id,
    slug: row.term.slug,
    label: readTermLabel(row.term.label, row.term.slug),
  };
}

function fromDb(row: DbPhoto): Photo {
  return {
    id: row.id,
    igAccount: row.igAccount,
    igMediaId: row.igMediaId,
    originalUrl: row.originalUrl,
    variants: readVariants(row.variants),
    width: row.width,
    height: row.height,
    caption: row.caption,
    takenAt: row.takenAt,
    status: row.status,
    lowRes: row.lowRes,
    alt: readLocalized(row.alt, ZERO_ALT),
    story: readOptionalLocalized(row.story),
    aiSuggestion: readAiSuggestion(row.aiSuggestion),
    isCover: row.isCover,
    terms: row.terms.map(fromDbTerm),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/* ============================ 읽기 ============================ */

function hasNoTerms(p: Photo): boolean {
  return p.terms.length === 0;
}

/** 전체 목록. DB에 한 건이라도 있으면 DB가 원본이다. */
async function allRows(): Promise<Photo[]> {
  if (isDatabaseConfigured()) {
    const rows = await prisma.photo.findMany({ include: PHOTO_INCLUDE });
    if (rows.length > 0) return rows.map(fromDb);
  }
  return SEED_PHOTOS.slice();
}

export async function listPhotos(filter: PhotoFilter = {}): Promise<Photo[]> {
  let rows = await allRows();

  // 계정은 화면의 경계다 — 드레스 관리자에 작품 사진이 섞이면 선별 자체가 무의미해진다.
  if (filter.account) rows = rows.filter((p) => p.igAccount === filter.account);
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

/**
 * 공개 작품 그리드용 조회. DB의 PUBLISHED 행만 보고 **시드로 폴백하지 않는다** —
 * 그리드의 폴백(기존 코드 배열)은 호출측(@/server/works)이 판단한다. 여기서 시드로
 * 떨어뜨리면 "DB 빈 상태에서 렌더 불변" 회귀 기준이 깨진다.
 * termSlug 가 null 이면 태그 무관 전체에서 최신순으로 고른다.
 */
export async function listDbPublishedPhotos(termSlug: string | null, take: number): Promise<Photo[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await prisma.photo.findMany({
    where: {
      status: 'PUBLISHED',
      ...(termSlug ? { terms: { some: { term: { slug: termSlug } } } } : {}),
    },
    include: PHOTO_INCLUDE,
    orderBy: { takenAt: 'desc' },
    take,
  });
  return rows.map(fromDb);
}

/**
 * 재검증 판단용 — 대상 id 중 현재 PUBLISHED 인 행 수.
 * 일괄 상태 변경 전에 재서, PUBLISHED 가 개입하지 않는 전환(UNSORTED↔ARCHIVED)이
 * 공개 캐시를 불필요하게 폐기하지 않도록 한다. DB 미설정이면 0 (쓰기 자체가 막힌다).
 */
export async function countPublishedAmong(ids: string[]): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  return prisma.photo.count({ where: { id: { in: ids }, status: 'PUBLISHED' } });
}

/** 단건 조회. id 기준으로 DB를 먼저 보고, 없으면(또는 DB 미설정이면) 시드에서 찾는다. */
export async function getPhoto(id: string): Promise<Photo | null> {
  if (isDatabaseConfigured()) {
    const row = await prisma.photo.findUnique({ where: { id }, include: PHOTO_INCLUDE });
    if (row) return fromDb(row);
  }
  return SEED_PHOTOS.find((p) => p.id === id) ?? null;
}

/**
 * 쓰기 대상 조회. getPhoto와 달리 DB가 붙어 있으면 시드로 대체하지 않는다 —
 * 시드는 실제 DB 행이 아니므로 그 자체로 쓰기 대상이 될 수 없다(있으면 존재하지 않는 행을
 * update하게 되어 조용히 깨진다). DB 미설정일 때만 시드로 검증을 계속한다
 * (그다음 각 쓰기 함수가 NotImplementedError로 끊는다).
 */
async function requirePhoto(id: string): Promise<Photo> {
  if (isDatabaseConfigured()) {
    const row = await prisma.photo.findUnique({ where: { id }, include: PHOTO_INCLUDE });
    if (!row) throw new NotFoundError('사진을 찾을 수 없습니다.');
    return fromDb(row);
  }
  const seedPhoto = SEED_PHOTOS.find((p) => p.id === id);
  if (!seedPhoto) throw new NotFoundError('사진을 찾을 수 없습니다.');
  return seedPhoto;
}

export async function countPhotos(account?: 'main' | 'dress'): Promise<PhotoCounts> {
  const rows = await allRows();
  const all = account ? rows.filter((p) => p.igAccount === account) : rows;
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

/**
 * 분류 드롭다운용.
 *
 * DB 가 붙어 있으면 DB 를 읽는다 — 분류 지정(setPhotoTerms)이 DB 의 term id 로 검증하므로,
 * 시드의 content key 를 내려보내면 DB 에만 있는 축(dressCollection)은 저장이 통째로 막힌다.
 * `key` 로 좁혀 부르면 그 축만 준다(드레스 관리자는 dressCollection 하나만 쓴다).
 */
export async function listPhotoTaxonomies(keys?: string | string[]): Promise<TaxonomyOption[]> {
  const wanted = keys === undefined ? null : Array.isArray(keys) ? keys : [keys];

  if (isDatabaseConfigured()) {
    const rows = await prisma.taxonomy.findMany({
      ...(wanted ? { where: { key: { in: wanted } } } : {}),
      include: { terms: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
    if (rows.length > 0) {
      return rows.map((tx) => ({
        id: tx.id,
        key: tx.key,
        label: readLocalized(tx.label, { ja: tx.key, en: tx.key, ko: tx.key }),
        terms: tx.terms.map((t) => ({
          id: t.id,
          slug: t.slug,
          label: readLocalized(t.label, { ja: t.slug, en: t.slug, ko: t.slug }),
        })),
      }));
    }
  }
  return wanted ? SEED_TAXONOMIES.filter((tx) => wanted.includes(tx.key)) : SEED_TAXONOMIES;
}

/** 스토리지 사용량. 아직 계산할 근거가 없으므로 null을 돌려주고 화면이 "미연결"로 표시한다. */
export async function getStorageUsage(): Promise<{ originals: number; bytes: number | null }> {
  return { originals: SEED_PHOTOS.length, bytes: null };
}

/* ============================ 쓰기 ============================ */
//
// DB가 붙어 있으면 실제로 저장한다. 붙어 있지 않으면 검증까지 실제로 수행한 뒤
// NotImplementedError로 끊는다 — 성공을 흉내내는 경로는 어디에도 없다.

export type StatusChange = { id: string; status: PhotoStatus };

export async function updatePhotoStatus(id: string, status: PhotoStatus): Promise<Photo> {
  const photo = await requirePhoto(id);

  // 전시 전제 조건(alt 3개 언어)은 DB 연결 여부와 무관하게 항상 검사한다.
  assertPublishable(photo, status);

  if (!isDatabaseConfigured()) {
    throw new NotImplementedError(`사진 상태 변경(${status})`);
  }

  const row = await prisma.photo.update({
    where: { id },
    data: { status },
    include: PHOTO_INCLUDE,
  });

  await logAdminAction('사진 상태 변경', id, { status });
  return fromDb(row);
}

export async function bulkUpdatePhotoStatus(ids: string[], status: PhotoStatus): Promise<Photo[]> {
  // 저장을 시작하기 전에 대상 전원을 검증한다 — 중간에 막히면 일부만 바뀐 상태로
  // 끝나서는 안 된다.
  for (const id of ids) {
    let photo: Photo;
    try {
      photo = await requirePhoto(id);
    } catch {
      throw new NotFoundError(`사진을 찾을 수 없습니다: ${id}`);
    }
    assertPublishable(photo, status);
  }

  if (!isDatabaseConfigured()) {
    throw new NotImplementedError(`사진 ${ids.length}건 일괄 상태 변경(${status})`);
  }

  await prisma.photo.updateMany({ where: { id: { in: ids } }, data: { status } });
  await logAdminAction('사진 일괄 상태 변경', undefined, { count: ids.length, status });

  const rows = await prisma.photo.findMany({ where: { id: { in: ids } }, include: PHOTO_INCLUDE });
  return rows.map(fromDb);
}

/**
 * 선택 사진을 갤러리에서 완전히 뺀다 — 행을 지우고, 그 인스타 게시물을 수집 제외 목록에 올린다.
 *
 * 제외 목록이 핵심이다. 행만 지우면 중복 방지가 "처음 보는 사진"으로 판단해서
 * 다음 동기화에 그대로 다시 들어온다. 지운 사실 자체를 남겨야 다시 오지 않는다.
 *
 * 원본 파일은 스토리지에 그대로 둔다(MediaAsset 행도 남는다). 되돌릴 수 없는 것은
 * 갤러리 등록 정보뿐이고, 사진 자체는 미디어 화면에서 계속 볼 수 있다 —
 * 사장님이 "원본은 남겨놔"라고 하신 경계가 여기다.
 */
export async function deletePhotos(ids: string[]): Promise<{ deleted: number; blocked: number }> {
  if (!isDatabaseConfigured()) {
    throw new NotImplementedError(`사진 ${ids.length}건 삭제`);
  }

  // 먼저 인스타 id 를 모아 제외 목록에 올린다. 순서가 중요하다 —
  // 지우고 나서 목록에 올리다 실패하면, 그 사진은 다음 동기화에 되돌아온다.
  const rows = await prisma.photo.findMany({
    where: { id: { in: ids } },
    select: { id: true, igMediaId: true },
  });
  const igIds = rows.map((r) => r.igMediaId).filter((v): v is string => Boolean(v));
  const blocked = igIds.length > 0 ? await blockIgMediaIds(igIds) : 0;

  // 분류 연결을 먼저 끊는다(관계 테이블에 외래키가 걸려 있다).
  await prisma.photoTerm.deleteMany({ where: { photoId: { in: ids } } });
  const { count } = await prisma.photo.deleteMany({ where: { id: { in: ids } } });

  await logAdminAction('사진 삭제 · 수집 제외', undefined, {
    count,
    blockedTotal: blocked,
  });

  return { deleted: count, blocked };
}

export async function updatePhotoAlt(id: string, alt: Partial<Localized>): Promise<Photo> {
  const photo = await requirePhoto(id);
  const merged: Localized = { ...photo.alt, ...alt };

  if (!isDatabaseConfigured()) {
    throw new NotImplementedError('alt 저장');
  }

  const row = await prisma.photo.update({
    where: { id },
    data: { alt: merged as unknown as Prisma.InputJsonValue },
    include: PHOTO_INCLUDE,
  });

  await logAdminAction('사진 alt 저장', id, { locales: Object.keys(alt) });
  return fromDb(row);
}

/**
 * termId 존재 판정 기준. DB가 붙어 있으면 실제 Term 행을, 아니면 content 시드의
 * term key를 쓴다(시드 스크립트가 Term.id로 term.key를 그대로 쓰기 때문에 둘은 같은 값이다).
 */
async function knownTermIds(): Promise<Set<string>> {
  if (isDatabaseConfigured()) {
    const rows = await prisma.term.findMany({ select: { id: true } });
    return new Set(rows.map((r) => r.id));
  }
  return new Set(TERMS.map((t) => t.key));
}

/** 통째로 교체한다 — 지운 항목이 실제로 사라지도록 delete 후 create를 한 트랜잭션으로 묶는다. */
export async function setPhotoTerms(id: string, termIds: string[]): Promise<Photo> {
  await requirePhoto(id);

  const uniqueIds = [...new Set(termIds)];
  const known = await knownTermIds();
  const unknown = uniqueIds.filter((termId) => !known.has(termId));
  if (unknown.length > 0) {
    throw new ValidationError(`존재하지 않는 분류입니다: ${unknown.join(', ')}`);
  }

  if (!isDatabaseConfigured()) {
    throw new NotImplementedError(`분류 지정(${uniqueIds.length}건)`);
  }

  await prisma.$transaction([
    prisma.photoTerm.deleteMany({ where: { photoId: id } }),
    ...(uniqueIds.length > 0
      ? [prisma.photoTerm.createMany({ data: uniqueIds.map((termId) => ({ photoId: id, termId })) })]
      : []),
  ]);

  await logAdminAction('사진 분류 지정', id, { termIds: uniqueIds });
  return requirePhoto(id);
}

export async function setCoverPhoto(id: string): Promise<Photo> {
  const photo = await requirePhoto(id);
  if (photo.status !== 'PUBLISHED') {
    throw new ValidationError('대표컷은 전시중인 사진만 지정할 수 있습니다.');
  }

  if (!isDatabaseConfigured()) {
    throw new NotImplementedError('대표컷 지정');
  }

  // 기존 대표컷을 내리는 것과 새 대표컷을 올리는 것이 한 트랜잭션 안에 있어야 한다 —
  // 둘 사이에 크래시가 나면 대표컷이 0장 또는 2장인 상태로 사이트에 남는다.
  await prisma.$transaction([
    prisma.photo.updateMany({ where: { isCover: true, NOT: { id } }, data: { isCover: false } }),
    prisma.photo.update({ where: { id }, data: { isCover: true } }),
  ]);

  await logAdminAction('대표컷 지정', id);
  return requirePhoto(id);
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

/**
 * 크론이 수집한 결과를 UNSORTED로 저장. 수동 업로드도 같은 큐로 들어온다.
 * igMediaId가 @unique라 skipDuplicates만으로 재실행 안전성이 보장된다 — 별도 조회가 필요 없다.
 */
export async function createIngestedPhotos(items: IngestCandidate[]): Promise<number> {
  if (items.length === 0) return 0;

  for (const item of items) {
    if (!item.igMediaId.trim()) {
      throw new ValidationError('igMediaId가 없는 수집 항목은 저장할 수 없습니다.');
    }
  }

  if (!isDatabaseConfigured()) {
    throw new NotImplementedError(`수집 사진 ${items.length}건 저장`);
  }

  const { count } = await prisma.photo.createMany({
    data: items.map((item) => ({
      igMediaId: item.igMediaId,
      originalUrl: item.originalUrl,
      variants: item.variants as unknown as Prisma.InputJsonValue,
      width: item.width,
      height: item.height,
      caption: item.caption,
      takenAt: item.takenAt,
      status: 'UNSORTED',
      lowRes: isLowRes(item.width, item.height),
      alt: item.alt as unknown as Prisma.InputJsonValue,
      aiSuggestion:
        item.aiSuggestion !== null
          ? (item.aiSuggestion as unknown as Prisma.InputJsonValue)
          : undefined,
    })),
    // igMediaId unique 제약이 중복 방지의 실제 근거. skipDuplicates가 이미 있는 행을 조용히 건너뛴다.
    skipDuplicates: true,
  });

  if (count > 0) {
    await logAdminAction('수집 사진 저장', undefined, { created: count, attempted: items.length });
  }

  return count;
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
