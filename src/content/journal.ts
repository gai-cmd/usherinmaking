import type { Locale } from '@/lib/i18n';

/**
 * 촬영 기록(JOURNAL) 데이터 모듈.
 *
 * 지금 들어 있는 글은 전부 시안에서 온 "샘플 원고"다. 실제 고객 촬영 기록이 아니므로
 * 모든 글에 isSample: true 를 달고 화면에도 배지를 띄운다.
 * 실제 글이 들어오면 isSample 을 생략하기만 하면 배지가 사라진다.
 *
 * 나중에 DB로 옮길 때 그대로 매핑되도록 slug / locale / category / title / body /
 * cover / planCode / publishedAt 를 한 레코드에 담는다.
 */

export type JournalCategory = 'studio' | 'location' | 'dress' | 'tips' | 'anniversary';

export type JournalImage = {
  src: string;
  /** 그 글이 쓰인 언어로 쓴다 */
  alt: string;
};

/** 본문 블록. 시안 상세(5b)의 문단 · 인용 · 2컷 비교를 그대로 표현한다. */
export type JournalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'pair'; images: [JournalImage, JournalImage]; caption: string }
  /**
   * 본문 중간의 사진 한 장. 시안의 2컷 비교(`pair`)와 달리 취입 글이 쓰는 블록이다.
   * DB 본문은 한 덩이 문자열이라 `pair` 를 되살릴 수 없지만, 한 장짜리는
   * `![alt](src)` 한 줄로 왕복이 되므로 취입 글의 사진은 이 블록으로 실린다.
   */
  | { kind: 'figure'; image: JournalImage }
  /**
   * 본문 자체가 아닌 곁말 — 취입 글 첫 줄의 출처 표시가 이것이다.
   * DB 에서는 `*…*` 로 감싸 두고, 화면에서는 별표를 떼고 작게 흘려 쓴다.
   * (이 블록이 없던 동안 별표가 화면에 그대로 찍혔다.)
   */
  | { kind: 'note'; text: string };

export type JournalPost = {
  slug: string;
  locale: Locale;
  category: JournalCategory;
  title: string;
  /** 목록 카드에 쓰는 발췌 */
  excerpt: string;
  body: JournalBlock[];
  cover: JournalImage;
  /** @/content/site 의 Plan.code — 글 하단 CTA가 가리키는 플랜 */
  planCode: string;
  /** 'YYYY-MM' 또는 'YYYY-MM-DD'. 시안이 날짜까지 준 글만 일 단위로 둔다. */
  publishedAt: string;
  /**
   * 'YYYY-MM-DD'. DB 에서 온 글만 갖는다 — 코드 시드는 고칠 때마다 배포되므로 갱신일이 없다.
   * 구조화 데이터의 dateModified 와 사이트맵 lastModified 가 이 값을 쓴다.
   */
  updatedAt?: string;
  tags?: string[];
  featured?: boolean;
  /** 샘플 원고 표시. 실제 글은 이 필드를 생략한다. */
  isSample?: true;
};

/* ---------------- 카테고리 라벨 ---------------- */

export const CATEGORY_LABEL: Record<JournalCategory, Record<Locale, string>> = {
  studio: { ja: 'STUDIO', en: 'STUDIO', ko: '스튜디오' },
  location: { ja: 'LOCATION', en: 'LOCATION', ko: '로케이션' },
  dress: { ja: 'DRESS', en: 'DRESS', ko: '드레스' },
  tips: { ja: '撮影のヒント', en: 'TIPS', ko: '촬영 팁' },
  anniversary: { ja: '記念日', en: 'ANNIVERSARY', ko: '기념일' },
};

export const CATEGORY_ALL_LABEL: Record<Locale, string> = {
  ja: 'ALL',
  en: 'ALL',
  ko: '전체',
};

/** 샘플 원고 배지 문구 */
export const SAMPLE_BADGE: Record<Locale, string> = {
  ja: '記事はサンプルです（要確認）',
  en: 'Sample entries (to be confirmed)',
  ko: '샘플 글입니다 (확인 필요)',
};

/** 글 하나에 붙는 배지 — 목록을 거치지 않고 바로 들어와도 샘플임을 알 수 있어야 한다 */
export const SAMPLE_BADGE_SINGLE: Record<Locale, string> = {
  ja: 'この記事はサンプルです（要確認）',
  en: 'This entry is a sample (to be confirmed)',
  ko: '이 글은 샘플입니다 (확인 필요)',
};

