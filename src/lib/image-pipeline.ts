// 이미지 파이프라인 — 계약과 순수 함수는 여기서 확정하고, 실제 외부 호출은 이름 붙인 seam으로 남긴다.
//
// 지금 시점에 없는 것: 인스타 액세스 토큰, 오브젝트 스토리지, AI 제공자.
// 그래서 "무엇을 어떤 규격으로 만들 것인가"(상수 · 순수 함수)는 지금 확정해 테스트 가능하게 두고,
// "실제로 네트워크를 타는 부분"만 TODO(pipeline) seam으로 비워 둔다.
// seam은 성공을 흉내내지 않고 DependencyUnavailableError를 던진다.

import { DependencyUnavailableError, NotImplementedError } from '@/server/errors';

/* ============================ 규격 (확정) ============================ */

/** 프론트 서빙 규격. 원본은 스토리지에 그대로 두고 이 3단계만 서빙한다. */
export const RENDITION_WIDTHS = [400, 800, 1600] as const;
export type RenditionWidth = (typeof RENDITION_WIDTHS)[number];

/** AVIF 우선, WebP 폴백. 원본 포맷(JPEG)은 서빙하지 않는다. */
export const RENDITION_FORMATS = ['avif', 'webp'] as const;
export type RenditionFormat = (typeof RENDITION_FORMATS)[number];

/** 장변이 이 값 미만이면 저해상도. 관리자 화면에서 원본 교체를 유도한다. */
export const LOW_RES_MIN_LONG_EDGE = 2000;

/** 인코딩 품질. AVIF는 같은 화질을 더 낮은 수치로 낸다. */
export const RENDITION_QUALITY: Record<RenditionFormat, number> = { avif: 50, webp: 72 };

/** Photo.variants(Json)의 형태. 폭 → URL. */
export type VariantMap = Record<RenditionFormat, Partial<Record<`${RenditionWidth}`, string>>>;

export type Rendition = {
  format: RenditionFormat;
  width: RenditionWidth;
  /** 원본 비율을 유지한 결과 높이 */
  height: number;
  /** 스토리지 키 */
  key: string;
};

/* ============================ 순수 함수 ============================ */

/** 장변 기준 저해상도 판정. Photo.lowRes에 그대로 들어간다. */
export function isLowRes(width: number, height: number): boolean {
  return Math.max(width, height) < LOW_RES_MIN_LONG_EDGE;
}

/** 스토리지 키. photoId를 접두로 두어 원본과 파생본이 한 묶음으로 정리되게 한다. */
export function renditionKey(photoId: string, format: RenditionFormat, width: RenditionWidth): string {
  return `photos/${photoId}/${width}.${format}`;
}

export function originalKey(photoId: string, ext: string): string {
  const clean = ext.replace(/^\./, '').toLowerCase() || 'jpg';
  return `photos/${photoId}/original.${clean}`;
}

/**
 * 만들어야 할 파생본 목록. 업스케일은 하지 않는다 —
 * 원본보다 큰 폭은 건너뛰되, 원본이 400px보다 작아도 최소 1단계는 남긴다.
 */
export function planRenditions(photo: { id: string; width: number; height: number }): Rendition[] {
  const usable = RENDITION_WIDTHS.filter((w) => w <= photo.width);
  const widths: readonly RenditionWidth[] = usable.length > 0 ? usable : [RENDITION_WIDTHS[0]];

  const out: Rendition[] = [];
  for (const format of RENDITION_FORMATS) {
    for (const width of widths) {
      const scale = Math.min(width / photo.width, 1);
      out.push({
        format,
        width,
        height: Math.max(1, Math.round(photo.height * scale)),
        key: renditionKey(photo.id, format, width),
      });
    }
  }
  return out;
}

export function emptyVariants(): VariantMap {
  return { avif: {}, webp: {} };
}

