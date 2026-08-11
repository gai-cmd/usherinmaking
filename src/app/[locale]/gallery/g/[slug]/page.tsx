import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PhotoGrid } from '@/components/gallery/PhotoGrid';
import { GALLERY } from '@/components/gallery/content';
import type { Photo } from '@/content/photos';
import { findBySlug, getPublishedPhotos, sameSet } from '@/server/photos-content';
import { TERMS, termLabel } from '@/content/taxonomy';
import {
  ANNIVERSARY_PLANS,
  LOCATION_PLANS,
  STUDIO_PLANS,
  TBC,
  type Plan,
} from '@/content/site';
import { SITE_URL, alternates, isLocale, path } from '@/lib/i18n';
import { captionDescription, topHashtags } from '@/lib/caption';
import { getPageCopy } from '@/server/page-content';
import s from './page.module.css';

const ALL_PLANS: Plan[] = [...STUDIO_PLANS, ...LOCATION_PLANS, ...ANNIVERSARY_PLANS];

export async function generateStaticParams() {
  // DB 에 올라간 사진도 정적 생성 대상이다 — 시드만 보면 새 사진이 404 가 된다.
  return (await getPublishedPhotos()).map((photo) => ({ slug: photo.slug }));
}

function planOf(photo: Photo): Plan | undefined {
  return ALL_PLANS.find((plan) => plan.code === photo.planCode);
}

