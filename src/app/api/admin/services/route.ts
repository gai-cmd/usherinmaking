import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import { listServices, revealSecret, updateService, vaultReady } from '@/server/services';

export const runtime = 'nodejs';

/**
 * 외부 서비스 대장 API.
 *
 * 자격 증명 원문은 POST(reveal) 단건 응답으로만 나간다. 목록(GET)에는 가림 표기만 실린다 —
 * 목록은 화면 로딩마다 오가므로 원문을 실으면 로그·캐시·확장 프로그램에 남을 표면이 넓어진다.
 */

const UpdateSchema = z
  .object({
    serviceId: z.string().min(1).max(60),
    account: z.string().max(200).nullable().optional(),
    memo: z.string().max(2000).nullable().optional(),
    secrets: z.record(z.string().max(60), z.string().max(4000)).optional(),
  })
  .strict();

const RevealSchema = z
  .object({
    action: z.literal('reveal'),
    serviceId: z.string().min(1).max(60),
    field: z.string().min(1).max(60),
  })
  .strict();

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const services = await listServices();
    return Response.json({ vaultReady: vaultReady(), services });
  } catch (err) {
    return errorResponse(err);
  }
}

/** 자격 증명 원문 조회. 캐시되지 않도록 no-store 를 명시한다. */
export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const json = await req.json().catch(() => null);
    const parsed = RevealSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError('입력값이 올바르지 않습니다.');
    }

    const result = await revealSecret(parsed.data.serviceId, parsed.data.field);
    if (!result.ok) {
      const message =
        result.reason === 'no_key'
          ? '금고 키(SERVICE_VAULT_KEY)가 설정되어 있지 않습니다.'
          : result.reason === 'not_found'
            ? '저장된 값이 없습니다.'
            : '저장된 값을 열 수 없습니다. 금고 키가 바뀌었을 수 있습니다.';
      throw new ValidationError(message);
    }

    return Response.json(
      { ok: true, value: result.value },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin(req);

    const json = await req.json().catch(() => null);
    const parsed = UpdateSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      });
    }

    const result = await updateService(parsed.data);
    if (!result.ok) {
      throw new ValidationError(
        result.reason === 'no_key'
          ? '금고 키(SERVICE_VAULT_KEY)가 없어 자격 증명을 저장하지 않았습니다. 평문으로 남기지 않기 위해 저장을 거부합니다.'
          : '저장에 실패했습니다.',
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
