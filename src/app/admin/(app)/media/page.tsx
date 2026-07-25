import { notFound } from 'next/navigation';

import { NotWired, PageHeader, Panel, StatTile, formatCount, formatTime } from '@/components/admin';
import { listActivity } from '@/server/activity';
import { checkAdminPageAccess } from '@/server/auth';
import { isDatabaseConfigured } from '@/server/db';
import { countMedia, listMedia } from '@/server/media';
import { listPageImageBindings } from '@/server/page-images';
import {
  ALLOWED_UPLOAD_MIME,
  LOW_RES_MIN_LONG_EDGE,
  MAX_UPLOAD_BYTES,
  isBlobConfigured,
} from '@/lib/image-pipeline';
import { MediaManager, type AssetView, type SlotView } from './MediaManager';
import s from './page.module.css';

// 미디어 라이브러리.
//
// 여기서 올린 이미지가 곧 사이트에 나가는 이미지다 — 재배포나 코드 수정 없이.
// 그래서 이 화면은 두 가지만 한다: 자산을 관리하고, 그 자산을 페이지의 자리에 건다.
//
// 업로드 규격(허용 mime · 크기 상한)은 서버(image-pipeline)가 소유하고 여기서 섬으로 내려 준다.
// 클라이언트 번들은 sharp를 import할 수 없어, 상수를 복사하면 서버 규칙과 조용히 어긋난다.

export default async function MediaPage() {
  // [보안] 레이아웃 잠금은 표시만 막는다. 데이터를 읽기 전에 페이지에서 직접 차단한다.
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const dbReady = isDatabaseConfigured();
  const storageReady = isBlobConfigured();

  const [assets, counts, slots, activity] = await Promise.all([
    listMedia({ limit: 200 }),
    countMedia(),
    listPageImageBindings(),
    listActivity(8),
  ]);

  const assetViews: AssetView[] = assets.map((a) => ({
    id: a.id,
    url: a.url,
    width: a.width,
    height: a.height,
    size: a.size,
    lowRes: a.lowRes,
    source: a.source,
    createdAt: a.createdAt.toISOString(),
  }));

  const slotViews: SlotView[] = slots.map((b) => ({
    page: b.page,
    slot: b.slot,
    label: b.label,
    group: b.group,
    hint: b.hint ?? null,
    bound: b.bound,
    currentUrl: b.current?.url ?? null,
    currentAlt: b.current?.alt ?? null,
    fallbackUrl: b.fallback?.url ?? null,
    updatedAt: b.updatedAt?.toISOString() ?? null,
  }));

  const boundCount = slotViews.filter((v) => v.bound).length;
  // 용량은 MB 단위 정수로 반올림한다. StatTile이 숫자만 받고 단위는 hint로 붙인다.
  const megabytes = Math.round(counts.bytes / (1024 * 1024));

  return (
    <>
      <PageHeader
        title="미디어"
        description="여기서 올린 사진이 그대로 사이트에 나갑니다. 배포를 다시 하지 않아도 됩니다. 원본은 자사 스토리지에 보관하고 인스타 임베드나 외부 링크는 쓰지 않습니다."
      />

      <div className={s.stats}>
        <StatTile
          label="업로드된 원본"
          value={dbReady ? counts.total : null}
          notWiredReason="DB가 연결되지 않아 셀 수 없습니다."
        />
        <StatTile label="용량" value={dbReady ? megabytes : null} hint="MB" notWiredReason="DB 미연결" />
        <StatTile
          label="저해상도"
          value={dbReady ? counts.lowRes : null}
          hint={`장변 ${formatCount(LOW_RES_MIN_LONG_EDGE)}px 미만`}
          notWiredReason="DB 미연결"
        />
        <StatTile
          label="교체된 자리"
          value={boundCount}
          hint={`전체 ${slotViews.length}자리`}
          hintTone={boundCount > 0 ? 'accent' : 'muted'}
        />
      </div>

      <div className={s.main}>
        {!dbReady ? (
          <NotWired
            what="DB가 연결되지 않아 업로드 목록을 읽을 수 없습니다."
            hint="DATABASE_URL 설정 후 표시됩니다"
            tone="warn"
          />
        ) : null}
        {!storageReady ? (
          <NotWired
            what="스토리지가 연결되지 않아 업로드할 수 없습니다."
            hint="BLOB_READ_WRITE_TOKEN 설정 후 사용할 수 있습니다"
            tone="warn"
          />
        ) : null}

        <MediaManager
          limits={{ accept: ALLOWED_UPLOAD_MIME, maxBytes: MAX_UPLOAD_BYTES }}
          assets={assetViews}
          slots={slotViews}
          dbReady={dbReady}
          storageReady={storageReady}
        />

        <p className={s.note}>
          장변 {formatCount(LOW_RES_MIN_LONG_EDGE)}px 미만은 저해상도로 표시됩니다. 인쇄나 큰 화면에서
          거칠어지니 가능하면 원본을 다시 올려 주세요. 자리에 걸지 않은 이미지는 사이트에 나가지 않습니다.
        </p>

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
            hint="위 목록은 시드 데이터이며 ActivityLog 쓰기 경로가 아직 비어 있습니다"
          />
        </Panel>
      </div>
    </>
  );
}
