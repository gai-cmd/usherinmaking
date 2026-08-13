import type { Locale } from '@/lib/i18n';

type L10n = Record<Locale, string>;

/**
 * DRESS 페이지 전용 카피. 각 로케일 카드에서 그대로 옮겼다.
 * 이 페이지에는 브랜드명이 하나도 들어가지 않는다 — 컬렉션 단위로만 말한다.
 */

export const HERO = {
  label: 'DRESS',
  title: { ja: 'Dress\nCollection', en: 'Dress\nCollection', ko: '드레스' } satisfies L10n,
  /** 정의형 리드문 — 페이지 상단의 실제 텍스트 */
  lead: {
    ja: '白いドレスから色のあるものまで、当日ドレスルームでお選びいただけます。スタジオプランはドレス代込み、ロケーションプランはレンタルとしてご利用いただけます。',
    en: 'From white gowns to colour, chosen in the dress room on your session day. Studio plans include the dress; for location sessions it is a rental.',
    // 한국 고객 상품은 의상이 포함되지 않는다 — 신부 드레스만 대여이고, 피팅은 없다.
    // JA/EN 의 "스튜디오 플랜에 드레스 포함"을 옮겨 오면 없는 상품을 안내하게 된다.
    ko: '흰 드레스부터 컬러 드레스까지, 신부 드레스에 한해 대여로 이용하실 수 있습니다. 드레스 1벌에 액세서리와 소품을 더해 10만원부터이며, 디자인과 사이즈는 상담을 통해 정합니다.',
  } satisfies L10n,
  imageAlt: {
    ja: 'スタジオのドレスコレクション',
    en: 'Dress collection in the studio',
    ko: '스튜디오 드레스 컬렉션',
  } satisfies L10n,
};

export const COLLECTION = {
  label: 'COLLECTION',
  title: {
    ja: 'ラインナップ',
    en: 'The line-up',
    ko: '드레스 컬렉션',
  } satisfies L10n,
  /**
   * 필터 탭 라벨. JA·EN 카드는 로케일 번역 없이 영문 대문자(ALL/WHITE/…)를 그대로 쓰고,
   * KO 카드만 한글로 옮긴다 — 세 카드가 서로 다른 표기를 실제로 쓰고 있어 그대로 옮겼다.
   */
  filterAll: { ja: 'ALL', en: 'ALL', ko: '전체' } satisfies L10n,
  /**
   * 개별 드레스 사진은 아직 받지 못했다.
   * 시안 캡션은 인스타그램에서 가져온다고 적혀 있으나, 사진은 자기 도메인에서만
   * 서비스한다는 원칙이 있어 출처를 적지 않고 "준비 중"으로만 표기한다.
   */
  pendingPhotos: {
    ja: '個別のドレス写真は準備中です。',
    en: 'Individual dress photographs are being prepared.',
    ko: '드레스 개별 사진은 준비 중입니다.',
  } satisfies L10n,
  placeholderLabel: 'DRESS PHOTO',
};

export type DressCategory = 'white' | 'color' | 'vintage' | 'maternity';

export type DressItem = {
  id: DressCategory;
  name: L10n;
  note: L10n;
  /** 사진이 확보된 항목만 image 를 갖는다. 나머지는 플레이스홀더로 그린다. */
  image?: { src: string; alt: L10n };
};

export const DRESS_ITEMS: DressItem[] = [
  {
    id: 'white',
    name: { ja: 'ホワイト ・ クラシック', en: 'White · classic', ko: '화이트 · 클래식' },
    note: {
      ja: 'サテン ・ チュール ・ レース',
      en: 'Satin, tulle and lace',
      ko: '새틴 · 튤 · 레이스',
    },
    image: {
      src: '/images/studio/IMG_0695.png',
      alt: {
        ja: '白のウェディングドレス',
        en: 'White wedding dresses',
        ko: '화이트 웨딩드레스',
      },
    },
  },
  {
    id: 'color',
    name: { ja: 'カラー', en: 'Colour', ko: '컬러' },
    note: {
      ja: 'ベージュ ・ ワイン ・ ブラック',
      en: 'Beige, wine and black',
      ko: '베이지 · 와인 · 블랙',
    },
    image: {
      src: '/images/studio/IMG_0698.png',
      alt: { ja: 'カラードレス', en: 'Coloured dresses', ko: '컬러 드레스' },
    },
  },
  {
    id: 'vintage',
    name: { ja: 'ヴィンテージ ライン', en: 'Vintage line', ko: '빈티지 라인' },
    note: {
      ja: '刺繍 ・ パフスリーブ',
      en: 'Embroidery and puff sleeves',
      ko: '자수 · 퍼프 소매',
    },
  },
  {
    id: 'maternity',
    name: { ja: 'マタニティ', en: 'Maternity', ko: '만삭' },
    note: {
      ja: 'Plan.03 専用衣装',
      en: 'Included in Plan 03',
      ko: 'PLAN 03 전용 의상',
    },
  },
];

