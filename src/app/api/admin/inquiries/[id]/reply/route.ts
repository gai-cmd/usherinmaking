import { z } from 'zod';

import { requireAdmin } from '@/server/auth';
import { NotFoundError, ValidationError, errorResponse } from '@/server/errors';
import { getInquiry, sendReply } from '@/server/inquiries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ReplySchema = z.object({
  body: z.string().min(1).max(8000),
});

/**
 * 답장 발송.
 *
 * 메일은 알림이지 원본이 아니다. 그래서 발송 실패가 문의 처리 실패로 보이면 안 되고,
 * 반대로 발송 성공이 곧 완료 처리도 아니다. 지금은 발송 경로 자체가 없어 501 이 나간다.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const parsed = ReplySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('답장 내용이 올바르지 않습니다.');
    }

    const inquiry = await getInquiry(id);
    if (!inquiry) throw new NotFoundError('문의를 찾을 수 없습니다.');

    // 수신 주소는 여기서만 꺼낸다(revealInquiryEmail). 응답 본문에는 절대 싣지 않는다.
    await sendReply(id, parsed.data.body);

    return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store, private' } });
  } catch (err) {
    return errorResponse(err);
  }
}
