import Link from 'next/link';

import s from './seo.module.css';

/**
 * 정의형 리드문 미리보기.
 *
 * 예전에는 여기에 입력칸과 저장 버튼이 있었는데, 저장할 곳이 없어서(PageSeo 모델 미정)
 * 누르면 "저장되지 않았다"고만 말하는 상자였다. 그 사이 실제로 이 문장을 고치는 자리는
 * 따로 있었다 — 페이지 문구 편집기의 해당 슬롯이다. 그래서 여기서는 지금 사이트에
 * 나가는 문장을 그대로 보여 주고, 고치는 자리로 보낸다.
 *
 * 입력칸을 두 곳에 두지 않는 이유: 어느 쪽이 진짜인지 알 수 없게 되고,
 * 한쪽이 저장되지 않는 지금 같은 상태를 다시 만든다.
 */
export function LeadEditor({
  pageKey,
  pageLabel,
  locale,
  initial,
  slot,
  editHref,
}: {
  pageKey: string;
  pageLabel: string;
  locale: string;
  initial: string;
  slot: string;
  editHref: string;
}) {
  const text = initial.trim();
  const empty = text.length === 0;
  const hasQuestionShape = /[?？]/u.test(text) || /とは|이란|is a|is an/iu.test(text);

  return (
    <div className={s.leadEditor}>
      <p className={s.srOnly}>
        {pageLabel} {locale} 정의형 리드문
      </p>

      {empty ? (
        <p className={`${s.textarea} ${s.textareaEmpty}`}>
          이 페이지의 <code>{slot}</code> 문구가 비어 있습니다.
        </p>
      ) : (
        <p className={s.textarea} lang={locale}>
          {text}
        </p>
      )}

      <div className={s.leadFoot}>
        <span className={s.leadHint}>
          {empty
            ? '비어 있습니다. AI 검색이 인용할 문장이 이 페이지에 없습니다.'
            : hasQuestionShape
              ? '질문 → 답 형태가 확인됩니다.'
              : '질문에 답하는 형태인지 다시 보세요.'}
        </span>
        <Link className={s.leadEditLink} href={`${editHref}?locale=${locale}`} data-page={pageKey}>
          페이지 문구에서 고치기 →
        </Link>
      </div>
    </div>
  );
}
