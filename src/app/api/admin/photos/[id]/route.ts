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

    // 각 쓰기 함수는 대상 존재 확인과 규칙 검증을 실제로 수행한 뒤,
    // 저장 직전에 NotImplementedError를 던진다(501).
    if (body.alt) await updatePhotoAlt(id, body.alt);
    if (body.termIds) await setPhotoTerms(id, body.termIds);
    if (body.isCover) await setCoverPhoto(id);

    // alt·태그는 작품 그리드(홈·스튜디오·로케이션)의 선별과 표기에 쓰인다 —
    // 저장만 하고 재검증을 빠뜨리면 "저장은 되는데 화면은 그대로"인 닫힌 고리가 된다.
    const worksRevalidate =
      body.alt || body.termIds ? await revalidateWorksSurfaces() : { revalidated: false };

    return Response.json({ ok: true, revalidated: worksRevalidate.revalidated });
  } catch (err) {
    return errorResponse(err);
  }
}
