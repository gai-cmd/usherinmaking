import { FilterChip, PageHeader, Toolbar, AdminButton } from '@/components/admin';
import {
  countPhotos,
  listPhotos,
  listPhotoTaxonomies,
  type PhotoFilter,
  type PhotoStatus,
} from '@/server/photos';
import { PhotoCurator } from './PhotoCurator';
import s from './page.module.css';

// 이 화면의 규칙:
//   수집은 전량, 전시는 관리자가 체크한 것만. UNSORTED / ARCHIVED는 프론트에 절대 나가지 않는다.
//   AI 제안은 제안일 뿐이고, 확정은 사람이 한다. alt 3개 언어가 없으면 전시할 수 없다.
//
// 필터·정렬은 URL 쿼리로 두고 서버에서 거른다. 선택 상태만 클라이언트 섬이 들고 있다.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_TABS: { value: PhotoStatus; label: string }[] = [
  { value: 'UNSORTED', label: '미선별' },
  { value: 'PUBLISHED', label: '전시중' },
  { value: 'ARCHIVED', label: '보관' },
];

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function buildHref(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const merged = { ...base, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
  const q = qs.toString();
  return q ? `/admin/photos?${q}` : '/admin/photos';
}

export default async function PhotosPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const statusParam = one(sp.status);
  const status: PhotoStatus =
    statusParam === 'PUBLISHED' || statusParam === 'ARCHIVED' ? statusParam : 'UNSORTED';
  const flag = one(sp.flag);
  const sort = one(sp.sort) === 'oldest' ? 'oldest' : 'newest';
  const preselect = one(sp.photo);

  const filter: PhotoFilter = {
    status,
    sort,
    untagged: flag === 'untagged' || undefined,
    lowRes: flag === 'lowres' || undefined,
    missingAlt: flag === 'missing-alt' || undefined,
  };

  const [photos, counts, taxonomies] = await Promise.all([
    listPhotos(filter),
    countPhotos(),
    listPhotoTaxonomies(),
  ]);

  const current = { status, flag, sort };

  return (
    <>
      <PageHeader
        title="전시 선별"
        description={`@usherinmaking 게시물을 전량 수집해 원본을 자사 스토리지에 보관합니다 (${counts.total.toLocaleString('ko-KR')}건). 전시할 것만 고릅니다.`}
        actions={
          <>
            <AdminButton disabled title="인스타 수집 크론이 아직 연결되지 않았습니다">
              지금 동기화
            </AdminButton>
            <AdminButton variant="primary" disabled title="업로드 저장 경로가 아직 연결되지 않았습니다">
              ＋ 수동 업로드
            </AdminButton>
          </>
        }
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
          카테고리 미지정만
        </FilterChip>
        <FilterChip
          href={buildHref(current, { flag: flag === 'lowres' ? undefined : 'lowres' })}
          active={flag === 'lowres'}
          count={counts.lowRes}
        >
          저해상도만
        </FilterChip>
        <FilterChip
          href={buildHref(current, { flag: flag === 'missing-alt' ? undefined : 'missing-alt' })}
          active={flag === 'missing-alt'}
          count={counts.missingAlt}
        >
          alt 미완성만
        </FilterChip>

        <span className={s.spacer} />

        <FilterChip
          href={buildHref(current, { sort: sort === 'newest' ? 'oldest' : 'newest' })}
        >
          SORT: {sort === 'newest' ? 'NEWEST' : 'OLDEST'}
        </FilterChip>
      </Toolbar>

      <PhotoCurator photos={photos} taxonomies={taxonomies} initialPhotoId={preselect} />
    </>
  );
}
