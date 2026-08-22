import type { Locale } from '@/lib/i18n';

type L10n = Record<Locale, string>;
type L10nLines = Record<Locale, string[]>;

/**
 * LOCATION 페이지 전용 카피. 디자인 카드(pages-a-1b / pages-a-en-1b / pages-a-ko-sub-1b)의
 * 확정 카피를 로케일별로 그대로 옮긴다. 요금은 @/content/site 의 LOCATION_PLANS 를 쓴다.
 * LOCATION 은 지역이 아니라 촬영 종류(WEDDING / ANNIVERSARY)로 나눈다.
 */

/**
 * 한국어에서 이 페이지는 하위 페이지가 아니라 사이트의 대문이다(i18n HOME_LOCALES).
 * 그래서 ko 제목·설명은 절(節) 소개가 아니라 브랜드 소개로 쓴다 — 검색 결과와
 * 카카오톡 링크 미리보기에 그대로 나가는 문장이라 여기가 첫인상이 된다.
 */
export const META = {
  title: {
    ja: 'LOCATION ・ 沖縄の屋外ロケーションフォト',
    en: 'LOCATION — outdoor photography in Okinawa',
    ko: '오키나와 웨딩 스냅 · 가족 촬영',
  } satisfies L10n,
  description: {
    ja: '沖縄の屋外で撮るウェディングフォトと記念写真。撮影当日の光と天気を見ながら場所を決めます。撮影の種類、月別アーカイブ、ロケーションプランのご案内。',
    en: 'Wedding photography and anniversary portraits made outdoors in Okinawa. Two categories, a monthly archive and the location plans.',
    ko: '어셔린메이킹은 2014년부터 오키나와에서 스냅 촬영을 이어온 한국인 여성 사진작가입니다. 에메랄드 바다와 오키나와의 자연 속에서 웨딩 · 커플 · 가족 촬영을 진행하며, 상담은 카카오톡으로 편하게 하실 수 있습니다.',
  } satisfies L10n,
};

export const HERO = {
  eyebrow: 'OUTDOOR',
  title: 'Location',
  image: '/images/up/0f62c6d466bcea42.jpg',
  alt: {
    ja: '沖縄のロケーションフォト',
    en: 'Outdoor wedding photo session in Okinawa',
    ko: '오키나와 야외 로케이션 웨딩 촬영',
  } satisfies L10n,
  sub: { ja: '', en: '', ko: '바다와 바람이 지나는 자리에서' } satisfies L10n,
};

/** 정의형 리드문 — AEO 핵심 표면 */
export const LEAD: L10nLines = {
  ja: [
    'ウェディングフォトと、記念写真。',
    '撮影当日の光と天気を見ながら場所を選ぶ、',
    '沖縄の屋外ロケーション撮影です。',
  ],
  en: [
    'Wedding photography and anniversary portraits,',
    'made outdoors in the light of your session day.',
  ],
  // 한국어에서 이 페이지는 하위 페이지가 아니라 **메인**이다(`/ko` 는 여기로 넘어온다).
  // 그래서 첫 줄이 촬영 소개가 아니라 브랜드 소개여야 한다 — 원문 사이트의 인사말을 쓴다.
  ko: [
    '어셔린메이킹은 2014년부터 동양의 하와이라 불리는 오키나와에서 스냅 촬영을 이어온 한국인 여성 사진작가입니다.',
    '에메랄드 산호 바다와 보타니컬한 오키나와 섬의 아름다움 속에서 웨딩 · 커플 · 가족 촬영으로 추억을 남겨보세요.',
  ],
};

export const LEAD_NOTE: L10nLines = {
  ja: [
    '前撮り ・ 後撮り ・ 記念日 / 家族 / マタニティ / 七五三',
    '撮影時間 1時間 〜 3時間半 ・ 1〜3ヶ所 ・ 移動時間（10〜15分）込み',
  ],
  en: [
    'Sessions run from 1 to 3.5 hours across 1 to 3 spots, travelling time (10–15 minutes) included.',
    'We suggest the spots based on where you are staying and the weather on your session day.',
  ],
  // 촬영 시간·장소 수는 한국 고객 상품 기준이다 (스탠다드 1시간/1곳 ~ 에프터풀 4시간/3곳).
  // 일본어판 플랜(1~3시간 30분)을 옮겨 오면 실제 상품과 어긋난다.
  ko: [
    '웨딩 스냅 · 셀프 웨딩 · 만삭 · 기념일 · 가족사진',
    '촬영 1시간 ~ 4시간 · 1~3개 장소 · 탈착의 시간과 이동 시간 포함',
    '오래되어도 가치 있는 추억을 담아드립니다. 상담은 카카오톡이 가장 빠릅니다.',
  ],
};

