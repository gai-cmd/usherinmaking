import type { Locale } from '@/lib/i18n';

type L10n = Record<Locale, string>;
type L10nLines = Record<Locale, string[]>;

/**
 * STUDIO 페이지 전용 카피. 세 언어는 각각 독립된 본문이므로 번역하지 않고
 * 디자인 카드(pages-a-1a / pages-a-en-1a / pages-a-ko-sub-1a)의 확정 카피를 그대로 옮긴다.
 * 요금·세트 이미지 같은 사업 데이터는 @/content/site 에서 가져온다.
 */

export const META = {
  title: {
    ja: 'STUDIO ・ 沖縄のスタジオ ウェディングフォト',
    en: 'STUDIO — indoor wedding photography in Okinawa',
    ko: '스튜디오 · 오키나와 실내 웨딩 촬영',
  } satisfies L10n,
  description: {
    ja: '白いスタッコの壁とアーチ窓、ヘリンボーンの床。沖縄の一軒家スタジオで、ヘアメイクからドレスまで整えて撮影します。4つのセット、撮影の流れ、スタジオプランのご案内。',
    en: 'A house in Okinawa with white plaster walls, an arched window and a herringbone floor. Four sets, how a session runs, and the studio plans.',
    ko: '흰 스타코 벽과 아치 창, 헤링본 바닥. 오키나와의 단독주택 스튜디오입니다. 4개의 세트와 촬영 당일 스케줄, 스튜디오 플랜을 안내합니다.',
  } satisfies L10n,
};

export const HERO = {
  /** 로케일과 무관한 브랜드 표기 */
  eyebrow: 'INDOOR',
  title: 'Studio',
  image: '/images/studio/IMG_0766.png',
  alt: {
    ja: '沖縄のスタジオ、アーチ窓と自然光',
    en: 'Wedding photo studio in Okinawa with an arched window',
    ko: '오키나와 웨딩 스튜디오, 아치 창과 자연광',
  } satisfies L10n,
  /** 한국어 카드에만 있는 히어로 한 줄 */
  sub: { ja: '', en: '', ko: '빛이 오래 머무는 집에서' } satisfies L10n,
};

/** 정의형 리드문 — AEO 핵심 표면이므로 반드시 실제 텍스트로 렌더한다 */
export const LEAD: L10nLines = {
  ja: [
    '白いスタッコの壁と、アーチ窓と、ヘリンボーンの床。',
    '沖縄の光がそのまま入る一軒家のスタジオで、',
    'ヘアメイクからドレスまで、ここで整えて撮影します。',
  ],
  en: [
    'A house in Okinawa with white plaster walls, an arched window',
    'and a herringbone floor — hair, make-up and dresses, all in one place.',
  ],
  // 일본어는 세 요소를 と、で 나열해 첫 줄이 길다. 한국어는 조사를 생략해
  // 압축되며 혼자 짧아졌다. 아치 창 세트에 이미 적힌 샹들리에를 더해 맞춘다.
  ko: [
    '흰 스타코 벽과 아치 창, 헤링본 바닥과 샹들리에.',
    '오키나와의 빛이 그대로 들어오는 단독주택 스튜디오에서,',
    '헤어메이크업부터 드레스까지 이곳에서 준비해 촬영합니다.',
  ],
};

export const LEAD_NOTE: L10nLines = {
  ja: [
    'スタジオ ウェディングフォト ・ ウェディング風 マタニティフォト ・ 記念日 / 家族 / プロフィール撮影',
    '所要時間 50分 〜 4.5時間 ・ 駐車場 2台',
  ],
  en: [
    'Studio wedding photography · wedding-style maternity · anniversary, family and profile portraits.',
    'Sessions run from 50 minutes to 4.5 hours. Parking for 2 cars.',
  ],
  ko: [
    '스튜디오 웨딩 촬영 · 웨딩풍 만삭 촬영 · 기념일 / 가족 / 프로필 촬영',
    '촬영 시간 50분 ~ 4시간 30분 · 주차 2대',
  ],
};

export const SETS = {
  title: { ja: '4つのセット', en: 'Four sets', ko: '4개의 세트' } satisfies L10n,
  lead: {
    ja: '一度の撮影で、いくつかの部屋を行き来できます',
    en: 'Move between all four sets in a single session',
    ko: '한 번의 촬영으로 네 개의 공간을 오가며 담습니다',
  } satisfies L10n,
};