/* ---------------- 페이지 UI 문구 ---------------- */

export const JOURNAL_UI: Record<
  Locale,
  {
    eyebrow: string;
    heading: string;
    lead: string[];
    readMore: string;
    related: string;
    planLead: string;
    planDetail: string;
    /** 한국어 페이지에만 노출한다 */
    naverNote?: string;
    listMeta: { title: string; description: string };
  }
> = {
  ja: {
    eyebrow: 'JOURNAL',
    heading: '撮影レポート',
    lead: [
      '撮影当日の天気、場所、撮影のエピソードまで。スナップ撮影の前に知っておくと役に立つことをまとめています。',
    ],
    readMore: 'READ MORE',
    related: 'RELATED',
    planLead: 'この記事の撮影プラン',
    planDetail: 'PLAN 詳細',
    listMeta: {
      title: '撮影レポート ・ 沖縄の撮影エピソード',
      description:
        '撮影当日の天気、場所、撮影のエピソードまで。沖縄のスタジオとロケーションで撮るときに知っておくと役立つことをまとめています。掲載中の記事はサンプルです。',
    },
  },
  en: {
    eyebrow: 'JOURNAL',
    heading: 'Session stories',
    lead: [
      'Weather, places and stories from the sessions themselves — things worth knowing before your own shoot.',
    ],
    readMore: 'READ MORE',
    related: 'RELATED',
    planLead: 'The plan behind this session',
    planDetail: 'VIEW PLAN',
    listMeta: {
      title: 'Session stories — Okinawa photo sessions',
      description:
        'Weather, places and stories from sessions at the Okinawa studio and on location — things worth knowing before your own shoot. The entries shown are samples.',
    },
  },
  ko: {
    eyebrow: 'JOURNAL',
    heading: '촬영후기',
    lead: ['촬영 당일의 날씨와 장소, 촬영 에피소드까지.', '스냅 촬영 전에 알아두면 좋은 팁을 모았습니다.'],
    readMore: '이어서 읽기',
    related: '관련 글',
    planLead: '이 글의 촬영 플랜',
    planDetail: '플랜 상세',
    naverNote: '네이버 블로그에서 가져온 글',
    listMeta: {
      title: '촬영후기 · 오키나와 촬영 에피소드',
      description:
        '촬영 당일의 날씨와 장소, 촬영 에피소드까지. 오키나와 스튜디오와 로케이션 촬영 전에 알아두면 좋은 팁을 모았습니다. 현재 올라와 있는 글은 샘플입니다.',
    },
  },
};

/* ---------------- 글 ---------------- */