export const CATEGORY = {
  title: {
    ja: '撮影の種類から',
    en: 'Two categories',
    ko: '촬영 종류',
  } satisfies L10n,
  lead: {
    ja: '場所は撮影当日の天気と光を見ながら、一緒に決めます',
    en: '',
    ko: '유명 관광지보다는 한적한 시크릿 스팟 위주로 안내하며, 정확한 장소는 촬영일에 임박해 날씨를 보고 함께 정합니다.',
  } satisfies L10n,
};

/** 카테고리 카드 2개 — 갤러리 경로 슬러그와 1:1로 대응한다 */
export const CATEGORIES = [
  {
    slug: 'wedding',
    eyebrow: 'WEDDING',
    image: '/images/up/1440241c37bf4fc2.jpg',
    alt: {
      ja: '沖縄のウェディングフォト・前撮り',
      en: 'Outdoor pre-wedding session in Okinawa',
      ko: '오키나와 웨딩 스냅',
    } satisfies L10n,
    title: {
      ja: 'ウェディングフォト',
      en: 'Wedding photography',
      ko: '웨딩 스냅',
    } satisfies L10n,
    body: {
      ja: '前撮り ・ 後撮り ・ セルフウェディング。沖縄の屋外で撮影します。衣装・ヘアメイクはオプションでご用意できます。Simple / Basic / Afterfull の3プラン。',
      en: 'Pre-wedding, post-wedding and self-wedding sessions outdoors. Clothing and hair & make-up can be added. Simple / Basic / Afterfull.',
      // 한국 고객 상품은 베이직 · 에프터풀 두 가지다 (JA/EN 의 Simple 3종 구성과 다르다).
      ko: '본식 전 웨딩 촬영 · 결혼 후 리마인드 웨딩 · 셀프 웨딩. 의상과 헤어메이크업은 옵션으로 준비해 드립니다. 플랜은 베이직 88만원 / 에프터풀 110만원 두 가지입니다.',
    } satisfies L10n,
    link: {
      ja: 'ウェディングを見る',
      en: 'SEE WEDDING WORK',
      ko: '웨딩 작품 보기',
    } satisfies L10n,
  },
  {
    slug: 'anniversary',
    eyebrow: 'ANNIVERSARY',
    image: '/images/up/934c72ebb62d141a.jpg',
    alt: {
      ja: '沖縄の記念写真・家族写真',
      en: 'Family portrait session in Okinawa',
      ko: '오키나와 가족사진',
    } satisfies L10n,
    title: {
      ja: '記念写真',
      en: 'Anniversary portraits',
      ko: '기념사진',
    } satisfies L10n,
    body: {
      ja: '家族 ・ 七五三 ・ マタニティ ・ デート ・ 記念日。Standard ¥38,000 / Half ¥60,000 でご案内しています。',
      en: 'Family, 100-day and first-birthday, maternity, couples and birthdays. Standard ¥38,000 / Half ¥60,000.',
      ko: '가족 · 백일 · 돌 · 만삭 · 커플 · 기념일. 스탠다드 30만원 / 업투 50만원.',
    } satisfies L10n,
    link: {
      ja: '記念写真を見る',
      en: 'SEE ANNIVERSARY WORK',
      ko: '기념사진 보기',
    } satisfies L10n,
  },
];

/** 카테고리별 세부 내역 칩 + 각주 */
export const DETAILS = [
  {
    eyebrow: 'WEDDING',
    title: {
      ja: 'ウェディングの内訳',
      en: 'What it covers',
      ko: '이런 촬영이 있어요',
    } satisfies L10n,
    chips: {
      ja: ['前撮り', '後撮り', 'セルフウェディング', 'スタジオ + ロケーション'],
      en: ['Pre-wedding', 'Post-wedding', 'Self-wedding', 'Studio + Location'],
      ko: ['웨딩 촬영 (본식 전)', '리마인드 웨딩 (본식 후)', '셀프 웨딩', '스튜디오 + 로케이션'],
    } satisfies Record<Locale, string[]>,
    note: {
      ja: '撮影データのみのプランです。衣装・ヘアメイクはオプションでご用意できます。',
      en: 'Location plans cover photography only. Clothing and hair & make-up are available as add-ons.',
      ko: '플랜에는 촬영 데이터만 포함됩니다. 신부 드레스 대여(10만원부터)와 헤어메이크업은 옵션으로 추가하실 수 있습니다.',
    } satisfies L10n,
  },
  {
    eyebrow: 'ANNIVERSARY',
    title: {
      ja: '記念写真の内訳',
      en: 'What it covers',
      ko: '이런 날에도',
    } satisfies L10n,
    chips: {
      ja: ['家族', '七五三', 'マタニティ', 'デート', '記念日', 'プロフィール'],
      en: [
        'Family',
        '100-day / first birthday',
        'Maternity',
        'Couples',
        'Birthdays',
        'Profile',
      ],
      ko: ['가족', '백일 · 돌', '만삭', '커플', '기념일', '프로필'],
    } satisfies Record<Locale, string[]>,
    note: {
      ja: '大人2名 + 子供2名まで ・ 追加 1名 ＋¥3,000 ／ 土・日・祝 ＋¥8,000',
      en: 'Up to 2 adults and 2 children · +¥3,000 per extra person · weekends and holidays +¥8,000',
      // 한국 고객 상품에는 인원 추가 요금 항목이 없다 — 의상 관련 제약이 실제 안내 사항이다.
      ko: '의상은 제공하지 않으며, 웨딩 의상 착장은 불가합니다',
    } satisfies L10n,
  },
];

