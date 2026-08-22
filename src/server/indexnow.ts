import { SITE_URL } from '@/lib/i18n';

/**
 * IndexNow — 새 글·바뀐 글을 검색엔진에 즉시 알린다.
 *
 * 사이트맵만으로는 "언젠가 다시 와서 보라"는 신호밖에 못 준다. 네이버는 2023년부터
 * 이 프로토콜을 받고(Bing 등 참여 엔진에도 함께 전달된다), 그쪽은 크롤러를 기다리지
 * 않고 알림 시점에 확인하러 온다. 구글은 이 프로토콜에 참여하지 않으므로 구글 쪽
 * 발견 경로는 여전히 robots.txt 의 Sitemap 줄과 Search Console 이다
 * (구글의 사이트맵 ping 엔드포인트는 2023년에 폐지되어 대체 수단이 없다).
 *
 * 이 파일의 모든 실패는 삼킨다. 색인 통보는 부가 작업이고, 여기서 던지면 정작
 * 중요한 글 저장이 실패한 것처럼 보인다.
 */

/** public/<key>.txt 와 같은 값이어야 한다. 다르면 엔진이 소유 확인에 실패한다. */
const INDEXNOW_KEY = '0b032e51ee11d13067df9fd78361ddc0';

/** 참여 엔진 공용 접수처. 여기로 보내면 네이버를 포함한 참여 엔진에 함께 전달된다. */
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** 한 번에 보낼 수 있는 상한은 10,000 이지만, 요청 크기를 감당 가능한 선에서 자른다. */
const MAX_URLS = 1000;

/**
 * 알린다. 인자는 경로(/ko/journal/xxx)든 절대 주소든 받는다.
 *
 * 정본이 아직 vercel.app 이면(도메인 연결 전) 보내지 않는다 — 미리보기 주소를
 * 색인해 달라고 알리는 셈이 되고, 그 주소는 나중에 정본으로 넘어갈 임시 주소다.
 */
export async function pingIndexNow(targets: string[]): Promise<void> {
  try {
    const host = new URL(SITE_URL).host;
    if (host.endsWith('.vercel.app') || host.startsWith('localhost')) return;

    const urlList = Array.from(
      new Set(targets.map((t) => (t.startsWith('http') ? t : `${SITE_URL}${t}`))),
    ).slice(0, MAX_URLS);
    if (urlList.length === 0) return;

    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      // 저장 응답을 여기서 붙잡아 두지 않는다.
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // 통보 실패는 다음 크롤에서 사이트맵으로 흡수된다. 조용히 넘어간다.
  }
}
