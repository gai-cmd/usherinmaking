/**
 * 네이버 블로그 → 촬영후기(KO) 취입 **미리보기**. DB·Blob 에 아무것도 쓰지 않는다.
 *
 * 인계 문서의 "네이버가 막아서 못 가져온다"는 판정이 틀렸음을 8/1 에 실측으로 뒤집었다.
 * 막힌 것은 iframe 껍데기(blog.naver.com/<id>)뿐이고 아래 두 경로는 열려 있다:
 *   ① 목록  https://rss.blog.naver.com/<id>.xml            (제목·날짜·링크·발췌·썸네일)
 *   ② 본문  https://blog.naver.com/PostView.naver?blogId=&logNo=  (문단 + 원본급 이미지)
 *
 * 이 스크립트는 ②까지 긁어 "취입하면 어떤 글이 되는지"만 보여 준다. 실제 취입 전에
 * 사람이 판단해야 하는 것 — 제목 정리·카테고리 배정·게재 여부 — 을 실제 데이터로 드러내는 게 목적이다.
 *
 * 실행: node scripts/naver-journal-preview.mjs [--limit N] [--json]
 */

const BLOG_ID = 'usherinmaking';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf('--limit') + 1]) || (args.includes('--limit') ? 10 : Infinity);
const asJson = args.includes('--json');

/** 사이트 카테고리는 5종뿐이다(src/server/journal.ts). 키워드로 후보를 제안만 하고 확정은 사람이 한다. */
const CATEGORY_RULES = [
  ['anniversary', /태교|만삭|돌기념|돌촬영|칠순|환갑|기념일|백일|200일|두돌/],
  ['dress', /드레스|의상|dress/i],
  ['studio', /스튜디오|실내|studio/i],
  ['tips', /준비|팁|가이드|안내|예약|주의/],
  ['location', /로케이션|바다|선셋|해변|비치|미야코지마|여행|야외/],
];

const suggestCategory = (text) =>
  CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] ?? '(미배정 — 사람이 정해야 함)';

/**
 * 블로그 제목은 검색 노출용으로 키워드를 앞뒤에 붙여 둔 형태다.
 *   예: "{오키나와스냅,오키나와커플스냅,세미웨딩:어셔린메이킹}오키나와셀프웨딩, 웨딩스냅의 피날레"
 * 그대로 사이트에 실으면 읽히지 않으므로, 껍데기를 벗긴 안을 제안한다(확정은 사람).
 */
const cleanTitle = (raw) =>
  raw
    .replace(/^[{[(][^}\])]*[}\])]\s*/, '') // 앞머리 {키워드 묶음}
    .replace(/\s*[:：]\s*어셔린메이킹\s*$/, '') // 꼬리 :어셔린메이킹
    .replace(/\s*_\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();

const stripTags = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/​/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

async function fetchIndex() {
  const xml = await get(`https://rss.blog.naver.com/${BLOG_ID}.xml`);
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items.map((it) => {
    const pick = (t) => {
      const m = it.match(new RegExp(`<${t}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${t}>`));
      return m ? stripTags(m[1]) : '';
    };
    const link = pick('link');
    return { title: pick('title'), link, logNo: link.match(/\/(\d+)/)?.[1] ?? '', pubDate: pick('pubDate') };
  });
}

/** 본문 전문 + 원본급 이미지. SmartEditor ONE 구조(se-text-paragraph / data-lazy-src)를 읽는다. */
async function fetchPost(logNo) {
  const html = await get(
    `https://blog.naver.com/PostView.naver?blogId=${BLOG_ID}&logNo=${logNo}`,
  );
  const paras = [...html.matchAll(/<p class="se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
  const images = [...new Set([...html.matchAll(/data-lazy-src="([^"]+)"/g)].map((m) => m[1]))];
  return { paras, images };
}

const main = async () => {
  const index = await fetchIndex();
  const targets = index.slice(0, limit === Infinity ? index.length : limit);
  if (!asJson) console.log(`RSS 목록 ${index.length}건 · 본문 조회 대상 ${targets.length}건\n`);

  const out = [];
  for (const [i, item] of targets.entries()) {
    let post = { paras: [], images: [] };
    let error = null;
    try {
      post = await fetchPost(item.logNo);
    } catch (e) {
      error = String(e.message || e);
    }
    const body = post.paras.slice(1).join('\n\n'); // 첫 문단은 제목 반복이라 뺀다
    const rec = {
      logNo: item.logNo,
      titleRaw: item.title,
      titleClean: cleanTitle(item.title),
      date: item.pubDate.slice(5, 16),
      category: suggestCategory(`${item.title} ${body}`),
      bodyChars: body.length,
      images: post.images.length,
      error,
    };
    out.push(rec);
    if (!asJson) {
      console.log(`[${String(i + 1).padStart(2)}] ${rec.date} · ${rec.category}`);
      console.log(`     원제목: ${rec.titleRaw.slice(0, 62)}`);
      console.log(`     정리안: ${rec.titleClean.slice(0, 62)}`);
      console.log(`     본문 ${rec.bodyChars}자 · 이미지 ${rec.images}장${error ? ` · 오류: ${error}` : ''}`);
    }
    await new Promise((r) => setTimeout(r, 350)); // 네이버에 부담 주지 않는 간격
  }

  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const ok = out.filter((r) => !r.error);
  const thin = ok.filter((r) => r.bodyChars < 200);
  const noCat = ok.filter((r) => r.category.startsWith('('));
  console.log(`\n─── 집계 ───`);
  console.log(`성공 ${ok.length} / ${out.length}건 · 실패 ${out.length - ok.length}건`);
  console.log(`본문 평균 ${Math.round(ok.reduce((a, r) => a + r.bodyChars, 0) / (ok.length || 1))}자 · 이미지 합계 ${ok.reduce((a, r) => a + r.images, 0)}장`);
  console.log(`사람 판단 필요 — 본문 200자 미만 ${thin.length}건 · 카테고리 미배정 ${noCat.length}건`);
  const byCat = {};
  for (const r of ok) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
  console.log(`카테고리 분포:`, byCat);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
