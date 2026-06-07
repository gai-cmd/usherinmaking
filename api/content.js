// Vercel Serverless Function — /api/content
// サイトの編集可能コンテンツ（プラン・料金・お知らせ・スタジオ情報・トップ・イベント・
// ギャラリー）の取得／保存。
//
//   - GET  /api/content                → 公開可。現在のコンテンツを返す。
//   - POST /api/content (要トークン)    → コンテンツを部分マージ保存。
//
// トークン検証ロジックは api/admin.js と同じ方式（ADMIN_PASSWORD 由来の HMAC 署名）。
// コンテンツの保存先は api/_lib/store.js が一元管理（KV があれば KV、無ければ /tmp JSON）。
// キーは KEYS.content（"uim:content"）。
//
// ── 多言語（契約 v3） ──
//   多言語対象フィールド（notice.text / hero.* / event.title,body,period /
//   plans[].name,description / galleries item.caption）は { ja, en } オブジェクトで保存する。
//   後方互換: 既存の文字列値は読み出し時に { ja:値, en:"" } へ正規化。
//   POST は文字列・オブジェクトどちらも受け付け、保存はオブジェクトに統一する。
//
// 注意: 保存先の正規化（_lib/store.js の normalizeContent）は v1 キー（notice/plans/
//   blockedDates/capacityPerDay）のみ通し、しかも多言語フィールドを文字列前提で
//   扱う（オブジェクトを潰してしまう）。そのため多言語フィールドおよび v2/v3 フィールド
//   （studio/hero/event/galleries）は「raw（生の保存値）」から読み戻して補完する
//   （store.js は契約上このエージェントの所有外＝変更しない）。

import crypto from 'node:crypto';
import store, { KEYS, normalizePlan } from './_lib/store.js';

// ─── トークン検証（admin.js と同方式・自己完結） ───────────────────────
function secret() {
  return process.env.ADMIN_PASSWORD || '';
}
function verifyToken(token) {
  if (!token || !secret()) return false;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return false;
  let exp;
  try {
    exp = Buffer.from(payload, 'base64url').toString();
  } catch {
    return false;
  }
  const expected = crypto.createHmac('sha256', secret()).update(exp).digest('base64url');
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Date.now() < Number(exp);
}
function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isHttpUrl = (s) => /^https?:\/\/.+/i.test(s);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// ─── 多言語（i18n）ヘルパ ─────────────────────────────────────────────────
// 読み出し: 文字列なら { ja:値, en:"" }、{ja,en} オブジェクトはそのまま整形、その他は空。
function toI18n(v) {
  if (typeof v === 'string') return { ja: v, en: '' };
  if (isPlainObject(v)) {
    return {
      ja: typeof v.ja === 'string' ? v.ja : '',
      en: typeof v.en === 'string' ? v.en : '',
    };
  }
  return { ja: '', en: '' };
}
// 保存用バリデーション: 文字列／{ja,en} オブジェクトの両方を許可し、{ja,en} に統一。
function validateI18n(v, label, maxlen) {
  if (typeof v === 'string') {
    if (v.length > maxlen) return { error: `${label}은(는) ${maxlen}자 이내로 입력해 주세요.` };
    return { value: { ja: v, en: '' } };
  }
  if (isPlainObject(v)) {
    const ja = v.ja == null ? '' : v.ja;
    const en = v.en == null ? '' : v.en;
    if (typeof ja !== 'string' || typeof en !== 'string')
      return { error: `${label}의 ja / en은 문자열로 지정해 주세요.` };
    if (ja.length > maxlen || en.length > maxlen)
      return { error: `${label}은(는) ${maxlen}자 이내로 입력해 주세요.` };
    return { value: { ja, en } };
  }
  return { error: `${label}은(는) 문자열 또는 { ja, en } 객체로 지정해 주세요.` };
}

