import { STUDIO_OPTIONS, type Plan } from '@/content/site';
import type { Locale } from '@/lib/i18n';

type L10n = Record<Locale, string>;
type L10nList = Record<Locale, string[]>;

/** ko 전용 데이터를 Plan 타입에 맞추기 위한 채움 — ko 화면에서만 렌더된다. */
const koOnly = (v: string): L10n => ({ ja: v, en: v, ko: v });
const koOnlyList = (v: string[]): L10nList => ({ ja: v, en: v, ko: v });

/**
 * PLAN 페이지 전용 카피.
 * 금액은 @/content/site 에서 가져오고, 여기에는 시안 카드에 있는 "문장"만 담는다.
 * 각 로케일은 자기 카드에서 그대로 옮긴 것이며 서로 번역이 아니다.
 */

export const HERO = {
  label: {
    ja: 'PLAN & OPTION',
    en: 'PLANS & ADD-ONS',
    ko: 'PLAN & OPTION',
  } satisfies L10n,
  title: { ja: 'Plans', en: 'Plans', ko: '플랜 안내' } satisfies L10n,
  /** 정의형 리드문 — AEO 인용 대상. 실제 텍스트로 노출한다. */
  lead: {
    ja: 'スタジオとロケーション、それぞれのプランと、追加できるオプションをまとめています。ご予約はお問い合わせから承ります（オンラインの自動予約はありません）。',
    en: 'Studio and location sessions, and everything you can add to them. Bookings are arranged by message — there’s no automatic online booking.',
    ko: '웨딩 촬영과 기타 촬영 플랜, 추가할 수 있는 옵션을 한 페이지에 정리했습니다. 예약은 상담을 통해서만 확정되며, 온라인 자동 예약은 없습니다.',
  } satisfies L10n,
};

/**
 * 플랜 목록 절의 제목. 화면에는 보이지 않고 보조기기에만 읽힌다.
 *
 * 시안에는 이 자리에 제목이 없고 탭이 바로 온다. 그런데 h1(플랜 안내) 다음에
 * 카드 제목이 h3 로 나오면 그 사이 h2 가 비어, 제목으로 문서를 훑는 사용자에게는
 * 존재하지 않는 상위 절 아래에 플랜이 매달린 것처럼 읽힌다.
 * 보이지 않는 h2 를 두어 시안을 그대로 두면서 목차만 바로잡는다.
 */
export const PLAN_LIST_SECTION: L10n = {
  ja: 'プラン一覧',
  en: 'Plan list',
  ko: '플랜 목록',
};

export const TABS = {
  studio: { ja: 'STUDIO', en: 'STUDIO', ko: '스튜디오' } satisfies L10n,
  location: { ja: 'LOCATION', en: 'LOCATION', ko: '로케이션' } satisfies L10n,
  anniversary: { ja: '記念写真', en: 'ANNIVERSARY', ko: '기념사진' } satisfies L10n,
  hair: { ja: 'ヘアメイク', en: 'HAIR & MAKE-UP', ko: '헤어메이크업' } satisfies L10n,
};

/** 스튜디오 요금은 모니터 가격이다 — 税込 표기를 붙이지 않는다. */
export const MONITOR_PRICE: L10n = {
  ja: 'モニター価格',
  en: 'MONITOR PRICE',
  ko: '모니터 가격',
};

/** 카드에 적힌 소요시간 문구 (site.ts 의 duration 보다 이 페이지 표기가 우선) */
export const STUDIO_DURATION: Record<string, L10n> = {
  'studio-01': {
    ja: 'ヘアメイク + 撮影 約3.5H',
    en: 'Hair & make-up + shooting, approx. 3.5 h',
    ko: '헤어메이크업 + 촬영 약 3시간 30분',
  },
  'studio-02': {
    ja: 'ヘアメイク + 撮影 約4.5H',
    en: 'Hair & make-up + shooting, approx. 4.5 h',
    ko: '헤어메이크업 + 촬영 약 4시간 30분',
  },
  'studio-03': {
    ja: 'ヘアメイク + 撮影 約3H',
    en: 'Hair & make-up + shooting, approx. 3 h',
    ko: '헤어메이크업 + 촬영 약 3시간',
  },
  'studio-04': {
    ja: '撮影 約50分 ・ 1〜4名様',
    en: 'Shooting, approx. 50 min · 1–4 people',
    ko: '촬영 약 50분 · 1~4인',
  },
};

