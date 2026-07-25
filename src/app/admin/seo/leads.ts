import type { Locale, PageKey } from '@/lib/i18n';
import { LOCALES, path } from '@/lib/i18n';

/**
 * 정의형 리드문 대장(臺帳).
 *
 * 정의형 리드문은 "질문 → 답" 모양으로 페이지 맨 위에 두는 한 문단이고,
 * AI 검색이 우리 페이지를 인용할 때 가장 먼저 집어 가는 문장이다.
 * 그래서 이 화면의 목적은 "잘 쓴 문장을 다듬는 것"이 아니라
 * **비어 있는 칸을 눈에 띄게 만드는 것**이다. 값이 없으면 조용히 넘어가지 않는다.
 *
 * 저장소: 아직 없다. prisma/schema.prisma 에 페이지 단위 SEO 모델이 없어서
 * (Photo/Plan/Faq/JournalPost 만 있다) 여기서는 코드 상수를 읽는다.
 * TODO(prisma): PageSeo { pageKey, locale, lead, updatedAt } 모델을 추가하고
 *               이 상수를 그 테이블로 옮긴다.
 */

/** 정의형 리드문이 반드시 있어야 하는 페이지. */
export const LEAD_REQUIRED_PAGES: PageKey[] = [
  'home',
  'studio',
  'location',
  'dress',
  'plan',
  'photographer',
  'gallery',
];

export const PAGE_LABEL: Record<string, string> = {
  home: '홈',
  studio: '스튜디오',
  location: '로케이션',
  dress: '드레스',
  plan: '요금',
  photographer: '작가 소개',
  gallery: '갤러리',
};

type LeadTable = Partial<Record<PageKey, Partial<Record<Locale, string>>>>;

/**
 * 확정된 리드문만 담는다. 승인된 문장이 없는 칸은 비워 둔다 —
 * 다른 언어에서 기계번역해 채우지 않는다. 언어별 본문은 서로 독립이다.
 */
const LEADS: LeadTable = {
  studio: {
    ja: '白いスタコ壁とアーチ窓、ヘリンボーンの床。沖縄の自然光がそのまま入る一軒家スタジオで、ヘアメイクからドレスまで揃えて撮影します。',
  },
};

export type LeadRow = {
  pageKey: PageKey;
  pageLabel: string;
  locale: Locale;
  url: string;
  lead: string | null;
};

/** 페이지 × 로케일 전수. 빈 칸이 행으로 남는 것이 이 함수의 목적이다. */
export function listLeadRows(): LeadRow[] {
  const rows: LeadRow[] = [];
  for (const pageKey of LEAD_REQUIRED_PAGES) {
    for (const locale of LOCALES) {
      const lead = LEADS[pageKey]?.[locale]?.trim();
      rows.push({
        pageKey,
        pageLabel: PAGE_LABEL[pageKey] ?? pageKey,
        locale,
        url: path(locale, pageKey),
        lead: lead ? lead : null,
      });
    }
  }
  return rows;
}

export function countLeads(): { written: number; total: number; missing: LeadRow[] } {
  const rows = listLeadRows();
  const missing = rows.filter((r) => r.lead === null);
  return { written: rows.length - missing.length, total: rows.length, missing };
}
