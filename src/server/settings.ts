import { LOCALES, type Locale } from '@/lib/i18n';
import { BRAND, STUDIO_INFO, TBC } from '@/content/site';
import { prisma, isDatabaseConfigured } from '@/server/db';
import type { L10n } from '@/server/translations';

/**
 * 사이트 정보 · 언어별 상담 채널 설정.
 *
 * 저장은 Setting(key-value) 테이블의 JSON 두 건이다 — 관리자 저장값이 우선하고,
 * 없거나 DB 가 죽어 있으면 환경변수 + src/content/site.ts 기본값으로 내려간다.
 * 공개 페이지가 이 모듈을 읽으므로, 읽기는 어떤 경우에도 던지지 않는다.
 *
 * 두 가지는 설정으로도 못 바꾸는 규칙이다.
 *  1) 언어별 1순위 채널 (KO 카카오톡 / JA LINE / EN 문의 폼) — 업무 규칙이다.
 *  2) 이메일 주소는 어떤 경로로도 페이지에 렌더되지 않는다.
 */

export type ChannelId = 'kakao' | 'line' | 'instagram' | 'form';

export const CHANNEL_LABEL: Record<ChannelId, string> = {
  kakao: '카카오톡',
  line: 'LINE',
  instagram: 'Instagram',
  form: '문의 폼',
};

/**
 * 언어별 1순위 채널. 선호가 아니라 업무 규칙이므로 상수로 못박는다.
 * EN 의 1순위는 문의 폼이다 (이메일은 폼 뒤에 있고 화면에 노출되지 않는다).
 */
export const REQUIRED_PRIMARY: Record<Locale, ChannelId> = {
  ko: 'kakao',
  ja: 'line',
  en: 'form',
};

/** Instagram 은 어느 언어에서도 보조 채널이다. */
export const SECONDARY_EVERYWHERE: ChannelId = 'instagram';

/** 네이버 블로그 안내는 한국어에만 노출한다. */
export const NAVER_NOTICE_LOCALE: Locale = 'ko';

/* ---------------------------------------------------------------- 타입 */

export type ChannelSetting = {
  id: ChannelId;
  /** 관리자가 편집할 수 있는 부분 — 핸들과 링크 */
  handle: string | null;
  url: string | null;
  order: number;
};

export type OutstandingKey = 'address' | 'fromAirport' | 'representativeEmail' | 'logoSvg';

/** 아직 못 받은 사실. 빈 칸이 아니라 "미확인"으로 보여야 한다. */
export type OutstandingItem = {
  key: OutstandingKey;
  label: string;
  /** 페이지에 렌더할 때 쓰는 로케일별 (요확인) 토큰 */
  token: L10n;
};

export type SiteSettings = {
  brandName: string;
  /** 로고 SVG 경로. 아직 못 받았으면 null. */
  logoSvg: string | null;
  /** 주소 — 일본어 표기와 로마자 표기(EN / KO 공용). 못 받았으면 null. */
  address: { ja: string | null; latin: string | null };
  /** 공항에서 걸리는 시간. 못 받았으면 null. */
  fromAirport: string | null;
  /** 확인된 사실 */
  parking: L10n;
  languages: L10n;
  geo: { lat: number | null; lng: number | null };
  /**
   * 대표 이메일은 "설정되어 있는지" 여부만 노출한다.
   * 주소 문자열 자체는 이 타입 어디에도 없다 — 캐시되는 페이지로 새어나갈 경로를 만들지 않기 위해서다.
   */
  representativeEmail: { configured: boolean };
  channels: Record<Locale, ChannelSetting[]>;
  naverBlog: { url: string | null; noticeLocale: Locale };
};

/* ---------------------------------------------------------------- 읽기 */

function envOrNull(name: string): string | null {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : null;
}

/**
 * 확정된 상담 창구 링크 (2026-08-11 사장님 전달).
 * env·관리자 저장값이 있으면 그쪽이 이기고, 없을 때 이 값으로 내려간다 —
 * "미설정이라 죽은 버튼"을 만들지 않기 위한 코드 확정값이다(naverBlog 폴백과 같은 계열).
 */
const CONFIRMED_CHANNEL_URLS: Record<string, string> = {
  line: 'https://line.me/ti/p/8Udy1kYg1l',
  // 콘택트의 인스타 창구는 프로필이 아니라 DM 입구다 — ig.me 는 DM 화면을 바로 연다.
  instagram: `https://ig.me/m/${BRAND.instagram}`,
};

