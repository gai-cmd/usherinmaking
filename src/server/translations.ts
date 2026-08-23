import { NotFoundError, NotImplementedError, ValidationError } from '@/server/errors';
import { LOCALES, type Locale } from '@/lib/i18n';
import { CHANNELS, LOCATION_NOTES, STUDIO_OPTIONS, STUDIO_SETS } from '@/content/site';
import { DRESS_COLLECTIONS, DRESS_ITEMS, FITTING_STEPS, RENTAL_CONDITIONS } from '@/content/dress';
import { listJournalGroups } from '@/server/journal';
import { getPlan, listPlans, upsertPlan } from '@/server/plans';
import { logAdminAction } from '@/server/activity';

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
   * 이 화면에서 바로 저장할 수 있는지. DB 테이블이 있는 플랜만 true 다.
   * 나머지는 코드(src/content/*.ts)가 원본이라 여기서 못 고친다 — editHint 가 어디서 고치는지 알려 준다.
   */
  editable: boolean;
  /** editable 이 false 일 때, 어디서 고쳐야 하는지 */
  editHint?: string;
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
  edit: { editable: boolean; editHint?: string } = { editable: false, editHint: CODE_HINT },
): TranslationField {
  return {
    key,
    group,
    label,
    values,
    missing: ALL.filter((l) => !has(values[l])),
    origin,
    ...edit,
  };
}

const CODE_HINT = '코드(src/content)가 원본입니다. 개발자에게 요청하세요.';
const JOURNAL_HINT = '촬영후기 글 편집 화면에서 언어별로 고칩니다.';
const PLAN_EDIT = { editable: true } as const;

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

/**
 * 플랜은 DB(Plan 테이블)가 원본이라 이 화면에서 바로 저장된다.
 * 시드만 있는 상태여도 listPlans 가 시드를 돌려주므로 목록은 비지 않는다.
 */
async function collectPlanFields(): Promise<TranslationField[]> {
  const plans = await listPlans();
  const out: TranslationField[] = [];
  for (const p of plans) {
    out.push(field(`plan.${p.code}.title`, 'plan', `플랜 · ${p.code} 제목`, p.title, 'content', PLAN_EDIT));
    out.push(
      field(`plan.${p.code}.duration`, 'plan', `플랜 · ${p.code} 촬영시간`, p.duration, 'content', PLAN_EDIT),
    );
    out.push(
      field(
        `plan.${p.code}.includes`,
        'plan',
        `플랜 · ${p.code} 포함사항`,
        joinList(p.includes),
        'content',
        PLAN_EDIT,
      ),
    );
  }
  return out;
}

async function collectJournalFields(): Promise<TranslationField[]> {
  const groups = await listJournalGroups();
  return groups.map((g) => {
    const values: PartialL10n = {};
    for (const l of ALL) values[l] = g.posts[l]?.title ?? '';
    return field(`journal.${g.slug}.title`, 'journal', `촬영후기 · ${g.slug}`, values, 'journal', {
      editable: false,
      editHint: JOURNAL_HINT,
    });
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
  let fields = [
    ...(await collectPlanFields()),
    ...collectContentFields(),
    ...(await collectJournalFields()),
  ];
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

/**
 * 키의 앞 세그먼트로 대상을 정한다. 지금 저장할 수 있는 건 `plan.<code>.<field>` 뿐이다 —
 * 나머지는 DB 테이블이 없어 코드가 원본이고, 그 사실을 editable=false 로 화면에 이미 알렸다.
 * 기계 초안(reviewed=false)은 저장하지 않는다 — 사람이 읽고 고친 뒤에만 들어온다.
 */
export async function saveTranslationField(input: TranslationSaveInput): Promise<TranslationField> {
  if (!input.reviewed) {
    throw new ValidationError('사람이 확인하지 않은 값은 저장할 수 없습니다.');
  }

  const m = /^plan\.([a-z0-9-]+)\.(title|duration|includes)$/u.exec(input.key);
  if (!m) {
    throw new ValidationError('이 항목은 이 화면에서 저장할 수 없습니다. 코드가 원본입니다.', {
      key: input.key,
    });
  }
  const code = m[1];
  const fieldName = m[2] as 'title' | 'duration' | 'includes';

  const current = await getPlan(code);
  if (!current) throw new NotFoundError(`플랜을 찾을 수 없습니다 (${code}).`);

  const value = input.value.trim();
  const next = { ...current };
  if (fieldName === 'includes') {
    next.includes = {
      ...current.includes,
      [input.locale]: value ? value.split('\n').map((l) => l.trim()).filter(Boolean) : [],
    };
  } else {
    next[fieldName] = { ...current[fieldName], [input.locale]: value };
  }

  await upsertPlan(next);
  // 본문은 남기지 않는다 — 어느 칸의 어느 언어를 고쳤는지만.
  await logAdminAction('번역 저장', input.key, { locale: input.locale });

  const saved = await getPlan(code);
  if (!saved) throw new NotFoundError(`플랜을 찾을 수 없습니다 (${code}).`);
  const values = fieldName === 'includes' ? joinList(saved.includes) : saved[fieldName];
  return field(input.key, 'plan', `플랜 · ${code}`, values, 'content', PLAN_EDIT);
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

export async function requestMachineDraft(_key: string, _locale: Locale): Promise<MachineDraftResult> {
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
