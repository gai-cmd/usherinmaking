import type { ReactNode } from 'react';
import s from './Section.module.css';

/**
 * 섹션 공통 껍데기. 배경은 --bg / --bg-alt 두 가지만 교차한다.
 * label(브라스 소문자 트래킹) + title(Cormorant) 조합이 시안의 기본 헤딩 형태.
 */
export function Section({
  label,
  title,
  lead,
  aside,
  alt,
  wide,
  children,
  id,
}: {
  label?: string;
  title?: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
  alt?: boolean;
  /** true면 좌우 거터를 없애고 콘텐츠가 화면 폭을 그대로 쓴다 */
  wide?: boolean;
  children?: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={`u-section ${alt ? 'u-section--alt' : ''} ${s.root}`}>
      <div className={wide ? '' : 'u-wrap'}>
        {(label || title || aside) && (
          <div className={s.head}>
            <div>
              {label && <p className="u-label">{label}</p>}
              {title && <h2 className={`u-h2 ${s.title}`}>{title}</h2>}
              {lead && <div className={s.lead}>{lead}</div>}
            </div>
            {aside && <div className={s.aside}>{aside}</div>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
