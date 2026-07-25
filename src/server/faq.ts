import type { Locale } from '@/lib/i18n';

import { NotImplementedError } from '@/server/errors';

/**
 * FAQ 저장소.
 *
 * FAQ는 우리가 지어낸 문장이 아니라 실제로 들어온 문의 문장 그대로다.
 * 관리자가 INBOX(=src/server/inquiries.ts)에서 승격시키며, 승격 시 원문을 다듬지 않는다.
 * 고객이 실제로 쓰는 표현이 그대로 남아야 AI 검색이 우리 답변을 인용할 수 있다.
 *
 * 지금은 시드 배열을 읽는다. Prisma 이관 시 이 파일의 함수 본문만 갈아끼우면 된다.
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
 * 시드. 원래는 src/content/faq.ts 가 맞지만 그 경로는 이 에이전트의 소유가 아니라
 * 모듈 안에 둔다. Prisma 이관 시 통째로 사라진다.
 * 문장은 전부 실제 문의에서 올라온 형태를 가정한 표본이며, 번역본이 아직 없는 칸은 빈 문자열이다.
 */
const SEED_FAQS: Faq[] = [
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
  {
    id: 'faq-family-attend',
    question: {
      ja: '両親も同席できますか？',
      en: 'Can our parents come along?',
      ko: '부모님도 함께 있어도 되나요?',
    },
    answer: { ja: '', en: '', ko: '' },
    order: 2,
    page: null,
    sourceInquiryIds: ['inq-2026-0724-tanaka'],
  },
];

export async function listFaqs(page?: FaqPage): Promise<Faq[]> {
  // TODO(prisma): prisma.faq.findMany({ where: page ? { page } : {}, orderBy: { order: 'asc' } })
  const rows = page ? SEED_FAQS.filter((f) => f.page === page) : SEED_FAQS;
  return [...rows].sort((a, b) => a.order - b.order);
}

export async function getFaq(id: string): Promise<Faq | null> {
  // TODO(prisma): prisma.faq.findUnique({ where: { id } })
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
 * 쓰기 경로는 아직 없다. DB가 붙기 전까지 성공한 척하지 않는다.
 */
export async function createFaq(_input: CreateFaqInput): Promise<Faq> {
  // TODO(prisma): prisma.faq.create({ data: { question, answer, page, order: <max+1> } })
  //               승격 출처는 Inquiry.promotedFaqId 를 갱신해 연결한다.
  throw new NotImplementedError('FAQ 생성');
}

export async function updateFaq(_id: string, _input: Partial<CreateFaqInput>): Promise<Faq> {
  // TODO(prisma): prisma.faq.update({ where: { id }, data: { ... } })
  throw new NotImplementedError('FAQ 수정');
}
