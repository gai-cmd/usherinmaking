// 이미지 파이프라인 — 계약과 순수 함수는 여기서 확정하고, 실제 외부 호출은 이름 붙인 seam으로 남긴다.
//
// 지금 시점에 없는 것: 인스타 액세스 토큰, 오브젝트 스토리지, AI 제공자.
// 그래서 "무엇을 어떤 규격으로 만들 것인가"(상수 · 순수 함수)는 지금 확정해 테스트 가능하게 두고,
// "실제로 네트워크를 타는 부분"만 TODO(pipeline) seam으로 비워 둔다.
// seam은 성공을 흉내내지 않고 DependencyUnavailableError를 던진다.

import { del, put } from '@vercel/blob';
import sharp from 'sharp';
import {
  ALLOWED_UPLOAD_MIME,
  LOW_RES_MIN_LONG_EDGE,
  MAX_UPLOAD_BYTES,
  RENDITION_FORMATS,
  RENDITION_QUALITY,
  RENDITION_WIDTHS,
  extensionForMime,
  isAllowedUploadMime,
  isLowRes,
  mimeForExtension,
  type AllowedUploadMime,
  type RenditionFormat,
  type RenditionWidth,
  type VariantMap,
} from '@/lib/image-contract';
import { DependencyUnavailableError, ValidationError } from '@/server/errors';

/* ============================ 규격 (확정) ============================ */

/** 프론트 서빙 규격. 원본은 스토리지에 그대로 두고 이 3단계만 서빙한다. */
export * from '@/lib/image-contract';

export type Rendition = {
  format: RenditionFormat;
  width: RenditionWidth;
  /** 원본 비율을 유지한 결과 높이 */
  height: number;
  /** 스토리지 키 */
  key: string;
};

/* ============================ 순수 함수 ============================ */


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
// 인스타 조회(fetchInstagramMedia)만 실제로 연결되어 있다. 나머지는 아직 비어 있고,
// 각각 "무엇이 붙으면 풀리는지"를 메시지에 적어 둔다.
// 호출측(크론 라우트)은 이 예외를 잡아 IngestRun에 실패로 기록한다.

/** Graph API 호스트. Instagram Login 방식으로 발급한 토큰이면 graph.instagram.com으로 바꾼다. */
const IG_GRAPH_HOST = process.env.IG_GRAPH_HOST ?? 'graph.facebook.com';
/** 버전을 고정한다 — 생략하면 앱의 기본 버전을 따라가 어느 날 조용히 깨진다. */
const IG_API_VERSION = process.env.IG_API_VERSION ?? 'v25.0';
/** Graph API가 한 페이지에 허용하는 상한. */
const IG_PAGE_LIMIT = 100;
/** 폭주 방지용 페이지 상한. 도달하면 조용히 자르지 않고 경고를 남긴다. */
const IG_MAX_PAGES = 500;

/** width/height는 IG Media 필드 목록에 없다 — 요청해도 오지 않으므로 넣지 않는다. */
const IG_MEDIA_FIELDS = [
  'id',
  'media_type',
  'media_url',
  'permalink',
  'caption',
  'timestamp',
  'children{id,media_type,media_url}',
].join(',');

export type InstagramMedia = {
  id: string;
  mediaUrl: string;
  permalink: string;
  caption: string | null;
  timestamp: string;
  /**
   * Graph API는 미디어 크기를 돌려주지 않는다(IG Media 필드 목록에 width/height 없음).
   * 그래서 수집 시점에는 null이고, 원본을 내려받은 뒤 probeImageDimensions로 실측한다.
   * 여기서 임의의 기본값을 채우면 저해상도 판정이 통째로 거짓이 되므로 채우지 않는다.
   */
  width: number | null;
  height: number | null;
};

export type InstagramCredentials = { accessToken: string; userId: string };

/** Graph API 응답의 필요한 부분만. 나머지 필드는 요청하지 않으므로 정의하지 않는다. */
export type IgApiChild = { id: string; media_type?: string; media_url?: string };
export type IgApiItem = {
  id: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  caption?: string;
  timestamp?: string;
  children?: { data?: IgApiChild[] };
};
type IgApiPage = { data?: IgApiItem[]; paging?: { next?: string } };