function defaultChannels(): Record<Locale, ChannelSetting[]> {
  const instagram = (order: number): ChannelSetting => ({
    id: 'instagram',
    handle: `@${BRAND.instagram}`,
    // 계정명이 코드에 있으므로 링크도 기본으로 살아 있어야 한다 — 미설정과 다르다.
    url: CONFIRMED_CHANNEL_URLS.instagram,
    order,
  });
  return {
    ko: [
      { id: 'kakao', handle: null, url: envOrNull('KAKAO_CHANNEL_URL'), order: 0 },
      instagram(1),
      { id: 'form', handle: null, url: null, order: 2 },
    ],
    ja: [
      { id: 'line', handle: null, url: envOrNull('LINE_OFFICIAL_URL') ?? CONFIRMED_CHANNEL_URLS.line, order: 0 },
      instagram(1),
      { id: 'form', handle: null, url: null, order: 2 },
    ],
    en: [
      { id: 'form', handle: null, url: null, order: 0 },
      instagram(1),
    ],
  };
}

/* ------------------------------------------------- Setting 테이블 JSON */

const SITE_KEY = 'site-settings';
const CHANNELS_KEY = 'channel-settings';

/**
 * Setting 한 건을 JSON 으로 읽는다. 공개 페이지 렌더 경로에 있으므로
 * DB 부재·파손 JSON 은 전부 "저장값 없음"으로 취급하고 조용히 기본값으로 내려간다.
 */
async function readStored<T>(key: string): Promise<T | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const row = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
    return row ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}

async function writeStored(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    update: { value: json },
    create: { key, value: json },
  });
}

/** 저장된 채널 목록을 기본값 위에 얹는다 — 언어별로 저장된 언어만 갈아끼운다. */
function mergeChannels(
  stored: Partial<Record<Locale, ChannelSetting[]>> | null,
): Record<Locale, ChannelSetting[]> {
  const base = defaultChannels();
  if (!stored) return base;
  for (const l of LOCALES) {
    const list = stored[l];
    if (Array.isArray(list) && list.length > 0) {
      // 저장값이 그 언어를 통째로 갈아끼우되, 링크가 비어 있는 항목은 코드 기본값
      // (env·확정 URL)으로 메운다 — 관리자가 링크를 지운 채 저장해도 버튼이 죽지 않는다.
      const defaults = new Map(base[l].map((c) => [c.id, c.url]));
      base[l] = list.map((c) => ({ ...c, url: c.url ?? defaults.get(c.id) ?? null }));
    }
  }
  return base;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  // 우선순위: 관리자 저장값(Setting) > 환경변수 > 기본값. 관리자가 화면에서 고친 값이
  // 배포 없이 이겨야 하므로 DB 가 맨 앞이다.
  const [storedSite, storedChannels] = await Promise.all([
    readStored<SiteSettingsInput>(SITE_KEY),
    readStored<Partial<Record<Locale, ChannelSetting[]>>>(CHANNELS_KEY),
  ]);

  const lat = Number(process.env.STUDIO_LAT);
  const lng = Number(process.env.STUDIO_LNG);

  return {
    brandName: BRAND.name,
    logoSvg: envOrNull('LOGO_SVG_PATH'),
    address: {
      // 2026-08-10 확정 주소가 코드(STUDIO_INFO)에 있다 — 관리자 화면이 "(확인 필요)"를
      // 계속 보여주면 공개 페이지와 어긋난다. env·저장값이 없어도 확정값으로 내려간다.
      ja: storedSite?.addressJa ?? envOrNull('STUDIO_ADDRESS_JA') ?? STUDIO_INFO.address.ja,
      latin: storedSite?.addressLatin ?? envOrNull('STUDIO_ADDRESS_LATIN') ?? STUDIO_INFO.address.en,
    },
    fromAirport: storedSite?.fromAirport ?? envOrNull('STUDIO_FROM_AIRPORT'),
    parking: STUDIO_INFO.parking,
    languages: STUDIO_INFO.languages,
    geo: {
      lat: storedSite?.lat ?? (Number.isFinite(lat) && process.env.STUDIO_LAT ? lat : null),
      lng: storedSite?.lng ?? (Number.isFinite(lng) && process.env.STUDIO_LNG ? lng : null),
    },
    // 값이 아니라 존재 여부만 본다.
    representativeEmail: { configured: Boolean(envOrNull('REPRESENTATIVE_EMAIL')) },
    channels: mergeChannels(storedChannels),
    naverBlog: {
      // 블로그 주소는 공개된 확정 값이다(촬영후기 취입 스크립트의 BLOG_ID 와 같은 계정).
      url:
        storedSite?.naverBlogUrl ??
        envOrNull('NAVER_BLOG_URL') ??
        'https://blog.naver.com/usherinmaking',
      noticeLocale: NAVER_NOTICE_LOCALE,
    },
  };
}

/** 아직 못 받은 항목들. 화면은 빈 칸이 아니라 TBC 토큰으로 표시한다. */
export async function listOutstandingItems(): Promise<OutstandingItem[]> {
  const s = await getSiteSettings();
  const out: OutstandingItem[] = [];

  if (!s.address.ja || !s.address.latin) {
    out.push({ key: 'address', label: '스튜디오 주소', token: TBC });
  }
  if (!s.fromAirport) {
    out.push({ key: 'fromAirport', label: '공항에서 걸리는 시간', token: TBC });
  }
  if (!s.representativeEmail.configured) {
    // 주소 자체는 표시하지 않는다. "설정되지 않았다"는 사실만 알린다.
    out.push({ key: 'representativeEmail', label: '대표 이메일 (비공개 · 폼 수신용)', token: TBC });
  }
  if (!s.logoSvg) {
    out.push({ key: 'logoSvg', label: '로고 SVG', token: TBC });
  }
  return out;
}

