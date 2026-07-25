import type { ReactNode } from 'react';
import s from './PageHeader.module.css';

/**
 * 관리자 화면 상단 바. 제목 + 한 줄 설명 + 우측 액션.
 * 설명에는 "이 화면이 무엇을 바꾸는가"를 쓴다 — 관리자가 결과를 예측할 수 있어야 한다.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={s.root}>
      <div className={s.text}>
        <h1 className={s.title}>{title}</h1>
        {description ? <p className={s.desc}>{description}</p> : null}
      </div>
      {actions ? <div className={s.actions}>{actions}</div> : null}
    </header>
  );
}

/** 헤더·툴바에서 쓰는 버튼. 폼 밖의 단순 액션은 type="button"이 기본. */
export function AdminButton({
  children,
  variant = 'default',
  onClick,
  disabled,
  title,
  type = 'button',
}: {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'quiet';
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={`${s.btn} ${s[variant]}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

/** 툴바 — 필터 칩·정렬처럼 화면 상단에 붙는 얇은 줄. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className={s.toolbar}>{children}</div>;
}

/** 패널 — 흰 배경 + 1px hairline. 관리자 화면의 기본 컨테이너. */
export function Panel({
  title,
  aside,
  children,
  padded = true,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={s.panel}>
      {title ? (
        <div className={s.panelHead}>
          <h2 className={s.panelTitle}>{title}</h2>
          {aside ? <div className={s.panelAside}>{aside}</div> : null}
        </div>
      ) : null}
      <div className={padded ? s.panelBody : undefined}>{children}</div>
    </section>
  );
}
