import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LOCALES } from '@/lib/i18n';
import { SESSION_TYPES, type SessionTypeValue } from '@/app/[locale]/contact/content';
import { isDatabaseConfigured, prisma } from '@/server/db';

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

/**
 * TODO(notify): 저장이 끝난 뒤에만 부르는 알림 단계.
 * 메일 의존성은 아직 넣지 않는다. 알림 실패는 접수 실패가 아니다.
 */
async function notifyEnquiry(_enquiry: Enquiry): Promise<void> {
  // TODO(notify): 저장된 문의 id를 담아 운영자에게 알림
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

  const id = await persistEnquiry(parsed.data);
  if (!id) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  // 알림은 저장 다음이다. 알림이 실패해도 문의는 이미 남아 있으므로 접수는 성공이다.
  try {
    await notifyEnquiry(parsed.data);
  } catch (err) {
    console.error('[contact] 알림 실패 (접수는 정상)', err);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
