import Link from 'next/link';
import {
  AdminButton,
  Badge,
  DataTable,
  NotWired,
  PageHeader,
  Panel,
  type Column,
} from '@/components/admin';
import { LOCALES, LOCALE_LABEL, type Locale } from '@/lib/i18n';
import {
  countDress,
  getDressPhotoState,
  listDressCollections,
  listDressItems,
  DRESS_TIER_LABEL,
  type DressItem,
} from '@/server/dress';
import s from './dress.module.css';

export const metadata = { title: '드레스 관리 · 관리자' };

/** 금액은 항상 --ff-num(SF). 추가요금 없음은 0 이 아니라 "없음"이다. */
function surcharge(item: DressItem) {
  if (item.surcharge === null) return <span className={s.dim}>없음</span>;
  return <span className={s.num}>+¥{item.surcharge.toLocaleString('ja-JP')}</span>;
}

export default async function AdminDressPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  const [items, collections, photoState, counts] = await Promise.all([
    listDressItems(),
    listDressCollections(),
    getDressPhotoState(),
    countDress(),
  ]);

  const selected = items.find((d) => d.id === id) ?? items[0];
  const collectionTitle = (slug: string) =>
    collections.find((c) => c.slug === slug)?.title.ko ?? slug;

  const columns: Column<DressItem>[] = [
    {
      key: 'img',
      header: 'IMG',
      width: '64px',
      cell: (d) =>
        d.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.photo} alt="" className={s.thumb} width={34} height={44} />
        ) : (
          // 없는 경로를 지어내지 않는다. 사진이 없으면 없는 자리를 보여 준다.
          <span className={s.thumbEmpty} title="사진 미납품" aria-label="사진 없음" />
        ),
    },
    {
      key: 'name',
      header: '이름',
      cell: (d) => (
        <Link href={`/admin/dress?id=${d.id}`} className={s.nameLink}>
          {d.name.ko ?? d.name.ja ?? d.id}
        </Link>
      ),
    },
    {
      key: 'collection',
      header: '컬렉션',
      width: '14%',
      cell: (d) => <span className={s.dim}>{collectionTitle(d.collection)}</span>,
    },
    {
      key: 'tier',
      header: '구분',
      width: '10%',
      cell: (d) => <span className={s.dim}>{DRESS_TIER_LABEL[d.tier]}</span>,
    },
    { key: 'surcharge', header: '추가요금', width: '14%', cell: surcharge },
    {
      key: 'status',
      header: '상태',
      width: '10%',
      cell: (d) =>
        d.published ? <Badge tone="default">공개</Badge> : <Badge tone="brass">비공개</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="드레스 컬렉션"
        description="컬렉션 단위로 관리합니다. 드레스 페이지에는 브랜드명을 쓰지 않으므로 브랜드 항목은 없습니다."
        actions={
          <>
            <AdminButton disabled title="저장 경로가 아직 연결되지 않았습니다">
              순서 변경
            </AdminButton>
            <AdminButton variant="primary" disabled title="저장 경로가 아직 연결되지 않았습니다">
              드레스 추가
            </AdminButton>
          </>
        }
      />

      <div className={s.body}>
        {!photoState.anyPhotoSupplied ? (
          <div className={s.noticeWarn}>
            개별 드레스 사진이 아직 납품되지 않았습니다 ({photoState.missingPhotoCount}벌 전부).
            사진이 들어오기 전까지 목록과 상세는 빈 자리로 표시됩니다.
            {!photoState.inventoryConfirmed
              ? ' 아래 목록은 시안에 실린 예시이며 확정된 대여 재고가 아닙니다.'
              : ''}
          </div>
        ) : null}

        <div className={s.split}>
          <Panel padded={false}>
            <DataTable
              columns={columns}
              rows={items}
              getRowKey={(d) => d.id}
              empty="등록된 드레스가 없습니다."
            />
          </Panel>

          {selected ? (
            <Panel
              title={selected.name.ko ?? selected.id}
              aside={
                selected.published ? (
                  <Badge tone="default">공개</Badge>
                ) : (
                  <Badge tone="brass">비공개</Badge>
                )
              }
            >
              <div className={s.detail}>
                <div>
                  <div className={s.fieldLabel}>사진</div>
                  {selected.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.photo} alt="" className={s.detailPhoto} />
                  ) : (
                    <div className={s.detailPhotoEmpty}>사진 미납품</div>
                  )}
                </div>

                <div>
                  <div className={s.fieldLabel}>설명 (JA / EN / KO)</div>
                  <div className={s.descBox}>
                    {LOCALES.map((l: Locale) => {
                      const text = selected.description[l];
                      return (
                        <div key={l} className={s.descRow}>
                          <span className={s.descLang}>{LOCALE_LABEL[l]}</span>
                          {text && text.trim() ? (
                            <span lang={l}>{text}</span>
                          ) : (
                            <span className={s.missing}>미작성</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={s.pair}>
                  <div>
                    <div className={s.fieldLabel}>사이즈</div>
                    <div className={s.fieldValue}>
                      {selected.sizes.length > 0 ? (
                        <span className={s.num}>{selected.sizes.join(' · ')}</span>
                      ) : (
                        <span className={s.dim}>미지정</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className={s.fieldLabel}>추가요금</div>
                    <div className={s.fieldValue}>{surcharge(selected)}</div>
                  </div>
                </div>

                <div className={s.actions}>
                  <AdminButton disabled title="저장 경로가 아직 연결되지 않았습니다">
                    {selected.published ? '비공개로' : '공개로'}
                  </AdminButton>
                  <AdminButton
                    variant="primary"
                    disabled
                    title="저장 경로가 아직 연결되지 않았습니다"
                  >
                    저장
                  </AdminButton>
                </div>
              </div>
            </Panel>
          ) : null}
        </div>

        <Panel title="컬렉션">
          <p className={s.collectionNote}>
            드레스 페이지의 필터 축입니다. 대여 요금대는 ¥10,000대부터 ¥50,000대까지이며,
            턱시도는 취급하지 않습니다.
          </p>
          <ul className={s.collections}>
            {collections.map((c) => (
              <li key={c.slug} className={s.collection}>
                <span className={s.collectionName}>{c.title.ko}</span>
                <span className={s.dim}>{c.note.ko}</span>
                {c.image ? (
                  <Badge tone="default">대표사진 있음</Badge>
                ) : (
                  <Badge tone="warn">대표사진 없음</Badge>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <p className={s.summary}>
          공개 {counts.published} · 비공개 {counts.hidden} · 사진 없음 {counts.withoutPhoto}
        </p>
        <NotWired
          what="드레스 추가 · 순서 변경 · 저장"
          hint={
            <>
              prisma/schema.prisma 에 Dress 모델이 아직 없어{' '}
              <code className={s.code}>@/content/dress</code> 를 읽고 있습니다. 모델 추가 후
              열립니다.
            </>
          }
        />
      </div>
    </>
  );
}
