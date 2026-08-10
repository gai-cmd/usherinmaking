// 수집된 사진에 대한 AI 초안 — 분류 후보.
//
// 이 파일이 만드는 것은 전부 "초안"이다. 확정은 관리자 화면에서 사람이 한다.
// 그 경계를 코드로도 지킨다: 여기서 나온 값은 Photo.aiSuggestion 과 alt 에만 들어가고,
// status 는 건드리지 않는다(수집물은 예외 없이 UNSORTED 로 저장된다).
//
// 계약 셋:
//   1) 분류는 DB 에 실제로 있는 term 만 고른다. 없는 slug 를 지어내면 조용히 버린다.
//   2) 문안(alt·story)은 여기서 만들지 않는다. 인스타 원문을 그대로 쓰기로 했고,
//      번역 워크플로우는 두지 않는다 — server/ingest 의 altFromCaption 참조.
//   3) 실패는 던진다. 수집을 막지 않는 것은 호출측(server/ingest)의 책임이다.

import Anthropic from '@anthropic-ai/sdk';
import { isDatabaseConfigured, prisma } from '@/server/db';
import { DependencyUnavailableError } from '@/server/errors';
import type { CategorySuggestion } from '@/lib/image-pipeline';

/* ============================ 설정 ============================ */

/**
 * 사진 한 장을 보고 판단하는 일이다. 최상위 모델이 필요할 만큼 어렵지는 않지만
 * 시각 판단이 섞이므로 Sonnet 아래로는 내리지 않는다. 교체는 환경변수로 한다.
 */
const MODEL = process.env.AI_MODEL?.trim() || 'claude-sonnet-5';

/** 응답이 오지 않는 요청에 수집 전체를 묶어 두지 않는다. */
const REQUEST_TIMEOUT_MS = 60_000;

/** 이보다 낮은 확신은 제안으로 띄우지 않는다. 틀린 제안은 없느니만 못하다. */
const MIN_SCORE = 0.5;

/** 원본은 수 MB 다. 그대로 보내면 느리고 비싸다 — 판단에는 이 정도면 충분하다. */
const VISION_MAX_EDGE = 1024;

function client(): Anthropic {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    throw new DependencyUnavailableError('AI_API_KEY 가 설정되지 않았습니다.', { seam: 'ai-draft' });
  }
  return new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
}

/* ============================ 이미지 준비 ============================ */

/**
 * 분류·묘사에 쓸 축소본. 원본을 그대로 올리면 토큰이 몇 배로 뛰는데,
 * "아치 창이 있는가 / 노을인가" 같은 판단에 원본 해상도는 필요 없다.
 * sharp 는 서버에서만 쓸 수 있으므로 동적 import 로 가져온다.
 */
async function toVisionJpeg(bytes: ArrayBuffer): Promise<string> {
  const sharp = (await import('sharp')).default;
  const buf = await sharp(Buffer.from(bytes))
    .rotate()
    .resize({ width: VISION_MAX_EDGE, height: VISION_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return buf.toString('base64');
}

function imageBlock(base64: string) {
  return {
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 },
  };
}

/* ============================ 분류 ============================ */

type TermRow = { taxonomyKey: string; slug: string; label: string };

/**
 * 선택지를 DB 에서 읽는다. 관리자가 축이나 term 을 늘리면 프롬프트도 자동으로 따라간다 —
 * 목록을 코드에 박아 두면 늘린 축이 영영 제안되지 않는다.
 */
async function loadTerms(): Promise<TermRow[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await prisma.term.findMany({
    select: { slug: true, label: true, taxonomy: { select: { key: true } } },
    orderBy: [{ taxonomy: { order: 'asc' } }, { order: 'asc' }],
  });

  return rows.map((r) => {
    const label = r.label as Record<string, string> | null;
    return {
      taxonomyKey: r.taxonomy.key,
      slug: r.slug,
      // 프롬프트에 넣을 사람 말. ko 를 먼저 쓰고 없으면 다른 언어, 그것도 없으면 slug.
      label: label?.ko || label?.ja || label?.en || r.slug,
    };
  });
}

/** 축별로 묶은 선택지 목록. 모델이 축을 헷갈리지 않도록 축 안에서만 고르게 한다. */
function describeChoices(terms: TermRow[]): string {
  const byAxis = new Map<string, TermRow[]>();
  for (const t of terms) {
    const list = byAxis.get(t.taxonomyKey) ?? [];
    list.push(t);
    byAxis.set(t.taxonomyKey, list);
  }
  return [...byAxis.entries()]
    .map(([axis, list]) => `${axis}: ${list.map((t) => `${t.slug} (${t.label})`).join(', ')}`)
    .join('\n');
}

const CATEGORY_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          taxonomyKey: { type: 'string' },
          termSlug: { type: 'string' },
          score: { type: 'number' },
        },
        required: ['taxonomyKey', 'termSlug', 'score'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
} as const;

