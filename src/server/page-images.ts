// 페이지 이미지 슬롯 — "이 페이지의 이 자리에 이 사진".
//
// 디자인이 고정한 자리(홈 히어로 2장, 스튜디오 세트, 로케이션 카테고리, 드레스 컬렉션,
// 포토그래퍼 인물컷)에 관리자가 업로드한 이미지를 걸 수 있게 하는 층이다.
//
// 핵심 규칙 두 가지:
//
//  1. 폴백. 행이 없으면 지금 리포지토리에 있는 /images/* 경로가 그대로 나간다.
//     이관 도중에 사이트가 빈칸이 되는 상태를 만들지 않기 위해서다.
//     그래서 슬롯 정의(SLOT 레지스트리)가 코드에 남아 있고, DB는 덮어쓰기 층일 뿐이다.
//
//  2. alt 3개 언어. 전부 채워지지 않은 이미지는 게시된 것으로 보지 않는다.
//     UI에서만 막으면 API를 직접 부르는 경로로 새므로 setPageImage에서 강제한다.
//     방어적으로 리졸버도 alt가 미완성인 행은 무시하고 폴백으로 되돌린다.

import { isDatabaseConfigured, prisma } from '@/server/db';
import { NotFoundError, ValidationError } from '@/server/errors';
import { LOCALES, type Locale } from '@/lib/i18n';
import { STUDIO_SETS } from '@/content/site';

/* ============================ 타입 ============================ */

/** schema의 Json { ja, en, ko }. photos.ts의 동명 타입과 같은 모양이다. */
export type Localized = Record<Locale, string>;

export type PageImageSlot = {
  /** PageImage.page — home / studio / location / dress / photographer */
  page: string;
  /** PageImage.slot — 페이지 안에서의 자리 */
  slot: string;
  /** 관리자 화면(한국어) 라벨 */
  label: string;
  /** 관리자 화면 그룹 머리글 */
  group: string;
  /** 행이 없을 때 나갈 현재 경로. 아직 사진이 없는 자리는 null. */
  fallback: { url: string; width: number; height: number } | null;
  /** 어떤 사진이 어울리는지 한 줄 안내 */
  hint?: string;
};

export type ResolvedImage = {
  url: string;
  width: number | null;
  height: number | null;
  /** DB 행에서 온 alt. 폴백일 때는 null이며 페이지가 자기 카피의 alt를 쓴다. */
  alt: Localized | null;
  source: 'db' | 'fallback';
};

/** 관리자 목록용 — 슬롯 정의 + 현재 걸린 값. */
export type PageImageBinding = PageImageSlot & {
  current: ResolvedImage | null;
  /** DB 행이 있는지. 폴백만 있는 상태와 구분한다. */
  bound: boolean;
  updatedAt: Date | null;
  updatedBy: string | null;
};

export type SetPageImageInput = {
  page: string;
  slot: string;
  url: string;
  width?: number | null;
  height?: number | null;
  alt: Localized;
  updatedBy: string | null;
};

/* ============================ 슬롯 레지스트리 ============================ */
//
// 이 배열이 "관리자가 바꿀 수 있는 자리"의 전부다. 여기에 없는 page+slot 조합은
// API가 거절한다 — 오타 하나로 아무 데도 안 걸리는 유령 행이 쌓이는 것을 막는다.

/** public/images 실측 치수. 폴백에도 width/height를 주어 next/image가 레이아웃을 잡게 한다. */
const FALLBACK_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '/images/up/0f62c6d466bcea42.jpg': { width: 1000, height: 668 },
  '/images/up/1440241c37bf4fc2.jpg': { width: 1000, height: 668 },
  '/images/up/934c72ebb62d141a.jpg': { width: 668, height: 1000 },
  '/images/studio/IMG_0690.png': { width: 560, height: 315 },
  '/images/studio/IMG_0695.png': { width: 315, height: 560 },
  '/images/studio/IMG_0698.png': { width: 560, height: 315 },
  '/images/studio/IMG_0746.png': { width: 560, height: 315 },
  '/images/studio/IMG_0747.png': { width: 315, height: 560 },
  '/images/studio/IMG_0766.png': { width: 560, height: 315 },
  '/images/studio/IMG_0769.png': { width: 315, height: 560 },
};

