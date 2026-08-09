import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CATEGORY_LABEL,
  JOURNAL_UI,
  SAMPLE_BADGE_SINGLE,
  allPostParams,
  findPost,
  formatDate,
  relatedPosts,
} from '@/content/journal';
import { ANNIVERSARY_PLANS, LOCATION_PLANS, STUDIO_PLANS, type Plan } from '@/content/site';
import { SITE_URL, UI, alternates, isLocale, path, type Locale } from '@/lib/i18n';
import { getPageCopy } from '@/server/page-content';
import { getJournalContentPosts } from '@/server/journal-content';
import s from './page.module.css';

export async function generateStaticParams() {
  // DB 에 취입된 글도 정적 생성 대상이다 — 시드만 보면 새 글이 404 가 된다.
  return allPostParams(await getJournalContentPosts());
}

const TAX_LABEL: Record<Locale, string> = { ja: '税込', en: 'tax included', ko: '세금 포함' };

/** 플랜 코드 → 플랜. 가격은 절대 페이지에서 다시 적지 않고 여기서 끌어온다. */
function planByCode(code: string): Plan | undefined {
  return [...STUDIO_PLANS, ...LOCATION_PLANS, ...ANNIVERSARY_PLANS].find((p) => p.code === code);
}

/**
 * 표지 주소를 절대 URL 로 만든다.
 *
 * 표지가 두 형태로 섞여 있다: 시안 원고는 `/images/...` 상대 경로, 취입 글은 스토리지의
 * 전체 URL 이다. 구조화 데이터와 OG 이미지는 절대 URL 을 요구하는데, 앞에 무조건
 * 사이트 주소를 붙이면 전체 URL 이 `https://사이트https://스토리지…` 로 깨진다.
 */