const JA_POSTS: JournalPost[] = [
  {
    slug: 'arch-window-light',
    locale: 'ja',
    category: 'studio',
    title: 'アーチ窓の光がやわらかい時間に',
    excerpt:
      'レースのカーテン越しに光がまわる時間帯は、影がとても柔らかくなります。その時間に合わせてヘアメイクの開始時刻をご案内することが多いです。',
    cover: { src: '/images/studio/IMG_0766.png', alt: 'アーチ窓から入る自然光' },
    tags: ['スタジオ', '自然光', '撮影のヒント'],
    planCode: 'studio-01',
    publishedAt: '2026-07-18',
    featured: true,
    isSample: true,
    body: [
      {
        kind: 'p',
        text: 'レースのカーテン越しに光がまわる時間帯は、影がとても柔らかくなります。その時間に合わせてヘアメイクの開始時刻をご案内することが多いです。',
      },
      {
        kind: 'p',
        text: '時間が進むと光の向きが変わり、ヘリンボーンの床に長い影が伸びます。同じ部屋でも、時間帯で写真の印象はまったく変わります。「午前の柔らかい写真」と「午後の陰影のある写真」、どちらがお好みかを事前に伺っておくと、当日の進行がスムーズです。',
      },
      { kind: 'quote', text: '雨の日は、かえって光が均一になります。曇天もおすすめです。' },
      {
        kind: 'pair',
        images: [
          { src: '/images/studio/IMG_0690.png', alt: '午前のアーチ窓' },
          { src: '/images/studio/IMG_0747.png', alt: '午後のモノトーンコーナー' },
        ],
        caption: '左：アーチ窓 ／ 右：モノトーンコーナー',
      },
      {
        kind: 'p',
        text: '撮影は Plan.01（約3.5時間）であれば、ヘアメイクを含めても光のいい時間帯に十分収まります。ご滞在のスケジュールに合わせて、開始時刻はご相談ください。',
      },
    ],
  },
  {
    slug: 'summer-beach-session',
    locale: 'ja',
    category: 'location',
    title: '夏のビーチ撮影、一日の流れ',
    excerpt: '移動と着替えを含めた一日の流れと、暑い季節の進め方をご紹介します。',
    cover: { src: '/images/up/0f62c6d466bcea42.jpg', alt: '夏のビーチ撮影' },
    planCode: 'location-basic',
    publishedAt: '2026-07',
    isSample: true,
    body: [
      { kind: 'p', text: '移動と着替えを含めた一日の流れと、暑い季節の進め方をご紹介します。' },
    ],
  },
  {
    slug: 'choosing-a-dress',
    locale: 'ja',
    category: 'dress',
    title: '写真に写るドレスの選び方',
    excerpt: '屋外は風で動く素材、室内は光を受ける生地。場所によって似合うドレスは変わります。',
    cover: { src: '/images/studio/IMG_0698.png', alt: 'ドレス選びの記録' },
    planCode: 'studio-02',
    publishedAt: '2026-06',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: '屋外は風で動く素材、室内は光を受ける生地。場所によって似合うドレスは変わります。',
      },
    ],
  },
  {
    slug: 'cloudy-day',
    locale: 'ja',
    category: 'tips',
    title: '曇りの日は、じつは撮りやすい',
    excerpt: '影が出ないぶん、肌も表情も柔らかく写ります。曇天だからと諦めないでください。',
    cover: { src: '/images/up/ddb78d75fc3e564b.jpg', alt: '雨の日の撮影' },
    planCode: 'location-simple',
    publishedAt: '2026-06',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: '影が出ないぶん、肌も表情も柔らかく写ります。曇天だからと諦めないでください。',
      },
    ],
  },
  {
    slug: 'vintage-corner-props',
    locale: 'ja',
    category: 'studio',
    title: 'ヴィンテージコーナーの小物について',
    excerpt: 'チークの家具に合わせた、レースと真鍮の小物。撮りたい雰囲気に合わせてご相談ください。',
    cover: { src: '/images/studio/IMG_0746.png', alt: 'ヴィンテージコーナーでの撮影' },
    planCode: 'studio-01',
    publishedAt: '2026-05',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: 'チークの家具に合わせた、レースと真鍮の小物。撮りたい雰囲気に合わせてご相談ください。',
      },
    ],
  },
  {
    slug: 'family-anniversary',
    locale: 'ja',
    category: 'anniversary',
    title: '七五三のお祝い、家族4人で',
    excerpt:
      'お子さまと一緒の撮影は Plan.04（約50分）。順番を決めて、飽きる前に終わるよう進めます。',
    cover: { src: '/images/up/ddf6db884e95f47c.jpg', alt: '七五三の記念撮影' },
    planCode: 'studio-04',
    publishedAt: '2026-05',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: 'お子さまと一緒の撮影は Plan.04（約50分）。順番を決めて、飽きる前に終わるよう進めます。',
      },
    ],
  },
  {
    slug: 'self-wedding',
    locale: 'ja',
    category: 'location',
    title: 'セルフウェディングという選び方',
    excerpt: '式は挙げないけれど、写真だけは残したい。そんなご相談が増えています。',
    cover: { src: '/images/up/1440241c37bf4fc2.jpg', alt: 'セルフウェディング' },
    planCode: 'location-basic',
    publishedAt: '2026-04',
    isSample: true,
    body: [
      { kind: 'p', text: '式は挙げないけれど、写真だけは残したい。そんなご相談が増えています。' },
    ],
  },
];

