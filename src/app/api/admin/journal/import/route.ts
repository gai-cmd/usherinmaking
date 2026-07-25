import { requireAdmin } from '@/server/auth';
import { DependencyUnavailableError, errorResponse } from '@/server/errors';
import { getNaverImportConfig, importFromNaverBlog } from '@/server/journal';

export const runtime = 'nodejs';

/** 연동 상태 조회. 설정 여부만 알려 주고 자격증명은 절대 내보내지 않는다. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const config = getNaverImportConfig();
    return Response.json({
      configured: config.configured,
      blogId: config.blogId,
      lastSyncedAt: config.lastSyncedAt?.toISOString() ?? null,
      reason: config.reason ?? null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * 네이버 블로그 수집 트리거.
 * 자격증명이 없으면 503 으로 그 사실을 알린다 — 빈 성공을 돌려주면
 * 관리자는 "가져올 글이 없다"로 읽는다. 그건 사실이 아니다.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const result = await importFromNaverBlog();
    if (!result.ok) {
      throw new DependencyUnavailableError(result.reason);
    }

    return Response.json({
      fetched: result.fetched,
      created: result.created,
      skipped: result.skipped,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