/**
 * 세트별 카피. 이미지와 순서는 STUDIO_SETS(@/content/site)에서 가져오고,
 * 제목·설명은 카드 확정 카피를 쓴다(EN 제목이 site.ts와 표기가 달라 카드를 우선한다).
 */
export const SET_COPY: Record<string, { title: L10n; body: L10n; alt: L10n }> = {
  'arch-window': {
    title: { ja: 'アーチ窓 ・ 自然光', en: 'Arched window', ko: '아치 창 · 자연광' },
    body: {
      ja: 'アーチ型の窓、ヘリンボーンの床、シャンデリア。午前の光がいちばん柔らかい部屋です。',
      en: 'Natural light, herringbone floor and a chandelier — the softest light in the house.',
      ko: '아치형 창과 헤링본 바닥, 샹들리에. 커튼을 지나온 빛이 가장 부드럽게 도는 방입니다.',
    },
    alt: {
      ja: 'アーチ窓・自然光のセット',
      en: 'Arched window set with natural light',
      ko: '아치 창 자연광 세트',
    },
  },
  'dress-room': {
    title: { ja: 'ドレスルーム', en: 'Dress room', ko: '드레스룸' },
    body: {
      ja: '白から色ドレスまで。ベールやアクセサリーもここでお選びいただけます。',
      en: 'White and coloured gowns, veils and accessories, chosen here on your session day.',
      ko: '흰 드레스부터 컬러 드레스까지. 베일과 액세서리도 이곳에서 함께 고릅니다.',
    },
    alt: {
      ja: 'ドレスルーム',
      en: 'Dress room with wedding gowns and veils',
      ko: '드레스룸',
    },
  },
  'vintage-corner': {
    title: { ja: 'ヴィンテージ コーナー', en: 'Vintage corner', ko: '빈티지 코너' },
    body: {
      ja: 'チークの家具とレースのカーテン。落ち着いたトーンの一枚に。',
      en: 'Teak furniture and lace curtains for a calmer, warmer tone.',
      ko: '티크 가구와 레이스 커튼. 차분하고 따뜻한 톤으로 남습니다.',
    },
    alt: {
      ja: 'ヴィンテージコーナー',
      en: 'Vintage corner with teak furniture and lace',
      ko: '빈티지 코너',
    },
  },
  'monotone-corner': {
    title: { ja: 'モノトーン コーナー', en: 'Monotone corner', ko: '모노톤 코너' },
    body: {
      ja: '黒のワイヤーチェアとグリーン。少しモードな雰囲気に。',
      en: 'Black and green — a little more editorial.',
      ko: '블랙과 초록. 조금 더 담백한 화면을 원할 때.',
    },
    alt: {
      ja: 'モノトーンコーナー',
      en: 'Monotone corner with a black wire chair',
      ko: '모노톤 코너',
    },
  },
};

export const FLOW = {
  title: {
    ja: '撮影の流れ',
    en: 'How a session runs',
    ko: '촬영 당일 스케줄',
  } satisfies L10n,
  steps: [
    {
      no: '01',
      title: { ja: 'ご来店', en: 'Arrival', ko: '도착' } satisfies L10n,
      note: { ja: '駐車場 2台', en: 'Parking for 2 cars', ko: '주차 2대' } satisfies L10n,
    },
    {
      no: '02',
      title: { ja: 'ヘアメイク', en: 'Hair & make-up', ko: '헤어메이크업' } satisfies L10n,
      note: {
        ja: '新婦フル / 新郎シンプル',
        en: 'Full for the bride, simple for the groom',
        ko: '신부 풀 / 신랑 간단',
      } satisfies L10n,
    },
    {
      no: '03',
      title: { ja: 'ドレス選び', en: 'Choosing a dress', ko: '드레스 고르기' } satisfies L10n,
      note: {
        ja: 'プランにより 1〜2着',
        en: '1 or 2 depending on the plan',
        ko: '플랜에 따라 1~2벌',
      } satisfies L10n,
    },
    {
      no: '04',
      title: { ja: '撮影', en: 'Shooting', ko: '촬영' } satisfies L10n,
      note: {
        ja: 'セットを移動しながら',
        en: 'Moving between the sets',
        ko: '공간을 옮겨가며',
      } satisfies L10n,
    },
    {
      no: '05',
      title: { ja: 'セレクト', en: 'Selection', ko: '셀렉' } satisfies L10n,
      note: {
        ja: 'その場でご確認',
        en: 'Reviewed together on your session day',
        ko: '그 자리에서 함께',
      } satisfies L10n,
    },
    {
      no: '06',
      title: { ja: '韓国風リタッチ', en: 'Retouching', ko: '보정' } satisfies L10n,
      note: {
        ja: '後日データでお渡し',
        en: 'Delivered as files afterwards',
        ko: '촬영 후 데이터로 보내드립니다',
      } satisfies L10n,
    },
  ],
};

