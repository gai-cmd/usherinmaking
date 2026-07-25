// 미디어 자산 저장소 — 업로드 · 목록 · 삭제.
//
// schema.prisma의 MediaAsset과 1:1이다. "관리자가 올린 원본"과 "인스타에서 수집한 원본"이
// 같은 표에 들어오고 source로 구분한다.
//
// 이 파일은 실제로 저장한다. 스텁이 아니다:
//   업로드 = Vercel Blob에 원본을 올리고 → MediaAsset 행을 만든다.
// 둘 중 하나라도 실패하면 성공을 반환하지 않는다. 특히 DB가 없으면 업로드 자체를 막는다 —
// 스토리지에만 올라가고 목록에 없는 파일은 아무도 찾을 수 없는 쓰레기가 되기 때문이다.

import { randomUUID } from 'node:crypto';

import { isDatabaseConfigured, prisma } from '@/server/db';
import { DependencyUnavailableError, NotFoundError, ValidationError } from '@/server/errors';
import {
  MAX_UPLOAD_BYTES,
  buildVariantMap,
  deleteStored,
  encodeRenditions,
  extensionForMime,
  isAllowedUploadMime,
  isBlobConfigured,
  isLowRes,
  originalKey,
  planRenditions,
  probeImageDimensions,
  storeOriginal,
  type VariantMap,
} from '@/lib/image-pipeline';

/* ============================ 타입 ============================ */

export type MediaSource = 'manual' | 'instagram';

/** prisma/schema.prisma model MediaAsset 과 1:1. */
export type MediaAsset = {
  id: string;
  url: string;
  pathname: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  source: MediaSource;
  uploadedBy: string | null;
  createdAt: Date;
  /** 파생 정보 — 장변 기준 저해상도 판정. 원본 교체를 유도하는 배지에 쓴다. */
  lowRes: boolean;
};

export type MediaFilter = {
  source?: MediaSource;
  /** 저해상도만 */
  lowRes?: boolean;
  limit?: number;
};

export type MediaCounts = {
  total: number;
  manual: number;
  instagram: number;
  lowRes: number;
  /** 원본 용량 합계. size가 없는 행은 제외되므로 하한값이다. */
  bytes: number;
};

export type UploadInput = {
  bytes: ArrayBuffer;
  /** 원래 파일명. 스토리지 키에는 쓰지 않고 기록용으로만 남긴다. */
  filename: string;
  mimeType: string;
  uploadedBy: string | null;
  source?: MediaSource;
  /**
   * AVIF / WebP 파생본까지 만들지.
   * 페이지 이미지 슬롯은 next/image가 다시 최적화하므로 기본은 원본만 올린다.
   */
  withRenditions?: boolean;
};

export type UploadResult = {
  asset: MediaAsset;
  /** withRenditions가 false면 null. */
  variants: VariantMap | null;
};

/* ============================ 매핑 ============================ */

type MediaRow = {
  id: string;
  url: string;
  pathname: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  source: string;
  uploadedBy: string | null;
  createdAt: Date;
};

function fromDb(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    url: row.url,
    pathname: row.pathname,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    source: row.source === 'instagram' ? 'instagram' : 'manual',
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
    lowRes: row.width !== null && row.height !== null ? isLowRes(row.width, row.height) : false,
  };
}

/* ============================ 읽기 ============================ */

/**
 * DB가 없으면 빈 목록. 시드 폴백을 두지 않는 이유:
 * 미디어 라이브러리는 "실제로 올라간 파일"의 목록이라, 가짜 항목을 보여주면
 * 지우거나 슬롯에 걸 수 없는 유령이 생긴다. 화면은 "연결 안 됨"을 그대로 표시한다.
 */
export async function listMedia(filter: MediaFilter = {}): Promise<MediaAsset[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await prisma.mediaAsset.findMany({
    where: filter.source ? { source: filter.source } : undefined,
    orderBy: { createdAt: 'desc' },
    take: filter.limit ?? 200,
  });

  const assets = rows.map(fromDb);
  return filter.lowRes ? assets.filter((a) => a.lowRes) : assets;
}

export async function getMedia(id: string): Promise<MediaAsset | null> {
  if (!isDatabaseConfigured()) return null;
  const row = await prisma.mediaAsset.findUnique({ where: { id } });
  return row ? fromDb(row) : null;
}

export async function countMedia(): Promise<MediaCounts> {
  if (!isDatabaseConfigured()) {
    return { total: 0, manual: 0, instagram: 0, lowRes: 0, bytes: 0 };
  }

  // 저해상도는 width/height 조합 판정이라 SQL 집계로 표현하기 번거롭다.
  // 자산 수가 수천 단위를 넘지 않는 규모이므로 한 번 읽어 세는 편이 단순하다.
  const rows = await prisma.mediaAsset.findMany({
    select: { source: true, size: true, width: true, height: true },
  });

  let manual = 0;
  let instagram = 0;
  let lowRes = 0;
  let bytes = 0;

  for (const r of rows) {
    if (r.source === 'instagram') instagram += 1;
    else manual += 1;
    if (r.size) bytes += r.size;
    if (r.width && r.height && isLowRes(r.width, r.height)) lowRes += 1;
  }

  return { total: rows.length, manual, instagram, lowRes, bytes };
}

