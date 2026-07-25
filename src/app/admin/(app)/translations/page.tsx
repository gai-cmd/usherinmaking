import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  AdminButton,
  Badge,
  DataTable,
  FilterChip,
  NotWired,
  PageHeader,
  Panel,
  StatTile,
  Toolbar,
  type Column,
} from '@/components/admin';
import { LOCALES, LOCALE_LABEL, type Locale } from '@/lib/i18n';
import {
  getTranslationCoverage,
  getTranslationEngineConfig,
  listTranslationFields,
  TRANSLATION_GROUPS,
  TRANSLATION_GROUP_LABEL,
  type TranslationField,
  type TranslationGroup,
} from '@/server/translations';
import s from './translations.module.css';
import { checkAdminPageAccess } from '@/server/auth';

export const metadata = { title: '번역 관리 · 관리자' };

function cell(field: TranslationField, locale: Locale) {
  const value = field.values[locale];
  if (!value || !value.trim()) {
    // 비어 있는 것을 일본어로 대신 채워 보여 주지 않는다. 빈 곳은 빈 곳으로 보여야 한다.
    return <span className={s.missing}>미작성 — 입력 필요</span>;
  }
  return (
    <span className={s.value} lang={locale}>
      {value}
    </span>
  );
}

export default async function AdminTranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; missing?: string }>;
}) {
  // 레이아웃 가드만으로는 이 컴포넌트의 실행을 막지 못한다.
  // App Router에서 자식 세그먼트는 부모의 조건과 무관하게 렌더되고, 그 결과가 같은 응답의
  // RSC 페이로드에 실려 나간다. 그래서 데이터를 읽기 전에 여기서 한 번 더 끊는다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const sp = await searchParams;
  const group = TRANSLATION_GROUPS.includes(sp.group as TranslationGroup)
    ? (sp.group as TranslationGroup)
    : undefined;
  const missingOnly = sp.missing === '1';

  const [coverage, fields, engine] = await Promise.all([
    getTranslationCoverage(),
    listTranslationFields({ group, missingOnly }),
    Promise.resolve(getTranslationEngineConfig()),
  ]);

  const columns: Column<TranslationField>[] = [
    {
      key: 'key',
      header: 'KEY',
      width: '22%',
      cell: (f) => (
        <span className={s.keyCell}>
          <code className={s.key}>{f.key}</code>
          <span className={s.keyLabel}>{f.label}</span>
        </span>
      ),
    },
    ...LOCALES.map((l: Locale) => ({
      key: l,
      header: LOCALE_LABEL[l],
      width: '26%',
      cell: (f: TranslationField) => cell(f, l),
    })),
  ];

  const qs = (next: { group?: string; missing?: string }) => {
    const p = new URLSearchParams();
    const g = next.group ?? group;
    const m = next.missing ?? (missingOnly ? '1' : undefined);
    if (g) p.set('group', g);
    if (m) p.set('missing', m);
    const q = p.toString();
    return q ? `/admin/translations?${q}` : '/admin/translations';
  };

  return (
    <>
      <PageHeader
        title="번역 관리"
        description="JA / EN / KO 가 각각 어디까지 채워졌는지 봅니다. 비어 있는 곳을 드러내는 화면이지, 자동으로 채우는 화면이 아닙니다."
        actions={
          <>
            <Link href={qs({ missing: missingOnly ? undefined : '1' })} className={s.toggle}>
              {missingOnly ? '전체 보기' : '미작성만 보기'}
            </Link>
            <AdminButton variant="primary" disabled title="저장 경로가 아직 연결되지 않았습니다">
              저장
            </AdminButton>
          </>
        }
      />

      <div className={s.body}>
        <div className={s.principle}>
          세 언어는 서로의 번역본이 아니라 <b>각각 독립된 본문</b>입니다. 일본어를 옮겨 적는 것이
          아니라, 그 언어의 독자에게 맞는 글을 따로 씁니다. 아래 작성률은 &ldquo;번역이 덜 됐다&rdquo;가
          아니라 &ldquo;그 언어의 본문이 아직 없다&rdquo;는 뜻입니다.
        </div>

        <div className={s.tiles}>
          {coverage.map((c) => (
            <StatTile
              key={c.locale}
              label={`${LOCALE_LABEL[c.locale]} · 작성률(%)`}
              value={c.percent}
              hint={
                c.missing === 0
                  ? `${c.total}항목 모두 작성됨`
                  : `미작성 ${c.missing}항목 / 전체 ${c.total}항목`
              }
              hintTone={c.missing === 0 ? 'muted' : 'accent'}
            />
          ))}
        </div>

        <Toolbar>
          <FilterChip href={qs({ group: '' })} active={!group}>
            전체
          </FilterChip>
          {TRANSLATION_GROUPS.map((g) => (
            <FilterChip key={g} href={qs({ group: g })} active={g === group}>
              {TRANSLATION_GROUP_LABEL[g]}
            </FilterChip>
          ))}
        </Toolbar>

        <Panel padded={false}>
          <DataTable
            columns={columns}
            rows={fields}
            getRowKey={(f) => f.key}
            empty={
              missingOnly
                ? '비어 있는 항목이 없습니다.'
                : '이 분류에 해당하는 항목이 없습니다.'
            }
          />
        </Panel>

        <Panel title="기계번역 초안">
          <p className={s.engineNote}>
            {engine.configured
              ? '기계번역은 초안까지만 만듭니다. 결과는 항상 초안으로 표시되고, 사람이 읽고 고쳐 확인 표시를 한 뒤에만 게시될 수 있습니다. 자동 저장하지 않습니다.'
              : '기계번역 엔진이 설정되지 않아 초안을 만들 수 없습니다. 설정되더라도 결과는 초안까지만이며, 사람이 확인하지 않은 문장은 게시되지 않습니다.'}
          </p>
          <div className={s.engineRow}>
            <Badge tone={engine.configured ? 'default' : 'warn'}>
              {engine.configured ? `엔진 ${engine.engine}` : '엔진 미설정'}
            </Badge>
            <AdminButton
              disabled
              title={
                engine.configured
                  ? '저장 경로가 아직 연결되지 않았습니다'
                  : '기계번역 엔진이 설정되지 않았습니다'
              }
            >
              선택 항목 초안 만들기
            </AdminButton>
          </div>
        </Panel>

        <NotWired
          what="번역 편집 저장"
          hint={
            <>
              Prisma 연결 후 열립니다. 값은 <code className={s.key}>@/content/site</code> ·{' '}
              <code className={s.key}>@/content/dress</code> ·{' '}
              <code className={s.key}>@/content/journal</code> 에서 직접 읽으므로, 위 빈칸은
              예시가 아니라 실제로 비어 있는 항목입니다.
            </>
          }
        />
      </div>
    </>
  );
}
