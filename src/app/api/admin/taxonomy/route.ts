import { requireAdmin } from '@/server/auth';
import { errorResponse } from '@/server/errors';
import { countVisibleTerms, listTaxonomies, listUntranslatedTerms } from '@/server/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 축 · 용어 목록 + 번역 누락 현황. */
export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin(req);

    const [taxonomies, untranslated, visible] = await Promise.all([
      listTaxonomies(),
      listUntranslatedTerms(),
      countVisibleTerms(),
    ]);

    return Response.json(
      { taxonomies, untranslated, visible },
      { headers: { 'cache-control': 'no-store, private' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
