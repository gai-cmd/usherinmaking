import Image from 'next/image';
import Link from 'next/link';
import { homePath, navFor, UI, path, type Locale } from '@/lib/i18n';
import { STUDIO_INFO } from '@/content/site';
import s from './Footer.module.css';

const LEGAL: { key: 'privacy' | 'tokushoho'; label: Record<Locale, string> }[] = [
  { key: 'privacy', label: { ja: 'プライバシーポリシー', en: 'Privacy Policy', ko: '개인정보 처리방침' } },
  {
    key: 'tokushoho',
    label: {
      ja: '特定商取引法に基づく表記',
      en: 'Commercial Transactions Act Notice',
      ko: '특정상거래법 표기',
    },
  },
];

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className={s.root}>
      <div className={s.inner}>
        <Link href={homePath(locale)} aria-label="usherinmaking">
          <Image src="/brand/logo.png" alt="usherinmaking" width={260} height={64} className={s.logo} />
        </Link>

        <nav aria-label="Footer">
          <ul className={s.links}>
            {navFor(locale).map((item) => (
              <li key={item.key}>
                <Link href={path(locale, item.key)} className={s.link} data-tap>
                  {item.label[locale]}
                </Link>
              </li>
            ))}
            {/* 갤러리는 navFor 에 이미 들어 있다 — 별도 항목을 두면 두 번 나온다 */}
          </ul>
        </nav>

        <p className={s.note}>{UI.noAutoBooking[locale]}</p>

        {/* 주차는 스튜디오로 찾아오는 손님에게만 필요한 정보다 —
            한국어는 로케이션 촬영뿐이라 상담 언어만 남긴다. */}
        <p className={s.meta}>
          {locale === 'ko'
            ? STUDIO_INFO.languages[locale]
            : `${STUDIO_INFO.parking[locale]} · ${STUDIO_INFO.languages[locale]}`}
        </p>

        <ul className={s.legal}>
          {LEGAL.map((l) => (
            <li key={l.key}>
              <Link href={path(locale, l.key)} className={s.legalLink} data-tap>
                {l.label[locale]}
              </Link>
            </li>
          ))}
        </ul>

        <p className={s.copy}>
          <span className="u-num">© {new Date().getFullYear()}</span> usherinmaking
        </p>
      </div>
    </footer>
  );
}