function fallbackFor(url: string): PageImageSlot['fallback'] {
  const dim = FALLBACK_DIMENSIONS[url];
  // 치수를 모르는 경로는 폴백으로 쓰지 않는다 — 레이아웃이 튀는 편이 빈칸보다 나쁘다.
  return dim ? { url, ...dim } : null;
}

/** 스튜디오 세트는 site.ts가 원본이다. 슬러그가 늘면 슬롯도 자동으로 늘어난다. */
const STUDIO_SET_SLOTS: PageImageSlot[] = STUDIO_SETS.map((set) => ({
  page: 'studio',
  slot: `set.${set.slug}`,
  label: `스튜디오 세트 — ${set.title.ko}`,
  group: '스튜디오 세트',
  fallback: fallbackFor(set.image),
  hint: set.note.ko,
}));

export const PAGE_IMAGE_SLOTS: PageImageSlot[] = [
  {
    page: 'home',
    slot: 'hero.location',
    label: '홈 히어로 — LOCATION 패널',
    group: '홈 히어로',
    fallback: fallbackFor('/images/up/0f62c6d466bcea42.jpg'),
    hint: '야외 촬영을 대표하는 한 장. 가로가 긴 사진이 맞습니다.',
  },
  {
    page: 'home',
    slot: 'hero.studio',
    label: '홈 히어로 — STUDIO 패널',
    group: '홈 히어로',
    fallback: fallbackFor('/images/studio/IMG_0766.png'),
    hint: '실내 촬영을 대표하는 한 장. 가로가 긴 사진이 맞습니다.',
  },

  ...STUDIO_SET_SLOTS,

  {
    page: 'location',
    slot: 'category.wedding',
    label: '로케이션 카테고리 — WEDDING',
    group: '로케이션 카테고리',
    fallback: fallbackFor('/images/up/1440241c37bf4fc2.jpg'),
    hint: '아치 마스크가 걸리는 자리입니다.',
  },
  {
    page: 'location',
    slot: 'category.anniversary',
    label: '로케이션 카테고리 — ANNIVERSARY',
    group: '로케이션 카테고리',
    fallback: fallbackFor('/images/up/934c72ebb62d141a.jpg'),
    hint: '아치 마스크가 걸리는 자리입니다.',
  },

  {
    page: 'dress',
    slot: 'collection.white',
    label: '드레스 — 화이트',
    group: '드레스 컬렉션',
    fallback: fallbackFor('/images/studio/IMG_0695.png'),
  },
  {
    page: 'dress',
    slot: 'collection.color',
    label: '드레스 — 컬러',
    group: '드레스 컬렉션',
    fallback: fallbackFor('/images/studio/IMG_0698.png'),
  },
  {
    page: 'dress',
    slot: 'collection.vintage',
    label: '드레스 — 빈티지',
    group: '드레스 컬렉션',
    // 아직 이 컬렉션의 사진이 리포지토리에 없다. 지어내지 않고 비워 둔다.
    fallback: null,
    hint: '아직 사진이 없습니다. 올리면 그때부터 노출됩니다.',
  },
  {
    page: 'dress',
    slot: 'collection.maternity',
    label: '드레스 — 마터니티',
    group: '드레스 컬렉션',
    fallback: null,
    hint: '아직 사진이 없습니다. 올리면 그때부터 노출됩니다.',
  },

  {
    page: 'photographer',
    slot: 'portrait',
    label: '포토그래퍼 인물컷',
    group: '포토그래퍼',
    // 작가 포트레이트는 아직 받지 못한 자산이다. 화면은 [ PORTRAIT ] 자리표시로 비워 두고 있고,
    // 스튜디오 실내컷을 대신 걸면 "이 사람이 작가"라는 거짓 정보가 된다. 올릴 때까지 비운다.
    fallback: null,
    hint: '아직 사진이 없습니다. 올리면 자리표시 대신 이 사진이 나갑니다.',
  },
];

