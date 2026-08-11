// Instagram Graph API 클라이언트.
//
// 이 모듈이 하는 일은 하나다: 계정의 사진 목록을 전량 가져온다.
// 원본 다운로드 · 재인코딩 · 저장은 image-pipeline 과 server/ingest 의 몫이다.
//
// 실패를 뭉뚱그리지 않는 것이 이 파일의 핵심이다. 토큰 만료와 레이트리밋은
// 운영자가 해야 할 일이 서로 다르다(재발급 vs 기다리기). 호출측이 그 둘과
// 일반 오류를 구분할 수 있어야 IngestRun 에 남는 문장이 쓸모가 있다.

import { DependencyUnavailableError } from '@/server/errors';

/* ============================ 설정 ============================ */

/**
 * Instagram Login(계정 직접 연결)으로 발급한 토큰이 기본이다 — Basic Display 폐지 이후
 * 이 경로가 표준이고, 토큰 자동 연장(refresh_access_token)도 이 호스트에만 있다.
 * Facebook 페이지를 경유하는 앱이면 IG_GRAPH_HOST=graph.facebook.com 으로 되돌린다.
 */
const GRAPH_HOST = process.env.IG_GRAPH_HOST ?? 'graph.instagram.com';

/** 토큰 연장 전용 호스트. 어느 GRAPH_HOST 를 쓰든 연장은 여기로만 간다. */
const TOKEN_HOST = 'graph.instagram.com';
/** 버전을 고정한다 — 생략하면 앱 기본 버전을 따라가 어느 날 조용히 깨진다. */
const API_VERSION = process.env.IG_API_VERSION ?? 'v25.0';

/** Graph API 가 한 페이지에 허용하는 상한. */
const PAGE_LIMIT = 100;
/** 무한 루프 방어. 도달하면 조용히 자르지 않고 경고를 남긴다. */
const MAX_PAGES = 500;
/** 응답이 오지 않는 요청에 크론 전체를 묶어 두지 않는다. */
const REQUEST_TIMEOUT_MS = 20_000;
/** 일시적 실패(429 · 5xx · 네트워크)에만 적용되는 재시도 횟수. */
const MAX_ATTEMPTS = 3;
/** 서버리스에서 오래 자고 있을 수 없다. 한 번의 대기 상한. */
const MAX_BACKOFF_MS = 5_000;

/**
 * 실제로 쓰는 필드만 요청한다.
 * width/height 는 IG Media 필드 목록에 없어서 요청해도 오지 않는다 — 원본을 내려받아 실측한다.
 * permalink 는 받지 않는다. 인스타 아웃링크를 어디에도 싣지 않는 것이 사이트 규칙이라
 * 저장할 곳도 쓸 곳도 없다.
 */
const MEDIA_FIELDS = [
  'id',
  'media_type',
  'media_url',
  'thumbnail_url',
  'caption',
  'timestamp',
  'children{id,media_type,media_url,thumbnail_url}',
].join(',');

/* ============================ 자격 증명 ============================ */

export type InstagramCredentials = { accessToken: string; userId: string };

/** 크론이 실행 전에 확인하는 환경변수. 비어 있으면 503 으로 끊는다. */
export function missingInstagramEnv(): string[] {
  return (['IG_USER_ID', 'IG_ACCESS_TOKEN'] as const).filter((k) => !process.env[k]?.trim());
}

/** 환경변수에서 자격 증명을 읽는다. 하나라도 없으면 null — 반쪽짜리로 호출하지 않는다. */
export function instagramCredentialsFromEnv(): InstagramCredentials | null {
  const accessToken = process.env.IG_ACCESS_TOKEN?.trim();
  const userId = process.env.IG_USER_ID?.trim();
  if (!accessToken || !userId) return null;
  return { accessToken, userId };
}

/* ============================ 오류 ============================ */

