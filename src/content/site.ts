import type { Locale } from '@/lib/i18n';

type L10n = Record<Locale, string>;
type L10nList = Record<Locale, string[]>;

/**
 * 확정된 사업 사실만 담는다.
 * 근거가 없는 값은 TBC(로케일별 「（要確認）」/「(to be confirmed)」/「(확인 필요)」)로 표기한다.
 */
export const TBC: L10n = {
  ja: '（要確認）',
  en: '(to be confirmed)',
  ko: '(확인 필요)',
};

export const BRAND = {
  name: 'usherinmaking',
  instagram: 'usherinmaking',
} as const;

/* ---------------- 스튜디오 세트 (사진에서 확인된 4개만) ---------------- */

export type StudioSet = {
  slug: string;
  image: string;
  title: L10n;
  note: L10n;
};

export const STUDIO_SETS: StudioSet[] = [
  {
    slug: 'arch-window',
    image: '/images/studio/IMG_0690.png',
    title: {
      ja: 'アーチ窓 ・ 自然光',
      en: 'Arched Window · Natural Light',
      ko: '아치 창 · 자연광',
    },
    note: {
      ja: 'ヘリンボーンの床とシャンデリア',
      en: 'Herringbone floor and a chandelier',
      ko: '헤링본 바닥과 샹들리에',
    },
  },
  {
    slug: 'dress-room',
    image: '/images/studio/IMG_0695.png',
    title: { ja: 'ドレスルーム', en: 'Dress Room', ko: '드레스룸' },
    note: {
      ja: '白のドレスとベール',
      en: 'White dresses and veils',
      ko: '흰 드레스부터 색이 있는 옷까지',
    },
  },
  {
    slug: 'vintage-corner',
    image: '/images/studio/IMG_0746.png',
    title: {
      ja: 'ヴィンテージ コーナー',
      en: 'Vintage Corner',
      ko: '빈티지 코너',
    },
    note: {
      ja: 'チーク家具とレース',
      en: 'Teak furniture and lace',
      ko: '티크 가구와 레이스',
    },
  },
  {
    slug: 'monotone-corner',
    image: '/images/studio/IMG_0747.png',
    title: {
      ja: 'モノトーン コーナー',
      en: 'Monotone Corner',
      ko: '모노톤 코너',
    },
    note: {
      ja: '黒とグリーンのコントラスト',
      en: 'Black against green',
      ko: '블랙과 초록, 조금 더 담백하게',
    },
  },
];

/* ---------------- 스튜디오 플랜 (모니터 가격 · 税込 표기 없음) ---------------- */

export type Plan = {
  code: string;
  scope: 'studio' | 'location' | 'anniversary';
  badge: string;
  title: L10n;
  duration: L10n;
  listPrice?: number;
  price: number;
  /** 표시 통화. 생략하면 JPY(¥). 한국어 전용 플랜은 KRW('만원' 표기)를 쓴다. */
  currency?: 'JPY' | 'KRW';
  /** 카드에 그대로 내보낼 가격 문자열 — 있으면 숫자 포맷 대신 이걸 쓴다 (예: '88만원'). */
  priceText?: string;
  taxIncluded: boolean;
  includes: L10nList;
};

