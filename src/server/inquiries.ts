import type { Locale } from '@/lib/i18n';
import { LOCALES } from '@/lib/i18n';

import { NotImplementedError } from '@/server/errors';
import { isDatabaseConfigured, prisma } from '@/server/db';
import type { CreateFaqInput, Faq, FaqPage, L10n } from '@/server/faq';

/**
 * 문의 저장소.
 *
 * 이 DB가 원본이다. 메일과 LINE은 사본(알림)일 뿐이므로,
 * 알림 전송이 실패해도 문의는 여기 남아 있어야 하고 화면에서도 그렇게 보여야 한다.
 * 그래서 목록/상세는 알림 상태와 무관하게 항상 레코드를 보여주고,
 * 알림 실패는 별도 배지(notifyFailed)로만 표시한다. 문의가 사라진 것처럼 보이면 안 된다.
 *
 * 개인정보: 이메일 주소는 화면·응답 어디에도 원문으로 나가지 않는다.
 * 목록/상세 타입에는 마스킹된 값만 들어 있고, 원문은 revealInquiryEmail() 로만 꺼낸다.
 */

export type InquiryStatus = 'NEW' | 'WAITING' | 'DONE' | 'HOLD' | 'SPAM';

export const INQUIRY_STATUSES: InquiryStatus[] = ['NEW', 'WAITING', 'DONE', 'HOLD', 'SPAM'];

/** 관리자 UI는 한국어다. 편집 대상 콘텐츠(문의 본문)는 원어 그대로 둔다. */
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: '신규',
  WAITING: '답변대기',
  DONE: '완료',
  HOLD: '보류',
  SPAM: '스팸',
};

/** prisma/schema.prisma model Inquiry 와 1:1. email 만 마스킹된 형태로 대체된다. */
export type Inquiry = {
  id: string;
  name: string;
  /** 원문 대신 마스킹된 표기. 원문이 필요하면 revealInquiryEmail(id). */
  emailMasked: string;
  locale: Locale;
  shootType: string;
  dates: string | null;
  people: string | null;
  message: string;
  status: InquiryStatus;
  memo: string | null;
  promotedFaqId: string | null;
  createdAt: Date;
  repliedAt: Date | null;
  /**
   * 알림(메일·LINE) 전송 실패 여부. DB 레코드 자체와는 무관한 부가 정보다.
   * 스키마에는 아직 칼럼이 없다 — ActivityLog 로 남길지 칼럼을 팔지 미정.
   */
  notifyFailed: boolean;
};

/** 좌측 목록에 필요한 최소 필드. 본문 전체와 메모는 상세에서만 읽는다. */
export type InquiryListItem = Pick<
  Inquiry,
  'id' | 'name' | 'locale' | 'shootType' | 'status' | 'createdAt' | 'notifyFailed'
> & {
  /** 목록 미리보기 한 줄. 원문 앞부분을 자른 것이며 이메일은 포함하지 않는다. */
  excerpt: string;
};

export type InquiryFilter = {
  status?: InquiryStatus;
  locale?: Locale;
  /** 최근 N일. 기본 30일 — 시안의 "기간: 30일" 과 같다. */
  days?: number;
};

/* ------------------------------------------------------------------ */
/* 개인정보 처리                                                        */
/* ------------------------------------------------------------------ */

/**
 * 이메일 마스킹. 로컬파트 앞 2자와 도메인 최상위만 남긴다.
 * 캐시되거나 색인될 수 있는 어떤 출력에도 원문 주소를 넣지 않기 위한 안전장치다.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 2);
  const dot = domain.lastIndexOf('.');
  const tld = dot >= 0 ? domain.slice(dot) : '';
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@***${tld}`;
}

/**
 * 원문 주소를 꺼낸다. 답장 발송 경로에서만 호출하고, 렌더링 트리에 넣지 않는다.
 * 호출부는 반드시 no-store 여야 한다.
 */
export async function revealInquiryEmail(id: string): Promise<string | null> {
  // TODO(prisma): prisma.inquiry.findUnique({ where: { id }, select: { email: true } })
  return SEED_INQUIRIES.find((r) => r.id === id)?.email ?? null;
}