export type InstagramFailure =
  /** 토큰 재발급이 필요하다 */
  | 'token_expired'
  /** 시간이 지나면 풀린다 */
  | 'rate_limited'
  /** 앱 권한·스코프 문제 */
  | 'permission'
  /** 그 밖의 API 오류 */
  | 'http'
  /** 네트워크 · 타임아웃 */
  | 'network';

/**
 * Graph API 실패. 전부 503(DEPENDENCY_UNAVAILABLE)으로 나가되 details.failure 로 원인이 갈린다.
 * errors.ts 의 ErrorCode 유니온은 공용이라 여기서 늘리지 않는다.
 */
export class InstagramApiError extends DependencyUnavailableError {
  readonly failure: InstagramFailure;
  readonly httpStatus: number | null;
  /** 레이트리밋일 때만 값이 있다. 관리자 화면이 "언제 다시" 를 말할 근거. */
  readonly retryAfterSeconds: number | null;

  constructor(
    failure: InstagramFailure,
    message: string,
    extra: {
      httpStatus?: number | null;
      retryAfterSeconds?: number | null;
      apiCode?: number;
      apiSubcode?: number;
      apiMessage?: string;
      traceId?: string;
    } = {},
  ) {
    super(message, {
      seam: 'instagram',
      failure,
      ...(extra.httpStatus != null ? { httpStatus: extra.httpStatus } : {}),
      ...(extra.retryAfterSeconds != null ? { retryAfterSeconds: extra.retryAfterSeconds } : {}),
      ...(extra.apiCode != null ? { apiCode: extra.apiCode } : {}),
      ...(extra.apiSubcode != null ? { apiSubcode: extra.apiSubcode } : {}),
      // API 원문 메시지는 그대로 흘리지 않고 요약만 남긴다.
      ...(extra.apiMessage ? { apiMessage: extra.apiMessage.slice(0, 200) } : {}),
      ...(extra.traceId ? { traceId: extra.traceId } : {}),
    });
    this.failure = failure;
    this.httpStatus = extra.httpStatus ?? null;
    this.retryAfterSeconds = extra.retryAfterSeconds ?? null;
  }
}

/** 토큰이 만료·무효. 재시도해도 소용없다 — 사람이 재발급해야 한다. */
export class InstagramTokenExpiredError extends InstagramApiError {}

/** 호출 한도 초과. 재시도가 의미 있는 유일한 실패다. */
export class InstagramRateLimitError extends InstagramApiError {}

/* ============================ 응답 형태 ============================ */

/** Graph API 응답 중 우리가 요청한 필드만. 나머지는 정의하지 않는다. */
export type IgApiChild = {
  id?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};
export type IgApiItem = {
  id?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  timestamp?: string;
  children?: { data?: IgApiChild[] };
};
type IgApiPage = { data?: IgApiItem[]; paging?: { next?: string } };
type GraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

/** 수집 단위. 게시물이 아니라 사진 한 장이다(캐러셀은 자식마다 한 장). */
export type InstagramMedia = {
  /** 사진 id. 캐러셀 자식이면 자식의 id — Photo.igMediaId 의 값이 된다. */
  id: string;
  /** 소속 게시물 id. 단일 게시물이면 id 와 같다. */
  parentId: string;
  /** 게시물 안에서의 순서. 캐러셀 자식은 0,1,2…, 단일 게시물은 항상 0. */
  order: number;
  mediaUrl: string;
  /** 'image' 는 mediaUrl 이 사진, 'video' 는 mediaUrl 이 mp4 이고 posterUrl 이 썸네일이다. */
  mediaType: 'image' | 'video';
  /** 동영상 썸네일(Graph API thumbnail_url). 이미지에는 없다. */
  posterUrl: string | null;
  caption: string | null;
  /** Graph API 가 준 ISO8601 문자열. 해석은 parseInstagramTimestamp 로. */
  timestamp: string;
};

/* ============================ 순수 함수 ============================ */

