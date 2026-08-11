/**
 * 이미지 파이프라인의 상수·타입·순수 함수.
 *
 * image-pipeline.ts 에서 떼어낸 이유: 그쪽은 sharp 와 @vercel/blob 을 import 하는데,
 * 클라이언트 컴포넌트가 타입 하나 때문에 그 파일을 import 하면 node 내장 모듈이
 * 브라우저 번들로 딸려 들어가 빌드가 깨진다. 서버 전용 코드가 없는 부분만 여기 둔다.
 */

export const RENDITION_WIDTHS = [400, 800, 1600] as const;
export type RenditionWidth = (typeof RENDITION_WIDTHS)[number];

/** AVIF 우선, WebP 폴백. 원본 포맷(JPEG)은 서빙하지 않는다. */
export const RENDITION_FORMATS = ['avif', 'webp'] as const;
export type RenditionFormat = (typeof RENDITION_FORMATS)[number];

/** 장변이 이 값 미만이면 저해상도. 관리자 화면에서 원본 교체를 유도한다. */
export const LOW_RES_MIN_LONG_EDGE = 2000;

/** 인코딩 품질. AVIF는 같은 화질을 더 낮은 수치로 낸다. */
export const RENDITION_QUALITY: Record<RenditionFormat, number> = { avif: 50, webp: 72 };

/* ---------------- 업로드 허용 규격 ---------------- */
//
// 서버가 최종 판정자다. 클라이언트가 보낸 mime/크기는 참고값일 뿐이고,
// 실제 통과 여부는 아래 상수와 sharp 판독 결과로만 정한다.

/** 원본 1장 상한. 스마트폰 RAW 변환본(≈30MB)까지는 받고 그 이상은 거절한다. */
export const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

/** 허용 입력 포맷. HEIC는 sharp 빌드에 따라 없을 수 있어 넣지 않는다. */
export const ALLOWED_UPLOAD_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;
export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIME)[number];

export function isAllowedUploadMime(mime: string | null | undefined): mime is AllowedUploadMime {
  return Boolean(mime) && (ALLOWED_UPLOAD_MIME as readonly string[]).includes(mime!);
}

/** mime → 원본 확장자. 스토리지 키를 만들 때만 쓴다. */
export function extensionForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
  };
  return map[mime] ?? 'bin';
}

/** 확장자 → Content-Type. storeOriginal이 키만 받으므로 여기서 되돌린다. */
export function mimeForExtension(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    mp4: 'video/mp4',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}

/** Photo.variants(Json)의 형태. 폭 → URL. */
export type VariantMap = Record<RenditionFormat, Partial<Record<`${RenditionWidth}`, string>>>;

/** 장변 기준 저해상도 판정. Photo.lowRes에 그대로 들어간다. */
export function isLowRes(width: number, height: number): boolean {
  return Math.max(width, height) < LOW_RES_MIN_LONG_EDGE;
}
