import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminButton, Badge, NotWired, PageHeader, Panel } from '@/components/admin';
import { LOCALES, LOCALE_LABEL, type Locale } from '@/lib/i18n';
import { STUDIO_PLANS, LOCATION_PLANS, ANNIVERSARY_PLANS } from '@/content/site';
import { getJournalGroup, JOURNAL_CATEGORY_LABEL } from '@/server/journal';
import s from './post.module.css';

export const metadata = { title: '촬영후기 편집 · 관리자' };

const ALL_PLANS = [...STUDIO_PLANS, ...LOCATION_PLANS, ...ANNIVERSARY_PLANS];

export default async function AdminJournalPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getJournalGroup(slug);
  if (!group) notFound();

  const plan = group.planCode ? ALL_PLANS.find((p) => p.code === group.planCode) : undefined;

  return (
    <>
      <PageHeader
        title={group.posts.ko?.title ?? group.posts.ja?.title ?? slug}
        description={
          <>
            <code className={s.slug}>{slug}</code> · {JOURNAL_CATEGORY_LABEL[group.category]} ·{' '}
            {group.status === 'published' ? '게시중' : '임시저장'}
          </>
        }
        actions={
          <>
            <Link href="/admin/journal" className={s.back}>
              목록으로
            </Link>
            <AdminButton disabled title="저장 경로가 아직 연결되지 않았습니다">
              저장
            </AdminButton>
            <AdminButton variant="primary" disabled title="저장 경로가 아직 연결되지 않았습니다">
              {group.status === 'published' ? '게시 취소' : '게시'}
            </AdminButton>
          </>
        }
      />

      <div className={s.body}>
        {group.isSample ? (
          <div className={s.sampleBanner}>
            <b>이 글은 샘플 원고입니다.</b> 시안을 채우기 위해 넣은 글이며 실제 고객 촬영 기록이
            아닙니다. 공개 페이지에도 샘플 배지가 함께 나가고 있습니다. 실제 원고로 교체한 뒤
            샘플 표시를 해제해 주세요.
          </div>
        ) : null}

        <Panel title="기본 정보">
          <dl className={s.meta}>
            <div className={s.metaRow}>
              <dt>카테고리</dt>
              <dd>{JOURNAL_CATEGORY_LABEL[group.category]}</dd>
            </div>
            <div className={s.metaRow}>
              <dt>발행일</dt>
              <dd className={s.num}>{group.publishedAtRaw ?? '—'}</dd>
            </div>
            <div className={s.metaRow}>
              <dt>출처</dt>
              <dd>
                {group.sources.length === 0 ? (
                  <span className={s.dim}>미지정 — 수집 경로가 기록되지 않았습니다</span>
                ) : (
                  group.sources.map((x) => (x === 'naver-blog' ? '네이버' : '직접 작성')).join(' · ')
                )}
              </dd>
            </div>
            <div className={s.metaRow}>
              {/* 글 하단 CTA가 이 플랜을 가리킨다 */}
              <dt>하단 CTA 플랜</dt>
              <dd>
                {group.planCode ? (
                  <>
                    <code className={s.slug}>{group.planCode}</code>
                    {plan ? <span className={s.dim}> · {plan.title.ko}</span> : null}
                    {!plan ? (
                      <span className={s.warnInline}> · 존재하지 않는 플랜 코드입니다</span>
                    ) : null}
                  </>
                ) : (
                  <span className={s.dim}>미지정 — 글 하단에 플랜 CTA가 나오지 않습니다</span>
                )}
              </dd>
            </div>
          </dl>
        </Panel>

        {/* 세 언어를 나란히 놓는다. 서로의 번역이 아니라 각각의 본문이다. */}
        <div className={s.langGrid}>
          {LOCALES.map((locale: Locale) => {
            const post = group.posts[locale];
            const empty = !post || !post.title.trim();
            return (
              <Panel
                key={locale}
                title={LOCALE_LABEL[locale]}
                aside={
                  empty ? (
                    <Badge tone="warn">본문 없음</Badge>
                  ) : (
                    <Badge tone="default">
                      {post!.publishedAt ? '게시중' : '임시저장'}
                    </Badge>
                  )
                }
              >
                {empty ? (
                  <p className={s.missing}>
                    이 언어의 본문이 아직 없습니다. 다른 언어를 번역해 채우는 것이 아니라, 이
                    언어의 독자에게 맞는 글을 따로 씁니다.
                  </p>
                ) : (
                  <div className={s.postBody}>
                    <h3 className={s.postTitle} lang={locale}>
                      {post!.title}
                    </h3>
                    <p className={s.postText} lang={locale}>
                      {post!.body}
                    </p>
                    <p className={s.cover}>
                      커버 <code className={s.slug}>{post!.cover}</code>
                    </p>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>

        <NotWired
          what="본문 편집 · 게시"
          hint="Prisma 연결 후 열립니다. 지금 이 화면은 읽기 전용입니다."
        />
      </div>
    </>
  );
}
