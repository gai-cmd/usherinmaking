// 활동 로그. schema.prisma의 ActivityLog에 대응한다.
//
// 로그는 "실패해도 본 작업을 끊으면 안 되는" 부수 기록이다. 그래서 쓰기 스텁이
// 예외를 던지는 대신 PersistResult를 돌려준다 — 다만 성공을 가장하지는 않는다
// (항상 persisted: false). 호출측은 이 값을 그대로 화면·응답에 실어 보낸다.

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

export async function listActivity(limit = 10): Promise<ActivityLog[]> {
  // TODO(prisma): prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
  return SEED_ACTIVITY.slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * 기록 시도. 지금은 항상 persisted: false를 돌려주고 서버 로그에만 남긴다.
 * 반환값을 무시해도 흐름은 깨지지 않지만, 화면에 "기록됨"이라고 쓰면 안 된다.
 */
export async function recordActivity(input: ActivityInput): Promise<PersistResult> {
  // TODO(prisma): prisma.activityLog.create({ data: input })
  console.info('[activity] (미저장)', input.actor, input.action, input.target ?? '');
  return NOT_PERSISTED;
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
    // TODO(prisma): cuid는 DB가 만든다. 미연결 구간에서만 임시 id를 붙인다.
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
  // TODO(prisma): prisma.ingestRun.upsert({ where: { id: run.id }, ... })
  console.info(
    '[ingest] (미저장) run',
    run.id,
    `fetched=${run.fetched} created=${run.created} failed=${run.failed}`,
    run.error ?? '',
  );
  return NOT_PERSISTED;
}

export async function listIngestRuns(limit = 5): Promise<IngestRun[]> {
  // TODO(prisma): prisma.ingestRun.findMany({ orderBy: { startedAt: 'desc' }, take: limit })
  void limit;
  return [];
}