/**
 * 스튜디오 플랜 옵션 절의 제목. 행 자체는 site.ts STUDIO_PLAN_OPTIONS 가 갖는다 —
 * 금액이 두 곳에 적히면 한쪽만 고쳐진다.
 */
export const OPTION = {
  label: { ja: 'OPTION', en: 'ADD-ONS', ko: 'OPTION' } satisfies L10n,
  title: {
    ja: 'オプション',
    en: 'Add-ons',
    ko: '옵션',
  } satisfies L10n,
  lead: {
    ja: 'プランごとに追加できるものと、その料金です。',
    en: 'What each plan can add, and what it costs.',
    ko: '플랜별로 추가할 수 있는 항목과 요금입니다.',
  } satisfies L10n,
};

export const PLANS = {
  label: {
    ja: 'PLAN ・ モニター価格',
    en: 'PLANS · MONITOR PRICE',
    ko: 'PLAN · 모니터 가격',
  } satisfies L10n,
  title: { ja: 'スタジオプラン', en: 'Studio plans', ko: '스튜디오 플랜' } satisfies L10n,
  link: {
    ja: 'PLAN & OPTION 詳細 →',
    en: 'PLANS & ADD-ONS →',
    ko: '플랜 · 옵션 자세히 →',
  } satisfies L10n,
};

export const ACCESS = {
  title: { ja: 'アクセス', en: 'Getting here', ko: '찾아오시는 길' } satisfies L10n,
  image: '/images/studio/IMG_0769.png',
  alt: { ja: 'スタジオの外観', en: 'The studio', ko: '스튜디오 대표 이미지' } satisfies L10n,
  labels: {
    address: { ja: '住所', en: 'Address', ko: '주소' } satisfies L10n,
    parking: { ja: '駐車場', en: 'Parking', ko: '주차' } satisfies L10n,
    landmark: { ja: '目印', en: 'Landmark', ko: '찾는 법' } satisfies L10n,
    languages: { ja: '言語', en: 'Languages', ko: '언어' } satisfies L10n,
  },
  /** 시(市) 이하 주소는 아직 받지 못했다 — 뒤에 TBC 토큰을 붙여 렌더한다 */
  region: { ja: '沖縄県', en: 'Okinawa', ko: '오키나와현' } satisfies L10n,
  parking: { ja: '2台', en: '2 cars', ko: '2대' } satisfies L10n,
  landmark: {
    ja: '入口のウェルカムサイン',
    en: 'A white house with an arched entrance',
    ko: '흰 벽에 아치가 있는 단독주택 건물입니다',
  } satisfies L10n,
  languages: {
    ja: '日本語 ・ 한국어 ・ English',
    en: 'English · Japanese · Korean',
    ko: '한국어 · 일본어 · 영어',
  } satisfies L10n,
  /** 주소가 확정되기 전에는 지도를 띄우지 않고 이 안내를 대신 보여준다 */
  mapPending: {
    ja: '住所が確定しだい、地図を掲載します。',
    en: 'A map will appear here once the address is confirmed.',
    ko: '주소가 확정되면 지도를 표시합니다.',
  } satisfies L10n,
  mapTitle: {
    ja: 'スタジオの地図',
    en: 'Map to the studio',
    ko: '스튜디오 위치 지도',
  } satisfies L10n,
  mapOpen: {
    ja: 'Google マップで開く',
    en: 'OPEN IN GOOGLE MAPS',
    ko: 'Google 지도에서 열기',
  } satisfies L10n,
};

export const WORKS = {
  title: {
    ja: 'スタジオの作品',
    en: 'Studio works',
    ko: '스튜디오 작품',
  } satisfies L10n,
  viewAll: { ja: 'VIEW ALL', en: 'VIEW ALL', ko: '작품 전체 보기' } satisfies L10n,
  /** 실제 파일만 나열한다 */
  images: [
    '/images/studio/IMG_0769.png',
    '/images/studio/IMG_0698.png',
    '/images/studio/IMG_0766.png',
    '/images/studio/IMG_0747.png',
    '/images/studio/IMG_0690.png',
  ],
  alt: {
    ja: 'スタジオでの撮影作品',
    en: 'A photograph made in the studio',
    ko: '스튜디오 촬영 작품',
  } satisfies L10n,
};
