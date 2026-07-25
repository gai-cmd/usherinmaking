import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { LOCALES, path, type Locale } from '@/lib/i18n';
import { PAGE_SLOTS, SLOT_MAX_LENGTH, isContentPage, type ContentPage } from '@/content/slots';
import { currentAdminEmail, requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import { getPageSlotStates, resetPageContent, setPageContent } from '@/server/page-content';

export const runtime = 'nodejs';

const PAGES = PAGE_SLOTS.map((p) => p.page) as [ContentPage, ...ContentPage[]];

/** 슬롯 키는 레지스트리가 만든 값만 들어온다. 형식까지 여기서 한 번 더 막는다. */
const SlotKey = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/iu, '문구 자리 키 형식이 올바르지 않습니다.');

const SaveSchema = z
  .object({
    page: z.enum(PAGES),
    slot: SlotKey,
    locale: z.enum(LOCALES),
    // 종류별 상한은 setPageContent 가 슬롯 정의를 보고 다시 검사한다.
    // 여기서는 가장 긴 종류를 기준으로 명백히 과한 본문만 먼저 끊는다.
    value: z.string().max(Math.max(...Object.values(SLOT_MAX_LENGTH))),
  })
  .strict();

const ResetSchema = z
  .object({ page: z.enum(PAGES), slot: SlotKey, locale: z.enum(LOCALES) })
  .strict();

/**
 * 바뀐 문구가 재배포 없이 보이도록 해당 공개 경로를 무효화한다.
 * 갤러리·저널은 하위 경로(필터·글 상세)도 같은 문구를 쓰므로 세그먼트째 무효화한다.
 */
function revalidate(page: ContentPage, locale: Locale): string {
  const target = path(locale, page);
  const nested = page === 'gallery' || page === 'journal';
  revalidatePath(target, nested ? 'layout' : 'page');
  return target;
}

/** 한 페이지의 슬롯 상태. 편집기는 서버 컴포넌트로 그리므로 주로 확인·디버깅용이다. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const page = new URL(req.url).searchParams.get('page');
    if (!page || !isContentPage(page)) {
      throw new ValidationError('편집할 수 있는 페이지가 아닙니다.', {
        pages: PAGE_SLOTS.map((p) => p.page),
      });
    }

    const slots = await getPageSlotStates(page);
    return Response.json({ page, slots });
  } catch (err) {
    return errorResponse(err);
  }
}

/** 슬롯 하나의 한 언어를 저장. 빈 값은 삭제와 같게 처리된다(= 코드 기본값으로 복귀). */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req);

    const json = await req.json().catch(() => null);
    const parsed = SaveSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      });
    }

    const { page, slot, locale, value } = parsed.data;
    const updatedBy = await currentAdminEmail();

    await setPageContent({ page, slot, locale, value, updatedBy });
    const revalidated = revalidate(page, locale);

    // 저장한 본문은 되돌려주지 않는다. 화면은 자기 입력값을 이미 들고 있다.
    return Response.json({ ok: true, revalidated });
  } catch (err) {
    return errorResponse(err);
  }
}

/** 코드 기본값으로 되돌리기. */
export async function DELETE(req: Request) {
  try {
    await requireAdmin(req);

    const json = await req.json().catch(() => null);
    const parsed = ResetSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      });
    }

    const { page, slot, locale } = parsed.data;

    await resetPageContent(page, slot, locale);
    const revalidated = revalidate(page, locale);

    return Response.json({ ok: true, revalidated });
  } catch (err) {
    return errorResponse(err);
  }
}