export const STUDIO_PLANS: Plan[] = [
  {
    code: 'studio-01',
    scope: 'studio',
    badge: 'PLAN 01',
    title: {
      ja: 'スタジオ ウェディングフォト',
      en: 'Studio Wedding',
      ko: '스튜디오 웨딩 촬영',
    },
    duration: { ja: '約 3.5H ・ 30 CUTS', en: 'approx. 3.5H · 30 cuts', ko: '약 3.5시간 · 30컷' },
    listPrice: 140000,
    price: 99000,
    taxIncluded: false,
    includes: {
      ja: ['ヘアメイク・ドレス1着', 'ブーケ／ベール込み'],
      en: ['Hair and make-up, one dress', 'Bouquet and veil included'],
      ko: ['신부 풀메이크업 · 신랑 간단메이크업', '드레스 1벌 · 부케/베일 포함'],
    },
  },
  {
    code: 'studio-02',
    scope: 'studio',
    badge: 'PLAN 02',
    title: {
      ja: 'スタジオ + ロケーションフォト',
      en: 'Studio + Location',
      ko: '스튜디오 + 로케이션',
    },
    duration: { ja: '約 4.5H ・ 40 CUTS', en: 'approx. 4.5H · 40 cuts', ko: '약 4.5시간 · 40컷' },
    listPrice: 200000,
    price: 150000,
    taxIncluded: false,
    includes: {
      ja: ['ドレス2着', 'スタジオと屋外を一日で'],
      en: ['Two dresses', 'Indoors and outdoors in one day'],
      ko: ['드레스 2벌', '실내와 야외를 하루에'],
    },
  },
  {
    code: 'studio-03',
    scope: 'studio',
    badge: 'PLAN 03',
    title: {
      ja: 'ウェディング風 マタニティフォト',
      en: 'Wedding-style Maternity',
      ko: '웨딩풍 만삭 촬영',
    },
    duration: { ja: '約 3H ・ 20 CUTS', en: 'approx. 3H · 20 cuts', ko: '약 3시간 · 20컷' },
    listPrice: 85000,
    price: 66000,
    taxIncluded: false,
    includes: {
      ja: ['マタニティ専用衣装', 'メイク・ヘアセット込み'],
      en: ['Maternity outfit', 'Hair and make-up included'],
      ko: ['만삭 전용 의상', '남녀 메이크업 + 헤어'],
    },
  },
  {
    code: 'studio-04',
    scope: 'studio',
    badge: 'PLAN 04',
    title: {
      ja: '記念日・家族 プロフィール撮影',
      en: 'Anniversary and Family Portrait',
      ko: '기념일 · 가족 · 프로필',
    },
    duration: { ja: '約 50分 ・ 20 CUTS', en: 'approx. 50 min · 20 cuts', ko: '약 50분 · 20컷' },
    listPrice: 38000,
    price: 25000,
    taxIncluded: false,
    includes: {
      ja: ['1〜4名様まで', 'ヘアメイク追加可'],
      en: ['Up to four people', 'Hair and make-up can be added'],
      ko: ['1~4인까지', '헤어메이크업 추가 가능'],
    },
  },
];

/* ---------------- 로케이션 플랜 (税込) ---------------- */

export const LOCATION_PLANS: Plan[] = [
  {
    code: 'location-simple',
    scope: 'location',
    badge: 'SIMPLE',
    title: {
      ja: 'ロケーション ウェディングフォト',
      en: 'Location Wedding Photo',
      ko: '로케이션 웨딩 촬영',
    },
    duration: {
      ja: '撮影時間 1時間 ・ 1ヶ所 ・ 日中のみ',
      en: '1 hour · 1 location · daytime only',
      ko: '촬영 1시간 · 1개 장소 · 낮 시간만',
    },
    price: 76000,
    taxIncluded: true,
    includes: {
      ja: ['原本 全データ 200カット以上', '＋ 詳細編集 30カット'],
      en: ['200+ original frames', 'plus 30 retouched cuts'],
      ko: ['원본 전체 200컷 이상', '+ 정밀 보정 30컷'],
    },
  },
  {
    code: 'location-basic',
    scope: 'location',
    badge: 'BASIC',
    title: {
      ja: 'ロケーション ウェディングフォト',
      en: 'Location Wedding Photo',
      ko: '로케이션 웨딩 촬영',
    },
    duration: {
      ja: '撮影時間 2時間ほど ・ 2ヶ所 ・ 日中 / 午後〜サンセット',
      en: 'approx. 2 hours · 2 locations · daytime or into sunset',
      ko: '촬영 2시간 · 2개 장소 · 선셋까지 가능',
    },
    price: 100000,
    taxIncluded: true,
    includes: {
      ja: ['原本 全データ 400カット以上', '＋ 詳細編集 40カット'],
      en: ['400+ original frames', 'plus 40 retouched cuts'],
      ko: ['원본 전체 400컷 이상', '+ 정밀 보정 40컷'],
    },
  },
  {
    code: 'location-afterfull',
    scope: 'location',
    badge: 'AFTERFULL',
    title: {
      ja: 'ロケーション ウェディングフォト',
      en: 'Location Wedding Photo',
      ko: '로케이션 웨딩 촬영',
    },
    duration: {
      ja: '撮影時間 3時間30分 ・ 3ヶ所 ・ 夜景まで',
      en: 'approx. 3.5 hours · 3 locations · through to night',
      ko: '촬영 3시간 30분 · 3개 장소 · 야경까지',
    },
    price: 128000,
    taxIncluded: true,
    includes: {
      ja: ['原本 全データ 600カット以上', '＋ 詳細編集 50カット'],
      en: ['600+ original frames', 'plus 50 retouched cuts'],
      ko: ['원본 전체 600컷 이상', '+ 정밀 보정 50컷'],
    },
  },
];

