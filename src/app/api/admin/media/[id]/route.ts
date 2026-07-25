import { currentAdminEmail, requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import { deleteMedia, getMedia } from '@/server/media';
import { recordActivity } from '@/server/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const asset = await getMedia(id);
    if (!asset) return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

    return Response.json({
      asset: { ...asset, createdAt: asset.createdAt.toISOString() },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** 스토리지 파일과 DB 행을 함께 지운다. 되돌릴 수 없다. */
export async function DELETE(req: Request, { params }: Params) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) throw new ValidationError('삭제할 자산 id가 없습니다.');

    const actor = await currentAdminEmail();
    await deleteMedia(id);

    await recordActivity({
      actor: actor ?? 'admin',
      action: '이미지 삭제',
      target: id,
    }).catch(() => undefined);

    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
