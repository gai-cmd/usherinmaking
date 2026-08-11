import type { Locale } from '@/lib/i18n';
import { LOCALES } from '@/lib/i18n';

import { logAdminAction } from '@/server/activity';
import { isDatabaseConfigured, prisma } from '@/server/db';
import { NotFoundError, NotImplementedError } from '@/server/errors';

/**
 * FAQ 저장소.
 *
 * FAQ는 우리가 지어낸 문장이 아니라 실제로 들어온 문의 문장 그대로다.
 * 관리자가 INBOX(=src/server/inquiries.ts)에서 승격시키며, 승격 시 원문을 다듬지 않는다.
 * 고객이 실제로 쓰는 표현이 그대로 남아야 AI 검색이 우리 답변을 인용할 수 있다.
 *
 * 읽기는 DB 우선 · 시드 폴백이다. DATABASE_URL 이 없는 환경에서 빈 화면을 보여 주는 것보다
 * 구조를 보여 주는 편이 낫고, 실데이터가 있으면 언제나 DB가 이긴다.
 */

export type L10n = Record<Locale, string>;

/** Faq.page — 어느 페이지에 노출할지. null 이면 아직 배치되지 않은 것. */
export type FaqPage = 'home' | 'studio' | 'location' | 'plan' | 'dress' | 'contact';

export const FAQ_PAGES: FaqPage[] = ['home', 'studio', 'location', 'plan', 'dress', 'contact'];

/** prisma/schema.prisma model Faq 와 1:1. question/answer 는 Json { ja, en, ko }. */
export type Faq = {
  id: string;
  question: L10n;
  answer: L10n;
  order: number;
  page: FaqPage | null;
  /** 이 FAQ가 승격되어 나온 문의 id. 직접 작성한 항목은 빈 배열. */
  sourceInquiryIds: string[];
};

/**
 * 시드. 두 가지로 쓰인다 — DB가 비었을 때의 폴백이자, prisma/seed.ts 가 넣는 원본이다.
 * 그래서 지우지 않는다.
 *
 * 문장은 전부 실제 문의에서 올라온 형태를 가정한 표본이며, 번역본이 아직 없는 칸은 빈 문자열이다.
 * id 는 손으로 지은 안정된 값이다 — 시드를 두 번 돌려도 같은 행을 갱신해야 하기 때문이다.
 */
export const SEED_FAQS: Faq[] = [
  {
    id: 'faq-parking',
    question: {
      ja: '駐車場はありますか？',
      en: 'Is there parking?',
      ko: '주차장이 있나요?',
    },
    answer: {
      ja: '駐車場は2台までご利用いただけます。',
      en: 'There is parking for two cars.',
      ko: '주차는 2대까지 가능합니다.',
    },
    order: 0,
    page: 'studio',
    sourceInquiryIds: ['inq-2026-0724-tanaka'],
  },
  {
    id: 'faq-dress-count',
    question: {
      ja: 'ドレスは2着まで選べますか？',
      en: 'Can we choose up to two dresses?',
      ko: '드레스를 2벌까지 고를 수 있나요?',
    },
    answer: {
      ja: 'Plan.01 はドレス1着、Plan.02 は2着が含まれます。',
      en: 'Plan.01 includes one dress and Plan.02 includes two.',
      ko: 'Plan.01은 드레스 1벌, Plan.02는 2벌이 포함됩니다.',
    },
    order: 1,
    page: 'plan',
    sourceInquiryIds: ['inq-2026-0724-tanaka'],
  },
  // 2026-08-11: '両親も同席できますか？'(부모님 동석) 항목을 뺐다. 문의에서 뽑아 두었지만
  // 답을 확정하지 않은 채 남아 있어서, 답변 없는 FAQ 로 SEO 점검에만 걸리고 있었다.
  // 사장님 판단으로 질문 자체가 불필요하다고 정리했다. 되살릴 일이 생기면 답을 먼저 정할 것.
];

/* ------------------------------------------------------------------ */
/* DB 매핑                                                             */
/* ------------------------------------------------------------------ */

/**
 * Json 칼럼을 L10n 으로. 빠진 언어는 빈 문자열이다.
 * 통째로 캐스팅하면 없는 칸이 런타임에 undefined 로 새어나가므로 여기서 채운다.
 */
function toL10n(value: unknown): L10n {
  const src = (value ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    LOCALES.map((l) => [l, typeof src[l] === 'string' ? (src[l] as string) : '']),
  ) as L10n;
}

