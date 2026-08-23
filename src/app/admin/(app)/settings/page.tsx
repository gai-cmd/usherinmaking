import { notFound } from 'next/navigation';
import { PageHeader, Panel } from '@/components/admin';
import { getSiteSettings, listOutstandingItems } from '@/server/settings';
import { ChannelLinksForm } from './ChannelLinksForm';
import { SiteInfoForm } from './SiteInfoForm';
import s from './settings.module.css';
import { checkAdminPageAccess } from '@/server/auth';

export const metadata = { title: '설정 · 관리자' };

/** 아직 못 받은 값은 빈칸이 아니라 (확인 필요)로 보여 준다. */
function orTbc(value: string | null) {
  if (value && value.trim()) return <span>{value}</span>;
  return <span className={s.tbc}>(확인 필요)</span>;
}

export default async function AdminSettingsPage() {
  // 레이아웃 가드만으로는 이 컴포넌트의 실행을 막지 못한다.
  // App Router에서 자식 세그먼트는 부모의 조건과 무관하게 렌더되고, 그 결과가 같은 응답의
  // RSC 페이로드에 실려 나간다. 그래서 데이터를 읽기 전에 여기서 한 번 더 끊는다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const [settings, outstanding] = await Promise.all([getSiteSettings(), listOutstandingItems()]);


  return (
    <>
      <PageHeader
        title="설정"
        description="사이트 정보와 언어별 상담 채널을 관리합니다. 핸들과 링크는 바꿀 수 있지만, 언어별 1순위 채널은 업무 규칙이라 어기면 경고가 남습니다."
        actions={null}
      />

      <div className={s.body}>
        {outstanding.length > 0 ? (
          <div className={s.outstanding}>
            <b>아직 받지 못한 항목 {outstanding.length}건</b>
            <ul className={s.outstandingList}>
              {outstanding.map((o) => (
                <li key={o.key}>
                  {o.label} <span className={s.tbc}>{o.token.ko}</span>
                </li>
              ))}
            </ul>
            <p className={s.outstandingNote}>
              이 값들은 페이지에서 빈칸이 아니라 각 언어의 (요확인) 토큰으로 표시됩니다. 비워 두면
              의도적으로 생략한 것처럼 읽히기 때문입니다.
            </p>
          </div>
        ) : null}

        <div className={s.split}>
          {/* ---------------- 사이트 정보 ---------------- */}
          <Panel title="사이트 정보" aside={<span className={s.eyebrow}>SITE</span>}>
            <dl className={s.fields}>
              <div className={s.field}>
                <dt>로고 (SVG)</dt>
                <dd>
                  {settings.logoSvg ? (
                    <code className={s.code}>{settings.logoSvg}</code>
                  ) : (
                    <>
                      {orTbc(null)}{' '}
                      <span className={s.dim}>— 아직 SVG 파일을 받지 못했습니다</span>
                    </>
                  )}
                </dd>
              </div>
              <div className={s.field}>
                <dt>주차</dt>
                <dd>{settings.parking.ko}</dd>
              </div>
              <div className={s.field}>
                <dt>대응 언어</dt>
                <dd>{settings.languages.ko}</dd>
              </div>
            </dl>

            {/* 주소·공항·좌표는 여기서 직접 고친다. 저장값이 없으면 코드 확정값(STUDIO_INFO)이 보인다. */}
            <SiteInfoForm
              initial={{
                addressJa: settings.address.ja,
                addressLatin: settings.address.latin,
                fromAirport: settings.fromAirport,
                lat: settings.geo.lat,
                lng: settings.geo.lng,
              }}
            />
          </Panel>

          {/* ---------------- 언어별 상담 채널 ---------------- */}
          <Panel title="언어별 상담 채널" aside={<span className={s.eyebrow}>CHANNEL</span>}>
            <div className={s.channelRule}>
              상담은 메신저로만 받습니다(문의 폼·메일 접수 없음). 1순위는 언어별 업무 규칙으로
              고정입니다 — KO 카카오톡 · JA LINE · EN Instagram. Instagram은 모든 언어에 둡니다.
              여기서는 핸들과 링크만 바꿉니다.
            </div>
            <ChannelLinksForm
              initialChannels={settings.channels}
              initialNaverUrl={settings.naverBlog.url}
            />
          </Panel>
        </div>

      </div>
    </>
  );
}
