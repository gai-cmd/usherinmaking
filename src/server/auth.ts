import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { UnauthorizedError } from './errors';

/**
 * 관리자 인증 — 임시 방식.
 *
 * 아직 인증 제공자(Auth0 / Clerk / NextAuth)가 붙지 않았다. 그때까지의 게이트로
 * 환경변수 ADMIN_TOKEN 하나를 공유 비밀로 쓴다. 제공자가 붙으면 이 파일만 교체한다.
 *
 * 토큰 값은 소스에 절대 두지 않는다. 미설정 시에는 통과가 아니라 실패로 닫는다.
 */

const ADMIN_COOKIE = 'uim_admin';
const CRON_HEADER = 'authorization';

/** 길이가 달라도 조기 반환하지 않도록 해시 없이 상수시간 비교. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    // 길이 비교는 어쩔 수 없이 조기 반환이지만, 값 자체는 노출하지 않는다.
    return false;
  }
  return timingSafeEqual(ba, bb);
}

function bearer(req: Request): string | null {
  const raw = req.headers.get(CRON_HEADER);
  if (!raw) return null;
  const [scheme, token] = raw.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

/** ADMIN_TOKEN이 배포 환경에 설정되어 있는지. UI가 "가드 미설정" 배너를 띄우는 데 쓴다. */
export function isAdminAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOKEN);
}

/**
 * 관리자 API 가드. 통과하지 못하면 UnauthorizedError를 던진다.
 * 호출측은 errorResponse(err)로 감싸면 401이 나간다.
 */
export async function requireAdmin(req: Request): Promise<void> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    // 미설정을 통과로 해석하면 관리자 API가 통째로 공개된다. 닫는다.
    throw new UnauthorizedError('ADMIN_TOKEN이 설정되지 않아 관리자 API를 사용할 수 없습니다.');
  }

  const headerToken = bearer(req);
  if (headerToken && safeEqual(headerToken, expected)) return;

  const jar = await cookies();
  const cookieToken = jar.get(ADMIN_COOKIE)?.value;
  if (cookieToken && safeEqual(cookieToken, expected)) return;

  throw new UnauthorizedError();
}

export type AdminPageAccess =
  | { allowed: true; guarded: true }
  /** 개발 환경에서 ADMIN_TOKEN 미설정 — 열어 두되 화면에 경고를 띄운다. */
  | { allowed: true; guarded: false; reason: string }
  | { allowed: false; reason: string };

/**
 * 화면(서버 컴포넌트)용 접근 판정. 라우트 핸들러의 requireAdmin과 규칙을 맞춘다.
 *
 * - ADMIN_TOKEN 설정 + 쿠키 일치 → 통과
 * - ADMIN_TOKEN 설정 + 불일치 → 차단
 * - ADMIN_TOKEN 미설정 → production이면 차단, 그 외에는 경고를 달고 통과
 */
export async function checkAdminPageAccess(): Promise<AdminPageAccess> {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return { allowed: false, reason: 'ADMIN_TOKEN이 설정되지 않았습니다. 배포 환경변수를 먼저 설정해 주세요.' };
    }
    return {
      allowed: true,
      guarded: false,
      reason: 'ADMIN_TOKEN이 없어 인증 없이 열려 있습니다. 개발 환경에서만 이 상태가 허용됩니다.',
    };
  }

  const jar = await cookies();
  const cookieToken = jar.get(ADMIN_COOKIE)?.value;
  if (cookieToken && safeEqual(cookieToken, expected)) return { allowed: true, guarded: true };

  return { allowed: false, reason: `관리자 인증이 필요합니다. ${ADMIN_COOKIE} 쿠키가 없거나 일치하지 않습니다.` };
}

/**
 * 크론 전용 가드. Vercel Cron은 Authorization 헤더를 붙일 수 있으므로 여기서만 검사한다.
 * CRON_SECRET 미설정은 통과가 아니라 실패다 — 아니면 누구나 수집을 트리거할 수 있다.
 */
export async function requireCronSecret(req: Request): Promise<void> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    throw new UnauthorizedError('CRON_SECRET이 설정되지 않아 크론 엔드포인트가 비활성화되어 있습니다.');
  }
  const token = bearer(req);
  if (!token || !safeEqual(token, expected)) throw new UnauthorizedError();
}

export const ADMIN_COOKIE_NAME = ADMIN_COOKIE;
