import type { Locale, PageKey } from '@/lib/i18n';

import { HOME } from '@/app/[locale]/home-content';
import * as STUDIO from '@/app/[locale]/studio/content';
import * as LOCATION from '@/app/[locale]/location/content';
import * as DRESS from '@/app/[locale]/dress/content';
import { CONTACT } from '@/app/[locale]/contact/content';
import { PHOTOGRAPHER } from '@/app/[locale]/photographer/content';
import * as PLAN from '@/components/plan/content';
import { GALLERY } from '@/components/gallery/content';
import { JOURNAL_UI } from '@/content/journal';

/**
 * 편집 가능한 문구 자리(슬롯) 목록.
 *
 * 이 파일이 관리자 편집기와 공개 페이지 사이의 계약이다. 여기 없는 슬롯은
 * DB에 행이 있어도 무시되고, 여기 있는 슬롯은 행이 없으면 아래 default 가 나간다.
 * 그래서 슬롯을 하나 늘리는 일이 한 줄 추가로 끝난다.
 *
 * 원본 카피는 여전히 각 페이지의 content.ts 가 소유한다. PageContent 는 그 위에
 * 얹는 덮어쓰기 레이어일 뿐이다 — 통째로 DB로 옮기면 행 하나가 비었을 때
 * 화면이 빈칸이 된다.
 *
 * 없는 문구는 슬롯으로 만들지 않았다. 실제 코드에 있는 문자열만 등록한다.
 */

/** 자리의 성격. 편집기가 입력 위젯과 길이 제한을 여기서 고른다. */
export type SlotKind =
  /** 제목·라벨처럼 한 줄 */
  | 'short'
  /** 리드문·안내처럼 문단 */
  | 'long'
  /** 줄 단위 목록. 값은 줄바꿈으로 이어 붙인 하나의 문자열이다 */
  | 'list';

export type SlotDef = {
  /** DB의 PageContent.slot 과 1:1. 한 번 정하면 바꾸지 않는다 — 저장된 행이 미아가 된다. */
  slot: string;
  /** 관리자 화면 라벨 (한국어) */
  label: string;
  kind: SlotKind;
  /** 편집기에서 묶어 보여줄 구역 이름 */
  group: string;
  /** 코드 기본값. 행이 없거나 값이 비면 이게 나간다. */
  default: (locale: Locale) => string;
};

/** 문구 편집을 여는 페이지. PageKey 의 부분집합이라 path() 에 그대로 넘길 수 있다. */
export type ContentPage = Extract<
  PageKey,
  'home' | 'studio' | 'location' | 'dress' | 'plan' | 'photographer' | 'journal' | 'gallery' | 'contact'
>;

export type PageSlots = {
  page: ContentPage;
  /** 관리자 목록에 보이는 이름 */
  label: string;
  /** 이 페이지가 무엇을 바꾸는지 한 줄 */
  note: string;
  slots: SlotDef[];
};

/** list 슬롯의 기본값 — 줄 배열을 줄바꿈 하나로 이어 붙인다. */
const lines = (v: readonly string[]) => v.join('\n');

/* ============================== HOME ============================== */