/** 카드가 보여주는 "포함 내역" 전체. site.ts 의 축약본을 이걸로 덮어쓴다. */
export const STUDIO_INCLUDES: Record<string, L10nList> = {
  'studio-01': {
    ja: [
      '韓国風リタッチ写真データ 30カット',
      '新婦 フルメイク + ヘアセット',
      '新郎 シンプルメイク + ヘアセット',
      'ドレス 1着 ・ ヘア飾り・アクセサリー込み',
      '造花ブーケ / ベール 込み',
    ],
    en: [
      '30 retouched photos in the Korean style',
      'Full hair & make-up for the bride',
      'Simple hair & make-up for the groom',
      '1 dress, hair pieces and accessories',
      'Silk bouquet and veil',
    ],
    ko: [
      '한국 스타일 보정 데이터 30컷',
      '신부 풀메이크업 + 헤어세팅',
      '신랑 간단 메이크업 + 헤어세팅',
      '드레스 1벌 · 헤어 장식 · 액세서리 포함',
      '조화 부케 / 베일 포함',
    ],
  },
  'studio-02': {
    ja: [
      '韓国風リタッチ写真データ 40カット',
      '新婦 フルメイク + ヘアセット',
      '新郎 シンプルメイク + ヘアセット',
      'ドレス 2着 ・ ヘア飾り・アクセサリー込み',
      '造花ブーケ / ベール 込み',
    ],
    en: [
      '40 retouched photos in the Korean style',
      'Hair & make-up for both',
      '2 dresses, hair pieces and accessories',
      'Silk bouquet and veil',
      'Indoors and outdoors in one day',
    ],
    ko: [
      '한국 스타일 보정 데이터 40컷',
      '남녀 헤어메이크업',
      '드레스 2벌 · 액세서리 포함',
      '실내와 야외를 하루에',
    ],
  },
  'studio-03': {
    ja: [
      'カラーリタッチ写真データ 20カット',
      '男女 メイクアップ + ヘアセット',
      'マタニティ専用衣装 1着',
      'アクセサリー込み',
    ],
    en: [
      '20 colour-corrected photos',
      'Make-up and hair for both',
      '1 maternity gown',
      'Accessories included',
    ],
    ko: ['컬러 보정 데이터 20컷', '남녀 메이크업 + 헤어세팅', '만삭 전용 의상 1벌 · 액세서리 포함'],
  },
  'studio-04': {
    ja: [
      'カラーリタッチ写真データ 20カット',
      'カップル ・ 記念日 ・ 入学 ・ 誕生日',
      '家族写真 ・ プロフィール写真',
      'ドレス撮影をご希望の方はウェディングフォトプランへ',
    ],
    en: [
      '20 colour-corrected photos',
      'Couples, anniversaries, birthdays',
      'Family and profile portraits',
      'For dress sessions, see the wedding plans',
    ],
    ko: ['컬러 보정 데이터 20컷', '커플 · 기념일 · 입학 · 생일', '가족사진 · 프로필 사진'],
  },
};

export const LOCATION_PANEL = {
  note: {
    ja: 'ロケーションプランは税込表示です。',
    en: 'Location prices include tax.',
    ko: '로케이션 요금은 세금이 포함된 금액입니다.',
  } satisfies L10n,
};

export const ANNIVERSARY_PANEL = {
  /** 상세는 usherinmaking.jp/plan 의 기념사진 절에서 옮겼다 — TBC 표기는 종료. */
  surcharge: {
    ja: '土・日・祝 ＋¥8,000 ／ 大人2名＋お子様2名まで ・ 1名追加 ＋¥3,000 ／ 場所により許可費・出張費がかかる場合があります。',
    en: 'Weekends and holidays +¥8,000 · up to 2 adults and 2 children, +¥3,000 per extra person · some locations carry permit or travel fees.',
    ko: '주말 · 공휴일 +¥8,000 / 성인 2명 + 어린이 2명까지 · 1명 추가 +¥3,000 / 장소에 따라 허가비 · 출장비가 추가될 수 있습니다.',
  } satisfies L10n,
  note: {
    ja: '記念写真プランは税込表示です。お問い合わせの際に詳細をご案内します。',
    en: 'Anniversary prices include tax. We confirm the details when you get in touch.',
    ko: '기념사진 요금은 세금이 포함된 금액입니다. 문의 주시면 자세히 안내해 드립니다.',
  } satisfies L10n,
};

/* ---------------- 옵션 표 ---------------- */

