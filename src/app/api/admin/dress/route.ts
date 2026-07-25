import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import { LOCALES } from '@/lib/i18n';
import { countDress, getDressPhotoState, listDressItems, upsertDressItem } from '@/server/dress';

export const runtime = 'nodejs';

const COLLECTIONS = ['white', 'color', 'vintage', 'maternity'] as const;

const L10nSchema = z.object({
  ja: z.string().max(400).optional(),
  en: z.string().max(400).optional(),
  ko: z.string().max(400).optional(),
});

/**
 * 드레스 입력.
 * brand 필드는 없다 — 드레스 페이지는 브랜드명을 쓰지 않는다.
 * strict() 이므로 brand 같은 낯선 키가 들어오면 검증에서 걸린다.
 */
const UpsertSchema = z
  .object({
    id: z.string().max(80).optional(),
    name: L10nSchema,
    collection: z.enum(COLLECTIONS),
    tier: z.enum(['basic', 'premium']),
    // 없음(null)과 0원은 다르다.
    surcharge: z.number().int().min(0).max(1_000_000).nullable(),
    sizes: z.array(z.string().max(20)).max(20),
    description: L10nSchema,
    published: z.boolean(),
  })
  .strict();

const QuerySchema = z.object({
  collection: z.enum(COLLECTIONS).optional(),
  tier: z.enum(['basic', 'premium']).optional(),
  published: z.enum(['0', '1']).optional(),
});

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new ValidationError('질의 조건이 올바르지 않습니다.');

    const [items, counts, photoState] = await Promise.all([
      listDressItems({
        collection: parsed.data.collection,
        tier: parsed.data.tier,
        publishedOnly: parsed.data.published === '1',
      }),
      countDress(),
      getDressPhotoState(),
    ]);

    return Response.json({
      counts,
      // 사진 미납품 상태를 명시적으로 알린다. 클라이언트가 경로를 지어내지 않도록.
      photoState,
      items: items.map((d) => ({
        id: d.id,
        name: d.name,
        collection: d.collection,
        tier: d.tier,
        surcharge: d.surcharge,
        sizes: d.sizes,
        description: d.description,
        photo: d.photo,
        published: d.published,
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
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      });
    }

    // 3개 언어 가운데 최소 한 곳에는 이름이 있어야 목록에 표시할 수 있다.
    const hasName = LOCALES.some((l) => (parsed.data.name[l] ?? '').trim().length > 0);
    if (!hasName) throw new ValidationError('이름을 한 언어 이상 입력해 주세요.');

    const saved = await upsertDressItem(parsed.data);
    return Response.json({ id: saved.id }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
