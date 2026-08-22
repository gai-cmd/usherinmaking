import type { Locale } from '@/lib/i18n';

type L10n = Record<Locale, string>;
type L10nList = Record<Locale, string[]>;

/** 문의 페이지 전용 문안. 시안 카드의 확정 카피를 언어별로 그대로 옮긴다. */

export const CONTACT = {
  eyebrow: 'GET IN TOUCH',

  title: { ja: 'Contact', en: 'Contact', ko: '문의하기' } satisfies L10n,

  /** 정의형 리드 — AEO 인용 대상. 창구는 메신저뿐이므로 폼을 언급하지 않는다. */
  definition: {
    ja: 'usherinmaking への問い合わせとは？ 撮影日と撮影内容を LINE または Instagram でお送りいただき、空き状況を確認したうえでご返信する流れです。',
    en: 'How do you get in touch with usherinmaking? You send us your dates and what you would like photographed by Instagram DM, and we reply once we have checked availability.',
    ko: '어셔린메이킹(usherinmaking) 문의는 어떻게 하나요? 촬영 날짜와 촬영 내용을 카카오톡이나 인스타그램으로 보내주시면, 일정을 확인한 뒤 답변드리는 방식입니다.',
  } satisfies L10n,

  lead: {
    ja: [
      'ご希望の日程・撮影内容をメッセージでお知らせください。空き状況を確認のうえ、通常 1〜2日以内にご返信します。',
      'オンラインの自動予約はありません。すべてご相談のうえで確定します。',
    ],
    en: [
      'Send us your dates and what you’d like to photograph by Instagram DM. We check availability and usually reply within 1–2 days.',
      'There’s no automatic online booking — every session is arranged by message.',
    ],
    ko: [
      '희망하시는 날짜와 촬영 내용을 카카오톡(amipaek)으로 보내주시면, 확인 후 보통 1~2일 안에 답변드립니다.',
      '온라인 자동 예약은 없습니다. 모든 촬영은 상담을 거쳐 확정됩니다.',
    ],
  } satisfies L10nList,

  /* ---------- 상담 채널 ---------- */
  directLabel: 'DIRECT',

  directTitle: {
    ja: 'メッセージで相談',
    en: 'Message us',
    ko: '메시지로 상담',
  } satisfies L10n,

  /** 한국어 페이지에만 노출하는 네이버 블로그 안내 */
  naverBlog: {
    label: { ja: '', en: '', ko: '네이버 블로그' } satisfies L10n,
    note: { ja: '', en: '', ko: '촬영 후기와 준비 이야기' } satisfies L10n,
  },

  /* ---------- FAQ ---------- */
  faqLabel: 'BEFORE YOU ASK',

  /** 답변은 확정된 요금·설비 정보만으로 쓴다. 우천 시 스튜디오 대체 안내는 하지 않는다. */
  faq: [
    {
      q: {
        ja: '料金はいくらからですか？',
        en: 'How much does a session cost?',
        ko: '촬영 비용은 얼마부터인가요?',
      } satisfies L10n,
      a: {
        ja: 'スタジオ撮影は ¥25,000 から、ロケーション撮影は ¥76,000（税込）から承っています。プランごとの内容は料金ページに載せています。',
        en: 'Studio sessions start at ¥25,000 and location sessions at ¥76,000 including tax. Each plan is listed in full on the plans page.',
        ko: '웨딩 촬영은 88만원부터, 커플 · 가족 · 기념일 등 기타 촬영은 30만원부터입니다. 플랜별 자세한 내용은 플랜 페이지에 정리되어 있습니다.',
      } satisfies L10n,
    },
    {
      // 세 언어는 독립 본문 — 한국어 상품은 로케이션 전용이라 주차 대신 장소 선정 문답을 싣는다.
      q: {
        ja: '駐車場はありますか？',
        en: 'Is there parking?',
        ko: '촬영 장소는 어떻게 정하나요?',
      } satisfies L10n,
      a: {
        ja: 'スタジオに駐車場が2台分あります。',
        en: 'There’s parking for two cars at the studio.',
        ko: '지역만 미리 정해 두고, 정확한 장소는 촬영일에 임박해 날씨를 보고 추천드립니다. 유명 관광지보다는 한적한 시크릿 스팟 위주로 안내합니다.',
      } satisfies L10n,
    },
    {
      q: {
        ja: '雨の日はどうなりますか？',
        en: 'What happens if it rains?',
        ko: '비가 오면 어떻게 되나요?',
      } satisfies L10n,
      a: {
        ja: '雨天でもロケーション撮影を行うことがあります。当日の状況によっては、日程の変更をご相談いただけます。',
        en: 'We do shoot location sessions in the rain, and depending on the day we can also talk about moving the date.',
        ko: '비가 와도 로케이션 촬영을 진행하는 경우가 있습니다. 당일 상황에 따라 날짜 변경도 상담하실 수 있습니다.',
      } satisfies L10n,
    },
    {
      q: {
        ja: '日本語以外でも相談できますか？',
        en: 'Which languages do you speak?',
        ko: '일본어를 못해도 괜찮나요?',
      } satisfies L10n,
      a: {
        ja: '日本語・한국어・English でご相談いただけます。',
        en: 'We answer in English, Japanese and Korean.',
        ko: '네, 괜찮습니다. 상담부터 촬영 당일까지 한국어로 진행되며, 일본어 · 영어 상담도 가능합니다.',
      } satisfies L10n,
    },
  ],

  /* ---------- 스튜디오 ---------- */
  studioTitle: { ja: 'スタジオ', en: 'Studio', ko: '스튜디오' } satisfies L10n,

  studioRegion: { ja: '沖縄県', en: 'Okinawa', ko: '오키나와현' } satisfies L10n,

  landmark: {
    ja: '白い壁とアーチの一軒家が目印',
    en: 'look for the white house with the arch',
    ko: '흰 벽에 아치가 있는 단독주택 건물입니다',
  } satisfies L10n,

  /**
   * 한국어 전용 — 주소 아래에 들어가는 한 줄.
   *
   * 한국 고객은 스튜디오로 찾아오지 않는다(로케이션 촬영뿐이다). 그래서 JA·EN 이 쓰는
   * "주차 2대 · 흰 벽에 아치가 있는 건물이 목표물" 같은 찾아오는 길 안내를 그대로 두면
   * 스튜디오로 오라는 뜻으로 읽힌다. 주소는 사업장 정보로 남기되, 안내는 이 문장으로 바꾼다.
   */
  koStudioNote: '작가가 활동하는 거점입니다. 촬영 장소는 상담 후 따로 안내드립니다.',

  mapCaption: {
    ja: 'Google マップの埋め込みは住所の確定後に入ります。',
    en: 'The Google Maps embed will appear once the address is confirmed.',
    ko: 'Google 지도 임베드는 주소 확정 후 들어갑니다.',
  } satisfies L10n,

  /* ---------- 하단 ---------- */
  footnote: {
    ja: 'ご返信の目安 1〜2日 ・ 撮影日はご相談のうえ確定します（自動予約・カレンダー予約はありません）',
    en: 'Replies usually within 1–2 days · dates are confirmed by message (no automatic or calendar booking)',
    ko: '답변은 보통 1~2일 이내 · 촬영일은 상담을 통해 확정됩니다 (자동 예약 · 캘린더 예약 없음)',
  } satisfies L10n,
} as const;

