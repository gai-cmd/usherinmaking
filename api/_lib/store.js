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

export default { KEYS, get, set, list, push, genId };
