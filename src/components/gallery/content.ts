import type { Locale } from '@/lib/i18n';

type L10n = Record<Locale, string>;

/** 갤러리 목록·상세에서만 쓰는 문안. 시안 카드의 확정 카피를 그대로 옮긴다. */
export const GALLERY = {
  eyebrow: 'GALLERY',

  title: { ja: 'Works', en: 'Works', ko: '갤러리' } satisfies L10n,

  /** 정의형 리드 — AEO 인용 대상. 질문 다음 답 형태. */
  definition: {
    ja: 'usherinmaking のギャラリーとは？ 沖縄のスタジオとロケーションで撮影した写真を、場所・撮影の種類・セットや季節ごとに絞り込んで見られるページです。',
    en: 'What is the usherinmaking gallery? It is the page where our studio and location photography in Okinawa can be narrowed down by place, by type of session, and by set or season.',
    ko: 'usherinmaking 갤러리란? 오키나와의 스튜디오와 로케이션에서 촬영한 사진을 장소 · 촬영 종류 · 세트와 계절별로 좁혀서 볼 수 있는 페이지입니다.',
  } satisfies L10n,

  lead: {
    ja: 'スタジオとロケーション、撮影の種類ごとにご覧いただけます。Instagram の投稿から掲載を選んだ作品です。',
    en: 'Studio and location sessions, sorted by what was photographed. Selected from our Instagram posts.',
    ko: '스튜디오와 로케이션, 촬영 종류별로 모아 보실 수 있습니다. 인스타그램에 올린 사진 가운데 골라 실었습니다.',
  } satisfies L10n,

  all: { ja: 'すべて', en: 'All', ko: '전체' } satisfies L10n,

  sort: 'NEWEST FIRST',

  filterNote: {
    ja: '絞り込みはそれぞれ独立したページになります（例 /ja/gallery/studio/wedding）。写真はすべて自社ドメインから配信しています。',
    en: 'Each filter is its own page (for example /en/gallery/studio/wedding). All photos are served from our own domain.',
    ko: '필터마다 주소가 따로 있어 마음에 드는 조합은 그대로 저장해 두실 수 있습니다 (예 /ko/gallery/studio/wedding). 사진은 모두 저희 서버에서 불러옵니다.',
  } satisfies L10n,

  empty: {
    ja: 'この条件に当てはまる写真はまだありません。条件を減らしてお試しください。',
    en: 'No photographs match this combination yet. Try removing one of the filters.',
    ko: '이 조건에 맞는 사진이 아직 없습니다. 필터를 하나 줄여서 다시 살펴보세요.',
  } satisfies L10n,

  /* ---- 상세 ---- */
  back: { ja: 'GALLERY', en: 'GALLERY', ko: '갤러리' } satisfies L10n,

  sameSet: 'SAME SET',

  ownDomainNote: {
    ja: '写真はすべて自社サーバーに保存した原本から配信しています（Instagram の埋め込みは使用していません）。',
    en: 'Every photograph is served from the original file on our own server. We don’t use Instagram embeds.',
    ko: '사진은 모두 저희 서버에 보관한 원본으로 보여드립니다. 인스타그램 임베드는 사용하지 않습니다.',
  } satisfies L10n,

  detailLabels: {
    plan: { ja: 'プラン', en: 'Plan', ko: '플랜' } satisfies L10n,
    duration: { ja: '所要', en: 'Duration', ko: '소요 시간' } satisfies L10n,
    set: { ja: 'セット', en: 'Set', ko: '세트' } satisfies L10n,
    dress: { ja: 'ドレス', en: 'Dress', ko: '드레스' } satisfies L10n,
  },

  planCta: { ja: 'PLAN 詳細', en: 'VIEW PLANS', ko: '플랜 상세' } satisfies L10n,

  // 영문만 'BOOK'(예약) 어감이라 자동 예약이 없다는 규칙과 어긋났다.
  // JA·KO 처럼 상담을 청하는 말로 맞춘다 — 누르면 상담 창구로 가지 예약이 되지 않는다.
  moodCta: {
    ja: 'この雰囲気で相談',
    en: 'ASK ABOUT THIS MOOD',
    ko: '이 분위기로 상담',
  } satisfies L10n,
} as const;

export function countLabel(n: number, locale: Locale): string {
  if (locale === 'ja') return `${n}件`;
  if (locale === 'ko') return `${n}장`;
  return n === 1 ? '1 photo' : `${n} photos`;
}

export function moreLabel(shown: number, total: number, locale: Locale): string {
  if (locale === 'ja') return `MORE（${total}件中 ${shown}件を表示）`;
  if (locale === 'ko') return `더 보기 (${total}장 중 ${shown}장)`;
  return `MORE (${shown} of ${total})`;
}
