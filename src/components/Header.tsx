'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LOCALES,
  LOCALE_SHORT,
  homePath,
  navFor,
  UI,
  path,
  type Locale,
  type PageKey,
} from '@/lib/i18n';
import s from './Header.module.css';

/**
 * 로고는 텍스트가 아니라 이미지. 데스크톱 중앙 정렬, 모바일 좌측.
 * 언어 전환은 같은 페이지의 다른 로케일로 이동한다.
 */
export function Header({ locale, page }: { locale: Locale; page?: PageKey }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 현재 경로에서 로케일 세그먼트만 바꾼다. 페이지 키를 알면 그쪽이 더 정확하다(en/plans 대응).
  // 홈은 예외 — 한국어에는 갈림길 홈이 없으므로 그 언어의 첫 화면으로 보낸다.
  const localeHref = (l: Locale) =>
    page === 'home'
      ? homePath(l)
      : page
        ? path(l, page)
        : `/${l}${pathname.replace(/^\/[a-z]{2}/, '')}` || `/${l}`;

  return (
    <header className={s.root}>
      <div className={s.bar}>
        <Link href={homePath(locale)} className={s.logo} aria-label="usherinmaking">
          <Image
            src="/brand/logo.png"
            alt="usherinmaking"
            width={260}
            height={64}
            priority
            className={s.logoImg}
          />
        </Link>

        <button
          className={s.burger}
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="u-visually-hidden">{open ? UI.close[locale] : UI.menu[locale]}</span>
          <span aria-hidden className={s.burgerBar} data-open={open || undefined} />
        </button>
      </div>

      <nav id="site-nav" className={s.nav} data-open={open || undefined}>
        <ul className={s.navList}>
          {navFor(locale).map((item) => (
            <li key={item.key}>
              <Link
                href={path(locale, item.key)}
                className={s.navLink}
                data-tap
                aria-current={page === item.key ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label[locale]}
              </Link>
            </li>
          ))}
        </ul>

        <ul className={s.langList} aria-label="Language">
          {LOCALES.map((l) => (
            <li key={l}>
              <Link
                href={localeHref(l)}
                className={s.langLink}
                data-tap
                data-active={l === locale || undefined}
                hrefLang={l}
                aria-current={l === locale ? 'true' : undefined}
              >
                {LOCALE_SHORT[l]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