/* 기념사진 (税込) */
export const ANNIVERSARY_PLANS: Plan[] = [
  {
    code: 'anniversary-standard',
    scope: 'anniversary',
    badge: 'STANDARD',
    title: { ja: '記念写真 スタンダード', en: 'Anniversary Standard', ko: '기념사진 스탠다드' },
    duration: {
      ja: '撮影時間 1時間 ・ 1ヶ所 ・ 日中のみ',
      en: '1 hour · 1 location · daytime only',
      ko: '촬영 1시간 · 1곳 · 낮 시간만',
    },
    price: 38000,
    taxIncluded: true,
    includes: {
      ja: ['原本 全データ 200カット以上', '＋ 色補正 20カット'],
      en: ['200+ original frames', 'plus 20 colour-corrected cuts'],
      ko: ['원본 전체 200컷 이상', '+ 색 보정 20컷'],
    },
  },
  {
    code: 'anniversary-half',
    scope: 'anniversary',
    badge: 'UP TO',
    title: { ja: '記念写真アップ・トゥー', en: 'Anniversary Half', ko: '기념사진 하프' },
    duration: {
      ja: '撮影時間 2時間 ・ 2ヶ所 ・ 日中 / 夕方〜サンセット',
      en: 'approx. 2 hours · 2 locations · daytime or into sunset',
      ko: '촬영 2시간 · 2곳 · 낮 / 저녁~선셋',
    },
    price: 60000,
    taxIncluded: true,
    includes: {
      ja: ['原本 全データ 400カット以上', '＋ 色補正 30カット'],
      en: ['400+ original frames', 'plus 30 colour-corrected cuts'],
      ko: ['원본 전체 400컷 이상', '+ 색 보정 30컷'],
    },
  },
];

/* ---------------- 옵션 (PLAN 01 / 02 공통) ---------------- */

export type PlanOption = {
  label: L10n;
  price: L10n;
  scope: L10n;
};

/**
 * 옵션 하나하나의 이름과 금액. 표시되는 자리가 여럿이라(홈 요약 · 스튜디오 페이지의
 * 플랜별 목록 · 관리자 번역 · 시드) 금액을 각자 적으면 한 곳만 고쳐지고 어긋난다.
 * 그래서 여기 한 번만 적고 아래 두 구조가 이것을 가리킨다.
 *
 * 휴일 요금은 플랜에 따라 금액이 다르다 — 웨딩(01/02)은 ＋¥18,000, 마타니티와
 * 기념일(03/04)은 ＋¥11,000 이라 별개 항목으로 둔다.
 */
const OPTION_ITEM = {
  groom: {
    label: { ja: '新郎衣装（Mサイズ）', en: "Groom's outfit (size M)", ko: '신랑 의상 (M 사이즈)' },
    price: { ja: '＋¥20,000', en: '+¥20,000', ko: '+¥20,000' },
  },
  rawJpeg: {
    label: { ja: '原本データ JPEG', en: 'Original JPEG data', ko: '원본 데이터 JPEG' },
    price: { ja: '＋¥5,500', en: '+¥5,500', ko: '+¥5,500' },
  },
  premiumDress: {
    label: { ja: 'プレミアムドレス', en: 'Premium dress', ko: '프리미엄 드레스' },
    price: { ja: '＋¥20,000〜', en: '+¥20,000 and up', ko: '+¥20,000부터' },
  },
  holidayWedding: {
    label: { ja: '休日料金', en: 'Weekend surcharge', ko: '주말·공휴일 요금' },
    price: { ja: '＋¥18,000', en: '+¥18,000', ko: '+¥18,000' },
  },
  holidayOther: {
    label: { ja: '休日料金', en: 'Weekend surcharge', ko: '주말·공휴일 요금' },
    price: { ja: '＋¥11,000', en: '+¥11,000', ko: '+¥11,000' },
  },
  extraPerson: {
    label: { ja: '1名様 追加', en: 'Extra person', ko: '인원 추가' },
    price: { ja: '＋¥3,300', en: '+¥3,300', ko: '+¥3,300' },
  },
  hairMake: {
    label: { ja: 'ヘアメイク 追加', en: 'Hair & make-up', ko: '헤어메이크업 추가' },
    price: { ja: '＋¥22,000', en: '+¥22,000', ko: '+¥22,000' },
  },
} satisfies Record<string, { label: L10n; price: L10n }>;

