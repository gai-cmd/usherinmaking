// 활동 로그. schema.prisma의 ActivityLog에 대응한다.
//
// 로그는 "실패해도 본 작업을 끊으면 안 되는" 부수 기록이다. 그래서 이 모듈의 쓰기는
// 예외를 던지지 않고 PersistResult를 돌려준다 — 다만 성공을 가장하지도 않는다.
// 저장에 실패하면 persisted: false 와 사유가 그대로 나간다.
//
// 이 로그가 있는 이유: 나중에 "이 값이 왜 이렇게 바뀌었지"를 되짚을 수 있어야 한다.
// 그래서 다른 모듈의 쓰기 경로가 성공한 직후 여기에 한 줄씩 남긴다.

import { isDatabaseConfigured, prisma } from './db';
import { NOT_PERSISTED, type PersistResult } from './errors';

export type ActivityLog = {
  id: string;
  /** 수행 주체. 인증 제공자가 붙기 전까지는 'admin' 또는 'system'. */
  actor: string;
  /** 무엇을 했는지 (사람이 읽는 한 줄) */
  action: string;
  /** 대상 식별자 — 사진 id, 플랜 코드 등 */
  target: string | null;
  detail: Record<string, unknown> | null;
  createdAt: Date;
};

export type ActivityInput = {
  actor: string;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown> | null;
};

const SEED_ACTIVITY: ActivityLog[] = [
  {
    id: 'ac-001',
    actor: 'system',
    action: 'Instagram 동기화 — 신규 18건 수집',
    target: null,
    detail: { fetched: 18 },
    createdAt: new Date('2026-06-15T10:24:00+09:00'),
  },
  {
    id: 'ac-002',
    actor: 'admin',
    action: '사진 12장 전시 공개',
    target: 'photos',
    detail: { count: 12 },
    createdAt: new Date('2026-06-15T09:58:00+09:00'),
  },
  {
    id: 'ac-003',
    actor: 'admin',
    action: '플랜 02 가격 수정',
    target: 'studio-02',
    detail: { price: 150000 },
    createdAt: new Date('2026-06-15T09:31:00+09:00'),
  },
  {
    id: 'ac-004',
    actor: 'admin',
    action: '네이버 블로그 글 4건 가져옴',
    target: 'journal',
    detail: { count: 4 },
    createdAt: new Date('2026-06-14T18:02:00+09:00'),
  },
  {
    id: 'ac-005',
    actor: 'admin',
    action: '문의 1건 → FAQ 승격',
    target: 'inquiry',
    detail: null,
    createdAt: new Date('2026-06-14T14:40:00+09:00'),
  },
  {
    id: 'ac-006',
    actor: 'system',
    action: '인스타 자동 수집 38장',
    target: null,
    detail: { fetched: 38 },
    createdAt: new Date('2026-06-14T06:00:00+09:00'),
  },
];

/** DB Json 칼럼을 화면이 쓰는 모양으로. 객체가 아니면 버린다 — 지어내지 않는다. */
function toDetail(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export async function listActivity(limit = 10): Promise<ActivityLog[]> {
  if (isDatabaseConfigured()) {
    const rows = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        actor: r.actor,
        action: r.action,
        target: r.target,
        detail: toDetail(r.detail),
        createdAt: r.createdAt,
      }));
    }
  }

  // DB가 없거나 아직 한 줄도 쌓이지 않은 상태. 빈 화면 대신 구조를 보여 준다.
  return SEED_ACTIVITY.slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * 지금 로그인한 관리자의 이메일. 활동 로그의 actor 로 쓴다.
 *
 * 세션이 없는 실행 경로(크론, 시드 스크립트)에서도 불릴 수 있으므로 실패를 삼키고
 * fallback 을 돌려준다 — 여기서 던지면 부수 기록이 본 작업을 끊는다.
 *
 * 관리자 이메일이지 고객 이메일이 아니다. 고객 주소는 어떤 경로로도 이 로그에 들어가지 않는다.
 */
export async function resolveActor(fallback = 'admin'): Promise<string> {
  try {
    const { currentAdminEmail } = await import('./auth');
    return (await currentAdminEmail()) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * 기록. 실패해도 절대 던지지 않는다 — 로그가 본 작업을 끊으면 안 되기 때문이다.
 * 다만 저장되지 않았으면 persisted: false 가 그대로 나가고, 화면은 그 값을 그대로 써야 한다.
 */
export async function recordActivity(input: ActivityInput): Promise<PersistResult> {
  if (!isDatabaseConfigured()) {
    console.info('[activity] (미저장)', input.actor, input.action, input.target ?? '');
    return NOT_PERSISTED;
  }

  try {
    await prisma.activityLog.create({
      data: {
        actor: input.actor,
        action: input.action,
        target: input.target ?? null,
        ...(input.detail ? { detail: input.detail as object } : {}),
      },
    });
    return { persisted: true };
  } catch (err) {
    console.error('[activity] 기록 실패', err);
    return { persisted: false, reason: '활동 로그 기록에 실패했습니다.' };
  }
}

/**
 * 쓰기 성공 직후 호출하는 축약형. actor 를 스스로 찾고 실패를 삼킨다.
 * 호출측이 await 하지 않아도 되도록 반환값은 참고용이다.
 */
export async function logAdminAction(
  action: string,
  target?: string | null,
  detail?: Record<string, unknown> | null,
): Promise<PersistResult> {
  return recordActivity({ actor: await resolveActor(), action, target, detail });
}

/* ============================ 수집 실행 기록 ============================ */

/** schema.prisma의 IngestRun. 중복·누락 판별의 근거라 실행 자체가 남아야 한다. */
export type IngestRun = {
  id: string;
  startedAt: Date;
  finishedAt: Date | null;
  fetched: number;
  created: number;
  failed: number;
  error: string | null;
};

export function newIngestRun(): IngestRun {
  return {
    // cuid는 DB가 만든다. 저장 전까지만 쓰는 임시 id — saveIngestRun 이 upsert 키로 쓴다.
    id: `run_local_${Date.now()}`,
    startedAt: new Date(),
    finishedAt: null,
    fetched: 0,
    created: 0,
    failed: 0,
    error: null,
  };
}

export async function saveIngestRun(run: IngestRun): Promise<PersistResult> {
  if (!isDatabaseConfigured()) {
    console.info(
      '[ingest] (미저장) run',
      run.id,
      `fetched=${run.fetched} created=${run.created} failed=${run.failed}`,
      run.error ?? '',
    );
    return NOT_PERSISTED;
  }

  try {
    // 실행 도중 여러 번 저장될 수 있으므로 upsert 다. 실행 자체가 남아야
    // 중복 수집과 누락을 나중에 판별할 수 있다.
    const { id, ...rest } = run;
    await prisma.ingestRun.upsert({ where: { id }, create: { id, ...rest }, update: rest });
    return { persisted: true };
  } catch (err) {
    console.error('[ingest] 실행 기록 저장 실패', err);
    return { persisted: false, reason: '수집 실행 기록 저장에 실패했습니다.' };
  }
}

export async function listIngestRuns(limit = 5): Promise<IngestRun[]> {
  if (!isDatabaseConfigured()) return [];
  return prisma.ingestRun.findMany({ orderBy: { startedAt: 'desc' }, take: limit });
}
