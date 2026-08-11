import { requireCronSecret } from '@/server/auth';
import { errorResponse } from '@/server/errors';
import { runInstagramIngest } from '@/server/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 하루 한 번 — vercel.json 의 crons 항목이 이 경로를 가리킨다.
export const maxDuration = 300;

/**
 * 드레스 룩북(@usherindress) 수집 크론.
 *
 * 작품 계정 크론과 같은 오케스트레이션(server/ingest)을 쓰고 계정만 다르다.
 * 룩북은 새 게시물이 드문드문 올라오므로 6시간이 아니라 하루 한 번이면 충분하다.
 *
 * 드레스 계정의 규칙(server/ingest 의 PROFILES.dress):
 *   - 원본은 photos/dress/ 아래 보관하고 파생본은 만들지 않는다(원본을 next/image 가 최적화).
 *   - 캡션 첫 줄이 3개 언어 alt 를 채우면 곧장 전시된다. 비면 미선별로 남아 관리자가 고른다.
 */
export async function GET(req: Request) {
  try {
    await requireCronSecret(req);
  } catch (err) {
    return errorResponse(err);
  }

  const result = await runInstagramIngest({ trigger: 'cron', account: 'dress' });

  const body = {
    account: 'dress',
    run: result.run,
    skipped: result.skipped,
    tooOld: result.tooOld,
    // 0 이 아니면 예산에 걸려 남은 것이다. 다음 실행이 이어받는다.
    remaining: result.remaining,
  };

  if (!result.ok) {
    return Response.json(
      {
        error: {
          code: result.error.code,
          message: result.error.message,
          ...(result.error.details ? { details: result.error.details } : {}),
        },
        ...body,
      },
      { status: result.error.status },
    );
  }

  return Response.json(body);
}
