import type { ReactNode } from 'react';
import s from './Badge.module.css';

export type BadgeTone =
  /** 기본 — 회색 테두리 */
  | 'default'
  /** 강조 — 먹지 배경 */
  | 'dark'
  /** 브랜드 포인트 — AI 제안, 신규 */
  | 'brass'
  /** 경고 — 저해상도, alt 없음 */
  | 'warn'
  /** 약한 정보 */
  | 'muted';

export function Badge({
  children,
  tone = 'default',
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  title?: string;
}) {
  return (
    <span className={`${s.badge} ${s[tone]}`} title={title}>
      {children}
    </span>
  );
}

/**
 * AI 제안 배지. 확신도를 항상 함께 보여 준다 —
 * 숫자가 없으면 관리자가 제안을 사실로 읽는다. 0.8 미만은 톤을 낮춘다.
 */
export function SuggestionBadge({ label, score }: { label: string; score: number }) {
  const pct = Math.round(score * 100);
  return (
    <Badge tone={score >= 0.8 ? 'brass' : 'muted'} title={`AI 제안 · 확신도 ${pct}%`}>
      {label} <span className={s.score}>{pct}%</span>
    </Badge>
  );
}