const EN_POSTS: JournalPost[] = [
  {
    slug: 'arch-window-light',
    locale: 'en',
    category: 'studio',
    title: 'When the light through the arched window is softest',
    excerpt:
      'When the light comes through the lace curtain, the shadows go very soft. We usually set the hair and make-up start time so that the shooting lands in that window.',
    cover: { src: '/images/studio/IMG_0766.png', alt: 'Studio session notes' },
    tags: ['Studio', 'Natural light', 'Tips'],
    planCode: 'studio-01',
    publishedAt: '2026-07-18',
    featured: true,
    isSample: true,
    body: [
      {
        kind: 'p',
        text: 'When the light comes through the lace curtain, the shadows go very soft. We usually set the hair and make-up start time so that the shooting lands in that window.',
      },
    ],
  },
  {
    slug: 'summer-beach-session',
    locale: 'en',
    category: 'location',
    title: 'A summer beach session, hour by hour',
    excerpt:
      'How a day runs when you include travel and changing, and how we work around the heat.',
    cover: { src: '/images/up/0f62c6d466bcea42.jpg', alt: 'Summer beach session' },
    planCode: 'location-basic',
    publishedAt: '2026-07',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: 'How a day runs when you include travel and changing, and how we work around the heat.',
      },
    ],
  },
  {
    slug: 'choosing-a-dress',
    locale: 'en',
    category: 'dress',
    title: 'Choosing a dress that photographs well',
    excerpt: 'Fabrics that move in the wind outdoors, fabrics that catch the light indoors.',
    cover: { src: '/images/studio/IMG_0698.png', alt: 'Choosing a dress' },
    planCode: 'studio-02',
    publishedAt: '2026-06',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: 'Fabrics that move in the wind outdoors, fabrics that catch the light indoors.',
      },
    ],
  },
  {
    slug: 'cloudy-day',
    locale: 'en',
    category: 'tips',
    title: 'Cloudy days are easier than you think',
    excerpt: 'With no hard shadows, both skin and expressions come out softer.',
    cover: { src: '/images/up/ddb78d75fc3e564b.jpg', alt: 'Session on a cloudy day' },
    planCode: 'location-simple',
    publishedAt: '2026-06',
    isSample: true,
    body: [{ kind: 'p', text: 'With no hard shadows, both skin and expressions come out softer.' }],
  },
  {
    slug: 'vintage-corner-props',
    locale: 'en',
    category: 'studio',
    title: 'About the props in the vintage corner',
    excerpt: 'Lace and brass pieces chosen to sit with the teak furniture.',
    cover: { src: '/images/studio/IMG_0746.png', alt: 'Vintage corner props' },
    planCode: 'studio-01',
    publishedAt: '2026-05',
    isSample: true,
    body: [{ kind: 'p', text: 'Lace and brass pieces chosen to sit with the teak furniture.' }],
  },
  {
    slug: 'family-anniversary',
    locale: 'en',
    category: 'anniversary',
    title: 'A first birthday, four in the family',
    excerpt:
      'Sessions with children run about 50 minutes (Plan 04), in a set order so nobody gets tired.',
    cover: { src: '/images/up/ddf6db884e95f47c.jpg', alt: 'First birthday family session' },
    planCode: 'studio-04',
    publishedAt: '2026-05',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: 'Sessions with children run about 50 minutes (Plan 04), in a set order so nobody gets tired.',
      },
    ],
  },
  {
    slug: 'self-wedding',
    locale: 'en',
    category: 'location',
    title: 'Self-wedding, as a way of choosing',
    excerpt: 'No ceremony, but the photographs remain — we are asked for this more and more.',
    cover: { src: '/images/up/1440241c37bf4fc2.jpg', alt: 'Self-wedding session' },
    planCode: 'location-basic',
    publishedAt: '2026-04',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: 'No ceremony, but the photographs remain — we are asked for this more and more.',
      },
    ],
  },
];