type DbFaq = {
  id: string;
  question: unknown;
  answer: unknown;
  order: number;
  page: string | null;
  inquiries?: { id: string }[];
};

function fromDb(row: DbFaq): Faq {
  return {
    id: row.id,
    question: toL10n(row.question),
    answer: toL10n(row.answer),
    order: row.order,
    page: (row.page as FaqPage | null) ?? null,
    sourceInquiryIds: (row.inquiries ?? []).map((i) => i.id),
  };
}

/** 승격 출처는 Inquiry.promotedFaqId 역방향이라 관계를 함께 읽는다. */
const WITH_SOURCES = { inquiries: { select: { id: true } } } as const;

export async function listFaqs(page?: FaqPage): Promise<Faq[]> {
  if (isDatabaseConfigured()) {
    const rows = await prisma.faq.findMany({
      where: page ? { page } : {},
      orderBy: { order: 'asc' },
      include: WITH_SOURCES,
    });
    if (rows.length > 0) return rows.map((r) => fromDb(r as DbFaq));
  }

  const rows = page ? SEED_FAQS.filter((f) => f.page === page) : SEED_FAQS;
  return [...rows].sort((a, b) => a.order - b.order);
}

export async function getFaq(id: string): Promise<Faq | null> {
  if (isDatabaseConfigured()) {
    const row = await prisma.faq.findUnique({ where: { id }, include: WITH_SOURCES });
    if (row) return fromDb(row as DbFaq);
  }
  return SEED_FAQS.find((f) => f.id === id) ?? null;
}

/** 답변이 세 언어 모두 비어 있는 FAQ. 구조화 데이터(FAQPage)에 넣으면 안 되는 항목이다. */
export async function listUnansweredFaqs(): Promise<Faq[]> {
  const rows = await listFaqs();
  return rows.filter((f) => !f.answer.ja.trim() && !f.answer.en.trim() && !f.answer.ko.trim());
}

/** FAQPage 스키마에 실제로 실을 수 있는 항목 수 — SEO 화면의 근거값. */
export async function countSchemaReadyFaqs(): Promise<number> {
  const rows = await listFaqs();
  return rows.filter((f) => f.page !== null && Object.values(f.answer).some((v) => v.trim()))
    .length;
}

export type CreateFaqInput = {
  /** 문의 원문 그대로. 요약·의역 금지. */
  question: L10n;
  answer: L10n;
  page: FaqPage | null;
  sourceInquiryId?: string;
};

/**
 * FAQ 생성.
 *
 * sourceInquiryId 가 있으면 문의의 promotedFaqId 까지 한 트랜잭션에서 잇는다.
 * 둘이 갈라지면 "승격했는데 출처를 모르는 FAQ" 또는 그 반대가 남는다.
 */
export async function createFaq(input: CreateFaqInput): Promise<Faq> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('FAQ 생성');

  const last = await prisma.faq.findFirst({ orderBy: { order: 'desc' }, select: { order: true } });
  const order = (last?.order ?? -1) + 1;

  const created = await prisma.$transaction(async (tx) => {
    const faq = await tx.faq.create({
      data: {
        question: input.question,
        answer: input.answer,
        page: input.page,
        order,
      },
      include: WITH_SOURCES,
    });

    if (input.sourceInquiryId) {
      await tx.inquiry.update({
        where: { id: input.sourceInquiryId },
        data: { promotedFaqId: faq.id },
      });
    }
    return faq;
  });

  // 문의 원문은 로그에 넣지 않는다 — 고객 문장이 그대로 다른 화면에 실릴 경로를 만들지 않는다.
  await logAdminAction('FAQ 생성', created.id, { page: input.page });

  return fromDb({
    ...(created as DbFaq),
    // 트랜잭션 안에서 이은 연결은 위 include 스냅샷에 잡히지 않는다.
    inquiries: input.sourceInquiryId ? [{ id: input.sourceInquiryId }] : [],
  });
}

export async function updateFaq(id: string, input: Partial<CreateFaqInput>): Promise<Faq> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('FAQ 수정');

  const exists = await prisma.faq.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError(`FAQ를 찾을 수 없습니다 (${id}).`);

  const row = await prisma.faq.update({
    where: { id },
    data: {
      ...(input.question ? { question: input.question } : {}),
      ...(input.answer ? { answer: input.answer } : {}),
      ...(input.page !== undefined ? { page: input.page } : {}),
    },
    include: WITH_SOURCES,
  });

  await logAdminAction('FAQ 수정', id, { page: row.page });
  return fromDb(row as DbFaq);
}