// ─── 既定値（契約 v2 / v3） ───────────────────────────────────────────────
// studio は契約記載の実運用リンクを既定値とする（email のみ空）。
const STUDIO_DEFAULTS = {
  line: 'https://line.me/ti/p/8Udy1kYg1l',
  instagram: 'https://www.instagram.com/usherinmaking/',
  kakao: 'http://qr.kakao.com/talk/YdBfdGeaBd1EXL3ZVVpEJrSpzMU-',
  blog: 'https://blog.naver.com/usherinmaking/',
  email: '',
};
const STUDIO_KEYS = ['line', 'instagram', 'kakao', 'blog', 'email'];
const HERO_KEYS = ['eyebrow', 'title', 'subtitle'];
const HERO_MAXLEN = 200;
const EVENT_MAXLEN = { title: 200, body: 2000, period: 200 };

// galleries の既定値（契約 v3）。
//   index.html .grid-3 → top / index.html .dress-grid → top-dress、
//   wedding.html・anniversary.html の一覧から実 src/href/alt(aria-label) を抽出（ダミー無し）。
const GALLERY_SLOTS = ['top', 'top-dress', 'wedding', 'anniversary'];
const GALLERY_MAX_ITEMS = 100;
const CAPTION_MAXLEN = 300;
const gi = (href, src, ja) => ({ href, src, caption: { ja, en: '' }, visible: true });

const GALLERIES_DEFAULTS = {
  // index.html .grid-3（BEST GALLERY）
  top: {
    items: [
      gi('gallery-hare-8.html', '/images/up/0f62c6d466bcea42.jpg', '晴れの日、8月'),
      gi('gallery-self-8.html', '/images/up/1440241c37bf4fc2.jpg', '8月'),
      gi('gallery-family-753.html', '/images/up/ddf6db884e95f47c.jpg', '七五三お祝い'),
      gi('gallery-date.html', '/images/up/441db675bf47ff78.jpg', 'デート'),
      gi('gallery-11.html', '/images/up/c0aa505600aa3595.jpg', '11月'),
      gi('gallery-family.html', '/images/up/934c72ebb62d141a.jpg', '家族'),
      gi('gallery-date-rain.html', '/images/up/ddb78d75fc3e564b.jpg', 'デート雨天'),
      gi('gallery-jp-couple-6.html', '/images/up/934c72ebb62d141a.jpg', '6月日本カップル'),
      gi('gallery-couple-7.html', '/images/up/ddb78d75fc3e564b.jpg', '7月末'),
    ],
  },
  // index.html .dress-grid（DRESS）— href は各ドレス詳細、caption は figcaption。
  'top-dress': {
    items: [
      gi('dress-annabel-white.html', '/images/up/125ebeb8a1ff8f2f.jpg', 'Annabel White no6'),
      gi('dress-retro-vintage.html', '/images/up/88bb2fa2324d0f0b.jpg', 'Retro Vintage no10'),
      gi('dress-hanabi-vintage-line.html', '/images/up/bf0bdba5f25d2240.jpg', 'Hanabi Vintage Line no.11'),
      gi('dress-nanimo.html', '/images/up/7cf534ee31de45a3.jpg', 'Nanimo no.8'),
      gi('dress-roco-29.html', '/images/up/69e756294af52788.jpg', 'Roco no.29'),
      gi('dress-yure-30.html', '/images/up/0170d5a0e7228d65.jpg', 'Yure no.30'),
      gi('dress-abreel.html', '/images/up/f7e613903062fc5f.jpg', 'Abreel no.31'),
      gi('dress-wearable-33.html', '/images/up/af3d4e76ed26d175.jpg', 'Wearable no.33'),
    ],
  },
  // wedding.html .grid-3（caption は aria-label の表示用テキスト）
  wedding: {
    items: [
      gi('gallery-wedding.html', '/images/up/d2cea40222d726a2.jpg', 'ウェディング'),
      gi('gallery-kumori-1.html', '/images/up/7f3a93c9ed2abf5a.jpg', '曇り1月'),
      gi('gallery-sakura-2.html', '/images/up/d81eedbad6629b6a.jpg', '2月、桜'),
      gi('gallery-hare-9.html', '/images/up/adba32345d8088a3.jpg', '晴れの日、9月'),
      gi('gallery-hare-8.html', '/images/up/47177e2ce77ce08f.jpg', '晴れの日、8月'),
      gi('gallery-hare-7.html', '/images/up/5ac90f99e0b9da72.jpg', '晴れの日、7月'),
      gi('gallery-hare-7.html', '/images/up/668eeefd578b0074.jpg', '晴れの日、7月'),
      gi('gallery-hare-6.html', '/images/up/4fdd3ce4ceea354f.jpg', '晴れの日、6月'),
      gi('gallery-hare-4.html', '/images/up/7a04d11349f84612.jpg', '晴れの日、4月'),
      gi('gallery-hare-3.html', '/images/up/dfc72117f85239be.jpg', '晴れの日、3月'),
      gi('gallery-self-8.html', '/images/up/bc8441cbb6f71115.jpg', '8月'),
      gi('gallery-x11.html', '/images/up/ddf6db884e95f47c.jpg', '晴れの日、2月'),
      gi('gallery-11.html', '/images/up/9f6de30fc830219f.jpg', '11月'),
      gi('gallery-x13.html', '/images/up/934c72ebb62d141a.jpg', '晴れの日、5月'),
      gi('gallery-jp-couple-6.html', '/images/up/ddb78d75fc3e564b.jpg', '6月日本カップル'),
      gi('gallery-couple-7.html', '/images/up/ddb78d75fc3e564b.jpg', '7月末'),
    ],
  },
  // anniversary.html .grid-3（caption は alt）
  anniversary: {
    items: [
      gi('gallery-family-753.html', '/images/up/c0b3aaba138a3a5b.jpg', '七五三お祝い'),
      gi('gallery-family-753.html', '/images/up/1546d58a82ff1085.jpg', '七五三お祝い'),
      gi('gallery-family-753.html', '/images/up/3612b88186188d50.jpg', '七五三お祝い'),
      gi('gallery-x17.html', '/images/up/4826dd24056c1972.jpg', 'マタニティー沖縄'),
      gi('gallery-x18.html', '/images/up/d660c6bfe5f8c65e.jpg', 'マタニティー'),
      gi('gallery-date.html', '/images/up/eb266be7d3ec106a.jpg', 'デート'),
      gi('gallery-x20.html', '/images/up/e009fb30ddd45537.jpg', 'デートサンセット'),
      gi('gallery-date.html', '/images/up/0f62c6d466bcea42.jpg', 'デート'),
      gi('gallery-family-753.html', '/images/up/1440241c37bf4fc2.jpg', '七五三お祝い'),
      gi('gallery-date.html', '/images/up/441db675bf47ff78.jpg', 'デート'),
      gi('gallery-family.html', '/images/up/c0aa505600aa3595.jpg', '家族'),
      gi('gallery-date-rain.html', '/images/up/b9aef876a3ebddb5.jpg', 'デート雨天'),
    ],
  },
};

