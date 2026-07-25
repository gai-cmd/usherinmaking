'use client';

import { useCallback, useId, useRef, useState } from 'react';
import s from './Uploader.module.css';

/**
 * 이미지 업로드 섬.
 *
 * 파일을 /api/admin/media 로 실제로 보낸다. 여러 장이면 한 장씩 순서대로 올린다 —
 * 동시에 던지면 서버리스 메모리 한도에 걸리고, 어느 파일이 실패했는지도 흐려진다.
 *
 * 허용 규격(accept · maxBytes)은 서버가 소유한다(src/lib/image-pipeline.ts).
 * 여기서 기본값을 두지 않고 props로 받는 이유: 클라이언트 번들은 sharp를 import할 수 없어
 * 상수를 복사해 오면 서버 규칙과 조용히 어긋나기 때문이다. 서버 컴포넌트가 내려 준다.
 *
 * 클라이언트 검증은 편의일 뿐이고 최종 판정은 서버가 한다.
 * 실패하면 서버 메시지를 그대로 보여 준다 — 성공을 흉내내지 않는다.
 */

export type UploadedAsset = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
  lowRes: boolean;
  source: string;
  createdAt: string;
};

export type UploaderLimits = {
  /** 허용 mime 목록. <input accept> 와 1차 검증에 함께 쓴다. */
  accept: readonly string[];
  maxBytes: number;
};

type Props = {
  limits: UploaderLimits;
  /** 업로드가 끝날 때마다 호출. 목록 갱신에 쓴다. */
  onUploaded?: (asset: UploadedAsset) => void;
  /** AVIF / WebP 파생본까지 만들지. 갤러리용 원본에만 켠다. */
  withRenditions?: boolean;
  label?: string;
  hint?: string;
};

type Row = {
  name: string;
  state: 'pending' | 'uploading' | 'done' | 'failed';
  message?: string;
};

export function Uploader({ limits, onUploaded, withRenditions = false, label, hint }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const maxMb = Math.floor(limits.maxBytes / (1024 * 1024));

  const patch = useCallback((index: number, next: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));
  }, []);

  const send = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || busy) return;

      setRows(files.map((f) => ({ name: f.name, state: 'pending' as const })));
      setBusy(true);

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];

        // 서버와 같은 규칙으로 먼저 걸러 준다. 네트워크를 태우기 전에 알려 주는 편이 빠르다.
        if (!limits.accept.includes(file.type)) {
          patch(i, { state: 'failed', message: '이미지 파일이 아닙니다.' });
          continue;
        }
        if (file.size > limits.maxBytes) {
          patch(i, { state: 'failed', message: `${maxMb}MB를 넘습니다.` });
          continue;
        }

        patch(i, { state: 'uploading' });

        const form = new FormData();
        form.append('file', file);
        if (withRenditions) form.append('renditions', 'true');

        try {
          const res = await fetch('/api/admin/media', { method: 'POST', body: form });
          const data = (await res.json().catch(() => null)) as
            | { asset?: UploadedAsset; error?: { message?: string } }
            | null;

          if (!res.ok || !data?.asset) {
            patch(i, {
              state: 'failed',
              message: data?.error?.message ?? `업로드에 실패했습니다 (HTTP ${res.status}).`,
            });
            continue;
          }

          patch(i, { state: 'done', message: `${data.asset.width}×${data.asset.height}` });
          onUploaded?.(data.asset);
        } catch {
          patch(i, { state: 'failed', message: '서버에 연결하지 못했습니다.' });
        }
      }

      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    },
    [busy, limits, maxMb, onUploaded, patch, withRenditions],
  );

  return (
    <div className={s.wrap}>
      <label
        htmlFor={inputId}
        className={`${s.drop} ${dragging ? s.dropActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void send(Array.from(e.dataTransfer.files));
        }}
        data-tap
      >
        <span className={s.dropTitle}>{label ?? '이미지를 끌어다 놓거나 눌러서 선택'}</span>
        <span className={s.dropHint}>
          {hint ?? `JPEG · PNG · WebP · AVIF · GIF / 최대 ${maxMb}MB · 여러 장 한 번에 가능`}
        </span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          className={s.input}
          accept={limits.accept.join(',')}
          multiple
          disabled={busy}
          onChange={(e) => void send(Array.from(e.target.files ?? []))}
        />
      </label>

      {rows.length > 0 ? (
        <ul className={s.rows}>
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className={s.row} data-state={r.state}>
              <span className={s.rowName}>{r.name}</span>
              <span className={s.rowState}>
                {r.state === 'pending' ? '대기' : null}
                {r.state === 'uploading' ? '업로드 중…' : null}
                {r.state === 'done' ? `완료 ${r.message ?? ''}` : null}
                {r.state === 'failed' ? r.message : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
