// 管理画面フロントエンド — usher in making
// ・ログイン（/api/admin?action=login）でトークン取得 → sessionStorage 保持
// ・保護 API（お問い合わせ／ご予約一覧）の呼び出し・描画
// ・サイトコンテンツ（お知らせ・プラン）の取得／保存
// 公用の site.js には依存しない自己完結スクリプト。

(() => {
  'use strict';

  const TOKEN_KEY = 'uim_admin_token';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const loginView = $('#login-view');
  const dashView = $('#dashboard-view');

  const getToken = () => sessionStorage.getItem(TOKEN_KEY) || '';
  const setToken = (t) => sessionStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

  // 認証付き fetch。401 ならログイン画面へ戻す。
  async function api(path, opts = {}) {
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      opts.headers || {},
      getToken() ? { Authorization: `Bearer ${getToken()}` } : {}
    );
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    if (res.status === 401) {
      clearToken();
      showLogin('セッションの有効期限が切れました。再度ログインしてください。');
      throw new Error('unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
    return data;
  }

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(
      d.getMinutes()
    )}`;
  }

  // ─── ビュー切り替え ────────────────────────────────────────────────
  function showLogin(msg) {
    dashView.hidden = true;
    loginView.hidden = false;
    $('#login-msg').textContent = msg || '';
    $('#login-msg').classList.toggle('is-error', !!msg);
    $('#password').focus();
  }
  function showDashboard() {
    loginView.hidden = true;
    dashView.hidden = false;
    loadContacts();
    loadContent();
  }

  // ─── ログイン ──────────────────────────────────────────────────────
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#login-btn');
    const msg = $('#login-msg');
    msg.textContent = '';
    msg.classList.remove('is-error');
    btn.disabled = true;
    btn.textContent = 'ログイン中…';
    try {
      const res = await fetch('/api/admin?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: $('#password').value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'ログインに失敗しました。');
      setToken(data.token);
      $('#password').value = '';
      showDashboard();
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('is-error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'ログイン';
    }
  });

  $('#logout-btn').addEventListener('click', () => {
    clearToken();
    showLogin('');
  });

  // ─── タブ ──────────────────────────────────────────────────────────
  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const name = tab.dataset.tab;
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
    $$('.panel').forEach((p) => (p.hidden = p.dataset.panel !== name));
    if (name === 'reservations') loadReservations();
  });

  // 再読み込みボタン
  document.addEventListener('click', (e) => {
    const r = e.target.closest('[data-reload]');
    if (!r) return;
    r.dataset.reload === 'contacts' ? loadContacts() : loadReservations();
  });

  // ─── 一覧描画 ──────────────────────────────────────────────────────
  function renderList(el, items, kind) {
    if (!items.length) {
      el.innerHTML = '<p class="empty">データがありません。</p>';
      return;
    }
    el.innerHTML = items
      .map((it) => {
        // 統一スキーマ:
        //   contacts     = { name, email, date, message, createdAt }
        //   reservations = { name, email, contact, plan, date, message, createdAt }
        const rows =
          kind === 'reservations'
            ? `<dl class="meta">
                 <div><dt>プラン</dt><dd>${esc(it.plan)}</dd></div>
                 <div><dt>希望日</dt><dd>${esc(it.date)}</dd></div>
                 <div><dt>連絡先</dt><dd>${esc(it.contact)}</dd></div>
               </dl>
               <p class="body">${esc(it.message)}</p>`
            : `${it.date ? `<dl class="meta"><div><dt>希望日</dt><dd>${esc(it.date)}</dd></div></dl>` : ''}
               <p class="body">${esc(it.message)}</p>`;
        // 連絡先メールがある場合のみ mailto リンクを表示（予約は電話/LINE のこともある）
        const emailLink = it.email
          ? `<a class="email" href="mailto:${esc(it.email)}">${esc(it.email)}</a>`
          : '';
        return `<article class="card">
          <header class="card-head">
            <strong>${esc(it.name)}</strong>
            <time>${fmtDate(it.createdAt)}</time>
          </header>
          ${emailLink}
          ${rows}
        </article>`;
      })
      .join('');
  }

  async function loadContacts() {
    const el = $('#contacts-list');
    el.innerHTML = '<p class="loading">読み込み中…</p>';
    try {
      const { items } = await api('/api/admin?action=contacts');
      renderList(el, items, 'contacts');
    } catch (err) {
      if (err.message !== 'unauthorized') el.innerHTML = `<p class="empty is-error">${esc(err.message)}</p>`;
    }
  }

  async function loadReservations() {
    const el = $('#reservations-list');
    el.innerHTML = '<p class="loading">読み込み中…</p>';
    try {
      const { items } = await api('/api/admin?action=reservations');
      renderList(el, items, 'reservations');
    } catch (err) {
      if (err.message !== 'unauthorized') el.innerHTML = `<p class="empty is-error">${esc(err.message)}</p>`;
    }
  }

  // ─── コンテンツ編集 ────────────────────────────────────────────────
  function addPlanRow(plan = {}) {
    const tpl = $('#plan-row-tpl').content.cloneNode(true);
    const row = tpl.querySelector('.plan-row');
    ['title', 'price', 'desc'].forEach((k) => {
      const input = row.querySelector(`[data-k="${k}"]`);
      if (input) input.value = plan[k] || '';
    });
    if (plan.id) row.dataset.id = plan.id;
    row.querySelector('[data-remove]').addEventListener('click', () => row.remove());
    $('#plans').appendChild(row);
  }

  async function loadContent() {
    try {
      const data = await api('/api/content', { method: 'GET' });
      $('#notice').value = data.notice || '';
      $('#plans').innerHTML = '';
      (data.plans || []).forEach(addPlanRow);
      $('#content-updated').textContent = data.updatedAt
        ? `最終更新: ${fmtDate(data.updatedAt)}`
        : '';
    } catch (err) {
      if (err.message !== 'unauthorized') $('#content-msg').textContent = err.message;
    }
  }

  $('#add-plan').addEventListener('click', () => addPlanRow());

  $('#content-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#save-btn');
    const msg = $('#content-msg');
    msg.textContent = '';
    msg.classList.remove('is-error');
    const plans = $$('#plans .plan-row').map((row, i) => ({
      id: row.dataset.id || `plan-${i + 1}`,
      title: row.querySelector('[data-k="title"]').value,
      price: row.querySelector('[data-k="price"]').value,
      desc: row.querySelector('[data-k="desc"]').value,
    }));
    btn.disabled = true;
    btn.textContent = '保存中…';
    try {
      const res = await api('/api/content', {
        method: 'POST',
        body: JSON.stringify({ notice: $('#notice').value, plans }),
      });
      msg.textContent = '保存しました。';
      $('#content-updated').textContent = res.content && res.content.updatedAt
        ? `最終更新: ${fmtDate(res.content.updatedAt)}`
        : '';
    } catch (err) {
      if (err.message !== 'unauthorized') {
        msg.textContent = err.message;
        msg.classList.add('is-error');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '保存する';
    }
  });

  // ─── 起動: 既存トークンを検証 ──────────────────────────────────────
  (async function init() {
    if (!getToken()) return showLogin('');
    try {
      const res = await api('/api/admin?action=verify');
      res.ok ? showDashboard() : showLogin('');
    } catch {
      showLogin('');
    }
  })();
})();
