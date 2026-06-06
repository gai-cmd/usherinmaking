// api/_lib/store.js — 単一の保存抽象（お問い合わせ／ご予約／コンテンツ）
// ---------------------------------------------------------------------------
// すべての API 関数（contact / reservations / admin / content）がこのモジュール
// を通して読み書きすることで、保存先・キー・スキーマを一元化する。
// （以前は contact が /tmp/inquiries.json、admin が /tmp/uim_contacts.json …と
//   バラバラで、管理画面に実データが出ない不具合があった。ここで統一する。）
//
// 保存先の自動選択:
//   - 環境変数 KV_REST_API_URL / KV_REST_API_TOKEN が両方あれば Vercel KV を使用（永続）。
//   - 無ければ os.tmpdir() の JSON ファイルにフォールバック（サーバーレスでは揮発性）。
//
// 共通キー（KEYS）:
//   uim:contacts / uim:reservations / uim:content
//
// 公開 API（すべて Promise を返す）:
//   get(key, fallback)   … 単一の値を取得（コンテンツ等のオブジェクト向け）
//   set(key, value)      … 値を上書き保存
//   list(key)            … 配列として取得（無ければ []）
//   push(key, entry)     … 配列に1件追記（お問い合わせ／予約の受付向け）
//   genId(prefix)        … 衝突しにくい ID を発行
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';

// 共通キー（書き込み側・読み出し側で必ずこれを使う）
export const KEYS = {
  contacts: 'uim:contacts',
  reservations: 'uim:reservations',
  content: 'uim:content',
};

// ─── ステータスの正規化（後方互換） ─────────────────────────────────────────
//   古いレコード（status 無し）を読むときに既定値を補う。
//   契約: お問い合わせ new|read|replied / ご予約 pending|confirmed|cancelled
export const CONTACT_STATUSES = ['new', 'read', 'replied'];
export const RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled'];

export function normalizeContact(c) {
  if (!c || typeof c !== 'object') return c;
  const status = CONTACT_STATUSES.includes(c.status) ? c.status : 'new';
  return { ...c, status, updatedAt: c.updatedAt || c.createdAt || '' };
}
export function normalizeReservation(r) {
  if (!r || typeof r !== 'object') return r;
  const status = RESERVATION_STATUSES.includes(r.status) ? r.status : 'pending';
  return { ...r, status, updatedAt: r.updatedAt || r.createdAt || '' };
}

// ─── コンテンツ既定値（plan.html の実プランから抽出。ダミー／SEED 無し） ─────
//   store にコンテンツが無いとき GET /api/content が返す土台。
const isYmdStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const DEFAULT_CONTENT = {
  notice: { enabled: false, text: '', link: '' },
  plans: [
    {
      id: 'wedding-simple',
      name: 'ウェディングフォト Simple',
      price: '¥76,000(税込)',
      duration: '撮影時間 1時間 / 1ヶ所',
      includes: ['お渡し写真原本全データ200カット以上', '詳細編集30カット'],
      description: '1か所で撮影、日中のみ',
      featured: false,
    },
    {
      id: 'wedding-basic',
      name: 'ウェディングフォト Basic',
      price: '¥100,000(税込)',
      duration: '撮影時間 2時間ほど',
      includes: ['お渡し写真原本全データ400カット以上', '詳細編集40カット'],
      description: '2か所で撮影 日中又は遅い午後からサンセット時間まで可能',
      featured: true,
    },
    {
      id: 'wedding-afterfull',
      name: 'ウェディングフォト Afterfull',
      price: '¥128,000(税込)',
      duration: '撮影時間 3時間半ほど',
      includes: ['お渡し写真原本全データ600カット以上', '詳細編集50カット'],
      description: '3か所で撮影 日中、サンセット、夜景まで可能',
      featured: false,
    },
    {
      id: 'memorial-standard',
      name: '記念写真 Standard',
      price: '¥38,000(税込)',
      duration: '撮影時間 1時間',
      includes: ['お渡し写真原本全データ200カット以上', '色補正20カット'],
      description: '1か所で撮影 日中のみ',
      featured: false,
    },
    {
      id: 'memorial-half',
      name: '記念写真 Half',
      price: '¥60,000(税込)',
      duration: '撮影時間 2時間',
      includes: ['お渡し写真原本全データ400カット以上', '色補正30カット'],
      description: '2か所で撮影 日中又は遅い午後からサンセット時間まで可能',
      featured: false,
    },
  ],
  blockedDates: [],
  capacityPerDay: 1,
  updatedAt: '',
};