/* ------------------------------------------------------------------ */
/* 시드                                                                */
/* ------------------------------------------------------------------ */

/** 시드 레코드는 원문 email 을 들고 있고, 외부로 나갈 때 toInquiry() 가 마스킹한다. */
type SeedInquiry = Omit<Inquiry, 'emailMasked'> & { email: string };

const SEED_INQUIRIES: SeedInquiry[] = [
  {
    id: 'inq-2026-0724-tanaka',
    name: '田中',
    email: 'tanaka@example.com',
    locale: 'ja',
    shootType: 'STUDIO Plan.01',
    dates: '8月の平日',
    people: '2名',
    message:
      'はじめまして。8月の平日にスタジオでの前撮りを検討しています。ドレスは2着まで選べますか？また、両親も同席できますか？駐車場の有無も教えてください。',
    status: 'NEW',
    memo: '8월 둘째 주 촬영 겹침. 평일 오전 제안.',
    promotedFaqId: null,
    createdAt: new Date('2026-07-24T10:12:00+09:00'),
    repliedAt: null,
    notifyFailed: false,
  },
  {
    id: 'inq-2026-0724-kim',
    name: 'Kim',
    email: 'kim@example.com',
    locale: 'ko',
    shootType: 'LOCATION',
    dates: null,
    people: null,
    message: '비치 촬영 문의드립니다. 선셋 시간대도 가능한지 궁금합니다.',
    status: 'NEW',
    memo: null,
    promotedFaqId: null,
    createdAt: new Date('2026-07-24T08:40:00+09:00'),
    repliedAt: null,
    // 알림 전송은 실패했지만 문의 자체는 여기 남아 있다. 이 케이스를 화면에서 보여줘야 한다.
    notifyFailed: true,
  },
  {
    id: 'inq-2026-0723-chen',
    name: 'Chen',
    email: 'chen@example.com',
    locale: 'en',
    shootType: 'Plan.02',
    dates: null,
    people: null,
    message: 'Hello, we are visiting Okinawa in October and would like to ask about Plan.02.',
    status: 'WAITING',
    memo: null,
    promotedFaqId: null,
    createdAt: new Date('2026-07-23T14:05:00+09:00'),
    repliedAt: null,
    notifyFailed: false,
  },
  {
    id: 'inq-2026-0722-sato',
    name: '佐藤',
    email: 'sato@example.com',
    locale: 'ja',
    shootType: 'マタニティ',
    dates: null,
    people: null,
    message: 'マタニティフォトの空き状況を教えてください。',
    status: 'WAITING',
    memo: null,
    promotedFaqId: null,
    createdAt: new Date('2026-07-22T11:30:00+09:00'),
    repliedAt: null,
    notifyFailed: false,
  },
  {
    id: 'inq-2026-0721-yamamoto',
    name: '山本',
    email: 'yamamoto@example.com',
    locale: 'ja',
    shootType: '記念日',
    dates: null,
    people: null,
    message: '記念日の撮影をお願いしたいです。',
    status: 'DONE',
    memo: null,
    promotedFaqId: null,
    createdAt: new Date('2026-07-21T09:00:00+09:00'),
    repliedAt: new Date('2026-07-21T18:20:00+09:00'),
    notifyFailed: false,
  },
];

function toInquiry(row: SeedInquiry): Inquiry {
  const { email, ...rest } = row;
  return { ...rest, emailMasked: maskEmail(email) };
}

function toListItem(row: SeedInquiry): InquiryListItem {
  return {
    id: row.id,
    name: row.name,
    locale: row.locale,
    shootType: row.shootType,
    status: row.status,
    createdAt: row.createdAt,
    notifyFailed: row.notifyFailed,
    excerpt: row.message.length > 24 ? `${row.message.slice(0, 24)}…` : row.message,
  };
}

/* ------------------------------------------------------------------ */
/* 읽기                                                                */
/* ------------------------------------------------------------------ */

