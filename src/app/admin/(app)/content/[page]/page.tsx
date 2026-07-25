import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NotWired, PageHeader, Panel } from '@/components/admin';
import { ContentEditorSlot, type SlotLocaleValue } from '@/components/admin/ContentEditor';
import { isContentPage, pageSlotsFor } from '@/content/slots';
import { LOCALES, LOCALE_SHORT, path, type Locale } from '@/lib/i18n';
import { checkAdminPageAccess } from '@/server/auth';
import { isDatabaseConfigured } from '@/server/db';
import { getPageSlotStates, type SlotState } from '@/server/page-content';

import s from '../content.module.css';

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const def = isContentPage(page) ? pageSlotsFor(page) : undefined;
  return { title: `${def?.label ?? '페이지'} 문구 · 관리자` };
}

/** 슬롯을 구역별로 묶는다. 정의 순서를 그대로 따라야 화면이 실제 페이지의 위아래 순서와 맞는다. */
function groupSlots(slots: SlotState[]): { group: string; slots: SlotState[] }[] {
  const out: { group: string; slots: SlotState[] }[] = [];
  for (const slot of slots) {
    const last = out[out.length - 1];
    if (last && last.group === slot.group) last.slots.push(slot);
    else out.push({ group: slot.group, slots: [slot] });
  }
  return out;
}

/** Date 를 직렬화 경계 너머로 그대로 넘기지 않는다 — ISO 문자열이 안전하다. */
function toClientValues(slot: SlotState): Record<Locale, SlotLocaleValue> {
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const v = slot.values[locale];
      return [
        locale,
        {
          value: v.value,
          source: v.source,
          updatedBy: v.updatedBy,
          updatedAt: v.updatedAt ? v.updatedAt.toISOString() : null,
        } satisfies SlotLocaleValue,
      ];
    }),
  ) as Record<Locale, SlotLocaleValue>;
}

export default async function AdminContentPageEditor({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  // 레이아웃 가드만으로는 이 컴포넌트의 실행을 막지 못한다. 데이터를 읽기 전에 끊는다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const { page } = await params;
  if (!isContentPage(page)) notFound();

  const def = pageSlotsFor(page);
  if (!def) notFound();

  const slots = await getPageSlotStates(page);
  const groups = groupSlots(slots);
  const wired = isDatabaseConfigured();

  const overridden = (locale: Locale) =>
    slots.filter((slot) => slot.values[locale].source === 'override').length;

  return (
    <>
      <PageHeader
        title={`${def.label} 문구`}
        description={`${def.note}. 세 언어는 서로의 번역이 아니라 각각 독립된 본문입니다 — 한 칸을 채워도 나머지 언어는 그대로 둡니다.`}
        actions={
          <Link href="/admin/content" className={s.backLink}>
            페이지 목록
          </Link>
        }
      />

      <div className={s.body}>
        <div className={s.summary}>
          <span>
            편집 가능 <b>{slots.length}</b>자리
          </span>
          {LOCALES.map((locale) => (
            <span key={locale}>
              {LOCALE_SHORT[locale]} <b>{overridden(locale)}</b> / {slots.length} 수정됨
            </span>
          ))}
          <span className={s.summaryRoutes}>
            {LOCALES.map((locale) => (
              <code key={locale} className={s.route}>
                {path(locale, page)}
              </code>
            ))}
          </span>
        </div>

        {wired ? null : (
          <NotWired
            what="문구 저장"
            hint={
              <>
                <code className={s.code}>DATABASE_URL</code> 이 없어 저장이 거절됩니다. 아래 값은 코드
                기본값입니다.
              </>
            }
          />
        )}

        {groups.map((group) => (
          <Panel key={group.group} title={group.group}>
            <div className={s.slots}>
              {group.slots.map((slot) => (
                <ContentEditorSlot
                  key={slot.slot}
                  page={page}
                  slot={slot.slot}
                  label={slot.label}
                  kind={slot.kind}
                  maxLength={slot.maxLength}
                  values={toClientValues(slot)}
                />
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
