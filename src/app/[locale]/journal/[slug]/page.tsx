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
      images: [{ url: `${SITE_URL}${post.cover.src}`, alt: post.cover.alt }],
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

  // 글이 전부 샘플이라 BlogPosting 은 내보내지 않는다. 사실인 이동 경로만 구조화한다.
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
        <Image src={post.cover.src} alt={post.cover.alt} fill priority sizes="100vw" />
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
