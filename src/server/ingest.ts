// 인스타그램 수집 오케스트레이션.
//
// 이 파일이 책임지는 것은 세 가지다.
//   1) 실행 기록(IngestRun) — 성공이든 실패든 남는다. 남지 않으면 중복·누락을 판별할 근거가 없다.
//   2) 중복 방지 — 이미 가진 사진은 다시 내려받지 않는다. 재실행이 싸야 크론이 의미가 있다.
//   3) 부분 실패 격리 — 한 장이 깨져도 나머지는 저장된다. 실패는 세어서 남긴다.
//
// 계약: 일어나지 않은 수집을 성공이라고 말하지 않는다.
// 자격 증명이 없으면 503 이고, 그 실행조차 기록으로 남는다.

import { Prisma } from '@prisma/client';
import { isDatabaseConfigured, prisma } from '@/server/db';
import { recordActivity } from '@/server/activity';
import { AppError, DependencyUnavailableError } from '@/server/errors';
import {
  fetchInstagramMedia,
  instagramCredentialsFromEnv,
  InstagramApiError,
  missingInstagramEnv,
  parseInstagramTimestamp,
  type InstagramMedia,
} from '@/lib/instagram';
import {
  downloadOriginal,
  draftAltText,
  encodeRenditions,
  isBlobConfigured,
  isLowRes,
  mimeForExtension,
  missingPipelineEnv,
  originalKey,
  planRenditions,
  probeImageDimensions,
  storeOriginal,
  suggestCategories,
} from '@/lib/image-pipeline';
import type { AiSuggestion, Localized } from '@/server/photos';

/* ============================ 예산 ============================ */

/**
 * 한 실행에서 실제로 내려받아 인코딩할 신규 건수 상한.
 *
 * 목록 조회는 전량이지만 처리는 아니다. 서버리스 함수에 300초 상한이 있어서,
 * 첫 백필처럼 수백 장이 한꺼번에 잡히면 중간에 잘린다. 잘리는 것 자체는 괜찮다 —
 * 중복 방지가 있어서 다음 실행이 남은 것부터 이어받기 때문이다. 다만 몇 장이 남았는지는
 * 응답에 실어 보내야 운영자가 "아직 도는 중"인지 "멈춘 것"인지 구분할 수 있다.
 */
const DEFAULT_MAX_ITEMS = Number(process.env.INGEST_MAX_ITEMS ?? 25);

/** 벽시계 예산. maxDuration(300초)보다 넉넉히 앞서 끊어 기록을 남길 시간을 남긴다. */
const TIME_BUDGET_MS = Number(process.env.INGEST_TIME_BUDGET_MS ?? 240_000);

/** 원본 URL 에서 확장자를 못 읽었을 때. IG 의 IMAGE 미디어는 실제로 JPEG 로 온다. */
const FALLBACK_EXT = 'jpg';

const EMPTY_ALT: Localized = { ja: '', en: '', ko: '' };

/* ============================ 준비 상태 ============================ */

/**
 * 목록 조회만 하는 데 필요한 것. 미리보기가 쓴다.
 * 저장을 하지 않으므로 스토리지 토큰은 여기 없다.
 */
export function missingFetchEnv(): string[] {
  return [...new Set([...missingInstagramEnv(), ...missingPipelineEnv()])];
}

/**
 * 실제 수집에 필요한 것 전부.
 *
 * image-pipeline 의 missingPipelineEnv 는 인스타 변수만 본다. 스토리지 토큰이 없으면
 * 업로드가 장마다 실패해서 "전건 실패"로 끝나는데, 그건 원인을 가린다.
 * 한 장도 내려받기 전에 여기서 끊고 무엇이 없는지 이름으로 말한다.
 */
export function missingRunEnv(): string[] {
  const missing = missingFetchEnv();
  if (!isBlobConfigured()) missing.push('BLOB_READ_WRITE_TOKEN');
  return [...new Set(missing)];
}

/* ============================ 타입 ============================ */

export type IngestTrigger = 'cron' | 'admin';

