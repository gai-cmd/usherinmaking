import { z } from 'zod';

import { currentAdminEmail, requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import {
  clearPageImage,
  listPageImageBindings,
  revalidateImageSurfaces,
  setPageImage,
} from '@/server/page-images';
import { recordActivity } from '@/server/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 페이지 이미지 슬롯 바인딩 API.
// 정적 세그먼트라 같은 디렉터리의 [id] 라우트보다 먼저 매칭된다.

/** alt는 3개 언어 모두 필수다. 길이 상한을 두어 본문이 통째로 들어오는 것을 막는다. */
const AltSchema = z.object({
  ja: z.string().trim().min(1).max(300),
  en: z.string().trim().min(1).max(300),
  ko: z.string().trim().min(1).max(300),
});

const BindSchema = z.object({
  page: z.string().min(1).max(40),
  slot: z.string().min(1).max(60),
  /** 업로드된 절대 URL 또는 리포지토리의 /images/* 경로만 허용한다. */
  url: z
    .string()
    .min(1)
    .max(600)
    .refine((v) => v.startsWith('https://') || v.startsWith('/images/'), {
      message: 'https:// 로 시작하는 스토리지 URL 또는 /images/ 경로여야 합니다.',
    }),
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
  alt: AltSchema,
});

const UnbindSchema = z.object({
  page: z.string().min(1).max(40),
  slot: z.string().min(1).max(60),
});

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const bindings = await listPageImageBindings();

    return Response.json({
      slots: bindings.map((b) => ({
        page: b.page,
        slot: b.slot,
        label: b.label,
        group: b.group,
        hint: b.hint ?? null,
        bound: b.bound,
        current: b.current,
        fallback: b.fallback,
        updatedAt: b.updatedAt?.toISOString() ?? null,
        updatedBy: b.updatedBy,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** 슬롯에 이미지를 건다. alt 3개 언어가 없으면 422로 거절한다 (UI 뿐 아니라 여기서도). */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req);

    const body: unknown = await req.json().catch(() => null);
    const parsed = BindSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      });
    }

    const actor = await currentAdminEmail();
    const resolved = await setPageImage({ ...parsed.data, updatedBy: actor });

    // 공개 페이지는 정적이라 저장만으로는 화면이 바뀌지 않는다. 걸린 주소를 무효화한다.
    const revalidation = await revalidateImageSurfaces(parsed.data.page, parsed.data.slot);

    await recordActivity({
      actor: actor ?? 'admin',
      action: `페이지 이미지 교체 — ${parsed.data.page} / ${parsed.data.slot}`,
      target: `${parsed.data.page}:${parsed.data.slot}`,
    }).catch(() => undefined);

    // revalidated 를 그대로 실어 보낸다 — 화면이 "반영됨"이라고 말하려면 이 값이 true 여야 한다.
    return Response.json({ current: resolved, ...revalidation });
  } catch (err) {
    return errorResponse(err);
  }
}

/** 슬롯 해제. 행을 지우면 코드의 /images/* 폴백이 다시 나간다. */
export async function DELETE(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const parsed = UnbindSchema.safeParse({
      page: url.searchParams.get('page') ?? '',
      slot: url.searchParams.get('slot') ?? '',
    });
    if (!parsed.success) {
      throw new ValidationError('page 와 slot 을 지정해 주세요.');
    }

    const actor = await currentAdminEmail();
    const fallback = await clearPageImage(parsed.data.page, parsed.data.slot);

    // 해제도 화면을 바꾸는 일이다(폴백으로 되돌아간다). 저장과 같이 무효화한다.
    const revalidation = await revalidateImageSurfaces(parsed.data.page, parsed.data.slot);

    await recordActivity({
      actor: actor ?? 'admin',
      action: `페이지 이미지 해제 — ${parsed.data.page} / ${parsed.data.slot}`,
      target: `${parsed.data.page}:${parsed.data.slot}`,
    }).catch(() => undefined);

    return Response.json({ current: fallback, ...revalidation });
  } catch (err) {
    return errorResponse(err);
  }
}
