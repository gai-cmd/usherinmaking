import { z } from 'zod';

import { requireAdmin } from '@/server/auth';
import { NotFoundError, ValidationError, errorResponse } from '@/server/errors';
import { FAQ_PAGES } from '@/server/faq';
import { getInquiry, promoteToFaq } from '@/server/inquiries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PromoteSchema = z.object({
  /**
   * 문의에 실제로 적힌 문장 그대로. 요약이나 의역을 받지 않는다 —
   * FAQ 는 고객이 쓴 표현이 남아야 의미가 있고, 그래야 AI 검색이 인용할 수 있다.
   */
  questionVerbatim: z.string().min(2).max(300),
  page: z.enum(FAQ_PAGES as [string, ...string[]]).nullable(),
});

/**
 * 문의 문장을 FAQ로 승격.
 *
 * 승격 문장이 정말 문의 본문에 있는 문장인지 서버에서 다시 확인한다.
 * 클라이언트가 임의 문장을 보내면 "고객 원문 그대로"라는 전제가 깨지기 때문이다.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const parsed = PromoteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('승격할 문장이 올바르지 않습니다.', {
        issues: parsed.error.issues.map((i) => i.path.join('.') || 'body'),
      });
    }

    const inquiry = await getInquiry(id);
    if (!inquiry) throw new NotFoundError('문의를 찾을 수 없습니다.');

    const verbatim = parsed.data.questionVerbatim.trim();
    if (!inquiry.message.includes(verbatim)) {
      throw new ValidationError(
        'FAQ로 올릴 문장은 문의 본문에 있는 문장 그대로여야 합니다. 다듬거나 요약하지 마세요.',
      );
    }

    const faq = await promoteToFaq(id, {
      questionVerbatim: verbatim,
      page: parsed.data.page as never,
    });

    return Response.json(
      { ok: true, faqId: faq.id },
      { headers: { 'cache-control': 'no-store, private' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