/* ------------------------------------------------- 채널 우선순위 검증 */

export type ChannelWarningLevel = 'rule' | 'notice';

export type ChannelWarning = {
  locale: Locale;
  level: ChannelWarningLevel;
  message: string;
};

/**
 * 제안된 채널 순서가 업무 규칙과 어긋나는지 본다.
 * 관리자는 핸들과 링크를 자유롭게 고칠 수 있지만,
 * 1순위 순서를 규칙과 다르게 두면 화면에 경고가 남는다.
 */
export function validateChannelOrder(locale: Locale, order: ChannelId[]): ChannelWarning[] {
  const warnings: ChannelWarning[] = [];
  const required = REQUIRED_PRIMARY[locale];

  if (order.length === 0) {
    warnings.push({ locale, level: 'rule', message: '채널이 하나도 없습니다.' });
    return warnings;
  }

  if (order[0] !== required) {
    warnings.push({
      locale,
      level: 'rule',
      message: `${locale.toUpperCase()} 의 1순위는 ${CHANNEL_LABEL[required]} 입니다. 지금 1순위는 ${CHANNEL_LABEL[order[0]]} 입니다.`,
    });
  }

  if (order[0] === SECONDARY_EVERYWHERE) {
    warnings.push({
      locale,
      level: 'rule',
      message: 'Instagram 은 모든 언어에서 보조 채널입니다. 1순위로 둘 수 없습니다.',
    });
  }

  if (!order.includes(SECONDARY_EVERYWHERE)) {
    warnings.push({
      locale,
      level: 'notice',
      message: 'Instagram 이 빠져 있습니다. 보조 채널로 모든 언어에 두는 것이 기본입니다.',
    });
  }

  // 카카오톡은 한국어, LINE 은 일본어 창구다. 다른 언어에 얹으면 알린다.
  if (locale !== 'ko' && order.includes('kakao')) {
    warnings.push({ locale, level: 'notice', message: '카카오톡은 한국어 상담 창구입니다.' });
  }
  if (locale !== 'ja' && order.includes('line')) {
    warnings.push({ locale, level: 'notice', message: 'LINE 은 일본어 상담 창구입니다.' });
  }

  return warnings;
}

/** 지금 저장된 설정 전체를 검사한다. */
export async function validateAllChannels(): Promise<ChannelWarning[]> {
  const s = await getSiteSettings();
  return LOCALES.flatMap((l) =>
    validateChannelOrder(
      l,
      [...s.channels[l]].sort((a, b) => a.order - b.order).map((c) => c.id),
    ),
  );
}

/** 네이버 블로그 안내를 이 언어에 노출해도 되는가. */
export function canShowNaverNotice(locale: Locale): boolean {
  return locale === NAVER_NOTICE_LOCALE;
}

/* ---------------------------------------------------------------- 쓰기 */

export type SiteSettingsInput = {
  addressJa?: string | null;
  addressLatin?: string | null;
  fromAirport?: string | null;
  lat?: number | null;
  lng?: number | null;
  naverBlogUrl?: string | null;
};

/**
 * 부분 갱신이다 — 넘어온 키만 갈아끼우고 나머지 저장값은 남긴다.
 * null 은 "지운다"(환경변수·기본값으로 복귀), undefined 는 "건드리지 않는다".
 */
export async function updateSiteSettings(input: SiteSettingsInput): Promise<SiteSettings> {
  const current = (await readStored<SiteSettingsInput>(SITE_KEY)) ?? {};
  const next: SiteSettingsInput = { ...current };
  for (const key of Object.keys(input) as (keyof SiteSettingsInput)[]) {
    const value = input[key];
    if (value === undefined) continue;
    if (value === null) delete next[key];
    else (next as Record<string, unknown>)[key] = value;
  }
  await writeStored(SITE_KEY, next);
  return getSiteSettings();
}

export type ChannelUpdateInput = {
  locale: Locale;
  channels: { id: ChannelId; handle: string | null; url: string | null; order: number }[];
};

export async function updateChannels(input: ChannelUpdateInput): Promise<ChannelSetting[]> {
  // 순서 규칙 검사(validateChannelOrder)는 라우트가 이미 돌렸다. 여기서는 저장만 한다.
  const stored = (await readStored<Partial<Record<Locale, ChannelSetting[]>>>(CHANNELS_KEY)) ?? {};
  const list = input.channels.map((c) => ({ ...c }));
  stored[input.locale] = list;
  await writeStored(CHANNELS_KEY, stored);
  return list;
}