/** schema.prisma 의 IngestRun + "정말 저장됐는가" 한 칸. */
export type IngestRunRecord = {
  id: string;
  startedAt: Date;
  finishedAt: Date | null;
  fetched: number;
  created: number;
  failed: number;
  error: string | null;
  /** false 면 이 실행은 DB 에 남지 않았다. 화면이 그렇게 표시해야 한다. */
  persisted: boolean;
};

export type IngestSummary = {
  trigger: IngestTrigger;
  run: IngestRunRecord;
  /** 이미 가지고 있어 건너뛴 건수 */
  skipped: number;
  /** 예산 밖으로 남겨 둔 신규 건수. 0 이 아니면 다음 실행이 이어받는다. */
  remaining: number;
  /** AI 초안이 붙지 않은 이유. null 이면 붙었다. */
  aiUnavailable: string | null;
};

export type IngestResult =
  | ({ ok: true } & IngestSummary)
  | ({ ok: false; error: AppError } & IngestSummary);

/* ============================ 실행 기록 ============================ */

function localRun(): IngestRunRecord {
  return {
    id: `run_local_${Date.now()}`,
    startedAt: new Date(),
    finishedAt: null,
    fetched: 0,
    created: 0,
    failed: 0,
    error: null,
    persisted: false,
  };
}

/** 실행을 연다. DB 가 있으면 여기서 행이 생기고, 그 id 가 곧 실행 id 다. */
async function startRun(): Promise<IngestRunRecord> {
  if (!isDatabaseConfigured()) return localRun();
  try {
    const row = await prisma.ingestRun.create({ data: {} });
    return { ...row, persisted: true };
  } catch (err) {
    // 기록을 못 여는 것이 수집을 막을 이유는 아니다. 다만 기록되지 않았다고 말한다.
    console.error('[ingest] 실행 기록 생성 실패 — 이번 실행은 DB 에 남지 않는다', err);
    return localRun();
  }
}

/** 실행을 닫는다. 실패한 실행도 반드시 여기를 지난다 — 안 남으면 없었던 일이 된다. */
async function finishRun(
  run: IngestRunRecord,
  patch: Pick<IngestRunRecord, 'fetched' | 'created' | 'failed' | 'error'>,
): Promise<IngestRunRecord> {
  const closed: IngestRunRecord = { ...run, ...patch, finishedAt: new Date() };

  if (!run.persisted) {
    console.info(
      '[ingest] (미저장) run',
      closed.id,
      `fetched=${closed.fetched} created=${closed.created} failed=${closed.failed}`,
      closed.error ?? '',
    );
    return closed;
  }

  try {
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: closed.finishedAt,
        fetched: closed.fetched,
        created: closed.created,
        failed: closed.failed,
        // 메시지는 길이를 잘라 둔다 — 스택이 통째로 들어가면 목록이 읽히지 않는다.
        error: closed.error ? closed.error.slice(0, 500) : null,
      },
    });
    return closed;
  } catch (err) {
    // 마감 실패를 던지면 원래 원인이 이 오류에 가려진다. 삼키지 말고 로그로 남긴다.
    console.error('[ingest] 실행 기록 마감 실패', run.id, err);
    return { ...closed, persisted: false };
  }
}

/** 최근 실행 이력. 관리자 화면과 /api/admin/ingest 가 함께 쓴다. */
export async function listIngestRuns(limit = 10): Promise<IngestRunRecord[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await prisma.ingestRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map((r) => ({ ...r, persisted: true }));
}

/* ============================ 중복 방지 ============================ */

/**
 * 이미 수집된 인스타 media id 전체.
 *
 * 신규 판정을 이 집합으로 먼저 거르기 때문에 재실행에서는 네트워크·인코딩이 한 번도 일어나지 않는다.
 * igMediaId 의 unique 제약은 이 집합을 만든 뒤 실행이 겹쳤을 때를 위한 두 번째 방어선이다.
 */
