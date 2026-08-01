import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { errorResponse, NotFoundError, ValidationError } from '@/server/errors';
import {
  getPhoto,
  missingAltLocales,
  setCoverPhoto,
  setPhotoTerms,
  updatePhotoAlt,
} from '@/server/photos';
import { revalidateWorksSurfaces } from '@/server/works';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const ALT_MAX = 300;

// 부분 수정. 한 번에 alt / 분류 / 대표컷 중 하나 이상을 보낼 수 있다.
const PatchSchema = z
  .object({
    alt: z
      .object({
        ja: z.string().max(ALT_MAX).optional(),
        en: z.string().max(ALT_MAX).optional(),
        ko: z.string().max(ALT_MAX).optional(),
      })
      .optional(),
    termIds: z.array(z.string().max(64)).max(20).optional(),
    isCover: z.literal(true).optional(),
  })
  .refine((v) => v.alt || v.termIds || v.isCover, {
    message: '변경할 항목이 없습니다.',
  });

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const photo = await getPhoto(id);
    if (!photo) throw new NotFoundError('사진을 찾을 수 없습니다.');

    return Response.json({
      photo: {
        ...photo,
        takenAt: photo.takenAt.toISOString(),
        createdAt: photo.createdAt.toISOString(),
        updatedAt: photo.updatedAt.toISOString(),
        missingAlt: missingAltLocales(photo.alt),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      // 제출된 값을 되돌려 보내지 않는다. 어떤 필드가 문제인지만 알려 준다.
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.') || '(body)'),
      });
    }

    const body = parsed.data;

    // 재검증 판단용 — 공개 그리드는 PUBLISHED 사진의 alt·태그가 바뀔 때만 달라진다.
    // 비공개(UNSORTED·ARCHIVED) 사진의 큐레이션 편집은 공개 캐시를 건드릴 이유가 없다.
    const photo = await getPhoto(id);
    if (!photo) throw new NotFoundError('사진을 찾을 수 없습니다.');
    const affectsGrid = photo.status === 'PUBLISHED';

    // 각 쓰기 함수는 대상 존재 확인과 규칙 검증을 실제로 수행한 뒤,
    // 저장 직전에 NotImplementedError를 던진다(501).
    // 앞선 쓰기가 커밋된 뒤 후속 쓰기가 실패할 수 있으므로(부분 성공), 그리드에 반영되는
    // 쓰기가 하나라도 커밋됐다면 실패로 끝나도 재검증은 하고 나간다 — 저장만 되고
    // 화면은 그대로인 닫힌 고리를 만들지 않기 위해서다.
    let gridWritten = false;
    try {
      if (body.alt) {
        await updatePhotoAlt(id, body.alt);
        gridWritten = affectsGrid;
      }
      if (body.termIds) {
        await setPhotoTerms(id, body.termIds);
        gridWritten = gridWritten || affectsGrid;
      }
      if (body.isCover) await setCoverPhoto(id);
    } catch (err) {
      if (gridWritten) await revalidateWorksSurfaces();
      throw err;
    }

    const worksRevalidate = gridWritten ? await revalidateWorksSurfaces() : { revalidated: false };

    return Response.json({ ok: true, revalidated: worksRevalidate.revalidated });
  } catch (err) {
    return errorResponse(err);
  }
}
