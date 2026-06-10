// api/_lib/translate.js — 翻訳ユーティリティ（Anthropic Claude API）
// ---------------------------------------------------------------------------
// ブログ記事（韓国語の原文）を日本語 / 英語へ翻訳するための薄いラッパ。
//   - 環境変数 ANTHROPIC_API_KEY が必要（未設定なら呼び出し側へ明示エラー）。
//   - モデルは ANTHROPIC_MODEL（既定 claude-haiku-4-5）。
//   - HTML タグ・改行・画像はそのまま保持し、テキストのみ翻訳するよう指示する。
//
// 設計メモ（サーバーレスのタイムアウト対策）:
//   1リクエスト＝1 Anthropic 呼び出しに収める。記事の title / excerpt / body を
//   まとめて 1 回で翻訳し、JSON で受け取る（translateFields）。翻訳対象の言語
//   （ja / en）は呼び出し側が 1 言語ずつ指定する。
// ---------------------------------------------------------------------------

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5';

const LANG_NAME = { ja: '日本語 (Japanese)', en: 'English' };

function apiKey() {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) {
    const e = new Error('翻訳APIが設定されていません（ANTHROPIC_API_KEY 未設定）。');
    e.code = 'NO_API_KEY';
    throw e;
  }
  return k;
}

// Anthropic Messages API を 1 回叩いてテキストを返す。
async function callClaude({ system, user, maxTokens = 8000 }) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const e = new Error(`翻訳APIがエラーを返しました (${res.status})。`);
    e.status = res.status;
    e.detail = detail.slice(0, 300);
    throw e;
  }
  const data = await res.json();
  const text = Array.isArray(data.content)
    ? data.content.map((b) => (b && b.type === 'text' ? b.text : '')).join('')
    : '';
  return text.trim();
}

// JSON 部分だけを安全に取り出す（モデルが前後に文章を付けても拾えるように）。
function extractJson(s) {
  if (!s) return null;
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) return null;
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
}

// 記事の主要フィールド（title/excerpt/body）を 1 言語へまとめて翻訳。
//   fields = { title: '...', excerpt: '...', body: '<p>...</p>' }（韓国語原文）
//   target = 'ja' | 'en'
//   戻り値 = { title, excerpt, body }（翻訳済み・HTML 構造は保持）
export async function translateFields(fields, target) {
  const lang = LANG_NAME[target] || target;
  const payload = {
    title: String(fields.title || ''),
    excerpt: String(fields.excerpt || ''),
    body: String(fields.body || ''),
  };
  const system =
    `You are a professional translator for a wedding & anniversary photo studio website ` +
    `("usher in making", based in Okinawa, Japan). Translate the given Korean text into ${lang}. ` +
    `Tone: warm, elegant, natural marketing copy a customer would enjoy reading. ` +
    `RULES: (1) Translate ONLY the human-readable text. ` +
    `(2) Keep ALL HTML tags, attributes, URLs and <img> elements EXACTLY as-is — do not add, remove, or reorder tags. ` +
    `(3) Do not translate brand names ("usher in making", "usherinmaking"). ` +
    `(4) Keep the body as valid HTML. ` +
    `(5) Return ONLY a JSON object: {"title": "...", "excerpt": "...", "body": "..."} with no extra commentary.`;
  const user =
    `Translate the following fields into ${lang}. Return JSON only.\n\n` +
    JSON.stringify(payload, null, 2);

  const out = await callClaude({ system, user, maxTokens: 8000 });
  const parsed = extractJson(out);
  if (!parsed) {
    const e = new Error('翻訳結果の解析に失敗しました。もう一度お試しください。');
    e.code = 'PARSE_FAILED';
    throw e;
  }
  return {
    title: typeof parsed.title === 'string' ? parsed.title : payload.title,
    excerpt: typeof parsed.excerpt === 'string' ? parsed.excerpt : payload.excerpt,
    body: typeof parsed.body === 'string' ? parsed.body : payload.body,
  };
}

export default { translateFields };
