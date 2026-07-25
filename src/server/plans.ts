import { ANNIVERSARY_PLANS, LOCATION_PLANS, STUDIO_OPTIONS, STUDIO_PLANS } from '@/content/site';
import type { Plan as SeedPlan } from '@/content/site';
import type { Locale } from '@/lib/i18n';
import { LOCALES, path } from '@/lib/i18n';

import { NotImplementedError } from '@/server/errors';

/**
 * 플랜 · 옵션 저장소.
 *
 * 가격은 이 사이트에서 가장 사고가 나기 쉬운 값이다. 두 가지를 코드로 못박아 둔다.
 *
 *  1) 세금 표기는 scope 로 결정된다. STUDIO 는 모니터 가격이라 税込 표기 근거가 없고,
 *     LOCATION · ANNIVERSARY 는 税込이다. 편집자가 이 둘을 섞지 못하도록
 *     expectedTaxIncluded() 로 기대값을 노출하고 taxFlagConflict() 로 어긋남을 잡는다.
 *  2) 플랜 하나를 고치면 홈 목록과 플랜 상세가 함께 바뀐다. 어떤 주소가 영향을 받는지
 *     affectedRoutes() 가 돌려주고, 저장 시 그 경로들을 revalidatePath 한다.
 */

export type Scope = 'STUDIO' | 'LOCATION' | 'ANNIVERSARY' | 'HAIRMAKE';

export const SCOPES: Scope[] = ['STUDIO', 'LOCATION', 'ANNIVERSARY', 'HAIRMAKE'];

export const SCOPE_LABEL: Record<Scope, string> = {
  STUDIO: '스튜디오',
  LOCATION: '로케이션',
  ANNIVERSARY: '기념사진',
  HAIRMAKE: '헤어메이크업',
};

export type L10n = Record<Locale, string>;
export type L10nList = Record<Locale, string[]>;

/** prisma/schema.prisma model Plan 과 1:1. */
export type AdminPlan = {
  id: string;
  code: string;
  scope: Scope;
  title: L10n;
  /** 정가. 모니터 가격을 쓰는 스튜디오 플랜에만 있다. */
  listPrice: number | null;
  price: number;
  /** 税込 표기 여부. scope 가 정하는 값이며 임의로 뒤집으면 안 된다. */
  taxIncluded: boolean;
  duration: L10n;
  cuts: number | null;
  includes: L10nList;
  order: number;
};

/** prisma/schema.prisma model Option 과 1:1. price/note 는 Json. */
export type AdminOption = {
  id: string;
  label: L10n;
  /** 금액 표기는 "＋¥20,000〜" 처럼 접미사가 붙어 숫자로 못 박지 않는다. */
  price: L10n;
  note: L10n;
  order: number;
  /** PlanOption 조인 — 이 옵션이 붙는 플랜 code 목록 */
  planCodes: string[];
};

/* ------------------------------------------------------------------ */
/* 세금 표기 규칙                                                       */
/* ------------------------------------------------------------------ */

/**
 * scope 별 税込 표기 기대값.
 * STUDIO 는 모니터 가격이라 税込 근거가 없어 false 가 유일하게 옳다.
 */
export function expectedTaxIncluded(scope: Scope): boolean {
  return scope === 'LOCATION' || scope === 'ANNIVERSARY';
}

export const TAX_RULE_NOTE: Record<Scope, string> = {
  STUDIO: '모니터 가격 — 税込 표기를 붙이지 않습니다.',
  LOCATION: '税込 가격입니다.',
  ANNIVERSARY: '税込 가격입니다.',
  HAIRMAKE: '별도 견적 — 표기 근거 확인 필요.',
};

/** 편집 중인 값이 scope 규칙과 어긋나면 사유 문자열, 맞으면 null. */
export function taxFlagConflict(scope: Scope, taxIncluded: boolean): string | null {
  const expected = expectedTaxIncluded(scope);
  if (taxIncluded === expected) return null;
  return expected
    ? `${SCOPE_LABEL[scope]} 가격은 税込입니다. 税込 표기를 켜 주세요.`
    : `${SCOPE_LABEL[scope]} 가격은 모니터 가격이라 税込 표기 근거가 없습니다.`;
}