/**
 * 홈의 옵션 요약과 관리자 번역 · 시드가 쓰는 평평한 목록.
 * 어느 플랜에 붙는지는 scope 문장이 들고 있고, seedOptions() 가 그 문장에서
 * 플랜 번호를 되읽는다 — 문장을 고칠 때 그 파서도 같이 볼 것.
 */
export const STUDIO_OPTIONS: PlanOption[] = [
  { ...OPTION_ITEM.groom, scope: { ja: 'PLAN 01 / 02', en: 'PLAN 01 / 02', ko: 'PLAN 01 / 02' } },
  { ...OPTION_ITEM.rawJpeg, scope: { ja: 'PLAN 01 / 02', en: 'PLAN 01 / 02', ko: 'PLAN 01 / 02' } },
  {
    ...OPTION_ITEM.premiumDress,
    scope: { ja: 'PLAN 01 / 02', en: 'PLAN 01 / 02', ko: 'PLAN 01 / 02' },
  },
  {
    ...OPTION_ITEM.holidayWedding,
    scope: {
      ja: 'スタジオ・ロケーション共通',
      en: 'Studio and location alike',
      ko: '스튜디오·로케이션 공통',
    },
  },
];

export type PlanOptionGroup = {
  /** 이 옵션 묶음이 붙는 플랜. 01 과 02 는 붙는 옵션이 같아 한 묶음이 두 플랜을 가리킨다. */
  planCodes: string[];
  items: { label: L10n; price: L10n }[];
  note?: L10n;
};

/**
 * 스튜디오 페이지의 플랜별 옵션. 시안 카드(Wedding / Maternity / Memorial)의 OPTION 절을
 * 그대로 옮긴 것이다 — 옵션은 플랜마다 붙는 것이 다르므로 한 표에 몰아넣지 않는다.
 * 01 과 02 는 시안에서도 "PLAN.01 / 02 共通" 한 묶음이라 함께 둔다.
 */
export const STUDIO_PLAN_OPTIONS: PlanOptionGroup[] = [
  {
    planCodes: ['studio-01', 'studio-02'],
    items: [
      OPTION_ITEM.groom,
      OPTION_ITEM.premiumDress,
      OPTION_ITEM.rawJpeg,
      OPTION_ITEM.holidayWedding,
    ],
  },
  {
    planCodes: ['studio-03'],
    items: [OPTION_ITEM.rawJpeg, OPTION_ITEM.holidayOther],
  },
  {
    planCodes: ['studio-04'],
    items: [
      OPTION_ITEM.extraPerson,
      OPTION_ITEM.hairMake,
      OPTION_ITEM.rawJpeg,
      OPTION_ITEM.holidayOther,
    ],
    note: {
      ja: '※ ドレス撮影をご希望の方は ウェディングフォトプランへお問い合わせください。',
      en: 'For a dress session, please ask about the wedding photo plans.',
      ko: '※ 드레스 촬영을 원하시면 웨딩포토 플랜으로 문의해 주세요.',
    },
  },
];

/** 플랜 코드로 그 플랜에 붙는 옵션 묶음을 찾는다. 없으면 undefined — 옵션 없는 플랜도 있다. */
export function planOptions(code: string): PlanOptionGroup | undefined {
  return STUDIO_PLAN_OPTIONS.find((g) => g.planCodes.includes(code));
}

/** 로케이션 주의사항 — 촬영 데이터만 포함, 의상/헤어메이크업 별도 */
export const LOCATION_NOTES: L10nList = {
  ja: [
    'ロケーションプランに含まれるのは撮影データのみです。衣装代・ヘアメイク代は別途かかります。',
    'ドレスレンタル ¥10,000 〜 ¥50,000',
    'オープニングムービー撮影 ¥35,000（期間限定）',
    '土日祝 ＋¥18,000',
  ],
  en: [
    'A location plan covers the photography data only. Outfits and hair and make-up are charged separately.',
    'Dress rental from around ¥10,000 to ¥50,000.',
    'Opening movie ¥35,000 (limited-time offer)',
    'Weekends and public holidays: +¥18,000',
  ],
  ko: [
    '로케이션 플랜은 촬영 데이터만 포함됩니다. 의상비·헤어메이크업 비용은 별도입니다.',
    '드레스 대여 ¥10,000 ~ ¥50,000',
    '오프닝 무비 촬영 ¥35,000 (기간 한정)',
    '주말·공휴일 +¥18,000',
  ],
};