const KO_POSTS: JournalPost[] = [
  {
    slug: 'arch-window-light',
    locale: 'ko',
    category: 'studio',
    title: '오전 열한 시, 아치 창 앞에서 시작한 촬영',
    excerpt:
      '“긴장돼서 표정이 안 나올 것 같아요.” 도착하자마자 신부님이 하신 말씀이었어요. 그런데 헤어메이크업을 받고, 커튼 사이로 들어오는 빛 앞에 서니 두 분 다 금세 웃고 계시더라고요. 이런 날은 사진보다 그 웃음이 먼저 기억에 남습니다.',
    cover: { src: '/images/studio/IMG_0766.png', alt: '스튜디오 촬영 기록' },
    tags: ['스튜디오', '자연광', '촬영 팁'],
    planCode: 'studio-01',
    publishedAt: '2026-07-18',
    featured: true,
    isSample: true,
    body: [
      {
        kind: 'p',
        text: '“긴장돼서 표정이 안 나올 것 같아요.” 도착하자마자 신부님이 하신 말씀이었어요. 그런데 헤어메이크업을 받고, 커튼 사이로 들어오는 빛 앞에 서니 두 분 다 금세 웃고 계시더라고요. 이런 날은 사진보다 그 웃음이 먼저 기억에 남습니다.',
      },
    ],
  },
  {
    slug: 'summer-beach-session',
    locale: 'ko',
    category: 'location',
    title: '8월의 바다, 더위를 피해 이른 아침에',
    excerpt:
      '서울에서 오신 부부와 아침 여섯 시에 만났습니다. 사람이 없는 바다, 아직 뜨거워지기 전의 빛. 여름 촬영은 시간만 잘 잡아도 절반은 성공이에요.',
    cover: { src: '/images/up/0f62c6d466bcea42.jpg', alt: '여름 바다 촬영' },
    planCode: 'location-basic',
    publishedAt: '2026-07',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: '서울에서 오신 부부와 아침 여섯 시에 만났습니다. 사람이 없는 바다, 아직 뜨거워지기 전의 빛. 여름 촬영은 시간만 잘 잡아도 절반은 성공이에요.',
      },
    ],
  },
  {
    slug: 'choosing-a-dress',
    locale: 'ko',
    category: 'dress',
    title: '드레스 두 벌을 고민하다가, 결국 둘 다',
    excerpt:
      '실내에서는 빛을 머금는 새틴이, 바다에서는 바람에 흔들리는 튤이 예뻤습니다. 고민되실 땐 두 분위기를 다 담아보시는 것도 방법이에요.',
    cover: { src: '/images/studio/IMG_0698.png', alt: '드레스 고르기' },
    planCode: 'studio-02',
    publishedAt: '2026-06',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: '실내에서는 빛을 머금는 새틴이, 바다에서는 바람에 흔들리는 튤이 예뻤습니다. 고민되실 땐 두 분위기를 다 담아보시는 것도 방법이에요.',
      },
    ],
  },
  {
    slug: 'cloudy-day',
    locale: 'ko',
    category: 'tips',
    title: '비 예보를 보고 걱정하셨지만',
    excerpt:
      '당일 아침까지 비가 왔어요. 그런데 흐린 하늘은 그림자가 지지 않아 피부도 표정도 훨씬 부드럽게 담깁니다. 촬영이 끝나고 “비 와서 다행이었네요” 하고 웃으셨어요.',
    cover: { src: '/images/up/ddb78d75fc3e564b.jpg', alt: '흐린 날 촬영' },
    planCode: 'location-simple',
    publishedAt: '2026-06',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: '당일 아침까지 비가 왔어요. 그런데 흐린 하늘은 그림자가 지지 않아 피부도 표정도 훨씬 부드럽게 담깁니다. 촬영이 끝나고 “비 와서 다행이었네요” 하고 웃으셨어요.',
      },
    ],
  },
  {
    slug: 'vintage-corner-props',
    locale: 'ko',
    category: 'studio',
    title: '빈티지 코너, 오래된 물건들 사이에서',
    excerpt:
      '티크 가구와 레이스 커튼, 황동 소품. 조명을 낮추면 필름으로 찍은 것 같은 색이 나옵니다. 조용한 분위기를 좋아하시는 분들이 많이 고르시는 자리예요.',
    cover: { src: '/images/studio/IMG_0746.png', alt: '빈티지 코너 소품' },
    planCode: 'studio-01',
    publishedAt: '2026-05',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: '티크 가구와 레이스 커튼, 황동 소품. 조명을 낮추면 필름으로 찍은 것 같은 색이 나옵니다. 조용한 분위기를 좋아하시는 분들이 많이 고르시는 자리예요.',
      },
    ],
  },
  {
    slug: 'family-anniversary',
    locale: 'ko',
    category: 'anniversary',
    title: '아이 돌, 네 식구가 처음 함께 찍은 사진',
    excerpt:
      '아이가 울까 봐 걱정 많으셨는데, 50분 안에 무사히 끝났습니다. 아이와 함께하는 촬영은 지치기 전에 마치는 게 가장 중요해서 순서를 미리 정해 둡니다.',
    cover: { src: '/images/up/ddf6db884e95f47c.jpg', alt: '돌 기념 가족 촬영' },
    planCode: 'studio-04',
    publishedAt: '2026-05',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: '아이가 울까 봐 걱정 많으셨는데, 50분 안에 무사히 끝났습니다. 아이와 함께하는 촬영은 지치기 전에 마치는 게 가장 중요해서 순서를 미리 정해 둡니다.',
      },
    ],
  },
  {
    slug: 'self-wedding',
    locale: 'ko',
    category: 'location',
    title: '식은 올리지 않기로 한 두 분',
    excerpt:
      '“결혼식은 안 하지만 사진은 남기고 싶어요.” 요즘 이런 문의가 정말 많아졌어요. 두 분만의 속도로, 바다 앞에서 천천히 담았습니다.',
    cover: { src: '/images/up/1440241c37bf4fc2.jpg', alt: '셀프 웨딩' },
    planCode: 'location-basic',
    publishedAt: '2026-04',
    isSample: true,
    body: [
      {
        kind: 'p',
        text: '“결혼식은 안 하지만 사진은 남기고 싶어요.” 요즘 이런 문의가 정말 많아졌어요. 두 분만의 속도로, 바다 앞에서 천천히 담았습니다.',
      },
    ],
  },
];

