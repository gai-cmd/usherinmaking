import { requireCronSecret } from '@/server/auth';
import { errorResponse } from '@/server/errors';
import { runInstagramIngest } from '@/server/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 하루 한 번, 새벽(UTC 18시 = 한국·일본 새벽 3시) — vercel.json 의 crons 항목이 이 경로를 가리킨다.
// 부하를 줄이려고 6시간마다에서 하루 한 번으로 줄였다(2026-08-14).
export const maxDuration = 300;

/**
 * 인스타그램 수집 크론.
 *
 * 흐름은 전부 server/ingest 에 있고 여기는 가드와 응답 매핑만 한다.
 * 크론 시크릿 검증 → 수집 → 결과를 그대로 내보낸다.
 *
 * 응답 규칙:
 *   - 인증 실패는 실행 기록을 만들지 않는다. 인증 없는 호출은 수집 시도가 아니고,
 *     기록으로 남기면 남이 이력 테이블을 채울 수 있다.
 *   - 수집 시도가 실패하면 IngestRun 에 남고 그 run 을 응답에 함께 싣는다.
 *     자격 증명이 없으면 503 이며, 그 실행도 기록된다.
 */
export async function GET(req: Request) {
  try {
    await requireCronSecret(req);
  } catch (err) {
    return errorResponse(err);
  }

  const result = await runInstagramIngest({ trigger: 'cron' });

  const body = {
    run: result.run,
    skipped: result.skipped,
    // 하한(INGEST_SINCE)보다 오래되어 제외한 건수 — 0 이 아니면 의도된 제외다.
    tooOld: result.tooOld,
    // 0 이 아니면 예산에 걸려 남은 것이다. 다음 실행이 이어받는다.
    remaining: result.remaining,
    aiUnavailable: result.aiUnavailable,
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