/* ============================ 업로드 ============================ */

/**
 * 업로드 검증. API와 이 모듈이 같은 규칙을 쓰도록 여기서 한 번만 정의한다.
 * 클라이언트가 보낸 mime을 1차로 거르고, 실제 픽셀 판독(probeImageDimensions)이 2차 관문이다.
 */
export function assertUploadable(mimeType: string, byteLength: number): void {
  if (!isAllowedUploadMime(mimeType)) {
    throw new ValidationError('이미지 파일만 올릴 수 있습니다 (JPEG · PNG · WebP · AVIF · GIF).', {
      received: mimeType,
    });
  }
  if (byteLength <= 0) {
    throw new ValidationError('빈 파일입니다.');
  }
  if (byteLength > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `파일이 너무 큽니다. ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB 이하로 올려 주세요.`,
      { limitBytes: MAX_UPLOAD_BYTES, receivedBytes: byteLength },
    );
  }
}

/**
 * 원본을 스토리지에 올리고 MediaAsset 행을 만든다.
 *
 * 순서가 중요하다: 판독 → 저장 → 기록.
 * 판독을 먼저 하는 이유는, 이미지가 아닌 파일을 스토리지에 올려 놓고 나서 되돌리는 상황을
 * 만들지 않기 위해서다. 기록(DB)에 실패하면 방금 올린 파일을 지우고 예외를 던진다 —
 * 스토리지에만 남은 고아 파일을 만들지 않는다.
 */
export async function uploadMedia(input: UploadInput): Promise<UploadResult> {
  if (!isBlobConfigured()) {
    throw new DependencyUnavailableError(
      '스토리지가 연결되지 않아 업로드할 수 없습니다 (BLOB_READ_WRITE_TOKEN 미설정).',
      { seam: 'uploadMedia' },
    );
  }
  if (!isDatabaseConfigured()) {
    // 스토리지에만 올리면 목록에 안 잡히는 파일이 된다. 올리기 전에 끊는다.
    throw new DependencyUnavailableError(
      'DB가 연결되지 않아 업로드를 기록할 수 없습니다. 업로드를 진행하지 않았습니다.',
      { seam: 'uploadMedia' },
    );
  }

  assertUploadable(input.mimeType, input.bytes.byteLength);

  // 실측. 클라이언트가 보낸 값은 쓰지 않는다.
  const { width, height } = await probeImageDimensions(input.bytes);

  const assetId = randomUUID();
  const ext = extensionForMime(input.mimeType);
  const key = originalKey(assetId, ext);

  const url = await storeOriginal(key, input.bytes);

  let variants: VariantMap | null = null;

  try {
    if (input.withRenditions) {
      const plan = planRenditions({ id: assetId, width, height });
      variants = await encodeRenditions(input.bytes, plan);
    }

    const row = await prisma.mediaAsset.create({
      data: {
        url,
        pathname: key,
        mimeType: input.mimeType,
        size: input.bytes.byteLength,
        width,
        height,
        source: input.source ?? 'manual',
        uploadedBy: input.uploadedBy,
      },
    });

    return { asset: fromDb(row), variants };
  } catch (err) {
    // 기록에 실패했으면 방금 올린 것을 되돌린다. 원본만이 아니라 파생본까지 —
    // photos/<id>/ 접두사 아래를 통째로 지워야 고아 파일이 남지 않는다.
    // 되돌리기가 또 실패해도 원래 오류를 덮지 않는다.
    await deleteStoredPrefix(`photos/${assetId}/`).catch((cleanupErr) => {
      console.error(
        '[media] 업로드 롤백 실패 — 스토리지에 고아 파일이 남았습니다',
        `photos/${assetId}/`,
        cleanupErr,
      );
    });
    throw err;
  }
}

/* ============================ 삭제 ============================ */

/**
 * 자산 삭제. 스토리지 파일을 먼저 지우고 행을 지운다.
 *
 * 순서를 이렇게 둔 이유: 행이 먼저 사라지면 스토리지 파일을 가리킬 방법이 없어져
 * 영구히 남는다. 반대로 파일이 먼저 사라지고 행 삭제가 실패하면 화면에 깨진 항목이
 * 보이지만, 그건 다시 지울 수 있는 상태다.
 *
 * 로컬 /images/* 경로는 저장소가 아니라 리포지토리에 있는 파일이라 건드리지 않는다.
 */
export async function deleteMedia(id: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new DependencyUnavailableError('DB가 연결되지 않아 삭제할 수 없습니다.', {
      seam: 'deleteMedia',
    });
  }

  const asset = await getMedia(id);
  if (!asset) throw new NotFoundError('미디어를 찾을 수 없습니다.');

  if (asset.url.startsWith('http')) {
    await deleteStored([asset.url]);
  }

  await prisma.mediaAsset.delete({ where: { id } });
}
