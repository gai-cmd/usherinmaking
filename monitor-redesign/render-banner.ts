/**
 * V2(WP 텍스트 버전)용 타이틀 배너 렌더링 — hero-wedding.png 배경 + 브랜드 타이포.
 * 실행: cd ~/work/KC-CRM/kiosk-asset/kiosk-crm && npx tsx ~/personal/works/usherinmaking/monitor-redesign/render-banner.ts
 * 출력: out/monitor-title.png (1600x640)
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'

const DIR = resolve(__dirname)
const HTML = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Zen+Old+Mincho:wght@400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1600px;height:640px;overflow:hidden}
body{position:relative;font-family:'Zen Old Mincho','Yu Mincho',serif}
img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(1.02)}
.veil{position:absolute;inset:0;background:linear-gradient(90deg, rgba(242,219,211,.94) 0%, rgba(242,219,211,.82) 42%, rgba(242,219,211,.12) 100%)}
.inner{position:absolute;inset:0;padding:90px 110px;display:flex;flex-direction:column;justify-content:center}
.eyebrow{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:34px;letter-spacing:.32em;color:#9C6A50}
.title{margin-top:14px;font-family:'Cormorant Garamond',serif;font-size:110px;color:#3E2C24;line-height:1.05}
.title i{color:#9C6A50;margin-left:20px}
.sub{margin-top:22px;font-size:30px;letter-spacing:.5em;color:#5C4237}
.brand{margin-top:46px;font-family:'Cormorant Garamond',serif;font-size:26px;letter-spacing:.5em;color:#7A5A48}
</style></head><body>
<img class="bg" src="file://${join(DIR, 'heroes', 'hero-wedding.png')}">
<div class="veil"></div>
<div class="inner">
  <div class="eyebrow">Special Monitor Plan</div>
  <div class="title">Monitor <i>Recruitment</i></div>
  <div class="sub">モニター募集 ・ 撮影プランのご案内</div>
  <div class="brand">USHERIN MAKING — OKINAWA</div>
</div>
</body></html>`

async function main() {
  mkdirSync(join(DIR, 'out'), { recursive: true })
  const tmp = join(tmpdir(), 'uim-banner.html')
  writeFileSync(tmp, HTML, 'utf-8')
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 640 } })
  await page.goto('file://' + tmp, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 1600, height: 640 } })
  await sharp(buf).png({ compressionLevel: 9 }).toFile(join(DIR, 'out', 'monitor-title.png'))
  await browser.close()
  console.log('✓ out/monitor-title.png')
}
main().catch(e => { console.error(e); process.exit(1) })