/** 업로드가 끝난 파생본 목록 → Photo.variants Json. */
export function buildVariantMap(renditions: Rendition[], publicUrl: (key: string) => string): VariantMap {
  const map = emptyVariants();
  for (const r of renditions) map[r.format][`${r.width}`] = publicUrl(r.key);
  return map;
}

/** srcset 문자열. 프론트가 <picture>를 구성할 때 쓴다. */
export function toSrcSet(variants: VariantMap, format: RenditionFormat): string {
  return Object.entries(variants[format])
    .map(([w, url]) => `${url} ${w}w`)
    .join(', ');
}

/* ============================ 외부 호출 seam ============================ */
//
// 아래 함수들은 전부 아직 연결되지 않았다. 각각 "무엇이 붙으면 풀리는지"를 메시지에 적어 둔다.
// 호출측(크론 라우트)은 이 예외를 잡아 IngestRun에 실패로 기록한다.

export type InstagramMedia = {
  id: string;
  mediaUrl: string;
  permalink: string;
  caption: string | null;
  timestamp: string;
  width: number;
  height: number;
};

export type InstagramCredentials = { accessToken: string; userId: string };

/**
 * 계정의 게시물을 전량 페이지네이션하며 가져온다. 전량 수집이 원칙이므로 상한을 두지 않는다.
 * TODO(pipeline): Instagram Graph API /{ig-user-id}/media 연결.
 */
export async function fetchInstagramMedia(_creds: InstagramCredentials): Promise<InstagramMedia[]> {
  throw new DependencyUnavailableError(
    'Instagram Graph API가 연결되지 않았습니다.',
    { seam: 'fetchInstagramMedia' },
  );
}

/** TODO(pipeline): 최대 해상도 원본 다운로드. */
export async function downloadOriginal(_mediaUrl: string): Promise<ArrayBuffer> {
  throw new DependencyUnavailableError('원본 다운로드가 연결되지 않았습니다.', {
    seam: 'downloadOriginal',
  });
}

/** TODO(pipeline): 오브젝트 스토리지(S3 / R2 / Vercel Blob) 업로드. */
export async function storeOriginal(_key: string, _bytes: ArrayBuffer): Promise<string> {
  throw new DependencyUnavailableError('오브젝트 스토리지가 연결되지 않았습니다.', {
    seam: 'storeOriginal',
  });
}

/**
 * TODO(pipeline): sharp 등으로 AVIF / WebP 3단계 재인코딩 후 업로드.
 * 만들 목록 자체는 planRenditions가 이미 확정한다 — 여기서는 실제 인코딩만 담당한다.
 */
export async function encodeRenditions(
  _bytes: ArrayBuffer,
  _plan: Rendition[],
): Promise<VariantMap> {
  throw new NotImplementedError('이미지 재인코딩(AVIF / WebP)');
}

export type CategorySuggestion = { taxonomyKey: string; termSlug: string; score: number };

/** TODO(pipeline): AI 분류 제안. 어디까지나 제안이며 확정은 관리자가 한다. */
export async function suggestCategories(_bytes: ArrayBuffer): Promise<CategorySuggestion[]> {
  throw new DependencyUnavailableError('AI 분류 제공자가 연결되지 않았습니다.', {
    seam: 'suggestCategories',
  });
}

/** TODO(pipeline): alt 초안 3개 언어. 이것도 초안이며 관리자 확인 전에는 공개되지 않는다. */
export async function draftAltText(
  _bytes: ArrayBuffer,
  _caption: string | null,
): Promise<{ ja: string; en: string; ko: string }> {
  throw new DependencyUnavailableError('AI alt 생성 제공자가 연결되지 않았습니다.', {
    seam: 'draftAltText',
  });
}

/** 크론이 실행 전에 확인하는 환경변수 목록. 비어 있으면 503으로 끊는다. */
export function missingPipelineEnv(): string[] {
  const required = ['IG_ACCESS_TOKEN', 'IG_USER_ID'] as const;
  return required.filter((k) => !process.env[k]);
}
