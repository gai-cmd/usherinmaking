import { NotImplementedError } from '@/server/errors';
import { LOCALES, type Locale } from '@/lib/i18n';
import { BRAND, STUDIO_INFO, TBC } from '@/content/site';
import type { L10n } from '@/server/translations';

/**
 * 사이트 정보 · 언어별 상담 채널 설정.
 *
 * prisma/schema.prisma 에 Settings 모델이 아직 없다 (인계 보고의 스키마 갭).
 * 지금은 환경변수 + src/content/site.ts 를 읽고, 쓰기는 전부 막아 둔다.
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

function defaultChannels(): Record<Locale, ChannelSetting[]> {
  const instagram = (order: number): ChannelSetting => ({
    id: 'instagram',
    handle: `@${BRAND.instagram}`,
    url: null,
    order,
  });
  return {
    ko: [
      { id: 'kakao', handle: null, url: envOrNull('KAKAO_CHANNEL_URL'), order: 0 },
      instagram(1),
      { id: 'form', handle: null, url: null, order: 2 },
    ],
    ja: [
      { id: 'line', handle: null, url: envOrNull('LINE_OFFICIAL_URL'), order: 0 },
      instagram(1),
      { id: 'form', handle: null, url: null, order: 2 },
    ],
    en: [
      { id: 'form', handle: null, url: null, order: 0 },
      instagram(1),
    ],
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  // Settings 모델이 없어 DB 우선 경로가 없다. 환경변수 + src/content/site.ts 가 원본이다.
  const lat = Number(process.env.STUDIO_LAT);
  const lng = Number(process.env.STUDIO_LNG);

  return {
    brandName: BRAND.name,
    logoSvg: envOrNull('LOGO_SVG_PATH'),
    address: { ja: envOrNull('STUDIO_ADDRESS_JA'), latin: envOrNull('STUDIO_ADDRESS_LATIN') },
    fromAirport: envOrNull('STUDIO_FROM_AIRPORT'),
    parking: STUDIO_INFO.parking,
    languages: STUDIO_INFO.languages,
    geo: {
      lat: Number.isFinite(lat) && process.env.STUDIO_LAT ? lat : null,
      lng: Number.isFinite(lng) && process.env.STUDIO_LNG ? lng : null,
    },
    // 값이 아니라 존재 여부만 본다.
    representativeEmail: { configured: Boolean(envOrNull('REPRESENTATIVE_EMAIL')) },
    channels: defaultChannels(),
    naverBlog: { url: envOrNull('NAVER_BLOG_URL'), noticeLocale: NAVER_NOTICE_LOCALE },
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

/*
 * 아래 두 쓰기 경로는 DB 연결 여부와 무관하게 막혀 있다.
 * schema.prisma 에 Settings 모델이 없어서 저장할 곳이 없다.
 * 지금 값들은 배포 환경변수로만 바뀐다 — 화면이 그렇게 안내해야 한다.
 */

export async function updateSiteSettings(_input: SiteSettingsInput): Promise<SiteSettings> {
  throw new NotImplementedError('사이트 정보 저장 (schema.prisma 에 Settings 모델이 없습니다)');
}

export type ChannelUpdateInput = {
  locale: Locale;
  channels: { id: ChannelId; handle: string | null; url: string | null; order: number }[];
};

export async function updateChannels(_input: ChannelUpdateInput): Promise<ChannelSetting[]> {
  // 순서 규칙 검사(validateChannelOrder)는 라우트에서 이미 돌지만,
  // 통과하더라도 저장할 테이블이 없다.
  throw new NotImplementedError('상담 채널 저장 (schema.prisma 에 Settings 모델이 없습니다)');
}
