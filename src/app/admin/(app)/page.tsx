import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AdminButton,
  formatDateTime,
  NotWired,
  PageHeader,
  Panel,
  StatTile,
} from '@/components/admin';
import { listActivity } from '@/server/activity';
import { checkAdminPageAccess } from '@/server/auth';
import { countPhotos, listPhotos } from '@/server/photos';
import s from './page.module.css';

// 대시보드는 "지금 손을 대야 할 것"만 보여 준다. 각 숫자는 그것을 해소하는 화면으로 직접 간다.
export default async function AdminDashboard() {
  // [보안] 레이아웃의 잠금 화면은 "표시"만 막는다. children은 이미 렌더된 뒤 레이아웃 조건이
  // 평가되므로, 페이지 서버 컴포넌트는 그대로 실행되고 그 결과가 RSC 페이로드에 실려 나간다.
  // (미인증 요청에서 실제로 데이터가 새는 것을 확인함.) 그래서 데이터를 읽기 전에 여기서 막는다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const [counts, unsorted, activity] = await Promise.all([
    countPhotos(),
    listPhotos({ status: 'UNSORTED' }),
    listActivity(6),
  ]);

  const placeSummary = Object.entries(counts.publishedByPlace)
    .map(([place, n]) => `${place} ${n}`)
    .join(' · ');

  return (
    <>
      <PageHeader
        title="대시보드"
        description="수집은 전량, 전시는 선별. 아래 숫자는 각각 그것을 처리하는 화면으로 이어집니다."
        actions={
          <>
            {/* 수동 업로드도 미선별 큐로 들어간다 — 인스타 수집분과 같은 줄에 선다.
                두 경로 모두 아직 연결되지 않아 비활성으로 둔다(누르면 아무 일도 안 나는 버튼은 두지 않는다). */}
            <AdminButton variant="default" disabled title="인스타 수집 크론이 아직 연결되지 않았습니다">
              지금 동기화
            </AdminButton>
            <AdminButton variant="primary" disabled title="업로드 저장 경로가 아직 연결되지 않았습니다">
              ＋ 수동 업로드
            </AdminButton>
          </>
        }
      />

      <div className={s.body}>
        <div className={s.tiles}>
          <StatTile
            label="미선별"
            value={counts.unsorted}
            hint="선별해 주세요 →"
            hintTone="accent"
            href="/admin/photos?status=UNSORTED"
          />
          <StatTile
            label="전시중"
            value={counts.published}
            hint={placeSummary || '분류 미지정'}
            href="/admin/photos?status=PUBLISHED"
          />
          <StatTile
            label="신규 문의"
            value={null}
            notWiredReason="문의 저장소가 아직 연결되지 않았습니다."
          />
          <StatTile
            label="요대응"
            value={counts.needsAttention}
            hint={`alt 미완성 ${counts.missingAlt} · 저해상도 ${counts.lowRes}`}
            hintTone="accent"
            href="/admin/photos?flag=missing-alt"
          />
        </div>

        {/* 미번역 건수는 번역 화면의 저장소가 붙어야 셀 수 있다. 0으로 채우지 않는다. */}
        <NotWired
          what="미번역 건수는 요대응 숫자에 포함되어 있지 않습니다."
          hint="번역 저장소 연결 후 합산됩니다"
        />

        <div className={s.split}>
          <Panel
            title="수집된 사진 (미선별)"
            aside={<Link href="/admin/photos?status=UNSORTED">전체 보기 →</Link>}
          >
            {unsorted.length === 0 ? (
              <p className={s.emptyText}>미선별 사진이 없습니다.</p>
            ) : (
              <ul className={s.strip}>
                {unsorted.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/photos?photo=${p.id}`} className={s.thumb}>
                      {/* 관리자 화면은 noindex이고 원본 호스트가 유동적이라 next/image 대신 img를 쓴다 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.originalUrl} alt="" loading="lazy" decoding="async" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="최근 활동">
            <ul className={s.feed}>
              {activity.map((a) => (
                <li key={a.id} className={s.feedItem}>
                  <span className={s.feedAction}>{a.action}</span>
                  <span className={s.feedMeta}>
                    {a.actor} · {formatDateTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
