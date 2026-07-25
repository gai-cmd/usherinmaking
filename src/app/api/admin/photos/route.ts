import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import { countPhotos, listPhotos, missingAltLocales, type PhotoFilter } from '@/server/photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  status: z.enum(['UNSORTED', 'PUBLISHED', 'ARCHIVED']).optional(),
  flag: z.enum(['untagged', 'lowres', 'missing-alt']).optional(),
  sort: z.enum(['newest', 'oldest']).optional(),
});

/** 목록 조회. 관리자 전용이므로 미선별·보관도 함께 나간다. */
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

    const { status, flag, sort } = parsed.data;
    const filter: PhotoFilter = {
      status,
      sort,
      untagged: flag === 'untagged' || undefined,
      lowRes: flag === 'lowres' || undefined,
      missingAlt: flag === 'missing-alt' || undefined,
    };

    const [photos, counts] = await Promise.all([listPhotos(filter), countPhotos()]);

    return Response.json({
      counts,
      photos: photos.map((p) => ({
        id: p.id,
        status: p.status,
        originalUrl: p.originalUrl,
        width: p.width,
        height: p.height,
        lowRes: p.lowRes,
        takenAt: p.takenAt.toISOString(),
        caption: p.caption,
        alt: p.alt,
        missingAlt: missingAltLocales(p.alt),
        aiSuggestion: p.aiSuggestion,
        terms: p.terms,
        isCover: p.isCover,
        igMediaId: p.igMediaId,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