/**
 * API 응답 → 수집 단위(순수 함수).
 * 캐러셀은 자식 사진 각각이 한 장으로 풀린다 — 갤러리의 단위는 게시물이 아니라 사진이기 때문이다.
 * 캡션·촬영시각·퍼머링크는 부모 것을 물려받는다(Graph API가 자식에 캡션을 주지 않는다).
 * 동영상은 Photo 파이프라인 대상이 아니므로 제외한다.
 */
export function flattenInstagramMedia(items: IgApiItem[]): InstagramMedia[] {
  const out: InstagramMedia[] = [];

  for (const item of items) {
    const inherited = {
      permalink: item.permalink ?? '',
      caption: item.caption ?? null,
      timestamp: item.timestamp ?? '',
      width: null,
      height: null,
    };

    if (item.media_type === 'CAROUSEL_ALBUM') {
      for (const child of item.children?.data ?? []) {
        if (child.media_type !== 'IMAGE' || !child.media_url) continue;
        out.push({ id: child.id, mediaUrl: child.media_url, ...inherited });
      }
      continue;
    }

    if (item.media_type !== 'IMAGE' || !item.media_url) continue;
    out.push({ id: item.id, mediaUrl: item.media_url, ...inherited });
  }

  return out;
}

/** Graph API 오류 응답 → 원인이 드러나는 예외. 토큰 만료가 압도적으로 흔하므로 따로 짚는다. */
function instagramApiError(status: number, body: unknown): DependencyUnavailableError {
  const err = (body as { error?: { message?: string; code?: number; type?: string } } | null)?.error;
  const hint =
    err?.code === 190
      ? ' 액세스 토큰이 만료되었거나 무효합니다 — 장기 토큰을 재발급하세요.'
      : '';

  return new DependencyUnavailableError(
    `Instagram Graph API 호출 실패 (HTTP ${status}).${hint}`,
    {
      seam: 'fetchInstagramMedia',
      status,
      apiCode: err?.code,
      apiType: err?.type,
      apiMessage: err?.message,
    },
  );
}

/**
 * 계정의 게시물을 전량 페이지네이션하며 가져온다. 전량 수집이 원칙이므로 건수 상한을 두지 않는다.
 * (IG_MAX_PAGES는 무한 루프 방어일 뿐이며, 걸리면 경고를 남긴다.)
 */
export async function fetchInstagramMedia(creds: InstagramCredentials): Promise<InstagramMedia[]> {
  const base = `https://${IG_GRAPH_HOST}/${IG_API_VERSION}/${encodeURIComponent(creds.userId)}/media`;
  const params = new URLSearchParams({
    fields: IG_MEDIA_FIELDS,
    limit: String(IG_PAGE_LIMIT),
    access_token: creds.accessToken,
  });

  // paging.next는 access_token까지 포함한 완성 URL이므로 그대로 따라가면 된다.
  let url: string | undefined = `${base}?${params.toString()}`;
  const out: InstagramMedia[] = [];
  let pages = 0;

  while (url) {
    if (pages >= IG_MAX_PAGES) {
      console.warn('[ingest] 페이지 상한 도달 — 이후 게시물은 조회하지 않았다', {
        pages,
        collected: out.length,
      });
      break;
    }

    const res = await fetch(url, { cache: 'no-store' });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw instagramApiError(res.status, body);

    const page = body as IgApiPage;
    out.push(...flattenInstagramMedia(page.data ?? []));
    url = page.paging?.next;
    pages += 1;
  }

  return out;
}

/** 스토리지 토큰 확인. 없으면 "저장된 척"이 아니라 503으로 끊는다. */
export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function requireBlobToken(seam: string): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new DependencyUnavailableError(
      '오브젝트 스토리지가 연결되지 않았습니다 (BLOB_READ_WRITE_TOKEN 미설정).',
      { seam },
    );
  }
  return token;
}

/**
 * 원격 원본을 내려받는다. 인스타 수집 경로가 쓴다.
 * 상한을 넘는 응답은 통째로 메모리에 올리기 전에 끊는다.
 */
