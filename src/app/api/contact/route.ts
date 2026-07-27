import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LOCALES } from '@/lib/i18n';
import { SESSION_TYPES, type SessionTypeValue } from '@/app/[locale]/contact/content';
import { isDatabaseConfigured, prisma } from '@/server/db';
import { notifyInquiry } from '@/server/notify';

/**
 * 문의 수신 경로.
 * 원본은 DB이고 메일은 알림일 뿐이므로 순서는 항상 검증 → 저장 → 알림이다.
 * 저장이 되지 않는 동안에는 접수되었다고 답하지 않는다(문의가 조용히 사라지는 것을 막는다).
 */

/** 요청 본문 상한 — 이보다 큰 것은 파싱조차 하지 않는다 */
const MAX_BODY_BYTES = 16 * 1024;

const sessionValues = SESSION_TYPES.map((t) => t.value) as [SessionTypeValue, ...SessionTypeValue[]];

/** 모든 필드에 길이 상한을 둔다 — 상한 없는 문자열은 그대로 저장소 부담이 된다 */
const EnquirySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200),
    sessionType: z.enum(sessionValues),
    preferredDates: z.string().trim().max(120).optional().default(''),
    people: z.string().trim().max(40).optional().default(''),
    replyIn: z.enum(LOCALES),
    message: z.string().trim().max(4000).optional().default(''),
    /** 문의가 들어온 페이지의 언어 */
    locale: z.enum(LOCALES),
    /**
     * 봇 감지용 미끼. 폼에서 화면 밖으로 감춰 둔 자리라 사람은 채울 수 없다.
     * 값이 있으면 폼을 자동으로 훑은 것이다. 아래에서 별도로 판정한다.
     */
    refCode: z.string().max(200).optional().default(''),
  })
  .strict();

export type Enquiry = z.infer<typeof EnquirySchema>;

/**
 * DB 저장. 여기가 원본이고 알림은 사본이다.
 * 저장에 실패하면 접수되지 않은 것이므로 성공으로 응답하지 않는다.
 */
async function persistEnquiry(enquiry: Enquiry): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const row = await prisma.inquiry.create({
      data: {
        name: enquiry.name,
        email: enquiry.email,
        locale: enquiry.locale,
        shootType: enquiry.sessionType,
        dates: enquiry.preferredDates || null,
        people: enquiry.people || null,
        message: enquiry.message,
        // 답변 언어는 문의가 들어온 페이지 언어와 다를 수 있어 메모에 남긴다.
        memo: enquiry.replyIn !== enquiry.locale ? `답변 희망 언어: ${enquiry.replyIn}` : null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    // 저장 실패는 삼키지 않는다 — 삼키면 문의가 조용히 사라진다.
    console.error('[contact] 저장 실패', err);
    return null;
  }
}

/** 같은 사람이 같은 내용을 다시 보낸 것으로 볼 시간 폭 */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * 직전에 같은 내용이 이미 저장되었는지.
 *
 * 새 데이터를 저장하지 않는다 — 이미 있는 Inquiry 행을 조회할 뿐이다. IP 를 기록하는
 * 방식은 개인정보 처리 방침에 영향을 주므로 여기서는 쓰지 않는다.
 *
 * 목적은 같은 문의가 여러 행으로 쌓이는 것을 막는 것이다. 중복이면 새로 저장하지
 * 않되 접수는 성공으로 답하는데, 이것은 성공을 흉내내는 것이 아니다 —
 * 그 문의는 이미 저장되어 있으므로 사용자에게는 실제로 접수된 상태가 맞다.
 */
async function findRecentDuplicate(enquiry: Enquiry): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const row = await prisma.inquiry.findFirst({
      where: {
        email: enquiry.email,
        message: enquiry.message,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return row?.id ?? null;
  } catch (err) {
    // 중복 조회 실패로 접수를 막지는 않는다. 최악의 경우 행이 하나 더 생길 뿐이다.
    console.error('[contact] 중복 조회 실패 (접수는 계속)', err);
    return null;
  }
}

/**
 * 저장이 끝난 뒤에만 부르는 알림 단계. 실제 전송 로직은 src/server/notify.ts 에 있다.
 * 여기서는 Enquiry → InquiryNotification 형태 변환만 한다. 알림 실패는 접수 실패가 아니다.
 */
async function notifyEnquiry(enquiry: Enquiry, id: string): Promise<void> {
  await notifyInquiry({
    id,
    name: enquiry.name,
    email: enquiry.email,
    sessionType: enquiry.sessionType,
    preferredDates: enquiry.preferredDates,
    people: enquiry.people,
    message: enquiry.message,
    locale: enquiry.locale,
    replyIn: enquiry.replyIn,
  });
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'unsupported_media_type' }, { status: 415 });
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = EnquirySchema.safeParse(raw);
  if (!parsed.success) {
    // 보낸 값은 되돌려주지 않는다. 어떤 필드가 걸렸는지만 알린다.
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? '')).filter(Boolean)),
    ];
    return NextResponse.json({ error: 'invalid_input', fields }, { status: 400 });
  }

  /*
    미끼 필드에 값이 들어왔다 — 폼을 자동으로 훑은 것이다.

    봇에게 201 을 돌려주어 재시도를 막는 방식은 쓰지 않는다. 비밀번호 관리자나
    브라우저가 숨은 필드를 채워 실제 고객이 여기 걸릴 수 있는데, 그때 성공으로
    답하면 문의가 성공한 것처럼 보이면서 사라진다. 이 저장소가 계속 경계해 온
    실패 방식이라, 걸리면 실패로 알려 다른 경로로 연락할 수 있게 둔다.
  */
  if (parsed.data.refCode.trim() !== '') {
    console.warn('[contact] 미끼 필드에 값이 들어옴 — 자동 제출로 보고 거부');
    return NextResponse.json({ error: 'invalid_input', fields: [] }, { status: 400 });
  }

  const duplicate = await findRecentDuplicate(parsed.data);
  if (duplicate) {
    // 이미 저장된 문의다. 새 행을 만들지 않고, 알림도 다시 보내지 않는다.
    return NextResponse.json({ ok: true, duplicate: true }, { status: 201 });
  }

  const id = await persistEnquiry(parsed.data);
  if (!id) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  // 알림은 저장 다음이다. 알림이 실패해도 문의는 이미 남아 있으므로 접수는 성공이다.
  // notifyInquiry는 내부에서 실패를 값으로 돌려주고 throw하지 않지만, 예상치 못한
  // 예외까지 접수 실패로 번지지 않도록 이 try/catch를 안전망으로 남겨 둔다.
  try {
    await notifyEnquiry(parsed.data, id);
  } catch (err) {
    console.error('[contact] 알림 실패 (접수는 정상)', err);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
