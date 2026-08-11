// 인스타 자격 증명의 보관과 자동 연장.
//
// 환경변수만으로는 이 문제를 풀 수 없다. 장기 토큰은 60일 뒤 만료되는데,
// 배포된 함수는 자기 환경변수를 고쳐 쓸 수 없기 때문이다. 그래서 토큰은 DB(Setting)에 살고
// 환경변수는 "최초 1회 씨앗"으로만 쓴다.
//
// 계약 셋:
//   1) 만료되지 않은 토큰만 자동으로 연장한다. 만료된 뒤에는 사람이 재발급해야 하고,
//      그 사실을 숨기지 않는다.
//   2) 연장 실패가 수집 실패는 아니다 — 아직 살아 있는 기존 토큰으로 그 회차는 진행한다.
//   3) 토큰 원문은 어떤 경로로도 화면에 돌려주지 않는다. 상태(만료일·남은 일수)만 나간다.

import { isDatabaseConfigured, prisma } from '@/server/db';
import {
  instagramCredentialsFromEnv,
  refreshLongLivedToken,
  type InstagramCredentials,
} from '@/lib/instagram';

/* ============================ 계정 ============================ */

/**
 * 수집 계정. 'main' 은 작품(@usherinmaking), 'dress' 는 룩북(@usherindress).
 *
 * 계정마다 토큰이 따로 살아야 한다 — 하나의 Setting 키를 공유하면 한쪽 연장이
 * 다른 쪽 토큰을 덮어써 두 계정이 동시에 죽는다.
 */
export type IgAccount = 'main' | 'dress';

type AccountKeys = {
  token: string;
  expiresAt: string;
  storedAt: string;
  envToken: string;
  envUserId: string;
};

const ACCOUNTS: Record<IgAccount, AccountKeys> = {
  main: {
    token: 'ig.access_token',
    expiresAt: 'ig.token_expires_at',
    // 최초 씨앗 시각. 연장은 발급 24시간 뒤부터 가능해서 이 값이 필요하다.
    storedAt: 'ig.token_stored_at',
    envToken: 'IG_ACCESS_TOKEN',
    envUserId: 'IG_USER_ID',
  },
  dress: {
    token: 'ig.dress.access_token',
    expiresAt: 'ig.dress.token_expires_at',
    storedAt: 'ig.dress.token_stored_at',
    envToken: 'IG_DRESS_ACCESS_TOKEN',
    envUserId: 'IG_DRESS_USER_ID',
  },
};

/* ============================ 정책 ============================ */

/**
 * 남은 수명이 이 값 아래로 내려가면 연장한다.
 *
 * 크론이 6시간마다 도니 20일이면 40회 넘게 기회가 있다. 한 번 실패해도 다음 회차가 받는다.
 * 만료 직전에 붙이면 그 마지막 며칠에 API 가 흔들릴 때 회복 경로가 없어진다.
 */
const REFRESH_WHEN_DAYS_LEFT = 20;

/** 연장 가능 최소 나이(24시간) + 여유. 이보다 어린 토큰은 API 가 거절한다. */
const MIN_TOKEN_AGE_MS = 25 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/* ============================ 저장소 ============================ */

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
  return row?.value ?? null;
}