/**
 * API 응답 → 수집 단위.
 * 캐러셀은 자식 각각이 한 건으로 풀린다 — 갤러리의 단위가 게시물이 아니라 미디어이기 때문이다.
 * 캡션·촬영시각은 부모 것을 물려받는다(Graph API 가 자식에 캡션을 주지 않는다).
 * 동영상(릴스)도 수집한다 — mediaUrl 이 mp4, posterUrl 이 썸네일이다.
 * 썸네일 없는 동영상은 포스터를 만들 수 없어 건너뛴다(수집 실패가 아니라 비대상).
 */
export function flattenInstagramMedia(items: IgApiItem[]): InstagramMedia[] {
  const out: InstagramMedia[] = [];

  const push = (
    m: { id?: string; media_type?: string; media_url?: string; thumbnail_url?: string },
    order: number,
    inherited: { parentId: string; caption: string | null; timestamp: string },
  ): boolean => {
    if (!m.id || !m.media_url) return false;
    if (m.media_type === 'IMAGE') {
      out.push({ id: m.id, order, mediaUrl: m.media_url, mediaType: 'image', posterUrl: null, ...inherited });
      return true;
    }
    if (m.media_type === 'VIDEO') {
      if (!m.thumbnail_url) return false;
      out.push({
        id: m.id,
        order,
        mediaUrl: m.media_url,
        mediaType: 'video',
        posterUrl: m.thumbnail_url,
        ...inherited,
      });
      return true;
    }
    return false;
  };

  for (const item of items) {
    if (!item.id) continue;
    const inherited = {
      parentId: item.id,
      caption: item.caption ?? null,
      timestamp: item.timestamp ?? '',
    };

    if (item.media_type === 'CAROUSEL_ALBUM') {
      // 순서는 API 가 준 배열 순서 그대로다 — 비대상을 건너뛰어도 남은 미디어의 앞뒤는 유지된다.
      let order = 0;
      for (const child of item.children?.data ?? []) {
        if (push(child, order, inherited)) order += 1;
      }
      continue;
    }

    push(item, 0, inherited);
  }

  return out;
}

/** Graph API 의 timestamp 는 ISO8601. 해석되지 않으면 null 이다 — 촬영일을 지어내지 않는다. */
export function parseInstagramTimestamp(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ============================ 오류 분류 ============================ */

/** 토큰 만료·무효. 190 은 OAuth 토큰, 102 는 세션 만료. */
const TOKEN_CODES = new Set([102, 190]);
/** 호출 한도. 4 앱, 17 사용자, 32 페이지, 613 커스텀 한도. */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
/** 권한·스코프. 200~299 는 전부 권한 계열이다. */
const PERMISSION_CODES = new Set([10, 803]);

function classify(status: number, err: GraphError | undefined): InstagramFailure {
  const code = err?.code;
  if (code !== undefined) {
    // 코드가 상태보다 정확하다 — 레이트리밋이 403 으로 오는 경우가 있다.
    if (TOKEN_CODES.has(code)) return 'token_expired';
    if (RATE_LIMIT_CODES.has(code)) return 'rate_limited';
    if (PERMISSION_CODES.has(code) || (code >= 200 && code <= 299)) return 'permission';
  }
  if (status === 401) return 'token_expired';
  if (status === 429) return 'rate_limited';
  if (status === 403) return 'permission';
  return 'http';
}

function messageFor(failure: InstagramFailure, status: number, err: GraphError | undefined): string {
  switch (failure) {
    case 'token_expired':
      return 'Instagram 액세스 토큰이 만료되었거나 무효합니다. 장기 토큰을 재발급한 뒤 IG_ACCESS_TOKEN 을 갱신해 주세요.';
    case 'rate_limited':
      return 'Instagram 호출 한도를 초과했습니다. 잠시 뒤 다시 시도하면 풀립니다.';
    case 'permission':
      return 'Instagram 앱 권한이 부족합니다. instagram_basic 스코프와 연결된 계정을 확인해 주세요.';
    default:
      return `Instagram Graph API 호출 실패 (HTTP ${status})${err?.type ? ` — ${err.type}` : ''}.`;
  }
}

function toError(status: number, body: unknown, retryAfterSeconds: number | null): InstagramApiError {
  const err = (body as { error?: GraphError } | null)?.error;
  const failure = classify(status, err);
  const extra = {
    httpStatus: status,
    retryAfterSeconds,
    apiCode: err?.code,
    apiSubcode: err?.error_subcode,
    apiMessage: err?.message,
    traceId: err?.fbtrace_id,
  };
  const message = messageFor(failure, status, err);

  if (failure === 'token_expired') return new InstagramTokenExpiredError(failure, message, extra);
  if (failure === 'rate_limited') return new InstagramRateLimitError(failure, message, extra);
  return new InstagramApiError(failure, message, extra);
}

/** Retry-After 는 초 단위 정수 또는 HTTP-date 다. 둘 다 받아 준다. */
function retryAfterSeconds(res: Response): number | null {
  const raw = res.headers.get('retry-after');
  if (!raw) return null;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber >= 0) return Math.round(asNumber);
  const asDate = new Date(raw).getTime();
  if (Number.isNaN(asDate)) return null;
  return Math.max(0, Math.round((asDate - Date.now()) / 1000));
}