/**
 * 사진의 분류 후보. 축마다 최대 하나, 확신이 낮으면 아무것도 내지 않는다.
 *
 * "모르겠으면 비워라"를 프롬프트에 명시하는 이유: 스튜디오/로케이션처럼 이지선다인 축은
 * 모델이 억지로 하나를 고르기 쉬운데, 그 오답이 관리자 화면에서 그대로 확정될 위험이 있다.
 */
export async function suggestCategories(bytes: ArrayBuffer): Promise<CategorySuggestion[]> {
  const terms = await loadTerms();
  if (terms.length === 0) {
    throw new DependencyUnavailableError('분류 term 이 DB 에 없어 제안을 만들 수 없습니다.', {
      seam: 'suggestCategories',
    });
  }

  const valid = new Set(terms.map((t) => `${t.taxonomyKey}:${t.slug}`));
  const image = imageBlock(await toVisionJpeg(bytes));

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      'You classify wedding and portrait photographs for a photo studio in Okinawa. ' +
      'Judge only what is visibly present in the image. Never guess.',
    output_config: { format: { type: 'json_schema', schema: CATEGORY_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          image,
          {
            type: 'text',
            text:
              `Classify this photograph using the taxonomy below.\n\n${describeChoices(terms)}\n\n` +
              'Rules:\n' +
              '- Pick at most one term per axis, and only when the image clearly supports it.\n' +
              '- Omit an axis entirely when you are unsure — an empty answer is better than a wrong one.\n' +
              '- score is your confidence from 0 to 1.\n' +
              '- Use the exact slug strings given above.',
          },
        ],
      },
    ],
  });

  return parseSuggestions(response.content, valid);
}

/** 응답에서 제안을 꺼낸다. DB 에 없는 조합과 확신이 낮은 것은 여기서 걸러진다. */
function parseSuggestions(content: unknown, valid: Set<string>): CategorySuggestion[] {
  const raw = parseJsonBlock(content);
  const list = (raw as { suggestions?: unknown } | null)?.suggestions;
  if (!Array.isArray(list)) return [];

  const seenAxis = new Set<string>();
  const out: CategorySuggestion[] = [];

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const { taxonomyKey, termSlug, score } = item as Record<string, unknown>;
    if (typeof taxonomyKey !== 'string' || typeof termSlug !== 'string') continue;
    if (typeof score !== 'number' || score < MIN_SCORE) continue;
    // 지어낸 slug 를 저장하면 관리자 화면에 존재하지 않는 분류가 뜬다.
    if (!valid.has(`${taxonomyKey}:${termSlug}`)) continue;
    if (seenAxis.has(taxonomyKey)) continue;

    seenAxis.add(taxonomyKey);
    out.push({ taxonomyKey, termSlug, score: Math.min(1, Math.max(0, score)) });
  }

  return out;
}

/* ============================ alt 문안 ============================ */

/* ============================ slug ============================ */

/** 주소에 넣을 수 있는 최대 길이. 이보다 길면 단어 경계에서 자른다. */
const SLUG_MAX = 60;

/**
 * 영문 alt 에서 갤러리 주소를 만든다.
 *
 * 영문을 쓰는 이유는 ASCII 로 떨어지기 때문이다 — 한국어·일본어 alt 를 슬러그화하면
 * 퍼센트 인코딩된 주소가 되어 읽을 수도 공유할 수도 없다.
 * 만들 수 없으면 null 을 돌려주고, 그때는 화면이 id 를 주소로 쓴다(photoHref).
 */
export function slugFromAlt(altEn: string): string | null {
  const base = altEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base.length === 0) return null;
  if (base.length <= SLUG_MAX) return base;

  // 단어 중간에서 자르면 뜻이 깨진다. 마지막 하이픈까지만 남긴다.
  const cut = base.slice(0, SLUG_MAX);
  const lastDash = cut.lastIndexOf('-');
  return lastDash > 0 ? cut.slice(0, lastDash) : cut;
}

/* ============================ 공통 ============================ */

/**
 * 응답 블록에서 JSON 을 꺼낸다.
 * 구조화 출력을 쓰므로 형태는 보장되지만, 파싱 실패를 조용히 빈 값으로 만들지는 않는다.
 */
function parseJsonBlock(content: unknown): unknown {
  if (!Array.isArray(content)) return null;
  const text = content
    .filter((b): b is { type: 'text'; text: string } => {
      const block = b as { type?: unknown; text?: unknown };
      return block.type === 'text' && typeof block.text === 'string';
    })
    .map((b) => b.text)
    .join('');

  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