export async function knownIgMediaIds(): Promise<Set<string>> {
  const rows = await prisma.photo.findMany({
    where: { igMediaId: { not: null } },
    select: { igMediaId: true },
  });
  return new Set(rows.map((r) => r.igMediaId).filter((v): v is string => Boolean(v)));
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/* ============================ AI seam ============================ */

export type AiDraft = {
  /** false 면 alt 는 빈 값이고 aiSuggestion 은 null 이다. */
  configured: boolean;
  reason: string | null;
  alt: Localized;
  aiSuggestion: AiSuggestion[] | null;
};

/** 제공자가 붙었는지. AI_API_KEY 하나로 판단한다. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

const AI_NOT_CONFIGURED: AiDraft = {
  configured: false,
  reason: 'AI_API_KEY 가 설정되지 않아 분류·alt 초안을 건너뛰었습니다.',
  alt: EMPTY_ALT,
  aiSuggestion: null,
};

/**
 * 분류 제안과 alt 초안. 어디까지나 초안이고 확정은 관리자가 한다.
 *
 * 제공자가 없거나 호출이 실패해도 수집은 계속된다 — AI 는 수집의 전제가 아니라 부가물이다.
 * alt 가 비면 그 사진은 전시로 올라가지 못하는데(photos.assertPublishable), 그게 맞는 결과다.
 * 지어낸 alt 를 채워 넣는 편이 훨씬 나쁘다.
 */
async function draftPhotoMetadata(bytes: ArrayBuffer, caption: string | null): Promise<AiDraft> {
  if (!isAiConfigured()) return AI_NOT_CONFIGURED;

  try {
    const [suggestions, alt] = await Promise.all([
      suggestCategories(bytes),
      draftAltText(bytes, caption),
    ]);
    return {
      configured: true,
      reason: null,
      alt,
      aiSuggestion: suggestions.map((s) => ({
        taxonomyId: s.taxonomyKey,
        termId: s.termSlug,
        label: s.termSlug,
        score: s.score,
      })),
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn('[ingest] AI 초안 생략', reason);
    return { ...AI_NOT_CONFIGURED, reason };
  }
}

/* ============================ 한 장 처리 ============================ */

function extensionOf(url: string): string {
  try {
    const path = new URL(url).pathname;
    const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    return /^[a-z0-9]{2,5}$/.test(ext) ? ext : FALLBACK_EXT;
  } catch {
    return FALLBACK_EXT;
  }
}

type ItemOutcome = 'created' | 'duplicate';

/**
 * 사진 한 장: 다운로드 → 원본 보관 → 실측 → 파생본 → AI 초안 → UNSORTED 저장.
 * 어느 단계에서 던지든 호출측이 그 한 장만 실패로 세고 다음으로 넘어간다.
 */
async function ingestOne(media: InstagramMedia): Promise<ItemOutcome> {
  const takenAt = parseInstagramTimestamp(media.timestamp);
  if (!takenAt) {
    // 촬영 시각은 정렬의 축이다. 지어내면 갤러리 순서가 통째로 거짓이 된다.
    throw new Error(`촬영 시각을 해석할 수 없습니다 (timestamp=${media.timestamp || '없음'}).`);
  }

  const ext = extensionOf(media.mediaUrl);
  const bytes = await downloadOriginal(media.mediaUrl);
  const originalUrl = await storeOriginal(originalKey(media.id, ext), bytes);

  // Graph API 는 크기를 주지 않는다. 내려받은 원본에서 직접 재야 파생본 계획과
  // 저해상도 판정이 실제와 맞는다.
  const { width, height } = await probeImageDimensions(bytes);
  const variants = await encodeRenditions(bytes, planRenditions({ id: media.id, width, height }));

  const draft = await draftPhotoMetadata(bytes, media.caption);

  try {
    await prisma.photo.create({
      data: {
        igMediaId: media.id,
        originalUrl,
        variants: variants as unknown as Prisma.InputJsonValue,
        width,
        height,
        caption: media.caption,
        takenAt,
        // 수집물은 예외 없이 미선별이다. 전시는 관리자가 고른 것만 나간다.
        status: 'UNSORTED',
        lowRes: isLowRes(width, height),
        alt: draft.alt as unknown as Prisma.InputJsonValue,
        ...(draft.aiSuggestion
          ? { aiSuggestion: draft.aiSuggestion as unknown as Prisma.InputJsonValue }
          : {}),
      },
      select: { id: true },
    });
  } catch (err) {
    // 목록을 만든 뒤 같은 사진이 다른 실행에서 먼저 들어온 경우. 실패가 아니라 중복이다.
    if (isUniqueViolation(err)) return 'duplicate';
    throw err;
  }

  // 미디어 라이브러리에도 원본을 남긴다. 실패해도 사진은 이미 저장됐으므로 흐름을 끊지 않는다.
  try {
    await prisma.mediaAsset.upsert({
      where: { url: originalUrl },
      update: {},
      create: {
        url: originalUrl,
        pathname: originalKey(media.id, ext),
        mimeType: mimeForExtension(ext),
        size: bytes.byteLength,
        width,
        height,
        source: 'instagram',
      },
    });
  } catch (err) {
    console.warn('[ingest] MediaAsset 기록 실패 (사진은 저장됨)', media.id, err);
  }

  return 'created';
}

/* ============================ 전체 실행 ============================ */

export type RunOptions = {
  trigger: IngestTrigger;
  /** 활동 로그에 남을 주체. 크론은 'system'. */
  actor?: string;
  /** 이번 실행에서 처리할 신규 건수 상한 override */
  maxItems?: number;
};

/**
 * 시작도 못 한 실행을 닫는다. 던지지 않고 값으로 돌려주는 이유는
 * 호출측이 응답 본문에 run 을 함께 실어야 하기 때문이다 — 실패한 실행일수록 보여야 한다.
 */
async function failWith(
  trigger: IngestTrigger,
  run: IngestRunRecord,
  error: AppError,
  aiUnavailable: string | null,
): Promise<IngestResult> {
  const closed = await finishRun(run, { fetched: 0, created: 0, failed: 0, error: error.message });
  return { ok: false, trigger, run: closed, error, skipped: 0, remaining: 0, aiUnavailable };
}

/**
 * 수집 한 사이클.
 *
 * 전제가 하나라도 없으면(자격 증명 · 스토리지 · DB) 아무것도 하지 않고 그 사실을 기록한 뒤 끝낸다.
 * 부분 실패는 정상 경로다: 항목 하나가 깨지면 failed 를 올리고 다음 항목으로 간다.
 */
export async function runInstagramIngest(options: RunOptions): Promise<IngestResult> {
  const { trigger, actor = trigger === 'cron' ? 'system' : 'admin' } = options;
  const startedAtMs = Date.now();
  const aiUnavailable = isAiConfigured() ? null : AI_NOT_CONFIGURED.reason;

  // DB 가 없으면 중복 판정도 저장도 불가능하다. 여기서 끊지 않으면 매 실행이 전량 재다운로드가 된다.
  if (!isDatabaseConfigured()) {
    const error = new DependencyUnavailableError(
      'DATABASE_URL 이 없어 수집 결과를 저장할 수 없습니다.',
      { missingEnv: ['DATABASE_URL'] },
    );
    return failWith(trigger, localRun(), error, aiUnavailable);
  }

  const run = await startRun();

  // 자격 증명 · 스토리지. 하나라도 없으면 한 장도 건드리지 않고 끝낸다.
  const missing = missingRunEnv();
  if (missing.length > 0) {
    const error = new DependencyUnavailableError(
      `인스타그램 수집에 필요한 환경변수가 없습니다: ${missing.join(', ')}`,
      { missingEnv: missing },
    );
    return failWith(trigger, run, error, aiUnavailable);
  }

  const creds = instagramCredentialsFromEnv();
  if (!creds) {
    const error = new DependencyUnavailableError('인스타그램 자격 증명을 읽지 못했습니다.');
    return failWith(trigger, run, error, aiUnavailable);
  }

  let fetched = 0;
  let created = 0;
  let failed = 0;
  let skipped = 0;
  let remaining = 0;

  try {
    const media = await fetchInstagramMedia(creds);
    fetched = media.length;

    const known = await knownIgMediaIds();
    const fresh = media.filter((m) => !known.has(m.id));
    skipped = fetched - fresh.length;

    // 오래된 것부터 넣는다. 중간에 예산이 끊겨도 "어디까지 왔는지"가 시간순으로 이어진다.
    fresh.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));

    const maxItems = Math.max(1, options.maxItems ?? DEFAULT_MAX_ITEMS);

    for (const [index, item] of fresh.entries()) {
      if (index >= maxItems || Date.now() - startedAtMs > TIME_BUDGET_MS) {
        remaining = fresh.length - index;
        break;
      }

      try {
        if ((await ingestOne(item)) === 'created') created += 1;
        else skipped += 1;
      } catch (itemErr) {
        // 한 장의 실패가 나머지를 막지 않는다. 세어서 남기고 다음으로 간다.
        failed += 1;
        console.error('[ingest] 항목 실패', item.id, itemErr);
      }
    }

    const closed = await finishRun(run, { fetched, created, failed, error: null });

    await recordActivity({
      actor,
      action: `Instagram 동기화 — 신규 ${created}건 수집`,
      detail: { trigger, fetched, created, failed, skipped, remaining },
    });

    return { ok: true, trigger, run: closed, skipped, remaining, aiUnavailable };
  } catch (err) {
    // 목록 조회 자체가 실패한 경우가 대부분이다(토큰 만료 · 한도 초과).
    const error =
      err instanceof AppError
        ? err
        : new AppError('INTERNAL', 500, '수집 중 오류가 발생했습니다.');

    // 클라이언트에 나가는 문장과 별개로, 기록에는 실제 원인을 남긴다.
    const detail = err instanceof Error ? err.message : String(err);
    const closed = await finishRun(run, { fetched, created, failed, error: detail });

    if (err instanceof InstagramApiError) {
      console.error('[ingest] Instagram 실패', err.failure, err.message);
    } else if (!(err instanceof AppError)) {
      console.error('[ingest] 예기치 못한 실패', err);
    }

    return { ok: false, trigger, run: closed, error, skipped, remaining, aiUnavailable };
  }
}

