import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import { LOCALES } from '@/lib/i18n';
import {
  JOURNAL_CATEGORIES,
  clearSampleFlag,
  countJournal,
  listJournalGroups,
  publishJournalPost,
  setJournalCategory,
  unpublishJournalPost,
  upsertJournalPost,
  type JournalStatus,
} from '@/server/journal';

export const runtime = 'nodejs';

/** 목록 질의. 모든 문자열은 길이를 막아 둔다. */
const QuerySchema = z.object({
  status: z.enum(['published', 'draft']).optional(),
  category: z.enum(JOURNAL_CATEGORIES as unknown as [string, ...string[]]).optional(),
  untranslated: z.enum(['0', '1']).optional(),
});

/**
 * 본문 저장과 분리된 상태 변경.
 *
 * 게시/게시취소는 언어별(한 레코드)이고, 카테고리와 샘플 표시는 글 단위(같은 slug 전체)다.
 * 그 차이가 곧 요청 모양의 차이라 액션마다 필요한 필드를 다르게 받는다.
 */
const PatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('publish'),
    slug: z.string().min(1).max(120),
    locale: z.enum(LOCALES),
  }),
  z.object({
    action: z.literal('unpublish'),
    slug: z.string().min(1).max(120),
    locale: z.enum(LOCALES),
  }),
  z.object({
    action: z.literal('category'),
    slug: z.string().min(1).max(120),
    category: z.enum(JOURNAL_CATEGORIES as unknown as [string, ...string[]]),
  }),
  z.object({
    action: z.literal('clear-sample'),
    slug: z.string().min(1).max(120),
  }),
]);

const UpsertSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    // URL 세그먼트가 되므로 안전한 문자만 받는다
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug는 소문자·숫자·하이픈만 사용할 수 있습니다.'),
  locale: z.enum(LOCALES),
  category: z.enum(JOURNAL_CATEGORIES as unknown as [string, ...string[]]),
  title: z.string().min(1).max(200),
  body: z.string().max(20000),
  cover: z.string().max(300),
  planCode: z.string().max(60).nullable(),
  isSample: z.boolean(),
});

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new ValidationError('질의 조건이 올바르지 않습니다.');

    const { status, category, untranslated } = parsed.data;
    const [groups, counts] = await Promise.all([
      listJournalGroups({
        status: status as JournalStatus | undefined,
        category: category as never,
        untranslatedOnly: untranslated === '1',
      }),
      countJournal(),
    ]);

    return Response.json({
      counts,
      // Date 는 직렬화하지 않고 필요한 것만 내보낸다.
      groups: groups.map((g) => ({
        slug: g.slug,
        category: g.category,
        planCode: g.planCode,
        isSample: g.isSample,
        sources: g.sources,
        status: g.status,
        publishedAt: g.publishedAtRaw,
        filledLocales: g.filledLocales,
        missingLocales: g.missingLocales,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const json = await req.json().catch(() => null);
    const parsed = UpsertSchema.safeParse(json);
    if (!parsed.success) {
      // 제출한 값을 되돌려주지 않는다. 어떤 필드가 틀렸는지만 알린다.
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      });
    }

    // DB 가 없으면 여기서 501 이 나간다. 성공을 흉내내지 않는다.
    // 저장은 본문만 바꾼다 — 공개 여부는 PATCH 쪽 경로가 따로 다룬다.
    const saved = await upsertJournalPost(parsed.data as never);
    return Response.json(
      { slug: saved.slug, locale: saved.locale, status: saved.publishedAt ? 'published' : 'draft' },
      { status: 200 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin(req);

    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      });
    }

    const input = parsed.data;

    switch (input.action) {
      case 'publish': {
        const post = await publishJournalPost(input.slug, input.locale);
        return Response.json({ slug: post.slug, locale: post.locale, status: 'published' });
      }
      case 'unpublish': {
        const post = await unpublishJournalPost(input.slug, input.locale);
        return Response.json({ slug: post.slug, locale: post.locale, status: 'draft' });
      }
      case 'category': {
        const count = await setJournalCategory(input.slug, input.category as never);
        return Response.json({ slug: input.slug, category: input.category, updated: count });
      }
      case 'clear-sample': {
        const count = await clearSampleFlag(input.slug);
        return Response.json({ slug: input.slug, isSample: false, updated: count });
      }
    }
  } catch (err) {
    return errorResponse(err);
  }
}
