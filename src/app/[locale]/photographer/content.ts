import type { Locale } from '@/lib/i18n';

/**
 * PHOTOGRAPHER 페이지 전용 카피. 세 언어는 서로의 번역이 아니라 각각 확정된 본문이다.
 * (시안 카드 4a / en-2c / ko-sub-2b 에서 그대로 옮겼다.)
 *
 * 작가 포트레이트 사진은 아직 받지 못했다. 대체 사진을 끼워 넣지 않고
 * --placeholder 블록으로 비워 둔다.
 */

export type PhotographerContent = {
  eyebrow: string;
  title: string;
  /** 정의형 도입 문단. 줄바꿈 단위로 넣는다. */
  intro: string[];
  facts: { label: string; value: string }[];
  portraitPlaceholder: string;
  name: { label: string; lines: string[]; note: string[] };
  how: { label: string; title: string; points: { title: string; body: string }[] };
  gallery: { src: string; alt: string }[];
  guests: { label: string; title: string; body: string[] };
  follow: {
    label: string;
    title: string;
    /** href가 없는 줄은 링크가 아니라 표기만 한다 (인스타그램 아웃링크 금지 규칙) */
    rows: { label: string; note: string; page?: 'journal' | 'contact' }[];
    note: string;
  };
  meta: { title: string; description: string };
};

const GALLERY = [
  { src: '/images/studio/IMG_0766.png' },
  { src: '/images/up/0f62c6d466bcea42.jpg' },
  { src: '/images/studio/IMG_0769.png' },
];

