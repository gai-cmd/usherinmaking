import type { Locale } from '@/lib/i18n';
import type { WorkImage } from '@/lib/work-image';

/**
 * 홈 본문 카피. ja / en / ko는 번역이 아니라 각각 독립된 본문이므로
 * 로케일별 디자인 카드에서 그대로 옮겨 적는다. 가격·플랜 데이터는 @/content/site 가 단일 출처.
 */

type HeroPanel = {
  eyebrow: string;
  /** --ff-heading(SF Pro Display / 산돌고딕)으로 크게 놓이는 한 단어 */
  display: string;
  lines: [string, string];
  cta: string;
  alt: string;
};

type FaqItem = { q: string; a: string };

type HomeCopy = {
  meta: { title: string; description: string };
  hero: { location: HeroPanel; studio: HeroPanel };
  /** h1은 줄바꿈 단위로 끊어 카드와 같은 리듬을 만든다 */
  lead: { headline: string[]; sub: string[] };
  studioPlans: {
    label: string;
    title: string;
    aside: string;
    optionLabel: string;
    optionNote: string;
    note: string;
    detail: string;
  };
  sets: { label: string; title: string; lead: string; cta: string };
  locationPlans: {
    label: string;
    title: string;
    lead: string;
    aside: string;
    notesLabel: string;
    anniversaryLabel: string;
    detail: string;
  };
  works: {
    label: string;
    title: string;
    lead: string;
    viewAll: string;
  };
  photographer: { label: string; name: string; body: string[]; cta: string; alt: string };
  faq: { label: string; title: string; items: FaqItem[] };
  sticky: { plan: string; contact: string };
};

