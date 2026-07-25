import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import {
  isAiConfigured,
  listIngestRuns,
  missingRunEnv,
  previewInstagramIngest,
  runInstagramIngest,
} from '@/server/ingest';
import { isDatabaseConfigured } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 크론과 같은 일을 하므로 같은 시간 예산이 필요하다.
export const maxDuration = 300;

/**
 * 관리자 수동 수집.
 *
 * 크론을 6시간 기다리지 않고 "지금 가져오기"를 누를 수 있어야 한다.
 * 가드는 CRON_SECRET 이 아니라 requireAdmin 이다 — 사람이 누르는 버튼이기 때문이다.
 */

/** 준비 상태. 값은 절대 싣지 않고 "무엇이 비었는지"만 알린다. */
function readiness() {
  const missingEnv = missingRunEnv();
  return {
    ready: missingEnv.length === 0 && isDatabaseConfigured(),
    missingEnv,
    databaseConfigured: isDatabaseConfigured(),
    aiConfigured: isAiConfigured(),
  };
}

const LimitSchema = z.coerce.number().int().min(1).max(100).optional();

/** 실행 이력 + 준비 상태. 화면이 "왜 안 도는지"를 이 응답만으로 말할 수 있어야 한다. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const parsed = LimitSchema.safeParse(new URL(req.url).searchParams.get('limit') ?? undefined);
    if (!parsed.success) throw new ValidationError('limit 은 1~100 사이의 정수여야 합니다.');

    return Response.json({
      ...readiness(),
      runs: await listIngestRuns(parsed.data ?? 10),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

const TriggerSchema = z
  .object({
    /** true 면 아무것도 저장하지 않고 건수만 센다. 토큰 확인용. */
    preview: z.boolean().optional().default(false),
    /** 이번 실행에서 처리할 신규 건수 상한 */
    maxItems: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    // 본문 없이 눌러도 되는 버튼이다. 빈 본문은 기본값으로 읽는다.
    const raw = await req.json().catch(() => ({}));
    const parsed = TriggerSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new ValidationError('preview(boolean) · maxItems(1~200)만 받습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.') || '(body)'),
      });
    }

    if (parsed.data.preview) {
      return Response.json({ preview: await previewInstagramIngest(), ...readiness() });
    }

    const result = await runInstagramIngest({
      trigger: 'admin',
      maxItems: parsed.data.maxItems,
    });

    const body = {
      run: result.run,
      skipped: result.skipped,
      remaining: result.remaining,
      aiUnavailable: result.aiUnavailable,
    };

    // 실패해도 run 은 함께 나간다 — 화면이 "무엇이 남았는지"를 그대로 보여줘야 한다.
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
  } catch (err) {
    return errorResponse(err);
  }
}