function isRetryable(err: InstagramApiError): boolean {
  if (err.failure === 'rate_limited' || err.failure === 'network') return true;
  // 5xx 는 저쪽 사정이라 다시 걸면 되는 경우가 많다. 4xx 는 다시 걸어도 같다.
  return err.failure === 'http' && (err.httpStatus ?? 0) >= 500;
}

function backoffMs(attempt: number, hinted: number | null): number {
  const hint = hinted != null ? hinted * 1000 : 0;
  const exponential = 500 * 2 ** (attempt - 1);
  // 지터가 없으면 병렬 실행이 같은 순간에 몰려 한도를 다시 친다.
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(Math.max(hint, exponential) + jitter, MAX_BACKOFF_MS);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ============================ 요청 ============================ */

/** 한 페이지를 가져온다. 일시적 실패만 재시도하고, 토큰·권한 실패는 즉시 던진다. */
async function requestPage(url: string, signal?: AbortSignal): Promise<IgApiPage> {
  let last: InstagramApiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        cache: 'no-store',
        signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      last = new InstagramApiError(
        'network',
        `Instagram Graph API 에 연결하지 못했습니다: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
      if (attempt === MAX_ATTEMPTS) throw last;
      await sleep(backoffMs(attempt, null));
      continue;
    }

    if (res.ok) {
      const body: unknown = await res.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        // 200 인데 JSON 이 아니면 프록시가 끼어든 것이다. 성공으로 넘기면 0건 수집이 된다.
        throw new InstagramApiError('http', 'Instagram Graph API 응답을 해석할 수 없습니다.', {
          httpStatus: res.status,
        });
      }
      return body as IgApiPage;
    }

    const body: unknown = await res.json().catch(() => null);
    last = toError(res.status, body, retryAfterSeconds(res));
    if (!isRetryable(last) || attempt === MAX_ATTEMPTS) throw last;
    await sleep(backoffMs(attempt, last.retryAfterSeconds));
  }

  // 도달하지 않지만, 루프가 값을 내지 않고 끝나는 경로를 열어 두지 않는다.
  throw last ?? new InstagramApiError('http', 'Instagram Graph API 호출에 실패했습니다.');
}

export type FetchOptions = {
  /** 페이지네이션 상한 override. 테스트와 미리보기에서 쓴다. */
  maxPages?: number;
  /** 크론 전체 시간 예산에 묶기 위한 중단 신호. */
  signal?: AbortSignal;
};

/**
 * 계정의 사진을 전량 페이지네이션하며 가져온다.
 *
 * 건수 상한을 두지 않는 것이 수집 원칙이다 — 목록 조회는 JSON 이라 싸다.
 * 비싼 것은 원본 다운로드·재인코딩이고, 그쪽 예산은 server/ingest 가 따로 관리한다.
 */
export async function fetchInstagramMedia(
  creds: InstagramCredentials,
  options: FetchOptions = {},
): Promise<InstagramMedia[]> {
  const base = `https://${GRAPH_HOST}/${API_VERSION}/${encodeURIComponent(creds.userId)}/media`;
  const params = new URLSearchParams({
    fields: MEDIA_FIELDS,
    limit: String(PAGE_LIMIT),
    access_token: creds.accessToken,
  });

  const maxPages = options.maxPages ?? MAX_PAGES;
  // paging.next 는 access_token 까지 포함한 완성 URL 이라 그대로 따라가면 된다.
  let url: string | undefined = `${base}?${params.toString()}`;
  const out: InstagramMedia[] = [];
  const seen = new Set<string>();
  let pages = 0;

  while (url) {
    if (pages >= maxPages) {
      console.warn('[instagram] 페이지 상한 도달 — 이후 게시물은 조회하지 않았다', {
        pages,
        collected: out.length,
      });
      break;
    }

    const page = await requestPage(url, options.signal);
    for (const media of flattenInstagramMedia(page.data ?? [])) {
      // 같은 사진이 두 페이지에 걸쳐 오는 경우가 있다(그 사이 새 게시물이 올라오면 창이 밀린다).
      if (seen.has(media.id)) continue;
      seen.add(media.id);
      out.push(media);
    }
    url = page.paging?.next;
    pages += 1;
  }

  return out;
}

/**
 * 토큰이 지금 살아 있는지만 확인한다(1페이지 · 1건).
 * 관리자 화면의 "연결 확인" 버튼이 전량 수집을 돌리지 않고도 답을 얻는 경로다.
 */
/* ============================ 토큰 연장 ============================ */

/** 연장 결과. expiresAt 은 지금 시각 + expires_in 으로 계산한 값이다. */
export type RefreshedToken = { accessToken: string; expiresAt: Date };

/**
 * 장기 토큰을 60일 더 연장한다.
 *
 * 조건이 둘 있다: 토큰이 발급 후 24시간이 지났어야 하고, 아직 만료되지 않았어야 한다.
 * 만료된 뒤에는 이 경로가 없다 — 사람이 앱 대시보드에서 재발급하는 수밖에 없다.
 * 그래서 호출측(server/ig-token.ts)은 만료 직전이 아니라 여유를 두고 미리 부른다.
 *
 * 실패는 던진다. 연장 실패가 곧 수집 실패는 아니므로(기존 토큰이 아직 살아 있다)
 * 호출측이 잡아서 로그만 남기고 진행한다.
 */
export async function refreshLongLivedToken(accessToken: string): Promise<RefreshedToken> {
  const url = `https://${TOKEN_HOST}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`;

  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (cause) {
    throw new InstagramApiError(
      'network',
      `토큰 연장 요청에 실패했습니다: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toError(res.status, body, retryAfterSeconds(res));

  const token = (body as { access_token?: unknown } | null)?.access_token;
  const expiresIn = (body as { expires_in?: unknown } | null)?.expires_in;
  if (typeof token !== 'string' || !token || typeof expiresIn !== 'number') {
    // 200 인데 형태가 다르면 연장된 척하고 옛 토큰을 새 만료일로 덮어쓸 위험이 있다.
    throw new InstagramApiError('http', '토큰 연장 응답을 해석할 수 없습니다.', {
      httpStatus: res.status,
    });
  }

  return { accessToken: token, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

export async function checkInstagramToken(
  creds: InstagramCredentials,
): Promise<{ ok: true } | { ok: false; failure: InstagramFailure; message: string }> {
  const url = `https://${GRAPH_HOST}/${API_VERSION}/${encodeURIComponent(creds.userId)}/media?fields=id&limit=1&access_token=${encodeURIComponent(creds.accessToken)}`;
  try {
    await requestPage(url);
    return { ok: true };
  } catch (err) {
    if (err instanceof InstagramApiError) {
      return { ok: false, failure: err.failure, message: err.message };
    }
    throw err;
  }
}
