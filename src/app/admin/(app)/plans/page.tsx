import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminButton, Badge, NotWired, PageHeader, Panel } from '@/components/admin';
import { path } from '@/lib/i18n';
import { checkAdminPageAccess } from '@/server/auth';
import { listFaqs } from '@/server/faq';
import {
  SCOPE_LABEL,
  TAX_RULE_NOTE,
  affectedRoutes,
  affectedSurfaces,
  auditPlans,
  listOptions,
  listPlans,
} from '@/server/plans';

import { PlanEditor } from './PlanEditor';
import s from './plans.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '플랜 · 옵션',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ code?: string }>;

const yen = new Intl.NumberFormat('ja-JP');

export default async function PlansPage({ searchParams }: { searchParams: SearchParams }) {
  // 레이아웃의 잠금 화면은 "표시"만 막는다. children 은 prop 으로 이미 렌더되어
  // RSC 페이로드에 그대로 실리므로, 데이터를 읽기 전에 이 화면에서 직접 끊어야 한다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const sp = await searchParams;
  const [plans, options, issues] = await Promise.all([listPlans(), listOptions(), auditPlans()]);

  const selected = plans.find((p) => p.code === sp.code) ?? plans[0];
  if (!selected) notFound();

  const selectedOptions = options.filter((o) => o.planCodes.includes(selected.code));
  const surfaces = affectedSurfaces(selected);
  const planFaqs = await listFaqs('plan');

  return (
    <>
      <PageHeader
        title="플랜 · 옵션"
        description="여기를 수정하면 홈 목록과 플랜 상세 페이지(JA / EN / KO)가 함께 갱신됩니다."
        actions={
          <AdminButton variant="quiet" disabled title="공개 사이트 미리보기는 아직 연결되지 않았습니다.">
            미리보기
          </AdminButton>
        }
      />

      {issues.length > 0 ? (
        <div className={s.issues} role="status">
          <p className={s.issuesTitle}>저장 전에 확인이 필요한 항목 {issues.length}건</p>
          <ul>
            {issues.map((i, n) => (
              <li key={`${i.code}-${n}`}>
                <code>{i.code}</code> — {i.issue}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={s.layout}>
        <div className={s.left}>
          {plans.map((plan) => {
            const isOn = plan.code === selected.code;
            return isOn ? (
              <Panel key={plan.code}>
                <div className={s.editHead}>
                  <div>
                    <span className={s.badgeLine}>
                      <Badge tone="dark">{SCOPE_LABEL[plan.scope]}</Badge>
                      <Badge tone={plan.taxIncluded ? 'default' : 'muted'}>
                        {plan.taxIncluded ? '税込' : '모니터 가격'}
                      </Badge>
                    </span>
                    <h2 className={s.editTitle} lang="ja">
                      {plan.title.ja}
                    </h2>
                  </div>
                  <span className={s.editing}>편집중</span>
                </div>

                <p className={s.taxNote}>{TAX_RULE_NOTE[plan.scope]}</p>

                <PlanEditor
                  plan={{
                    code: plan.code,
                    scope: plan.scope,
                    price: plan.price,
                    listPrice: plan.listPrice,
                    taxIncluded: plan.taxIncluded,
                    cuts: plan.cuts,
                    order: plan.order,
                    durationJa: plan.duration.ja,
                    titleJa: plan.title.ja,
                  }}
                  affectedRoutes={affectedRoutes(plan)}
                />

                <div className={s.includes}>
                  <p className={s.fieldLabel}>포함 내역 (1줄 = 1항목)</p>
                  <ul className={s.includesList} lang="ja">
                    {plan.includes.ja.length ? (
                      plan.includes.ja.map((line) => <li key={line}>{line}</li>)
                    ) : (
                      <li className={s.emptyLine}>등록된 포함 내역이 없습니다.</li>
                    )}
                  </ul>
                  <p className={s.note}>
                    다국어 본문 편집은 번역 화면에서 처리합니다. 여기서는 값을 바꾸지 않습니다.
                  </p>
                </div>
              </Panel>
            ) : (
              <Link key={plan.code} href={`/admin/plans?code=${plan.code}`} className={s.planRow}>
                <div>
                  <div className={s.planRowTitle} lang="ja">
                    {plan.title.ja}
                  </div>
                  <div className={s.planRowMeta}>
                    <span className={s.num}>¥{yen.format(plan.price)}</span>
                    {plan.taxIncluded ? ' (税込)' : ''} · {plan.duration.ja} · 대상:{' '}
                    {SCOPE_LABEL[plan.scope]}
                  </div>
                </div>
                <span className={s.planRowGo}>편집 →</span>
              </Link>
            );
          })}

          <NotWired what="플랜 추가" hint="플랜 저장 경로가 DB에 연결되면 열립니다." />
        </div>

        <div className={s.right}>
          <Panel
            title="オプション"
            aside={<span className={s.panelAside}>{options.length}건</span>}
          >
            <p className={s.note}>
              어느 플랜에 노출할지는 아래 대상 표시를 따릅니다. 설명문은 그대로 상세 페이지에
              표시됩니다.
            </p>
            <ul className={s.optionList}>
              {options.map((opt) => (
                <li key={opt.id} className={s.optionItem}>
                  <div className={s.optionTop}>
                    <span lang="ja">{opt.label.ja}</span>
                    <b className={s.num}>{opt.price.ja}</b>
                  </div>
                  <div className={s.optionMeta}>
                    대상:{' '}
                    {opt.planCodes.length === 0
                      ? '지정 없음'
                      : opt.planCodes.map((c) => c.replace('studio-', '')).join(' / ')}
                    {opt.planCodes.includes(selected.code) ? ' · 이 플랜에 노출' : ''}
                  </div>
                </li>
              ))}
              <li>
                <NotWired what="옵션 추가" hint="옵션 저장 경로가 DB에 연결되면 열립니다." />
              </li>
            </ul>
          </Panel>

          <Panel title="상세 페이지 미리보기">
            <div className={s.preview}>
              <div className={s.previewBadge}>{selected.code.toUpperCase()}</div>
              <div className={s.previewTitle} lang="ja">
                {selected.title.ja}
              </div>
              <div className={s.previewMeta} lang="ja">
                {selected.duration.ja} ·{' '}
                <span className={s.num}>¥{yen.format(selected.price)}</span>
                {selected.taxIncluded ? ' (税込)' : ''}
              </div>
              <hr className={s.previewRule} />
              <div className={s.previewFacts}>
                포함 {selected.includes.ja.length}항목 · 옵션 {selectedOptions.length}건 · FAQ{' '}
                {planFaqs.length}건
              </div>
              <div className={s.previewUrl}>
                <code>{path('ja', 'plan', selected.code)}</code>
              </div>
            </div>
          </Panel>

          <Panel title="이 플랜이 닿는 화면">
            <ul className={s.surfaceList}>
              {surfaces.map((sf) => (
                <li key={sf.label}>
                  <span className={s.surfaceLabel}>{sf.label}</span>
                  <span className={s.surfaceRoutes}>{sf.routes.length}개 주소</span>
                </li>
              ))}
            </ul>
            <p className={s.note}>
              저장이 DB에 연결되면 이 주소들이 함께 재검증(revalidatePath)됩니다. 지금은 저장
              자체가 되지 않으므로 무효화도 일어나지 않습니다.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