/** 위 filterAll 과 같은 이유로 JA·EN 은 영문 대문자, KO 는 한글이다. */
export const CATEGORY_LABEL: Record<DressCategory, L10n> = {
  white: { ja: 'WHITE', en: 'WHITE', ko: '화이트' },
  color: { ja: 'COLOR', en: 'COLOR', ko: '컬러' },
  vintage: { ja: 'VINTAGE', en: 'VINTAGE', ko: '빈티지' },
  maternity: { ja: 'MATERNITY', en: 'MATERNITY', ko: '만삭' },
};

/* ---------------- 대여 조건 ---------------- */

export const RENTAL = {
  label: 'RENTAL',
  title: {
    ja: 'レンタルについて',
    en: 'How rental works',
    ko: '대여 안내',
  } satisfies L10n,
  /**
   * 한국 고객 상품(usherinmaking.com/korean)의 대여 조건은 JA/EN 과 다르다 —
   * 의상 미포함·신부 드레스만 대여·원화 표기·신랑 의상 직접 준비.
   * 로케일별 행 구성 자체가 달라 아래 KO_ROWS 로 갈라 둔다.
   */
  koRows: [
    {
      head: '웨딩 촬영',
      body: '드레스 1벌 + 액세서리 + 소품 10만원부터 / 신부 드레스만 대여 가능합니다',
    },
    {
      head: '기타 촬영',
      body: '의상은 제공하지 않으며, 웨딩 의상 착장은 불가합니다',
    },
    {
      head: '소품 · 액세서리',
      body: '드레스에 맞춰 작가가 매칭해 드리며, 개별 선택은 불가합니다',
    },
    {
      head: '신랑 의상',
      body: '직접 준비해 주셔야 합니다 (턱시도 대여는 없습니다)',
    },
  ],
  rows: [
    {
      head: { ja: 'スタジオプラン', en: 'Studio plans', ko: '스튜디오 플랜' } satisfies L10n,
      body: {
        ja: 'ドレス 1〜2着込み（Plan.01 / 02）／ プレミアムドレスは ＋¥20,000〜',
        en: '1–2 dresses included (Plan 01 / 02). Premium dresses from +¥20,000',
        ko: '드레스 1~2벌 포함 (PLAN 01 / 02) / 프리미엄 드레스는 +¥20,000부터',
      } satisfies L10n,
    },
    {
      head: { ja: 'ロケーション', en: 'Location plans', ko: '로케이션' } satisfies L10n,
      body: {
        ja: 'レンタル ¥10,000 台 〜 ¥50,000 台',
        en: 'Rental from the ¥10,000 to the ¥50,000 range',
        ko: '대여 ¥10,000대 ~ ¥50,000대',
      } satisfies L10n,
    },
    {
      head: { ja: '小物', en: 'Small items', ko: '소품' } satisfies L10n,
      body: {
        ja: 'ブーケ ・ ブートニア ・ アクセサリー ／ レンタル時は込み（当日カメラマンが持参）',
        en: 'Bouquet, boutonniere and accessories. Included with a rental, brought on your session day',
        ko: '부케 · 부토니아 · 액세서리 / 대여 시 드레스에 맞춰 작가가 매칭해 촬영 당일 가져갑니다',
      } satisfies L10n,
    },
    {
      head: { ja: '新郎衣装', en: 'Groom', ko: '신랑 의상' } satisfies L10n,
      body: {
        ja: 'タキシードはありません ／ スタジオは M サイズ ＋¥20,000 でご用意',
        en: 'No tuxedos available. Studio: size M suit for +¥20,000',
        ko: '턱시도는 준비되어 있지 않습니다 / 스튜디오는 M 사이즈 +¥20,000',
      } satisfies L10n,
    },
  ],
};

/* ---------------- 고르는 순서 ---------------- */

export const FITTING = {
  label: 'FITTING',
  title: {
    ja: 'お選びいただく流れ',
    en: 'Choosing yours',
    ko: '고르는 순서',
  } satisfies L10n,
  steps: {
    ja: [
      'お問い合わせ時に、雰囲気のご希望をお知らせください',
      '候補をご提案（サイズのご確認）',
      '撮影当日、ドレスルームで最終決定',
      'ヘアメイクに合わせて小物をコーディネート',
    ],
    en: [
      'Tell us the mood you have in mind when you enquire',
      'We suggest options and check sizing',
      'Final choice in the dress room on your session day',
      'Accessories matched to your hair and make-up',
    ],
    // 한국 고객은 드레스 피팅이 없다 — 상담으로 디자인·사이즈를 정하고 촬영일에 받는다.
    // "입어보고 최종 결정"은 스튜디오 드레스룸이 있는 JA/EN 안내라 KO 에 쓰면 사실과 어긋난다.
    ko: [
      '문의하실 때 원하시는 분위기를 알려주세요',
      '인스타그램의 드레스 컬렉션에서 디자인을 함께 고릅니다',
      '상담으로 사이즈를 확인해 드레스를 확정합니다 (피팅은 불가합니다)',
      '촬영 당일, 액세서리와 소품까지 맞춰 가져다 드립니다',
    ],
  } satisfies Record<Locale, string[]>,
};

export const META_TITLE: L10n = {
  ja: 'ドレス ・ コレクションとレンタル',
  en: 'Dress — collections and rental',
  ko: '드레스 · 컬렉션과 대여',
};
