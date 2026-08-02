/**
 * 네이버 블로그 **전체 아카이브 색인**. 본문은 긁지 않고 목록만 센다 (DB·Blob 쓰기 없음).
 *
 * RSS(`naver-journal-preview.mjs`)는 최신 50건만 준다 — 2022년까지밖에 안 닿는다.
 * 2016년부터 전부 보려면 목록 API 를 쪽수로 넘겨야 한다:
 *   목록  https://blog.naver.com/PostTitleListAsync.naver?blogId=&currentPage=&countPerPage=
 *   분류  https://m.blog.naver.com/rego/CategoryList.naver?blogId=
 *
 * 실행: node scripts/naver-archive-index.mjs [--json]
 */

const BLOG_ID = 'usherinmaking';
const PER_PAGE = 30;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const asJson = process.argv.includes('--json');

/** 네이버 응답의 pagingHtml 에 잘못된 escape 가 섞여 JSON.parse 가 깨진다 — 그 필드만 들어낸다. */
const parseLoose = (text) => {
  const body = text.slice(text.indexOf('{'));
  return JSON.parse(body.replace(/"pagingHtml"\s*:\s*"(?:[^"\\]|\\.)*",?/g, ''));
};

async function get(url, referer) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...(referer && { Referer: referer }) } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

async function categories() {
  const t = await get(
    `https://m.blog.naver.com/rego/CategoryList.naver?blogId=${BLOG_ID}`,
    `https://m.blog.naver.com/${BLOG_ID}`,
  );
  const list = JSON.parse(t.slice(t.indexOf('{'))).result.mylogCategoryList;
  return new Map(list.map((c) => [String(c.categoryNo), c]));
}

async function page(n) {
  const t = await get(
    `https://blog.naver.com/PostTitleListAsync.naver?blogId=${BLOG_ID}` +
      `&viewdate=&currentPage=${n}&categoryNo=0&parentCategoryNo=&countPerPage=${PER_PAGE}`,
    `https://blog.naver.com/${BLOG_ID}`,
  );
  const d = parseLoose(t);
  return { total: Number(d.totalCount), posts: d.postList ?? [] };
}

/** "2026. 7. 27." → "2026-07-27" · 최근 글은 시각만 오기도 한다("18:22"). */
const isoDate = (s) => {
  const m = decodeURIComponent(s).match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : null;
};

const main = async () => {
  const cats = await categories();
  const first = await page(1);
  const pages = Math.ceil(first.total / PER_PAGE);
  if (!asJson) console.log(`전체 ${first.total}건 · ${pages}쪽 · 분류 ${cats.size}개\n`);

  const rows = [...first.posts];
  for (let n = 2; n <= pages; n++) {
    rows.push(...(await page(n)).posts);
    await new Promise((r) => setTimeout(r, 300));
  }

  const recs = rows.map((p) => ({
    logNo: String(p.logNo),
    title: decodeURIComponent(String(p.title)).replace(/\+/g, ' '),
    categoryNo: String(p.categoryNo),
    categoryName: cats.get(String(p.categoryNo))?.categoryName ?? `(분류 ${p.categoryNo})`,
    date: isoDate(String(p.addDate)),
    readCount: Number(p.readCount ?? 0),
  }));

  if (asJson) {
    console.log(JSON.stringify(recs, null, 2));
    return;
  }

  const dated = recs.filter((r) => r.date);
  console.log(`수집 ${recs.length}건 (날짜 해석 ${dated.length}건)`);
  const years = [...new Set(dated.map((r) => r.date.slice(0, 4)))].sort();
  console.log(`연도 범위: ${years[0]} ~ ${years[years.length - 1]}\n`);

  // 분류 × 연도 표 — "2016년 이후 카테고리별" 판단의 근거가 되는 표다.
  const byCat = {};
  for (const r of dated) {
    (byCat[r.categoryName] ??= {})[r.date.slice(0, 4)] =
      ((byCat[r.categoryName] ?? {})[r.date.slice(0, 4)] ?? 0) + 1;
  }
  const head = years.join('  ');
  console.log(`${'분류'.padEnd(22)} ${head}   합계`);
  for (const [name, ys] of Object.entries(byCat).sort(
    (a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0),
  )) {
    const cells = years.map((y) => String(ys[y] ?? '·').padStart(4)).join('  ');
    const sum = Object.values(ys).reduce((x, y) => x + y, 0);
    console.log(`${name.padEnd(22)} ${cells}  ${String(sum).padStart(4)}`);
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