const HOME_SLOTS: SlotDef[] = [
  {
    slot: 'meta.title',
    label: '메타 제목',
    kind: 'short',
    group: '검색 결과',
    default: (l) => HOME[l].meta.title,
  },
  {
    slot: 'meta.description',
    label: '메타 설명',
    kind: 'long',
    group: '검색 결과',
    default: (l) => HOME[l].meta.description,
  },
  {
    slot: 'hero.location.lines',
    label: '히어로 · LOCATION 문구',
    kind: 'list',
    group: '히어로',
    default: (l) => lines(HOME[l].hero.location.lines),
  },
  {
    slot: 'hero.location.cta',
    label: '히어로 · LOCATION 버튼',
    kind: 'short',
    group: '히어로',
    default: (l) => HOME[l].hero.location.cta,
  },
  {
    slot: 'hero.studio.lines',
    label: '히어로 · STUDIO 문구',
    kind: 'list',
    group: '히어로',
    default: (l) => lines(HOME[l].hero.studio.lines),
  },
  {
    slot: 'hero.studio.cta',
    label: '히어로 · STUDIO 버튼',
    kind: 'short',
    group: '히어로',
    default: (l) => HOME[l].hero.studio.cta,
  },
  {
    slot: 'lead.headline',
    label: '정의형 리드 · 큰 제목',
    kind: 'list',
    group: '리드문 (AI 인용 표면)',
    default: (l) => lines(HOME[l].lead.headline),
  },
  {
    slot: 'lead.sub',
    label: '정의형 리드 · 보조 문장',
    kind: 'list',
    group: '리드문 (AI 인용 표면)',
    default: (l) => lines(HOME[l].lead.sub),
  },
  {
    slot: 'studioPlans.title',
    label: '스튜디오 플랜 · 제목',
    kind: 'short',
    group: '스튜디오 플랜',
    default: (l) => HOME[l].studioPlans.title,
  },
  {
    slot: 'studioPlans.note',
    label: '스튜디오 플랜 · 안내',
    kind: 'long',
    group: '스튜디오 플랜',
    default: (l) => HOME[l].studioPlans.note,
  },
  {
    slot: 'sets.title',
    label: '세트 소개 · 제목',
    kind: 'short',
    group: '세트 소개',
    default: (l) => HOME[l].sets.title,
  },
  {
    slot: 'sets.lead',
    label: '세트 소개 · 리드',
    kind: 'long',
    group: '세트 소개',
    default: (l) => HOME[l].sets.lead,
  },
  {
    slot: 'locationPlans.title',
    label: '로케이션 플랜 · 제목',
    kind: 'short',
    group: '로케이션 플랜',
    default: (l) => HOME[l].locationPlans.title,
  },
  {
    slot: 'locationPlans.lead',
    label: '로케이션 플랜 · 리드',
    kind: 'long',
    group: '로케이션 플랜',
    default: (l) => HOME[l].locationPlans.lead,
  },
  {
    slot: 'works.title',
    label: '최근 작품 · 제목',
    kind: 'short',
    group: '최근 작품',
    default: (l) => HOME[l].works.title,
  },
  {
    slot: 'works.lead',
    label: '최근 작품 · 리드',
    kind: 'long',
    group: '최근 작품',
    default: (l) => HOME[l].works.lead,
  },
  {
    slot: 'photographer.body',
    label: '작가 소개 · 본문',
    kind: 'list',
    group: '작가 소개',
    default: (l) => lines(HOME[l].photographer.body),
  },
  {
    slot: 'faq.title',
    label: 'FAQ · 제목',
    kind: 'short',
    group: 'FAQ',
    default: (l) => HOME[l].faq.title,
  },
  // FAQ 문답은 질문/답 쌍이라 한 줄 슬롯으로 다루면 짝이 어긋난다.
  // 항목 수는 언어마다 다르므로(ja 4 / en 6 / ko 6) 코드에 있는 개수만큼만 연다.
  ...faqSlots(),
];

/** 홈 FAQ 문답. 언어별 항목 수가 달라 가장 많은 쪽에 맞춰 열고, 없는 항목은 빈 기본값이 된다. */
function faqSlots(): SlotDef[] {
  const max = Math.max(...(['ja', 'en', 'ko'] as Locale[]).map((l) => HOME[l].faq.items.length));
  const out: SlotDef[] = [];
  for (let i = 0; i < max; i += 1) {
    out.push({
      slot: `faq.${i}.q`,
      label: `FAQ ${i + 1} · 질문`,
      kind: 'short',
      group: 'FAQ',
      default: (l) => HOME[l].faq.items[i]?.q ?? '',
    });
    out.push({
      slot: `faq.${i}.a`,
      label: `FAQ ${i + 1} · 답변`,
      kind: 'long',
      group: 'FAQ',
      default: (l) => HOME[l].faq.items[i]?.a ?? '',
    });
  }
  return out;
}

/* ============================= STUDIO ============================= */

