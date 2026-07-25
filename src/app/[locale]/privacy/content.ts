import type { Locale } from '@/lib/i18n';

type L10n = Record<Locale, string>;

export type Clause = { no: string; heading: L10n; body: L10n[] };

export const PRIVACY_TITLE: L10n = {
  ja: 'プライバシーポリシー',
  en: 'Privacy Policy',
  ko: '개인정보 처리방침',
};

export const PRIVACY_SUBTITLE: L10n = {
  ja: '個人情報保護方針',
  en: 'How we handle your personal information',
  ko: '개인정보 보호방침',
};

/**
 * 기존 사이트의 법적 문안을 그대로 승계하되, 리뉴얼로 사라진 사실만 고쳤다.
 * - 브랜드 표기를 한 단어 usherinmaking 으로 통일
 * - 자동 예약 기능이 없어졌으므로 「ご予約フォーム」 문구를 문의 폼으로 정리
 */
export const PRIVACY_INTRO: L10n = {
  ja: 'usherinmaking（以下「当スタジオ」といいます）は、沖縄でのウェディングフォト・記念日撮影等のサービスを提供するにあたり、お客様の個人情報の重要性を認識し、個人情報の保護に関する法律（個人情報保護法）その他の関係法令・ガイドラインを遵守し、適切に取り扱います。本ポリシーは、当ウェブサイトのお問い合わせフォーム等を通じて取得する個人情報の取り扱いについて定めるものです。',
  en: 'usherinmaking (below, "the studio") provides wedding and anniversary photography in Okinawa. We treat the personal information you give us as important, and we handle it in line with Japan\'s Act on the Protection of Personal Information and the related guidance. This policy covers the information we receive through the enquiry form on this site.',
  ko: 'usherinmaking(이하 「스튜디오」)은 오키나와에서 웨딩·기념일 촬영 서비스를 제공하면서 고객의 개인정보를 중요하게 다루며, 일본 개인정보보호법과 관련 법령·지침을 준수해 적절히 취급합니다. 본 방침은 이 웹사이트의 문의 폼을 통해 취득하는 개인정보의 취급을 정합니다.',
};

