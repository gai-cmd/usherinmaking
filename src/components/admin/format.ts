// 관리자 화면 공통 포맷터.
// 스튜디오 운영 기준 시각은 JST다. 서버 타임존이 무엇이든 같은 문자열이 나오도록 고정한다.

const JST = 'Asia/Tokyo';

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: JST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(d)
    .replace(/\.$/, '');
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: JST,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatTime(d: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: JST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** 4032×3024 형태의 치수 표기 */
export function formatDimensions(width: number, height: number): string {
  return `${width}×${height}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('ko-KR');
}
