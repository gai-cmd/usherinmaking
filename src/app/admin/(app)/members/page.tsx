import { notFound } from 'next/navigation';
import { Badge, DataTable, PageHeader, Panel, formatDateTime, type Column } from '@/components/admin';
import { checkAdminPageAccess } from '@/server/auth';
import { listAdminMembers, type AdminMemberView } from '@/server/admin-members';
import s from './members.module.css';

export const metadata = { title: '관리자 계정 · 관리자' };
export const dynamic = 'force-dynamic';

/**
 * 관리자 계정 현황 — 읽기 전용.
 *
 * 여기서 계정을 추가·삭제하지 않는다. 권한의 원천은 배포 환경변수 ADMIN_ALLOWED_EMAILS 다 —
 * 관리자 화면에서 관리자를 늘릴 수 있으면, 세션 하나가 털렸을 때 공격자가 자기를 추가한다.
 * 이 화면은 "지금 누가 들어올 수 있고, 실제로 언제 들어왔는가" 를 보여 주는 대장이다.
 */
export default async function AdminMembersPage() {
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const members = await listAdminMembers();
  const allowed = members.filter((m) => m.inAllowlist);
  const removed = members.filter((m) => !m.inAllowlist);

  const columns: Column<AdminMemberView>[] = [
    {
      key: 'email',
      header: '계정',
      cell: (m) => (
        <span className={s.email}>
          {m.email}
          {access.guarded && access.email?.toLowerCase() === m.email && (
            <Badge tone="brass" title="지금 이 화면을 보고 있는 계정">
              나
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: '120px',
      cell: (m) =>
        m.inAllowlist ? (
          <Badge tone="default">허용됨</Badge>
        ) : (
          <Badge tone="warn" title="환경변수 목록에서 빠져 더 이상 로그인할 수 없습니다">
            목록에서 제외
          </Badge>
        ),
    },
    {
      key: 'lastSeen',
      header: '마지막 접속',
      width: '180px',
      cell: (m) =>
        m.lastSeenAt ? (
          formatDateTime(m.lastSeenAt)
        ) : (
          <span className={s.dim}>접속 기록 없음</span>
        ),
    },
    {
      key: 'firstSeen',
      header: '처음 기록',
      width: '180px',
      cell: (m) => (m.firstSeenAt ? formatDateTime(m.firstSeenAt) : <span className={s.dim}>—</span>),
    },
  ];

  return (
    <>
      <PageHeader
        title="관리자 계정"
        description="이 관리자 화면에 들어올 수 있는 구글 계정 목록입니다. 추가·삭제는 보안상 여기서 하지 않고 배포 환경변수에서 합니다."
        actions={null}
      />

      <div className={s.body}>
        <Panel title={`허용된 계정 ${allowed.length}명`} aside={<span className={s.eyebrow}>ALLOWLIST</span>}>
          <DataTable
            columns={columns}
            rows={allowed}
            getRowKey={(m) => m.email}
            empty="허용된 계정이 없습니다. ADMIN_ALLOWED_EMAILS 가 비어 있으면 관리자 화면은 열리지 않습니다."
          />
        </Panel>

        {removed.length > 0 && (
          <Panel
            title={`목록에서 제외된 계정 ${removed.length}명`}
            aside={<span className={s.eyebrow}>REMOVED</span>}
          >
            <p className={s.note}>
              예전에 로그인한 기록은 있지만 지금 허용 목록에는 없는 계정입니다. 더 이상 들어올 수 없습니다.
            </p>
            <DataTable columns={columns} rows={removed} getRowKey={(m) => m.email} />
          </Panel>
        )}

        <Panel title="계정을 추가하거나 빼려면" aside={<span className={s.eyebrow}>HOW TO</span>}>
          <ol className={s.steps}>
            <li>
              Vercel 프로젝트 → <b>Settings → Environment Variables</b> 에서{' '}
              <code className={s.code}>ADMIN_ALLOWED_EMAILS</code> 를 연다.
            </li>
            <li>
              구글 계정 주소를 쉼표로 이어 적는다. 예:{' '}
              <code className={s.code}>owner@gmail.com,staff@gmail.com</code>
            </li>
            <li>저장한 뒤 <b>재배포</b>한다. 그 전까지는 바뀐 목록이 적용되지 않는다.</li>
            <li>뺀 계정은 다음 요청부터 막힌다 — 이미 열린 화면도 새로고침하면 나간다.</li>
          </ol>
          <p className={s.note}>
            왜 화면에서 못 바꾸게 해 두었나: 관리자 목록을 DB 에 두면 계정 하나가 털렸을 때 공격자가
            자기를 관리자로 추가할 수 있습니다. 환경변수는 배포 권한이 있어야 만질 수 있어서,
            침해와 권한 부여가 분리됩니다.
          </p>
        </Panel>
      </div>
    </>
  );
}