export const OPTION_SECTION = {
  label: { ja: 'OPTION', en: 'ADD-ONS', ko: 'OPTION' } satisfies L10n,
  title: {
    ja: 'オプション',
    en: 'What you can add',
    ko: '추가 옵션',
  } satisfies L10n,
  lead: {
    ja: 'どのプランに追加できるかを、料金と一緒に記載しています。',
    en: '',
    ko: '',
  } satisfies L10n,
  head: {
    ja: ['OPTION', 'PRICE', '対象プラン ・ 備考'],
    en: ['ADD-ON', 'PRICE', 'APPLIES TO'],
    ko: ['OPTION', 'PRICE', '비고'],
  } satisfies L10nList,
};

export type OptionRow = { label: string; price: string; note: string };

/**
 * 시안 옵션 표는 JA·EN 카드에서 8행이다. 이 가운데 신랑 의상 / 원본 JPEG / 프리미엄 드레스 3행은
 * site.ts STUDIO_OPTIONS 가격을 그대로 쓰고, site.ts 에 없는 나머지 행만 여기에 둔다.
 * 주말 요금은 site.ts 가 로케이션 기준 단일가(＋¥18,000)라 범위를 보여주는 시안 표기를 따른다.
 *
 * "인원 추가"와 "헤어메이크업 추가"는 로케일마다 실제 행 구성이 다르다 — JA·EN 카드는
 * 이 둘을 별도 행 2개로 보여주지만, KO 카드만 한 행으로 합쳐서 보여준다. extraPersonRows 가
 * 그 차이를 그대로 옮긴 것이다.
 */
export function optionRows(locale: Locale): OptionRow[] {
  // ko 는 한국 고객 전용 옵션 구성(원화)을 쓴다 — JA/EN 옵션 표와 별개.
  if (locale === 'ko') return KO_OPTION_ROWS;

  const [groom, raw, premium] = STUDIO_OPTIONS;

  const notes: L10nList = {
    ja: [
      'STUDIO 01 / 02 ・ サイズは M のみ',
      'STUDIO 全プラン ・ 編集前の全カット',
      'STUDIO 01 / 02 ・ ドレスにより異なります',
      'LOCATION ・ 〜¥50,000 台 ／ タキシードはありません。小物・ブーケ・アクセサリー込み',
      'LOCATION ・ 1分30秒 ／ 単体でのご依頼は不可',
      'STUDIO 01 / 02 ＋¥18,000 ・ 03 / 04 ＋¥11,000 ／ LOCATION ＋¥18,000 ・ 記念写真 ＋¥8,000',
    ],
    en: [
      'Studio 01 / 02 · size M only',
      'All studio plans',
      'Studio 01 / 02 · depends on the dress',
      'Location · up to the ¥50,000 range, no tuxedos. Small items, bouquet and accessories included',
      'Location · 1 min 30 sec · not available on its own',
      'Studio 01 / 02 +¥18,000 · 03 / 04 +¥11,000 · location +¥18,000 · anniversary +¥8,000',
    ],
    ko: [
      '스튜디오 01 / 02 · M 사이즈만',
      '스튜디오 전 플랜 · 보정 전 전체 컷',
      '스튜디오 01 / 02 · 드레스에 따라 다름',
      '로케이션 · ~¥50,000대 / 턱시도는 없습니다. 소품 · 부케 · 액세서리 포함',
      '로케이션 · 1분 30초 / 영상 단독 의뢰 불가',
      '스튜디오 01/02 +¥18,000 · 03/04 +¥11,000 / 로케이션 +¥18,000 · 기념사진 +¥8,000',
    ],
  };

  const labels: L10nList = {
    ja: ['ドレスレンタル', '動画 + ドローン撮影', '休日料金（土・日・祝）'],
    en: ['Dress rental', 'Video + drone', 'Weekends and holidays'],
    ko: ['드레스 대여', '영상 + 드론 촬영', '주말 · 공휴일 요금'],
  };

  const prices: L10nList = {
    ja: ['¥10,000 台〜', '¥35,000', '＋¥8,000 〜 ¥18,000'],
    en: ['from ¥10,000', '¥35,000', '+¥8,000–18,000'],
    ko: ['¥10,000대부터', '¥35,000', '+¥8,000~18,000'],
  };

  const extraPersonRows: Record<Locale, OptionRow[]> = {
    ja: [
      { label: '1名様 追加', price: '＋¥3,300', note: 'STUDIO 04 ・ 記念写真は ＋¥3,000' },
      { label: 'ヘアメイク 追加', price: '＋¥22,000', note: 'STUDIO 04' },
    ],
    en: [
      { label: 'Extra person', price: '+¥3,300', note: 'Studio 04 · anniversary portraits +¥3,000' },
      { label: 'Hair & make-up', price: '+¥22,000', note: 'Studio 04' },
    ],
    ko: [
      {
        label: '인원 추가 / 헤어메이크업 추가',
        price: '+¥3,300 / +¥22,000',
        note: '스튜디오 04 · 기념사진은 1명 +¥3,000',
      },
    ],
  };

  return [
    { label: groom.label[locale], price: groom.price[locale], note: notes[locale][0] },
    { label: raw.label[locale], price: raw.price[locale], note: notes[locale][1] },
    { label: premium.label[locale], price: premium.price[locale], note: notes[locale][2] },
    ...extraPersonRows[locale],
    { label: labels[locale][0], price: prices[locale][0], note: notes[locale][3] },
    { label: labels[locale][1], price: prices[locale][1], note: notes[locale][4] },
    { label: labels[locale][2], price: prices[locale][2], note: notes[locale][5] },
  ];
}