// ─── GET 用: raw を契約どおりの完全な構造へ補完（多言語は {ja,en} に正規化） ───
function fillStudio(raw) {
  const s = isPlainObject(raw) ? raw : {};
  const out = { ...STUDIO_DEFAULTS };
  for (const k of STUDIO_KEYS) if (typeof s[k] === 'string') out[k] = s[k];
  return out;
}
function fillHero(raw) {
  const h = isPlainObject(raw) ? raw : {};
  const out = {};
  for (const k of HERO_KEYS) out[k] = toI18n(h[k]);
  return out;
}
function fillEvent(raw) {
  const e = isPlainObject(raw) ? raw : {};
  return {
    enabled: e.enabled === true,
    title: toI18n(e.title),
    body: toI18n(e.body),
    period: toI18n(e.period),
  };
}
// 과거 시드 데이터의 알려진 오류를 읽기 시점에 자동 교정한다(레거시 마이그레이션).
// KV에 옛 값이 저장돼 있어도 GET은 항상 교정본을 반환하고, 다음 저장 때 영구 반영된다.
//   - anniversary의 デート雨天(date-rain) 카드가 家族 카드와 같은 썸네일을 쓰던 중복 (2026-06-07 수정)
const LEGACY_GALLERY_FIXES = [
  {
    slot: 'anniversary',
    href: 'gallery-date-rain.html',
    oldSrc: '/images/up/c0aa505600aa3595.jpg',
    newSrc: '/images/up/b9aef876a3ebddb5.jpg',
  },
];
function applyLegacyGalleryFixes(slot, items) {
  for (const f of LEGACY_GALLERY_FIXES) {
    if (f.slot !== slot) continue;
    for (const it of items) {
      if (it.href === f.href && it.src === f.oldSrc) it.src = f.newSrc;
    }
  }
  return items;
}
function fillGalleries(raw) {
  const g = isPlainObject(raw) ? raw : {};
  const out = {};
  for (const slot of GALLERY_SLOTS) {
    const sv = isPlainObject(g[slot]) ? g[slot] : null;
    const items = sv && Array.isArray(sv.items) ? sv.items : GALLERIES_DEFAULTS[slot].items;
    out[slot] = { items: applyLegacyGalleryFixes(slot, items.map(fillGalleryItem)) };
  }
  return out;
}
function fillGalleryItem(it) {
  const o = isPlainObject(it) ? it : {};
  return {
    src: typeof o.src === 'string' ? o.src : '',
    href: typeof o.href === 'string' ? o.href : '',
    caption: toI18n(o.caption),
    visible: o.visible !== false,
  };
}
// notice / plans は store.getContent() が v1 正規化済みの土台を返すが、多言語フィールド
// （text / name / description）は文字列前提で潰されるため raw から読み戻して補完する。
function fillNotice(baseNotice, raw) {
  const rn = raw && isPlainObject(raw.notice) ? raw.notice : null;
  return {
    enabled: baseNotice.enabled,
    text: toI18n(rn ? rn.text : baseNotice.text),
    link: baseNotice.link,
  };
}
function fillPlans(basePlans, raw) {
  const rp = raw && Array.isArray(raw.plans) ? raw.plans : null;
  return basePlans.map((p, i) => {
    const r = rp ? rp[i] : null;
    return {
      ...p,
      name: toI18n(r ? r.name : p.name),
      description: toI18n(r ? r.description : p.description),
    };
  });
}

