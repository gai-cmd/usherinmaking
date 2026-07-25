import Link from 'next/link';
import { path, type Locale } from '@/lib/i18n';
import { HOME } from '@/app/[locale]/home-content';
import s from './StickyCta.module.css';

/** 모바일 전용 하단 고정 CTA. 두 버튼 모두 44px 이상. */
export function StickyCta({ locale }: { locale: Locale }) {
  const copy = HOME[locale].sticky;

  return (
    <div className={s.root}>
      <Link href={path(locale, 'plan')} className={`u-btn ${s.btn}`}>
        {copy.plan}
      </Link>
      <Link href={path(locale, 'contact')} className={`u-btn-dark ${s.btn}`}>
        {copy.contact}
      </Link>
    </div>
  );
}
