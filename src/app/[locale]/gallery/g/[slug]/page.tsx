import type { Metadata } from 'next';
import { ORG_ID } from '@/lib/structured-data';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PhotoGrid } from '@/components/gallery/PhotoGrid';
import { GALLERY } from '@/components/gallery/content';
import type { Photo } from '@/content/photos';
import { findBySlug, getPublishedPhotos, sameSet, shootCoverOf } from '@/server/photos-content';
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
import { Reveal } from './Reveal';

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

  const all = await getPublishedPhotos();
  const photo = findBySlug(all, slug);
  if (!photo) return {};

  // 같은 촬영의 사진들은 게시물 캡션 하나를 본문으로 공유한다. 그대로 두면 같은 글이
  // 여러 주소로 발행되므로, 대표컷을 정본으로 지정해 색인을 한 곳에 모은다.
  // 사람에게는 이 페이지가 그대로 보이고, 바뀌는 것은 검색엔진에 주는 신호뿐이다.
  const cover = shootCoverOf(all, photo);

  // 메타 설명은 태그 없는 문장 한 문단으로 제한한다. 캡션 전문이 그대로 흘러가면
  // 검색 결과 스니펫이 해시태그 덩어리가 된다. story 는 이미 정제돼 있지만 길이는 여기서 자른다.
  const description =
    captionDescription(photo.caption) || captionDescription(photo.story[locale]);

  return {
    title: photo.alt[locale],
    description,
    // 얇은 페이지(사진 한 장 + 캡션)라 색인 대상에서 뺀다. follow 는 남겨 목록·필터
    // 갤러리로 링크 신호가 계속 흐르게 한다. 사이트맵에서도 함께 뺐다(sitemap.ts).
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${SITE_URL}${path(locale, 'gallery', 'g', cover.slug)}`,
      languages: alternates('gallery', 'g', cover.slug),
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

  /*
   * 릴스 페이지는 VideoObject 로 선언한다 — 실제로 영상이 재생되는 페이지를 ImageObject 로
   * 내보내면 구조화 데이터가 화면과 어긋난다(리치 결과 자격은 사실과 일치할 때만 성립).
   * schema.org 표준 타입만 쓴다. 둘의 공통 필드는 같고 영상 쪽만 contentUrl 이 mp4,
   * thumbnailUrl 이 포스터가 된다.
   */
  const isVideo = photo.mediaType === 'video' && photo.videoUrl;
  // 수집 사진의 src 는 이미 절대 URL(자사 Blob)이고, 시드만 사이트 상대경로다.
  const absSrc = photo.src.startsWith('http') ? photo.src : `${SITE_URL}${photo.src}`;
  const imageObject = {
    '@context': 'https://schema.org',
    '@type': isVideo ? 'VideoObject' : 'ImageObject',
    ...(isVideo
      ? { contentUrl: photo.videoUrl, thumbnailUrl: absSrc, uploadDate: photo.takenAt }
      : { contentUrl: absSrc }),
    url: `${SITE_URL}${path(locale, 'gallery', 'g', photo.slug)}`,
    name: photo.alt[locale],
    caption: photo.alt[locale],
    description: photo.story[locale],
    width: photo.width,
    height: photo.height,
    datePublished: photo.takenAt,
    // schema.org 표준 필드만 쓴다. keywords 는 정제된 상위 태그 — AI 검색 전용 스키마는 없다.
    ...(igTags.length ? { keywords: igTags.join(', ') } : {}),
    // 전역 Organization 노드를 @id 로 참조하되 @type·name 을 함께 적는다 — @id 만 두면
    // Search Console 이 "creator 개체 유형이 잘못됨"으로 판정했다(2026-08-24 메일).
    creator: { '@type': 'Organization', '@id': ORG_ID, name: 'usherinmaking' },
    copyrightHolder: { '@type': 'Organization', '@id': ORG_ID, name: 'usherinmaking' },
    // 이미지 라이선스 메타데이터(구글 이미지 검색의 "라이선스 가능" 배지 요건).
    // 별도 약관 페이지가 없어 두 URL 모두 문의 페이지로 둔다 — 사용 허락은 문의로만 이뤄진다.
    creditText: 'usherinmaking',
    copyrightNotice: `© ${new Date(photo.takenAt ?? Date.now()).getFullYear()} usherinmaking`,
    license: `${SITE_URL}${path(locale, 'contact')}`,
    acquireLicensePage: `${SITE_URL}${path(locale, 'contact')}`,
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
        {photo.mediaType === 'video' && photo.videoUrl ? (
          // 릴스 원본. 포스터는 사진 파이프라인이 만든 썸네일이라 격자와 톤이 같다.
          // 자동재생하지 않는다 — 사용자가 눌러야 소리와 함께 시작된다.
          <video
            src={photo.videoUrl}
            poster={photo.src}
            controls
            playsInline
            preload="metadata"
            width={photo.width}
            height={photo.height}
            className={s.heroImage}
          />
        ) : (
          <Image
            src={photo.src}
            alt={photo.alt[locale]}
            width={photo.width}
            height={photo.height}
            sizes="(max-width: 800px) 100vw, 760px"
            className={s.heroImage}
            priority
          />
        )}
      </figure>

      <article className={`u-wrap ${s.main}`}>
        <div>
          <Reveal>
            <p className="u-label">
              {(photo.terms.includes('studio') ? 'STUDIO' : 'LOCATION') + ' ・ '}
              <span className="u-num">{taken}</span>
            </p>
            <h1 className={s.title}>{photo.alt[locale]}</h1>
          </Reveal>

          <Reveal delay={90}>
            <p className={s.story}>{photo.story[locale]}</p>
          </Reveal>

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

        <Reveal delay={140}>
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
        </Reveal>
      </article>

      <p className={`u-wrap u-meta ${s.domainNote}`}>{text['ownDomainNote']}</p>

      {related.length > 0 && (
        <section className={`u-wrap ${s.related}`}>
          <p className="u-label">{GALLERY.sameSet}</p>
          <Reveal>
            <div className={s.relatedGrid}>
              <PhotoGrid locale={locale} photos={related} columns={4} />
            </div>
          </Reveal>
        </section>
      )}
    </>
  );
}
