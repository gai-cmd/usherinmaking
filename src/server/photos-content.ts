import { isDatabaseConfigured, prisma } from '@/server/db';
import { PUBLISHED_PHOTOS, type Photo, type PhotoStatus } from '@/content/photos';
import { TERMS } from '@/content/taxonomy';
import type { Locale } from '@/lib/i18n';
import { parseCaption } from '@/lib/caption';

/** `content/photos.ts` 와 같은 모양. 그쪽은 export 하지 않으므로 여기서 다시 쓴다. */
type L10n = Record<Locale, string>;

/**
 * 공개 갤러리가 읽는 사진 목록. **DB 우선 · 시드 폴백.**
 *
 * 이 모듈이 없던 동안 갤러리·월별 아카이브는 `@/content/photos` 의 코드 시드만 봤다.
 * 관리자 업로드와 인스타 수집은 DB(Photo)에 쓰는데 화면은 그걸 읽지 않아,
 * "저장은 되는데 사이트는 그대로"인 닫힌 고리였다 — 저널이 `journal-content.ts` 로 푼 것과 같은 계열이다.
 *
 * DB 행은 화면 타입보다 정보가 조금 다르다(분류가 관계 테이블에 있고, 날짜가 시각이다).
 * 아래 해석기가 그 차이를 메운다.
 */

/**
 * 화면 타입 + 촬영 묶음 정보.
 *
 * `shootKey` 는 같은 촬영에서 나온 사진끼리 공유하는 이름이고, `shootOrder` 는 그 안의 순서다
 * (표지 0, 본문 사진 1부터). 갤러리가 "촬영 1건 = 카드 1개"로 보이는 근거가 이 두 값이다.
 * 낱장으로 올린 사진은 `shootKey` 가 비어 있고, 그때는 그 한 장이 곧 하나의 묶음이다.
 */
export type PhotoContent = Photo & {
  shootKey: string | null;
  shootOrder: number;
  /** 인스타 캡션 원문 전문. 태그 칩·원문 접기 표시용. 수동 업로드는 null. */
  caption: string | null;
};

/** 같은 촬영에서 나온 사진 묶음. 갤러리 목록의 카드 한 장에 대응한다. */
export type Shoot = {
  /** 묶음 식별자. 낱장 사진은 자기 slug 가 곧 묶음 이름이 된다. */
  key: string;
  /** 목록에 내보일 대표 사진 — shootOrder 가 가장 앞선 것. */
  cover: PhotoContent;
  /** 표지를 포함한 묶음 전체. 순서대로. */
  photos: PhotoContent[];
};

/** 슬러그 집합. DB 에 화면이 모르는 term 이 있어도 필터가 깨지지 않게 걸러낸다. */
const KNOWN_SLUGS = new Set(TERMS.map((t) => t.slug));

/**
 * 코드 시드에는 촬영 묶음이 없다. 시드는 시안용 낱장 모음이라 묶을 근거가 없으므로
 * 한 장이 한 묶음이 되도록 비워 둔다 — `groupByShoot` 가 그때 자기 slug 로 묶음을 만든다.
 */
const SEED: PhotoContent[] = PUBLISHED_PHOTOS.map((p) => ({
  ...p,
  shootKey: null,
  shootOrder: 0,
  caption: null,
}));

/** DB 는 시각을 들고 있고 화면은 문자열을 쓴다. 사이트 기준(JST) 날짜로 자른다. */
function toDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** alt / story 는 DB 에 Json 으로 들어간다. 세 언어가 다 없으면 그 자리를 비운다. */
function toL10n(v: unknown): L10n {
  const o = (v ?? {}) as Record<string, unknown>;
  const pick = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
  return { ja: pick('ja'), en: pick('en'), ko: pick('ko') };
}

/**
 * story 에 남아 있는 해시태그·멘션 제거. 새 수집분은 ingest 가 이미 정제해 저장하지만,
 * 그 이전에 들어온 행은 캡션 전문(태그 포함)이 story 로 남아 있다. 백필 없이 읽는 자리에서
 * 걷어내면 기존·신규가 같은 규칙으로 나간다 — 관리자가 story 를 고쳐 써도 태그만 빠진다.
 */
function cleanStory(story: L10n): L10n {
  return {
    ja: parseCaption(story.ja).body,
    en: parseCaption(story.en).body,
    ko: parseCaption(story.ko).body,
  };
}

