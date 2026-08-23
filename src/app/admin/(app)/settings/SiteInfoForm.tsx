'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminButton } from '@/components/admin';
import s from './settings.module.css';

/**
 * 사업장 정보 편집 폼 — 주소(일본어·로마자), 공항 소요시간, 지도 좌표.
 *
 * 저장 함수(updateSiteSettings)는 처음부터 이 값들을 받았는데 화면에 입력칸이 없어
 * 읽기 전용으로만 보였다. 이 폼이 그 빈칸을 채운다.
 *
 * 좌표는 LocalBusiness 구조화 데이터의 geo 로 그대로 나간다 — 지역 검색·지도 연동 신호다.
 * 값이 없으면 geo 자체를 내보내지 않으므로 "대략 이쯤" 같은 추정값은 넣지 않는다.
 * 빈 칸으로 저장하면 그 항목은 환경변수·코드 기본값으로 돌아간다(null = 지움).
 */
export function SiteInfoForm({
  initial,
}: {
  initial: {
    addressJa: string | null;
    addressLatin: string | null;
    fromAirport: string | null;
    lat: number | null;
    lng: number | null;
  };
}) {
  const router = useRouter();
  const [addressJa, setAddressJa] = useState(initial.addressJa ?? '');
  const [addressLatin, setAddressLatin] = useState(initial.addressLatin ?? '');
  const [fromAirport, setFromAirport] = useState(initial.fromAirport ?? '');
  const [lat, setLat] = useState(initial.lat === null ? '' : String(initial.lat));
  const [lng, setLng] = useState(initial.lng === null ? '' : String(initial.lng));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 좌표는 둘 다 있거나 둘 다 없어야 한다. 한쪽만 있으면 지도에서 엉뚱한 곳을 찍는다.
  const latNum = lat.trim() === '' ? null : Number(lat);
  const lngNum = lng.trim() === '' ? null : Number(lng);
  const geoHalf = (latNum === null) !== (lngNum === null);
  const geoBad =
    (latNum !== null && (!Number.isFinite(latNum) || latNum < -90 || latNum > 90)) ||
    (lngNum !== null && (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180));

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'site',
          data: {
            addressJa: addressJa.trim() || null,
            addressLatin: addressLatin.trim() || null,
            fromAirport: fromAirport.trim() || null,
            lat: latNum,
            lng: lngNum,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? body?.message ?? `저장 실패 (HTTP ${res.status})`);
      }
      setMessage('저장했습니다. 공개 페이지에는 다음 빌드/재검증 때 반영됩니다.');
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.channels}>
      <ul className={s.channelList}>
        <li className={s.channelItem}>
          <span className={s.channelFormLabel}>주소 · 일본어</span>
          <span className={s.channelInputs}>
            <input
              className={s.input}
              placeholder="〒901-2302 沖縄県中頭郡北中城村渡口1868"
              value={addressJa}
              onChange={(e) => setAddressJa(e.target.value)}
            />
          </span>
        </li>
        <li className={s.channelItem}>
          <span className={s.channelFormLabel}>주소 · 로마자</span>
          <span className={s.channelInputs}>
            <input
              className={s.input}
              placeholder="1868 Toguchi, Kitanakagusuku, Nakagami District, Okinawa 901-2302"
              value={addressLatin}
              onChange={(e) => setAddressLatin(e.target.value)}
            />
          </span>
        </li>
        <li className={s.channelItem}>
          <span className={s.channelFormLabel}>공항에서</span>
          <span className={s.channelInputs}>
            <input
              className={s.input}
              placeholder="예: 나하공항에서 차로 약 40분"
              value={fromAirport}
              onChange={(e) => setFromAirport(e.target.value)}
            />
          </span>
        </li>
        <li className={s.channelItem}>
          <span className={s.channelFormLabel}>지도 좌표</span>
          <span className={s.channelInputs}>
            <input
              className={s.input}
              placeholder="위도 (예: 26.3043)"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
            <input
              className={s.input}
              placeholder="경도 (예: 127.8167)"
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </span>
        </li>
      </ul>

      <p className={s.dim}>
        좌표는 구글 지도에서 사업장을 우클릭하면 맨 위에 나오는 두 숫자입니다. 넣어 두면 검색
        결과의 사업장 정보(구조화 데이터)에 위치가 함께 실립니다. 비워 두면 위치는 내보내지
        않습니다.
      </p>
      {geoHalf && <p className={s.formMessage}>위도와 경도는 둘 다 넣거나 둘 다 비워야 합니다.</p>}
      {geoBad && <p className={s.formMessage}>좌표 범위가 올바르지 않습니다 (위도 -90~90, 경도 -180~180).</p>}

      <div className={s.formFoot}>
        <AdminButton variant="primary" onClick={save} disabled={busy || geoHalf || geoBad}>
          {busy ? '저장 중…' : '사업장 정보 저장'}
        </AdminButton>
        {message && <span className={s.formMessage}>{message}</span>}
      </div>
    </div>
  );
}
