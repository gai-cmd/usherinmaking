import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/Section';
import { PlanCard } from '@/components/PlanCard';
import { ContactCta } from '@/components/ContactCta';
import { HeroGate } from '@/components/home/HeroGate';
import { RecentWorks } from '@/components/home/RecentWorks';
import { HomeFaq } from '@/components/home/HomeFaq';
import { NaverNotice } from '@/components/home/NaverNotice';
import { StickyCta } from '@/components/home/StickyCta';
import { LOCALES, SITE_URL, alternates, isLocale, path, type Locale } from '@/lib/i18n';
import { pickImage } from '@/lib/image-slot';
import { getPageCopy, toLines } from '@/server/page-content';
import { resolvePageImages } from '@/server/page-images';
import { getSiteSettings } from '@/server/settings';
import { ldJson, localBusinessLd, organizationLd } from '@/lib/structured-data';
import { getWorksImages } from '@/server/works';
import {
  ANNIVERSARY_PLANS,
  LOCATION_NOTES,
  LOCATION_PLANS,
  NAVER_BLOG_NOTICE_LOCALE,
  STUDIO_OPTIONS,
  STUDIO_PLANS,
  STUDIO_SETS,
} from '@/content/site';
import { KO_ETC_PLANS, KO_WEDDING_PLANS } from '@/components/plan/content';
import { HOME, KO_HOME_PLAN_NOTES } from './home-content';
import s from './page.module.css';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const text = await getPageCopy('home', locale);
  const title = text['meta.title'];
  const description = text['meta.description'];

  return {
    // layout 의 title.template 은 같은 세그먼트의 page 에는 적용되지 않는다(Next.js 사양).
    // 홈만 브랜드 접미사가 빠지던 원인이라 여기서 직접 붙인다.
    title: { absolute: `${title} | usherinmaking` },
    description,
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'home')}`,
      languages: alternates('home'),
    },
    openGraph: {
      type: 'website',
      title: `${title} | usherinmaking`,
      description,
      url: `${SITE_URL}${path(locale, 'home')}`,
      // 투명 PNG 를 그대로 공유하면 어두운 배경 앱에서 검정 로고가 묻힌다.
      // 배경을 깐 1200x630 카드로 따로 둔다 — 크기도 OG 권장비(1.91:1)에 맞다.
      images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'usherinmaking' }],
    },
  };
}

/** 확정된 사실만 구조화한다. 주소처럼 아직 못 받은 값은 TBC 토큰 그대로 내보낸다. */
function jsonLd(locale: Locale, geo: { lat: number; lng: number } | null) {
  const copy = HOME[locale];

  // 한국 고객 상품은 원화 상품(웨딩/기타 촬영)이 정본이다 — 엔화 스튜디오 플랜은 팔지 않는다.
  const offers =
    locale === 'ko'
      ? [
          {
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: '웨딩 촬영' },
            priceCurrency: 'KRW',
            price: KO_WEDDING_PLANS[0].price,
          },
          {
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: '기타 촬영' },
            priceCurrency: 'KRW',
            price: KO_ETC_PLANS[0].price,
          },
        ]
      : [
          {
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: copy.studioPlans.title },
            priceCurrency: 'JPY',
            price: STUDIO_PLANS[0].price,
          },
          {
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: copy.locationPlans.title },
            priceCurrency: 'JPY',
            price: LOCATION_PLANS[0].price,
          },
        ];

  // 주소·채널·사업장 정보는 structured-data 가 한 곳에서 만든다 — 여기서 따로 적지 않는다.
  return [
    organizationLd(),
    localBusinessLd({
      locale,
      description: copy.meta.description,
      image:
        locale === 'ko'
          ? `${SITE_URL}/images/up/0f62c6d466bcea42.jpg`
          : `${SITE_URL}/images/studio/IMG_0766.png`,
      geo,
      offers,
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: copy.faq.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ];
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = HOME[locale];
  // 한국어 홈은 로케이션 단독 구성이다 — 한국 고객 상품에 스튜디오 플랜이 없다.
  const isKo = locale === 'ko';
  // 관리자가 건 사진을 한 번에 읽는다. 행이 없는 자리는 지금 쓰던 경로가 그대로 나온다.
  // 세트 그리드는 스튜디오 페이지와 같은 사진이므로 그쪽 슬롯을 함께 읽는다 —
  // 한 장을 갈아끼웠는데 홈에만 옛 사진이 남는 어긋남을 만들지 않기 위해서다.
  const [text, images, studioImages, works, settings] = await Promise.all([
    // 관리자가 고친 문구. 손대지 않은 자리는 코드 기본값이 그대로 담겨 온다.
    getPageCopy('home', locale),
    resolvePageImages('home'),
    resolvePageImages('studio'),
    // 최근 작품 그리드 — 사진 풀이 정원을 채우면 그쪽, 아니면 코드 배열.
    // 한국어 홈은 로케이션 태그 사진만 고른다 (스튜디오 컷이 섞이지 않게).
    getWorksImages(isKo ? 'location' : 'home'),
    // 사업장 좌표. 관리자가 넣어 두면 LocalBusiness 에 geo 로 나간다 — 없으면 내보내지 않는다.
    getSiteSettings(),
  ]);
  const geo =
    settings.geo.lat !== null && settings.geo.lng !== null
      ? { lat: settings.geo.lat, lng: settings.geo.lng }
      : null;

  // 작가 소개 옆 사진도 관리자에서 갈아끼운다. 코드 경로는 폴백일 뿐이다.
  const photographerImage = pickImage(
    images,
    'photographer',
    locale,
    isKo ? '/images/up/adba32345d8088a3.jpg' : '/images/studio/IMG_0769.png',
    copy.photographer.alt,
  )!;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(...jsonLd(locale, geo)) }}
      />

      <HeroGate locale={locale} images={images} text={text} />

      {/* 정의형 리드문 — 히어로 바로 아래 실제 텍스트로 두는 것이 AI 인용의 1차 표면 */}
      <section className={`u-section ${s.lead}`}>
        <div className="u-wrap">
          <h1 className="u-lead">
            {toLines(text['lead.headline']).map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </h1>
          <p className={`u-body ${s.leadSub}`}>
            {toLines(text['lead.sub']).map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ---------- STUDIO PLAN (한국어 상품에는 없는 라인업 — ko 미노출) ---------- */}
      {!isKo && (
      <Section
        label={copy.studioPlans.label}
        title={text['studioPlans.title']}
        aside={copy.studioPlans.aside}
      >
        <ul className={s.planGrid}>
          {STUDIO_PLANS.map((plan) => (
            <li key={plan.code}>
              <PlanCard plan={plan} locale={locale} />
            </li>
          ))}
        </ul>

        <div className={s.optionBox}>
          <div className={s.optionHead}>
            <p className="u-label">{copy.studioPlans.optionLabel}</p>
            <p className="u-meta">{copy.studioPlans.optionNote}</p>
          </div>

          <ul className={s.optionGrid}>
            {STUDIO_OPTIONS.map((option) => (
              <li key={option.label.en} className={s.option}>
                <span className={s.optionLabel}>{option.label[locale]}</span>
                <span className={`u-num ${s.optionPrice}`}>{option.price[locale]}</span>
              </li>
            ))}
          </ul>

          <div className={s.optionFoot}>
            <p className={s.footNote}>{text['studioPlans.note']}</p>
            <p className={s.footActions}>
              <Link href={path(locale, 'plan')} className="u-btn" data-tap>
                {copy.studioPlans.detail}
              </Link>
            </p>
          </div>
        </div>
      </Section>
      )}

      {/* ---------- 스튜디오 세트 (ko 미노출) ---------- */}
      {!isKo && (
      <Section
        label={copy.sets.label}
        title={text['sets.title']}
        lead={text['sets.lead']}
        aside={
          <Link href={path(locale, 'studio')} className="u-link">
            {copy.sets.cta}
          </Link>
        }
      >
        <ul className={s.setGrid}>
          {STUDIO_SETS.map((set) => {
            const image = pickImage(
              studioImages,
              `set.${set.slug}`,
              locale,
              set.image,
              set.title[locale],
            );
            return (
              <li key={set.slug}>
                {image && (
                  <span className={`u-arch ${s.setImage}`}>
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes="(max-width: 767px) 50vw, 25vw"
                      className={s.cover}
                    />
                  </span>
                )}
                <span className={s.setTitle}>{set.title[locale]}</span>
                <span className={s.setNote}>{set.note[locale]}</span>
              </li>
            );
          })}
        </ul>
      </Section>
      )}

      {/* ---------- LOCATION PLAN (ko 는 원화 상품 — 웨딩/기타 촬영) ---------- */}
      <Section
        alt
        label={copy.locationPlans.label}
        title={text['locationPlans.title']}
        lead={text['locationPlans.lead']}
        aside={copy.locationPlans.aside}
      >
        <ul className={s.locGrid}>
          {(isKo ? KO_WEDDING_PLANS : LOCATION_PLANS).map((plan) => (
            <li key={plan.code}>
              <PlanCard plan={plan} locale={locale} />
            </li>
          ))}
        </ul>

        <div className={s.noteBox}>
          <p className="u-label">{copy.locationPlans.notesLabel}</p>
          <ul className={s.noteList}>
            {(isKo ? KO_HOME_PLAN_NOTES : LOCATION_NOTES[locale]).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>

          <p className={s.anniversaryLabel}>{copy.locationPlans.anniversaryLabel}</p>
          <ul className={s.anniversary}>
            {(isKo ? KO_ETC_PLANS : ANNIVERSARY_PLANS).map((plan) => (
              <li key={plan.code}>
                <span>{plan.title[locale]}</span>
                <span className="u-num">
                  {plan.priceText ?? `¥${plan.price.toLocaleString('en-US')}`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className={s.locActions}>
          <Link href={path(locale, 'location')} className="u-btn" data-tap>
            {copy.locationPlans.detail}
          </Link>
        </p>
      </Section>

      {/* ---------- 최근 작품 ---------- */}
      <Section label={copy.works.label} title={text['works.title']} lead={text['works.lead']}>
        <RecentWorks locale={locale} works={works} />
      </Section>

      {/* ---------- PHOTOGRAPHER ---------- */}
      <section className={s.photographer}>
        <div className={s.photographerImage}>
          <Image
            src={photographerImage.src}
            alt={photographerImage.alt}
            fill
            sizes="(max-width: 767px) 100vw, 55vw"
            className={s.cover}
          />
        </div>
        <div className={s.photographerBody}>
          <p className="u-label">{copy.photographer.label}</p>
          <p className={`u-h2 ${s.photographerName}`}>{copy.photographer.name}</p>
          <p className={s.photographerText}>
            {toLines(text['photographer.body']).map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
          <p className={s.photographerCta}>
            <Link href={path(locale, 'photographer')} className="u-link" data-tap>
              {copy.photographer.cta}
            </Link>
          </p>
        </div>
      </section>

      {/* 네이버 블로그 안내는 한국어 페이지 전용 */}
      {locale === NAVER_BLOG_NOTICE_LOCALE && <NaverNotice />}

      {/* ---------- FAQ ---------- */}
      <Section alt label={copy.faq.label} title={text['faq.title']}>
        <HomeFaq locale={locale} />
      </Section>

      <ContactCta locale={locale} />

      <StickyCta locale={locale} />
    </>
  );
}