export const HOME: Record<Locale, HomeCopy> = {
  ja: {
    meta: {
      title: '沖縄のロケーションフォト ・ スタジオウェディングフォト',
      description:
        'usherinmaking は、沖縄でロケーションフォトとスタジオウェディングフォトを撮影する、韓国人女性カメラマンのフォトスタジオです。前撮り・セルフウェディング・マタニティ・記念日・家族写真。',
    },
    hero: {
      location: {
        eyebrow: 'OUTDOOR',
        display: 'Location',
        lines: ['海と風のとおる場所で、', '二人だけの一日を。'],
        cta: 'VIEW LOCATION',
        alt: '沖縄のロケーションフォト、晴れの日',
      },
      studio: {
        eyebrow: 'INDOOR ・ NEW',
        display: 'Studio',
        lines: ['白い壁とアーチ窓。', '光が長くとどまる家で。'],
        cta: 'VIEW STUDIO',
        alt: '沖縄のスタジオ、アーチ窓と自然光',
      },
    },
    lead: {
      headline: [
        'usherinmaking は、沖縄でロケーションフォトと',
        'スタジオウェディングフォトを撮影する、',
        '韓国人女性カメラマンのフォトスタジオです。',
      ],
      sub: [
        '前撮り ・ セルフウェディング ・ マタニティ ・ 記念日 ・ 家族写真。',
        '韓流スタイルのやわらかな仕上げで、長く手もとに残る一枚に。',
      ],
    },
    studioPlans: {
      label: 'PLAN',
      title: 'スタジオプラン',
      aside: 'MONITOR PRICE',
      optionLabel: 'OPTION ( PLAN 01 / 02 共通 )',
      optionNote: 'PLAN 03 / 04 のオプションは詳細ページに掲載',
      note: 'プランに含まれるもの・カット数・所要時間・追加料金の条件は、詳細ページでご確認ください。',
      detail: 'PLAN & OPTION 詳細 →',
    },
    sets: {
      label: 'STUDIO',
      title: 'Four Sets',
      lead: '一度の撮影で、四つの光をめぐりながら撮影します。',
      cta: 'VIEW STUDIO →',
    },
    locationPlans: {
      label: 'PLAN',
      title: 'ロケーションプラン',
      lead: '沖縄の屋外ロケーション撮影（前撮り・後撮り）。撮影場所の数と時間帯でお選びください。',
      aside: 'WEDDING PHOTO ・ FROM ¥76,000',
      notesLabel: 'OPTION ・ ご注意',
      anniversaryLabel: '記念写真 ・ 家族 / カップル / マタニティ / 七五三',
      detail: 'LOCATION PLAN 詳細 →',
    },
    works: {
      label: 'LOCATION',
      title: '最近の作品',
      lead: 'Instagram の投稿から、掲載を選んだ作品を最新順に。',
      viewAll: 'VIEW ALL LOCATION',
    },
    photographer: {
      label: 'PHOTOGRAPHER',
      name: 'usherinmaking',
      body: [
        '沖縄で活動している、韓国人女性カメラマンです。',
        '女性らしいルックの演出は、女性にお任せください。',
      ],
      cta: 'ABOUT ME',
      alt: 'アーチの向こうのドレスルーム',
    },
    faq: {
      label: 'FAQ',
      title: 'よくあるご質問',
      items: [
        {
          q: 'スタジオとロケーション、選べますか？',
          a: 'はい。スタジオ撮影と屋外のロケーション撮影は、それぞれ独立したプランとしてお選びいただけます。PLAN 02 では、スタジオと屋外を一日で撮影します。',
        },
        {
          q: '料金はいくらからですか？',
          a: 'スタジオ ウェディングフォトは ¥99,000 から、ロケーション ウェディングフォトは ¥76,000（税込）からです。',
        },
        { q: '駐車場はありますか？', a: 'スタジオに 2台分の駐車場があります。' },
        {
          q: '日本語以外でも相談できますか？',
          a: '日本語 ・ 韓国語 ・ 英語でご相談いただけます。',
        },
      ],
    },
    sticky: { plan: 'VIEW PLAN', contact: 'CONTACT' },
  },

  en: {
    meta: {
      title: 'Okinawa wedding photography — studio and outdoors',
      description:
        'usherinmaking is a photo studio in Okinawa run by a Korean female photographer, offering outdoor location sessions and indoor studio wedding photography. Pre-wedding, self-wedding, maternity, anniversary and family portraits.',
    },
    hero: {
      location: {
        eyebrow: 'OUTDOOR',
        display: 'Location',
        lines: ['Where the sea meets the light —', 'photographed close to where you’re staying.'],
        cta: 'VIEW LOCATION',
        alt: 'Outdoor wedding photo session in Okinawa',
      },
      studio: {
        eyebrow: 'INDOOR · NEW',
        display: 'Studio',
        lines: ['White walls and an arched window —', 'a house where the light stays a while.'],
        cta: 'VIEW STUDIO',
        alt: 'Indoor wedding photo studio in Okinawa',
      },
    },
    lead: {
      headline: [
        'usherinmaking is a photo studio in Okinawa run by a Korean female photographer,',
        'offering outdoor location sessions and indoor studio wedding photography.',
      ],
      sub: [
        'Pre-wedding · self-wedding · maternity · anniversary · family portraits.',
        'Photographed in a soft Korean style — and we’re happy to talk in English, Japanese or Korean.',
      ],
    },
    studioPlans: {
      label: 'STUDIO PLANS',
      title: 'Indoor sessions',
      aside: 'MONITOR PRICE',
      optionLabel: 'ADD-ONS ( PLAN 01 / 02 )',
      optionNote: 'Add-ons for PLAN 03 and 04 are listed on the plans page',
      note: 'Full inclusions, session length and add-on conditions are listed on the plans page.',
      detail: 'PLANS & ADD-ONS →',
    },
    sets: {
      label: 'STUDIO',
      title: 'Four sets',
      lead: 'Move between all four sets in a single session',
      cta: 'VIEW STUDIO →',
    },
    locationPlans: {
      label: 'LOCATION PLANS',
      title: 'Outdoor sessions',
      lead: 'Wedding photography and anniversary portraits, photographed outdoors in Okinawa.',
      aside: 'FROM ¥76,000',
      notesLabel: 'ADD-ONS AND NOTES',
      anniversaryLabel: 'Anniversary portraits · family, couple, maternity',
      detail: 'LOCATION PLANS →',
    },
    works: {
      label: 'LOCATION · FROM INSTAGRAM',
      title: 'Recent works',
      lead: 'A selection from our Instagram posts, newest first, hosted here on our own site.',
      viewAll: 'VIEW ALL WORKS',
    },
    photographer: {
      label: 'PHOTOGRAPHER',
      name: 'usherinmaking',
      body: [
        'A Korean woman photographing in Okinawa.',
        'Indoors or outdoors, the same person is behind the camera from start to finish — and we can talk in English, Japanese or Korean.',
      ],
      cta: 'ABOUT ME',
      alt: 'Studio arch and dressing room',
    },
    faq: {
      label: 'FAQ',
      title: 'Before you ask',
      items: [
        {
          q: 'How much does a session cost?',
          a: 'Studio wedding sessions start at ¥99,000, and outdoor location sessions at ¥76,000 (tax included).',
        },
        {
          q: 'Can I book online?',
          a: 'No — there’s no automatic booking. Send us your dates through the form or on Instagram and we’ll confirm availability.',
        },
        {
          q: 'Is a dress included?',
          a: 'Studio plans include 1–2 dresses. For location sessions, dress rental starts in the ¥10,000 range.',
        },
        {
          q: 'What happens if it rains?',
          a: 'We still shoot in the rain, and we’ll try to reschedule within your stay whenever possible.',
        },
        { q: 'Is there parking?', a: 'Yes — the studio has parking for 2 cars.' },
        { q: 'Which languages do you speak?', a: 'English, Japanese and Korean.' },
      ],
    },
    sticky: { plan: 'VIEW PLANS', contact: 'CONTACT' },
  },

  ko: {
    meta: {
      title: '오키나와 웨딩 스냅 · 스튜디오 촬영',
      description:
        '어셔린메이킹(usherinmaking)은 2014년부터 오키나와에서 스냅 촬영을 이어온 한국인 여성 사진작가의 스튜디오입니다. 바다 앞 로케이션 촬영과 흰 벽의 스튜디오 촬영을 모두 진행하며, 상담은 카카오톡으로 편하게 하실 수 있습니다.',
    },
    hero: {
      location: {
        eyebrow: 'OUTDOOR',
        display: 'Location',
        lines: ['바다와 바람이 지나는 자리에서,', '그날의 빛 그대로 담습니다'],
        cta: '로케이션 보기',
        alt: '오키나와 야외 로케이션 웨딩 촬영',
      },
      studio: {
        eyebrow: 'INDOOR · NEW',
        display: 'Studio',
        lines: ['흰 벽과 아치 창,', '빛이 오래 머무는 집'],
        cta: '스튜디오 보기',
        alt: '오키나와 실내 웨딩 스튜디오',
      },
    },
    lead: {
      // 한 줄 = 한 문장. 문장 중간에서 줄을 자르면 조각으로 읽힌다 —
      // keep-all + 풀폭이라 넘치면 어절 단위로 자연 줄바꿈된다.
      headline: [
        '어셔린메이킹은 2014년부터 동양의 하와이라 불리는 오키나와에서 스냅 촬영을 이어온 한국인 여성 사진작가의 스튜디오입니다.',
        '바다 앞 로케이션 촬영과 흰 벽의 스튜디오 촬영을 모두 진행합니다.',
      ],
      sub: [
        '웨딩 스냅 · 셀프 웨딩 · 만삭 · 기념일 · 가족사진',
        '오래되어도 가치 있는 추억을 담아드립니다. 상담은 카카오톡이 가장 빠릅니다.',
      ],
    },
    studioPlans: {
      label: 'STUDIO PLAN',
      title: '스튜디오 플랜',
      aside: '모니터 가격 · 엔화 표기',
      optionLabel: '옵션 ( PLAN 01 / 02 공통 )',
      optionNote: 'PLAN 03 / 04 옵션은 요금 페이지에 있습니다',
      note: '플랜별 포함 내역과 옵션 조건은 요금 페이지에서 확인하실 수 있습니다.',
      detail: '요금 · 옵션 자세히 →',
    },
    sets: {
      label: 'STUDIO',
      title: '4개의 세트',
      lead: '한 번의 촬영으로 네 개의 공간을 오가며 담습니다',
      cta: '스튜디오 보기 →',
    },
    locationPlans: {
      label: 'LOCATION PLAN',
      title: '로케이션 플랜',
      lead: '웨딩 스냅과 기념사진. 장소는 그날의 날씨와 빛을 보고 함께 정합니다.',
      aside: 'FROM ¥76,000',
      notesLabel: '옵션 · 안내',
      anniversaryLabel: '기념사진 · 가족 / 커플 / 만삭',
      detail: '로케이션 요금 자세히 →',
    },
    works: {
      label: 'GALLERY · 인스타그램에서 선별',
      title: '최근 작품',
      lead: '인스타그램에 올린 사진 가운데 보여드리고 싶은 작품만 골라 이곳에 담았습니다.',
      viewAll: '작품 전체 보기',
    },
    photographer: {
      label: 'PHOTOGRAPHER',
      name: 'usherinmaking',
      body: [
        '오키나와에서 사진을 찍는 한국인 여성 작가입니다.',
        '실내든 야외든 처음부터 끝까지 제가 직접 촬영하고, 상담도 한국어로 편하게 나눕니다.',
      ],
      cta: '작가 소개',
      alt: '스튜디오 아치와 드레스룸',
    },
    faq: {
      label: 'FAQ',
      title: '자주 묻는 질문',
      items: [
        {
          q: '촬영 비용은 얼마부터인가요?',
          a: '스튜디오 웨딩 촬영은 ¥99,000부터, 야외 로케이션 촬영은 ¥76,000(세금 포함)부터입니다.',
        },
        {
          q: '온라인으로 바로 예약할 수 있나요?',
          a: '자동 예약 기능은 따로 없습니다. 카카오톡이나 문의 폼으로 희망 날짜를 보내주시면 일정을 확인해 안내드립니다.',
        },
        {
          q: '드레스가 포함되나요?',
          a: '스튜디오 플랜에는 드레스 1~2벌이 포함됩니다. 로케이션 촬영은 ¥10,000대부터 대여하실 수 있습니다.',
        },
        {
          q: '비가 오면 어떻게 되나요?',
          a: '비가 와도 촬영은 진행합니다. 머무시는 동안 옮길 수 있는 날짜가 있으면 최대한 조정해 드립니다.',
        },
        { q: '주차가 되나요?', a: '스튜디오에 2대까지 주차하실 수 있습니다.' },
        {
          q: '한국어로 상담할 수 있나요?',
          a: '네, 카카오톡으로 편하게 문의해 주세요. 문의 폼으로 남기셔도 한국어로 답변드립니다.',
        },
      ],
    },
    sticky: { plan: '요금 보기', contact: '문의하기' },
  },
};

