/**
 * 네이버 백업 후보 목록 생성 — **목록만 조회한다. 본문은 한 건도 받지 않는다.**
 *
 * 왜 이렇게 제한했는가:
 *   네이버 이용약관은 "자동화된 수단으로 게시물을 수집"하는 것을 사전 허락 없이 금지한다.
 *   본문을 긁으면 그 조항에 걸린다. 그래서 이 도구는 제목·날짜·글번호만 받아
 *   "사람이 어떤 글을 브라우저로 저장할지" 고르는 목록만 만든다. 본문 확보는
 *   사람이 브라우저에서 페이지 저장으로 하고, 취입은 그 저장본에서 한다.
 *
 *   robots.txt 도 지킨다 — PostTitleListAsync.naver 는 금지 목록에 없다.
 *   분류표(m.blog.naver.com/rego/)는 `/rego/` 가 금지되어 있으므로 호출하지 않고,
 *   분류 이름은 연도별 건수 지문으로 역산한다.
 *
 * 실행: node scripts/naver-backup-candidates.mjs [--per 10]
 */

import fs from 'node:fs';

const BLOG_ID = 'usherinmaking';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const args = process.argv.slice(2);
const PER = Number(args[args.indexOf('--per') + 1]) || 10;

const parseLoose = (t) =>
  JSON.parse(t.slice(t.indexOf('{')).replace(/"pagingHtml"\s*:\s*"(?:[^"\\]|\\.)*",?/g, ''));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: `https://blog.naver.com/${BLOG_ID}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

const listPage = async (n) =>
  parseLoose(
    await get(
      `https://blog.naver.com/PostTitleListAsync.naver?blogId=${BLOG_ID}` +
        `&viewdate=&currentPage=${n}&categoryNo=0&parentCategoryNo=&countPerPage=30`,
    ),
  );

const isoDate = (s) => {
  const m = decodeURIComponent(String(s)).match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : null;
};

/**
 * 분류 이름 역산. `/rego/` 를 못 쓰므로 연도별 건수 지문으로 맞춘다.
 * 총건수가 모두 서로 달라 지문으로 유일하게 식별된다(2026-08-09 실측).
 */
const CATEGORY_BY_TOTAL = {
  258: '스냅',
  203: '쓰는감성',
  149: 'hommage',
  40: '웨딩룩',
  33: '어셔린의 힐링셀프웨딩',
  24: '공지사항',
  4: '[POST] 어셔린메이킹',
  3: '셀프웨딩 소품 만들기',
  2: '손',
};

/**
 * 사이트 5개 카테고리로 제목에서 분류한다. 본문을 안 보므로 제목 신호만 쓴다.
 *
 * 순서가 곧 우선순위다. 제목이 키워드 나열식이라 여러 신호가 한 제목에 겹친다
 * ("오키나와스냅,오키나와가족스냅,오키나와만삭스냅…"). 겹칠 때 무엇을 대표로 볼지를
 * 희소한 쪽부터 잡는다 — 흔한 로케이션이 먼저 먹으면 나머지가 굶는다.
 *
 * 스튜디오가 사실상 비는 것은 규칙 탓이 아니다. 이 블로그는 야외 로케이션 기록이고
 * 스튜디오 글이 원본에 1건뿐이다(2026-08-09 제목 실측). 없는 것을 채우지 않는다.
 */
function siteCategory(title) {
  const t = title;
  if (/스튜디오|실내촬영|하우스/.test(t)) return 'studio';
  if (/태교|만삭|돌촬영|돌기념|돌스냅|백일|200일|두돌|칠순|환갑|기념여행|기념일|가족스냅|대가족|가족촬영|아기|베이비|여행기록/.test(t))
    return 'anniversary';
  if (/드레스|웨딩룩|의상|소품|부케|한복/.test(t)) return 'dress';
  if (/팁|준비물|가이드|추천|노하우|알아두면|주의|예약|일정|모집|날씨|시간대|비용|가격|문의|이유|필수|방법|체크|정보|계절|시즌/.test(t))
    return 'tips';
  return 'location';
}

const LABEL = {
  studio: '스튜디오',
  location: '로케이션',
  dress: '드레스',
  tips: '촬영 팁',
  anniversary: '기념일',
};

