'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import s from './reveal.module.css';

/**
 * 스크롤로 뷰포트에 들어오면 서서히 떠오르는 블록.
 *
 * 기본 상태는 "보임"이다 — JS 가 실패하거나 봇이 읽을 때도 본문은 그대로 남는다.
 * 숨김(.armed)은 스크립트가 관찰을 시작한 뒤에만 붙고, 한 번 나타나면 다시 숨기지 않는다.
 */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 모션을 줄여달라는 설정이면 애초에 숨기지 않는다.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    el.classList.add(s.armed);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.classList.add(s.shown);
          io.unobserve(el);
        }
      },
      // 아래에서 조금 올라온 시점에 시작해야 등장이 눈에 들어온다.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={s.block} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