/**
 * 전체 글. DB 한 테이블의 행 묶음이라고 보면 된다 — locale 이 행의 필드다.
 * (sitemap.ts 가 이 배열을 그대로 읽는다.)
 * 세 언어는 같은 slug를 공유해 hreflang이 서로 맞물린다.
 */
export const JOURNAL_POSTS: JournalPost[] = [...JA_POSTS, ...EN_POSTS, ...KO_POSTS];

/* ---------------- 조회 헬퍼 ---------------- */

/**
 * 최신순 정렬. 'YYYY-MM'과 'YYYY-MM-DD'는 사전순 비교로도 최신순이 맞다.
 *
 * `posts` 인자는 관리자/네이버 취입분이 담긴 DB 목록을 넣기 위한 자리다 —
 * 생략하면 코드 시드를 본다. 공개 페이지는 `@/server/journal-content` 가 해석한 값을 넘긴다.
 */
export function listPosts(locale: Locale, posts: JournalPost[] = JOURNAL_POSTS): JournalPost[] {
  return posts.filter((p) => p.locale === locale).sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
}

export function featuredPost(locale: Locale, posts: JournalPost[] = JOURNAL_POSTS): JournalPost | undefined {
  const rows = listPosts(locale, posts);
  return rows.find((p) => p.featured) ?? rows[0];
}

export function findPost(
  locale: Locale,
  slug: string,
  posts: JournalPost[] = JOURNAL_POSTS,
): JournalPost | undefined {
  return posts.find((p) => p.locale === locale && p.slug === slug);
}

/** 필터 칩 목록은 실제로 글이 있는 카테고리에서 뽑는다 — 눌러도 빈 목록이 되는 칩을 만들지 않는다. */
export function usedCategories(
  locale: Locale,
  posts: JournalPost[] = JOURNAL_POSTS,
): JournalCategory[] {
  const order: JournalCategory[] = ['studio', 'location', 'dress', 'tips', 'anniversary'];
  const used = new Set(listPosts(locale, posts).map((p) => p.category));
  return order.filter((c) => used.has(c));
}

export function relatedPosts(
  locale: Locale,
  slug: string,
  limit = 3,
  posts: JournalPost[] = JOURNAL_POSTS,
): JournalPost[] {
  const current = findPost(locale, slug, posts);
  const rest = listPosts(locale, posts).filter((p) => p.slug !== slug);
  if (!current) return rest.slice(0, limit);
  // 같은 카테고리를 앞으로, 모자라면 최신 글로 채운다.
  const same = rest.filter((p) => p.category === current.category);
  const other = rest.filter((p) => p.category !== current.category);
  return [...same, ...other].slice(0, limit);
}

/** generateStaticParams 용 — locale × slug 전개 */
export function allPostParams(
  posts: JournalPost[] = JOURNAL_POSTS,
): { locale: Locale; slug: string }[] {
  return posts.map((p) => ({ locale: p.locale, slug: p.slug }));
}

/** 'YYYY-MM-DD' → '2026.07.18', 'YYYY-MM' → '2026.07' */
export function formatDate(publishedAt: string): string {
  return publishedAt.replaceAll('-', '.');
}
