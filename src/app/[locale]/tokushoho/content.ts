import type { Locale } from '@/lib/i18n';
import { STUDIO_INFO } from '@/content/site';
import { NOTES } from '@/components/plan/content';

type L10n = Record<Locale, string>;

/**
 * 취소 규정은 요금 페이지가 정본이다(`components/plan/content` 의 NOTES).
 * 여기에 문장을 다시 적으면 두 곳이 어긋나고, 법정 표기 쪽이 낡은 값을 말하게 된다.
 */
const cancelPolicy: L10n = {
  ja: `${NOTES.cancel.ja} ${NOTES.cancelScale.ja} ${NOTES.typhoon.ja}`,
  en: `${NOTES.cancel.en} ${NOTES.cancelScale.en} ${NOTES.typhoon.en}`,
  ko: `${NOTES.cancel.ko} ${NOTES.cancelScale.ko} ${NOTES.typhoon.ko}`,
};

export const TOKUSHOHO_TITLE: L10n = {
  ja: '特定商取引法に基づく表記',
  en: 'Notation based on the Act on Specified Commercial Transactions',
  ko: '특정상거래법에 근거한 표기',
};

export const TOKUSHOHO_INTRO: L10n = {
  ja: '本ページは、特定商取引に関する法律（特定商取引法）第11条に基づく表記です。当スタジオが提供する撮影サービス（役務）に関する取引条件をご案内します。',
  en: 'This page is the notation required by Article 11 of Japan\'s Act on Specified Commercial Transactions. It sets out the terms on which the studio provides its photography service.',
  ko: '본 페이지는 일본 특정상거래에 관한 법률(특정상거래법) 제11조에 근거한 표기입니다. 스튜디오가 제공하는 촬영 서비스(역무)의 거래 조건을 안내합니다.',
};

/** 아직 사업자 정보를 받지 못한 항목은 pending: true. TBC 토큰으로 렌더한다. */
export type Row = { label: L10n; value?: L10n; pending?: boolean; note?: L10n };

