import { timingSafeEqual } from 'node:crypto';
import { auth, isAllowedAdminEmail, isSsoConfigured } from '@/auth';
import { UnauthorizedError } from './errors';

/**
 * 관리자 인증 — 구글 SSO.
 *
 * 비밀번호를 우리가 보관하지 않는다. 구글이 신원을 확인하고,
 * 허용 목록(ADMIN_ALLOWED_EMAILS)이 그중 누가 관리자인지를 정한다.
 * 목록과 자격 증명은 `src/auth.ts`가 소유하고, 이 파일은 화면·라우트용 가드만 제공한다.
 *
 * 통과 조건은 두 곳 모두 같다: 세션이 있고, 그 이메일이 지금도 허용 목록에 있을 것.
 * 세션 발급 시점에 목록에 있었어도 지금 빠졌다면 막는다.
 */

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

/** 구글 자격 증명 + 허용 목록이 배포 환경에 갖춰졌는지. UI 배너가 참조한다. */
export function isAdminAuthConfigured(): boolean {
  return isSsoConfigured();
}

/** 지금 로그인한 관리자의 이메일. 없으면 null. 활동 로그 기록에 쓴다. */
export async function currentAdminEmail(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  return isAllowedAdminEmail(email) ? email : null;
}

/**
 * 관리자 API 가드. 통과하지 못하면 UnauthorizedError를 던진다.
 * 호출측은 errorResponse(err)로 감싸면 401이 나간다.
 *
 * req는 시그니처 호환을 위해 남겨 둔다 — 세션은 쿠키에서 읽으므로 본문이 필요하지 않다.
 */
export async function requireAdmin(_req?: Request): Promise<void> {
  if (!isSsoConfigured()) {
    // 미설정을 통과로 해석하면 관리자 API가 통째로 공개된다. 닫는다.
    throw new UnauthorizedError(
      '구글 SSO가 설정되지 않아 관리자 API를 사용할 수 없습니다. AUTH_GOOGLE_ID · AUTH_GOOGLE_SECRET · ADMIN_ALLOWED_EMAILS 를 먼저 설정해 주세요.',
    );
  }

  const session = await auth();
  if (!session?.user?.email || !isAllowedAdminEmail(session.user.email)) {
    throw new UnauthorizedError();
  }
}

export type AdminPageAccess =
  | { allowed: true; guarded: true; email: string }
  /** 개발 환경에서 SSO 미설정 — 열어 두되 화면에 경고를 띄운다. */
  | { allowed: true; guarded: false; reason: string }
  | { allowed: false; reason: string; needsSignIn?: boolean };

/**
 * 화면(서버 컴포넌트)용 접근 판정. 라우트 핸들러의 requireAdmin과 규칙을 맞춘다.
 *
 * - SSO 설정 + 허용 목록에 있는 세션 → 통과
 * - SSO 설정 + 세션 없음/목록 밖 → 차단 (로그인으로 유도)
 * - SSO 미설정 → production이면 차단, 그 외에는 경고를 달고 통과
 */
export async function checkAdminPageAccess(): Promise<AdminPageAccess> {
  if (!isSsoConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      return {
        allowed: false,
        reason:
          '구글 SSO가 설정되지 않았습니다. AUTH_GOOGLE_ID · AUTH_GOOGLE_SECRET · AUTH_SECRET · ADMIN_ALLOWED_EMAILS 를 배포 환경변수에 먼저 설정해 주세요.',
      };
    }
    return {
      allowed: true,
      guarded: false,
      reason:
        '구글 SSO가 설정되지 않아 인증 없이 열려 있습니다. 개발 환경에서만 이 상태가 허용됩니다.',
    };
  }

  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return { allowed: false, reason: '관리자 로그인이 필요합니다.', needsSignIn: true };
  }

  if (!isAllowedAdminEmail(email)) {
    // 어떤 계정으로 들어왔는지는 알려 준다 — 계정을 잘못 고른 경우가 대부분이다.
    return {
      allowed: false,
      reason: `${email} 계정은 관리자 목록에 없습니다. 다른 계정으로 로그인하거나 등록을 요청해 주세요.`,
      needsSignIn: true,
    };
  }

  return { allowed: true, guarded: true, email };
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
