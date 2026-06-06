// Vercel Serverless Function — POST /api/contact
// お問い合わせフォーム（contact.html + js/contact-form.js）からの送信を受け付ける。
// 受信した内容を (1) 軽量に保存し (2) Resend でメール通知する。
// メール未設定でも 200 を返し、フォームの UX を保つ。
//
// メール配信を有効にするには Vercel の Environment Variables を設定:
//   RESEND_API_KEY   (https://resend.com — 無料枠あり)
//   CONTACT_TO       (問い合わせの送信先。例: studio@example.com)
//   CONTACT_FROM     (任意。認証済み送信元。未設定なら resend のサンドボックス)
//
// 保存について:
//   保存先は api/_lib/store.js が一元管理（KV があれば KV、無ければ /tmp JSON）。
//   キーは KEYS.contacts（"uim:contacts"）。管理画面（api/admin.js）も同じキー・
//   同じスキーマで読むので、ここで保存した実データがそのまま一覧に表示される。
//   統一スキーマ（お問い合わせ）: { id, name, email, date, message, createdAt }

import store, { KEYS } from './_lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const body = (req.body && typeof req.body === 'object')
      ? req.body
      : JSON.parse(req.body || '{}');

    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const date = (body.date || '').trim();        // ご希望日（任意）
    const message = (body.message || '').trim();
    const agree = body.agree === true || body.agree === 'on' || body.agree === '1';

    if (body._hp) return res.status(200).json({ ok: true });            // honeypot

    if (!name || !email || !message)
      return res.status(400).json({ error: '必須項目が未入力です。' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return res.status(400).json({ error: 'メールアドレスの形式が正しくありません。' });
    if (!agree)
      return res.status(400).json({ error: '個人情報の取り扱いへの同意が必要です。' });
    // ご希望日が入っている場合のみ形式チェック（YYYY-MM-DD）
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res.status(400).json({ error: 'ご希望日の形式が正しくありません。' });

    // 統一スキーマ（{ id, name, email, date, message, status, createdAt, updatedAt }）。
    // ua は管理画面では使わないが参考情報として保持。
    const now = new Date().toISOString();
    const entry = {
      id: store.genId('c'),
      name, email, date, message,
      status: 'new',
      createdAt: now,
      updatedAt: now,
      ua: (req.headers && req.headers['user-agent']) || '',
    };

    // 1) 保存（失敗しても受付は継続）
    try {
      await store.push(KEYS.contacts, entry);
    } catch (e) {
      console.error('[contact] save failed:', e);
    }

    const KEY = process.env.RESEND_API_KEY;
    const TO = process.env.CONTACT_TO;
    const FROM = process.env.CONTACT_FROM || 'usher in making <onboarding@resend.dev>';

    // 2) メール通知
    if (!KEY || !TO) {
      // メール未設定: 受付は成功させ、UX を保つ。
      console.log('[contact] received (email not configured):', { name, email, date });
      return res.status(200).json({ ok: true, note: 'received (email delivery not configured)' });
    }

    const dateLine = date ? `ご希望日: ${date}\n` : '';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `【お問い合わせ】${name} 様`,
        text: `お名前: ${name}\nメール: ${email}\n${dateLine}\nメッセージ:\n${message}\n\n受信日時: ${entry.createdAt}`,
      }),
    });
    if (!r.ok) {
      console.error('[contact] resend error:', await r.text());
      // 保存は済んでいるので、ユーザーには再試行を促す
      return res.status(502).json({ error: '送信に失敗しました。時間をおいて再度お試しください。' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[contact]', e);
    return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
}