/**
 * 월별 아카이브. 촬영 건수 같은 근거 없는 수치는 넣지 않고,
 * 월과 테마만 갤러리 경로로 연결한다. 슬러그는 `month-01` … `month-12`.
 */
export const ARCHIVE = {
  title: {
    ja: '月別アーカイブ',
    en: 'Monthly archive',
    ko: '월별 아카이브',
  } satisfies L10n,
  lead: {
    ja: '季節ごとの光の違いは、月別のアーカイブからご覧いただけます。',
    en: 'Light changes with the season — browse the monthly archive to see it.',
    ko: '계절마다 빛이 다릅니다. 월별 아카이브에서 그 차이를 살펴보세요.',
  } satisfies L10n,
  themes: [
    {
      slug: 'clear-day',
      label: { ja: '晴れの日', en: 'Sunny days', ko: '맑은 날' } satisfies L10n,
    },
    {
      slug: 'cloudy-day',
      label: { ja: '曇りの日', en: 'Cloudy days', ko: '흐린 날' } satisfies L10n,
    },
    {
      slug: 'cherry-blossom',
      label: { ja: '桜', en: 'Cherry blossom', ko: '벚꽃' } satisfies L10n,
    },
    {
      slug: 'sunset',
      label: { ja: 'サンセット', en: 'Sunset', ko: '노을' } satisfies L10n,
    },
    {
      slug: 'rain',
      label: { ja: '雨天', en: 'Rain', ko: '비 오는 날' } satisfies L10n,
    },
  ],
  /** 월 표기는 로케일별 관용 표기를 따른다 */
  monthLabel: (locale: Locale, month: number): string => {
    if (locale === 'ja') return `${month}月`;
    if (locale === 'ko') return `${month}월`;
    return [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ][month - 1];
  },
};

export const PLANS = {
  title: {
    ja: 'ロケーションプラン',
    en: 'Location plans',
    ko: '로케이션 플랜',
  } satisfies L10n,
  link: {
    ja: 'PLAN & OPTION 詳細 →',
    en: 'PLANS & ADD-ONS →',
    ko: '플랜 · 옵션 자세히 →',
  } satisfies L10n,
};

export const WORKS = {
  label: {
    ja: 'GALLERY ・ FROM INSTAGRAM',
    en: 'GALLERY · FROM INSTAGRAM',
    ko: 'GALLERY · 인스타그램에서 선별',
  } satisfies L10n,
  title: {
    ja: 'ロケーションの作品',
    en: 'Location works',
    ko: '로케이션 작품',
  } satisfies L10n,
  viewAll: {
    ja: 'VIEW ALL LOCATION',
    en: 'VIEW ALL WORKS',
    ko: '작품 전체 보기',
  } satisfies L10n,
  /** public/images/up/ 에 실재하는 파일만 나열한다 */
  images: [
    {
      src: '/images/up/934c72ebb62d141a.jpg',
      alt: {
        ja: '沖縄の家族写真',
        en: 'Family session in Okinawa',
        ko: '오키나와 가족 촬영',
      } satisfies L10n,
    },
    {
      src: '/images/up/ddb78d75fc3e564b.jpg',
      alt: {
        ja: '雨の日のふたりの撮影',
        en: 'Couple session on a rainy day',
        ko: '비 오는 날 커플 촬영',
      } satisfies L10n,
    },
    {
      src: '/images/up/ddf6db884e95f47c.jpg',
      alt: {
        ja: '一歳のお祝いの撮影',
        en: 'First birthday celebration',
        ko: '백일 · 돌 촬영',
      } satisfies L10n,
    },
    {
      src: '/images/up/adba32345d8088a3.jpg',
      alt: {
        ja: '沖縄のウェディングフォト',
        en: 'Wedding photo in Okinawa',
        ko: '오키나와 웨딩 스냅',
      } satisfies L10n,
    },
    {
      src: '/images/up/0f62c6d466bcea42.jpg',
      alt: {
        ja: '晴れた日の撮影',
        en: 'Sunny day session in Okinawa',
        ko: '맑은 날 촬영',
      } satisfies L10n,
    },
  ],
};