// 土台（store の v1 正規化結果）と raw から、契約どおりの完全なコンテンツを構築。
// GET の返却・POST のマージ起点の両方で使う（未指定フィールドが消えないように）。
function hydrate(base, raw) {
  return {
    notice: fillNotice(base.notice, raw),
    plans: fillPlans(base.plans, raw),
    blockedDates: base.blockedDates,
    capacityPerDay: base.capacityPerDay,
    studio: fillStudio(raw && raw.studio),
    hero: fillHero(raw && raw.hero),
    event: fillEvent(raw && raw.event),
    galleries: fillGalleries(raw && raw.galleries),
    updatedAt: base.updatedAt,
  };
}

// ─── POST バリデーション（各関数は { value } か { error } を返す） ─────────────
function validateNotice(v) {
  if (!isPlainObject(v)) return { error: 'notice는 객체 형식으로 지정해 주세요.' };
  const r = validateI18n(v.text == null ? '' : v.text, 'notice.text', 2000);
  if (r.error) return r;
  return {
    value: {
      enabled: v.enabled === true,
      text: r.value,
      link: (v.link == null ? '' : String(v.link)).slice(0, 500),
    },
  };
}

function validatePlans(v) {
  if (!Array.isArray(v)) return { error: 'plans는 배열로 지정해 주세요.' };
  if (v.length > 50) return { error: 'plans는 최대 50건까지입니다.' };
  const out = [];
  for (let i = 0; i < v.length; i++) {
    const p = v[i];
    if (!isPlainObject(p))
      return { error: `plans[${i}]은(는) 객체 형식으로 지정해 주세요.` };
    const nameR = validateI18n(p.name == null ? '' : p.name, `plans[${i}].name`, 120);
    if (nameR.error) return nameR;
    if (!nameR.value.ja.trim() && !nameR.value.en.trim())
      return { error: `plans[${i}]의 name(플랜 이름)은 필수입니다.` };
    if (!String(p.price || '').trim())
      return { error: `plans[${i}]의 price(요금)는 필수입니다.` };
    const descR = validateI18n(p.description == null ? '' : p.description, `plans[${i}].description`, 600);
    if (descR.error) return descR;
    // id / price / duration / includes / featured は store の正規化を流用、name/description は i18n で上書き。
    const baseP = normalizePlan(p, i);
    out.push({ ...baseP, name: nameR.value, description: descR.value });
  }
  return { value: out };
}

