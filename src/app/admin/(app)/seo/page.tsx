import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, FilterChip, PageHeader, Panel } from '@/components/admin';
import { LOCALE_SHORT, LOCALES, isLocale } from '@/lib/i18n';
import type { PageKey } from '@/lib/i18n';
import { checkAdminPageAccess } from '@/server/auth';
import { countSchemaReadyFaqs, listFaqs, listUnansweredFaqs } from '@/server/faq';
import { listPhotos, missingAltLocales } from '@/server/photos';
import { listAllFilterUrls, listUntranslatedTerms } from '@/server/taxonomy';

import { LeadEditor } from './LeadEditor';
import { LEAD_REQUIRED_PAGES, META_DESC_MAX, META_TITLE_MAX, PAGE_LABEL, listLeadRows, listMetaRows } from './leads';
import s from './seo.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'SEO / AEO 점검',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ page?: string; locale?: string }>;

export default async function SeoPage({ searchParams }: { searchParams: SearchParams }) {
  // 레이아웃의 잠금 화면은 "표시"만 막는다. children 은 prop 으로 이미 렌더되어
  // RSC 페이로드에 그대로 실리므로, 데이터를 읽기 전에 이 화면에서 직접 끊어야 한다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const sp = await searchParams;
  const pageKey = (LEAD_REQUIRED_PAGES as string[]).includes(sp.page ?? '')
    ? (sp.page as PageKey)
    : LEAD_REQUIRED_PAGES[0];
  const locale = sp.locale && isLocale(sp.locale) ? sp.locale : 'ja';

  // 리드문은 이제 페이지 문구(코드 기본값 + 관리자 덮어쓰기)를 실제로 읽는다.
  // 한 번 읽어 두 곳에서 나눠 쓴다 — getPageCopy 는 요청 단위 캐시라 중복 조회가 아니다.
  const rows = await listLeadRows();
  const metaRows = await listMetaRows();
  const metaIssues = metaRows.filter((m) => !m.title || !m.description || m.titleOver || m.descOver);
  const leadsMissing = rows.filter((r) => r.lead === null);
  const leads = { written: rows.length - leadsMissing.length, total: rows.length, missing: leadsMissing };

  const [missingAltPhotos, faqs, unansweredFaqs, schemaReadyFaqs, untranslatedTerms, filterUrls] =
    await Promise.all([
      listPhotos({ missingAlt: true }),
      listFaqs(),
      listUnansweredFaqs(),
      countSchemaReadyFaqs(),
      listUntranslatedTerms(),
      listAllFilterUrls(),
    ]);

  const selectedRow = rows.find((r) => r.pageKey === pageKey && r.locale === locale);

  return (
    <>
      <PageHeader
        title="SEO / AEO 점검"
        description={
          <>
            정의형 리드문은 AI 검색이 가장 먼저 인용하는 문장입니다. 이 화면은 잘 쓴 문장을
            다듬는 곳이 아니라 <b>비어 있는 칸을 드러내는 곳</b>입니다.
          </>
        }
        actions={
          <Link href="/admin/taxonomy" className={s.crossLink}>
            ← 카테고리 관리
          </Link>
        }
      />

      {/* ---------- 점검 요약 ---------- */}
      <Panel title="점검 현황">
        <ul className={s.checkList}>
          <li>
            <span>정의형 리드문 (페이지 × 언어)</span>
            <span className={leads.missing.length ? s.bad : s.ok}>
              <b className={s.num}>{leads.written}</b> / {leads.total}
              {leads.missing.length ? ` · ${leads.missing.length}칸 비어 있음` : ''}
            </span>
          </li>
          <li>
            <span>검색 결과 제목·설명 (비었거나 잘림)</span>
            <span className={metaIssues.length ? s.bad : s.ok}>
              <b className={s.num}>{metaIssues.length}</b> / {metaRows.length}칸
            </span>
          </li>
          <li>
            <span>FAQ 스키마에 실을 수 있는 항목</span>
            <span className={schemaReadyFaqs === 0 ? s.bad : s.ok}>
              <b className={s.num}>{schemaReadyFaqs}</b> / {faqs.length}문
            </span>
          </li>
          <li>
            <span>답변이 비어 구조화 데이터에 넣을 수 없는 FAQ</span>
            <span className={unansweredFaqs.length ? s.bad : s.ok}>
              <b className={s.num}>{unansweredFaqs.length}</b>건
            </span>
          </li>
          <li>
            <span>이미지 alt 미설정</span>
            <span className={missingAltPhotos.length ? s.bad : s.ok}>
              <b className={s.num}>{missingAltPhotos.length}</b>건
            </span>
          </li>
          <li>
            <span>갤러리 용어 번역 누락 (해당 언어에서 필터가 사라짐)</span>
            <span className={untranslatedTerms.length ? s.bad : s.ok}>
              <b className={s.num}>{untranslatedTerms.length}</b>건
            </span>
          </li>
          <li>
            <span>정적 생성 중인 갤러리 필터 주소</span>
            <span className={s.ok}>
              <b className={s.num}>{filterUrls.length}</b>건
            </span>
          </li>
          <li>
            <span>Organization · LocalBusiness 구조화 데이터</span>
            <span className={s.ok}>홈(ja/en) · 한국어 메인에서 내보냄 — 좌표는 설정 화면에 넣으면 함께 나갑니다</span>
          </li>
        </ul>
        <p className={s.note}>
          집계할 근거가 없는 항목은 &ldquo;적용됨&rdquo;으로 표시하지 않습니다. 확인되지 않은 것을
          통과로 보여 주면 점검 화면의 의미가 없어집니다.
        </p>
      </Panel>

      <div className={s.layout}>
        {/* ---------- 정의형 리드문 ---------- */}
        <Panel title="정의형 리드문 편집">
          <div className={s.pageTabs}>
            {LEAD_REQUIRED_PAGES.map((k) => (
              <FilterChip
                key={k}
                href={`/admin/seo?page=${k}&locale=${locale}`}
                active={k === pageKey}
              >
                {PAGE_LABEL[k] ?? k}
              </FilterChip>
            ))}
          </div>

          <div className={s.localeTabs}>
            {LOCALES.map((l) => {
              const row = rows.find((r) => r.pageKey === pageKey && r.locale === l);
              return (
                <Link
                  key={l}
                  href={`/admin/seo?page=${pageKey}&locale=${l}`}
                  className={l === locale ? `${s.miniTab} ${s.miniTabOn}` : s.miniTab}
                >
                  {LOCALE_SHORT[l]}
                  {row?.lead ? null : <span className={s.dot} aria-label="비어 있음" />}
                </Link>
              );
            })}
          </div>

          {selectedRow ? (
            <>
              <p className={s.urlLine}>
                <code>{selectedRow.url}</code>
              </p>
              <LeadEditor
                key={`${selectedRow.pageKey}-${selectedRow.locale}`}
                pageKey={selectedRow.pageKey}
                pageLabel={selectedRow.pageLabel}
                locale={selectedRow.locale}
                initial={selectedRow.lead ?? ''}
                slot={selectedRow.slot}
                editHref={selectedRow.editHref}
              />
            </>
          ) : null}
        </Panel>

        {/* ---------- 검색 결과 미리보기 ---------- */}
        <Panel title="검색 결과 미리보기 (제목 · 설명)">
          <p className={s.note}>
            구글 검색 결과에 보이는 두 줄입니다. 제목 {META_TITLE_MAX}자 · 설명 {META_DESC_MAX}자를
            넘으면 뒤가 잘립니다(한·일 문자는 더 일찍). 고치는 자리는 페이지 문구 편집기의{' '}
            <code>meta.title</code> · <code>meta.description</code> 입니다.
          </p>
          <ul className={s.serpList}>
            {metaRows.map((m) => {
              const bad = !m.title || !m.description || m.titleOver || m.descOver;
              return (
                <li key={`${m.pageKey}-${m.locale}`} className={bad ? s.serpBad : s.serpItem}>
                  <span className={s.serpMeta}>
                    {m.pageLabel} · {LOCALE_SHORT[m.locale]} · <code>{m.url}</code>
                  </span>
                  <span className={s.serpTitle} lang={m.locale}>
                    {m.title ?? <em className={s.missingText}>제목 비어 있음</em>}
                    {m.titleOver && <Badge tone="warn">{m.title!.length}자 — 잘림</Badge>}
                  </span>
                  <span className={s.serpDesc} lang={m.locale}>
                    {m.description ?? <em className={s.missingText}>설명 비어 있음</em>}
                    {m.descOver && <Badge tone="warn">{m.description!.length}자 — 잘림</Badge>}
                  </span>
                  <Link href={`${m.editHref}?locale=${m.locale}`} className={s.leadEditLink}>
                    페이지 문구에서 고치기 →
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className={s.right}>
          {/* ---------- 비어 있는 리드문 ---------- */}
          <Panel
            title="리드문이 비어 있는 페이지"
            aside={<span className={s.panelAside}>{leads.missing.length}칸</span>}
          >
            {leads.missing.length === 0 ? (
              <p className={s.note}>모든 페이지에 정의형 리드문이 있습니다.</p>
            ) : (
              <ul className={s.missList}>
                {leads.missing.map((r) => (
                  <li key={`${r.pageKey}-${r.locale}`}>
                    <Link href={`/admin/seo?page=${r.pageKey}&locale=${r.locale}`}>
                      {r.pageLabel} <span className={s.miniLocale}>{LOCALE_SHORT[r.locale]}</span>
                    </Link>
                    <code className={s.missUrl}>{r.url}</code>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* ---------- alt 누락 ---------- */}
          <Panel
            title="alt가 비어 있는 사진"
            aside={<span className={s.panelAside}>{missingAltPhotos.length}건</span>}
          >
            {missingAltPhotos.length === 0 ? (
              <p className={s.note}>alt가 세 언어 모두 채워져 있습니다.</p>
            ) : (
              <>
                <p className={s.note}>
                  alt는 세 언어가 모두 있어야 전시할 수 있습니다. 사진 화면에서 채웁니다.
                </p>
                <ul className={s.altList}>
                  {missingAltPhotos.slice(0, 20).map((p) => (
                    <li key={p.id}>
                      <code className={s.altId}>{p.id}</code>
                      <span className={s.altMissing}>
                        {missingAltLocales(p.alt)
                          .map((l) => LOCALE_SHORT[l])
                          .join(' · ')}{' '}
                        없음
                      </span>
                      {p.status === 'PUBLISHED' ? <Badge tone="warn">전시중</Badge> : null}
                    </li>
                  ))}
                  {missingAltPhotos.length > 20 ? (
                    <li className={s.note}>외 {missingAltPhotos.length - 20}건</li>
                  ) : null}
                </ul>
                <p className={s.note}>
                  <Link href="/admin/photos" className={s.link}>
                    사진 화면에서 alt 채우기 →
                  </Link>
                </p>
              </>
            )}
          </Panel>

          {/* ---------- FAQ 구조화 데이터 ---------- */}
          <Panel title="FAQ 구조화 데이터">
            <p className={s.note}>
              FAQ는 실제 문의 문장 그대로 씁니다. 답변이 비어 있는 항목은 FAQPage 스키마에 넣지
              않습니다 — 빈 답변을 내보내면 인용될 때 잘못된 정보가 됩니다.
            </p>
            <ul className={s.faqList}>
              {faqs.map((f) => {
                const answered = LOCALES.filter((l) => f.answer[l]?.trim());
                return (
                  <li key={f.id}>
                    <span className={s.faqQ} lang="auto">
                      {f.question.ja || f.question.ko || f.question.en}
                    </span>
                    <span className={answered.length ? s.faqOk : s.faqBad}>
                      {answered.length
                        ? `답변 ${answered.map((l) => LOCALE_SHORT[l]).join(' ')}`
                        : '답변 없음'}
                      {f.page ? '' : ' · 노출 페이지 미정'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