/** 사진에 붙은 term 중 세트·계절 축만 */
function moodTermsOf(photo: Photo) {
  return TERMS.filter((t) => t.taxonomy === 'mood' && photo.terms.includes(t.slug));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const photo = findBySlug(await getPublishedPhotos(), slug);
  if (!photo) return {};

  // 메타 설명은 태그 없는 문장 한 문단으로 제한한다. 캡션 전문이 그대로 흘러가면
  // 검색 결과 스니펫이 해시태그 덩어리가 된다. story 는 이미 정제돼 있지만 길이는 여기서 자른다.
  const description =
    captionDescription(photo.caption) || captionDescription(photo.story[locale]);

  return {
    title: photo.alt[locale],
    description,
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'gallery', 'g', photo.slug)}`,
      languages: alternates('gallery', 'g', photo.slug),
    },
    openGraph: {
      type: 'article',
      title: photo.alt[locale],
      description,
      images: [{ url: photo.src, width: photo.width, height: photo.height }],
    },
  };
}

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const all = await getPublishedPhotos();
  const photo = findBySlug(all, slug);
  if (!photo) notFound();

  const text = await getPageCopy('gallery', locale);

  const plan = planOf(photo);
  const moods = moodTermsOf(photo);
  const chips = TERMS.filter((t) => photo.terms.includes(t.slug) && t.label[locale]);
  const related = sameSet(all, photo, 4);
  const taken = photo.takenAt.slice(0, 7).replace('-', '.');

  // 인스타 해시태그는 상위 소수만 태그 칩으로 보여준다. 수십 개를 본문에 그대로 두면
  // 키워드 나열이 되고, 전부 버리면 검색 단서를 잃는다 — 앞쪽 태그가 게시물의 핵심이다.
  const igTags = topHashtags(photo.caption);

  const imageObject = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    contentUrl: `${SITE_URL}${photo.src}`,
    url: `${SITE_URL}${path(locale, 'gallery', 'g', photo.slug)}`,
    name: photo.alt[locale],
    caption: photo.alt[locale],
    description: photo.story[locale],
    width: photo.width,
    height: photo.height,
    datePublished: photo.takenAt,
    // schema.org 표준 필드만 쓴다. keywords 는 정제된 상위 태그 — AI 검색 전용 스키마는 없다.
    ...(igTags.length ? { keywords: igTags.join(', ') } : {}),
    creator: {
      '@type': 'Organization',
      name: 'usherinmaking',
      sameAs: [
        'https://www.instagram.com/usherinmaking/',
        'https://www.instagram.com/usherindress/',
      ],
    },
    copyrightHolder: { '@type': 'Organization', name: 'usherinmaking' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(imageObject) }}
      />

      <nav className={`u-wrap ${s.bar}`}>
        <Link href={path(locale, 'gallery')} className={s.back} data-tap>
          ← {GALLERY.back[locale]}
        </Link>
        <Link href={path(locale, 'contact')} className={s.back} data-tap>
          CONTACT
        </Link>
      </nav>

      <figure className={s.hero}>
        <Image
          src={photo.src}
          alt={photo.alt[locale]}
          width={photo.width}
          height={photo.height}
          sizes="(max-width: 800px) 100vw, 760px"
          className={s.heroImage}
          priority
        />
      </figure>

      <article className={`u-wrap ${s.main}`}>
        <div>
          <p className="u-label">
            {(photo.terms.includes('studio') ? 'STUDIO' : 'LOCATION') + ' ・ '}
            <span className="u-num">{taken}</span>
          </p>
          <h1 className={s.title}>{photo.alt[locale]}</h1>
          <p className={s.story}>{photo.story[locale]}</p>

          <ul className={s.chips}>
            {chips.map((term) => (
              <li key={term.key}>
                <Link href={path(locale, 'gallery', term.slug)} className={s.chip} data-tap>
                  {termLabel(term, locale)}
                </Link>
              </li>
            ))}
          </ul>

          {igTags.length > 0 && (
            <ul className={s.chips} aria-label="Instagram tags">
              {igTags.map((tag) => (
                <li key={tag}>
                  <span className={s.chip}>#{tag}</span>
                </li>
              ))}
            </ul>
          )}

          {photo.caption && photo.caption.trim() !== photo.story[locale] && (
            <details className="u-meta">
              <summary>
                {locale === 'ja' ? 'Instagram原文を見る' : locale === 'ko' ? '인스타그램 원문 보기' : 'View original Instagram caption'}
              </summary>
              <p style={{ whiteSpace: 'pre-wrap' }}>{photo.caption}</p>
            </details>
          )}
        </div>

        <aside className={s.meta}>
          <dl className={s.table}>
            <div className={s.row}>
              <dt>{GALLERY.detailLabels.plan[locale]}</dt>
              <dd>
                {plan ? (
                  <>
                    {plan.badge}{' '}
                    <span className="u-num">¥{plan.price.toLocaleString('en-US')}</span>
                  </>
                ) : (
                  TBC[locale]
                )}
              </dd>
            </div>
            <div className={s.row}>
              <dt>{GALLERY.detailLabels.duration[locale]}</dt>
              <dd>{plan ? plan.duration[locale] : TBC[locale]}</dd>
            </div>
            <div className={s.row}>
              <dt>{GALLERY.detailLabels.set[locale]}</dt>
              <dd>{moods.map((term) => termLabel(term, locale)).join(' ・ ') || TBC[locale]}</dd>
            </div>
            <div className={s.row}>
              <dt>{GALLERY.detailLabels.dress[locale]}</dt>
              <dd>{photo.dress ? photo.dress[locale] : TBC[locale]}</dd>
            </div>
          </dl>

          <div className={s.actions}>
            <Link href={path(locale, 'plan')} className="u-btn" data-tap>
              {GALLERY.planCta[locale]}
            </Link>
            <Link href={path(locale, 'contact')} className="u-btn-dark" data-tap>
              {GALLERY.moodCta[locale]}
            </Link>
          </div>
        </aside>
      </article>

      <p className={`u-wrap u-meta ${s.domainNote}`}>{text['ownDomainNote']}</p>

      {related.length > 0 && (
        <section className={`u-wrap ${s.related}`}>
          <p className="u-label">{GALLERY.sameSet}</p>
          <div className={s.relatedGrid}>
            <PhotoGrid locale={locale} photos={related} columns={4} />
          </div>
        </section>
      )}
    </>
  );
}
