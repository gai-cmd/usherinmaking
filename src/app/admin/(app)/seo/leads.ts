import type { Locale, PageKey } from '@/lib/i18n';
import { LOCALES, path } from '@/lib/i18n';
import { getPageCopy } from '@/server/page-content';
import type { ContentPage } from '@/content/slots';

/**
 * 정의형 리드문 대장(臺帳).
 *
 * 정의형 리드문은 "질문 → 답" 모양으로 페이지 맨 위에 두는 한 문단이고,
 * AI 검색이 우리 페이지를 인용할 때 가장 먼저 집어 가는 문장이다.
 * 그래서 이 화면의 목적은 "잘 쓴 문장을 다듬는 것"이 아니라
 * **비어 있는 칸을 눈에 띄게 만드는 것**이다. 값이 없으면 조용히 넘어가지 않는다.
 *
 * 읽는 곳: 페이지 문구(PageContent + 코드 기본값). 예전에는 이 파일 안의 상수 표를
 * 따로 들고 있었는데, 그 표는 어느 공개 페이지도 읽지 않아서 **화면이 사이트와 무관한
 * 숫자를 세고 있었다**(2026-08-11 실측: 표는 21칸 중 1칸만 차 있었지만, 실제 페이지에는
 * 리드문이 이미 다 들어가 있었다). 지금은 페이지가 실제로 그리는 그 문장을 본다 —
 * 여기서 "비어 있음"이 뜨면 사이트에도 정말 비어 있다.
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

/**
 * 페이지마다 정의형 리드문을 담는 슬롯 이름이 다르다. 페이지를 각자 만들면서
 * 이름이 갈렸을 뿐 역할은 같은 자리다 — 그 대응을 여기 한 곳에 적어 둔다.
 * `slots.ts` 의 슬롯 이름과 반드시 일치해야 한다(없는 이름을 적으면 늘 빈칸으로 보인다).
 */
const LEAD_SLOT: Record<string, string> = {
  home: 'lead.headline',
  studio: 'lead',
  location: 'lead',
  dress: 'hero.lead',
  plan: 'hero.lead',
  photographer: 'intro',
  gallery: 'definition',
};

export type LeadRow = {
  pageKey: PageKey;
  pageLabel: string;
  locale: Locale;
  url: string;
  lead: string | null;
  /** 이 문장을 실제로 고치는 자리. 편집기가 여기로 보낸다. */
  slot: string;
  editHref: string;
};

/** 페이지 × 로케일 전수. 빈 칸이 행으로 남는 것이 이 함수의 목적이다. */
export async function listLeadRows(): Promise<LeadRow[]> {
  const rows: LeadRow[] = [];

  for (const pageKey of LEAD_REQUIRED_PAGES) {
    const slot = LEAD_SLOT[pageKey];
    for (const locale of LOCALES) {
      let lead: string | null = null;
      if (slot) {
        try {
          const copy = await getPageCopy(pageKey as ContentPage, locale);
          const value = copy[slot]?.trim();
          lead = value ? value : null;
        } catch {
          // 문구 조회가 실패한 것을 "리드문 없음"으로 바꾸지 않는다 — 없는 결함을
          // 만들어 보고하는 셈이 된다. 판단 불가는 빈칸으로 두되 아래 주석대로 드러난다.
          lead = null;
        }
      }
      rows.push({
        pageKey,
        pageLabel: PAGE_LABEL[pageKey] ?? pageKey,
        locale,
        url: path(locale, pageKey),
        lead,
        slot: slot ?? '',
        editHref: `/admin/content/${pageKey}`,
      });
    }
  }

  return rows;
}

export async function countLeads(): Promise<{
  written: number;
  total: number;
  missing: LeadRow[];
}> {
  const rows = await listLeadRows();
  const missing = rows.filter((r) => r.lead === null);
  return { written: rows.length - missing.length, total: rows.length, missing };
}