const main = async () => {
  const first = await listPage(1);
  const pages = Math.ceil(Number(first.totalCount) / 30);
  const rows = [...first.postList];
  for (let n = 2; n <= pages; n++) {
    rows.push(...(await listPage(n)).postList);
    await new Promise((r) => setTimeout(r, 300));
  }

  // categoryNo → 이름 역산
  const countByNo = {};
  for (const p of rows) countByNo[String(p.categoryNo)] = (countByNo[String(p.categoryNo)] ?? 0) + 1;
  const nameByNo = {};
  for (const [no, cnt] of Object.entries(countByNo)) nameByNo[no] = CATEGORY_BY_TOTAL[cnt] ?? `(분류 ${no})`;

  const all = rows
    .map((p) => ({
      logNo: String(p.logNo),
      title: decodeURIComponent(String(p.title)).replace(/\+/g, ' '),
      naverCat: nameByNo[String(p.categoryNo)],
      date: isoDate(p.addDate),
    }))
    .filter((r) => r.date);

  // 촬영 분류만 + 최근 것 우선. 오키나와·미야코지마 문맥이 제목에 드러나는 글로 한정한다.
  const pool = all
    .filter((r) => ['스냅', '웨딩룩'].includes(r.naverCat))
    .filter((r) => r.date >= '2016-01-01')
    .filter((r) => /오키나와|미야코지마|okinawa/i.test(r.title))
    .filter((r) => !/거제|제주|여수|부산|통영|강릉|발리|괌|사이판|대만|오사카|후쿠오카/.test(r.title))
    .sort((a, b) => b.date.localeCompare(a.date));

  // 5개 카테고리에 고르게 — 카테고리별로 연도가 겹치지 않게 훑어 담는다.
  const buckets = { studio: [], location: [], dress: [], tips: [], anniversary: [] };
  for (const r of pool) buckets[siteCategory(r.title)].push(r);

  const picked = {};
  const shortfall = {};
  for (const [cat, list] of Object.entries(buckets)) {
    // 연도 다양성 확보 — 같은 해에서 2건을 넘기지 않는다(같은 시기 글만 몰리는 것 방지).
    const perYear = {};
    const out = [];
    for (const r of list) {
      const y = r.date.slice(0, 4);
      if ((perYear[y] ?? 0) >= 2) continue;
      perYear[y] = (perYear[y] ?? 0) + 1;
      out.push(r);
      if (out.length >= PER) break;
    }
    // 연도 제한 때문에 모자란 경우에 한해 제한을 풀고 채운다.
    if (out.length < PER) for (const r of list) { if (out.length >= PER) break; if (!out.includes(r)) out.push(r); }
    picked[cat] = out;
    // 원본 자체가 모자란 것과 규칙 때문에 모자란 것을 구분해 기록한다.
    if (out.length < PER) shortfall[cat] = { got: out.length, available: list.length };
  }

  const total = Object.values(picked).reduce((a, b) => a + b.length, 0);

  /* ---------------------------------------------------------- 출력 */
  const lines = [];
  lines.push('# 네이버 백업 후보 목록');
  lines.push('');
  lines.push(`생성: ${new Date().toISOString().slice(0, 10)} · 총 **${total}건** · 원본 블로그 전체 ${all.length}건 중 선별`);
  lines.push('');
  lines.push('## 저장 방법');
  lines.push('');
  lines.push('아래 주소를 **그대로** 열어 저장합니다. `m.` 이 붙은 모바일 주소여야 본문이 담깁니다');
  lines.push('(PC 주소는 본문이 iframe 안에 있어 저장하면 빈 파일이 됩니다 — 실측 확인).');
  lines.push('');
  lines.push('1. 주소를 크롬에서 연다');
  lines.push('2. ⌘S → 저장 형식 **"웹페이지, 전체"** (HTML만 아님 — 이미지가 빠집니다)');
  lines.push('3. 저장 위치: `naver-backup/` 폴더');
  lines.push('');
  lines.push('파일 이름은 아무렇게나 두셔도 됩니다. 취입 스크립트가 HTML 안에서 글번호·날짜를 직접 읽습니다.');
  lines.push('');
  lines.push('## 취입 시 붙는 출처 문구');
  lines.push('');
  lines.push('모든 글 본문 **끝**에 아래 문구가 자동으로 붙습니다. 원문 위치를 명시해야');
  lines.push('구글이 "무단 복제"가 아니라 "출처 있는 정리본"으로 읽습니다.');
  lines.push('');
  lines.push('```');
  lines.push('> 이 글은 어셔린메이킹이 네이버 블로그에 기록한 촬영 후기(YYYY-MM-DD)를');
  lines.push('> 홈페이지 형식에 맞게 정리한 것입니다. 사진과 내용은 어셔린메이킹의 저작물입니다.');
  lines.push('> 원문 보기: https://blog.naver.com/usherinmaking/{글번호}');
  lines.push('```');
  lines.push('');
  lines.push('본문 **첫 줄**에도 한 줄 표시가 들어갑니다 — 원문을 아래까지 안 읽는 사람과');
  lines.push('첫 문단만 인용하는 AI 검색 양쪽에 출처가 닿게 하기 위해서입니다.');
  lines.push('');
  lines.push('```');
  lines.push('*네이버 블로그에 남긴 YYYY년 M월 촬영 기록입니다.*');
  lines.push('```');
  lines.push('');
  lines.push('## SEO 주의사항 (취입 전 반드시 확인)');
  lines.push('');
  lines.push('원문은 이미 구글에 색인되어 있습니다. **그대로 복사하면 중복 판정으로 우리 쪽이');
  lines.push('걸러집니다** — 2014년부터 쌓인 원문이 대표로 뽑히기 때문입니다.');
  lines.push('취입 스크립트가 아래를 자동 처리하지만, 공개 전 사람이 한 번 확인해 주세요.');
  lines.push('');
  lines.push('| 항목 | 처리 | 사람이 볼 것 |');
  lines.push('|------|------|--------------|');
  lines.push('| 제목 키워드 껍데기 | `{오키나와스냅,…}` 자동 제거 | 남은 제목이 문장으로 읽히는지 |');
  lines.push('| 첫 문단 | 원문 그대로 유지 | 그 촬영이 무엇이었는지 한 문장으로 다듬기 |');
  lines.push('| 출처 표시 | 첫 줄 + 본문 끝 자동 삽입 | — |');
  lines.push('| 이미지 | 저장본에서 읽어 자사 스토리지 재호스팅 | 네이버 직링크가 남지 않았는지 |');
  lines.push('| 얇은 글 | 본문 400자 미만 자동 제외 | — |');
  lines.push('| 공개 상태 | **비공개(draft)로 먼저 저장** | 확인 후 하나씩 공개 |');
  lines.push('');
  lines.push('> **한 번에 전부 공개하지 마세요.** 신규 URL 수십 개가 동시에 뜨는 것 자체가');
  lines.push('> 대량 발행 신호입니다. 며칠에 나눠 공개하는 편이 안전합니다.');
  lines.push('');

  if (Object.keys(shortfall).length) {
    lines.push('## ⚠️ 원본이 모자란 카테고리');
    lines.push('');
    lines.push('아래는 네이버 블로그에 해당 글 자체가 적어서 목표 건수를 못 채운 것입니다.');
    lines.push('없는 글을 다른 카테고리에서 끌어와 채우지 않았습니다 — 잘못 분류하면 사실이 틀어집니다.');
    lines.push('');
    lines.push('| 카테고리 | 뽑은 건수 | 원본에 있는 전부 |');
    lines.push('|----------|-----------|------------------|');
    for (const [cat, s] of Object.entries(shortfall)) {
      lines.push(`| ${LABEL[cat]} | ${s.got}건 | ${s.available}건 |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  for (const [cat, list] of Object.entries(picked)) {
    lines.push(`## ${LABEL[cat]} (${list.length}건)`);
    lines.push('');
    lines.push('| # | 날짜 | 제목 | 저장할 주소 |');
    lines.push('|---|------|------|-------------|');
    list.forEach((r, i) => {
      const t = r.title.replace(/\|/g, '·').slice(0, 46);
      lines.push(`| ${i + 1} | ${r.date} | ${t} | https://m.blog.naver.com/${BLOG_ID}/${r.logNo} |`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## 주소만 모아보기 (일괄 처리용)');
  lines.push('');
  lines.push('```');
  for (const list of Object.values(picked)) for (const r of list) lines.push(`https://m.blog.naver.com/${BLOG_ID}/${r.logNo}`);
  lines.push('```');

  fs.writeFileSync('naver-backup/CANDIDATES.md', lines.join('\n'));

  // 콘솔 요약
  console.log(`전체 ${all.length}건 → 촬영분류·2016년이후·오키나와 문맥 ${pool.length}건 → 선별 ${total}건\n`);
  for (const [cat, list] of Object.entries(picked)) {
    const years = [...new Set(list.map((r) => r.date.slice(0, 4)))].sort().join(' ');
    console.log(`  ${LABEL[cat].padEnd(6)} ${String(list.length).padStart(2)}건   연도: ${years}`);
  }
  console.log('\n→ naver-backup/CANDIDATES.md');
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