export function findSlot(page: string, slot: string): PageImageSlot | null {
  return PAGE_IMAGE_SLOTS.find((s) => s.page === page && s.slot === slot) ?? null;
}

export function slotsForPage(page: string): PageImageSlot[] {
  return PAGE_IMAGE_SLOTS.filter((s) => s.page === page);
}

/* ============================ alt 규칙 ============================ */

/**
 * 비어 있는 언어 목록. 3개 언어 모두 채워져야 게시로 본다.
 * UI 비활성화와 API 검증이 같은 함수를 쓰도록 여기서 한 번만 정의한다.
 */
export function missingAltLocales(alt: Partial<Localized> | null | undefined): Locale[] {
  return LOCALES.filter((l) => !alt?.[l] || alt[l]!.trim().length === 0);
}

export function isAltComplete(alt: Partial<Localized> | null | undefined): boolean {
  return missingAltLocales(alt).length === 0;
}

/* ============================ 매핑 ============================ */

type PageImageRow = {
  page: string;
  slot: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: unknown;
  updatedAt: Date;
  updatedBy: string | null;
};

/** Json 칼럼은 any로 들어온다. 모양이 아니면 null로 떨어뜨려 폴백이 이기게 한다. */
function readAlt(raw: unknown): Localized | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out = {} as Localized;
  for (const l of LOCALES) {
    const v = obj[l];
    if (typeof v !== 'string') return null;
    out[l] = v;
  }
  return isAltComplete(out) ? out : null;
}

function toResolved(row: PageImageRow): ResolvedImage | null {
  const alt = readAlt(row.alt);
  // alt가 미완성인 행은 게시된 것으로 보지 않는다 → 폴백으로 되돌린다.
  if (!alt) return null;
  return { url: row.url, width: row.width, height: row.height, alt, source: 'db' };
}

function fallbackResolved(slot: PageImageSlot): ResolvedImage | null {
  if (!slot.fallback) return null;
  return {
    url: slot.fallback.url,
    width: slot.fallback.width,
    height: slot.fallback.height,
    alt: null,
    source: 'fallback',
  };
}

/* ============================ 리졸버 (공개 페이지용) ============================ */

/**
 * 페이지 하나의 모든 슬롯을 한 번에. 페이지가 슬롯마다 쿼리를 날리지 않도록 이 형태를 기본으로 둔다.
 *
 * 반환은 항상 그 페이지의 모든 슬롯 키를 갖는다. 값이 null인 것은
 * "DB에도 없고 폴백도 없는 자리"이며, 페이지는 그 자리를 렌더하지 않으면 된다.
 */
export async function resolvePageImages(page: string): Promise<Record<string, ResolvedImage | null>> {
  const slots = slotsForPage(page);
  const out: Record<string, ResolvedImage | null> = {};
  for (const s of slots) out[s.slot] = fallbackResolved(s);

  if (!isDatabaseConfigured() || slots.length === 0) return out;

  let rows: PageImageRow[] = [];
  try {
    rows = await prisma.pageImage.findMany({ where: { page } });
  } catch (err) {
    // 공개 페이지가 DB 장애로 통째로 죽으면 안 된다. 폴백으로 계속 나간다.
    console.error('[page-images] 조회 실패 — 폴백으로 렌더합니다', page, err);
    return out;
  }

  for (const row of rows) {
    if (!(row.slot in out)) continue; // 레지스트리에 없는 유령 행은 무시
    const resolved = toResolved(row);
    if (resolved) out[row.slot] = resolved;
  }
  return out;
}

