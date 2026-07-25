import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { errorResponse, ValidationError } from '@/server/errors';
import { LOCALES } from '@/lib/i18n';
import {
  getSiteSettings,
  listOutstandingItems,
  updateChannels,
  updateSiteSettings,
  validateChannelOrder,
  type ChannelId,
} from '@/server/settings';

export const runtime = 'nodejs';

const HttpUrl = z
  .string()
  .max(300)
  .url()
  .refine((u) => u.startsWith('https://'), 'https:// 주소만 사용할 수 있습니다.');

const SiteSchema = z
  .object({
    addressJa: z.string().max(200).nullable().optional(),
    addressLatin: z.string().max(200).nullable().optional(),
    fromAirport: z.string().max(120).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    naverBlogUrl: HttpUrl.nullable().optional(),
  })
  .strict();

const ChannelSchema = z
  .object({
    locale: z.enum(LOCALES),
    channels: z
      .array(
        z
          .object({
            id: z.enum(['kakao', 'line', 'instagram', 'form']),
            handle: z.string().max(80).nullable(),
            url: HttpUrl.nullable(),
            order: z.number().int().min(0).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();

const BodySchema = z.union([
  z.object({ kind: z.literal('site'), data: SiteSchema }).strict(),
  z.object({ kind: z.literal('channels'), data: ChannelSchema }).strict(),
]);

/**
 * 설정 조회.
 * 대표 이메일 주소는 응답에 포함하지 않는다 — 설정 여부만 나간다.
 * 이 경로로 주소가 나가면 캐시되는 화면까지 흘러갈 수 있다.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const [settings, outstanding] = await Promise.all([getSiteSettings(), listOutstandingItems()]);

    return Response.json({
      site: {
        brandName: settings.brandName,
        logoSvg: settings.logoSvg,
        address: settings.address,
        fromAirport: settings.fromAirport,
        parking: settings.parking,
        languages: settings.languages,
        geo: settings.geo,
        representativeEmailConfigured: settings.representativeEmail.configured,
      },
      channels: settings.channels,
      naverBlog: settings.naverBlog,
      outstanding: outstanding.map((o) => ({ key: o.key, label: o.label })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin(req);

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError('입력값이 올바르지 않습니다.', {
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      });
    }

    if (parsed.data.kind === 'site') {
      await updateSiteSettings(parsed.data.data);
      return Response.json({ ok: true });
    }

    const { locale, channels } = parsed.data.data;

    // 언어별 1순위 채널은 업무 규칙이다. 어기면 저장하지 않고 경고를 돌려준다.
    const order = [...channels].sort((a, b) => a.order - b.order).map((c) => c.id as ChannelId);
    const warnings = validateChannelOrder(locale, order);
    const blocking = warnings.filter((w) => w.level === 'rule');
    if (blocking.length > 0) {
      throw new ValidationError('언어별 상담 채널 규칙에 어긋납니다.', {
        warnings: blocking.map((w) => w.message),
      });
    }

    await updateChannels({ locale, channels });
    return Response.json({ ok: true, notices: warnings.map((w) => w.message) });
  } catch (err) {
    return errorResponse(err);
  }
}
