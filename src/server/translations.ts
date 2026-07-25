import { NotImplementedError } from '@/server/errors';
import { LOCALES, type Locale } from '@/lib/i18n';
import {
  ANNIVERSARY_PLANS,
  CHANNELS,
  LOCATION_NOTES,
  LOCATION_PLANS,
  STUDIO_OPTIONS,
  STUDIO_PLANS,
  STUDIO_SETS,
} from '@/content/site';
import { DRESS_COLLECTIONS, DRESS_ITEMS, FITTING_STEPS, RENTAL_CONDITIONS } from '@/content/dress';
import { listJournalGroups } from '@/server/journal';

/**
 * 번역 관리.
 *
 * 전제: JA / EN / KO 는 서로의 번역본이 아니라 각각 독립된 본문이다.
 * 그래서 이 화면의 목적은 "빈 곳을 드러내는 것"이지 "자동으로 채우는 것"이 아니다.
 * prisma/schema.prisma 에 번역 테이블이 따로 없는 것도 같은 이유다 —
 * 레코드 하나가 Json { ja, en, ko } 로 세 언어를 함께 들고 있다.
 *
 * 아래 목록은 실제 content 모듈을 읽어서 만든다. 그래서 여기서 나오는
 * "미작성" 표시는 시안의 예시 수치가 아니라 지금 코드베이스의 진짜 구멍이다.
 */

export type L10n = Record<Locale, string>;
export type PartialL10n = Partial<Record<Locale, string>>;

export const TRANSLATION_GROUPS = [
  'studio',
  'plan',
  'option',
  'location',
  'dress',
  'contact',
  'journal',
] as const;
export type TranslationGroup = (typeof TRANSLATION_GROUPS)[number];

export const TRANSLATION_GROUP_LABEL: Record<TranslationGroup, string> = {
  studio: '스튜디오',
  plan: '플랜',
  option: '옵션',
  location: '로케이션',
  dress: '드레스',
  contact: '문의 · 채널',
  journal: '촬영후기',
};

export type TranslationField = {
  /** studio.set.arch-window.title 같은 점 구분 키 */
  key: string;
  group: TranslationGroup;
  /** 관리자 화면에 보여줄 한국어 설명 */
  label: string;
  values: PartialL10n;
  /** 아직 본문이 없는 언어 */
  missing: Locale[];
  /** 값이 어느 모듈에서 오는지 */
  origin: 'content' | 'journal';
  /**
   * 저장 경로가 연결되어 있는지. Prisma 이관 전까지 전부 false 이고,
   * 화면은 이 값을 그대로 읽어 "편집 불가" 사실을 표시한다.
   */
  editable: boolean;
};

const ALL: Locale[] = [...LOCALES];

