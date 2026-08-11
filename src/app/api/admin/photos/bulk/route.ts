import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import {
  bulkUpdatePhotoStatus,
  countPublishedAmong,
  deletePhotos,
  type PhotoStatus,
} from '@/server/photos';
import { revalidateWorksSurfaces } from '@/server/works';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BulkSchema = z.object({
  // 한 번에 다루는 건수 상한. 실수로 전체를 공개하는 사고를 막는다.
  ids: z.array(z.string().min(1).max(64)).min(1).max(200),
  action: z.enum(['publish', 'archive', 'unsort', 'delete']),
});

const ACTION_TO_STATUS: Record<'publish' | 'archive' | 'unsort', PhotoStatus> = {
  publish: 'PUBLISHED',
  archive: 'ARCHIVED',
  unsort: 'UNSORTED',
};

/** 일괄 상태 변경. publish는 대상 전체가 alt 3개 언어를 갖췄을 때만 통과한다. */
export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const parsed = BulkSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('ids(1~200건)와 action이 필요합니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.') || '(body)'),
      });
    }

    const { ids, action } = parsed.data;
    // 중복 id는 여기서 정리한다 — 아래 계층이 건수를 잘못 세지 않도록.
    const unique = [...new Set(ids)];

    // 공개 그리드는 PUBLISHED 가 개입하는 전환에서만 바뀐다. publish 는 항상 개입하고,
    // 나머지는 대상에 PUBLISHED 가 있었을 때만이다 — 변경 전에 재야 한다.
    const hadPublished = action !== 'publish' && (await countPublishedAmong(unique)) > 0;

    // 삭제는 행을 지우고 그 게시물을 수집 제외 목록에 올린다 — 동기화해도 다시 오지 않는다.
    if (action === 'delete') {
      const { deleted, blocked } = await deletePhotos(unique);
      const { revalidated } = hadPublished
        ? await revalidateWorksSurfaces()
        : { revalidated: false };
      return Response.json({ ok: true, count: deleted, blocked, revalidated });
    }

    await bulkUpdatePhotoStatus(unique, ACTION_TO_STATUS[action]);

    const touchesPublic = action === 'publish' || hadPublished;
    const { revalidated } = touchesPublic
      ? await revalidateWorksSurfaces()
      : { revalidated: false };
    return Response.json({ ok: true, count: unique.length, revalidated });
  } catch (err) {
    return errorResponse(err);
  }
}