const STUDIO_SLOTS: SlotDef[] = [
  {
    slot: 'meta.title',
    label: '메타 제목',
    kind: 'short',
    group: '검색 결과',
    default: (l) => STUDIO.META.title[l],
  },
  {
    slot: 'meta.description',
    label: '메타 설명',
    kind: 'long',
    group: '검색 결과',
    default: (l) => STUDIO.META.description[l],
  },
  {
    slot: 'hero.sub',
    label: '히어로 · 한 줄 (한국어 전용)',
    kind: 'short',
    group: '히어로',
    default: (l) => STUDIO.HERO.sub[l],
  },
  {
    slot: 'lead',
    label: '정의형 리드문',
    kind: 'list',
    group: '리드문 (AI 인용 표면)',
    default: (l) => lines(STUDIO.LEAD[l]),
  },
  {
    slot: 'lead.note',
    label: '리드 아래 요약',
    kind: 'list',
    group: '리드문 (AI 인용 표면)',
    default: (l) => lines(STUDIO.LEAD_NOTE[l]),
  },
  {
    slot: 'sets.title',
    label: '세트 · 제목',
    kind: 'short',
    group: '세트',
    default: (l) => STUDIO.SETS.title[l],
  },
  {
    slot: 'sets.lead',
    label: '세트 · 리드',
    kind: 'long',
    group: '세트',
    default: (l) => STUDIO.SETS.lead[l],
  },
  {
    slot: 'flow.title',
    label: '촬영 흐름 · 제목',
    kind: 'short',
    group: '촬영 흐름',
    default: (l) => STUDIO.FLOW.title[l],
  },
  {
    slot: 'plans.title',
    label: '플랜 · 제목',
    kind: 'short',
    group: '플랜',
    default: (l) => STUDIO.PLANS.title[l],
  },
  {
    slot: 'plans.link',
    label: '플랜 · 상세 링크 문구',
    kind: 'short',
    group: '플랜',
    default: (l) => STUDIO.PLANS.link[l],
  },
  {
    slot: 'access.title',
    label: '찾아오는 길 · 제목',
    kind: 'short',
    group: '찾아오는 길',
    default: (l) => STUDIO.ACCESS.title[l],
  },
  {
    slot: 'access.landmark',
    label: '찾아오는 길 · 목표물',
    kind: 'long',
    group: '찾아오는 길',
    default: (l) => STUDIO.ACCESS.landmark[l],
  },
  {
    slot: 'works.title',
    label: '작품 · 제목',
    kind: 'short',
    group: '작품',
    default: (l) => STUDIO.WORKS.title[l],
  },
];

/* ============================ LOCATION ============================ */

const LOCATION_SLOTS: SlotDef[] = [
  {
    slot: 'meta.title',
    label: '메타 제목',
    kind: 'short',
    group: '검색 결과',
    default: (l) => LOCATION.META.title[l],
  },
  {
    slot: 'meta.description',
    label: '메타 설명',
    kind: 'long',
    group: '검색 결과',
    default: (l) => LOCATION.META.description[l],
  },
  {
    slot: 'hero.sub',
    label: '히어로 · 한 줄 (한국어 전용)',
    kind: 'short',
    group: '히어로',
    default: (l) => LOCATION.HERO.sub[l],
  },
  {
    slot: 'lead',
    label: '정의형 리드문',
    kind: 'list',
    group: '리드문 (AI 인용 표면)',
    default: (l) => lines(LOCATION.LEAD[l]),
  },
  {
    slot: 'lead.note',
    label: '리드 아래 요약',
    kind: 'list',
    group: '리드문 (AI 인용 표면)',
    default: (l) => lines(LOCATION.LEAD_NOTE[l]),
  },
  {
    slot: 'category.title',
    label: '촬영 종류 · 제목',
    kind: 'short',
    group: '촬영 종류',
    default: (l) => LOCATION.CATEGORY.title[l],
  },
  {
    slot: 'category.lead',
    label: '촬영 종류 · 리드',
    kind: 'long',
    group: '촬영 종류',
    default: (l) => LOCATION.CATEGORY.lead[l],
  },
  {
    slot: 'archive.title',
    label: '월별 아카이브 · 제목',
    kind: 'short',
    group: '월별 아카이브',
    default: (l) => LOCATION.ARCHIVE.title[l],
  },
  {
    slot: 'archive.lead',
    label: '월별 아카이브 · 리드',
    kind: 'long',
    group: '월별 아카이브',
    default: (l) => LOCATION.ARCHIVE.lead[l],
  },
  {
    slot: 'plans.title',
    label: '플랜 · 제목',
    kind: 'short',
    group: '플랜',
    default: (l) => LOCATION.PLANS.title[l],
  },
  {
    slot: 'plans.link',
    label: '플랜 · 상세 링크 문구',
    kind: 'short',
    group: '플랜',
    default: (l) => LOCATION.PLANS.link[l],
  },
  {
    slot: 'works.title',
    label: '작품 · 제목',
    kind: 'short',
    group: '작품',
    default: (l) => LOCATION.WORKS.title[l],
  },
];

/* ============================== DRESS ============================= */

