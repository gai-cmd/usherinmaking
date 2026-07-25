'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCATION_PLANS, STUDIO_PLANS } from '@/content/site';
import { DEFAULT_LOCALE, isLocale, path, type Locale, type PageKey } from '@/lib/i18n';
import s from './not-found.module.css';

/**
 * 로케일 안에서 notFound() 가 났을 때 보이는 404.
 * not-found.tsx 는 params 를 받지 못하므로 경로에서 로케일을 읽는다.
 * 그래서 이 파일만 클라이언트 컴포넌트다. (metadata export 도 불가능해
 * noindex 는 아래 <meta> 로 직접 심는다.)
 */

type Card = { page: PageKey; title: string; note: string; image?: { src: string; alt: string } };

type NotFoundCopy = {
  heading: string;
  body: string[];
  actions: { page: PageKey; label: string; primary?: boolean }[];
  popularLabel: string;
  popular: string;
  whereLabel: string;
  whereTitle: string;
  cards: Card[];
  footer: string;
  status: string;
};

const STUDIO_FROM = STUDIO_PLANS[0].price.toLocaleString('en-US');
const LOCATION_FROM = LOCATION_PLANS[0].price.toLocaleString('en-US');

const COPY: Record<Locale, NotFoundCopy> = {
  ja: {
    heading: 'ページが見つかりません',
    body: [
      'お探しのページは移動または削除された可能性があります。',
      '下のメニューからお探しください。',
    ],
    actions: [
      { page: 'home', label: 'HOME', primary: true },
      { page: 'gallery', label: 'GALLERY' },
      { page: 'contact', label: 'CONTACT' },
    ],
    popularLabel: 'よくお探しのページ',
    popular: 'スタジオ ・ ロケーション ・ プランと料金 ・ ドレス',
    whereLabel: 'WHERE TO GO',
    whereTitle: '主なページ',
    cards: [
      {
        page: 'studio',
        title: 'スタジオ',
        note: '4つのセットと撮影の流れ',
        image: { src: '/images/studio/IMG_0766.png', alt: 'スタジオ' },
      },
      {
        page: 'location',
        title: 'ロケーション',
        // 屋外はエリアではなく撮影の種類で分けている（ウェディング / 記念日）
        note: 'ウェディングと記念日の撮影',
        image: { src: '/images/up/0f62c6d466bcea42.jpg', alt: 'ロケーション' },
      },
      {
        page: 'dress',
        title: 'ドレス',
        note: 'コレクションとレンタル',
        image: { src: '/images/studio/IMG_0698.png', alt: 'ドレス' },
      },
      {
        page: 'plan',
        title: 'プランと料金',
        note: `スタジオ ¥${STUDIO_FROM}〜 / ロケーション ¥${LOCATION_FROM}〜`,
      },
    ],
    footer: 'リンクの不具合を見つけられた場合は、お手数ですが CONTACT からお知らせください。',
    status: 'HTTP 404 ・ このページは検索エンジンにインデックスされません（noindex）',
  },

  en: {
    heading: 'Page not found',
    body: [
      'The page you requested has moved or no longer exists.',
      'Please use the menu below.',
    ],
    actions: [
      { page: 'home', label: 'HOME', primary: true },
      { page: 'gallery', label: 'GALLERY' },
      { page: 'contact', label: 'CONTACT' },
    ],
    popularLabel: 'Most visited',
    popular: 'Studio · Location · Plans · Dress',
    whereLabel: 'WHERE TO GO',
    whereTitle: 'Main pages',
    cards: [
      {
        page: 'studio',
        title: 'Studio',
        note: 'Four sets and how a session runs',
        image: { src: '/images/studio/IMG_0766.png', alt: 'Studio' },
      },
      {
        page: 'location',
        title: 'Location',
        note: 'Wedding and anniversary sessions',
        image: { src: '/images/up/0f62c6d466bcea42.jpg', alt: 'Location' },
      },
      {
        page: 'dress',
        title: 'Dress',
        note: 'Collection and rental',
        image: { src: '/images/studio/IMG_0698.png', alt: 'Dress' },
      },
      {
        page: 'plan',
        title: 'Plans',
        note: `Studio from ¥${STUDIO_FROM} · location from ¥${LOCATION_FROM}`,
      },
    ],
    footer: 'If you found a broken link, please let us know through the contact page.',
    status: 'HTTP 404 · this page is not indexed (noindex)',
  },

  ko: {
    heading: '페이지를 찾을 수 없습니다',
    body: [
      '요청하신 페이지의 주소가 변경되었거나 삭제되었습니다.',
      '아래 메뉴에서 다시 찾아보실 수 있습니다.',
    ],
    actions: [
      { page: 'home', label: '홈으로', primary: true },
      { page: 'gallery', label: '갤러리' },
      { page: 'contact', label: '문의' },
    ],
    popularLabel: '많이 찾는 페이지',
    popular: '스튜디오 · 로케이션 · 요금 · 드레스',
    whereLabel: 'WHERE TO GO',
    whereTitle: '주요 페이지',
    cards: [
      {
        page: 'studio',
        title: '스튜디오',
        note: '네 개의 세트와 당일 스케줄',
        image: { src: '/images/studio/IMG_0766.png', alt: '스튜디오' },
      },
      {
        page: 'location',
        title: '로케이션',
        note: '웨딩 스냅과 기념사진',
        image: { src: '/images/up/0f62c6d466bcea42.jpg', alt: '로케이션' },
      },
      {
        page: 'dress',
        title: '드레스',
        note: '컬렉션과 대여 안내',
        image: { src: '/images/studio/IMG_0698.png', alt: '드레스' },
      },
      {
        page: 'plan',
        title: '요금',
        note: `스튜디오 ¥${STUDIO_FROM}부터 · 로케이션 ¥${LOCATION_FROM}부터`,
      },
    ],
    footer: '링크가 잘못된 것 같으면 문의 페이지로 알려주세요.',
    status: 'HTTP 404 · 이 페이지는 검색에 노출되지 않습니다 (noindex)',
  },
};

