// Vercel Serverless Function — /api/rebuild  （契約 v4 / エージェントA 所有）
// 管理画面の［公開（サイト再構築）］から呼ばれ、Vercel Deploy Hook を叩いて
// 静的サイトの再ビルド（KV→HTML ベイク）を起動する。
//
//   - POST /api/rebuild  (要トークン) → process.env.DEPLOY_HOOK_URL に POST。
//       成功: 200 { ok: true }
//       未設定: 501 { error: "Deploy Hook 未設定" }
//
// DEPLOY_HOOK_URL が無い環境ではサイトは壊れず、501 で「未設定」を返すだけ。
// トークン検証は api/admin.js / api/content.js と同方式（ADMIN_PASSWORD 由来の HMAC）。

// トークン検証は api/_lib/auth.js に集約（ADMIN_TOKEN_SECRET / ADMIN_PASSWORD 由来）。
import { verifyToken } from './_lib/auth.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    if (!verifyToken(req)) {
      return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해 주세요.' });
    }

    const hook = process.env.DEPLOY_HOOK_URL;
    if (!hook) {
      return res.status(501).json({
        error: 'Deploy Hook이 설정되지 않았습니다. Vercel의 Deploy Hook URL을 DEPLOY_HOOK_URL 환경변수로 설정해 주세요.',
      });
    }

    try {
      const r = await fetch(hook, { method: 'POST' });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        console.error('[rebuild] deploy hook returned', r.status, detail.slice(0, 200));
        return res.status(502).json({ error: `Deploy Hook이 오류를 반환했습니다 (${r.status}).` });
      }
    } catch (e) {
      console.error('[rebuild] deploy hook fetch failed', e);
      return res.status(502).json({ error: 'Deploy Hook 연결에 실패했습니다.' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[rebuild]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
