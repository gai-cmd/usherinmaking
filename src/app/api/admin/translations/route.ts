import { z } from 'zod';
import { LOCALES } from '@/lib/i18n';
import { requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import { listTranslationFields, saveTranslationField } from '@/server/translations';
import { getPlan, revalidatePlanSurfaces } from '@/server/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SaveSchema = z
  .object({
    key: z.string().min(3).max(120),
    locale: z.enum(LOCALES),
    value: z.string().max(4000),
    reviewed: z.literal(true),
  })
  .strict();

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const fields = await listTranslationFields();
    return Response.json({ fields }, { headers: { 'cache-control': 'no-store, private' } });
  } catch (err) {
    return errorResponse(err);
  }
}

/** 번역 한 칸 저장. 지금은 플랜(title/duration/includes)만 저장된다 — 나머지는 422 로 이유를 돌려준다. */
export async function PATCH(req: Request) {
  try {
    await requireAdmin(req);

    const parsed = SaveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        issues: parsed.error.issues.map((i) => i.path.join('.') || 'body'),
      });
    }

    const saved = await saveTranslationField(parsed.data);

    // 플랜 문구는 홈·플랜 페이지에 바로 보인다. 저장 즉시 그 화면들을 다시 만든다.
    const code = parsed.data.key.split('.')[1];
    const plan = await getPlan(code);
    const { revalidated } = plan ? await revalidatePlanSurfaces(plan) : { revalidated: false };

    return Response.json(
      { ok: true, field: saved, revalidated },
      { headers: { 'cache-control': 'no-store, private' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