export const PHOTOGRAPHER: Record<Locale, PhotographerContent> = {
  ja: {
    eyebrow: 'PHOTOGRAPHER',
    title: 'usherinmaking',
    intro: [
      '沖縄で写真を撮っている、韓国人の女性カメラマンです。',
      'やわらかい雰囲気の一枚をお望みなら、どうぞお任せください。',
      'ロケーションもスタジオも、はじめから終わりまで同じ人間が撮ります。',
    ],
    facts: [
      { label: 'BASE', value: '沖縄 ・ 一軒家スタジオ' },
      { label: 'STYLE', value: '韓流スタイル / 自然光' },
      { label: 'LANGUAGE', value: '한국어 ・ 日本語 ・ English' },
    ],
    portraitPlaceholder: '[ PORTRAIT ]',
    name: {
      label: 'NAME',
      lines: [
        '「usher in」は、どこかへご案内するという意味。',
        'そこに making を添えて、',
        '思い出をつくる場所へご案内する、という名前にしました。',
      ],
      note: [
        '自然と人が調和した写真が、長い時間が経った後も残像のように、',
        '幸せな余韻として浮かび上がりますように。',
      ],
    },
    how: {
      label: 'HOW I SHOOT',
      title: '撮影について',
      points: [
        {
          title: '女性目線のディレクション',
          body: 'ポーズも表情も、うまくなくて大丈夫です。声をかけながら進めるので、写真に慣れていない方ほど自然に写ります。',
        },
        {
          title: '韓流スタイルのリタッチ',
          body: '柔らかい肌のトーンと、色を引き算した仕上げ。データは後日お渡しし、原本もオプションでご購入いただけます。',
        },
        {
          title: 'スタジオとロケーション、両方',
          body: '室内の光も、沖縄の屋外の光も。撮りたいイメージに合わせて、どちらか、あるいは両方をご案内します。',
        },
      ],
    },
    gallery: [
      { ...GALLERY[0], alt: 'スタジオでの撮影' },
      { ...GALLERY[1], alt: '沖縄のロケーション撮影' },
      { ...GALLERY[2], alt: 'ドレスルーム' },
    ],
    guests: {
      label: 'FOR OUR GUESTS',
      title: 'ご相談は 3つの言語で',
      body: [
        '韓国からお越しの方は 한국어 で、日本の方は日本語で、そのほかの国の方は English でご相談いただけます。',
        '沖縄ご滞在中のスケジュールに合わせて、撮影時間や場所をご提案します。',
      ],
    },
    follow: {
      label: 'FOLLOW',
      title: '最新の作品',
      rows: [
        { label: 'Instagram', note: '@usherinmaking' },
        { label: 'JOURNAL', note: '撮影レポート', page: 'journal' },
      ],
      note: 'サイトのギャラリーは、Instagram の投稿から掲載を選んだものです。',
    },
    meta: {
      title: 'フォトグラファー ・ 沖縄で撮る韓国人カメラマン',
      description:
        '沖縄で写真を撮っている韓国人の女性カメラマンです。ロケーションもスタジオも、はじめから終わりまで同じ人間が撮ります。撮影のご相談は日本語・韓国語・英語で。',
    },
  },

  en: {
    eyebrow: 'PHOTOGRAPHER',
    title: 'usherinmaking',
    intro: [
      'A Korean woman photographing in Okinawa.',
      'If you want something softer and quieter, you are in the right place — and the same person shoots every session, indoors or out.',
    ],
    facts: [
      { label: 'BASE', value: 'Okinawa · house studio' },
      { label: 'STYLE', value: 'Korean editing · natural light' },
      { label: 'LANGUAGE', value: 'English · Japanese · Korean' },
    ],
    portraitPlaceholder: '[ PORTRAIT ]',
    name: {
      label: 'THE NAME',
      lines: [
        '"Usher in" means to show someone the way.',
        'Adding "making" turns it into showing you the way',
        'to the place where memories are made.',
      ],
      note: [
        'May photographs where people and nature sit together',
        'keep surfacing years later, like a happy afterimage.',
      ],
    },
    how: {
      label: 'HOW I SHOOT',
      title: 'Three things',
      points: [
        {
          title: 'Direction, not posing',
          body: 'You do not need to know how to pose. I talk you through it as we go, and the people who feel most awkward usually come out the most natural.',
        },
        {
          title: 'Korean-style retouching',
          body: 'Soft skin tones and a subtracted colour palette. Files are delivered afterwards, and the unedited originals can be added on.',
        },
        {
          title: 'Indoors and outdoors',
          body: 'Studio light and Okinawa daylight. Choose one, or do both in a single day with Plan 02.',
        },
      ],
    },
    gallery: [
      { ...GALLERY[0], alt: 'Studio session' },
      { ...GALLERY[1], alt: 'Outdoor session in Okinawa' },
      { ...GALLERY[2], alt: 'Dress room' },
    ],
    guests: {
      label: 'FOR OUR GUESTS',
      title: 'Three languages',
      body: [
        'Enquiries are welcome in English, Japanese or Korean. We plan the timing and the spots around your schedule in Okinawa, so tell us where you are staying and how long you have.',
      ],
    },
    follow: {
      label: 'FOLLOW',
      title: 'Latest work',
      rows: [
        { label: 'Instagram', note: '@usherinmaking' },
        { label: 'Journal', note: 'Notes from recent sessions', page: 'journal' },
      ],
      note: 'The gallery on this site is selected from Instagram posts and served from our own domain.',
    },
    meta: {
      title: 'PHOTOGRAPHER — a Korean photographer in Okinawa',
      description:
        'A Korean woman photographing in Okinawa. The same person shoots every session, indoors or out. Enquiries are welcome in English, Japanese or Korean.',
    },
  },

  ko: {
    eyebrow: 'PHOTOGRAPHER',
    title: 'usherinmaking',
    intro: [
      '오키나와에서 사진을 찍는 한국인 여성 작가입니다.',
      '부드럽고 조용한 장면을 원하신다면, 편하게 맡겨주세요.',
      '실내든 실외든 처음부터 끝까지 제가 직접 담습니다.',
    ],
    facts: [
      { label: 'BASE', value: '오키나와 · 단독주택 스튜디오' },
      { label: 'STYLE', value: '한국 스타일 보정 · 자연광' },
      { label: 'LANGUAGE', value: '한국어 · 일본어 · 영어' },
    ],
    portraitPlaceholder: '[ PORTRAIT ]',
    name: {
      label: 'NAME',
      lines: [
        '‘usher in’은 어딘가로 안내한다는 뜻입니다.',
        '거기에 making을 더해,',
        '기억이 만들어지는 자리로 안내한다는 이름이 되었습니다.',
      ],
      note: ['자연과 사람이 어우러진 사진이,', '오랜 시간이 지난 뒤에도 잔상처럼 남기를 바랍니다.'],
    },
    how: {
      label: 'HOW I SHOOT',
      title: '이렇게 담습니다',
      points: [
        {
          title: '포즈는 몰라도 괜찮아요',
          body: '계속 말을 걸며 진행하기 때문에, 사진이 어색한 분일수록 오히려 자연스럽게 나옵니다.',
        },
        {
          title: '한국 스타일 보정',
          body: '부드러운 피부 톤과 색을 덜어낸 마무리. 보정본은 후일 데이터로 드리고, 원본도 옵션으로 받으실 수 있습니다.',
        },
        {
          title: '실내와 실외, 둘 다',
          body: '스튜디오의 빛과 오키나와의 햇빛. 한쪽만, 또는 하루에 둘 다(PLAN 02) 담을 수 있습니다.',
        },
      ],
    },
    gallery: [
      { ...GALLERY[0], alt: '스튜디오 촬영' },
      { ...GALLERY[1], alt: '오키나와 로케이션 촬영' },
      { ...GALLERY[2], alt: '드레스룸' },
    ],
    guests: {
      label: 'FOR OUR GUESTS',
      title: '한국어 상담',
      body: [
        '상담부터 촬영 당일 안내까지 한국어 네이티브로 진행하니 안심하세요.',
        '오키나와 체류 일정에 맞춰 시간과 장소를 함께 상담드립니다.',
      ],
    },
    follow: {
      label: 'FOLLOW',
      title: 'SNS',
      rows: [
        { label: '인스타그램', note: '@usherinmaking' },
        { label: '촬영후기', note: '촬영 기록', page: 'journal' },
      ],
      note: '사이트의 갤러리는 인스타그램에서 고른 사진을 자사 서버에서 보여드립니다.',
    },
    meta: {
      title: '작가 소개 · 오키나와 웨딩 사진작가',
      description:
        '오키나와에서 사진을 찍는 한국인 여성 작가입니다. 실내든 실외든 처음부터 끝까지 직접 담습니다. 상담은 한국어로 편하게 문의해 주세요.',
    },
  },
};
