import { notFound } from 'next/navigation';
import { Badge, PageHeader, Panel } from '@/components/admin';
import { getSiteSettings, listOutstandingItems } from '@/server/settings';
import { ChannelLinksForm } from './ChannelLinksForm';
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
                <dt>주소 · 일본어</dt>
                <dd>{orTbc(settings.address.ja)}</dd>
              </div>
              <div className={s.field}>
                <dt>주소 · 로마자 (EN / KO 공용)</dt>
                <dd>{orTbc(settings.address.latin)}</dd>
              </div>
              <div className={s.field}>
                <dt>공항에서</dt>
                <dd>{orTbc(settings.fromAirport)}</dd>
              </div>
              <div className={s.field}>
                <dt>주차</dt>
                <dd>{settings.parking.ko}</dd>
              </div>
              <div className={s.field}>
                <dt>대응 언어</dt>
                <dd>{settings.languages.ko}</dd>
              </div>
              <div className={s.field}>
                <dt>구글맵 좌표</dt>
                <dd>
                  {settings.geo.lat !== null && settings.geo.lng !== null ? (
                    <span className={s.num}>
                      {settings.geo.lat} · {settings.geo.lng}
                    </span>
                  ) : (
                    orTbc(null)
                  )}
                </dd>
              </div>
              <div className={s.field}>
                <dt>대표 이메일</dt>
                <dd>
                  {/* 주소 자체는 이 화면에도 찍지 않는다. 설정 여부만 본다. */}
                  {settings.representativeEmail.configured ? (
                    <Badge tone="default">설정됨 (비공개)</Badge>
                  ) : (
                    <Badge tone="warn">미설정</Badge>
                  )}
                  <span className={s.dim}>
                    {' '}
                    문의 폼 수신용입니다. 주소는 어떤 페이지에도 출력하지 않습니다.
                  </span>
                </dd>
              </div>
            </dl>
          </Panel>

          {/* ---------------- 언어별 상담 채널 ---------------- */}
          <Panel title="언어별 상담 채널" aside={<span className={s.eyebrow}>CHANNEL</span>}>
            <div className={s.channelRule}>
              1순위는 언어별 업무 규칙으로 고정입니다 — KO 카카오톡 · JA LINE · EN 문의 폼, Instagram은
              모든 언어에서 보조. 여기서는 핸들과 링크만 바꿉니다.
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
