import { z } from 'zod';

import { requireAdmin, currentAdminEmail } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import { assertUploadable, countMedia, listMedia, uploadMedia } from '@/server/media';
import { recordActivity } from '@/server/activity';
import { MAX_UPLOAD_BYTES } from '@/lib/image-pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ============================ 목록 ============================ */

const QuerySchema = z.object({
  source: z.enum(['manual', 'instagram']).optional(),
  flag: z.enum(['lowres']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      throw new ValidationError('조회 조건이 올바르지 않습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      });
    }

    const { source, flag, limit } = parsed.data;
    const [assets, counts] = await Promise.all([
      listMedia({ source, lowRes: flag === 'lowres' || undefined, limit }),
      countMedia(),
    ]);

    return Response.json({
      counts,
      assets: assets.map((a) => ({
        id: a.id,
        url: a.url,
        mimeType: a.mimeType,
        size: a.size,
        width: a.width,
        height: a.height,
        lowRes: a.lowRes,
        source: a.source,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/* ============================ 업로드 ============================ */

/**
 * multipart/form-data 로 파일 1개를 받는다.
 *
 * 검증 순서: 폼 파싱 → mime·크기 → (media 계층에서) 실제 픽셀 판독.
 * 클라이언트가 붙인 type 값은 1차 필터일 뿐이고, sharp가 못 읽는 파일은
 * 그 다음 단계에서 422로 떨어진다.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      throw new ValidationError('multipart/form-data 로 보내 주세요.');
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ValidationError('업로드 본문을 읽지 못했습니다. 파일이 너무 크지 않은지 확인해 주세요.', {
        limitBytes: MAX_UPLOAD_BYTES,
      });
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new ValidationError('file 필드에 파일이 없습니다.');
    }

    // 파생본 생성 여부. 페이지 슬롯용은 next/image가 다시 최적화하므로 기본값은 끄고,
    // 갤러리에 넣을 원본만 켜서 AVIF/WebP 3단계를 만든다.
    const withRenditions = form.get('renditions') === 'true';

    assertUploadable(file.type, file.size);

    const bytes = await file.arrayBuffer();
    const uploadedBy = await currentAdminEmail();

    const { asset, variants } = await uploadMedia({
      bytes,
      filename: file.name,
      mimeType: file.type,
      uploadedBy,
      source: 'manual',
      withRenditions,
    });

    // 로그 실패가 업로드 성공을 뒤집지 않는다.
    await recordActivity({
      actor: uploadedBy ?? 'admin',
      action: `이미지 업로드 — ${asset.width}×${asset.height}`,
      target: asset.id,
      detail: { size: asset.size, renditions: withRenditions },
    }).catch(() => undefined);

    return Response.json(
      {
        asset: {
          id: asset.id,
          url: asset.url,
          width: asset.width,
          height: asset.height,
          size: asset.size,
          mimeType: asset.mimeType,
          lowRes: asset.lowRes,
          source: asset.source,
          createdAt: asset.createdAt.toISOString(),
        },
        variants,
      },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
