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
import { verifyToken } from './_lib/auth.js';

// ─── トークン検証は api/_lib/auth.js に集約（ADMIN_TOKEN_SECRET / ADMIN_PASSWORD 由来） ───

// アップロード上限（base64 デコード後の実バイト数）。bodyParser の sizeLimit と整合。
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// 受信ボディは base64 で肥大化するため bodyParser の上限を引き上げる。
export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

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

// マジックバイト（先頭シグネチャ）が拡張子の主張する画像形式と一致するか検証。
//   JPEG: FF D8 FF / PNG: 89 50 4E 47 / GIF: 47 49 46 38 /
//   WEBP: "RIFF"....「WEBP」/ AVIF: 'ftyp' ボックスの brand に avif/avis 等。
function sniffMatches(buf, contentType) {
  if (!buf || buf.length < 12) return false;
  const b = buf;
  switch (contentType) {
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case 'image/gif':
      return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
    case 'image/webp':
      // "RIFF" .... "WEBP"
      return (
        b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
      );
    case 'image/avif':
      // ISO-BMFF: 4byte size + 'ftyp' + brand。brand に avif/avis を許容。
      if (b.toString('ascii', 4, 8) !== 'ftyp') return false;
      return /avif|avis|mif1|miaf/.test(b.toString('ascii', 8, 12));
    default:
      return false;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    if (!verifyToken(req)) {
      return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해 주세요.' });
    }

    // Blob 未接続なら 501（契約の固定メッセージ）。
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return res
        .status(501)
        .json({ error: '이미지 업로드가 설정되지 않았습니다 (Vercel Blob 미연결)' });
    }

    const body =
      req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const filename = body.filename;
    const data = body.data;
    if (!data) {
      return res.status(400).json({ error: 'data(base64 이미지 데이터)는 필수입니다.' });
    }

    const name = safeName(filename);
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
    const contentType = IMAGE_TYPES[ext];
    if (!contentType) {
      return res.status(400).json({
        error: '지원하지 않는 이미지 형식입니다 (jpg / png / webp / gif / avif만 가능).',
      });
    }

    const buf = decodeData(data);
    if (!buf.length) {
      return res.status(400).json({ error: '이미지 데이터를 읽을 수 없습니다.' });
    }
    // サイズ上限（デコード後の実バイト数）。
    if (buf.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: '이미지 용량이 너무 큽니다 (최대 8MB).' });
    }
    // マジックバイト検証（拡張子の偽装を弾く）。
    if (!sniffMatches(buf, contentType)) {
      return res
        .status(415)
        .json({ error: '파일 내용이 이미지 형식과 일치하지 않습니다.' });
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
    return res.status(500).json({ error: '업로드에 실패했습니다.' });
  }
}