export const PRIVACY_CLAUSES: Clause[] = [
  {
    no: '01',
    heading: {
      ja: '取得する個人情報',
      en: 'What we collect',
      ko: '취득하는 개인정보',
    },
    body: [
      {
        ja: '当スタジオは、お問い合わせ・撮影に関するご連絡のため、必要な範囲で以下の情報を取得します。お名前、メールアドレス、ご連絡先（SNSアカウント等、お客様がご連絡にご利用される手段を含みます）、ご希望の撮影日・撮影プラン、お問い合わせの内容（メッセージ本文）、その他フォーム送信時に自動的に送信される技術的情報（送信日時、ブラウザのユーザーエージェント情報等）。',
        en: 'We collect only what we need in order to answer you and to arrange a shoot: your name, your email address, the channel you prefer to be reached on (including a social account), the dates and plan you have in mind, the content of your message, and the technical details a form submission carries with it, such as the time of sending and your browser user agent.',
        ko: '문의 및 촬영 관련 연락을 위해 필요한 범위에서 다음을 취득합니다. 성명, 이메일 주소, 연락 수단(고객이 사용하는 SNS 계정 등 포함), 희망 촬영일과 촬영 플랜, 문의 내용(메시지 본문), 그리고 폼 전송 시 자동으로 전달되는 기술 정보(전송 일시, 브라우저 사용자 에이전트 등).',
      },
      {
        ja: '入力は任意であり、必須項目以外は未入力のままでも送信いただけます。ただし、必須項目が未入力の場合、お問い合わせへの対応ができないことがあります。',
        en: 'Everything is optional beyond the required fields, and you may leave the rest blank. If a required field is empty, though, we may not be able to respond.',
        ko: '입력은 임의이며 필수 항목 외에는 비워 두어도 전송하실 수 있습니다. 다만 필수 항목이 비어 있으면 문의에 답변드리지 못할 수 있습니다.',
      },
    ],
  },
  {
    no: '02',
    heading: { ja: '利用目的', en: 'Why we use it', ko: '이용 목적' },
    body: [
      {
        ja: 'お問い合わせ・ご相談への回答および対応、撮影のご相談・日程の調整に関するご連絡、撮影サービスの提供、料金のご案内およびご請求、サービス向上のためのご案内、法令に基づく対応、その他上記に付随する業務のために利用します。',
        en: 'To answer your enquiry, to talk through and arrange a shoot, to provide the photography itself, to quote and invoice, to let you know about the service, to meet a legal obligation, and for work directly attached to those purposes.',
        ko: '문의·상담에 대한 답변과 대응, 촬영 상담 및 일정 조율 연락, 촬영 서비스 제공, 요금 안내와 청구, 서비스 향상을 위한 안내, 법령에 따른 대응, 그리고 위에 부수하는 업무를 위해 이용합니다.',
      },
      {
        ja: '利用目的を超えて個人情報を利用する場合は、あらかじめご本人の同意を得るものとします。',
        en: 'If we ever need to use your information beyond these purposes, we will ask you first.',
        ko: '이용 목적을 넘어 개인정보를 이용해야 할 경우에는 미리 본인의 동의를 얻습니다.',
      },
    ],
  },
  {
    no: '03',
    heading: {
      ja: '第三者への提供',
      en: 'Sharing with third parties',
      ko: '제3자 제공',
    },
    body: [
      {
        ja: '当スタジオは、法令に基づく場合、人の生命・身体または財産の保護のために必要でご本人の同意を得ることが困難な場合、国の機関等の法令の定める事務の遂行に協力する必要がある場合を除き、ご本人の同意なく個人情報を第三者に提供することはありません。',
        en: 'We do not pass your information to anyone else without your consent, except where the law requires it, where it is needed to protect someone\'s life, body or property and consent cannot practically be obtained, or where we must co-operate with a public authority carrying out a statutory duty.',
        ko: '법령에 근거한 경우, 사람의 생명·신체 또는 재산 보호를 위해 필요하고 본인의 동의를 얻기 어려운 경우, 국가기관 등의 법정 사무 수행에 협력할 필요가 있는 경우를 제외하고는 본인의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.',
      },
    ],
  },
  {
    no: '04',
    heading: {
      ja: '外部サービスの利用（業務委託）',
      en: 'Processors we rely on',
      ko: '외부 서비스 이용 (업무 위탁)',
    },
    body: [
      {
        ja: '当スタジオは、フォーム送信内容の受付・通知メールの配信等のために外部のサービス事業者を利用しています。業務の遂行に必要な範囲で、個人情報を当該事業者のサーバー等に保管・処理することがあります。当スタジオは委託先に対し適切な監督を行います。各サービスにおける個人情報の取り扱いは、それぞれの提供事業者のプライバシーポリシーにも従います。',
        en: 'We use outside providers to receive form submissions and to deliver notification email. Within what the work requires, your information may be stored and processed on their servers. We supervise them appropriately, and their own privacy policies also apply to how they handle it.',
        ko: '폼 전송 내용의 접수와 알림 메일 발송 등을 위해 외부 서비스 사업자를 이용합니다. 업무 수행에 필요한 범위에서 개인정보가 해당 사업자의 서버에 보관·처리될 수 있습니다. 스튜디오는 위탁처를 적절히 감독하며, 각 서비스의 개인정보 취급은 해당 사업자의 개인정보 처리방침도 함께 따릅니다.',
      },
    ],
  },
  {
    no: '05',
    heading: {
      ja: 'Cookie・アクセス解析について',
      en: 'Cookies and analytics',
      ko: '쿠키와 접속 분석',
    },
    body: [
      {
        ja: '当ウェブサイトは、言語設定の保存を目的とした Cookie を利用します。現時点で、アクセス解析や広告配信を目的とした Cookie の利用は行っていません。今後導入する場合には、本ポリシーを改定のうえその旨を掲載します。お客様はブラウザの設定により Cookie の受け取りを拒否することができますが、その場合、一部機能がご利用いただけないことがあります。',
        en: 'This site uses a cookie to remember which language you chose. We do not currently use cookies for analytics or advertising. If that changes we will revise this policy and say so here. You can refuse cookies in your browser settings, though some functions may then stop working.',
        ko: '이 웹사이트는 언어 설정을 기억하기 위한 쿠키를 사용합니다. 현재 접속 분석이나 광고를 목적으로 한 쿠키는 사용하지 않습니다. 향후 도입할 경우 본 방침을 개정하고 그 사실을 게재합니다. 브라우저 설정으로 쿠키 수신을 거부하실 수 있으나, 그 경우 일부 기능을 이용하지 못할 수 있습니다.',
      },
    ],
  },
  {
    no: '06',
    heading: {
      ja: '個人情報の保有期間',
      en: 'How long we keep it',
      ko: '개인정보 보유 기간',
    },
    body: [
      {
        ja: '取得した個人情報は、利用目的の達成に必要な期間に限り保有し、目的を達成した後または保有の必要がなくなった場合には、適切な方法で速やかに消去または廃棄するよう努めます。法令により保存期間が定められている場合は、当該期間保有します。',
        en: 'We keep your information only for as long as the purpose requires. Once that purpose is met, or the need to hold it ends, we delete or dispose of it promptly and properly. Where the law sets a retention period, we keep it for that period.',
        ko: '취득한 개인정보는 이용 목적 달성에 필요한 기간에 한해 보유하며, 목적을 달성한 후 또는 보유할 필요가 없어진 경우에는 적절한 방법으로 신속히 삭제 또는 폐기하도록 노력합니다. 법령에 보존 기간이 정해진 경우에는 해당 기간 동안 보유합니다.',
      },
    ],
  },
  {
    no: '07',
    heading: {
      ja: '安全管理措置',
      en: 'Keeping it safe',
      ko: '안전관리 조치',
    },
    body: [
      {
        ja: '当スタジオは、個人情報の漏えい、滅失またはき損の防止その他の安全管理のために、必要かつ適切な措置を講じるよう努めます。',
        en: 'We take the measures needed to guard against leakage, loss or damage to your personal information.',
        ko: '스튜디오는 개인정보의 누출, 멸실 또는 훼손 방지와 그 밖의 안전관리를 위해 필요하고 적절한 조치를 강구하도록 노력합니다.',
      },
    ],
  },
  {
    no: '08',
    heading: {
      ja: '開示・訂正・利用停止・削除のご請求',
      en: 'Access, correction and deletion',
      ko: '열람·정정·이용정지·삭제 청구',
    },
    body: [
      {
        ja: 'ご本人から、ご自身の個人情報の開示・訂正・追加・削除・利用停止・第三者提供の停止等のお申し出があった場合は、ご本人であることを確認のうえ、法令に従い合理的な範囲で速やかに対応します。お申し出は、下記のお問い合わせ窓口までご連絡ください。',
        en: 'If you ask to see, correct, add to, delete or stop the use of your own information, or to stop it being shared, we will confirm it is you and then act promptly, within what the law and reason allow. Use the contact route below.',
        ko: '본인으로부터 자신의 개인정보에 대한 열람·정정·추가·삭제·이용정지·제3자 제공 정지 등의 신청이 있을 경우, 본인 확인 후 법령에 따라 합리적인 범위에서 신속히 대응합니다. 신청은 아래 문의 창구로 연락 주십시오.',
      },
    ],
  },
  {
    no: '09',
    heading: {
      ja: 'お問い合わせ窓口',
      en: 'Where to reach us',
      ko: '문의 창구',
    },
    body: [
      {
        ja: '個人情報の取り扱いに関するお問い合わせ・ご請求は、当ウェブサイトのお問い合わせフォーム、LINE、または Instagram（@usherinmaking）よりご連絡ください。フォーム送信後、当スタジオよりご連絡いたします。',
        en: 'For anything about how we handle your information, use the enquiry form on this site or Instagram (@usherinmaking). We will come back to you after you send the form.',
        ko: '개인정보 취급에 관한 문의·청구는 이 웹사이트의 문의 폼, 카카오톡, 또는 Instagram(@usherinmaking)으로 연락 주십시오. 폼을 보내주시면 스튜디오에서 연락드립니다.',
      },
    ],
  },
  {
    no: '10',
    heading: {
      ja: '本ポリシーの改定',
      en: 'Changes to this policy',
      ko: '본 방침의 개정',
    },
    body: [
      {
        ja: '当スタジオは、法令の変更やサービス内容の変更等に応じて、本ポリシーを予告なく改定することがあります。改定後の内容は、当ウェブサイトに掲載した時点から効力を生じるものとします。',
        en: 'We may revise this policy without notice as the law or the service changes. A revision takes effect when it is published on this site.',
        ko: '법령의 변경이나 서비스 내용 변경 등에 따라 본 방침을 예고 없이 개정할 수 있습니다. 개정된 내용은 이 웹사이트에 게재된 시점부터 효력이 발생합니다.',
      },
    ],
  },
];

export const PRIVACY_DATES: L10n = {
  ja: '制定日：2026年6月6日 ／ 最終改定日：2026年7月26日',
  en: 'Established 6 June 2026. Last revised 26 July 2026.',
  ko: '제정일: 2026년 6월 6일 / 최종 개정일: 2026년 7월 26일',
};
