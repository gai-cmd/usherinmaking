import { NotImplementedError } from '@/server/errors';
import {
  DRESS_COLLECTIONS,
  DRESS_INVENTORY_CONFIRMED,
  DRESS_ITEMS,
  FITTING_STEPS,
  RENTAL_CONDITIONS,
  type DressCollection,
  type DressCollectionSlug,
  type DressItem,
  type DressTier,
} from '@/content/dress';

/**
 * 드레스 리포지터리.
 *
 * prisma/schema.prisma 에 Dress 모델이 아직 없다 (인계 보고에 적어 둔 스키마 갭).
 * 그래서 타입은 src/content/dress.ts 가 원본이고, 이 모듈은 그 위에 읽기/쓰기 seam 만 얹는다.
 * 모델이 추가되면 아래 TODO(prisma) 지점만 교체하면 된다.
 *
 * 브랜드 필드는 없다 — 드레스 페이지는 브랜드명을 쓰지 않는다. 추가하지 말 것.
 */

export type { DressCollection, DressCollectionSlug, DressItem, DressTier };

export const DRESS_TIER_LABEL: Record<DressTier, string> = {
  basic: '기본',
  premium: '프리미엄',
};

/* ---------------------------------------------------------------- 읽기 */

export type ListDressOptions = {
  collection?: DressCollectionSlug;
  tier?: DressTier;
  publishedOnly?: boolean;
};

export async function listDressItems(opts: ListDressOptions = {}): Promise<DressItem[]> {
  // Dress 모델이 없어 DB 우선 경로가 없다. src/content/dress.ts 가 유일한 원본이다.
  let rows = [...DRESS_ITEMS];
  if (opts.collection) rows = rows.filter((d) => d.collection === opts.collection);
  if (opts.tier) rows = rows.filter((d) => d.tier === opts.tier);
  if (opts.publishedOnly) rows = rows.filter((d) => d.published);
  return rows;
}

export async function getDressItem(id: string): Promise<DressItem | null> {
  return DRESS_ITEMS.find((d) => d.id === id) ?? null;
}

export async function listDressCollections(): Promise<DressCollection[]> {
  return DRESS_COLLECTIONS;
}

export async function getRentalConditions() {
  return RENTAL_CONDITIONS;
}

export async function getFittingSteps() {
  return FITTING_STEPS;
}

export type DressPhotoState = {
  /** 개별 드레스 사진 납품 여부 — 전부 미납이면 화면이 플레이스홀더를 그린다 */
  anyPhotoSupplied: boolean;
  missingPhotoCount: number;
  /** 대여 재고 목록을 확정 받았는지 */
  inventoryConfirmed: boolean;
};

/**
 * 사진·재고의 "없음"을 정확히 보고한다.
 * 없는 이미지 경로를 지어내지 않기 위해, 화면은 이 상태를 보고 플레이스홀더를 렌더한다.
 */
export async function getDressPhotoState(): Promise<DressPhotoState> {
  const items = await listDressItems();
  const missing = items.filter((d) => !d.photo);
  return {
    anyPhotoSupplied: items.some((d) => Boolean(d.photo)),
    missingPhotoCount: missing.length,
    inventoryConfirmed: DRESS_INVENTORY_CONFIRMED,
  };
}

export type DressCounts = {
  total: number;
  published: number;
  hidden: number;
  premium: number;
  withoutPhoto: number;
};

export async function countDress(): Promise<DressCounts> {
  const items = await listDressItems();
  return {
    total: items.length,
    published: items.filter((d) => d.published).length,
    hidden: items.filter((d) => !d.published).length,
    premium: items.filter((d) => d.tier === 'premium').length,
    withoutPhoto: items.filter((d) => !d.photo).length,
  };
}

/* ---------------------------------------------------------------- 쓰기 */

export type DressItemInput = {
  id?: string;
  name: Partial<Record<'ja' | 'en' | 'ko', string>>;
  collection: DressCollectionSlug;
  tier: DressTier;
  surcharge: number | null;
  sizes: string[];
  description: Partial<Record<'ja' | 'en' | 'ko', string>>;
  published: boolean;
};

/*
 * 아래 쓰기 경로는 DB 연결 여부와 무관하게 막혀 있다.
 * schema.prisma 에 Dress 모델이 없어서 저장할 곳 자체가 없기 때문이다.
 * 다른 모델에 끼워 넣는 대신 정직하게 501 을 내보낸다 —
 * 모델이 추가되면 그때 시드/플랜과 같은 방식으로 붙인다.
 */

export async function upsertDressItem(_input: DressItemInput): Promise<DressItem> {
  throw new NotImplementedError('드레스 저장 (schema.prisma 에 Dress 모델이 없습니다)');
}

export async function setDressPublished(_id: string, _published: boolean): Promise<DressItem> {
  throw new NotImplementedError('드레스 공개 상태 변경 (schema.prisma 에 Dress 모델이 없습니다)');
}

export async function reorderDressItems(_orderedIds: string[]): Promise<number> {
  throw new NotImplementedError('드레스 순서 변경 (schema.prisma 에 Dress 모델이 없습니다)');
}