/* ---------------- 헤어메이크업 ---------------- */

export const HAIR = {
  label: { ja: 'HAIR & MAKE', en: 'HAIR & MAKE-UP', ko: 'HAIR & MAKE-UP' } satisfies L10n,
  title: {
    ja: 'ヘアメイク',
    en: 'For location sessions',
    ko: '헤어메이크업',
  } satisfies L10n,
  shops: [
    {
      name: {
        ja: '那覇市 ・ 韓国スタイル',
        en: 'Naha · Korean style',
        ko: '나하시 · 한국 스타일',
      } satisfies L10n,
      body: {
        ja: 'ショップ仕上げ ¥25,000 ／ Basic アテンド ¥18,000 ／ Afterfull アテンド ¥23,000（ヘアチェンジ付き）',
        en: 'Salon finish ¥25,000 / Basic attend ¥18,000 / Afterfull attend ¥23,000 (hair change included)',
        ko: '숍 마무리 ¥25,000 / Basic 동행 ¥18,000 / Afterfull 동행 ¥23,000 (헤어 체인지 포함)',
      } satisfies L10n,
    },
    {
      name: {
        ja: '宜野湾市 ・ 自然な日本スタイル',
        en: 'Ginowan · natural Japanese style',
        ko: '기노완시 · 자연스러운 일본 스타일',
      } satisfies L10n,
      body: {
        ja: 'ショップ仕上げ ¥27,000 ／ Basic アテンド ¥18,000 ／ Afterfull アテンド ¥23,000',
        en: 'Salon finish ¥27,000 / Basic attend ¥18,000 / Afterfull attend ¥23,000',
        ko: '숍 마무리 ¥27,000 / Basic 동행 ¥18,000 / Afterfull 동행 ¥23,000',
      } satisfies L10n,
    },
  ],
  common: {
    ja: '共通 — 新郎ヘアセット・簡単メイク付き ／ 週末料金 ¥6,000 ／ 朝料金 ¥2,000〜4,000',
    en: "Both include the groom's hair and light make-up · weekend fee ¥6,000 · early morning ¥2,000–4,000",
    ko: '공통 — 신랑 헤어세팅 · 간단 메이크업 포함 / 주말 요금 ¥6,000 / 이른 아침 ¥2,000~4,000',
  } satisfies L10n,
};

/* ---------------- 계약 흐름 ---------------- */

export const FLOW = {
  label: { ja: 'FLOW', en: 'HOW IT WORKS', ko: 'FLOW' } satisfies L10n,
  title: {
    ja: 'ご契約の流れ',
    en: 'Booking steps',
    ko: '예약 절차',
  } satisfies L10n,
  steps: {
    ja: [
      '撮影のご相談（フォーム ・ LINE）',
      '契約金のお振込（総額の50%）',
      '契約書の作成・ご確認（ご署名）',
      '撮影当日・残金のお支払い',
    ],
    en: [
      /**
       * 카드 원문은 "form or email" 이었지만, 상담 채널 규칙상 영어권 채널은
       * Instagram 이고 이메일 주소는 어디에도 노출하지 않는다 — 규칙이 카드보다 우선한다.
       */
      'Tell us your dates (form or Instagram)',
      'Deposit of 50% of the total',
      'Contract issued and signed',
      'Session day and balance payment',
    ],
    ko: [
      '상담 (카카오톡 amipaek · 인스타그램 DM)',
      '계약금 입금 (촬영 플랜의 50%)',
      '계약서 작성 · 예약 확정',
      '잔금 입금 · 촬영일',
    ],
  } satisfies L10nList,
  /** 2번 단계에만 붙는 보조 문장 */
  depositNote: {
    ja: '入金確認後にスケジュール確定',
    en: 'The date is confirmed once it arrives',
    ko: '입금 확인 후 일정 확정',
  } satisfies L10n,
};