/* ------------------------------------------------------------------ */
/* 영향 범위 · 재검증                                                   */
/* ------------------------------------------------------------------ */

export type AffectedSurface = {
  /** 관리자에게 보여줄 한국어 설명 */
  label: string;
  /** 실제로 재검증할 경로 (로케일별) */
  routes: string[];
};

/**
 * 플랜 하나를 고쳤을 때 함께 갱신되어야 하는 표면.
 * 홈의 플랜 목록과 플랜 상세는 같은 레코드를 읽으므로 항상 한 쌍으로 움직인다.
 */
export function affectedSurfaces(plan: Pick<AdminPlan, 'code' | 'scope'>): AffectedSurface[] {
  const surfaces: AffectedSurface[] = [
    { label: '홈 — 플랜 목록', routes: LOCALES.map((l) => path(l, 'home')) },
    { label: '플랜 상세', routes: LOCALES.map((l) => path(l, 'plan', plan.code)) },
    { label: '요금 목록', routes: LOCALES.map((l) => path(l, 'plan')) },
  ];

  if (plan.scope === 'STUDIO') {
    surfaces.push({ label: '스튜디오', routes: LOCALES.map((l) => path(l, 'studio')) });
  }
  if (plan.scope === 'LOCATION' || plan.scope === 'ANNIVERSARY') {
    surfaces.push({ label: '로케이션', routes: LOCALES.map((l) => path(l, 'location')) });
  }
  return surfaces;
}

export function affectedRoutes(plan: Pick<AdminPlan, 'code' | 'scope'>): string[] {
  return affectedSurfaces(plan).flatMap((s) => s.routes);
}

/**
 * 재검증 심(seam). 플랜 저장이 DB에 연결되는 순간 여기서 revalidatePath 가 돈다.
 * 지금은 어떤 경로가 대상인지만 돌려주고 실제 무효화는 하지 않는다.
 */
export async function revalidatePlanSurfaces(
  plan: Pick<AdminPlan, 'code' | 'scope'>,
): Promise<{ revalidated: false; routes: string[] }> {
  const routes = affectedRoutes(plan);
  // TODO(isr): 저장 성공 후 이 자리에서
  //   const { revalidatePath } = await import('next/cache');
  //   for (const r of routes) revalidatePath(r);
  // 를 호출한다. 쓰기 경로가 없는 지금 호출하면 있지도 않은 변경을 무효화하는 셈이라 두지 않는다.
  return { revalidated: false, routes };
}

/* ------------------------------------------------------------------ */
/* 시드                                                                */
/* ------------------------------------------------------------------ */

const SCOPE_FROM_SEED: Record<SeedPlan['scope'], Scope> = {
  studio: 'STUDIO',
  location: 'LOCATION',
  anniversary: 'ANNIVERSARY',
};

/**
 * duration 문자열에서 컷 수를 읽는다.
 * site.ts 는 컷 수를 별도 필드로 들고 있지 않고 "約 3.5H ・ 30 CUTS" 처럼 문장에 섞어 둔다.
 * 없는 값을 지어내지 않기 위해, 읽히지 않으면 null 로 남긴다.
 */
function parseCuts(duration: L10n): number | null {
  for (const text of Object.values(duration)) {
    const m = text.match(/(\d+)\s*(?:CUTS?|cuts?|カット|컷)/u);
    if (m) return Number(m[1]);
  }
  return null;
}

function fromSeed(plan: SeedPlan, order: number): AdminPlan {
  return {
    id: plan.code,
    code: plan.code,
    scope: SCOPE_FROM_SEED[plan.scope],
    title: plan.title,
    listPrice: plan.listPrice ?? null,
    price: plan.price,
    taxIncluded: plan.taxIncluded,
    duration: plan.duration,
    cuts: parseCuts(plan.duration),
    includes: plan.includes,
    order,
  };
}

function seedPlans(): AdminPlan[] {
  return [...STUDIO_PLANS, ...LOCATION_PLANS, ...ANNIVERSARY_PLANS].map(fromSeed);
}