async function writeSettings(entries: Record<string, string>): Promise<void> {
  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ============================ 상태 ============================ */

export type TokenState = {
  /** 토큰을 하나라도 가지고 있는가 */
  present: boolean;
  /** DB 에 저장된 토큰인가. false 면 아직 환경변수 씨앗만 있다. */
  stored: boolean;
  expiresAt: Date | null;
  /** 만료까지 남은 일수. expiresAt 을 모르면 null. */
  daysLeft: number | null;
  expired: boolean;
  /** 이번 회차에 연장을 시도할 대상인가 */
  needsRefresh: boolean;
};

function daysUntil(expiresAt: Date | null): number | null {
  if (!expiresAt) return null;
  return Math.floor((expiresAt.getTime() - Date.now()) / DAY_MS);
}

/**
 * 지금 토큰이 어떤 상태인지. 관리자 화면이 "며칠 남았는가"를 말하는 근거다.
 * 토큰 값 자체는 절대 포함하지 않는다.
 */
export async function inspectToken(account: IgAccount = 'main'): Promise<TokenState> {
  const keys = ACCOUNTS[account];
  const envToken = process.env[keys.envToken]?.trim() ?? null;

  if (!isDatabaseConfigured()) {
    return {
      present: Boolean(envToken),
      stored: false,
      expiresAt: null,
      daysLeft: null,
      expired: false,
      needsRefresh: false,
    };
  }

  const [dbToken, expiresRaw] = await Promise.all([
    readSetting(keys.token),
    readSetting(keys.expiresAt),
  ]);
  const expiresAt = parseDate(expiresRaw);
  const daysLeft = daysUntil(expiresAt);
  const expired = expiresAt != null && expiresAt.getTime() <= Date.now();

  return {
    present: Boolean(dbToken ?? envToken),
    stored: Boolean(dbToken),
    expiresAt,
    daysLeft,
    expired,
    needsRefresh: Boolean(dbToken) && !expired && daysLeft != null && daysLeft <= REFRESH_WHEN_DAYS_LEFT,
  };
}

/* ============================ 씨앗 심기 ============================ */

/**
 * 환경변수 토큰을 DB 로 한 번 옮긴다. 이후의 연장은 DB 값을 대상으로 일어난다.
 *
 * 만료일을 모르므로 60일로 잡는다 — 장기 토큰의 발급 시점 수명이 60일이고,
 * 실제 값은 첫 연장에서 API 가 알려 준다. 이 추정치가 실제보다 길면 연장 시도가 실패하는데,
 * 그때는 만료로 처리되어 사람에게 재발급을 요구하게 된다(조용히 넘어가지 않는다).
 */
async function seedFromEnv(keys: AccountKeys, envToken: string): Promise<void> {
  const now = new Date();
  await writeSettings({
    [keys.token]: envToken,
    [keys.expiresAt]: new Date(now.getTime() + 60 * DAY_MS).toISOString(),
    [keys.storedAt]: now.toISOString(),
  });
}

/* ============================ 자격 증명 획득 ============================ */

export type CredentialsResult = {
  credentials: InstagramCredentials | null;
  /** 이번 호출에서 실제로 연장이 일어났는가 */
  refreshed: boolean;
  /** 연장을 시도했으나 실패한 이유. null 이면 시도하지 않았거나 성공했다. */
  refreshError: string | null;
  state: TokenState;
};

/**
 * 수집에 쓸 자격 증명을 돌려준다. 필요하면 그 자리에서 토큰을 연장한다.
 *
 * 우선순위는 DB → 환경변수다. DB 에 없으면 환경변수 값을 심고 그것을 쓴다.
 * 연장이 실패해도 credentials 는 비지 않는다 — 기존 토큰이 아직 유효하기 때문이다.
 * 만료된 경우에만 credentials 가 null 이 되고, 호출측이 그 사실을 기록으로 남긴다.
 */
export async function getInstagramCredentials(
  account: IgAccount = 'main',
): Promise<CredentialsResult> {
  const keys = ACCOUNTS[account];
  const envToken = process.env[keys.envToken]?.trim() ?? null;
  const userId = process.env[keys.envUserId]?.trim() ?? null;
  const envCreds =
    account === 'main'
      ? instagramCredentialsFromEnv()
      : envToken && userId
        ? { accessToken: envToken, userId }
        : null;

  // DB 가 없으면 연장 자체가 불가능하다. 환경변수 그대로 쓰고 그 사실을 상태로 알린다.
  if (!isDatabaseConfigured()) {
    return {
      credentials: envCreds,
      refreshed: false,
      refreshError: null,
      state: {
        present: Boolean(envCreds),
        stored: false,
        expiresAt: null,
        daysLeft: null,
        expired: false,
        needsRefresh: false,
      },
    };
  }

  let token = await readSetting(keys.token);

  if (!token && envCreds) {
    await seedFromEnv(keys, envCreds.accessToken);
    token = envCreds.accessToken;
  }

  if (!token || !userId) {
    const state = await inspectToken(account);
    return { credentials: null, refreshed: false, refreshError: null, state };
  }

  let state = await inspectToken(account);

  // 만료된 토큰으로는 연장도 조회도 되지 않는다. 사람이 재발급해야 한다.
  if (state.expired) {
    return { credentials: null, refreshed: false, refreshError: null, state };
  }

  let refreshed = false;
  let refreshError: string | null = null;

  if (state.needsRefresh) {
    const storedAt = parseDate(await readSetting(keys.storedAt));
    const tooYoung = storedAt != null && Date.now() - storedAt.getTime() < MIN_TOKEN_AGE_MS;

    if (tooYoung) {
      // 심은 지 하루가 안 됐다. 다음 회차에 다시 본다.
      refreshError = '토큰이 발급된 지 24시간이 지나지 않아 연장을 건너뛰었습니다.';
    } else {
      try {
        const next = await refreshLongLivedToken(token);
        await writeSettings({
          [keys.token]: next.accessToken,
          [keys.expiresAt]: next.expiresAt.toISOString(),
          [keys.storedAt]: new Date().toISOString(),
        });
        token = next.accessToken;
        refreshed = true;
        state = await inspectToken(account);
      } catch (err) {
        // 연장 실패는 이번 수집을 막지 않는다 — 기존 토큰이 아직 유효하다.
        refreshError = err instanceof Error ? err.message : String(err);
        console.warn('[ig-token] 토큰 연장 실패 — 기존 토큰으로 진행한다', refreshError);
      }
    }
  }

  return { credentials: { accessToken: token, userId }, refreshed, refreshError, state };
}