const DRESS_SLOTS: SlotDef[] = [
  {
    slot: 'meta.title',
    label: '메타 제목',
    kind: 'short',
    group: '검색 결과',
    default: (l) => DRESS.META_TITLE[l],
  },
  {
    slot: 'hero.title',
    label: '히어로 · 제목',
    kind: 'short',
    group: '히어로',
    default: (l) => DRESS.HERO.title[l],
  },
  {
    slot: 'hero.lead',
    label: '정의형 리드문',
    kind: 'long',
    group: '리드문 (AI 인용 표면)',
    default: (l) => DRESS.HERO.lead[l],
  },
  {
    slot: 'collection.title',
    label: '컬렉션 · 제목',
    kind: 'short',
    group: '컬렉션',
    default: (l) => DRESS.COLLECTION.title[l],
  },
  {
    slot: 'collection.pendingPhotos',
    label: '컬렉션 · 사진 준비 중 안내',
    kind: 'long',
    group: '컬렉션',
    default: (l) => DRESS.COLLECTION.pendingPhotos[l],
  },
  {
    slot: 'rental.title',
    label: '대여 안내 · 제목',
    kind: 'short',
    group: '대여 안내',
    default: (l) => DRESS.RENTAL.title[l],
  },
  {
    slot: 'fitting.title',
    label: '고르는 순서 · 제목',
    kind: 'short',
    group: '고르는 순서',
    default: (l) => DRESS.FITTING.title[l],
  },
  {
    slot: 'fitting.steps',
    label: '고르는 순서 · 단계',
    kind: 'list',
    group: '고르는 순서',
    default: (l) => lines(DRESS.FITTING.steps[l]),
  },
];

/* ============================== PLAN ============================== */

const PLAN_SLOTS: SlotDef[] = [
  {
    slot: 'meta.title',
    label: '메타 제목',
    kind: 'short',
    group: '검색 결과',
    default: (l) => PLAN.META_TITLE[l],
  },
  {
    slot: 'hero.label',
    label: '히어로 · 라벨',
    kind: 'short',
    group: '히어로',
    default: (l) => PLAN.HERO.label[l],
  },
  {
    slot: 'hero.title',
    label: '히어로 · 제목',
    kind: 'short',
    group: '히어로',
    default: (l) => PLAN.HERO.title[l],
  },
  {
    slot: 'hero.lead',
    label: '정의형 리드문',
    kind: 'long',
    group: '리드문 (AI 인용 표면)',
    default: (l) => PLAN.HERO.lead[l],
  },
  {
    slot: 'monitorPrice',
    label: '모니터 가격 표기',
    kind: 'short',
    group: '가격 표기',
    default: (l) => PLAN.MONITOR_PRICE[l],
  },
  {
    slot: 'locationPanel.note',
    label: '로케이션 · 세금 안내',
    kind: 'long',
    group: '가격 표기',
    default: (l) => PLAN.LOCATION_PANEL.note[l],
  },
  {
    slot: 'anniversaryPanel.note',
    label: '기념사진 · 세금 안내',
    kind: 'long',
    group: '가격 표기',
    default: (l) => PLAN.ANNIVERSARY_PANEL.note[l],
  },
  {
    slot: 'option.title',
    label: '옵션 · 제목',
    kind: 'short',
    group: '옵션',
    default: (l) => PLAN.OPTION_SECTION.title[l],
  },
  {
    slot: 'option.lead',
    label: '옵션 · 리드',
    kind: 'long',
    group: '옵션',
    default: (l) => PLAN.OPTION_SECTION.lead[l],
  },
  {
    slot: 'flow.title',
    label: '예약 순서 · 제목',
    kind: 'short',
    group: '예약 순서',
    default: (l) => PLAN.FLOW.title[l],
  },
  {
    slot: 'flow.steps',
    label: '예약 순서 · 단계',
    kind: 'list',
    group: '예약 순서',
    default: (l) => lines(PLAN.FLOW.steps[l]),
  },
  {
    slot: 'notes.title',
    label: '취소 · 우천 · 제목',
    kind: 'short',
    group: '취소 · 우천',
    default: (l) => PLAN.NOTES.title[l],
  },
  {
    slot: 'notes.cancel',
    label: '취소 규정 본문',
    kind: 'long',
    group: '취소 · 우천',
    default: (l) => PLAN.NOTES.cancel[l],
  },
  {
    slot: 'notes.cancelScale',
    label: '취소 위약금 단계',
    kind: 'long',
    group: '취소 · 우천',
    default: (l) => PLAN.NOTES.cancelScale[l],
  },
];

/* ========================== PHOTOGRAPHER ========================== */