function absoluteUrl(src: string): string {
  return src.startsWith('http') ? src : `${SITE_URL}${src}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = findPost(locale, slug, await getJournalContentPosts());
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'journal', post.slug)}`,
      languages: alternates('journal', post.slug),
    },
    openGraph: {
      title: `${post.title} | usherinmaking`,
      description: post.excerpt,
      url: `${SITE_URL}${path(locale, 'journal', post.slug)}`,
      type: 'article',
      images: [{ url: absoluteUrl(post.cover.src), alt: post.cover.alt }],
    },
  };
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const all = await getJournalContentPosts();
  const post = findPost(locale, slug, all);
  if (!post) notFound();

  const ui = JOURNAL_UI[locale];
  const text = await getPageCopy('journal', locale);
  const plan = planByCode(post.planCode);
  const related = relatedPosts(locale, post.slug, 3, all);

  /**
   * 실제 촬영 기록에만 BlogPosting 을 붙인다.
   *
   * 오래 샘플 원고뿐이라 이 스키마를 내보내지 않았다 — 지어낸 글에 저자와 발행일을 선언하면
   * 사실이 아닌 것을 구조화해 내보내는 셈이기 때문이다. 네이버에서 옮겨온 실제 기록이
   * 들어오면서 조건이 달라졌으므로, **샘플이 아닌 글에만** 붙인다.
   *
   * `isBasedOn` 이 이 스키마의 요점이다. 같은 내용이 네이버에도 있으므로, 우리 쪽이
   * 무단 복제가 아니라 원문을 밝힌 정리본임을 기계가 읽을 수 있게 선언한다.
   */
  const naverOrigin = post.body
    .map((b) => ('text' in b ? b.text : ''))
    .join(' ')
    .match(/https:\/\/blog\.naver\.com\/\S+/)?.[0];

  const blogPosting = post.isSample
    ? null
    : {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt,
        image: absoluteUrl(post.cover.src),
        datePublished: post.publishedAt,
        inLanguage: locale,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${SITE_URL}${path(locale, 'journal', post.slug)}`,
        },
        author: { '@type': 'Person', name: 'usherinmaking' },
        publisher: {
          '@type': 'Organization',
          name: 'usherinmaking',
          url: `${SITE_URL}${path(locale, 'home')}`,
        },
        // 촬영지는 사이트 전체가 오키나와·미야코지마로 한정되어 있어 사실이다.
        contentLocation: { '@type': 'Place', name: 'Okinawa, Japan' },
        ...(naverOrigin ? { isBasedOn: naverOrigin } : {}),
      };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'usherinmaking',
        item: `${SITE_URL}${path(locale, 'home')}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: ui.heading,
        item: `${SITE_URL}${path(locale, 'journal')}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `${SITE_URL}${path(locale, 'journal', post.slug)}`,
      },
    ],
  };

  return (
    <article>
      {blogPosting && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPosting) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <header className={s.head}>
        <div className={s.column}>
          <p className={s.meta}>
            {CATEGORY_LABEL[post.category][locale]}
            <span className={`u-num ${s.date}`}> · </span>
            <time className={`u-num ${s.date}`} dateTime={post.publishedAt}>
              {formatDate(post.publishedAt)}
            </time>
          </p>
          <h1 className={s.title}>{post.title}</h1>

          {post.tags && post.tags.length > 0 && (
            <ul className={s.tags}>
              {post.tags.map((t) => (
                <li key={t} className={s.tag}>
                  {t}
                </li>
              ))}
            </ul>
          )}

          {/* 목록을 거치지 않고 들어와도 샘플임을 알 수 있어야 한다 */}
          {post.isSample && <p className={s.sampleBadge}>{SAMPLE_BADGE_SINGLE[locale]}</p>}
        </div>
      </header>

      <div className={s.cover}>
        {/*
          fill 이 아니라 폭·높이를 주고 CSS 로 원본 비율을 살린다 — fill 은 부모의 고정 높이를
          채우려 사진을 잘라낸다. width/height 는 첫 렌더의 자리를 잡기 위한 값이고,
          실제 표시 비율은 .coverImg 의 height:auto 가 원본에서 가져온다.
          sizes 는 CSS 의 max-width(800px)와 맞춘다 — 100vw 로 두면 표시 폭보다 큰 파일을 받아온다.
        */}
        <Image
          src={post.cover.src}
          alt={post.cover.alt}
          width={1600}
          height={1067}
          priority
          sizes="(max-width: 800px) 100vw, 800px"
          className={s.coverImg}
        />
      </div>

      <div className={s.body}>
        {post.body.map((block, i) => {
          if (block.kind === 'p') {
            return (
              <p key={i} className={s.p}>
                {block.text}
              </p>
            );
          }
          if (block.kind === 'quote') {
            return (
              <blockquote key={i} className={s.quote}>
                {block.text}
              </blockquote>
            );
          }
          if (block.kind === 'note') {
            return (
              <p key={i} className={s.note}>
                {block.text}
              </p>
            );
          }
          if (block.kind === 'figure') {
            return (
              <figure key={i} className={s.figure}>
                <Image
                  src={block.image.src}
                  alt={block.image.alt}
                  width={1600}
                  height={1067}
                  sizes="(max-width: 767px) 100vw, 760px"
                  className={s.figureImg}
                />
              </figure>
            );
          }
          return (
            <figure key={i} className={s.pair}>
              <div className={s.pairGrid}>
                {block.images.map((img) => (
                  <div key={img.src} className={s.pairCell}>
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      sizes="(max-width: 767px) 50vw, 380px"
                    />
                  </div>
                ))}
              </div>
              <figcaption className={s.pairCaption}>{block.caption}</figcaption>
            </figure>
          );
        })}
      </div>

      {/* 글에 해당하는 플랜 CTA */}
      {plan && (
        <section className={s.planCta}>
          <div className={s.planInner}>
            <p className={s.planText}>
              {text['planLead']}
              <br />
              <strong className={s.planName}>
                {plan.badge} {plan.title[locale]}{' '}
                <span className="u-num">¥{plan.price.toLocaleString('en-US')}</span>
                {plan.taxIncluded && <span className={s.planTax}> {TAX_LABEL[locale]}</span>}
              </strong>
            </p>
            <div className={s.planActions}>
              <Link href={path(locale, 'plan')} className="u-btn" data-tap>
                {ui.planDetail}
              </Link>
              <Link href={path(locale, 'contact')} className="u-btn-dark" data-tap>
                {UI.contactCta[locale]}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 관련 글 — 막다른 길을 만들지 않는다 */}
      {related.length > 0 && (
        <section className={s.relatedSection}>
          <div className={s.column}>
            <p className="u-label">{ui.related}</p>
            <ul className={s.relatedGrid}>
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={path(locale, 'journal', r.slug)} className={s.relatedCard}>
                    <span className={s.relatedThumb}>
                      <Image
                        src={r.cover.src}
                        alt={r.cover.alt}
                        fill
                        sizes="(max-width: 767px) 150px, 240px"
                      />
                    </span>
                    <span className={s.relatedTitle}>{r.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className={s.backRow}>
              <Link href={path(locale, 'journal')} className="u-link" data-tap>
                {ui.heading}
              </Link>
            </p>
          </div>
        </section>
      )}
    </article>
  );
}
