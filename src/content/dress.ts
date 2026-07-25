import type { Locale } from '@/lib/i18n';

/**
 * 드레스 시드 모듈.
 *
 * 브랜드명은 담지 않는다 — 드레스 페이지는 컬렉션(실루엣·소재·색)으로만 이야기한다.
 * 그래서 이 파일 어디에도 brand 필드가 없다. 새로 추가하지 말 것.
 *
 * prisma/schema.prisma 에는 Dress 모델이 아직 없다. 이관 대상이 생기기 전까지
 * 이 파일이 원본이고, 타입은 여기서 정의한다. (스키마 갭은 인계 보고에 적어 두었다)
 */

type L10n = Record<Locale, string>;

/* ---------------- 컬렉션 (드레스 페이지의 필터 축과 같다) ---------------- */

export type DressCollectionSlug = 'white' | 'color' | 'vintage' | 'maternity';

export type DressCollection = {
  slug: DressCollectionSlug;
  title: L10n;
  /** 소재·색 등 한 줄 설명 */
  note: L10n;
  /**
   * 컬렉션 대표 사진. 아직 받지 못한 컬렉션은 null 이고 화면은 플레이스홀더를 그린다.
   * 없는 경로를 지어내지 말 것.
   */
  image: string | null;
};

export const DRESS_COLLECTIONS: DressCollection[] = [
  {
    slug: 'white',
    title: { ja: 'ホワイト ・ クラシック', en: 'White · classic', ko: '화이트 · 클래식' },
    note: { ja: 'サテン ・ チュール ・ レース', en: 'Satin, tulle and lace', ko: '새틴 · 튤 · 레이스' },
    image: '/images/studio/IMG_0695.png',
  },
  {
    slug: 'color',
    title: { ja: 'カラー', en: 'Colour', ko: '컬러' },
    note: {
      ja: 'ベージュ ・ ワイン ・ ブラック',
      en: 'Beige, wine and black',
      ko: '베이지 · 와인 · 블랙',
    },
    image: '/images/studio/IMG_0698.png',
  },
  {
    slug: 'vintage',
    title: { ja: 'ヴィンテージ ライン', en: 'Vintage line', ko: '빈티지 라인' },
    note: {
      ja: '刺繍 ・ パフスリーブ',
      en: 'Embroidery and puff sleeves',
      ko: '자수 · 퍼프 소매',
    },
    image: null,
  },
  {
    slug: 'maternity',
    title: { ja: 'マタニティ', en: 'Maternity', ko: '만삭' },
    note: { ja: 'Plan.03 専用衣装', en: 'Included in Plan 03', ko: 'PLAN 03 전용 의상' },
    image: null,
  },
];

/** 드레스 페이지 필터 라벨. ALL 은 컬렉션이 아니라 필터 항목이라 따로 둔다. */
export const DRESS_FILTER_ALL: L10n = { ja: 'ALL', en: 'ALL', ko: '전체' };

/* ---------------- 대여 안내 ---------------- */

export type RentalCondition = {
  key: 'studio' | 'location' | 'items' | 'groom';
  label: L10n;
  /** 줄바꿈이 의미를 가지므로 문장 배열로 둔다 */
  body: Record<Locale, string[]>;
};

export const RENTAL_CONDITIONS: RentalCondition[] = [
  {
    key: 'studio',
    label: { ja: 'スタジオプラン', en: 'Studio plans', ko: '스튜디오 플랜' },
    body: {
      ja: ['ドレス 1〜2着込み（Plan.01 / 02）', 'プレミアムドレスは ＋¥20,000〜'],
      en: ['1–2 dresses included (Plan 01 / 02)', 'Premium dresses from +¥20,000'],
      ko: ['드레스 1~2벌 포함 (PLAN 01 / 02)', '프리미엄 드레스는 +¥20,000부터'],
    },
  },
  {
    key: 'location',
    label: { ja: 'ロケーション', en: 'Location plans', ko: '로케이션' },
    body: {
      ja: ['レンタル ¥10,000 台 〜 ¥50,000 台'],
      en: ['Rental from the ¥10,000 to the ¥50,000 range'],
      ko: ['대여 ¥10,000대 ~ ¥50,000대'],
    },
  },
  {
    key: 'items',
    label: { ja: '小物', en: 'Small items', ko: '소품' },
    body: {
      ja: ['ブーケ ・ ブートニア ・ アクセサリー', 'レンタル時は込み（当日カメラマンが持参）'],
      en: [
        'Bouquet, boutonniere and accessories',
        'Included with a rental, brought on your session day',
      ],
      ko: ['부케 · 부토니아 · 액세서리', '대여 시 포함되며 촬영 당일 가져다 드립니다'],
    },
  },
  {
    key: 'groom',
    // 턱시도는 취급하지 않는다 — 문의가 반복되는 항목이라 페이지에 못박아 둔다.
    label: { ja: '新郎衣装', en: 'Groom', ko: '신랑 의상' },
    body: {
      ja: ['タキシードはありません', 'スタジオは M サイズ ＋¥20,000 でご用意'],
      en: ['No tuxedos available', 'Studio: size M suit for +¥20,000'],
      ko: ['턱시도는 없습니다', '스튜디오는 M 사이즈 +¥20,000'],
    },
  },
];