/**
 * 옵션 시드. site.ts 의 STUDIO_OPTIONS 는 어느 플랜에 붙는지를 사람이 읽는 문장
 * ("PLAN 01 / 02") 으로만 들고 있어서, 그 문장에서 플랜 코드를 되읽는다.
 * 문장에 플랜 번호가 없으면(공통 옵션) 스튜디오 플랜 전체에 붙는 것으로 본다.
 */
function seedOptions(): AdminOption[] {
  const studioCodes = STUDIO_PLANS.map((p) => p.code);

  return STUDIO_OPTIONS.map((opt, i) => {
    const scopeText = opt.scope.ja;
    const numbers = scopeText.match(/\d{2}/gu);
    const planCodes = numbers
      ? numbers.map((n) => `studio-${n}`).filter((c) => studioCodes.includes(c))
      : studioCodes;

    return {
      id: `option-${i + 1}`,
      label: opt.label,
      price: opt.price,
      note: opt.scope,
      order: i,
      planCodes,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 읽기                                                                */
/* ------------------------------------------------------------------ */

export async function listPlans(scope?: Scope): Promise<AdminPlan[]> {
  // TODO(prisma): prisma.plan.findMany({ where: scope ? { scope } : {}, orderBy: { order: 'asc' } })
  const rows = seedPlans();
  return scope ? rows.filter((p) => p.scope === scope) : rows;
}

export async function getPlan(code: string): Promise<AdminPlan | null> {
  // TODO(prisma): prisma.plan.findUnique({ where: { code }, include: { options: true } })
  return seedPlans().find((p) => p.code === code) ?? null;
}

export async function listOptions(planCode?: string): Promise<AdminOption[]> {
  // TODO(prisma): prisma.option.findMany({ include: { plans: true }, orderBy: { order: 'asc' } })
  const rows = seedOptions();
  return planCode ? rows.filter((o) => o.planCodes.includes(planCode)) : rows;
}

/** 편집 화면 상단의 경고 줄 — 저장 전에 걸러야 하는 문제만 담는다. */
export async function auditPlans(): Promise<{ code: string; issue: string }[]> {
  const rows = await listPlans();
  const issues: { code: string; issue: string }[] = [];

  for (const p of rows) {
    const conflict = taxFlagConflict(p.scope, p.taxIncluded);
    if (conflict) issues.push({ code: p.code, issue: conflict });
    if (p.listPrice !== null && p.listPrice <= p.price) {
      issues.push({ code: p.code, issue: '정가가 판매가보다 낮거나 같습니다.' });
    }
    for (const l of LOCALES) {
      if (!p.title[l]?.trim()) issues.push({ code: p.code, issue: `${l.toUpperCase()} 제목 없음` });
    }
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* 쓰기 — 미구현                                                        */
/* ------------------------------------------------------------------ */

export type UpsertPlanInput = Omit<AdminPlan, 'id'>;

export async function upsertPlan(input: UpsertPlanInput): Promise<AdminPlan> {
  const conflict = taxFlagConflict(input.scope, input.taxIncluded);
  if (conflict) throw new Error(`upsertPlan: ${conflict}`);

  // TODO(prisma): prisma.plan.upsert({ where: { code }, create: {...}, update: {...} })
  // TODO(isr): 성공 후 revalidatePlanSurfaces(input) — affectedRoutes() 전체를 무효화한다.
  throw new NotImplementedError('플랜 저장');
}

export async function upsertOption(_input: Omit<AdminOption, 'id'>): Promise<AdminOption> {
  // TODO(prisma): prisma.option.upsert(...) + PlanOption 조인 재작성
  // TODO(isr): 연결된 모든 플랜의 affectedRoutes() 를 무효화한다.
  throw new NotImplementedError('옵션 저장');
}

export async function reorderPlans(_codes: string[]): Promise<void> {
  // TODO(prisma): prisma.$transaction(codes.map((code, order) => prisma.plan.update(...)))
  throw new NotImplementedError('플랜 표시순 저장');
}