/**
 * DB가 붙어 있으면 DB가 원본이고, 아니면 시드로 화면을 유지한다.
 * 시드를 남겨 두는 이유: DATABASE_URL이 빠진 환경에서 관리자가 빈 화면만 보는 것보다
 * 예시 데이터라도 구조를 보여주는 편이 낫기 때문이다. 실데이터가 있으면 항상 DB가 이긴다.
 */
type DbInquiry = {
  id: string; name: string; email: string; locale: string; shootType: string;
  dates: string | null; people: string | null; message: string; status: string;
  memo: string | null; promotedFaqId: string | null; createdAt: Date; repliedAt: Date | null;
};

function fromDb(row: DbInquiry): SeedInquiry {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    locale: row.locale as Locale,
    shootType: row.shootType,
    dates: row.dates,
    people: row.people,
    message: row.message,
    status: row.status as InquiryStatus,
    memo: row.memo,
    promotedFaqId: row.promotedFaqId,
    createdAt: row.createdAt,
    repliedAt: row.repliedAt,
    // 알림 실패 여부를 담을 칼럼이 아직 없다. 값을 지어내지 않고 false 로 둔다.
    notifyFailed: false,
  };
}

export async function listInquiries(filter: InquiryFilter = {}): Promise<InquiryListItem[]> {
  const days = filter.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  if (isDatabaseConfigured()) {
    const rows = await prisma.inquiry.findMany({
      where: {
        createdAt: { gte: since },
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.locale ? { locale: filter.locale } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (rows.length > 0) return rows.map((r) => toListItem(fromDb(r as DbInquiry)));
  }

  return SEED_INQUIRIES.filter((r) => {
    if (filter.status && r.status !== filter.status) return false;
    if (filter.locale && r.locale !== filter.locale) return false;
    return r.createdAt.getTime() >= since.getTime();
  })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toListItem);
}

export async function getInquiry(id: string): Promise<Inquiry | null> {
  if (isDatabaseConfigured()) {
    const row = await prisma.inquiry.findUnique({ where: { id } });
    if (row) return toInquiry(fromDb(row as DbInquiry));
  }
  const seed = SEED_INQUIRIES.find((r) => r.id === id);
  return seed ? toInquiry(seed) : null;
}

/** 상태 탭의 건수. 기간 필터와 무관하게 전체를 센다 — 탭이 문의를 숨기면 안 되기 때문이다. */
export async function countByStatus(): Promise<Record<InquiryStatus, number>> {
  const zero = Object.fromEntries(INQUIRY_STATUSES.map((s) => [s, 0])) as Record<
    InquiryStatus,
    number
  >;

  if (isDatabaseConfigured()) {
    const grouped = await prisma.inquiry.groupBy({ by: ['status'], _count: { _all: true } });
    if (grouped.length > 0) {
      for (const g of grouped) zero[g.status as InquiryStatus] = g._count._all;
      return zero;
    }
  }

  for (const r of SEED_INQUIRIES) zero[r.status] += 1;
  return zero;
}

/** 알림은 실패했지만 레코드는 남아 있는 건. 대시보드에서 눈에 띄어야 한다. */
export async function countNotifyFailed(): Promise<number> {
  // 스키마에 알림 결과 칼럼이 아직 없다. DB 모드에서는 셀 근거가 없으므로 0을 돌려준다.
  if (isDatabaseConfigured()) return 0;
  return SEED_INQUIRIES.filter((r) => r.notifyFailed).length;
}

/* ------------------------------------------------------------------ */
/* 답변 템플릿                                                          */
/* ------------------------------------------------------------------ */

export type ReplyTemplate = {
  id: string;
  /** 관리자 UI에 보이는 한국어 칩 라벨 */
  label: string;
  /** 실제 본문은 문의자의 언어로 나간다 */
  body: L10n;
};

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    id: 'plan-01',
    label: 'Plan.01 안내',
    body: {
      ja: 'お問い合わせありがとうございます。Plan.01 はドレス1着、Plan.02 は2着が含まれます。',
      en: 'Thank you for your enquiry. Plan.01 includes one dress and Plan.02 includes two.',
      ko: '문의 감사합니다. Plan.01은 드레스 1벌, Plan.02는 2벌이 포함됩니다.',
    },
  },
  {
    id: 'schedule',
    label: '일정 확인',
    body: {
      ja: 'ご希望の日程を確認いたします。第2希望までお知らせいただけますか。',
      en: 'We will check the dates you have in mind. Could you send a second preference as well?',
      ko: '희망하신 일정을 확인해 보겠습니다. 2순위 날짜도 알려주시겠어요?',
    },
  },
  {
    id: 'access-parking',
    label: '오시는 길 · 주차 2대',
    body: {
      ja: '駐車場は2台までご利用いただけます。',
      en: 'There is parking for two cars.',
      ko: '주차는 2대까지 가능합니다.',
    },
  },
  {
    id: 'options',
    label: '옵션 목록',
    body: {
      ja: 'オプションの一覧をお送りします。ご希望のものをお知らせください。',
      en: 'Here is the list of options. Please let us know which ones you would like.',
      ko: '옵션 목록을 보내드립니다. 원하시는 항목을 알려주세요.',
    },
  },
];

