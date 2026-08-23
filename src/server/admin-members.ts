import { isDatabaseConfigured, prisma } from '@/server/db';

/**
 * 관리자 계정 현황.
 *
 * 누가 관리자인지는 환경변수 ADMIN_ALLOWED_EMAILS 가 정한다 — 이 모듈은 그 결정을 바꾸지 않는다.
 * DB 에 두면 세션 하나가 털렸을 때 공격자가 자기를 멤버로 추가할 수 있어서, 권한의 원천은
 * 배포 권한이 있어야 만질 수 있는 환경변수에 둔다(src/auth.ts 의 설계).
 *
 * 이 모듈이 하는 일은 두 가지뿐이다.
 *  1) 허용 목록을 화면에 보여 준다 — 지금 누가 들어올 수 있는지 한눈에 확인한다.
 *  2) 실제로 로그인한 기록(AdminMember.lastSeenAt)을 남긴다 — 목록에 있지만 한 번도
 *     들어온 적 없는 계정, 목록에서 빠졌는데 최근까지 들어왔던 계정을 구별한다.
 */

export type AdminMemberView = {
  email: string;
  /** 지금 환경변수 허용 목록에 있는가. 이게 false 면 더 이상 로그인할 수 없다. */
  inAllowlist: boolean;
  /** 마지막으로 실제 로그인한 시각. 한 번도 없으면 null. */
  lastSeenAt: Date | null;
  /** 처음 기록된 시각 */
  firstSeenAt: Date | null;
};

function allowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * 로그인 성공 시 호출된다. 실패해도 로그인은 막지 않는다 — 기록은 부가 정보다.
 * DB 가 없으면 조용히 건너뛴다.
 */
export async function touchAdminMember(email: string, name?: string | null): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const normalized = email.trim().toLowerCase();
  try {
    await prisma.adminMember.upsert({
      where: { email: normalized },
      create: {
        email: normalized,
        name: name ?? null,
        inAllowlist: allowedEmails().includes(normalized),
        lastSeenAt: new Date(),
      },
      update: {
        ...(name ? { name } : {}),
        inAllowlist: allowedEmails().includes(normalized),
        lastSeenAt: new Date(),
      },
    });
  } catch (err) {
    console.error('[admin-members] 접속 기록 실패 (로그인은 계속)', err);
  }
}

/**
 * 허용 목록 ∪ 접속 기록. 허용 목록에만 있는 계정은 접속 기록이 null 이고,
 * 접속 기록에만 있는 계정은 inAllowlist 가 false 다 — 둘 다 화면에 보여야 한다.
 */
export async function listAdminMembers(): Promise<AdminMemberView[]> {
  const allowed = allowedEmails();
  const byEmail = new Map<string, AdminMemberView>();

  for (const email of allowed) {
    byEmail.set(email, { email, inAllowlist: true, lastSeenAt: null, firstSeenAt: null });
  }

  if (isDatabaseConfigured()) {
    try {
      const rows = await prisma.adminMember.findMany({ orderBy: { lastSeenAt: 'desc' } });
      for (const r of rows) {
        const email = r.email.toLowerCase();
        byEmail.set(email, {
          email,
          inAllowlist: allowed.includes(email),
          lastSeenAt: r.lastSeenAt,
          firstSeenAt: r.createdAt,
        });
      }
    } catch (err) {
      console.error('[admin-members] 접속 기록 조회 실패 (허용 목록만 표시)', err);
    }
  }

  // 허용된 계정 먼저, 그 안에서는 최근 접속순.
  return [...byEmail.values()].sort((a, b) => {
    if (a.inAllowlist !== b.inAllowlist) return a.inAllowlist ? -1 : 1;
    return (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0);
  });
}
