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
  Toolbar,
  formatDateTime,
  type Column,
} from '@/components/admin';
import { LOCALES, type Locale } from '@/lib/i18n';
import {
  countJournal,
  getNaverImportConfig,
  listJournalGroups,
  JOURNAL_CATEGORY_LABEL,
  type JournalGroup,
  type JournalStatus,
} from '@/server/journal';
import s from './journal.module.css';
import { checkAdminPageAccess } from '@/server/auth';

export const metadata = { title: '촬영후기 · 관리자' };

type Filter = 'all' | JournalStatus | 'untranslated';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'published', label: '게시중' },
  { key: 'draft', label: '임시저장' },
  { key: 'untranslated', label: '미번역' },
];

function localeBadges(group: JournalGroup) {
  return (
    <span className={s.locales}>
      {LOCALES.map((l: Locale) => {
        const filled = group.filledLocales.includes(l);
        return (
          <Badge
            key={l}
            tone={filled ? 'default' : 'warn'}
            title={filled ? `${l.toUpperCase()} 본문 있음` : `${l.toUpperCase()} 본문 없음`}
          >
            {l.toUpperCase()}
            {filled ? '' : ' 없음'}
          </Badge>
        );
      })}
    </span>
  );
}

export default async function AdminJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  // 레이아웃 가드만으로는 이 컴포넌트의 실행을 막지 못한다.
  // App Router에서 자식 세그먼트는 부모의 조건과 무관하게 렌더되고, 그 결과가 같은 응답의
  // RSC 페이로드에 실려 나간다. 그래서 데이터를 읽기 전에 여기서 한 번 더 끊는다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const { filter } = await searchParams;
  const active: Filter = FILTERS.some((f) => f.key === filter) ? (filter as Filter) : 'all';

  const [counts, naver] = await Promise.all([countJournal(), getNaverImportConfig()]);
  const groups = await listJournalGroups({
    status: active === 'published' || active === 'draft' ? active : undefined,
    untranslatedOnly: active === 'untranslated',
  });

  const countOf = (key: Filter) =>
    key === 'all'
      ? counts.total
      : key === 'published'
        ? counts.published
        : key === 'draft'
          ? counts.draft
          : counts.untranslated;

  const columns: Column<JournalGroup>[] = [
    {
      key: 'title',
      header: '제목',
      cell: (g) => (
        <span className={s.titleCell}>
          <Link href={`/admin/journal/${g.slug}`} className={s.titleLink}>
            {g.posts.ko?.title ?? g.posts.ja?.title ?? g.posts.en?.title ?? g.slug}
          </Link>
          {/* 샘플 원고는 어디서 보든 즉시 구분되어야 한다 */}
          {g.isSample ? <Badge tone="warn" title="시안용 샘플 원고입니다">샘플</Badge> : null}
        </span>
      ),
    },
    {
      key: 'source',
      header: '출처',
      width: '10%',
      cell: (g) =>
        g.sources.length === 0 ? (
          <span className={s.dim} title="수집 경로가 기록되지 않았습니다">미지정</span>
        ) : (
          g.sources.map((x) => (x === 'naver-blog' ? '네이버' : '직접 작성')).join(' · ')
        ),
    },
    {
      key: 'category',
      header: '카테고리',
      width: '10%',
      cell: (g) => JOURNAL_CATEGORY_LABEL[g.category] ?? g.category,
    },
    { key: 'locales', header: '번역', width: '22%', cell: localeBadges },
    {
      key: 'plan',
      header: 'CTA 플랜',
      width: '12%',
      cell: (g) =>
        g.planCode ? (
          <code className={s.code}>{g.planCode}</code>
        ) : (
          <span className={s.dim}>미지정</span>
        ),
    },
    {
      key: 'status',
      header: '상태',
      width: '10%',
      cell: (g) =>
        g.status === 'published' ? (
          <Badge tone="dark">게시중</Badge>
        ) : (
          <Badge tone="brass">임시저장</Badge>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="촬영후기"
        description="네이버 블로그에서 가져온 글과 직접 쓴 글을 함께 관리합니다. 가져온 글은 임시저장으로 들어오며 자동으로 게시되지 않습니다."
        actions={
          <>
            <span className={s.syncState}>
              {naver.configured
                ? naver.lastSyncedAt
                  ? `마지막 동기화 ${formatDateTime(naver.lastSyncedAt)}`
                  : '동기화 기록 없음'
                : '네이버 연동 미설정'}
            </span>
            {/*
              importFromNaverBlog() 함수는 server/journal.ts 에 있지만, 그것을 부르는 API 라우트
              액션이 없다(route.ts 는 GET/POST/PATCH publish·unpublish·category·clear-sample만
              받는다). 연동 자격증명이 있어도 이 버튼을 누를 경로가 없으므로 항상 비활성이다.
            */}
            <AdminButton
              disabled
              title={
                naver.configured
                  ? '가져오기 API 라우트가 아직 연결되지 않았습니다.'
                  : naver.reason
              }
            >
              블로그에서 가져오기
            </AdminButton>
            <AdminButton
              variant="primary"
              disabled
              title="새 글 작성 폼이 아직 없습니다. 기존 글의 언어별 본문 저장·게시는 글 상세 화면에서 할 수 있습니다."
            >
              새 글 작성
            </AdminButton>
          </>
        }
      />

      <div className={s.body}>
        {/* 연동 상태를 사실대로 적는다. 설정되지 않았으면 그렇게 말한다. */}
        <div className={naver.configured ? s.noticeInfo : s.noticeWarn}>
          {naver.configured ? (
            <>
              네이버 블로그 <b>{naver.blogId}</b> 의 글을 가져옵니다. 가져온 글은{' '}
              <b>임시저장</b> 상태로 들어오며, 사진 교체 · 문장 정리 · 3개 언어 작성을 거쳐
              게시됩니다.
            </>
          ) : (
            <>
              네이버 블로그 연동이 아직 설정되지 않아 글을 가져올 수 없습니다. {naver.reason} 지금
              목록에 보이는 글은 모두 시안에서 온 샘플 원고이며, 가져온 글이 아닙니다.
            </>
          )}
        </div>

        <Toolbar>
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              href={f.key === 'all' ? '/admin/journal' : `/admin/journal?filter=${f.key}`}
              active={f.key === active}
              count={countOf(f.key)}
            >
              {f.label}
            </FilterChip>
          ))}
        </Toolbar>

        <Panel padded={false}>
          <DataTable
            columns={columns}
            rows={groups}
            getRowKey={(g) => g.slug}
            empty="이 조건에 해당하는 글이 없습니다."
          />
        </Panel>

        {counts.sample > 0 ? (
          <p className={s.sampleNote}>
            현재 {counts.total}건 가운데 {counts.sample}건이 샘플 원고입니다. 실제 촬영 기록으로
            교체하기 전까지 공개 페이지에도 샘플 배지가 함께 나갑니다.
          </p>
        ) : null}

        {/* 카드에 있는 일괄 작업 바. 저장 경로가 없으므로 있는 척하지 않는다. */}
        <NotWired
          what="카테고리 지정 · 게시 · 새 글 작성"
          hint="Prisma 연결 후 열립니다. 지금 이 화면은 읽기 전용입니다."
        />
      </div>
    </>
  );
}