/* ------------------------------------------------------------------ */
/* 쓰기 — 전부 미구현. 성공한 척하지 않는다.                             */
/* ------------------------------------------------------------------ */

export async function updateInquiryStatus(id: string, status: InquiryStatus): Promise<Inquiry> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('문의 상태 변경');
  const row = await prisma.inquiry.update({ where: { id }, data: { status } });
  return toInquiry(fromDb(row as DbInquiry));
}

export async function updateInquiryMemo(id: string, memo: string): Promise<Inquiry> {
  if (!isDatabaseConfigured()) throw new NotImplementedError('문의 메모 저장');
  // 빈 문자열은 "메모 없음"이다 — 빈 문자열을 그대로 저장하면 목록에서 구분이 안 된다.
  const row = await prisma.inquiry.update({
    where: { id },
    data: { memo: memo.trim() || null },
  });
  return toInquiry(fromDb(row as DbInquiry));
}

export async function sendReply(_id: string, _body: string): Promise<never> {
  // TODO(prisma): 발송 결과를 ActivityLog 에 남기고 status 를 WAITING/DONE 으로 이동
  // TODO(mail): 발송 자체는 별도 어댑터. 실패는 알림 실패일 뿐 문의 유실이 아니다.
  throw new NotImplementedError('답장 메일 발송');
}

/**
 * 문의 문장을 FAQ로 승격한다.
 *
 * 승격의 핵심은 "고객이 쓴 문장 그대로" 옮기는 것이다. 요약하거나 다듬지 않는다.
 * 그래서 question 은 호출자가 문의 본문에서 골라낸 원문 조각을 그대로 받는다.
 * 문의자의 언어 칸만 채우고 나머지 언어는 번역 화면에서 채운다.
 */
export async function promoteToFaq(
  id: string,
  input: { questionVerbatim: string; page: FaqPage | null },
): Promise<Faq> {
  const inquiry = await getInquiry(id);
  if (!inquiry) throw new Error(`promoteToFaq: 문의를 찾을 수 없습니다 (${id})`);

  const question = Object.fromEntries(LOCALES.map((l) => [l, ''])) as L10n;
  question[inquiry.locale] = input.questionVerbatim;

  const _draft: CreateFaqInput = {
    question,
    answer: Object.fromEntries(LOCALES.map((l) => [l, ''])) as L10n,
    page: input.page,
    sourceInquiryId: id,
  };

  // TODO(prisma): createFaq(_draft) 로 Faq 생성 후
  //               prisma.inquiry.update({ where: { id }, data: { promotedFaqId: faq.id } })
  //               두 작업은 하나의 트랜잭션이어야 한다.
  throw new NotImplementedError('FAQ 승격 (문의 원문은 그대로 보존됩니다)');
}

/**
 * 문의 본문에서 질문 문장 후보를 뽑는다.
 * 물음표로 끝나는 문장만 고르고, 표현을 바꾸지 않는다 — FAQ에 그대로 실릴 문장이기 때문이다.
 */
export function extractQuestionCandidates(message: string): string[] {
  return message
    .split(/(?<=[?？。．.！!])/u)
    .map((s) => s.trim())
    .filter((s) => /[?？]$/u.test(s));
}
