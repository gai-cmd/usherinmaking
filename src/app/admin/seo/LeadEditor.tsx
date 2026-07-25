'use client';

import { useState } from 'react';

import { AdminButton, NotWired } from '@/components/admin';

import s from './seo.module.css';

/**
 * 정의형 리드문 편집.
 *
 * 저장 대상 테이블이 아직 스키마에 없다(PageSeo 모델 미정). 그래서 저장 버튼은
 * 눌리되 "저장되지 않았다"는 사실을 그대로 말한다 — 입력한 문장이 반영된 것처럼
 * 보이면 관리자는 이 화면을 다시 열지 않는다.
 */
export function LeadEditor({
  pageKey,
  pageLabel,
  locale,
  initial,
}: {
  pageKey: string;
  pageLabel: string;
  locale: string;
  initial: string;
}) {
  const [text, setText] = useState(initial);
  const [touched, setTouched] = useState(false);

  const empty = text.trim().length === 0;
  const hasQuestionShape = /[?？]/u.test(text) || /とは|이란|is a|is an/iu.test(text);

  return (
    <div className={s.leadEditor}>
      <label className={s.srOnly} htmlFor={`lead-${pageKey}-${locale}`}>
        {pageLabel} {locale} 정의형 리드문
      </label>
      <textarea
        id={`lead-${pageKey}-${locale}`}
        className={empty ? `${s.textarea} ${s.textareaEmpty}` : s.textarea}
        rows={4}
        value={text}
        lang={locale}
        onChange={(e) => setText(e.target.value)}
        placeholder="질문 → 답 모양으로 한 문단. 예: 「○○とは何か」に答える一文から始める。"
      />

      <div className={s.leadFoot}>
        <span className={s.leadHint}>
          {empty
            ? '비어 있습니다. AI 검색이 인용할 문장이 이 페이지에 없습니다.'
            : hasQuestionShape
              ? '질문 → 답 형태가 확인됩니다.'
              : '질문에 답하는 형태인지 다시 보세요.'}
        </span>
        <AdminButton variant="primary" onClick={() => setTouched(true)}>
          저장
        </AdminButton>
      </div>

      {touched ? (
        <NotWired
          tone="warn"
          what="정의형 리드문 저장"
          hint="페이지 단위 SEO 저장소(PageSeo 모델)가 스키마에 없습니다. 입력한 문장은 이 화면을 벗어나면 사라집니다."
        />
      ) : null}
    </div>
  );
}