/* ---------------- 취소 · 우천 ---------------- */

export const NOTES = {
  label: { ja: 'NOTES', en: 'NOTES', ko: 'NOTES' } satisfies L10n,
  title: {
    ja: 'キャンセル ・ 雨天について',
    en: 'Cancellation and weather',
    ko: '취소 · 우천 안내',
  } satisfies L10n,
  cancel: {
    ja: '契約金の入金時刻から48時間以降は契約確定となり、契約金の払い戻しはできません。天災地変以外のご都合によるキャンセルの場合、お見積りに対して違約金が発生します。',
    en: '48 hours after the deposit is received, the booking is confirmed and the deposit is non-refundable. Cancellations for personal reasons are subject to a fee based on the quotation.',
    ko: '계약금 입금 시각 기준 48시간 이후에는 계약이 확정되어 계약금 환불이 어렵습니다. 천재지변 외 개인 사정으로 취소하실 경우, 견적 금액 기준 위약금이 발생합니다.',
  } satisfies L10n,
  cancelScale: {
    ja: '撮影日 31〜40日前 20% ／ 16〜30日前 30% ／ 8〜15日前 60% ／ 7日前〜当日 100%',
    en: '31–40 days before 20% · 16–30 days 30% · 8–15 days 60% · 7 days to the day itself 100%',
    ko: '촬영 31~40일 전 20% · 16~30일 전 30% · 8~15일 전 60% · 7일 전~당일 100%',
  } satisfies L10n,
  rain: {
    ja: '雨天でも撮影は行いますが、ご滞在中に振替が可能な日時があれば、できる限り調整いたします。',
    en: 'We still photograph in the rain, and we will try to reschedule within your stay whenever possible.',
    ko: '비가 와도 촬영은 진행합니다. 체류 중에 대체 가능한 날짜와 시간이 있으면 최대한 조정해 드립니다.',
  } satisfies L10n,
  typhoon: {
    ja: '台風など対処が不可能な場合のみ、100%払い戻し、または6ヶ月以内の延期が可能です。',
    en: 'For typhoons and similar situations, a full refund or a postponement within 6 months is possible.',
    ko: '태풍처럼 대응이 불가능한 경우에만 100% 환불 또는 6개월 이내 연기가 가능합니다.',
  } satisfies L10n,
  typhoonSub: {
    ja: '公的な理由（隔離・欠航など）はキャンセル手数料なし・契約金も払い戻し。',
    en: 'Public reasons such as quarantine or cancelled flights carry no cancellation fee, and the deposit is refunded.',
    ko: '격리 · 결항 등 공적인 사유는 취소 수수료 없이 계약금도 환불해 드립니다.',
  } satisfies L10n,
};

/**
 * FAQ 질문은 ja / en 모바일 카드에만 있다.
 * ko 카드에는 없으므로 ko 는 질문 없이 본문만 보여주고 FAQPage 도 내보내지 않는다.
 */
export const FAQ_QUESTIONS: Partial<Record<Locale, [string, string, string]>> = {
  ja: ['キャンセル料はかかりますか？', '雨の日はどうなりますか？', '台風で行けなくなったら？'],
  en: [
    'Is there a cancellation fee?',
    'What happens if it rains?',
    'What if a typhoon cancels my flight?',
  ],
};

/* ---------------- 한국어 전용 상품 구성 ----------------
 *
 * 한국 고객 대상 상품은 일본어판과 별개다 (근거: usherinmaking.com/korean).
 * 플랜명·가격(원화)·제공 내역(원본 + 몸매보정/색감보정)이 모두 다르므로
 * ko 로케일은 아래 데이터로만 렌더하고, JA/EN 의 스튜디오·로케이션 플랜은 쓰지 않는다.
 */

export const KO_TABS = {
  wedding: '웨딩 촬영',
  etc: '기타 촬영',
};

