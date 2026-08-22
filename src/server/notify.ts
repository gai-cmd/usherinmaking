import { maskEmail } from '@/server/inquiries';

/**
 * 문의 알림 전송기.
 *
 * DB가 원본이고 이 모듈은 사본(알림)만 다룬다. 그래서 이 모듈의 함수는 절대 throw 하지 않고,
 * 실패나 미설정 상태를 값으로 돌려준다 — 호출부(contact 라우트)가 알림 결과를 몰라도
 * 접수 흐름이 끊기지 않도록 하기 위해서다.
 *
 * 지금은 이메일(Resend REST API) 채널 하나만 있다. LINE 같은 두 번째 채널이 생기면
 * notifyInquiry() 안에서 채널별 전송을 병렬로 시도하고 각각의 NotifyOutcome을 모아
 * 반환하는 형태로 확장한다 — 호출부 시그니처는 바뀌지 않는다.
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

/**
 * 문의 알림 발송. RESEND_API_KEY 또는 NOTIFY_TO 가 없으면 건너뛴 사실만 로그로 남기고
 * 정상 반환한다 — 자격 증명 부재는 오류가 아니라 "아직 설정 안 됨" 이다.
 * 콘솔 로그에는 이메일 원문을 절대 남기지 않는다(maskEmail).
 */
export async function notifyInquiry(inquiry: InquiryNotification): Promise<NotifyOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_TO;

  if (!apiKey || !to) {
    console.log(
      `[notify] 건너뜀 — 알림 자격 증명 없음 (문의 ${inquiry.id}, ${maskEmail(inquiry.email)})`,
    );
    return { sent: false, reason: 'not_configured' };
  }

  const from = process.env.RESEND_FROM || DEFAULT_FROM;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `[문의] ${inquiry.name} — ${inquiry.sessionType}`,
        text: buildBody(inquiry),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(
        `[notify] 발송 실패 — 상태 ${res.status} (문의 ${inquiry.id}, ${maskEmail(inquiry.email)}) ${detail.slice(0, 200)}`,
      );
      return { sent: false, reason: 'send_failed' };
    }

    return { sent: true };
  } catch (err) {
    // 네트워크 예외 등. 여기서도 throw 하지 않는다 — 접수는 이미 끝났다.
    console.error(`[notify] 발송 예외 (문의 ${inquiry.id}, ${maskEmail(inquiry.email)})`, err);
    return { sent: false, reason: 'send_failed' };
  }
}

/** 운영자 전용 메일 본문. 운영자에게 가는 사본이므로 이메일 원문을 포함한다. */
function buildBody(inquiry: InquiryNotification): string {
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