export async function downloadOriginal(mediaUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(mediaUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new DependencyUnavailableError(`원본 다운로드 실패 (HTTP ${res.status}).`, {
      seam: 'downloadOriginal',
      status: res.status,
    });
  }

  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > MAX_UPLOAD_BYTES) {
    throw new ValidationError('원본이 허용 크기를 넘었습니다.', {
      seam: 'downloadOriginal',
      limitBytes: MAX_UPLOAD_BYTES,
    });
  }

  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    // content-length가 없거나 거짓말인 경우가 있어 실측으로 한 번 더 막는다.
    throw new ValidationError('원본이 허용 크기를 넘었습니다.', {
      seam: 'downloadOriginal',
      limitBytes: MAX_UPLOAD_BYTES,
    });
  }
  return bytes;
}

/**
 * 내려받은 바이트에서 실제 픽셀 크기를 잰다.
 * 클라이언트가 보낸 값을 믿지 않는 이유: 저해상도 판정과 파생본 계획이 전부 이 값에 걸려 있다.
 */
export async function probeImageDimensions(
  bytes: ArrayBuffer,
): Promise<{ width: number; height: number }> {
  let meta;
  try {
    meta = await sharp(Buffer.from(bytes)).metadata();
  } catch (cause) {
    // sharp가 못 읽으면 이미지가 아니거나 깨진 파일이다 — 저장 전에 끊는다.
    throw new ValidationError('이미지를 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.', {
      seam: 'probeImageDimensions',
      reason: cause instanceof Error ? cause.message : 'unknown',
    });
  }

  // EXIF 회전이 걸린 사진은 metadata의 width/height가 회전 전 값이다.
  // 서빙되는 것은 회전 후이므로 여기서 뒤집어 실제로 보이는 치수를 돌려준다.
  const rotated = typeof meta.orientation === 'number' && meta.orientation >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;

  if (!width || !height) {
    throw new ValidationError('이미지 크기를 판독하지 못했습니다.', {
      seam: 'probeImageDimensions',
    });
  }
  return { width, height };
}

/** 오브젝트 스토리지(Vercel Blob) 업로드. 반환값이 공개 URL이다. */
export async function storeOriginal(key: string, bytes: ArrayBuffer): Promise<string> {
  const token = requireBlobToken('storeOriginal');
  const ext = key.split('.').pop() ?? '';

  const blob = await put(key, Buffer.from(bytes), {
    access: 'public',
    token,
    contentType: mimeForExtension(ext),
    // 키를 우리가 만들므로 임의 접미사를 붙이지 않는다 — 같은 사진을 다시 올리면 덮어쓴다.
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

/**
 * AVIF / WebP 다중 폭 재인코딩 후 업로드.
 * 만들 목록 자체는 planRenditions가 확정한다 — 여기서는 실제 인코딩과 저장만 담당한다.
 */
export async function encodeRenditions(
  bytes: ArrayBuffer,
  plan: Rendition[],
): Promise<VariantMap> {
  const token = requireBlobToken('encodeRenditions');
  const source = Buffer.from(bytes);
  const map = emptyVariants();

  // 폭이 큰 것부터 순서대로. 병렬로 돌리면 서버리스 메모리 한도를 넘기 쉬워 직렬로 둔다.
  for (const r of plan) {
    const pipeline = sharp(source)
      // EXIF 회전을 먼저 굽는다. 이후 리사이즈 치수가 눈에 보이는 방향과 일치한다.
      .rotate()
      .resize({ width: r.width, withoutEnlargement: true });

    const encoded =
      r.format === 'avif'
        ? await pipeline.avif({ quality: RENDITION_QUALITY.avif }).toBuffer()
        : await pipeline.webp({ quality: RENDITION_QUALITY.webp }).toBuffer();

    const blob = await put(r.key, encoded, {
      access: 'public',
      token,
      contentType: `image/${r.format}`,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    map[r.format][`${r.width}`] = blob.url;
  }

  return map;
}

/**
 * 업로드된 자산 삭제. 원본과 파생본을 함께 지운다.
 * 이미 없는 URL은 오류가 아니다 — 목록에서 지우는 것이 목적이므로 조용히 넘어간다.
 */
export async function deleteStored(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const token = requireBlobToken('deleteStored');
  await del(urls, { token });
}

/** VariantMap 안의 모든 파생본 URL. 삭제할 때 쓴다. */
export function variantUrls(variants: VariantMap | null | undefined): string[] {
  if (!variants) return [];
  return RENDITION_FORMATS.flatMap((f) => Object.values(variants[f] ?? {})).filter(
    (u): u is string => typeof u === 'string' && u.length > 0,
  );
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
