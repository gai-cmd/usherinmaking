import { z } from 'zod';

import { requireAdmin } from '@/server/auth';
import { NotFoundError, ValidationError, errorResponse } from '@/server/errors';
import {
  INQUIRY_STATUSES,
  getInquiry,
  updateInquiryMemo,
  updateInquiryStatus,
} from '@/server/inquiries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchSchema = z
  .object({
    status: z.enum(INQUIRY_STATUSES as [string, ...string[]]).optional(),
    memo: z.string().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.memo !== undefined, {
    message: 'status 또는 memo 중 하나는 있어야 합니다.',
  });

/** 상세 조회. 이메일은 마스킹된 값만 나간다. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const inquiry = await getInquiry(id);
    if (!inquiry) throw new NotFoundError('문의를 찾을 수 없습니다.');

    return Response.json(inquiry, { headers: { 'cache-control': 'no-store, private' } });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * 상태·메모 변경.
 *
 * 저장 경로는 아직 없다. NotImplementedError 가 501 로 그대로 나가고,
 * 화면은 그 501 을 실패로 표시한다 — 성공 토스트를 띄우지 않는다.
 * 제출한 내용을 그대로 되돌려 주지도 않는다(에코 금지).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        issues: parsed.error.issues.map((i) => i.path.join('.') || 'body'),
      });
    }

    const inquiry = await getInquiry(id);
    if (!inquiry) throw new NotFoundError('문의를 찾을 수 없습니다.');

    if (parsed.data.status) {
      await updateInquiryStatus(id, parsed.data.status as never);
    }
    if (parsed.data.memo !== undefined) {
      await updateInquiryMemo(id, parsed.data.memo);
    }

    return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store, private' } });
  } catch (err) {
    return errorResponse(err);
  }
}