// プラン1件を安全な形に整える（読み出し・保存の両方で利用）。
export function normalizePlan(p, i = 0) {
  const o = p && typeof p === 'object' ? p : {};
  return {
    id: String(o.id || `plan-${i + 1}`).slice(0, 60),
    name: String(o.name || '').slice(0, 120),
    price: String(o.price || '').slice(0, 60),
    duration: String(o.duration || '').slice(0, 120),
    includes: Array.isArray(o.includes)
      ? o.includes.map((x) => String(x).slice(0, 200)).slice(0, 30)
      : [],
    description: String(o.description || '').slice(0, 600),
    featured: o.featured === true,
  };
}

// 保存済みコンテンツを契約どおりの構造に正規化（欠損キーを補完）。
export function normalizeContent(obj) {
  const src = obj && typeof obj === 'object' ? obj : {};
  const n = src.notice && typeof src.notice === 'object' ? src.notice : {};
  const cap = Number(src.capacityPerDay);
  return {
    notice: {
      enabled: n.enabled === true,
      text: typeof n.text === 'string' ? n.text : '',
      link: typeof n.link === 'string' ? n.link : '',
    },
    plans: Array.isArray(src.plans) ? src.plans.map((p, i) => normalizePlan(p, i)) : [],
    blockedDates: Array.isArray(src.blockedDates)
      ? Array.from(new Set(src.blockedDates.filter(isYmdStr))).sort()
      : [],
    capacityPerDay: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 1,
    updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt : '',
  };
}

// コンテンツ取得（store が空なら既定コンテンツ＝実プランを返す）。
export async function getContent() {
  const raw = await get(KEYS.content, null);
  if (raw == null) {
    const envCap = Number(process.env.RESERVE_DAILY_CAPACITY);
    return {
      ...DEFAULT_CONTENT,
      plans: DEFAULT_CONTENT.plans.map((p) => ({ ...p, includes: [...p.includes] })),
      capacityPerDay: Number.isFinite(envCap) && envCap > 0 ? Math.floor(envCap) : 1,
    };
  }
  return normalizeContent(raw);
}

// KV を使うかどうか（両方の env が揃っているときのみ）
const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// @vercel/kv は KV 利用時のみ動的 import（依存未インストールの環境でも壊れない）
let _kv = null;
async function kvClient() {
  if (_kv) return _kv;
  const mod = await import('@vercel/kv');
  _kv = mod.kv;
  return _kv;
}

// ─── /tmp JSON フォールバック ───────────────────────────────────────────────
// キー（"uim:contacts"）を安全なファイル名（"uim_contacts.json"）へ変換。
function fileFor(key) {
  const safe = String(key).replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  return path.join(os.tmpdir(), `${safe}.json`);
}

function readFile(key, fallback) {
  try {
    const raw = fs.readFileSync(fileFor(key), 'utf8');
    const data = JSON.parse(raw);
    return data == null ? fallback : data;
  } catch {
    return fallback; // 未作成 / 読み込み失敗
  }
}

function writeFile(key, value) {
  // read-only fs の可能性もあるが、ここでは例外を呼び出し側へ伝える。
  fs.writeFileSync(fileFor(key), JSON.stringify(value, null, 2));
}

// ─── 公開 API ────────────────────────────────────────────────────────────
export async function get(key, fallback = null) {
  if (useKV) {
    const kv = await kvClient();
    const v = await kv.get(key);
    return v == null ? fallback : v;
  }
  return readFile(key, fallback);
}

export async function set(key, value) {
  if (useKV) {
    const kv = await kvClient();
    await kv.set(key, value);
    return value;
  }
  writeFile(key, value);
  return value;
}

export async function list(key) {
  const v = await get(key, []);
  return Array.isArray(v) ? v : [];
}

export async function push(key, entry) {
  // ⚠️ 原子性の限界（read → 変更 → write）:
  //   配列を丸ごと get → push → set するため、同一キーへほぼ同時に2件の書き込みが
  //   来ると、後勝ちで片方を取りこぼす可能性がある（低トラフィック想定の簡易実装）。
  //   厳密な原子性が必要になったら、Vercel KV のリスト型（rpush / lrange）へ移行するか、
  //   楽観ロック（バージョン番号付き set）／キュー化を検討すること。
  const arr = await list(key);
  arr.push(entry);
  await set(key, arr);
  return entry;
}

// 受付 ID 発行（crypto。失敗時はタイムスタンプ＋乱数にフォールバック）
export function genId(prefix = 'id') {
  try {
    return `${prefix}_${randomBytes(6).toString('hex')}`;
  } catch {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

export default {
  KEYS,
  get,
  set,
  list,
  push,
  genId,
  // ステータス／コンテンツ補助
  CONTACT_STATUSES,
  RESERVATION_STATUSES,
  normalizeContact,
  normalizeReservation,
  normalizePlan,
  normalizeContent,
  getContent,
  DEFAULT_CONTENT,
};