type Row = {
  id: string;
  slug: string | null;
  shootKey: string | null;
  shootOrder: number;
  originalUrl: string;
  width: number;
  height: number;
  alt: unknown;
  story: unknown;
  caption: string | null;
  takenAt: Date;
  status: string;
  terms: { term: { slug: string } }[];
};

/** alt 한 줄에서도 인라인 태그를 걷는다. 걷고 나서 비면 원래 값을 지킨다 — 빈 alt 가 더 나쁘다. */
function cleanAltLine(v: string): string {
  return parseCaption(v).body.split('\n')[0] || v;
}

function fromDb(row: Row): PhotoContent | null {
  if (!row.originalUrl) return null;
  const rawAlt = toL10n(row.alt);
  const alt = { ja: cleanAltLine(rawAlt.ja), en: cleanAltLine(rawAlt.en), ko: cleanAltLine(rawAlt.ko) };
  // alt 가 한 언어도 없으면 그리지 않는다 — 대체 텍스트 없는 사진은 접근성 위반이다.
  if (!alt.ko && !alt.ja && !alt.en) return null;

  return {
    id: row.id,
    // 상세 주소로 쓰이는 값. 비어 있으면 id 로 떨어진다 — 주소 없는 사진을 만들지 않기 위해서다.
    slug: row.slug ?? row.id,
    shootKey: row.shootKey,
    shootOrder: row.shootOrder,
    src: row.originalUrl,
    width: row.width,
    height: row.height,
    alt,
    story: cleanStory(toL10n(row.story)),
    caption: row.caption ?? null,
    takenAt: toDateString(row.takenAt),
    terms: row.terms.map((t) => t.term.slug).filter((s) => KNOWN_SLUGS.has(s)),
    status: row.status as PhotoStatus,
  };
}

/**
 * 조회 결과를 잠깐 들고 있는다.
 *
 * 갤러리는 정적 생성이라 사진 320장 × 3개 언어 = 960개 상세 페이지가 만들어지는데,
 * 페이지마다 이 함수를 부르면 같은 320행을 960번 내려받는다. 빌드 1회에 수백 MB가 오가고,
 * 실제로 Neon 데이터 전송 쿼터를 소진시켰다(2026-08-10, 빌드 로그의 53000 오류).
 *
 * 빌드 동안은 모듈이 살아 있으므로 한 번만 읽고 나눠 쓴다. 런타임에서는 TTL 만큼 늦게
 * 반영될 수 있는데, 어차피 정적 페이지라 갱신은 재배포·재검증이 담당한다.
 */
const CACHE_TTL_MS = 60_000;
/**
 * 실패했을 때의 유예. DB 가 죽어 있으면 정적 생성 페이지 수백 개가 저마다 접속을 시도한다
 * (2026-08-10 빌드에서 546회). 짧게 쉬었다 다시 본다 — 회복은 여전히 몇 초 안에 반영된다.
 */
const FAIL_TTL_MS = 5_000;
let failedAt = 0;
let cache: { at: number; data: PhotoContent[] } | null = null;

/** 사진을 바꾼 직후 같은 프로세스에서 다시 읽어야 할 때 쓴다(관리자 저장 경로). */
export function forgetPublishedPhotos(): void {
  cache = null;
}

/**
 * 공개 화면이 부르는 유일한 진입점. DB 에 공개 사진이 한 장이라도 있으면 DB 가 이기고,
 * 없거나 DB 가 없으면 코드 시드가 그대로 나간다(빈 갤러리를 만들지 않는다).
 * 조회가 실패해도 공개 페이지를 죽이지 않는다.
 */
export async function getPublishedPhotos(): Promise<PhotoContent[]> {
  if (!isDatabaseConfigured()) return SEED;
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (failedAt && Date.now() - failedAt < FAIL_TTL_MS) return SEED;
  try {
    const rows = await prisma.photo.findMany({
      // 갤러리는 작품 계정(main)만이다 — 드레스 컬렉션 사진이 여기 섞이면 안 된다.
      where: { status: 'PUBLISHED', igAccount: 'main' },
      include: { terms: { include: { term: true } } },
      orderBy: { takenAt: 'desc' },
    });
    const photos = rows.map((r) => fromDb(r as unknown as Row)).filter((p): p is PhotoContent => p !== null);
    const result = photos.length > 0 ? photos : SEED;
    cache = { at: Date.now(), data: result };
    return result;
  } catch (err) {
    // 실패는 캐시하지 않는다 — 쿼터가 풀리거나 DB 가 돌아오면 다음 호출이 바로 성공해야 한다.
    failedAt = Date.now();
    console.error('[photos-content] 조회 실패 — 시드로 렌더합니다', err);
    return SEED;
  }
}