export const KO_WEDDING_PLANS: Plan[] = [
  {
    code: 'ko-basic',
    scope: 'location',
    badge: '웨딩 촬영',
    title: koOnly('베이직'),
    duration: koOnly('촬영 시간 2시간 30분'),
    price: 880000,
    currency: 'KRW',
    priceText: '88만원',
    taxIncluded: false,
    includes: koOnlyList([
      '의상 2벌 이내',
      '장소 2곳 (탈착의 시간 · 이동 시간 포함)',
      '원본 + 몸매보정 25컷 제공',
    ]),
  },
  {
    code: 'ko-afterfull',
    scope: 'location',
    badge: '웨딩 촬영',
    title: koOnly('에프터풀'),
    duration: koOnly('촬영 시간 4시간'),
    price: 1100000,
    currency: 'KRW',
    priceText: '110만원',
    taxIncluded: false,
    includes: koOnlyList([
      '의상 3~4벌 이내',
      '장소 3곳 (탈착의 시간 · 이동 시간 포함)',
      '원본 + 몸매보정 35컷 제공',
    ]),
  },
];

export const KO_ETC_PLANS: Plan[] = [
  {
    code: 'ko-standard',
    scope: 'location',
    badge: '기타 촬영',
    title: koOnly('스탠다드'),
    duration: koOnly('촬영 시간 1시간'),
    price: 300000,
    currency: 'KRW',
    priceText: '30만원',
    taxIncluded: false,
    includes: koOnlyList(['장소 1곳 (탈착의 시간 포함)', '원본 + 색감보정 15컷 제공']),
  },
  {
    code: 'ko-upto',
    scope: 'location',
    badge: '기타 촬영',
    title: koOnly('업투'),
    duration: koOnly('촬영 시간 2시간'),
    price: 500000,
    currency: 'KRW',
    priceText: '50만원',
    taxIncluded: false,
    includes: koOnlyList(['장소 2곳 (탈착의 시간 · 이동 시간 포함)', '원본 + 색감보정 24컷 제공']),
  },
];

/** 기타 촬영 탭 하단 공통사항 — 원문 그대로 */
export const KO_ETC_NOTES = ['의상은 제공하지 않습니다.', '웨딩 의상 착장은 불가합니다.'];

/** 웨딩 촬영 탭 하단 — 커플 · 가족 촬영 안내 */
export const KO_WEDDING_NOTE =
  '에메랄드 산호 바다와 보타니컬한 오키나와 섬의 아름다움 속에서 웨딩 · 커플 · 가족 촬영으로 추억을 남겨보세요.';

/** ko 옵션 표 — 원본 페이지의 옵션 절(영상 · 드레스 · 헤어메이크업 · 주말 요금)을 그대로 옮긴다. */
export const KO_OPTION_ROWS: OptionRow[] = [
  {
    label: '영상 촬영 (기간 한정)',
    price: '제공',
    note: '100초 내외의 편집 영상 제공',
  },
  {
    label: '드레스 대여 (1벌 + 액세서리 + 소품)',
    price: '10만원부터',
    note: '신부 드레스만 대여 가능 · 신랑 의상은 직접 준비 / 액세서리 · 소품은 드레스에 맞춰 작가가 매칭 (선택 불가)',
  },
  {
    label: '헤어/메이크업 기본형',
    price: '25만원',
    note: '신랑 신부 헤어/메이크업 · 오키나와 현지 숍 이용',
  },
  {
    label: '헤어/메이크업 헬퍼형',
    price: '42만원부터',
    note: '신랑 신부 헤어/메이크업 + 헬퍼 (신부 헤어 체인지 1회 포함)',
  },
  {
    label: '주말 · 휴일 추가 요금 (일본 기준)',
    price: '+6만원',
    note: '헤어/메이크업 이용 시',
  },
];

/** ko 드레스 안내 — 옵션 표 아래 보조 문장 */
export const KO_OPTION_NOTES = [
  '드레스 피팅은 불가하며, 드레스 디자인과 사이즈는 상담을 통해 선택 가능합니다.',
];

export const META_TITLE: L10n = {
  ja: 'プラン ・ スタジオとロケーションの料金',
  en: 'Plans and pricing — studio and location',
  // 한국 고객 상품은 웨딩·기타 촬영 두 갈래다 — 스튜디오 플랜은 팔지 않는다.
  ko: '플랜 안내 · 웨딩 촬영과 기타 촬영',
};
