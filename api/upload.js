// Vercel Serverless Function — /api/upload
// 管理画面からの画像アップロード（ギャラリー用）。
//
//   - POST /api/upload (要トークン) { filename, data } → { url }
//       filename : 元のファイル名（拡張子の判定・安全化に使用）
//       data     : 画像本体。base64 文字列（"data:image/...;base64,XXXX" 形式も可）。
//
// 保存先は Vercel Blob。環境変数 BLOB_READ_WRITE_TOKEN がある場合のみ @vercel/blob の
// put() で公開（public）アップロードし、その URL を返す。未設定なら 501 を返す
// （契約 v3: { error: "画像アップロードは未設定です（Vercel Blob 未接続）" }）。
//
// トークン検証ロジックは api/admin.js と同じ方式（ADMIN_PASSWORD 由来の HMAC 署名）。

import crypto from 'node:crypto';

// ─── トークン検証（admin.js / content.js と同方式・自己完結） ───────────────
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

// 拡張子 → Content-Type（画像のみ許可）。
const IMAGE_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

// ファイル名を安全化（パス区切りを除去し、英数・ドット・ハイフン・アンダースコアのみ）。
// 衝突回避のためランダム接頭辞を付ける。拡張子は元のものを維持。
function safeName(filename) {
  const base = String(filename || 'image').split(/[\\/]/).pop() || 'image';
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'image';
  const rnd = crypto.randomBytes(6).toString('hex');
  return ext ? `${stem}-${rnd}.${ext}` : `${stem}-${rnd}`;
}

// base64（data URL も許容）を Buffer へ。
function decodeData(data) {
  const s = String(data || '');
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(s);
  const b64 = m ? m[2] : s;
  return Buffer.from(b64.replace(/\s+/g, ''), 'base64');
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    if (!verifyToken(bearer(req))) {
      return res.status(401).json({ error: '認証が必要です。再度ログインしてください。' });
    }

    // Blob 未接続なら 501（契約の固定メッセージ）。
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return res
        .status(501)
        .json({ error: '画像アップロードは未設定です（Vercel Blob 未接続）' });
    }

    const body =
      req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const filename = body.filename;
    const data = body.data;
    if (!data) {
      return res.status(400).json({ error: 'data（base64 の画像データ）は必須です。' });
    }

    const name = safeName(filename);
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
    const contentType = IMAGE_TYPES[ext];
    if (!contentType) {
      return res.status(400).json({
        error: '対応していない画像形式です（jpg / png / webp / gif / avif のみ）。',
      });
    }

    const buf = decodeData(data);
    if (!buf.length) {
      return res.status(400).json({ error: '画像データを読み取れませんでした。' });
    }

    // @vercel/blob は Blob 利用時のみ動的 import（依存未インストール環境でも壊れない）。
    const { put } = await import('@vercel/blob');
    const result = await put(`uploads/${name}`, buf, {
      access: 'public',
      contentType,
      token: blobToken,
    });

    return res.status(200).json({ url: result.url });
  } catch (e) {
    console.error('[upload]', e);
    return res.status(500).json({ error: 'アップロードに失敗しました。' });
  }
}
