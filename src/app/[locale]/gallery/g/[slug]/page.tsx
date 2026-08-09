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

  return {
    title: photo.alt[locale],
    description: photo.story[locale],
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'gallery', 'g', photo.slug)}`,
      languages: alternates('gallery', 'g', photo.slug),
    },
    openGraph: {
      type: 'article',
      title: photo.alt[locale],
      description: photo.story[locale],
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
    creator: { '@type': 'Organization', name: 'usherinmaking' },
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
          sizes="100vw"
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
