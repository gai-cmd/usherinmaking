import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NotWired, PageHeader, Panel } from '@/components/admin';
import { PAGE_SLOTS } from '@/content/slots';
import { LOCALES, LOCALE_SHORT, path } from '@/lib/i18n';
import { checkAdminPageAccess } from '@/server/auth';
import { isDatabaseConfigured } from '@/server/db';
import { countOverridesByPage } from '@/server/page-content';

import s from './content.module.css';

export const metadata = { title: '페이지 문구 · 관리자' };

export default async function AdminContentPage() {
  // 레이아웃 가드만으로는 이 컴포넌트의 실행을 막지 못한다. 데이터를 읽기 전에 끊는다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const counts = await countOverridesByPage();
  const wired = isDatabaseConfigured();

  return (
    <>
      <PageHeader
        title="페이지 문구"
        description="공개 페이지의 제목·리드문·안내 문구를 언어별로 바꿉니다. 손대지 않은 자리는 코드에 있는 문구가 그대로 나갑니다."
      />

      <div className={s.body}>
        <Panel title="페이지" aside={<span className={s.eyebrow}>{PAGE_SLOTS.length}개</span>}>
          <ul className={s.pageList}>
            {PAGE_SLOTS.map((p) => {
              const count = counts[p.page];
              const total = p.slots.length;
              const touched = LOCALES.some((l) => count[l] > 0);

              return (
                <li key={p.page} className={s.pageRow}>
                  <Link href={`/admin/content/${p.page}`} className={s.pageLink}>
                    <span className={s.pageName}>{p.label}</span>
                    <span className={s.pageNote}>{p.note}</span>
                  </Link>

                  <div className={s.pageMeta}>
                    <span className={s.slotCount}>편집 가능 {total}자리</span>
                    <span className={touched ? s.localeCounts : `${s.localeCounts} ${s.dim}`}>
                      {LOCALES.map((l) => (
                        <span key={l} className={s.localeCount}>
                          {LOCALE_SHORT[l]} {count[l]}
                        </span>
                      ))}
                    </span>
                    <span className={s.routes}>
                      {LOCALES.map((l) => (
                        <code key={l} className={s.route}>
                          {path(l, p.page)}
                        </code>
                      ))}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <p className={s.legend}>
          숫자는 해당 언어에서 코드 기본값을 덮어쓴 자리의 수입니다. 0이면 그 언어는 아직 코드에 있는
          문구를 그대로 쓰고 있다는 뜻이며, 빈 화면이 되지는 않습니다.
        </p>

        {wired ? null : (
          <NotWired
            what="문구 저장"
            hint={
              <>
                <code className={s.code}>DATABASE_URL</code> 이 없어 읽기만 됩니다. 편집 화면은 코드
                기본값을 보여주고, 저장은 거절합니다.
              </>
            }
          />
        )}
      </div>
    </>
  );
}
