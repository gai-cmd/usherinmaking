import { maskEmail } from '@/server/inquiries';
import { CONTACT } from '@/app/[locale]/contact/content';
import { isLocale, type Locale } from '@/lib/i18n';

/**
 * 문의 알림 전송기.
 *
 * DB가 원본이고 이 모듈은 사본(알림)만 다룬다. 그래서 이 모듈의 함수는 절대 throw 하지 않고,
 * 실패나 미설정 상태를 값으로 돌려준다 — 호출부(contact 라우트)가 알림 결과를 몰라도
 * 접수 흐름이 끊기지 않도록 하기 위해서다.
 *
 * 이메일(Resend REST API)로 두 통을 보낸다 — 운영자에게 가는 알림 1통과, 문의한 사람에게
 * 가는 접수 확인 1통(문의자가 고른 답변 언어로). 이 둘은 서로 독립적으로 시도되고 결과도
 * 따로 로그로 남는다 — 하나가 실패해도 다른 하나는 계속 시도된다.
 */

/** contact 라우트의 Enquiry 스키마와 의도적으로 분리한 최소 필드. 검증 스키마 변경에 얽매이지 않는다. */
export type InquiryNotification = {
  id: string;
  name: string;
  email: string;
  sessionType: string;
  preferredDates: string;
  people: string;
  message: string;
  locale: string;
  replyIn: string;
};

export type NotifyOutcome =
  | { sent: true }
  | { sent: false; reason: 'not_configured' | 'send_failed' };

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
/** Resend 문서 예시의 발신 주소. 운영 도메인이 확정되면 RESEND_FROM 으로 덮어쓴다. */
const DEFAULT_FROM = 'usherinmaking <onboarding@resend.dev>';

/** 두 통(운영자 알림 · 문의자 확인)의 발송 결과. 하나가 실패해도 다른 하나는 별개로 시도된다. */
export type NotifyResult = {
  operator: NotifyOutcome;
  customer: NotifyOutcome;
};

/**
 * 문의 알림 발송 — 운영자 알림 1통 + 문의자 확인 메일 1통을 병렬로 시도한다.
 * RESEND_API_KEY 가 없으면 둘 다 건너뛴다. NOTIFY_TO 만 없으면 운영자 알림만 건너뛰고
 * 문의자 확인 메일은 계속 시도한다 — 두 수신자는 서로 다른 설정에 의존하기 때문이다.
 * 자격 증명 부재는 오류가 아니라 "아직 설정 안 됨" 이다. 콘솔 로그에는 이메일 원문을
 * 절대 남기지 않는다(maskEmail).
 */
export async function notifyInquiry(inquiry: InquiryNotification): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[notify] 건너뜀 — RESEND_API_KEY 없음 (문의 ${inquiry.id})`);
    const skipped: NotifyOutcome = { sent: false, reason: 'not_configured' };
    return { operator: skipped, customer: skipped };
  }

  const from = process.env.RESEND_FROM || DEFAULT_FROM;

  const [operator, customer] = await Promise.all([
    sendOperatorMail(apiKey, from, inquiry),
    sendCustomerConfirmation(apiKey, from, inquiry),
  ]);

  return { operator, customer };
}

/** 운영자 알림. NOTIFY_TO 가 없으면 건너뛴다. */
async function sendOperatorMail(
  apiKey: string,
  from: string,
  inquiry: InquiryNotification,
): Promise<NotifyOutcome> {
  const to = process.env.NOTIFY_TO;
  if (!to) {
    console.log(`[notify] 운영자 알림 건너뜀 — NOTIFY_TO 없음 (문의 ${inquiry.id})`);
    return { sent: false, reason: 'not_configured' };
  }

  return sendMail({
    apiKey,
    from,
    to,
    subject: `[문의] ${inquiry.name} — ${inquiry.sessionType}`,
    text: buildOperatorBody(inquiry),
    label: `문의 ${inquiry.id} 운영자 알림`,
  });
}

/** 문의자 확인 메일. 문의자가 고른 답변 언어(replyIn)로 보낸다. */
async function sendCustomerConfirmation(
  apiKey: string,
  from: string,
  inquiry: InquiryNotification,
): Promise<NotifyOutcome> {
  const locale: Locale = isLocale(inquiry.replyIn) ? inquiry.replyIn : 'ja';

  return sendMail({
    apiKey,
    from,
    to: inquiry.email,
    subject: CONFIRMATION_SUBJECT[locale],
    text: buildCustomerBody(inquiry, locale),
    label: `문의 ${inquiry.id} 확인 메일 (${maskEmail(inquiry.email)})`,
  });
}

async function sendMail(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  /** 로그에 남길 이름표. 이메일 원문은 절대 넣지 않는다. */
  label: string;
}): Promise<NotifyOutcome> {
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: args.from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[notify] 발송 실패 — 상태 ${res.status} (${args.label}) ${detail.slice(0, 200)}`);
      return { sent: false, reason: 'send_failed' };
    }

    return { sent: true };
  } catch (err) {
    // 네트워크 예외 등. 여기서도 throw 하지 않는다 — 접수는 이미 끝났다.
    console.error(`[notify] 발송 예외 (${args.label})`, err);
    return { sent: false, reason: 'send_failed' };
  }
}

/** 운영자 전용 메일 본문. 운영자에게 가는 사본이므로 이메일 원문을 포함한다. */
function buildOperatorBody(inquiry: InquiryNotification): string {
  const optional: string[] = [];
  if (inquiry.preferredDates) optional.push(`희망 일정: ${inquiry.preferredDates}`);
  if (inquiry.people) optional.push(`인원: ${inquiry.people}`);

  return [
    `이름: ${inquiry.name}`,
    `이메일: ${inquiry.email}`,
    `촬영 종류: ${inquiry.sessionType}`,
    ...optional,
    `문의 언어: ${inquiry.locale} / 답변 희망: ${inquiry.replyIn}`,
    '',
    inquiry.message || '(본문 없음)',
    '',
    `문의 ID: ${inquiry.id}`,
  ].join('\n');
}

/** 화면의 "접수되었습니다" 문구(CONTACT.sent)와 같은 문장을 그대로 재사용한다. */
const CONFIRMATION_SUBJECT: Record<Locale, string> = {
  ko: '문의가 접수되었습니다 — usherinmaking',
  ja: 'お問い合わせを受け付けました — usherinmaking',
  en: 'We received your enquiry — usherinmaking',
};

/** 문의자에게 가는 확인 메일 본문. 화면에 이미 있는 접수 확인 문구를 그대로 쓴다. */
function buildCustomerBody(inquiry: InquiryNotification, locale: Locale): string {
  const greeting: Record<Locale, string> = {
    ko: `${inquiry.name}님, 안녕하세요.`,
    ja: `${inquiry.name} 様`,
    en: `Hello ${inquiry.name},`,
  };

  return [greeting[locale], '', CONTACT.sent[locale]].join('\n');
}