/* ---------------- 고르는 순서 ---------------- */

export type FittingStep = {
  no: '01' | '02' | '03' | '04';
  body: L10n;
};

export const FITTING_STEPS: FittingStep[] = [
  {
    no: '01',
    body: {
      ja: 'お問い合わせ時に、雰囲気のご希望をお知らせください',
      en: 'Tell us the mood you have in mind when you enquire',
      ko: '문의하실 때 원하는 분위기를 알려주세요',
    },
  },
  {
    no: '02',
    body: {
      ja: '候補をご提案（サイズのご確認）',
      en: 'We suggest options and check sizing',
      ko: '후보를 제안하고 사이즈를 확인합니다',
    },
  },
  {
    no: '03',
    body: {
      ja: '撮影当日、ドレスルームで最終決定',
      en: 'Final choice in the dress room on your session day',
      ko: '촬영 당일 드레스룸에서 최종 결정',
    },
  },
  {
    no: '04',
    body: {
      ja: 'ヘアメイクに合わせて小物をコーディネート',
      en: 'Accessories matched to your hair and make-up',
      ko: '헤어메이크업에 맞춰 소품을 맞춥니다',
    },
  },
];

/* ---------------- 개별 드레스 (관리자 화면에서 다룬다) ---------------- */

export type DressTier = 'basic' | 'premium';

export type DressItem = {
  id: string;
  /** 실루엣·소재로 부르는 이름. 브랜드명이 아니다. */
  name: L10n;
  collection: DressCollectionSlug;
  tier: DressTier;
  /** 추가요금(엔). 없으면 null — 0 과 구분해야 화면이 "없음"을 말할 수 있다. */
  surcharge: number | null;
  sizes: string[];
  description: Partial<L10n>;
  /**
   * 개별 드레스 사진은 아직 납품되지 않았다. 전부 null 이며,
   * 화면은 이 값이 null 이면 "사진 없음" 상태를 그대로 보여준다.
   */
  photo: string | null;
  published: boolean;
};

/**
 * 시안(admin-design-2c)에 실린 3벌.
 * 실제 대여 재고 목록을 받은 것이 아니므로 사진은 전부 null 이고,
 * DRESS_INVENTORY_CONFIRMED 가 false 인 동안 관리자 화면이 그 사실을 표시한다.
 */
export const DRESS_INVENTORY_CONFIRMED = false;

export const DRESS_ITEMS: DressItem[] = [
  {
    id: 'a-line-satin',
    name: { ja: 'Aライン サテン', en: 'A-line satin', ko: 'A라인 새틴' },
    collection: 'white',
    tier: 'basic',
    surcharge: null,
    sizes: ['55', '66'],
    description: {},
    photo: null,
    published: true,
  },
  {
    id: 'lace-sleeve',
    name: { ja: 'レース スリーブ', en: 'Lace sleeve', ko: '레이스 슬리브' },
    collection: 'vintage',
    tier: 'premium',
    surcharge: 20000,
    sizes: ['55', '66'],
    description: {},
    photo: null,
    published: true,
  },
  {
    id: 'color-dress',
    name: { ja: 'カラードレス', en: 'Colour dress', ko: '컬러 드레스' },
    collection: 'color',
    tier: 'basic',
    surcharge: null,
    sizes: ['55', '66'],
    description: {},
    photo: null,
    published: false,
  },
];
