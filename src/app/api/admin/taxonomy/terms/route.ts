import { z } from 'zod';

import { AXIS_ORDER } from '@/content/taxonomy';
import { LOCALES } from '@/lib/i18n';
import { requireAdmin } from '@/server/auth';
import { ValidationError, errorResponse } from '@/server/errors';
import {
  findSlugConflict,
  findSlugConflictInDb,
  getTermById,
  slugChangeWarning,
  slugError,
  termUrlsIncludingCombinations,
  upsertTerm,
} from '@/server/taxonomy';
import type { UpsertTermInput } from '@/server/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TermSchema = z.object({
  taxonomyKey: z.enum(AXIS_ORDER as unknown as [string, ...string[]]),
  termId: z.string().max(64).optional(),
  slug: z.string().min(1).max(48),
  label: z.object(
    Object.fromEntries(
      LOCALES.map((l) => [l, z.string().max(80).optional()]),
    ) as Record<string, z.ZodOptional<z.ZodString>>,
  ),
  order: z.number().int().min(0).max(999),
  parentGroup: z.string().max(32).nullable(),
  /** 살아 있는 주소가 끊기는 변경임을 관리자가 확인했는지. 미확인이면 409 로 되돌린다. */
  acknowledgeSlugChange: z.boolean().optional(),
});

/**
 * 용어 저장.
 *
 * 갤러리 필터는 경로이므로 slug 는 공개 URL 세그먼트다. 슬러그를 바꾸는 요청은
 * 무엇이 끊기는지 먼저 돌려주고, 관리자가 확인(acknowledgeSlugChange)하기 전에는 진행하지 않는다.
 */
export async function PUT(req: Request): Promise<Response> {
  try {
    await requireAdmin(req);

    const parsed = TermSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('용어 입력값이 올바르지 않습니다.', {
        issues: parsed.error.issues.map((i) => i.path.join('.') || 'body'),
      });
    }

    const { acknowledgeSlugChange, ...data } = parsed.data;
    const input = data as unknown as UpsertTermInput;

    const err = slugError(input.slug);
    if (err) throw new ValidationError(err);

    const conflict = findSlugConflict(input.slug, input.termId);
    if (conflict) {
      throw new ValidationError(
        `이미 쓰이는 슬러그입니다 (${conflict.taxonomyKey} / ${conflict.slug}). 갤러리 주소가 겹칩니다.`,
      );
    }

    // 코드 시드에 없어도 DB 에는 있을 수 있다. 여기서 걸러야 422 로 답할 수 있고,
    // 놓치면 저장 단계에서 500 이 된다.
    const dbConflict = await findSlugConflictInDb(input.slug, input.termId);
    if (dbConflict) {
      throw new ValidationError(
        `이미 쓰이는 슬러그입니다 (${dbConflict.taxonomyKey} / ${dbConflict.slug}). 갤러리 주소가 겹칩니다.`,
      );
    }

    // 기존 용어의 슬러그를 바꾸는 경우 — 끊길 주소를 먼저 알린다.
    if (input.termId) {
      const existing = await getTermById(input.termId);
      if (!existing) throw new ValidationError('수정하려는 용어를 찾을 수 없습니다.');

      if (existing.slug !== input.slug && !acknowledgeSlugChange) {
        const warning = slugChangeWarning(existing.slug, input.slug);
        return Response.json(
          {
            error: {
              code: 'SLUG_CHANGE_UNCONFIRMED',
              message: warning?.message ?? '슬러그 변경 확인이 필요합니다.',
              details: { breaking: warning?.breaking ?? [] },
            },
          },
          { status: 409, headers: { 'cache-control': 'no-store, private' } },
        );
      }
    }

    // upsertTerm 이 저장 후 옛 주소와 새 주소를 모두 무효화한다.
    // TODO(redirect): 옛 주소용 리디렉션은 아직 없다 — 색인된 옛 주소는 404 로 남는다.
    await upsertTerm(input);

    return Response.json(
      { ok: true, urls: termUrlsIncludingCombinations(input.slug).map((u) => u.url) },
      { headers: { 'cache-control': 'no-store, private' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