/**
 * 드레스 컬렉션(@usherindress 수집분). 갤러리와 저장소는 같고 계정으로만 갈린다.
 * 아직 수집 전이면 빈 배열 — 드레스 페이지는 그때 기존 정적 컬렉션을 그대로 쓴다.
 */
export async function getDressPhotos(): Promise<PhotoContent[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const rows = await prisma.photo.findMany({
      where: { status: 'PUBLISHED', igAccount: 'dress' },
      include: { terms: { include: { term: true } } },
      orderBy: { takenAt: 'desc' },
    });
    return rows
      .map((r) => {
        const photo = fromDb(r as unknown as Row);
        if (!photo) return null;
        // 드레스 분류(dressCollection 축)는 DB 에만 있는 term 이라 fromDb 의
        // KNOWN_SLUGS(갤러리 코드 택소노미) 필터에 걸러진다 — 원본 slug 로 되살린다.
        return { ...photo, terms: (r as unknown as Row).terms.map((t) => t.term.slug) };
      })
      .filter((p): p is PhotoContent => p !== null);
  } catch {
    return [];
  }
}

/** 분류 조합으로 거른다. 빈 배열이면 전체. `content/photos.ts` 의 filterPhotos 와 같은 규칙이다. */
export function filterBy(photos: PhotoContent[], termSlugs: string[]): PhotoContent[] {
  if (termSlugs.length === 0) return photos;
  return photos.filter((p) => termSlugs.every((slug) => p.terms.includes(slug)));
}

export function findBySlug(photos: PhotoContent[], slug: string): PhotoContent | undefined {
  return photos.find((p) => p.slug === slug);
}

/**
 * 사진 목록을 촬영 묶음으로 접는다. 목록에 넘어온 순서(최신순)를 그대로 이어받는다.
 *
 * `shootKey` 가 없는 사진은 자기 혼자 한 묶음이 된다 — 낱장으로 올린 사진을 잃지 않기 위해서다.
 * 필터가 걸린 목록에 그대로 적용해도 된다: 걸러진 사진만으로 묶음이 만들어지므로,
 * 예를 들어 "노을" 필터에서는 그 촬영 중 노을 사진만 묶여 나온다.
 */
export function groupByShoot(photos: PhotoContent[]): Shoot[] {
  const order: string[] = [];
  const bucket = new Map<string, PhotoContent[]>();

  for (const p of photos) {
    const key = p.shootKey ?? `single:${p.slug}`;
    if (!bucket.has(key)) {
      bucket.set(key, []);
      order.push(key);
    }
    bucket.get(key)!.push(p);
  }

  return order.map((key) => {
    const list = bucket.get(key)!.slice().sort((a, b) => a.shootOrder - b.shootOrder);
    return { key, cover: list[0], photos: list };
  });
}

/**
 * 같은 촬영의 다른 사진.
 *
 * 예전에는 세트·계절(mood 축)이 겹치는 사진을 보여줬는데, 그것은 "비슷한 분위기"일 뿐
 * 같은 촬영이라는 보장이 없었다. 묶음이 생긴 뒤로는 같은 촬영을 먼저 보여주고,
 * 묶음이 없는 낱장 사진일 때만 예전처럼 분위기로 찾는다.
 */
export function sameSet(photos: PhotoContent[], photo: PhotoContent, limit = 4): PhotoContent[] {
  if (photo.shootKey) {
    const mates = photos
      .filter((p) => p.shootKey === photo.shootKey && p.slug !== photo.slug)
      .sort((a, b) => a.shootOrder - b.shootOrder);
    if (mates.length) return mates.slice(0, limit);
  }

  const moods = TERMS.filter((t) => t.taxonomy === 'mood' && photo.terms.includes(t.slug)).map(
    (t) => t.slug,
  );
  return photos
    .filter((p) => p.slug !== photo.slug && p.terms.some((t) => moods.includes(t)))
    .slice(0, limit);
}
