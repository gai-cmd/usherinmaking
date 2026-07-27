'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { DEFAULT_LOCALE, isLocale, path, type Locale, type PageKey } from '@/lib/i18n';
import s from './error.module.css';

/**
 * 로케일 안에서 렌더 중 오류가 났을 때 보이는 화면.
 *
 * error.tsx 는 Next.js 규약상 반드시 클라이언트 컴포넌트이고 params 를 받지 못한다.
 * 그래서 not-found.tsx 와 같은 방식으로 경로에서 로케일을 읽는다.
 *
 * 오류 원문(error.message · stack)은 화면에 절대 내보내지 않는다. 서버 오류 메시지에는
 * 내부 경로·쿼리·환경 정보가 섞여 나올 수 있다. 대신 Next 가 붙여 주는 digest 만 보여준다 —
 * 서버 로그의 같은 값과 대조되는 식별자이므로, 사용자가 이 값을 알려주면 추적할 수 있다.
 */

type ErrorCopy = {
  heading: string;
  body: string[];
  retry: string;
  actions: { page: PageKey; label: string }[];
  digestLabel: string;
  noDigest: string;
  status: string;
};

const COPY: Record<Locale, ErrorCopy> = {
  ja: {
    heading: '問題が発生しました',
    body: [
      'ページの読み込み中に不具合が起きました。お手数ですが再読み込みをお試しください。',
      '繰り返し表示される場合は、下の識別子を添えてご連絡ください。',
    ],
    retry: 'もう一度読み込む',
    actions: [
      { page: 'home', label: 'HOME' },
      { page: 'contact', label: 'CONTACT' },
    ],
    digestLabel: 'エラー識別子',
    noDigest: '識別子は記録されていません',
    status: 'HTTP 500 ・ このページは検索エンジンにインデックスされません（noindex）',
  },

  en: {
    heading: 'Something went wrong',
    body: [
      'This page failed to load. Reloading it usually clears the problem.',
      'If it keeps happening, send us the reference below and we will look into it.',
    ],
    retry: 'Try again',
    actions: [
      { page: 'home', label: 'HOME' },
      { page: 'contact', label: 'CONTACT' },
    ],
    digestLabel: 'Reference',
    noDigest: 'No reference was recorded',
    status: 'HTTP 500 · this page is not indexed (noindex)',
  },

  ko: {
    heading: '문제가 발생했습니다',
    body: [
      '페이지를 불러오는 중에 오류가 났습니다. 다시 불러오면 대부분 해결됩니다.',
      '계속 같은 화면이 나오면 아래 식별자와 함께 알려주세요.',
    ],
    retry: '다시 불러오기',
    actions: [
      { page: 'home', label: '홈으로' },
      { page: 'contact', label: '문의' },
    ],
    digestLabel: '오류 식별자',
    noDigest: '식별자가 기록되지 않았습니다',
    status: 'HTTP 500 · 이 페이지는 검색에 노출되지 않습니다 (noindex)',
  },
};

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const seg = pathname.split('/')[1] ?? '';
  const locale: Locale = isLocale(seg) ? seg : DEFAULT_LOCALE;
  const c = COPY[locale];

  // 화면에는 digest 만 보여주지만, 개발 중에는 콘솔에서 원인을 봐야 한다.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      {/* error.tsx 는 metadata export 를 지원하지 않는다 — 직접 심는다 */}
      <meta name="robots" content="noindex, nofollow" />

      <section className={s.root}>
        <div className={s.box}>
          <p className="u-label">ERROR</p>
          <h1 className={`u-display ${s.heading}`}>{c.heading}</h1>

          <p className={s.body}>
            {c.body.map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>

          <div className={s.actions}>
            <button type="button" onClick={reset} className="u-btn-dark" data-tap>
              {c.retry}
            </button>
            {c.actions.map((a) => (
              <Link key={a.page} href={path(locale, a.page)} className="u-btn" data-tap>
                {a.label}
              </Link>
            ))}
          </div>

          <p className={s.meta}>
            {c.digestLabel} —{' '}
            {error.digest ? (
              <span className={s.digest}>{error.digest}</span>
            ) : (
              <span>{c.noDigest}</span>
            )}
            <br />
            <span className={s.status}>{c.status}</span>
          </p>
        </div>
      </section>
    </>
  );
}
