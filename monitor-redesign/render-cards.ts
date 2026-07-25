/**
 * usherinmaking モニター募集 이벤트 카드 3종 재렌더링 (2026-07-11 리디자인)
 * - 원본: wp-content/uploads/2026/04/{02_wedding-2,03_maternity-2,04_memorial-2}.png (819x1023)
 * - 변경: 맨 하단 갈색 기간 띠 삭제 → 브랜드 푸터로 교체, 상단에 Imagen 4 히어로 사진 밴드 추가
 * - 텍스트·가격은 HTML로 정확히 재현 (AI 이미지에 일본어 텍스트 금지)
 *
 * 실행 (이 폴더에서):
 *   1) heroes/ 에 hero-wedding.png, hero-maternity.png, hero-memorial.png 준비 (gen-heroes.sh)
 *   2) kiosk-crm의 node_modules 활용: cd ~/work/KC-CRM/kiosk-asset/kiosk-crm && npx tsx ~/personal/works/usherinmaking/monitor-redesign/render-cards.ts
 * 출력: out/02_wedding-3.png 등 (819x1023, @2x 렌더 후 축소)
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'

const DIR = resolve(__dirname)
const OUT = join(DIR, 'out')
const HERO = (n: string) => 'file://' + join(DIR, 'heroes', `hero-${n}.png`)

type Row = { label: string; price: string }
type Card = {
  file: string; hero: string
  planNo: string; page: string; eyebrow: string
  t1: string; t1Italic: boolean; t2: string; t2Italic: boolean; sub: string
  cols: Array<{
    plan: string; title: string[]; time: string
    regular?: string; price: string; priceNote: string
    items?: string[]; includedTitle?: string; copy?: string[]
    forTitle?: string; forLines?: string[]
    options?: Row[]; note?: string
  }>
  bottomOptionTitle?: string
  bottomOptions?: Row[]
}

const CARDS: Card[] = [
  {
    file: '02_wedding-3', hero: 'wedding',
    planNo: 'PLAN 01 — 02', page: '02 / 04', eyebrow: 'Korean Style Wedding',
    t1: 'Wedding', t1Italic: false, t2: 'Photo', t2Italic: true, sub: 'ウェディングフォト プラン',
    cols: [
      {
        plan: 'Plan.01', title: ['スタジオ', 'ウェディングフォト'], time: 'ヘアメイク + 撮影  約 3.5H',
        regular: '定価 ¥140,000 →', price: '¥99,000', priceNote: 'モニター価格',
        items: ['韓国風リタッチ写真データ 30カット', '新婦 フルメイク + ヘアセット', '新郎 シンプルメイク + ヘアセット', 'ドレス 1着 ・ ヘア飾り・アクセサリー込み', '造花ブーケ / ベール 込み'],
      },
      {
        plan: 'Plan.02', title: ['スタジオ +', 'ロケーションフォト'], time: 'ヘアメイク + 撮影  約 4.5H',
        regular: '定価 ¥200,000 →', price: '¥150,000', priceNote: 'モニター価格',
        items: ['韓国風リタッチ写真データ 40カット', '新婦 フルメイク + ヘアセット', '新郎 シンプルメイク + ヘアセット', 'ドレス 2着 ・ ヘア飾り・アクセサリー込み', '造花ブーケ / ベール 込み'],
      },
    ],
    bottomOptionTitle: '— OPTION ( PLAN.01 / 02 共通 ) —',
    bottomOptions: [
      { label: '+  新郎衣装（Mサイズ）選択', price: '¥20,000' },
      { label: '+  プレミアムドレス', price: '¥20,000~' },
      { label: '+  原本データ JPEG', price: '¥5,500' },
      { label: '+  休日料金', price: '¥18,000' },
    ],
  },
  {
    file: '03_maternity-3', hero: 'maternity',
    planNo: 'PLAN 03', page: '03 / 04', eyebrow: 'Wedding Style Maternity',
    t1: 'Maternity', t1Italic: true, t2: 'Photo', t2Italic: false, sub: 'マタニティフォト プラン',
    cols: [
      {
        plan: 'Plan.03', title: ['ウェディング風', 'マタニティフォト'], time: 'ヘアメイク + 撮影  約 3H',
        regular: '定価 ¥85,000 →', price: '¥66,000', priceNote: 'モニター価格',
        copy: ['新しい命を迎える、', '特別な瞬間を', 'ウェディングムードで。'],
      },
      {
        plan: '', title: [], time: '', price: '', priceNote: '',
        includedTitle: '— INCLUDED —',
        items: ['カラーリタッチ写真データ 20カット', '男女 メイクアップ + ヘアセット', 'マタニティ専用衣装 1着', 'アクセサリー込み'],
        options: [
          { label: '+  原本データ JPEG', price: '¥5,500' },
          { label: '+  休日料金', price: '¥11,000' },
        ],
      },
    ],
  },
  {
    file: '04_memorial-3', hero: 'memorial',
    planNo: 'PLAN 04', page: '04 / 04', eyebrow: 'Anniversary · Family · Profile',
    t1: 'Memorial', t1Italic: true, t2: 'Photo', t2Italic: false, sub: '記念日フォト プラン',
    cols: [
      {
        plan: 'Plan.04', title: ['記念日・家族・', 'プロフィール撮影'], time: '撮影  約 50分',
        regular: '定価 ¥38,000 →', price: '¥25,000', priceNote: 'モニター価格',
        forTitle: '— FOR —',
        forLines: ['カップル ・ 記念日 ・ 入学 ・ 誕生日', '家族写真 ・ プロフィール写真', '( 1名様 〜 4名様まで )'],
      },
      {
        plan: '', title: [], time: '', price: '', priceNote: '',
        includedTitle: '— INCLUDED —',
        items: ['カラーリタッチ写真データ 20カット'],
        options: [
          { label: '+  1名様 追加', price: '¥3,300' },
          { label: '+  ヘアメイク 追加', price: '¥22,000' },
          { label: '+  原本データ JPEG', price: '¥5,500' },
          { label: '+  休日料金', price: '¥11,000' },
        ],
        note: '※ ドレス撮影をご希望の方は\nウェディングフォトプランへお問い合わせください。',
      },
    ],
  },
]

function colHtml(c: Card['cols'][number]): string {
  const parts: string[] = []
  if (c.plan) parts.push(`<div class="plan-label">${c.plan}</div>`)
  if (c.title.length) parts.push(`<div class="plan-title">${c.title.join('<br>')}</div>`)
  if (c.time) parts.push(`<div class="time">◷ ${c.time}</div>`)
  if (c.regular) parts.push(`<div class="regular"><s>${c.regular.replace(' →', '')}</s> →</div>`)
  if (c.price) parts.push(`<div class="price">${c.price}</div><div class="price-note">${c.priceNote}</div>`)
  if (c.copy) parts.push(`<div class="copy">${c.copy.join('<br>')}</div>`)
  if (c.forTitle) parts.push(`<div class="sec-label">${c.forTitle}</div><div class="for-lines">${(c.forLines || []).join('<br>')}</div>`)
  if (c.includedTitle) parts.push(`<div class="sec-label">${c.includedTitle}</div>`)
  if (c.items) parts.push(`<div class="hr-dot"></div><ul class="items">${c.items.map(i => `<li>${i}</li>`).join('')}</ul>`)
  if (c.options) parts.push(`<div class="sec-label opt">OPTION</div>${c.options.map(o => `<div class="opt-row"><span>${o.label}</span><span class="opt-price">${o.price}</span></div>`).join('')}`)
  if (c.note) parts.push(`<div class="hr-dot"></div><div class="note">${c.note.replace('\n', '<br>')}</div>`)
  return `<div class="col">${parts.join('')}</div>`
}

function html(card: Card): string {
  const bottom = card.bottomOptions
    ? `<div class="hr"></div><div class="opt-title">${card.bottomOptionTitle}</div>
       <div class="opt-grid">${card.bottomOptions.map(o => `<div class="opt-row"><span>${o.label}</span><span class="opt-price">${o.price}</span></div>`).join('')}</div>`
    : ''
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Zen+Old+Mincho:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1638px;height:2046px;overflow:hidden}
body{
  font-family:'Zen Old Mincho','Yu Mincho',serif;color:#43302A;position:relative;
  background:#F2DBD3;
  background-image:repeating-linear-gradient(115deg, rgba(255,255,255,.28) 0 2px, rgba(255,255,255,0) 2px 14px);
}
.wrap{position:absolute;inset:0;padding:84px 130px 72px;display:flex;flex-direction:column}
.top{flex-shrink:0;display:flex;justify-content:space-between;font-family:'Cormorant Garamond',serif;font-size:34px;letter-spacing:.35em;color:#7A5A48}
.eyebrow{flex-shrink:0;margin-top:46px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:40px;letter-spacing:.3em;color:#9C6A50}
.title{flex-shrink:0;margin-top:8px;font-family:'Cormorant Garamond',serif;font-size:132px;line-height:1.05;color:#3E2C24}
.title .a{font-style:${card.t1Italic ? 'italic' : 'normal'};color:${card.t1Italic ? '#9C6A50' : '#3E2C24'}}
.title .b{font-style:${card.t2Italic ? 'italic' : 'normal'};color:${card.t2Italic ? '#9C6A50' : '#3E2C24'};margin-left:26px}
.sub{flex-shrink:0;margin-top:22px;font-size:34px;letter-spacing:.45em;color:#5C4237}
.hero{flex-shrink:0;margin-top:34px;height:300px;border-radius:150px 150px 14px 14px;overflow:hidden;border:2px solid rgba(122,90,72,.35)}
.hero img{width:100%;height:100%;object-fit:cover;display:block}
.hr{flex-shrink:0;height:2px;background:rgba(122,90,72,.35);margin:30px 0 0}
.cols{display:flex;margin-top:28px;flex:1}
.col{flex:1;padding-right:60px}
.col + .col{border-left:2px solid rgba(122,90,72,.3);padding-left:60px;padding-right:0}
.plan-label{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:38px;letter-spacing:.14em;color:#9C6A50}
.plan-title{margin-top:18px;font-size:52px;font-weight:500;letter-spacing:.12em;line-height:1.5}
.time{margin-top:26px;font-size:30px;letter-spacing:.1em;color:#5C4237}
.regular{margin-top:34px;font-size:30px;color:#8A6A58}
.price{margin-top:6px;font-family:'Cormorant Garamond',serif;font-size:86px;font-weight:500;color:#4A332A;letter-spacing:.02em}
.price-note{font-size:28px;letter-spacing:.35em;color:#7A5A48;margin-top:2px}
.copy{margin-top:44px;font-size:33px;line-height:2;letter-spacing:.14em;color:#5C4237}
.sec-label{margin-top:44px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:33px;letter-spacing:.3em;color:#9C6A50}
.sec-label.opt{letter-spacing:.4em}
.for-lines{margin-top:20px;font-size:31px;line-height:1.9;letter-spacing:.1em;color:#5C4237}
.hr-dot{border-top:2px dotted rgba(122,90,72,.45);margin-top:34px}
.items{margin-top:22px;list-style:none}
.items li{font-size:29px;line-height:1.82;letter-spacing:.04em;color:#4E3931}
.items li::before{content:'˚ ';color:#9C6A50}
.opt-row{display:flex;justify-content:space-between;align-items:baseline;font-size:30px;letter-spacing:.08em;color:#4E3931;margin-top:22px}
.opt-price{font-family:'Cormorant Garamond',serif;font-size:36px}
.opt-title{text-align:center;margin-top:28px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:34px;letter-spacing:.28em;color:#8A6248}
.opt-grid{display:grid;grid-template-columns:1fr 1fr;column-gap:120px;margin-top:8px}
.note{margin-top:26px;font-size:27px;line-height:1.9;letter-spacing:.06em;color:#6B4F41}
.footer{flex-shrink:0;margin-top:auto;padding-top:36px;text-align:center}
.footer .line{height:2px;background:rgba(122,90,72,.35);margin-bottom:34px}
.footer .brand{font-family:'Cormorant Garamond',serif;font-size:36px;letter-spacing:.5em;color:#7A5A48}
.footer .loc{margin-top:10px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:27px;letter-spacing:.35em;color:#A0806C}
</style></head><body>
<div class="wrap">
  <div class="top"><span>${card.planNo}</span><span>${card.page}</span></div>
  <div class="eyebrow">${card.eyebrow}</div>
  <div class="title"><span class="a">${card.t1}</span><span class="b">${card.t2}</span></div>
  <div class="sub">${card.sub}</div>
  <div class="hero"><img src="${HERO(card.hero)}"></div>
  <div class="hr"></div>
  <div class="cols">${card.cols.map(colHtml).join('')}</div>
  ${bottom}
  <div class="footer"><div class="line"></div><div class="brand">USHERIN MAKING</div><div class="loc">Okinawa Wedding · Photo Studio</div></div>
</div>
</body></html>`
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  for (const c of CARDS) {
    const heroPath = join(DIR, 'heroes', `hero-${c.hero}.png`)
    if (!existsSync(heroPath)) { console.error(`히어로 없음: ${heroPath} — gen-heroes.sh 먼저 실행`); process.exit(1) }
  }
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1638, height: 2046 } })
  for (const c of CARDS) {
    const tmp = join(tmpdir(), `uim-${c.file}.html`)
    writeFileSync(tmp, html(c), 'utf-8')
    await page.goto('file://' + tmp, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 1638, height: 2046 } })
    await sharp(buf).resize(819, 1023).png({ compressionLevel: 9 }).toFile(join(OUT, `${c.file}.png`))
    await sharp(buf).png({ compressionLevel: 9 }).toFile(join(OUT, `${c.file}@2x.png`))
    console.log(`✓ ${c.file}.png`)
  }
  await browser.close()
  console.log('DONE →', OUT)
}
main().catch(e => { console.error(e); process.exit(1) })
