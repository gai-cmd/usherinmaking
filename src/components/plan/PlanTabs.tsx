'use client';

import { useId, useState, type ReactNode } from 'react';
import s from './PlanTabs.module.css';

export type PlanTab = { id: string; label: string; panel: ReactNode };

/**
 * 요금 탭. 페이지에서 유일하게 클라이언트로 도는 부분이라 상태만 들고 있고
 * 패널 내용은 서버에서 만들어 children 으로 받는다.
 */
export function PlanTabs({ tabs }: { tabs: PlanTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const uid = useId();

  return (
    <>
      <div className={s.strip} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${uid}-${tab.id}-tab`}
            aria-selected={active === tab.id}
            aria-controls={`${uid}-${tab.id}-panel`}
            className={`${s.tab} ${active === tab.id ? s.on : ''}`}
            onClick={() => setActive(tab.id)}
            data-tap
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${uid}-${tab.id}-panel`}
          aria-labelledby={`${uid}-${tab.id}-tab`}
          hidden={active !== tab.id}
          className={s.panel}
        >
          {tab.panel}
        </div>
      ))}
    </>
  );
}
