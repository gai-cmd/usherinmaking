import { notFound } from 'next/navigation';
import { FilterChip, PageHeader, Toolbar } from '@/components/admin';
import { checkAdminPageAccess } from '@/server/auth';
import {
  countPhotos,
  listPhotos,
  listPhotoTaxonomies,
  type PhotoFilter,
  type PhotoStatus,
} from '@/server/photos';
import { PhotoCurator } from '../photos/PhotoCurator';
import { SyncButton } from './SyncButton';
import s from '../photos/page.module.css';

// 드레스는 이제 @usherindress 수집분이 원본이다.
//
// 예전 화면은 코드 상수(@/content/dress)의 드레스 3벌을 표로 보여줬는데, 사진이 인스타로
// 대체되면서 그 표는 실물과 무관한 목록이 됐다. 그래서 전시 선별과 같은 선별 화면으로 바꾸고
// 계정만 dress 로 좁힌다 — 같은 컴포넌트를 쓰므로 조작 방법도 한 가지로 유지된다.
//
// 분류 축은 dressCollection 하나만 내려보낸다. 장소·촬영·무드는 작품 갤러리의 축이라
// 드레스 룩북에 섞이면 필터가 의미를 잃는다.

export const metadata = { title: '드레스 컬렉션 · 관리자' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_TABS: { value: PhotoStatus; label: string }[] = [
  { value: 'UNSORTED', label: '미선별' },
  { value: 'PUBLISHED', label: '전시중' },
  { value: 'ARCHIVED', label: '보관' },
];

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function buildHref(
  base: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
) {
  const merged = { ...base, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
  const q = qs.toString();
  return q ? `/admin/dress?${q}` : '/admin/dress';
}

export default async function AdminDressPage({ searchParams }: { searchParams: SearchParams }) {
  // 레이아웃의 잠금 화면은 표시만 막고 자식 실행은 막지 못한다 — 데이터를 읽기 전에 끊는다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const sp = await searchParams;
  const statusParam = one(sp.status);
  const status: PhotoStatus =
    statusParam === 'UNSORTED' || statusParam === 'ARCHIVED' ? statusParam : 'PUBLISHED';
  const flag = one(sp.flag);
  const sort = one(sp.sort) === 'oldest' ? 'oldest' : 'newest';
  const preselect = one(sp.photo);

  const filter: PhotoFilter = {
    account: 'dress',
    status,
    sort,
    untagged: flag === 'untagged' || undefined,
    lowRes: flag === 'lowres' || undefined,
    missingAlt: flag === 'missing-alt' || undefined,
  };

  const [photos, counts, taxonomies] = await Promise.all([
    listPhotos(filter),
    countPhotos('dress'),
    listPhotoTaxonomies('dressCollection'),
  ]);

  const current = { status, flag, sort };

  return (
    <>
      <PageHeader
        title="드레스 컬렉션"
        description={`@usherindress 수집분입니다 (${counts.total.toLocaleString('ko-KR')}건). 매일 자동으로 새 게시물을 받고, 캡션이 있는 것은 바로 전시됩니다.`}
        actions={<SyncButton />}
      />

      <Toolbar>
        {STATUS_TABS.map((t) => (
          <FilterChip
            key={t.value}
            href={buildHref(current, { status: t.value, photo: undefined })}
            active={status === t.value}
            count={
              t.value === 'UNSORTED'
                ? counts.unsorted
                : t.value === 'PUBLISHED'
                  ? counts.published
                  : counts.archived
            }
          >
            {t.label}
          </FilterChip>
        ))}

        <span className={s.divider} aria-hidden="true" />

        <FilterChip
          href={buildHref(current, { flag: flag === 'untagged' ? undefined : 'untagged' })}
          active={flag === 'untagged'}
          count={counts.untagged}
        >
          컬렉션 미지정만
        </FilterChip>
        <FilterChip
          href={buildHref(current, { flag: flag === 'missing-alt' ? undefined : 'missing-alt' })}
          active={flag === 'missing-alt'}
          count={counts.missingAlt}
        >
          alt 미완성만
        </FilterChip>
        <FilterChip
          href={buildHref(current, { flag: flag === 'lowres' ? undefined : 'lowres' })}
          active={flag === 'lowres'}
          count={counts.lowRes}
        >
          저해상도만
        </FilterChip>

        <span className={s.spacer} />

        <FilterChip href={buildHref(current, { sort: sort === 'newest' ? 'oldest' : 'newest' })}>
          SORT: {sort === 'newest' ? 'NEWEST' : 'OLDEST'}
        </FilterChip>
      </Toolbar>

      <PhotoCurator photos={photos} taxonomies={taxonomies} initialPhotoId={preselect} />
    </>
  );
}