/**
 * 폼의 촬영 종류 칩. value는 API가 받는 값이고 라벨만 언어별로 다르다.
 *
 * `locales` 가 있는 항목은 그 언어에서만 보인다 — 한국 고객 상품에는 스튜디오 촬영이
 * 없으므로 스튜디오 관련 두 항목을 한국어 폼에서 뺀다. **값 목록 자체는 줄이지 않는다**:
 * API 검증(z.enum)과 이미 저장된 문의 기록이 이 값들을 쓰고 있어, 값을 지우면
 * 옛 기록이 유효하지 않은 값을 갖게 된다. 화면에서만 거른다.
 */
export const SESSION_TYPES = [
  {
    value: 'studio',
    label: { ja: 'スタジオ', en: 'Studio', ko: '스튜디오' } satisfies L10n,
    locales: ['ja', 'en'] as readonly Locale[],
  },
  {
    value: 'location',
    // 한국어 상품명은 '웨딩 촬영'(베이직 · 에프터풀)이다 — 플랜 페이지와 같은 말을 쓴다.
    label: { ja: 'ロケーション', en: 'Location', ko: '웨딩 촬영' } satisfies L10n,
  },
  {
    value: 'studio-location',
    label: {
      ja: 'スタジオ + ロケーション',
      en: 'Studio + Location',
      ko: '스튜디오 + 로케이션',
    } satisfies L10n,
    locales: ['ja', 'en'] as readonly Locale[],
  },
  {
    value: 'maternity',
    label: { ja: 'マタニティ', en: 'Maternity', ko: '만삭' } satisfies L10n,
  },
  {
    value: 'anniversary-family',
    label: {
      ja: '記念日・家族',
      en: 'Anniversary / family',
      ko: '기념일 · 가족 · 커플',
    } satisfies L10n,
  },
] as const;

export type SessionTypeValue = (typeof SESSION_TYPES)[number]['value'];