/* ---------------- 히어로 게이트 이미지 ---------------- */

export const HERO_IMAGE = {
  location: '/images/up/0f62c6d466bcea42.jpg',
  studio: '/images/studio/IMG_0766.png',
} as const;

/* ---------------- 최근 작품 (자사 도메인에서 직접 서빙 — 인스타 임베드 금지) ----------------
 *
 * 이 배열은 이제 "폴백"이다 — 관리자 사진 풀(PUBLISHED)이 그리드 정원을 채우면
 * @/server/works 가 그쪽을 쓰고, 못 채우면 이 배열이 그대로 나간다. 지우지 마라. */

export type { WorkImage } from '@/lib/work-image';

export const RECENT_WORKS: WorkImage[] = [
  {
    src: '/images/up/1440241c37bf4fc2.jpg',
    alt: {
      ja: '沖縄のセルフウェディングフォト',
      en: 'Self-wedding photo in Okinawa',
      ko: '오키나와 셀프 웨딩 스냅',
    },
  },
  {
    src: '/images/up/441db675bf47ff78.jpg',
    alt: {
      ja: '沖縄のカップルフォト',
      en: 'Couple session in Okinawa',
      ko: '오키나와 커플 스냅',
    },
  },
  {
    src: '/images/up/934c72ebb62d141a.jpg',
    alt: {
      ja: '沖縄の家族写真',
      en: 'Family portrait in Okinawa',
      ko: '오키나와 가족사진',
    },
  },
  {
    src: '/images/up/c0aa505600aa3595.jpg',
    alt: {
      ja: '沖縄のロケーションフォト',
      en: 'Autumn session in Okinawa',
      ko: '오키나와 가을 촬영',
    },
  },
  {
    src: '/images/up/ddf6db884e95f47c.jpg',
    alt: {
      ja: '記念日の家族写真',
      en: 'First birthday family celebration',
      ko: '백일 · 돌 가족 촬영',
    },
  },
];

/* ---------------- 네이버 블로그 안내 (한국어 페이지 전용) ---------------- */

export const NAVER_NOTICE = {
  label: 'NAVER BLOG',
  title: '촬영 전, 궁금한 마음까지',
  body: [
    '촬영 후기와 준비 과정의 이야기는 네이버 블로그에 한국어로 적고 있습니다. 촬영 당일 하루가 어떻게 흘러가는지, 무엇을 챙기면 좋은지 미리 살펴보세요.',
    '블로그에 올린 글은 사이트로도 자동으로 가져와, 보여드릴 글만 골라 싣습니다.',
  ],
  cta: '촬영후기 보기',
  cards: [
    {
      src: '/images/studio/IMG_0766.png',
      title: '스튜디오 촬영, 이렇게 진행돼요',
      alt: '스튜디오 촬영 후기',
    },
    {
      src: '/images/up/1440241c37bf4fc2.jpg',
      title: '오키나와 셀프 웨딩 준비물',
      alt: '셀프 웨딩 후기',
    },
  ],
} as const;