function has(v: string | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function field(
  key: string,
  group: TranslationGroup,
  label: string,
  values: PartialL10n,
  origin: TranslationField['origin'] = 'content',
): TranslationField {
  return {
    key,
    group,
    label,
    values,
    missing: ALL.filter((l) => !has(values[l])),
    origin,
    // TODO(prisma): 각 도메인 저장 경로가 붙으면 true 로 바꾼다.
    editable: false,
  };
}

/** 문장 배열은 줄 단위로 쪼개지 않고 한 필드로 본다 — 언어마다 문장 수가 다를 수 있기 때문이다. */
function joinList(v: Record<Locale, string[]> | Partial<Record<Locale, string[]>>): PartialL10n {
  const out: PartialL10n = {};
  for (const l of ALL) out[l] = (v[l] ?? []).join('\n');
  return out;
}

function collectContentFields(): TranslationField[] {
  const out: TranslationField[] = [];

  // 스튜디오 세트
  for (const s of STUDIO_SETS) {
    out.push(field(`studio.set.${s.slug}.title`, 'studio', `세트 · ${s.slug} 제목`, s.title));
    out.push(field(`studio.set.${s.slug}.note`, 'studio', `세트 · ${s.slug} 설명`, s.note));
  }

  // 플랜 3종
  for (const p of [...STUDIO_PLANS, ...LOCATION_PLANS, ...ANNIVERSARY_PLANS]) {
    out.push(field(`plan.${p.code}.title`, 'plan', `플랜 · ${p.code} 제목`, p.title));
    out.push(field(`plan.${p.code}.duration`, 'plan', `플랜 · ${p.code} 촬영시간`, p.duration));
    out.push(
      field(`plan.${p.code}.includes`, 'plan', `플랜 · ${p.code} 포함사항`, joinList(p.includes)),
    );
  }

  // 옵션
  STUDIO_OPTIONS.forEach((o, i) => {
    const slug = `opt-${String(i + 1).padStart(2, '0')}`;
    out.push(field(`plan.option.${slug}.label`, 'option', `옵션 ${i + 1} 이름`, o.label));
    out.push(field(`plan.option.${slug}.price`, 'option', `옵션 ${i + 1} 금액`, o.price));
    out.push(field(`plan.option.${slug}.scope`, 'option', `옵션 ${i + 1} 적용범위`, o.scope));
  });

  // 로케이션 주의사항
  out.push(
    field('location.notes', 'location', '로케이션 주의사항', joinList(LOCATION_NOTES)),
  );

  // 드레스 컬렉션 · 대여 · 순서
  for (const c of DRESS_COLLECTIONS) {
    out.push(field(`dress.collection.${c.slug}.title`, 'dress', `컬렉션 · ${c.slug} 제목`, c.title));
    out.push(field(`dress.collection.${c.slug}.note`, 'dress', `컬렉션 · ${c.slug} 설명`, c.note));
  }
  for (const r of RENTAL_CONDITIONS) {
    out.push(field(`dress.rental.${r.key}.label`, 'dress', `대여 · ${r.key} 항목명`, r.label));
    out.push(field(`dress.rental.${r.key}.body`, 'dress', `대여 · ${r.key} 내용`, joinList(r.body)));
  }
  for (const s of FITTING_STEPS) {
    out.push(field(`dress.fitting.${s.no}`, 'dress', `고르는 순서 ${s.no}`, s.body));
  }
  for (const d of DRESS_ITEMS) {
    out.push(field(`dress.item.${d.id}.name`, 'dress', `드레스 · ${d.id} 이름`, d.name));
    out.push(field(`dress.item.${d.id}.description`, 'dress', `드레스 · ${d.id} 설명`, d.description));
  }

  // 상담 채널 — 로케일마다 채널 목록 자체가 다르다(업무 규칙).
  // 그래서 같은 문장의 3개 언어가 아니라 "그 언어의 채널 구성"을 한 줄로 본다.
  const channelSummary: PartialL10n = {};
  for (const l of ALL) channelSummary[l] = CHANNELS[l].map((c) => c.label[l]).join(' · ');
  out.push(field('contact.channel.list', 'contact', '언어별 채널 구성', channelSummary));

  const channelNote: PartialL10n = {};
  for (const l of ALL) {
    const primary = CHANNELS[l].find((c) => c.primary);
    channelNote[l] = primary?.note[l] ?? '';
  }
  out.push(field('contact.channel.note', 'contact', '1순위 채널 안내문', channelNote));

  return out;
}

async function collectJournalFields(): Promise<TranslationField[]> {
  const groups = await listJournalGroups();
  return groups.map((g) => {
    const values: PartialL10n = {};
    for (const l of ALL) values[l] = g.posts[l]?.title ?? '';
    return field(`journal.${g.slug}.title`, 'journal', `촬영후기 · ${g.slug}`, values, 'journal');
  });
}

/* ---------------------------------------------------------------- 읽기 */

export type ListTranslationOptions = {
  group?: TranslationGroup;
  /** 한 언어라도 비어 있는 항목만 */
  missingOnly?: boolean;
  /** 이 언어가 비어 있는 항목만 */
  missingLocale?: Locale;
};

export async function listTranslationFields(
  opts: ListTranslationOptions = {},
): Promise<TranslationField[]> {
  let fields = [...collectContentFields(), ...(await collectJournalFields())];
  if (opts.group) fields = fields.filter((f) => f.group === opts.group);
  if (opts.missingOnly) fields = fields.filter((f) => f.missing.length > 0);
  if (opts.missingLocale) {
    const l = opts.missingLocale;
    fields = fields.filter((f) => f.missing.includes(l));
  }
  return fields;
}

export type LocaleCoverage = {
  locale: Locale;
  total: number;
  filled: number;
  missing: number;
  /** 0-100 정수 */
  percent: number;
};

/**
 * 언어별 작성률.
 * JA 를 기준 언어로 부르지만 "원문"이라는 뜻은 아니다 — 가장 먼저 쓰이는 언어일 뿐이고,
 * EN / KO 가 JA 의 번역이어야 한다는 의미가 아니다.
 */
export async function getTranslationCoverage(): Promise<LocaleCoverage[]> {
  const fields = await listTranslationFields();
  const total = fields.length;
  return ALL.map((locale) => {
    const filled = fields.filter((f) => !f.missing.includes(locale)).length;
    return {
      locale,
      total,
      filled,
      missing: total - filled,
      percent: total === 0 ? 100 : Math.round((filled / total) * 100),
    };
  });
}

/* ---------------------------------------------------------------- 쓰기 */

export type TranslationSaveInput = {
  key: string;
  locale: Locale;
  value: string;
  /** 사람이 확인했다는 표시. 기계 초안은 이 값 없이 저장될 수 없다. */
  reviewed: boolean;
};

export async function saveTranslationField(input: TranslationSaveInput): Promise<TranslationField> {
  // TODO(prisma): 키의 앞 세그먼트로 대상 모델을 정하고 해당 Json 컬럼을 갱신한다.
  throw new NotImplementedError('번역 저장');
}

/* --------------------------------------------------- 기계번역 초안 (seam) */

/**
 * 기계번역은 "초안"까지만이다.
 * - 결과는 항상 draft 로 표시되고 reviewed=false 다.
 * - reviewed=false 인 값은 게시될 수 없다 (canPublish 참고).
 * - 자동으로 저장하지 않는다. 사람이 읽고 고친 뒤에만 저장 경로를 탄다.
 */
export type MachineDraft = {
  key: string;
  locale: Locale;
  text: string;
  isDraft: true;
  reviewed: false;
  engine: string;
};

export type MachineDraftResult =
  | { ok: false; reason: string }
  | { ok: true; draft: MachineDraft };

export function getTranslationEngineConfig(): { configured: boolean; engine: string | null } {
  const engine = process.env.TRANSLATION_ENGINE ?? null;
  return { configured: Boolean(engine && process.env.TRANSLATION_API_KEY), engine };
}

export async function requestMachineDraft(key: string, locale: Locale): Promise<MachineDraftResult> {
  const cfg = getTranslationEngineConfig();
  if (!cfg.configured) {
    return { ok: false, reason: '기계번역 엔진이 설정되지 않았습니다. 초안을 만들 수 없습니다.' };
  }
  // TODO(translate): 엔진 호출. 결과는 반드시 reviewed:false 인 초안으로만 돌려준다.
  throw new NotImplementedError('기계번역 초안 생성');
}

/** 사람이 확인하지 않은 값은 게시할 수 없다. */
export function canPublish(value: { reviewed: boolean; text: string }): boolean {
  return value.reviewed && value.text.trim().length > 0;
}