function validateBlockedDates(v) {
  if (!Array.isArray(v)) return { error: 'blockedDates는 배열로 지정해 주세요.' };
  for (const d of v) {
    if (!isYmd(d))
      return { error: 'blockedDates는 YYYY-MM-DD 형식의 날짜만 지정할 수 있습니다.' };
  }
  return { value: Array.from(new Set(v)).sort() };
}

function validateCapacity(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1)
    return { error: 'capacityPerDay는 1 이상의 정수로 지정해 주세요.' };
  return { value: Math.floor(n) };
}

// studio は文字列（URL / メール）のみ。既存値に対しキー単位で部分マージ。
function validateStudio(existing, patch) {
  if (!isPlainObject(patch))
    return { error: 'studio는 객체 형식으로 지정해 주세요.' };
  const out = { ...existing };
  for (const k of STUDIO_KEYS) {
    if (!(k in patch)) continue;
    const val = patch[k];
    if (typeof val !== 'string')
      return { error: `studio.${k}은(는) 문자열(빈 문자열 또는 URL)로 지정해 주세요.` };
    const s = val.trim();
    if (s === '') {
      out[k] = '';
      continue;
    }
    if (k === 'email') {
      if (!isEmail(s)) return { error: 'studio.email은 이메일 주소 형식으로 지정해 주세요.' };
      out[k] = s.slice(0, 200);
    } else {
      if (!isHttpUrl(s))
        return { error: `studio.${k}은(는) http:// 또는 https://로 시작하는 URL을 지정해 주세요.` };
      out[k] = s.slice(0, 500);
    }
  }
  return { value: out };
}

function validateHero(existing, patch) {
  if (!isPlainObject(patch))
    return { error: 'hero는 객체 형식으로 지정해 주세요.' };
  const out = { ...existing };
  for (const k of HERO_KEYS) {
    if (!(k in patch)) continue;
    const r = validateI18n(patch[k], `hero.${k}`, HERO_MAXLEN);
    if (r.error) return r;
    out[k] = r.value;
  }
  return { value: out };
}

function validateEvent(existing, patch) {
  if (!isPlainObject(patch))
    return { error: 'event는 객체 형식으로 지정해 주세요.' };
  const out = { ...existing };
  if ('enabled' in patch) {
    if (typeof patch.enabled !== 'boolean')
      return { error: 'event.enabled는 true / false로 지정해 주세요.' };
    out.enabled = patch.enabled;
  }
  for (const k of ['title', 'body', 'period']) {
    if (!(k in patch)) continue;
    const r = validateI18n(patch[k], `event.${k}`, EVENT_MAXLEN[k]);
    if (r.error) return r;
    out[k] = r.value;
  }
  return { value: out };
}

