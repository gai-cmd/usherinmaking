import {
  Badge,
  FilterChip,
  NotWired,
  PageHeader,
  Panel,
  Toolbar,
  formatCount,
  formatDimensions,
  formatTime,
} from '@/components/admin';
import { notFound } from 'next/navigation';
import { listActivity } from '@/server/activity';
import { checkAdminPageAccess } from '@/server/auth';
import { countPhotos, getStorageUsage, listPhotos, missingAltLocales } from '@/server/photos';
import { LOW_RES_MIN_LONG_EDGE, RENDITION_FORMATS, RENDITION_WIDTHS } from '@/lib/image-pipeline';
import s from './page.module.css';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// 미디어 라이브러리는 상태(미선별/전시/보관)와 무관하게 원본 자산 전체를 본다.
// 여기서 걸러야 할 것은 "서빙 품질" — 저해상도와 alt 누락이다.
export default async function MediaPage({ searchParams }: { searchParams: SearchParams }) {
  // [보안] 레이아웃 잠금은 표시만 막는다. 데이터를 읽기 전에 페이지에서 직접 차단한다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const flag = one((await searchParams).flag);

  const [photos, counts, storage, activity] = await Promise.all([
    listPhotos({
      lowRes: flag === 'lowres' || undefined,
      missingAlt: flag === 'missing-alt' || undefined,
    }),
    countPhotos(),
    getStorageUsage(),
    listActivity(8),
  ]);

  const sizes = RENDITION_WIDTHS.join(' / ');
  const formats = RENDITION_FORMATS.map((f) => f.toUpperCase()).join(' · ');

  return (
    <>
      <PageHeader
        title="미디어 · 로그"
        description="원본은 자사 스토리지에 보관하고 프론트에는 다중 사이즈로 서빙합니다. 인스타 외부 링크와 임베드는 쓰지 않습니다."
      />

      <Toolbar>
        <FilterChip href="/admin/media" active={!flag}>
          전체 {formatCount(counts.total)}
        </FilterChip>
        <FilterChip href="/admin/media?flag=lowres" active={flag === 'lowres'} count={counts.lowRes}>
          저해상도만
        </FilterChip>
        <FilterChip
          href="/admin/media?flag=missing-alt"
          active={flag === 'missing-alt'}
          count={counts.missingAlt}
        >
          alt 미설정만
        </FilterChip>
      </Toolbar>

      <div className={s.body}>
        <Panel
          title="미디어 라이브러리"
          aside={<>원본 {formatCount(storage.originals)}장</>}
        >
          {storage.bytes === null ? (
            <NotWired
              what="스토리지 사용량은 아직 집계되지 않습니다."
              hint="오브젝트 스토리지 연결 후 표시됩니다"
            />
          ) : null}

          {photos.length === 0 ? (
            <p className={s.empty}>조건에 맞는 자산이 없습니다.</p>
          ) : (
            <ul className={s.grid}>
              {photos.map((p) => {
                const altMissing = missingAltLocales(p.alt).length > 0;
                return (
                  <li key={p.id} className={s.cell}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.originalUrl} alt="" loading="lazy" decoding="async" className={s.img} />
                    <span className={s.flags}>
                      {p.lowRes ? <Badge tone="warn">저해상도</Badge> : null}
                      {altMissing ? <Badge tone="dark">alt 없음</Badge> : null}
                    </span>
                    <span className={s.dim}>{formatDimensions(p.width, p.height)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <p className={s.note}>
            원본은 자사 스토리지에 보관하고, 프론트에는 {formats} 다중 사이즈({sizes})로 서빙합니다. 장변{' '}
            {formatCount(LOW_RES_MIN_LONG_EDGE)}px 미만은 저해상도로 표시되니 원본을 다시 올려 주세요.
          </p>
          <NotWired
            what="파생본(AVIF / WebP) 생성은 아직 실행되지 않습니다."
            hint="규격만 확정되어 있고 인코딩 단계가 비어 있습니다"
          />
        </Panel>

        <Panel title="활동 로그">
          <ul className={s.log}>
            {activity.map((a) => (
              <li key={a.id} className={s.logItem}>
                <span className={s.logTime}>{formatTime(a.createdAt)}</span>
                <span className={s.logAction}>{a.action}</span>
              </li>
            ))}
          </ul>
          <NotWired
            what="새 활동은 아직 기록되지 않습니다."
            hint="위 목록은 시드 데이터입니다"
          />
        </Panel>
      </div>
    </>
  );
}