/** 슬롯 하나. 여러 개가 필요하면 resolvePageImages를 쓴다. */
export async function resolvePageImage(page: string, slot: string): Promise<ResolvedImage | null> {
  const def = findSlot(page, slot);
  if (!def) return null;

  const fallback = fallbackResolved(def);
  if (!isDatabaseConfigured()) return fallback;

  try {
    const row = await prisma.pageImage.findUnique({ where: { page_slot: { page, slot } } });
    if (!row) return fallback;
    return toResolved(row) ?? fallback;
  } catch (err) {
    console.error('[page-images] 조회 실패 — 폴백으로 렌더합니다', page, slot, err);
    return fallback;
  }
}

/* ============================ 관리자 읽기 ============================ */

/** 슬롯 정의 + 현재 걸린 값. 관리자 화면이 이 목록 하나로 그려진다. */
export async function listPageImageBindings(): Promise<PageImageBinding[]> {
  const bound = new Map<string, PageImageRow>();

  if (isDatabaseConfigured()) {
    try {
      const rows = await prisma.pageImage.findMany();
      for (const r of rows) bound.set(`${r.page}::${r.slot}`, r);
    } catch (err) {
      console.error('[page-images] 관리자 목록 조회 실패', err);
    }
  }

  return PAGE_IMAGE_SLOTS.map((s) => {
    const row = bound.get(`${s.page}::${s.slot}`);
    if (!row) {
      return { ...s, current: fallbackResolved(s), bound: false, updatedAt: null, updatedBy: null };
    }
    return {
      ...s,
      // 관리자에게는 alt가 미완성이어도 "무엇이 걸려 있는지"를 보여야 고칠 수 있다.
      current: {
        url: row.url,
        width: row.width,
        height: row.height,
        alt: readAlt(row.alt),
        source: 'db',
      },
      bound: true,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  });
}

/* ============================ 쓰기 ============================ */

/**
 * 슬롯에 이미지를 건다. 이미 있으면 덮어쓴다.
 *
 * 거절 조건:
 *   - 레지스트리에 없는 page+slot  → 404
 *   - alt 3개 언어 중 하나라도 비었음 → 422 (게시 전제 조건)
 */
export async function setPageImage(input: SetPageImageInput): Promise<ResolvedImage> {
  const def = findSlot(input.page, input.slot);
  if (!def) {
    throw new NotFoundError(`정의되지 않은 이미지 슬롯입니다: ${input.page} / ${input.slot}`);
  }

  const missing = missingAltLocales(input.alt);
  if (missing.length > 0) {
    throw new ValidationError(
      `alt가 비어 있어 게시할 수 없습니다 (${missing.join(', ')}). 3개 언어를 모두 입력해 주세요.`,
      { page: input.page, slot: input.slot, missing },
    );
  }

  if (!isDatabaseConfigured()) {
    // 저장한 척하지 않는다.
    throw new ValidationError('DB가 연결되지 않아 이미지 슬롯을 저장할 수 없습니다.');
  }

  const alt: Localized = {
    ja: input.alt.ja.trim(),
    en: input.alt.en.trim(),
    ko: input.alt.ko.trim(),
  };

  const data = {
    url: input.url,
    width: input.width ?? null,
    height: input.height ?? null,
    alt,
    updatedBy: input.updatedBy,
  };

  const row = await prisma.pageImage.upsert({
    where: { page_slot: { page: input.page, slot: input.slot } },
    create: { page: input.page, slot: input.slot, ...data },
    update: data,
  });

  return { url: row.url, width: row.width, height: row.height, alt, source: 'db' };
}

/** 슬롯 해제 — 행을 지우면 폴백(/images/*)이 다시 나간다. */
export async function clearPageImage(page: string, slot: string): Promise<ResolvedImage | null> {
  const def = findSlot(page, slot);
  if (!def) throw new NotFoundError(`정의되지 않은 이미지 슬롯입니다: ${page} / ${slot}`);

  if (!isDatabaseConfigured()) {
    throw new ValidationError('DB가 연결되지 않아 이미지 슬롯을 해제할 수 없습니다.');
  }

  // 없는 행을 지우는 것은 오류가 아니다 — 목표 상태(행 없음)에 이미 도달해 있다.
  await prisma.pageImage.deleteMany({ where: { page, slot } });
  return fallbackResolved(def);
}
