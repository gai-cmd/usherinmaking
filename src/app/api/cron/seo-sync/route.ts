import { requireCronSecret } from '@/server/auth';
import { errorResponse } from '@/server/errors';
import { pingIndexNow } from '@/server/indexnow';
import { submitSitemap } from '@/server/search-console';
import { SITE_URL } from '@/lib/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 검색엔진 동기화 크론. 하루 한 번(vercel.json) 두 가지를 한다.
 *
 * 1) IndexNow 스윕 — 사이트맵에서 최근 이틀 안에 바뀐 주소를 골라 네이버·Bing 에 알린다.
 *    글 게시·인스타 수집 시점에 이미 즉시 통보를 보내지만, 그 호출은 실패를 삼키므로
 *    놓친 것이 있을 수 있다. 이 스윕이 그 빈틈을 하루 단위로 메운다.
 *    사이트맵의 lastmod 는 작품·저널에만 실린다(정적 페이지는 날짜가 없다). 그래서
 *    "최근 이틀"은 실제로 바뀐 콘텐츠만 고른다 — 2,000개를 매일 다시 보내는 일은 없다.
 *
 * 2) Google Search Console 사이트맵 재제출 — 구글에게 "다시 읽어 가라"고 알리는
 *    유일한 프로그램 경로. 서비스 계정 증명이 없으면 건너뛴다.
 *
 * 정본이 아직 vercel.app 이면 아무것도 하지 않는다 — 미리보기 주소를 색인해 달라고
 * 알리는 셈이 된다.
 */
const RECENT_MS = 2 * 24 * 60 * 60 * 1000;

async function recentlyChangedUrls(): Promise<{ total: number; recent: string[] }> {
  const res = await fetch(`${SITE_URL}/sitemap.xml`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`sitemap ${res.status}`);
  const xml = await res.text();

  const cutoff = Date.now() - RECENT_MS;
  const recent: string[] = [];
  let total = 0;
  // <url> 블록 안의 <loc> 와 <lastmod> 만 본다. 의존성 없이 충분한 정규식이다 —
  // 우리가 만든 사이트맵이라 형태가 고정돼 있다.
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    total++;
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    if (!loc || !lastmod) continue;
    if (new Date(lastmod).getTime() >= cutoff) recent.push(loc);
  }
  return { total, recent };
}

export async function GET(req: Request) {
  try {
    await requireCronSecret(req);
  } catch (err) {
    return errorResponse(err);
  }

  const host = new URL(SITE_URL).host;
  if (host.endsWith('.vercel.app') || host.startsWith('localhost')) {
    return Response.json({ skipped: true, reason: `정본이 ${host} — 도메인 연결 전` });
  }

  let indexnow: { total: number; sent: number } | { error: string };
  try {
    const { total, recent } = await recentlyChangedUrls();
    if (recent.length > 0) await pingIndexNow(recent);
    indexnow = { total, sent: recent.length };
  } catch (e) {
    indexnow = { error: e instanceof Error ? e.message : String(e) };
  }

  // 도메인 속성(sc-domain:)이 기본 — 서브도메인·프로토콜을 모두 포괄한다.
  const property = process.env.GSC_PROPERTY ?? `sc-domain:${host}`;
  const google = await submitSitemap(property, `${SITE_URL}/sitemap.xml`);

  return Response.json({ site: SITE_URL, indexnow, google });
}
