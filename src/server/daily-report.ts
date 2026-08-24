import { SITE_URL } from '@/lib/i18n';
import { googleAccessToken, readServiceAccount } from '@/server/google-token';
import { sendKakaoToAll } from '@/server/kakao-report';

/**
 * 데일리 인사이트 보고서 — 구글 검색 유입(Search Console) + 사이트 트래픽(GA4).
 *
 * 매일 아침 이메일로 나가는 보고서의 데이터 수집과 본문 조립을 맡는다.
 * 필요한 것:
 *  - GSC_SERVICE_ACCOUNT_JSON — 서비스 계정 (GSC 사용자 + GA4 뷰어로 등록)
 *  - GA4_PROPERTY_ID          — GA4 속성 숫자 ID (미설정이면 GA4 섹션은 "미설정" 안내로 대체)
 *
 * 두 원천은 서로 독립적으로 실패한다 — 한쪽 자격 증명이 없거나 API 가 죽어도
 * 다른 쪽 데이터는 그대로 싣고, 실패한 섹션은 그 사실을 본문에 적는다.
 * 빈 보고서를 보내는 것보다 "왜 비었는지"가 적힌 보고서가 낫다.
 *
 * 주의: Search Console 데이터는 이틀쯤 늦게 확정된다. 그래서 GSC 는 "이틀 전" 하루를,
 * GA4 는 "어제" 하루를 본다 — 스크린샷의 조엘라이프 보고서와 같은 관례다.
 */

/* ---------------------------------------------------------------- 날짜 */

const KST_MS = 9 * 60 * 60 * 1000;

