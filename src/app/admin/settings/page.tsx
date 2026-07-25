import { AdminButton, Badge, NotWired, PageHeader, Panel } from '@/components/admin';
import { LOCALES, LOCALE_LABEL, type Locale } from '@/lib/i18n';
import {
  canShowNaverNotice,
  getSiteSettings,
  listOutstandingItems,
  validateChannelOrder,
  CHANNEL_LABEL,
  REQUIRED_PRIMARY,
  type ChannelSetting,
} from '@/server/settings';
import s from './settings.module.css';

export const metadata = { title: '설정 · 관리자' };

/** 아직 못 받은 값은 빈칸이 아니라 (확인 필요)로 보여 준다. */
function orTbc(value: string | null) {
  if (value && value.trim()) return <span>{value}</span>;
  return <span className={s.tbc}>(확인 필요)</span>;
}

export default async function AdminSettingsPage() {
  const [settings, outstanding] = await Promise.all([getSiteSettings(), listOutstandingItems()]);

  const ordered = (locale: Locale): ChannelSetting[] =>
    [...settings.channels[locale]].sort((a, b) => a.order - b.order);

  return (
    <>
      <PageHeader
        title="설정"
        description="사이트 정보와 언어별 상담 채널을 관리합니다. 핸들과 링크는 바꿀 수 있지만, 언어별 1순위 채널은 업무 규칙이라 어기면 경고가 남습니다."
        actions={
          <AdminButton variant="primary" disabled title="저장 경로가 아직 연결되지 않았습니다">
            저장
          </AdminButton>
        }
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
            <div className={s.channels}>
              {LOCALES.map((locale: Locale) => {
                const list = ordered(locale);
                const warnings = validateChannelOrder(
                  locale,
                  list.map((c) => c.id),
                );
                const ruleBroken = warnings.some((w) => w.level === 'rule');

                return (
                  <div key={locale} className={ruleBroken ? s.channelBoxWarn : s.channelBox}>
                    <div className={s.channelHead}>
                      <b>{LOCALE_LABEL[locale]}</b>
                      <span className={s.dim}>
                        {list.map((c) => CHANNEL_LABEL[c.id]).join(' · ')}
                      </span>
                    </div>

                    <div className={s.channelRule}>
                      1순위 고정: <b>{CHANNEL_LABEL[REQUIRED_PRIMARY[locale]]}</b>
                      {' · '}Instagram은 보조
                    </div>

                    <ul className={s.channelList}>
                      {list.map((c, i) => (
                        <li key={c.id} className={s.channelItem}>
                          <span className={s.channelOrder}>{i + 1}</span>
                          <span>{CHANNEL_LABEL[c.id]}</span>
                          {c.handle ? <span className={s.dim}>{c.handle}</span> : null}
                          {c.url ? (
                            <Badge tone="default">링크 있음</Badge>
                          ) : c.id === 'form' ? (
                            <span className={s.dim}>내부 폼</span>
                          ) : (
                            <Badge tone="warn">링크 미설정</Badge>
                          )}
                        </li>
                      ))}
                    </ul>

                    {warnings.length > 0 ? (
                      <ul className={s.warnList}>
                        {warnings.map((w, i) => (
                          <li key={i} className={w.level === 'rule' ? s.warnRule : s.warnNotice}>
                            {w.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}

              <div className={s.channelCommon}>
                공통: 문의 폼(DB 저장) · 이메일 주소는 노출하지 않음
              </div>

              <div className={s.channelBox}>
                <div className={s.channelHead}>
                  <b>네이버 블로그</b>
                  <span className={s.dim}>
                    {canShowNaverNotice('ko') ? '한국어 페이지에만 노출' : ''}
                  </span>
                </div>
                <div className={s.channelRule}>
                  안내 노출 언어: {LOCALE_LABEL[settings.naverBlog.noticeLocale]} 전용
                </div>
                <ul className={s.channelList}>
                  <li className={s.channelItem}>
                    <span>블로그 URL</span>
                    {settings.naverBlog.url ? (
                      <code className={s.code}>{settings.naverBlog.url}</code>
                    ) : (
                      <Badge tone="warn">미설정</Badge>
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </Panel>
        </div>

        <NotWired
          what="사이트 정보 · 상담 채널 저장"
          hint={
            <>
              값은 환경변수와 <code className={s.code}>@/content/site</code> 에서 읽습니다.
              prisma/schema.prisma 에 Settings 모델이 아직 없어, 모델 추가 후 열립니다.
            </>
          }
        />
      </div>
    </>
  );
}