/* ============================ 미리보기 ============================ */

export type IngestPreview = {
  /** 계정에 있는 사진 총 건수(캐러셀은 낱장으로 센다) */
  fetched: number;
  /** 이미 가지고 있는 건수 */
  known: number;
  /** 이번에 새로 들어올 건수 */
  fresh: number;
  aiUnavailable: string | null;
};

/**
 * 아무것도 저장하지 않고 "지금 돌리면 몇 장이 들어오는가"만 답한다.
 * 토큰이 살아 있는지 확인하는 가장 싼 방법이기도 하다 — 그래서 IngestRun 을 만들지 않는다.
 * 실행하지 않은 것을 실행 이력에 남기면 이력이 거짓말을 하게 된다.
 */
export async function previewInstagramIngest(): Promise<IngestPreview> {
  // 미리보기는 아무것도 저장하지 않으므로 스토리지 토큰까지 요구하지 않는다.
  const missing = missingFetchEnv();
  if (missing.length > 0) {
    throw new DependencyUnavailableError(
      `인스타그램 수집에 필요한 환경변수가 없습니다: ${missing.join(', ')}`,
      { missingEnv: missing },
    );
  }
  if (!isDatabaseConfigured()) {
    throw new DependencyUnavailableError('DATABASE_URL 이 없어 중복 여부를 판단할 수 없습니다.', {
      missingEnv: ['DATABASE_URL'],
    });
  }

  const creds = instagramCredentialsFromEnv();
  if (!creds) throw new DependencyUnavailableError('인스타그램 자격 증명을 읽지 못했습니다.');

  const media = await fetchInstagramMedia(creds);
  const known = await knownIgMediaIds();
  const fresh = media.filter((m) => !known.has(m.id)).length;

  return {
    fetched: media.length,
    known: media.length - fresh,
    fresh,
    aiUnavailable: isAiConfigured() ? null : AI_NOT_CONFIGURED.reason,
  };
}
