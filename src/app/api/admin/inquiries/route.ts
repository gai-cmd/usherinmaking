import { z } from 'zod';

import { LOCALES } from '@/lib/i18n';
import { requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import { INQUIRY_STATUSES, countByStatus, listInquiries } from '@/server/inquiries';

export const runtime = 'nodejs';
/** 문의는 개인정보다. 어떤 단계에서도 캐시되면 안 된다. */
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  status: z.enum(INQUIRY_STATUSES as [string, ...string[]]).optional(),
  locale: z.enum(LOCALES as unknown as [string, ...string[]]).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

/**
 * 문의 목록.
 *
 * 응답에는 이메일이 들어가지 않는다 — 목록 타입(InquiryListItem)에 아예 없다.
 * 상태 집계는 기간 필터와 무관하게 전체를 세서 돌려준다. 탭 숫자가 필터 때문에
 * 줄어들면 관리자가 문의가 사라진 것으로 읽기 때문이다.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      throw new ValidationError('조회 조건이 올바르지 않습니다.', {
        issues: parsed.error.issues.map((i) => i.path.join('.')),
      });
    }

    const [items, counts] = await Promise.all([
      listInquiries(parsed.data as Parameters<typeof listInquiries>[0]),
      countByStatus(),
    ]);

    return Response.json(
      { items, counts },
      { headers: { 'cache-control': 'no-store, private' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