const PHOTOGRAPHER_SLOTS: SlotDef[] = [
  {
    slot: 'meta.title',
    label: '메타 제목',
    kind: 'short',
    group: '검색 결과',
    default: (l) => PHOTOGRAPHER[l].meta.title,
  },
  {
    slot: 'meta.description',
    label: '메타 설명',
    kind: 'long',
    group: '검색 결과',
    default: (l) => PHOTOGRAPHER[l].meta.description,
  },
  {
    slot: 'title',
    label: '페이지 제목',
    kind: 'short',
    group: '히어로',
    default: (l) => PHOTOGRAPHER[l].title,
  },
  {
    slot: 'intro',
    label: '정의형 도입 문단',
    kind: 'list',
    group: '리드문 (AI 인용 표면)',
    default: (l) => lines(PHOTOGRAPHER[l].intro),
  },
  {
    slot: 'name.lines',
    label: '이름의 뜻 · 본문',
    kind: 'list',
    group: '이름의 뜻',
    default: (l) => lines(PHOTOGRAPHER[l].name.lines),
  },
  {
    slot: 'name.note',
    label: '이름의 뜻 · 덧붙임',
    kind: 'list',
    group: '이름의 뜻',
    default: (l) => lines(PHOTOGRAPHER[l].name.note),
  },
  {
    slot: 'how.title',
    label: '촬영에 대하여 · 제목',
    kind: 'short',
    group: '촬영에 대하여',
    default: (l) => PHOTOGRAPHER[l].how.title,
  },
  {
    slot: 'guests.title',
    label: '상담 언어 안내 · 제목',
    kind: 'short',
    group: '상담 언어 안내',
    default: (l) => PHOTOGRAPHER[l].guests.title,
  },
  {
    slot: 'guests.body',
    label: '상담 언어 안내 · 본문',
    kind: 'list',
    group: '상담 언어 안내',
    default: (l) => lines(PHOTOGRAPHER[l].guests.body),
  },
  {
    slot: 'follow.title',
    label: '연결 채널 · 제목',
    kind: 'short',
    group: '연결 채널',
    default: (l) => PHOTOGRAPHER[l].follow.title,
  },
  {
    slot: 'follow.note',
    label: '연결 채널 · 안내',
    kind: 'long',
    group: '연결 채널',
    default: (l) => PHOTOGRAPHER[l].follow.note,
  },
];

/* ============================= JOURNAL ============================ */

const JOURNAL_SLOTS: SlotDef[] = [
  {
    slot: 'meta.title',
    label: '메타 제목',
    kind: 'short',
    group: '검색 결과',
    default: (l) => JOURNAL_UI[l].listMeta.title,
  },
  {
    slot: 'meta.description',
    label: '메타 설명',
    kind: 'long',
    group: '검색 결과',
    default: (l) => JOURNAL_UI[l].listMeta.description,
  },
  {
    slot: 'heading',
    label: '목록 제목',
    kind: 'short',
    group: '목록 상단',
    default: (l) => JOURNAL_UI[l].heading,
  },
  {
    slot: 'lead',
    label: '정의형 리드문',
    kind: 'list',
    group: '리드문 (AI 인용 표면)',
    default: (l) => lines(JOURNAL_UI[l].lead),
  },
  {
    slot: 'planLead',
    label: '글 하단 · 플랜 안내 문구',
    kind: 'short',
    group: '글 하단',
    default: (l) => JOURNAL_UI[l].planLead,
  },
  {
    slot: 'naverNote',
    label: '네이버 블로그 안내 (한국어 전용)',
    kind: 'long',
    group: '글 하단',
    default: (l) => JOURNAL_UI[l].naverNote ?? '',
  },
];

/* ============================= GALLERY ============================ */

const GALLERY_SLOTS: SlotDef[] = [
  {
    slot: 'title',
    label: '페이지 제목',
    kind: 'short',
    group: '상단',
    default: (l) => GALLERY.title[l],
  },
  {
    slot: 'definition',
    label: '정의형 리드문',
    kind: 'long',
    group: '리드문 (AI 인용 표면)',
    default: (l) => GALLERY.definition[l],
  },
  {
    slot: 'lead',
    label: '보조 리드',
    kind: 'long',
    group: '리드문 (AI 인용 표면)',
    default: (l) => GALLERY.lead[l],
  },
  {
    slot: 'filterNote',
    label: '필터 안내',
    kind: 'long',
    group: '필터',
    default: (l) => GALLERY.filterNote[l],
  },
  {
    slot: 'empty',
    label: '결과 없음 안내',
    kind: 'long',
    group: '필터',
    default: (l) => GALLERY.empty[l],
  },
  {
    slot: 'ownDomainNote',
    label: '자사 도메인 서빙 안내',
    kind: 'long',
    group: '상세',
    default: (l) => GALLERY.ownDomainNote[l],
  },
];