// galleries: スロット単位で部分マージ（指定スロットのみ items 配列を丸ごと置換）。
//   許可スロットは GALLERY_SLOTS の4種のみ。item は src 必須（/images/ か https://）、
//   visible は boolean（省略時 true）、caption は {ja,en} に正規化。
function validateGalleries(existing, patch) {
  if (!isPlainObject(patch))
    return { error: 'galleries는 객체 형식으로 지정해 주세요.' };
  for (const k of Object.keys(patch)) {
    if (!GALLERY_SLOTS.includes(k))
      return { error: `galleries의 슬롯은 ${GALLERY_SLOTS.join(' / ')}만 지정할 수 있습니다.` };
  }
  const out = { ...existing };
  for (const slot of GALLERY_SLOTS) {
    if (!(slot in patch)) continue;
    const sv = patch[slot];
    if (!isPlainObject(sv) || !Array.isArray(sv.items))
      return { error: `galleries.${slot}은(는) { items: [...] } 형식으로 지정해 주세요.` };
    if (sv.items.length > GALLERY_MAX_ITEMS)
      return { error: `galleries.${slot}의 items는 최대 ${GALLERY_MAX_ITEMS}건까지입니다.` };
    const items = [];
    for (let i = 0; i < sv.items.length; i++) {
      const it = sv.items[i];
      if (!isPlainObject(it))
        return { error: `galleries.${slot}.items[${i}]은(는) 객체 형식으로 지정해 주세요.` };
      const src = String(it.src == null ? '' : it.src).trim();
      if (!(src.startsWith('/images/') || /^https:\/\//i.test(src)))
        return {
          error: `galleries.${slot}.items[${i}].src는 /images/ 또는 https://로 시작해야 합니다.`,
        };
      if ('visible' in it && typeof it.visible !== 'boolean')
        return { error: `galleries.${slot}.items[${i}].visible은(는) true / false로 지정해 주세요.` };
      const capR = validateI18n(
        it.caption == null ? '' : it.caption,
        `galleries.${slot}.items[${i}].caption`,
        CAPTION_MAXLEN
      );
      if (capR.error) return capR;
      items.push({
        src: src.slice(0, 500),
        href: (it.href == null ? '' : String(it.href)).slice(0, 300),
        caption: capR.value,
        visible: it.visible !== false,
      });
    }
    out[slot] = { items };
  }
  return { value: out };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // 公開: サイト表示用にも使えるよう認証不要。基本構造を必ず保証（後方互換正規化込み）。
      const base = await store.getContent();
      const raw = await store.get(KEYS.content, null);
      return res.status(200).json(hydrate(base, raw));
    }

    if (req.method === 'POST') {
      if (!verifyToken(bearer(req))) {
        return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해 주세요.' });
      }
      const body =
        req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');

      // 現在のコンテンツ（多言語・v2/v3 を含む完全な構造）を起点に「部分マージ」。
      // hydrate により未指定フィールドはオブジェクト形のまま保持され、保存時に消えない。
      const current = await store.getContent();
      const raw = await store.get(KEYS.content, null);
      const next = hydrate(current, raw);

      if ('notice' in body) {
        const r = validateNotice(body.notice);
        if (r.error) return res.status(400).json({ error: r.error });
        next.notice = r.value;
      }
      if ('plans' in body) {
        const r = validatePlans(body.plans);
        if (r.error) return res.status(400).json({ error: r.error });
        next.plans = r.value;
      }
      if ('blockedDates' in body) {
        const r = validateBlockedDates(body.blockedDates);
        if (r.error) return res.status(400).json({ error: r.error });
        next.blockedDates = r.value;
      }
      if ('capacityPerDay' in body) {
        const r = validateCapacity(body.capacityPerDay);
        if (r.error) return res.status(400).json({ error: r.error });
        next.capacityPerDay = r.value;
      }
      if ('studio' in body) {
        const r = validateStudio(next.studio, body.studio);
        if (r.error) return res.status(400).json({ error: r.error });
        next.studio = r.value;
      }
      if ('hero' in body) {
        const r = validateHero(next.hero, body.hero);
        if (r.error) return res.status(400).json({ error: r.error });
        next.hero = r.value;
      }
      if ('event' in body) {
        const r = validateEvent(next.event, body.event);
        if (r.error) return res.status(400).json({ error: r.error });
        next.event = r.value;
      }
      if ('galleries' in body) {
        const r = validateGalleries(next.galleries, body.galleries);
        if (r.error) return res.status(400).json({ error: r.error });
        next.galleries = r.value;
      }
      next.updatedAt = new Date().toISOString();

      try {
        await store.set(KEYS.content, next);
      } catch (e) {
        console.error('[content] write failed (read-only fs?)', e);
        return res
          .status(500)
          .json({ error: '저장에 실패했습니다. 운영 환경에서는 Vercel KV를 사용해 주세요.' });
      }
      return res.status(200).json({ ok: true, content: next });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('[content]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
