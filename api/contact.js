// Vercel Serverless Function — POST /api/contact
// READY-TO-USE scaffold for when a contact form is added later.
// The current CONTACT page intentionally uses LINE / Instagram (faithful to the
// original site) and has no form, so nothing calls this yet.
//
// To enable email delivery, set these Environment Variables in Vercel:
//   RESEND_API_KEY   (https://resend.com — free tier)
//   CONTACT_TO       (where inquiries are sent, e.g. studio@example.com)
//   CONTACT_FROM     (optional, a verified sender; defaults to resend onboarding)
//
// Front-end usage (when you add a form):
//   fetch('/api/contact', { method:'POST', headers:{'Content-Type':'application/json'},
//     body: JSON.stringify({ name, email, message }) })

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
    const message = (body.message || '').trim();

    if (body._hp) return res.status(200).json({ ok: true });            // honeypot
    if (!name || !email || !message)
      return res.status(400).json({ error: '必須項目が未入力です。' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return res.status(400).json({ error: 'メールアドレスの形式が正しくありません。' });

    const KEY = process.env.RESEND_API_KEY;
    const TO = process.env.CONTACT_TO;
    const FROM = process.env.CONTACT_FROM || 'usher in making <onboarding@resend.dev>';

    if (!KEY || !TO) {
      // Not configured yet: accept the submission so the UX works,
      // but make clear email delivery isn't wired until env vars are set.
      console.log('[contact] received (email not configured):', { name, email });
      return res.status(200).json({ ok: true, note: 'received (email delivery not configured)' });
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `【お問い合わせ】${name} 様`,
        text: `お名前: ${name}\nメール: ${email}\n\n${message}`,
      }),
    });
    if (!r.ok) {
      console.error('[contact] resend error:', await r.text());
      return res.status(502).json({ error: '送信に失敗しました。時間をおいて再度お試しください。' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[contact]', e);
    return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
}