/* ============================= CONTACT ============================ */

const CONTACT_SLOTS: SlotDef[] = [
  {
    slot: 'title',
    label: '페이지 제목',
    kind: 'short',
    group: '상단',
    default: (l) => CONTACT.title[l],
  },
  {
    slot: 'definition',
    label: '정의형 리드문',
    kind: 'long',
    group: '리드문 (AI 인용 표면)',
    default: (l) => CONTACT.definition[l],
  },
  {
    slot: 'lead',
    label: '보조 리드',
    kind: 'list',
    group: '리드문 (AI 인용 표면)',
    default: (l) => lines(CONTACT.lead[l]),
  },
  {
    slot: 'direct.title',
    label: '메시지 상담 · 제목',
    kind: 'short',
    group: '메시지 상담',
    default: (l) => CONTACT.directTitle[l],
  },
  ...contactFaqSlots(),
];

/** 문의 페이지 FAQ. 항목 수는 세 언어가 같은 배열을 공유하므로 길이가 하나다. */
function contactFaqSlots(): SlotDef[] {
  return CONTACT.faq.flatMap((item, i) => [
    {
      slot: `faq.${i}.q`,
      label: `FAQ ${i + 1} · 질문`,
      kind: 'short' as const,
      group: 'FAQ',
      default: (l: Locale) => item.q[l],
    },
    {
      slot: `faq.${i}.a`,
      label: `FAQ ${i + 1} · 답변`,
      kind: 'long' as const,
      group: 'FAQ',
      default: (l: Locale) => item.a[l],
    },
  ]);
}

/* ============================ 레지스트리 =========================== */

export const PAGE_SLOTS: PageSlots[] = [
  { page: 'home', label: '홈', note: '히어로 · 리드문 · 각 섹션 제목과 FAQ', slots: HOME_SLOTS },
  { page: 'studio', label: '스튜디오', note: '리드문 · 세트 · 촬영 흐름 · 찾아오는 길', slots: STUDIO_SLOTS },
  { page: 'location', label: '로케이션', note: '리드문 · 촬영 종류 · 월별 아카이브', slots: LOCATION_SLOTS },
  { page: 'dress', label: '드레스', note: '리드문 · 컬렉션 · 대여 안내 · 고르는 순서', slots: DRESS_SLOTS },
  { page: 'plan', label: '플랜', note: '리드문 · 세금 표기 · 예약 순서 · 취소 규정', slots: PLAN_SLOTS },
  { page: 'photographer', label: '작가 소개', note: '도입 문단 · 이름의 뜻 · 촬영에 대하여', slots: PHOTOGRAPHER_SLOTS },
  { page: 'journal', label: '촬영후기', note: '목록 제목 · 리드문 · 글 하단 안내', slots: JOURNAL_SLOTS },
  { page: 'gallery', label: '갤러리', note: '리드문 · 필터 안내 · 결과 없음 문구', slots: GALLERY_SLOTS },
  { page: 'contact', label: '문의', note: '리드문 · 폼 라벨 · FAQ', slots: CONTACT_SLOTS },
];

const BY_PAGE = new Map<string, PageSlots>(PAGE_SLOTS.map((p) => [p.page, p]));

export function isContentPage(v: string): v is ContentPage {
  return BY_PAGE.has(v);
}

/** 페이지의 슬롯 정의. 등록되지 않은 페이지는 빈 배열 — 호출측이 분기하지 않아도 된다. */
export function slotsFor(page: ContentPage): SlotDef[] {
  return BY_PAGE.get(page)?.slots ?? [];
}

export function pageSlotsFor(page: ContentPage): PageSlots | undefined {
  return BY_PAGE.get(page);
}

/** 슬롯 하나의 정의. 저장 요청이 레지스트리 밖 슬롯을 만드는 것을 막는 데 쓴다. */
export function findSlot(page: ContentPage, slot: string): SlotDef | undefined {
  return slotsFor(page).find((s) => s.slot === slot);
}

/** 종류별 최대 길이. 편집기와 API가 같은 값을 본다. */
export const SLOT_MAX_LENGTH: Record<SlotKind, number> = {
  short: 300,
  long: 4000,
  list: 4000,
};
