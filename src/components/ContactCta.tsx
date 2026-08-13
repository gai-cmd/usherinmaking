import Link from 'next/link';
import { UI, path, type Locale } from '@/lib/i18n';
import s from './ContactCta.module.css';

const HEADING: Record<Locale, string> = {
  ja: 'まずは、ご相談から。',
  en: 'Start with a conversation.',
  ko: '먼저, 상담부터.',
};

const BODY: Record<Locale, string> = {
  ja: '撮影日・人数・ご希望の雰囲気をお聞かせください。日本語・韓国語・英語でお答えします。',
  en: 'Tell us your dates, how many of you there are, and the mood you have in mind. We reply in English, Japanese or Korean.',
  ko: '촬영 날짜와 인원, 원하시는 분위기를 알려주세요. 한국어 · 일본어 · 영어 모두 편하게 답변드립니다.',
};

/** 모든 페이지 하단에 붙는 공통 문의 섹션. 자동 예약이 없다는 사실을 함께 명시한다. */
export function ContactCta({ locale }: { locale: Locale }) {
  return (
    <section className={`u-section ${s.root}`}>
      <div className="u-wrap">
        <p className="u-label">CONTACT</p>
        <h2 className={`u-h2 ${s.title}`}>{HEADING[locale]}</h2>
        <p className={s.body}>{BODY[locale]}</p>
        <div className={s.actions}>
          <Link href={path(locale, 'contact')} className="u-btn-dark" data-tap>
            {UI.contactCta[locale]}
          </Link>
          <Link href={path(locale, 'plan')} className="u-btn" data-tap>
            {locale === 'ko' ? '요금 · 옵션' : locale === 'en' ? 'PLANS & OPTIONS' : 'PLAN & OPTION'}
          </Link>
        </div>
        <p className={s.note}>{UI.noAutoBooking[locale]}</p>
      </div>
    </section>
  );
}
