import { LOCALES, type Locale } from '@/lib/i18n';
import type { VariantMap } from '@/lib/image-contract';

/**
 * 사진 도메인의 타입과 순수 함수.
 *
 * server/photos.ts 에서 떼어낸 이유: 그쪽은 sharp · @vercel/blob 을 끌고 오는데,
 * 클라이언트 컴포넌트가 타입 하나 쓰겠다고 그 파일을 import 하면 node 내장 모듈이
 * 브라우저 번들로 딸려 들어가 빌드가 깨진다. 경계는 여기서 끊는다.
 */

export type PhotoStatus = 'UNSORTED' | 'PUBLISHED' | 'ARCHIVED';

/** 다국어 필드. schema의 Json { ja, en, ko }. */
export type Localized = Record<Locale, string>;

/** AI가 제안한 분류. 확정은 반드시 관리자가 한다. */
export type AiSuggestion = {
  taxonomyId: string;
  termId: string;
  /** 화면 표시용 — 실제 저장 형태에는 없지만 조인 결과로 채워진다. */
  label: string;
  /** 0..1 */
  score: number;
};

/** PhotoTerm 조인 결과 */
export type PhotoTermRef = {
  taxonomyId: string;
  taxonomyKey: string;
  termId: string;
  slug: string;
  label: Localized;
};

export type Photo = {
  id: string;
  /** 수집 출처 계정. 'main'(작품 @usherinmaking) / 'dress'(@usherindress). */
  igAccount: string;
  igMediaId: string | null;
  originalUrl: string;
  variants: VariantMap;
  width: number;
  height: number;
  caption: string | null;
  takenAt: Date;
  status: PhotoStatus;
  lowRes: boolean;
  alt: Localized;
  story: Localized | null;
  aiSuggestion: AiSuggestion[] | null;
  isCover: boolean;
  terms: PhotoTermRef[];
  createdAt: Date;
  updatedAt: Date;
};

export type TaxonomyOption = {
  id: string;
  key: string;
  label: Localized;
  terms: { id: string; slug: string; label: Localized }[];
};

export type PhotoFilter = {
  /** 수집 계정으로 거른다. 없으면 전체 — 전시 선별은 'main', 드레스 관리자는 'dress' 를 쓴다. */
  account?: 'main' | 'dress';
  status?: PhotoStatus;
  /** 분류가 하나도 지정되지 않은 것만 */
  untagged?: boolean;
  /** 저해상도만 */
  lowRes?: boolean;
  /** alt가 3개 언어 모두 채워지지 않은 것만 */
  missingAlt?: boolean;
  sort?: 'newest' | 'oldest';
};

export type PhotoCounts = {
  unsorted: number;
  published: number;
  archived: number;
  missingAlt: number;
  lowRes: number;
  untagged: number;
  /** alt 미완성 또는 저해상도인 사진의 실제 건수. 두 집합이 겹치므로 단순 합산이 아니다. */
  needsAttention: number;
  total: number;
  /** 전시중 사진의 장소 축 분포 — 대시보드 보조 문구용 */
  publishedByPlace: Record<string, number>;
};

/* ============================ 공개 규칙 ============================ */

/**
 * 전시(PUBLISHED) 전제 조건 — alt가 3개 언어 모두 채워져 있어야 한다.
 * UI 비활성화와 API 검증이 같은 함수를 쓰도록 여기서 한 번만 정의한다.
 */
export function missingAltLocales(alt: Partial<Localized> | null | undefined): Locale[] {
  return LOCALES.filter((l) => !alt?.[l] || alt[l]!.trim().length === 0);
}

export function isAltComplete(alt: Partial<Localized> | null | undefined): boolean {
  return missingAltLocales(alt).length === 0;
}