export default function LocaleNotFound() {
  const pathname = usePathname();
  const seg = pathname.split('/')[1] ?? '';
  const locale: Locale = isLocale(seg) ? seg : DEFAULT_LOCALE;
  const c = COPY[locale];

  return (
    <>
      {/* not-found.tsx 는 metadata export 를 지원하지 않는다 — 직접 심는다 */}
      <meta name="robots" content="noindex, nofollow" />

      <section className={s.hero}>
        <div className={s.heroImage}>
          <Image
            src="/images/studio/IMG_0769.png"
            alt=""
            fill
            sizes="(max-width: 767px) 100vw, 50vw"
          />
        </div>

        <div className={s.heroBody}>
          <p className="u-label">404</p>
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
            {c.actions.map((a) => (
              <Link
                key={a.page}
                href={path(locale, a.page)}
                className={a.primary ? 'u-btn-dark' : 'u-btn'}
                data-tap
              >
                {a.label}
              </Link>
            ))}
          </div>

          <p className={s.popular}>
            {c.popularLabel} — <span className={s.popularList}>{c.popular}</span>
          </p>
        </div>
      </section>

      {/* 막다른 길을 만들지 않는다 — 주요 페이지로 다시 안내한다 */}
      <section className={`u-section u-section--alt ${s.where}`}>
        <div className="u-wrap">
          <div className={s.whereHead}>
            <p className="u-label">{c.whereLabel}</p>
            <h2 className={`u-h2 ${s.whereTitle}`}>{c.whereTitle}</h2>
          </div>

          <ul className={s.cards}>
            {c.cards.map((card) => (
              <li key={card.page}>
                <Link href={path(locale, card.page)} className={s.card} data-tap>
                  <span className={s.cardMedia}>
                    {card.image ? (
                      <Image
                        src={card.image.src}
                        alt={card.image.alt}
                        fill
                        sizes="(max-width: 767px) 100vw, 25vw"
                      />
                    ) : (
                      <span className={`u-num ${s.cardYen}`} aria-hidden>
                        ¥
                      </span>
                    )}
                  </span>
                  <span className={s.cardTitle}>{card.title}</span>
                  <span className={s.cardNote}>{card.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={s.footer}>
        <div className="u-wrap">
          <p>{c.footer}</p>
          <p className={s.status}>{c.status}</p>
        </div>
      </section>
    </>
  );
}