export const TOKUSHOHO_ROWS: Row[] = [
  {
    label: { ja: '事業者名（販売事業者）', en: 'Business name', ko: '사업자명' },
    value: { ja: 'usherinmaking（屋号）', en: 'usherinmaking (trading name)', ko: 'usherinmaking (상호)' },
  },
  {
    label: { ja: '運営統括責任者', en: 'Person responsible', ko: '운영 총괄 책임자' },
    pending: true,
  },
  {
    // 주소는 2026-08-10 에 확정됐고 문의·스튜디오 페이지와 구조화 데이터에 이미 공개돼 있다.
    // 법정 표기에서만 "(확인 필요)"로 두면 같은 사이트가 서로 다른 말을 하게 된다.
    label: { ja: '所在地', en: 'Address', ko: '소재지' },
    value: STUDIO_INFO.address,
  },
  {
    label: { ja: '電話番号', en: 'Telephone', ko: '전화번호' },
    pending: true,
    note: {
      ja: '請求があった場合は遅滞なく開示します。',
      en: 'Disclosed without delay on request.',
      ko: '청구가 있을 경우 지체 없이 공개합니다.',
    },
  },
  {
    label: { ja: 'お問い合わせ', en: 'Contact', ko: '문의' },
    value: {
      ja: '当サイトのお問い合わせフォーム、LINE、Instagram（@usherinmaking）よりご連絡いただけます。',
      en: 'Through the enquiry form on this site or Instagram (@usherinmaking).',
      ko: '이 사이트의 문의 폼, 카카오톡, Instagram(@usherinmaking)으로 연락하실 수 있습니다.',
    },
  },
  {
    label: { ja: '販売価格（役務の対価）', en: 'Price', ko: '판매 가격 (역무의 대가)' },
    value: {
      ja: '各撮影プランのページに表示する料金によります。ロケーション・記念写真の料金は税込表示、スタジオプランはモニター価格の表示です。',
      en: 'As shown on each plan page. Location and anniversary prices include tax; studio plans are shown as monitor prices.',
      // 한국 고객 상품은 원화 상품 두 갈래다 — 스튜디오 플랜·모니터 가격은 일본어 상품 얘기다.
      ko: '각 촬영 플랜 페이지에 표시된 요금에 따릅니다. 웨딩 촬영과 기타 촬영 요금은 원화 표시이며, 의상·헤어메이크업 등은 옵션 요금이 별도로 발생합니다.',
    },
  },
  {
    label: {
      ja: '商品代金以外の必要料金',
      en: 'Charges beyond the price',
      ko: '상품 대금 외 필요 요금',
    },
    value: {
      ja: 'ロケーション地までの交通費・出張費、ドレスレンタル等のオプション料金、振込手数料等が別途発生する場合があります。詳細は料金ページまたは個別のお見積りにてご案内します。',
      en: 'Travel to a location, optional charges such as dress rental, and bank transfer fees may apply separately. The plan page or an individual quote sets these out.',
      ko: '로케이션 장소까지의 교통비·출장비, 드레스 대여 등 옵션 요금, 송금 수수료 등이 별도로 발생할 수 있습니다. 자세한 내용은 요금 페이지 또는 개별 견적으로 안내합니다.',
    },
  },
  { label: { ja: '支払方法', en: 'Payment method', ko: '지불 방법' }, pending: true },
  { label: { ja: '支払時期', en: 'Payment timing', ko: '지불 시기' }, pending: true },
  {
    label: { ja: '役務の提供時期', en: 'When the service is provided', ko: '역무 제공 시기' },
    value: {
      ja: '撮影は、ご相談のうえ確定した撮影日に実施します。撮影データ・作品の納品時期は個別にご案内します。',
      en: 'The shoot takes place on the date agreed in conversation. We confirm the delivery date for the data and the finished work individually.',
      ko: '촬영은 상담을 통해 확정한 촬영일에 실시합니다. 촬영 데이터·작품의 납품 시기는 개별적으로 안내합니다.',
    },
    note: {
      ja: '自動予約・カレンダー予約はありません。お問い合わせのあと、ご相談のうえで確定します。',
      en: 'There is no automatic or calendar booking. Everything is confirmed by conversation after you get in touch.',
      ko: '자동 예약·캘린더 예약은 없습니다. 문의를 주시면 상담을 통해 확정합니다.',
    },
  },
  {
    // 취소 규정은 요금 페이지에 전문이 공개돼 있다 — 법정 표기가 가장 필요한 항목이기도 하다.
    label: {
      ja: 'キャンセル・変更について',
      en: 'Cancellation and changes',
      ko: '취소·변경',
    },
    value: cancelPolicy,
    note: {
      ja: 'キャンセル料の発生時期と料率、日程変更の可否、悪天候時の取り扱いを含みます。',
      en: 'Covers when a cancellation fee applies and at what rate, whether a date can be moved, and what happens in bad weather.',
      ko: '취소 수수료 발생 시기와 요율, 일정 변경 가능 여부, 악천후 시의 취급을 포함합니다.',
    },
  },
  {
    label: { ja: '返金ポリシー', en: 'Refunds', ko: '환불 정책' },
    value: {
      ja: '役務（撮影サービス）の性質上、撮影実施後・納品後の返金は原則承っておりません。キャンセルに伴う既受領金の返金は、上記キャンセル規定によります。',
      en: 'Because this is a service, we do not as a rule refund after the shoot has taken place or the work has been delivered. Any refund of money already received on cancellation follows the cancellation terms above.',
      ko: '역무(촬영 서비스)의 성격상 촬영 실시 후·납품 후의 환불은 원칙적으로 받지 않습니다. 취소에 따른 기수령액의 환불은 위 취소 규정에 따릅니다.',
    },
  },
  {
    label: { ja: 'その他', en: 'Other', ko: '기타' },
    value: {
      ja: '撮影内容、納品形式、著作権・写真の利用範囲等の詳細は、撮影日の確定前に個別にご案内します。ご不明な点はお問い合わせください。',
      en: 'What the shoot covers, the delivery format, and the copyright and permitted use of the photographs are set out individually before the date is fixed. Please ask if anything is unclear.',
      ko: '촬영 내용, 납품 형식, 저작권·사진 이용 범위 등의 상세는 촬영일 확정 전에 개별적으로 안내합니다. 궁금한 점은 문의해 주십시오.',
    },
  },
];

export const TOKUSHOHO_UPDATED: L10n = {
  ja: '最終更新日：2026年7月26日',
  en: 'Last updated 26 July 2026.',
  ko: '최종 갱신일: 2026년 7월 26일',
};
