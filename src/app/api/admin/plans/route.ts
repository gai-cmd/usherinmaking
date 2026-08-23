import { z } from 'zod';

import { LOCALES } from '@/lib/i18n';
import { requireAdmin } from '@/server/auth';
import { ValidationError, errorResponse } from '@/server/errors';
import {
  SCOPES,
  affectedRoutes,
  listOptions,
  listPlans,
  revalidatePlanSurfaces,
  taxFlagConflict,
  updatePlanPricing,
  upsertPlan,
} from '@/server/plans';
import type { Scope, UpsertPlanInput } from '@/server/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const l10n = z.object(
  Object.fromEntries(LOCALES.map((l) => [l, z.string().max(200)])) as Record<
    string,
    z.ZodString
  >,
);

const l10nList = z.object(
  Object.fromEntries(
    LOCALES.map((l) => [l, z.array(z.string().max(200)).max(20)]),
  ) as Record<string, z.ZodArray<z.ZodString>>,
);

/** 가격 화면 전용 — 화면이 실제로 바꾸는 네 칸만 받는다. 다국어 본문은 서버가 기존 행에서 잇는다. */
const PricingSchema = z
  .object({
    code: z
      .string()
      .min(2)
      .max(48)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    scope: z.enum(SCOPES as [string, ...string[]]),
    listPrice: z.number().int().min(0).max(10_000_000).nullable(),
    price: z.number().int().min(0).max(10_000_000),
    taxIncluded: z.boolean(),
  })
  .strict();

const PlanSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, '플랜 코드는 소문자·숫자·하이픈만 쓸 수 있습니다.'),
  scope: z.enum(SCOPES as [string, ...string[]]),
  title: l10n,
  listPrice: z.number().int().min(0).max(10_000_000).nullable(),
  price: z.number().int().min(0).max(10_000_000),
  taxIncluded: z.boolean(),
  duration: l10n,
  cuts: z.number().int().min(0).max(1000).nullable(),
  includes: l10nList,
  order: z.number().int().min(0).max(999),
});

/** 플랜 · 옵션 목록. */
export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin(req);

    const scopeParam = new URL(req.url).searchParams.get('scope');
    const scope = scopeParam && (SCOPES as string[]).includes(scopeParam) ? (scopeParam as Scope) : undefined;

    const [plans, options] = await Promise.all([listPlans(scope), listOptions()]);
    return Response.json({ plans, options }, { headers: { 'cache-control': 'no-store, private' } });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * 가격 갱신 (가격 화면이 쓰는 경로).
 *
 * 세금 표기는 scope 가 정한다. 스튜디오는 모니터 가격이라 税込 표기 근거가 없고
 * 로케이션·기념사진은 税込이다. 둘이 섞이면 표시 가격이 곧 오표기가 되므로 422 로 막는다.
 * 제목·소요시간·포함내역은 받지 않는다 — 서버가 기존 행에서 그대로 잇는다.
 */
export async function PATCH(req: Request): Promise<Response> {
  try {
    await requireAdmin(req);

    const parsed = PricingSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('플랜 입력값이 올바르지 않습니다.', {
        issues: parsed.error.issues.map((i) => i.path.join('.') || 'body'),
      });
    }

    const { code, ...patch } = parsed.data;
    const scope = patch.scope as Scope;

    const conflict = taxFlagConflict(scope, patch.taxIncluded);
    if (conflict) throw new ValidationError(conflict);

    if (patch.listPrice !== null && patch.listPrice <= patch.price) {
      throw new ValidationError('정가는 판매가보다 커야 합니다.');
    }

    const saved = await updatePlanPricing(code, { ...patch, scope });
    const { revalidated } = await revalidatePlanSurfaces(saved);

    return Response.json(
      { ok: true, revalidated, routes: affectedRoutes(saved) },
      { headers: { 'cache-control': 'no-store, private' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * 플랜 전체 저장 (다국어 본문 포함). 번역 화면처럼 모든 칸을 함께 보내는 호출자용이다.
 * 가격만 고치는 화면은 PATCH 를 써야 한다 — 이 경로는 받은 값을 통째로 쓴다.
 */
export async function PUT(req: Request): Promise<Response> {
  try {
    await requireAdmin(req);

    const parsed = PlanSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('플랜 입력값이 올바르지 않습니다.', {
        issues: parsed.error.issues.map((i) => i.path.join('.') || 'body'),
      });
    }

    const input = parsed.data as unknown as UpsertPlanInput;

    const conflict = taxFlagConflict(input.scope, input.taxIncluded);
    if (conflict) throw new ValidationError(conflict);

    if (input.listPrice !== null && input.listPrice <= input.price) {
      throw new ValidationError('정가는 판매가보다 커야 합니다.');
    }

    // 저장 성공 시 upsertPlan 이 affectedRoutes() 전체를 무효화한다.
    // 홈 목록과 플랜 상세가 같은 레코드를 읽으므로 둘은 항상 함께 움직인다.
    await upsertPlan(input);

    // 무효화 결과를 그대로 알린다 — 요청 컨텍스트 밖이면 revalidated 가 false 로 나간다.
    const { revalidated } = await revalidatePlanSurfaces(input);

    return Response.json(
      { ok: true, revalidated, routes: affectedRoutes(input) },
      { headers: { 'cache-control': 'no-store, private' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
