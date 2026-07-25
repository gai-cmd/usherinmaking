'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Uploader, type UploadedAsset, type UploaderLimits } from '@/components/admin/Uploader';
import s from './PhotoUpload.module.css';

/**
 * 선별 화면의 수동 업로드.
 *
 * 여기서 올린 파일은 스토리지에 저장되고 미디어 라이브러리(MediaAsset)에 기록된다.
 * AVIF / WebP 파생본도 함께 만든다 — 갤러리로 나갈 원본이기 때문이다.
 *
 * 다만 이것만으로 선별 큐(Photo)에 들어가지는 않는다. Photo 쓰기 경로가 아직 비어 있어서,
 * 올린 자산은 미디어 라이브러리에서 페이지 자리에 걸 수 있고 선별 그리드에는 나타나지 않는다.
 * 그 사실을 아래에 그대로 적어 둔다 — 올렸는데 안 보인다는 오해가 제일 나쁘다.
 */
export function PhotoUpload({ limits }: { limits: UploaderLimits }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<UploadedAsset[]>([]);

  return (
    <div className={s.wrap}>
      <button
        type="button"
        className={s.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-tap
      >
        {open ? '업로드 닫기' : '＋ 수동 업로드'}
      </button>

      {open ? (
        <div className={s.body}>
          <Uploader
            limits={limits}
            withRenditions
            onUploaded={(a) => {
              setDone((prev) => [a, ...prev]);
              router.refresh();
            }}
            label="갤러리에 넣을 원본을 올립니다"
            hint="원본 보관 + AVIF / WebP 3단계 생성"
          />

          <p className={s.note}>
            업로드된 파일은 <strong>미디어 라이브러리</strong>에 저장됩니다. 페이지의 정해진 자리에
            거는 것은 미디어 화면에서 할 수 있습니다. 아래 선별 그리드(Photo)에 자동으로 들어가지는
            않습니다 — 선별 큐 저장 경로가 아직 연결되지 않았습니다.
          </p>

          {done.length > 0 ? (
            <p className={s.done}>
              이번에 {done.length}장 업로드했습니다. 미디어 화면에서 확인할 수 있습니다.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
