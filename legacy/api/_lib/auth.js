// api/_lib/auth.js — 管理者トークンの署名・検証を一元化
// ---------------------------------------------------------------------------
// 以前は admin / content / pages / seo / rebuild / upload の各モジュールが
// 同一のトークン署名・検証ロジックを重複して持っていた。ここに集約する。
//
// 形式（ワイヤーフォーマットは従来と同一を維持）:
//   base64url(exp).hmacSHA256(exp, secret)
//
// 秘密鍵（secret）:
//   ADMIN_TOKEN_SECRET を優先し、無ければ ADMIN_PASSWORD にフォールバック（後方互換）。
//   いずれも未設定ならトークンは一切有効化されない（＝署名・検証とも失敗）。
//
// 公開 API:
//   signToken(ttlMs)     … 有効期限 ttlMs のトークンを発行
//   verifyToken(req)     … Authorization: Bearer を読み、検証結果を boolean で返す
//   safeEqual(a, b)      … 定数時間の文字列比較（長さ差で早期 return しない）
//   getSecret()          … 現在の秘密鍵（ログイン照合は ADMIN_PASSWORD を直接使う）
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

// 秘密鍵: 専用シークレットを優先、無ければパスワードへフォールバック。
export function getSecret() {
  return process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || '';
}

// 定数時間比較。両辺を sha256 でハッシュしてから比較するため、
// 長さの違いで早期 return せず（length leak を避ける）、常に同コストで判定する。
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function sign(data) {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

// 有効期限 ttlMs のトークンを発行（形式は従来と同一）。
export function signToken(ttlMs) {
  const exp = String(Date.now() + ttlMs);
  const payload = Buffer.from(exp).toString('base64url');
  return `${payload}.${sign(exp)}`;
}

// 生のトークン文字列を検証（内部用）。
function verifyTokenString(token) {
  if (!token || !getSecret()) return false;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return false;
  let exp;
  try {
    exp = Buffer.from(payload, 'base64url').toString();
  } catch {
    return false;
  }
  const expected = sign(exp);
  // 定数時間比較（長さ差で漏れない）
  if (!safeEqual(sig, expected)) return false;
  return Date.now() < Number(exp);
}

// Authorization ヘッダから Bearer トークンを取り出す。
function bearer(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

// リクエストの Authorization: Bearer を検証し boolean を返す。
export function verifyToken(req) {
  return verifyTokenString(bearer(req));
}

export default { getSecret, safeEqual, signToken, verifyToken };
