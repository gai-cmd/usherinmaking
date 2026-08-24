import { requireCronSecret } from '@/server/auth';
import { errorResponse } from '@/server/errors';
import { sendDailyReport } from '@/server/daily-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 데일리 인사이트 크론. 매일 UTC 00:00 (= KST 09:00) 에 어제 지표를 이메일로 보낸다.
 * 자격 증명이 비어 있으면 실패가 아니라 "무엇이 비었는지"를 200 으로 돌려준다 —
 * 크론이 빨간불로 쌓이면 진짜 장애가 묻힌다.
 */
export async function GET(req: Request) {
  try {
    await requireCronSecret(req);
    const result = await sendDailyReport();
    return Response.json({ ...result, at: new Date().toISOString() });
  } catch (err) {
    return errorResponse(err);
  }
}