/* ---------------- 언어별 상담 채널 ---------------- */

export type Channel = {
  id: 'kakao' | 'line' | 'instagram';
  label: L10n;
  note: L10n;
  primary: boolean;
};

/**
 * 상담 창구는 메신저뿐이다 — 문의 폼과 메일 접수는 운영하지 않는다.
 * 1순위 채널만 검은 블록으로 강조한다. 이메일 주소는 어느 언어에서도 노출하지 않는다.
 */
export const CHANNELS: Record<Locale, Channel[]> = {
  ko: [
    {
      id: 'kakao',
      label: { ja: 'KakaoTalk', en: 'KakaoTalk', ko: '카카오톡' },
      // 개인 계정 링크는 친구추가를 거친다 — "클릭하면 채팅창"이라고 약속하면 거짓이 된다.
      // PC 에서는 QR 이 떠서 ID 검색이 더 빠르므로 ID 를 함께 적는다.
      note: { ja: '', en: '', ko: '친구추가 후 메시지 · ID: amipaek' },
      primary: true,
    },
    {
      id: 'instagram',
      label: { ja: 'Instagram', en: 'Instagram', ko: 'Instagram' },
      note: { ja: '', en: '', ko: '@usherinmaking DM' },
      primary: false,
    },
  ],
  ja: [
    {
      id: 'line',
      label: { ja: 'LINE', en: 'LINE', ko: 'LINE' },
      note: { ja: '友だち追加からメッセージ ・ ID: usehrinmaking', en: '', ko: '' },
      primary: true,
    },
    {
      id: 'instagram',
      label: { ja: 'Instagram', en: 'Instagram', ko: 'Instagram' },
      note: { ja: '@usherinmaking へDM', en: '', ko: '' },
      primary: false,
    },
  ],
  // 영어권 창구는 Instagram 하나다.
  en: [
    {
      id: 'instagram',
      label: { ja: 'Instagram', en: 'Instagram', ko: 'Instagram' },
      note: { ja: '', en: 'DM @usherinmaking — usually the quickest way to reach us.', ko: '' },
      primary: true,
    },
  ],
};

/* ---------------- 스튜디오 정보 ---------------- */

export const STUDIO_INFO = {
  parking: {
    ja: '駐車場 2台',
    en: 'Parking for two cars',
    ko: '주차 2대',
  } satisfies L10n,
  // 주소는 일본어 표기와 영문 표기 2종이 필요하다(하나를 기계번역하면 안 된다).
  // 2026-08-10 확정 — 영문·전화는 구글 비즈니스 등록 정보, 일본어 표기는 작가 확인.
  address: {
    ja: '〒901-2302 沖縄県中頭郡北中城村渡口1868',
    en: '1868 Toguchi, Kitanakagusuku, Nakagami District, Okinawa 901-2302',
    ko: '오키나와현 나카가미군 기타나카구스쿠손 도구치 1868 (〒901-2302)',
  } satisfies L10n,
  /** 지역 검색·AI 답변에서 주소와 함께 신뢰 신호가 된다. 국제 표기는 구조화 데이터에서 쓴다. */
  phone: '090-6792-5091',
  phoneIntl: '+81-90-6792-5091',
  /**
   * 구글 지도. 주소 문자열로 검색하면 이름 없는 핀만 찍힌다 — 업체명으로 검색해야
   * 등록된 비즈니스 정보(사진·전화·웹사이트)가 카드로 열린다. 모든 페이지가 이 두 값을 쓴다.
   * place 는 사용자가 지도에서 직접 공유한 업체 링크(2026-08-11)다.
   */
  map: {
    place: 'https://share.google/rLFyycYdU4fvFDxcG',
    embed: `https://www.google.com/maps?q=${encodeURIComponent(
      'usherinmaking 1868 Toguchi Kitanakagusuku Okinawa 901-2302',
    )}&output=embed`,
  },
  /** 나하공항 기준 소요시간. 근거가 없어 지어내지 않는다. */
  fromAirport: TBC,
  languages: {
    ja: '日本語 ・ 한국어 ・ English',
    en: 'Japanese, Korean and English',
    ko: '일본어 · 한국어 · 영어',
  } satisfies L10n,
};

/** 네이버 블로그 안내는 한국어 페이지에만 노출한다. */
export const NAVER_BLOG_NOTICE_LOCALE: Locale = 'ko';
