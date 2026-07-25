import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LOCALES } from '@/lib/i18n';
import { SESSION_TYPES, type SessionTypeValue } from '@/app/[locale]/contact/content';

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
 * TODO(persistence): Prisma 연결 지점.
 * `await prisma.enquiry.create({ data: enquiry })` 가 들어갈 자리이며,
 * 연결되면 PERSISTENCE_READY를 true로 바꾼다.
 * 그 전까지는 아무것도 쓰지 않고 저장 불가로 응답한다 — 받은 척하지 않는다.
 */
const PERSISTENCE_READY = false;

async function persistEnquiry(_enquiry: Enquiry): Promise<boolean> {
  if (!PERSISTENCE_READY) return false;
  // TODO(persistence): prisma.enquiry.create(...)
  return false;
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

  const stored = await persistEnquiry(parsed.data);
  if (!stored) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  await notifyEnquiry(parsed.data);

  return NextResponse.json({ ok: true }, { status: 201 });
}
