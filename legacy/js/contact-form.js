// contact-form.js — お問い合わせフォームの送信処理
// fetch('/api/contact') へ JSON を POST し、結果を日本語で案内する。
// 二重送信防止つき。site.js / site.css には手を加えない。
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var statusEl = document.getElementById('contact-status');
  var button = form.querySelector('button[type="submit"]');
  var sending = false;

  function setStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    // kind: 'ok' | 'error' | ''  色は CSS 変数を使い、デザインと統一
    statusEl.style.color =
      kind === 'ok' ? 'var(--gold)' :
      kind === 'error' ? '#c0392b' :
      'var(--muted)';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return; // 二重送信防止

    // ブラウザ標準のバリデーション（必須・メール形式・同意チェック）
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var payload = {
      name: (form.name.value || '').trim(),
      email: (form.email.value || '').trim(),
      date: (form.date.value || '').trim(),
      message: (form.message.value || '').trim(),
      agree: !!form.agree.checked,
      _hp: form._hp ? form._hp.value : ''
    };

    sending = true;
    button.disabled = true;
    button.style.opacity = '.6';
    button.style.cursor = 'progress';
    setStatus('送信中です…', '');

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (r) {
        if (r.ok) {
          form.reset();
          setStatus('お問い合わせを受け付けました。2〜3日以内に折り返しご連絡いたします。', 'ok');
          button.textContent = '送信しました';
        } else {
          var msg = (r.data && r.data.error) ||
            '送信に失敗しました。お手数ですが、時間をおいて再度お試しください。';
          setStatus(msg, 'error');
          reEnable();
        }
      })
      .catch(function () {
        setStatus('通信エラーが発生しました。LINE・Instagramからもお気軽にご連絡ください。', 'error');
        reEnable();
      });

    function reEnable() {
      sending = false;
      button.disabled = false;
      button.style.opacity = '';
      button.style.cursor = '';
    }
  });
})();
