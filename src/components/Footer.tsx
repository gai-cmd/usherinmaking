import Image from 'next/image';
import Link from 'next/link';
import { NAV, UI, path, type Locale } from '@/lib/i18n';
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
        <Link href={path(locale, 'home')} aria-label="usherinmaking">
          <Image src="/brand/logo.png" alt="usherinmaking" width={195} height={48} className={s.logo} />
        </Link>

        <nav aria-label="Footer">
          <ul className={s.links}>
            {NAV.map((item) => (
              <li key={item.key}>
                <Link href={path(locale, item.key)} className={s.link} data-tap>
                  {item.label[locale]}
                </Link>
              </li>
            ))}
            <li>
              <Link href={path(locale, 'gallery')} className={s.link} data-tap>
                GALLERY
              </Link>
            </li>
          </ul>
        </nav>

        <p className={s.note}>{UI.noAutoBooking[locale]}</p>

        <p className={s.meta}>
          {STUDIO_INFO.parking[locale]} · {STUDIO_INFO.languages[locale]}
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