function kstDate(daysAgo: number): string {
  const d = new Date(Date.now() + KST_MS);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- GSC */

export type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

type GscSection = {
  date: string;
  totals: { clicks: number; impressions: number; ctr: number; position: number } | null;
  prevTotals: { clicks: number; impressions: number } | null;
  last10d: { clicks: number; impressions: number } | null;
  topQueries: GscRow[];
  topPages: GscRow[];
  error?: string;
};

async function gscQuery(body: object): Promise<GscRow[]> {
  const token = await googleAccessToken('https://www.googleapis.com/auth/webmasters.readonly');
  const property = encodeURIComponent(`sc-domain:${new URL(SITE_URL).host}`);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${property}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`GSC ${res.status} ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { rows?: GscRow[] };
  return json.rows ?? [];
}

async function fetchGsc(): Promise<GscSection> {
  const date = kstDate(2); // GSC 확정 지연을 감안해 이틀 전 하루
  const prevDate = kstDate(3);
  try {
    const [day, prev, tenDays, queries, pages] = await Promise.all([
      gscQuery({ startDate: date, endDate: date }),
      gscQuery({ startDate: prevDate, endDate: prevDate }),
      gscQuery({ startDate: kstDate(11), endDate: date }),
      gscQuery({ startDate: date, endDate: date, dimensions: ['query'], rowLimit: 5 }),
      gscQuery({ startDate: date, endDate: date, dimensions: ['page'], rowLimit: 3 }),
    ]);
    const t = day[0] ?? null;
    return {
      date,
      totals: t
        ? { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position }
        : { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      prevTotals: prev[0] ? { clicks: prev[0].clicks, impressions: prev[0].impressions } : { clicks: 0, impressions: 0 },
      last10d: tenDays[0] ? { clicks: tenDays[0].clicks, impressions: tenDays[0].impressions } : { clicks: 0, impressions: 0 },
      topQueries: queries,
      topPages: pages,
    };
  } catch (err) {
    return {
      date,
      totals: null,
      prevTotals: null,
      last10d: null,
      topQueries: [],
      topPages: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ---------------------------------------------------------------- GA4 */

type Ga4Row = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };

type Ga4Section = {
  date: string;
  totals: { sessions: number; users: number; newUsers: number } | null;
  prevWeekSessions: number | null;
  channels: { name: string; sessions: number }[];
  social7d: { source: string; sessions: number }[];
  ai7d: { source: string; sessions: number }[];
  error?: string;
};

async function ga4Run(propertyId: string, body: object): Promise<Ga4Row[]> {
  const token = await googleAccessToken('https://www.googleapis.com/auth/analytics.readonly');
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`GA4 ${res.status} ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { rows?: Ga4Row[] };
  return json.rows ?? [];
}

const num = (r: Ga4Row, i: number) => Number(r.metricValues?.[i]?.value ?? 0);
const dim = (r: Ga4Row, i: number) => r.dimensionValues?.[i]?.value ?? '';

/** AI 어시스턴트 유입으로 볼 리퍼러. 리퍼러 없는 앱 내 유입은 Direct 로 섞인다(하한치). */
const AI_SOURCES = /chatgpt|openai|perplexity|gemini|copilot|claude|bing.*chat/i;
const SOCIAL_SOURCES = /instagram|facebook|threads|l\.instagram/i;

async function fetchGa4(): Promise<Ga4Section> {
  const date = kstDate(1); // GA4 는 어제
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyId) {
    return {
      date,
      totals: null,
      prevWeekSessions: null,
      channels: [],
      social7d: [],
      ai7d: [],
      error: 'GA4_PROPERTY_ID 미설정 — GA4 속성을 만들고 ID 를 등록하면 이 섹션이 채워집니다.',
    };
  }
  try {
    const [totals, prevWeek, channels, sources7d] = await Promise.all([
      ga4Run(propertyId, {
        dateRanges: [{ startDate: date, endDate: date }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'newUsers' }],
      }),
      ga4Run(propertyId, {
        dateRanges: [{ startDate: kstDate(8), endDate: kstDate(8) }],
        metrics: [{ name: 'sessions' }],
      }),
      ga4Run(propertyId, {
        dateRanges: [{ startDate: date, endDate: date }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 6,
      }),
      ga4Run(propertyId, {
        dateRanges: [{ startDate: kstDate(7), endDate: date }],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 50,
      }),
    ]);

    const t = totals[0];
    return {
      date,
      totals: t
        ? { sessions: num(t, 0), users: num(t, 1), newUsers: num(t, 2) }
        : { sessions: 0, users: 0, newUsers: 0 },
      prevWeekSessions: prevWeek[0] ? num(prevWeek[0], 0) : 0,
      channels: channels.map((r) => ({ name: dim(r, 0), sessions: num(r, 0) })),
      social7d: sources7d
        .filter((r) => SOCIAL_SOURCES.test(dim(r, 0)))
        .map((r) => ({ source: dim(r, 0), sessions: num(r, 0) })),
      ai7d: sources7d
        .filter((r) => AI_SOURCES.test(dim(r, 0)))
        .map((r) => ({ source: dim(r, 0), sessions: num(r, 0) })),
    };
  } catch (err) {
    return {
      date,
      totals: null,
      prevWeekSessions: null,
      channels: [],
      social7d: [],
      ai7d: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ---------------------------------------------------------------- 조립 */

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
const n = (v: number) => Math.round(v).toLocaleString('ko-KR');

function delta(curr: number, prev: number): string {
  if (prev === 0) return curr === 0 ? '' : ' (신규)';
  const p = ((curr - prev) / prev) * 100;
  const arrow = p > 0 ? '▲' : p < 0 ? '▼' : '·';
  return ` (전주 동요일 대비 ${arrow}${Math.abs(p).toFixed(0)}%)`;
}

/** 데이터에서 기계적으로 뽑는 인사이트. 추측·과장 없이 숫자가 말해 주는 것만 적는다. */
function insights(gsc: GscSection, ga4: Ga4Section): string[] {
  const out: string[] = [];
  if (ga4.totals && ga4.prevWeekSessions !== null) {
    const c = ga4.totals.sessions;
    const p = ga4.prevWeekSessions;
    if (p > 0 && c < p) out.push(`어제 세션 ${n(c)}회 — 지난주 같은 요일 ${n(p)}회 대비 ${(100 * (p - c) / p).toFixed(0)}% 감소했습니다.`);
    if (p > 0 && c > p) out.push(`어제 세션 ${n(c)}회 — 지난주 같은 요일 ${n(p)}회 대비 ${(100 * (c - p) / p).toFixed(0)}% 증가했습니다.`);
  }
  const bestQ = gsc.topQueries.find((q) => q.clicks > 0);
  if (bestQ) out.push(`검색어 "${bestQ.keys[0]}" 가 클릭 ${n(bestQ.clicks)}회 · CTR ${pct(bestQ.ctr)} 로 가장 성과가 좋습니다.`);
  const highImp = gsc.topQueries.find((q) => q.impressions >= 10 && q.clicks === 0);
  if (highImp) out.push(`"${highImp.keys[0]}" 는 노출 ${n(highImp.impressions)}회에 클릭 0 — 해당 키워드가 닿는 페이지의 제목·설명을 점검할 가치가 있습니다.`);
  if (ga4.ai7d.length > 0) {
    const total = ga4.ai7d.reduce((s, r) => s + r.sessions, 0);
    out.push(`최근 7일 AI 검색(ChatGPT 등) 유입 ${n(total)}회 — 리퍼러 없는 앱 내 유입은 Direct 로 잡혀 실제보다 적게 보입니다.`);
  }
  if (out.length === 0) out.push('오늘은 특기할 변화가 없습니다.');
  return out;
}

export type DailyReport = { subject: string; text: string; html: string; kakaoSummary: string };

export async function composeDailyReport(): Promise<DailyReport> {
  const [gsc, ga4] = await Promise.all([fetchGsc(), fetchGa4()]);
  const today = kstDate(0);
  const subject = `usherinmaking 데일리 인사이트 — ${today}`;

  const L: string[] = [];
  L.push(`📈 usherinmaking 데일리 인사이트 — ${today}`);
  L.push('');
  L.push(`🔍 구글 검색 유입 (Search Console · ${gsc.date} 기준)`);
  if (gsc.error) L.push(`  · 조회 실패: ${gsc.error}`);
  else if (gsc.totals) {
    const p = gsc.prevTotals;
    L.push(`  · 클릭 ${n(gsc.totals.clicks)}회 · 노출 ${n(gsc.totals.impressions)}회 · CTR ${pct(gsc.totals.ctr)} · 평균 순위 ${gsc.totals.position.toFixed(1)}위${p ? ` (전일 클릭 ${n(p.clicks)} · 노출 ${n(p.impressions)})` : ''}`);
    if (gsc.last10d) L.push(`  · 최근 10일 누적: 클릭 ${n(gsc.last10d.clicks)}회 · 노출 ${n(gsc.last10d.impressions)}회`);
    if (gsc.topQueries.length) {
      L.push('  · 유입 키워드 (클릭 · 노출 · CTR · 평균순위):');
      gsc.topQueries.forEach((q, i) =>
        L.push(`    ${i + 1}. "${q.keys[0]}" — ${n(q.clicks)} · ${n(q.impressions)} · ${pct(q.ctr)} · ${q.position.toFixed(1)}위`),
      );
    }
    if (gsc.topPages.length) {
      L.push(`  · 유입 페이지: ${gsc.topPages.map((r) => `${r.keys[0].replace(SITE_URL, '') || '/'}(${n(r.clicks)})`).join(' · ')}`);
    }
  }
  L.push('');
  L.push(`🌐 사이트 트래픽 (GA4 · ${ga4.date} 기준)`);
  if (ga4.error) L.push(`  · ${ga4.error}`);
  else if (ga4.totals) {
    L.push(`  · 세션 ${n(ga4.totals.sessions)}${delta(ga4.totals.sessions, ga4.prevWeekSessions ?? 0)} · 방문자 ${n(ga4.totals.users)} · 신규 ${n(ga4.totals.newUsers)}`);
    if (ga4.channels.length) L.push(`  · 채널: ${ga4.channels.map((c) => `${c.name} ${n(c.sessions)}`).join(' · ')}`);
    L.push(`📸 인스타그램 → 웹사이트 (최근 7일): ${ga4.social7d.length ? ga4.social7d.map((s) => `${s.source} ${n(s.sessions)}`).join(' · ') : '유입 없음'}`);
    L.push(`🤖 AI 검색 유입 (최근 7일): ${ga4.ai7d.length ? ga4.ai7d.map((s) => `${s.source} ${n(s.sessions)}`).join(' · ') : '유입 없음'}`);
  }
  L.push('');
  L.push('💡 인사이트');
  insights(gsc, ga4).forEach((s, i) => L.push(`  ${i + 1}. ${s}`));

  const text = L.join('\n');

  // 카카오톡 "나에게 보내기" 기본 템플릿은 200자 제한 — 핵심 숫자만 추린 요약.
  const K: string[] = [`📈 usherinmaking ${today}`];
  if (gsc.totals) K.push(`검색: 클릭 ${n(gsc.totals.clicks)} · 노출 ${n(gsc.totals.impressions)} · ${gsc.totals.position.toFixed(1)}위`);
  if (ga4.totals) K.push(`어제 세션 ${n(ga4.totals.sessions)}${delta(ga4.totals.sessions, ga4.prevWeekSessions ?? 0)}`);
  const kTop = gsc.topQueries.find((q) => q.clicks > 0);
  if (kTop) K.push(`인기 검색어: "${kTop.keys[0]}"`);
  K.push('상세는 이메일함을 확인하세요');
  const kakaoSummary = K.join('\n');
  // HTML 은 텍스트를 그대로 <pre> 계열로 감싼다 — 이메일 클라이언트마다 CSS 지원이 갈려서
  // 표 레이아웃보다 고정폭 텍스트가 어디서나 같게 보인다.
  const html = `<div style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.9;white-space:pre-wrap;color:#3f3a33;max-width:680px">${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')}</div>`;

  return { subject, text, html, kakaoSummary };
}

/* ---------------------------------------------------------------- 발송 */

export type SendOutcome = { sent: boolean; detail: string };
export type DeliveryOutcome = {
  email: SendOutcome;
  kakao: { label: string; sent: boolean; detail?: string }[];
  subject?: string;
};

/**
 * Resend 로 발송한다. 도메인(usherinmaking.com) 인증이 끝나면 어떤 수신자에게도 보낼 수 있다.
 * RESEND_API_KEY / REPORT_RECIPIENTS 가 없으면 발송만 건너뛰고 그 사실을 돌려준다.
 */
export async function sendDailyReport(): Promise<DeliveryOutcome> {
  if (!readServiceAccount()) {
    return {
      email: { sent: false, detail: 'GSC_SERVICE_ACCOUNT_JSON 미설정 — 데이터를 읽을 수 없어 발송하지 않습니다.' },
      kakao: [],
    };
  }

  const report = await composeDailyReport();

  // 이메일과 카톡은 독립 채널이다 — 한쪽 실패가 다른 쪽을 막지 않는다.
  const [email, kakao] = await Promise.all([
    sendEmail(report),
    sendKakaoToAll(report.kakaoSummary, SITE_URL),
  ]);
  return { email, kakao, subject: report.subject };
}

async function sendEmail(report: DailyReport): Promise<SendOutcome> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipients = (process.env.REPORT_RECIPIENTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!apiKey || recipients.length === 0) {
    return { sent: false, detail: !apiKey ? 'RESEND_API_KEY 미설정' : 'REPORT_RECIPIENTS 미설정' };
  }

  const from = process.env.REPORT_FROM?.trim() || 'usherinmaking 리포트 <report@usherinmaking.com>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: recipients, subject: report.subject, text: report.text, html: report.html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { sent: false, detail: `Resend ${res.status} ${detail.slice(0, 200)}` };
  }
  return { sent: true, detail: `${recipients.length}명에게 발송` };
}
