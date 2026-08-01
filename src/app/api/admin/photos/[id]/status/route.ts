import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { errorResponse, NotFoundError, ValidationError } from '@/server/errors';
import { assertPublishable, getPhoto, updatePhotoStatus } from '@/server/photos';
import { revalidateWorksSurfaces } from '@/server/works';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const StatusSchema = z.object({
  status: z.enum(['UNSORTED', 'PUBLISHED', 'ARCHIVED']),
});

/**
 * 상태 변경 — 이 사이트에서 "공개"가 일어나는 유일한 지점.
 *
 * PUBLISHED로 올릴 때 alt 3개 언어를 강제한다. 화면 쪽 버튼 비활성화와 별개로
 * 여기서 한 번 더 막는다 — API를 직접 호출해도 규칙이 뚫리면 안 된다.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const parsed = StatusSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('status는 UNSORTED · PUBLISHED · ARCHIVED 중 하나여야 합니다.');
    }

    const photo = await getPhoto(id);
    if (!photo) throw new NotFoundError('사진을 찾을 수 없습니다.');

    // 규칙 검증(alt 3개 언어)은 저장 스텁과 무관하게 지금도 실제로 동작한다.
    assertPublishable(photo, parsed.data.status);

    await updatePhotoStatus(id, parsed.data.status);

    // 공개 그리드는 PUBLISHED 가 개입하는 전환에서만 바뀐다 — UNSORTED↔ARCHIVED 는 무관하다.
    const touchesPublic = photo.status === 'PUBLISHED' || parsed.data.status === 'PUBLISHED';
    const { revalidated } = touchesPublic
      ? await revalidateWorksSurfaces()
      : { revalidated: false };
    return Response.json({ ok: true, revalidated });
  } catch (err) {
    return errorResponse(err);
  }
}
