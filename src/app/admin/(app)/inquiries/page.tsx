import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  AdminButton,
  Badge,
  FilterChip,
  PageHeader,
  Panel,
  Toolbar,
  formatDateTime,
} from '@/components/admin';
import { LOCALE_SHORT, LOCALES, isLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { checkAdminPageAccess } from '@/server/auth';
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABEL,
  REPLY_TEMPLATES,
  countByStatus,
  extractQuestionCandidates,
  getInquiry,
  listInquiries,
} from '@/server/inquiries';
import type { InquiryStatus } from '@/server/inquiries';

import { MemoPanel, PromotePanel, ReplyPanel, StatusActions } from './Panels';
import s from './inquiries.module.css';

/** 문의는 개인정보다. 어떤 경로에서도 캐시되지 않아야 한다. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: '문의 INBOX',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ status?: string; id?: string; locale?: string }>;

function isStatus(v: string): v is InquiryStatus {
  return (INQUIRY_STATUSES as string[]).includes(v);
}

function href(params: { status?: string; id?: string; locale?: string }): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const qs = q.toString();
  return qs ? `/admin/inquiries?${qs}` : '/admin/inquiries';
}

export default async function InquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  // 레이아웃의 잠금 화면은 "표시"만 막는다. children 은 prop 으로 이미 렌더되어
  // RSC 페이로드에 그대로 실리므로, 데이터를 읽기 전에 이 화면에서 직접 끊어야 한다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const sp = await searchParams;
  const status = sp.status && isStatus(sp.status) ? sp.status : undefined;
  const locale = sp.locale && isLocale(sp.locale) ? (sp.locale as Locale) : undefined;

  const [items, counts] = await Promise.all([listInquiries({ status, locale }), countByStatus()]);

  // 선택된 문의가 없으면 목록의 첫 건을 연다.
  const selectedId = sp.id ?? items[0]?.id;
  const selected = selectedId ? await getInquiry(selectedId) : null;

  const candidates = selected ? extractQuestionCandidates(selected.message) : [];
  const templates = selected
    ? REPLY_TEMPLATES.map((t) => ({ id: t.id, label: t.label, body: t.body[selected.locale] }))
    : [];

  return (
    <>
      <PageHeader
        title="문의"
        description={
          <>
            원본은 여기에 저장됩니다. 새 문의가 오면 메일과 LINE으로 <b>알림만</b> 전송됩니다
            (자동예약·캘린더 없음).
          </>
        }
        actions={
          <>
            <AdminButton variant="quiet" disabled title="내보내기 경로가 아직 연결되지 않았습니다.">
              CSV 내보내기
            </AdminButton>
            <AdminButton variant="quiet" disabled title="알림 설정 화면이 아직 없습니다.">
              알림 설정
            </AdminButton>
          </>
        }
      />

      <Toolbar>
        <div className={s.tabs}>
          <FilterChip
            href={href({ locale: sp.locale })}
            active={!status}
            count={Object.values(counts).reduce((a, b) => a + b, 0)}
          >
            전체
          </FilterChip>
          {INQUIRY_STATUSES.map((st) => (
            <FilterChip
              key={st}
              href={href({ status: st, locale: sp.locale })}
              active={status === st}
              count={counts[st]}
            >
              {INQUIRY_STATUS_LABEL[st]}
            </FilterChip>
          ))}
        </div>

        <div className={s.filterMeta}>
          <span>언어:</span>
          <Link href={href({ status: sp.status })} className={locale ? s.miniLink : s.miniLinkOn}>
            전체
          </Link>
          {LOCALES.map((l) => (
            <Link
              key={l}
              href={href({ status: sp.status, locale: l })}
              className={locale === l ? s.miniLinkOn : s.miniLink}
            >
              {LOCALE_SHORT[l]}
            </Link>
          ))}
          <span className={s.filterNote}>· 기간: 30일</span>
        </div>
      </Toolbar>

      <div className={s.split}>
        <nav className={s.list} aria-label="문의 목록">
          {items.length === 0 ? (
            <p className={s.empty}>이 조건에 해당하는 문의가 없습니다.</p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={href({ status: sp.status, locale: sp.locale, id: item.id })}
                className={item.id === selectedId ? `${s.listItem} ${s.listItemOn}` : s.listItem}
              >
                <div className={s.listTop}>
                  <span className={s.listName}>{item.name}</span>
                  {item.status === 'NEW' ? <Badge tone="brass">NEW</Badge> : null}
                </div>
                <div className={s.listMeta}>
                  {LOCALE_SHORT[item.locale]} · {item.shootType} ·{' '}
                  {formatDateTime(item.createdAt)}
                </div>
                <div className={s.listExcerpt} lang="auto">
                  {item.excerpt}
                </div>
                {item.notifyFailed ? (
                  <div className={s.notifyFailed}>알림 전송 실패 · 문의는 정상 접수됨</div>
                ) : null}
              </Link>
            ))
          )}
        </nav>

        <div className={s.detail}>
          {!selected ? (
            <Panel>
              <p className={s.empty}>왼쪽에서 문의를 선택하세요.</p>
            </Panel>
          ) : (
            <>
              <Panel>
                <div className={s.detailHead}>
                  <div>
                    <h2 className={s.detailName}>{selected.name}</h2>
                    <p className={s.detailMeta}>
                      {selected.emailMasked} · {LOCALE_SHORT[selected.locale]}
                      <br />
                      희망: {selected.shootType}
                      {selected.dates ? ` · ${selected.dates}` : ''}
                      {selected.people ? ` · ${selected.people}` : ''}
                    </p>
                    <p className={s.privacyNote}>
                      이메일 주소는 화면에 표시하지 않습니다. 발송 시에만 서버에서 사용합니다.
                    </p>
                  </div>
                  <StatusActions id={selected.id} current={selected.status} />
                </div>

                {selected.notifyFailed ? (
                  <p className={s.notifyBanner} role="status">
                    이 문의의 알림 전송이 실패했습니다. <b>문의 내용은 그대로 보존되어 있습니다</b> —
                    알림 실패는 접수 실패가 아닙니다.
                  </p>
                ) : null}

                <p className={s.message} lang="auto">
                  {selected.message}
                </p>
              </Panel>

              <div className={s.detailGrid}>
                <Panel title="답변 (템플릿에서)">
                  <ReplyPanel id={selected.id} templates={templates} />
                </Panel>

                <div className={s.detailSide}>
                  <Panel title="이 질문을 FAQ로">
                    <PromotePanel
                      id={selected.id}
                      candidates={candidates}
                      alreadyPromoted={selected.promotedFaqId !== null}
                    />
                  </Panel>

                  <Panel title="메모">
                    <MemoPanel id={selected.id} initial={selected.memo ?? ''} />
                  </Panel>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
