// ════════════════════════════════════════════════════════════════
// 管理コンソール — usher in making
//  ・ハッシュルーティング（#/dashboard 等）による 5 セクション切替
//  ・/api/admin（ログイン・stats・一覧・状態更新）と /api/content の連携
//  ・トークンは sessionStorage 保持／401 で自動ログアウト
//  ・契約（.agents/contract.md）のエンドポイント・スキーマに厳密準拠
// 公開サイトの site.js には依存しない自己完結スクリプト。
// ════════════════════════════════════════════════════════════════
(() => {
  'use strict';

  const TOKEN_KEY = 'uim_admin_token';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ─── トークン管理 ───────────────────────────────────────
  const getToken   = () => sessionStorage.getItem(TOKEN_KEY) || '';
  const setToken   = (t) => sessionStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

  // 認証付き fetch。401 ならトークン破棄してログインへ戻す。
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
    if (!res.ok) throw new Error(data.error || `エラーが発生しました (${res.status})`);
    return data;
  }

  // ─── ユーティリティ ─────────────────────────────────────
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
  }
  function relTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)    return 'たった今';
    if (diff < 3600)  return `${Math.floor(diff / 60)}分前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}日前`;
    return fmtDate(iso);
  }

  // 状態 → バッジ表示（契約のステータス値に準拠）
  const RESV_STATUS = {
    pending:   { label: '保留',       tone: 'amber' },
    confirmed: { label: '確定',       tone: 'green' },
    cancelled: { label: 'キャンセル', tone: 'gray'  },
  };
  const CONTACT_STATUS = {
    new:     { label: '新規',   tone: 'blue'  },
    read:    { label: '確認済', tone: 'gray'  },
    replied: { label: '返信済', tone: 'green' },
  };
  function badge(map, status) {
    const s = map[status] || { label: status || '—', tone: 'gray' };
    return `<span class="badge ${s.tone}">${esc(s.label)}</span>`;
  }

  // ─── トースト ───────────────────────────────────────────
  function toast(msg, type = 'info') {
    const icons = {
      ok:    '<path d="M20 6 9 17l-5-5"/>',
      error: '<path d="M18 6 6 18M6 6l12 12"/>',
      info:  '<path d="M12 16v-4M12 8h.01"/><circle cx="12" cy="12" r="9"/>',
    };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML =
      `<svg class="t-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[type] || icons.info}</svg>` +
      `<span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 220);
    }, 3200);
  }

  // 共通の空状態・読み込み・エラー表示
  const ICON_INBOX = '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>';
  function emptyState(title, sub, isError = false) {
    return `<div class="empty-state${isError ? ' is-error' : ''}">
      <div class="empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON_INBOX}</svg></div>
      <strong>${esc(title)}</strong><span>${esc(sub)}</span>
    </div>`;
  }
  const loadingRow = '<div class="loading-row"><span class="spinner"></span>読み込み中…</div>';

  // ════════════════ ビュー切替（ログイン / アプリ）════════════════
  const loginView = $('#login-view');
  const appView   = $('#app');

  function showLogin(msg) {
    appView.hidden = true;
    loginView.hidden = false;
    const m = $('#login-msg');
    m.textContent = msg || '';
    m.classList.toggle('is-error', !!msg);
    $('#password').focus();
  }
  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
    if (!location.hash || !ROUTES[routeName()]) location.hash = '#/dashboard';
    else navigate();
    refreshBadges();
  }

  // ─── ログイン ───────────────────────────────────────────
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
      if (!res.ok) throw new Error(data.error || 'パスワードが正しくありません。');
      setToken(data.token);
      $('#password').value = '';
      showApp();
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

  // ════════════════ ルーティング ════════════════
  const ROUTES = {
    dashboard:    { title: 'ダッシュボード', render: renderDashboard },
    reservations: { title: '予約管理',       render: renderReservations },
    contacts:     { title: 'お問い合わせ',   render: renderContacts },
    content:      { title: 'コンテンツ管理', render: renderContent },
    settings:     { title: '設定',           render: renderSettings },
  };
  function routeName() {
    const h = location.hash.replace(/^#\/?/, '').split('/')[0];
    return ROUTES[h] ? h : 'dashboard';
  }
  function navigate() {
    const name = routeName();
    closeDrawer();
    $$('.nav-link').forEach((a) => a.classList.toggle('is-active', a.dataset.route === name));
    $('#page-title').textContent = ROUTES[name].title;
    $$('.view').forEach((v) => (v.hidden = v.dataset.view !== name));
    appView.classList.remove('nav-open');
    $('#sidebar-scrim').hidden = true;
    ROUTES[name].render($(`.view[data-view="${name}"]`));
  }
  window.addEventListener('hashchange', () => { if (getToken()) navigate(); });

  // 再読み込みボタン（現在のビューを再描画）
  $('#refresh-btn').addEventListener('click', () => navigate());

  // モバイルメニュー
  $('#menu-toggle').addEventListener('click', () => {
    appView.classList.add('nav-open');
    $('#sidebar-scrim').hidden = false;
  });
  $('#sidebar-scrim').addEventListener('click', () => {
    appView.classList.remove('nav-open');
    $('#sidebar-scrim').hidden = true;
  });

  // ════════════════ ① ダッシュボード ════════════════
  async function renderDashboard(root) {
    root.innerHTML = `<div class="section-head"><div><h2>ダッシュボード</h2>
      <p class="sub">お問い合わせ・ご予約の概況</p></div></div>
      <div class="stat-grid" id="stat-grid">${loadingRow}</div>
      <div class="card"><div class="card-head-row"><h3 class="card-title">最近の活動</h3></div>
      <div id="activity">${loadingRow}</div></div>`;
    try {
      const s = await api('/api/admin?action=stats');
      const stat = (tone, ico, value, label) => `
        <div class="stat-card">
          <div class="stat-ico tone-${tone}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ico}</svg></div>
          <div class="stat-value">${value}</div>
          <div class="stat-label">${label}</div>
        </div>`;
      const ICO_MAIL = '<path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M3 6l9 7 9-7"/>';
      const ICO_CLOCK = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
      const ICO_CHECK = '<path d="M20 6 9 17l-5-5"/>';
      const ICO_CAL = '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>';
      $('#stat-grid').innerHTML =
        stat('blue',  ICO_MAIL,  s.inquiries?.new ?? 0,        '新規お問い合わせ') +
        stat('amber', ICO_CLOCK, s.reservations?.pending ?? 0, '予約（保留中）') +
        stat('green', ICO_CHECK, s.reservations?.upcoming ?? 0,'今後のご予約') +
        stat('teal',  ICO_CAL,   s.reservations?.total ?? 0,   '予約 累計');

      const recent = Array.isArray(s.recent) ? s.recent : [];
      const act = $('#activity');
      if (!recent.length) {
        act.innerHTML = emptyState('まだデータがありません', '新しいお問い合わせやご予約がここに表示されます。');
      } else {
        act.className = 'activity';
        act.innerHTML = recent.map((r) => {
          const isResv = r.type === 'reservation';
          const ico = isResv
            ? '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'
            : '<path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M3 6l9 7 9-7"/>';
          return `<div class="activity-item">
            <div class="activity-ico tone-${isResv ? 'teal' : 'blue'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ico}</svg></div>
            <div class="activity-main">
              <strong>${esc(r.name || '名称未設定')}</strong>
              <div class="a-sum">${esc(isResv ? 'ご予約' : 'お問い合わせ')}・${esc(r.summary || '')}</div>
            </div>
            <span class="activity-time">${relTime(r.createdAt)}</span>
          </div>`;
        }).join('');
      }
    } catch (err) {
      if (err.message === 'unauthorized') return;
      $('#stat-grid').innerHTML = '';
      $('#activity').innerHTML = emptyState('読み込みに失敗しました', err.message, true);
      toast(err.message, 'error');
    }
  }

  // サイドバーの未対応件数バッジ
  async function refreshBadges() {
    try {
      const s = await api('/api/admin?action=stats');
      setBadge('contacts', s.inquiries?.new ?? 0);
      setBadge('reservations', s.reservations?.pending ?? 0);
    } catch { /* 取得失敗時はバッジ非表示のまま */ }
  }
  function setBadge(name, n) {
    const el = $(`#nav-badge-${name}`);
    if (!el) return;
    if (n > 0) { el.textContent = n; el.hidden = false; }
    else el.hidden = true;
  }

  // ════════════════ ② 予約管理 ════════════════
  let resvCache = [];
  let resvFilter = 'all';

  async function renderReservations(root) {
    root.innerHTML = `
      <div class="section-head">
        <div><h2>予約管理</h2><p class="sub">ご予約の確認と状態の更新</p></div>
        <div class="filters" id="resv-filters"></div>
      </div>
      <div class="table-wrap"><div class="table-scroll"><table class="data">
        <thead><tr>
          <th>希望日</th><th>お名前</th><th>プラン</th><th>連絡先</th><th>状態</th><th class="nowrap">受付日</th>
        </tr></thead>
        <tbody id="resv-body"><tr><td colspan="6">${loadingRow}</td></tr></tbody>
      </table></div></div>`;
    try {
      const { items } = await api('/api/admin?action=reservations');
      resvCache = Array.isArray(items) ? items : [];
      renderResvFilters();
      paintResvRows();
    } catch (err) {
      if (err.message === 'unauthorized') return;
      $('#resv-body').innerHTML = `<tr><td colspan="6">${emptyState('読み込みに失敗しました', err.message, true)}</td></tr>`;
      toast(err.message, 'error');
    }
  }
  function renderResvFilters() {
    const counts = { all: resvCache.length, pending: 0, confirmed: 0, cancelled: 0 };
    resvCache.forEach((r) => { if (counts[r.status] != null) counts[r.status]++; });
    const defs = [
      ['all', 'すべて'], ['pending', '保留'], ['confirmed', '確定'], ['cancelled', 'キャンセル'],
    ];
    $('#resv-filters').innerHTML = defs.map(([k, label]) =>
      `<button class="chip${resvFilter === k ? ' is-active' : ''}" data-filter="${k}">${label}<span class="count">${counts[k] || 0}</span></button>`
    ).join('');
  }
  function paintResvRows() {
    const body = $('#resv-body');
    const items = resvFilter === 'all' ? resvCache : resvCache.filter((r) => r.status === resvFilter);
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="6">${emptyState('まだデータがありません', 'この条件のご予約はありません。')}</td></tr>`;
      return;
    }
    body.innerHTML = items.map((r) => `
      <tr data-id="${esc(r.id)}">
        <td class="nowrap"><strong>${esc(r.date || '—')}</strong></td>
        <td class="col-name">${esc(r.name || '—')}</td>
        <td>${esc(r.plan || '—')}</td>
        <td class="muted">${esc(r.contact || r.email || '—')}</td>
        <td>${badge(RESV_STATUS, r.status)}</td>
        <td class="nowrap muted">${fmtDate(r.createdAt)}</td>
      </tr>`).join('');
    $$('#resv-body tr[data-id]').forEach((tr) =>
      tr.addEventListener('click', () => openResvDrawer(tr.dataset.id)));
  }
  // フィルターチップ（イベント委譲）
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('#resv-filters .chip');
    if (!chip) return;
    resvFilter = chip.dataset.filter;
    renderResvFilters();
    paintResvRows();
  });

  function openResvDrawer(id) {
    const r = resvCache.find((x) => String(x.id) === String(id));
    if (!r) return;
    const rows = [
      ['希望日', esc(r.date || '—')],
      ['お名前', esc(r.name || '—')],
      ['プラン', esc(r.plan || '—')],
      ['メール', r.email ? `<a class="cell-mail" href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : '—'],
      ['連絡先', esc(r.contact || '—')],
      ['受付日', fmtDateTime(r.createdAt)],
      ['更新日', fmtDateTime(r.updatedAt)],
    ];
    const actions = Object.entries(RESV_STATUS).map(([k, s]) =>
      `<button class="btn btn-ghost btn-sm${r.status === k ? ' is-current' : ''}" data-status="${k}">${esc(s.label)}</button>`
    ).join('');
    openDrawer('予約の詳細', `
      <dl class="detail-list">${rows.map(([k, v]) => `<div class="detail-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${r.message ? `<p class="drawer-section-label">メッセージ</p><div class="detail-msg">${esc(r.message)}</div>` : ''}
      <p class="drawer-section-label">状態を変更</p>
      <div class="status-actions" id="resv-status-actions">${actions}</div>
      ${r.email ? `<div class="drawer-foot"><a class="btn btn-soft btn-block" href="mailto:${esc(r.email)}?subject=${encodeURIComponent('【usher in making】ご予約について')}">メールで連絡する</a></div>` : ''}
    `);
    $$('#resv-status-actions [data-status]').forEach((b) =>
      b.addEventListener('click', () => updateResvStatus(r.id, b.dataset.status)));
  }

  async function updateResvStatus(id, status) {
    $$('#resv-status-actions .btn').forEach((b) => (b.disabled = true));
    try {
      const { item } = await api('/api/admin?action=update-reservation', {
        method: 'POST', body: JSON.stringify({ id, status }),
      });
      const idx = resvCache.findIndex((x) => String(x.id) === String(id));
      if (idx >= 0 && item) resvCache[idx] = item;
      toast('予約の状態を更新しました。', 'ok');
      renderResvFilters();
      paintResvRows();
      openResvDrawer(id);
      refreshBadges();
    } catch (err) {
      if (err.message !== 'unauthorized') toast(err.message, 'error');
      $$('#resv-status-actions .btn').forEach((b) => (b.disabled = false));
    }
  }

  // ════════════════ ③ お問い合わせ ════════════════
  let contactCache = [];
  let contactFilter = 'all';

  async function renderContacts(root) {
    root.innerHTML = `
      <div class="section-head">
        <div><h2>お問い合わせ</h2><p class="sub">受信したお問い合わせの管理</p></div>
        <div class="filters" id="contact-filters"></div>
      </div>
      <div class="table-wrap"><div class="table-scroll"><table class="data">
        <thead><tr>
          <th>お名前</th><th>メール</th><th>希望日</th><th>状態</th><th class="nowrap">受付日</th>
        </tr></thead>
        <tbody id="contact-body"><tr><td colspan="5">${loadingRow}</td></tr></tbody>
      </table></div></div>`;
    try {
      const { items } = await api('/api/admin?action=contacts');
      contactCache = Array.isArray(items) ? items : [];
      renderContactFilters();
      paintContactRows();
    } catch (err) {
      if (err.message === 'unauthorized') return;
      $('#contact-body').innerHTML = `<tr><td colspan="5">${emptyState('読み込みに失敗しました', err.message, true)}</td></tr>`;
      toast(err.message, 'error');
    }
  }
  function renderContactFilters() {
    const counts = { all: contactCache.length, new: 0, read: 0, replied: 0 };
    contactCache.forEach((c) => { if (counts[c.status] != null) counts[c.status]++; });
    const defs = [['all', 'すべて'], ['new', '新規'], ['read', '確認済'], ['replied', '返信済']];
    $('#contact-filters').innerHTML = defs.map(([k, label]) =>
      `<button class="chip${contactFilter === k ? ' is-active' : ''}" data-cfilter="${k}">${label}<span class="count">${counts[k] || 0}</span></button>`
    ).join('');
  }
  function paintContactRows() {
    const body = $('#contact-body');
    const items = contactFilter === 'all' ? contactCache : contactCache.filter((c) => c.status === contactFilter);
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="5">${emptyState('まだデータがありません', 'この条件のお問い合わせはありません。')}</td></tr>`;
      return;
    }
    body.innerHTML = items.map((c) => `
      <tr data-id="${esc(c.id)}">
        <td class="col-name">${esc(c.name || '—')}</td>
        <td class="muted">${esc(c.email || '—')}</td>
        <td class="nowrap">${esc(c.date || '—')}</td>
        <td>${badge(CONTACT_STATUS, c.status)}</td>
        <td class="nowrap muted">${fmtDate(c.createdAt)}</td>
      </tr>`).join('');
    $$('#contact-body tr[data-id]').forEach((tr) =>
      tr.addEventListener('click', () => openContactDrawer(tr.dataset.id)));
  }
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('#contact-filters .chip');
    if (!chip) return;
    contactFilter = chip.dataset.cfilter;
    renderContactFilters();
    paintContactRows();
  });

  function openContactDrawer(id) {
    const c = contactCache.find((x) => String(x.id) === String(id));
    if (!c) return;
    // 詳細を開いた時点で新規→確認済に自動更新（既読扱い）
    if (c.status === 'new') updateContactStatus(c.id, 'read', true);
    const rows = [
      ['お名前', esc(c.name || '—')],
      ['メール', c.email ? `<a class="cell-mail" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'],
      ['希望日', esc(c.date || '—')],
      ['受付日', fmtDateTime(c.createdAt)],
      ['更新日', fmtDateTime(c.updatedAt)],
    ];
    const actions = Object.entries(CONTACT_STATUS).map(([k, s]) =>
      `<button class="btn btn-ghost btn-sm${c.status === k ? ' is-current' : ''}" data-status="${k}">${esc(s.label)}</button>`
    ).join('');
    const replyHref = c.email
      ? `mailto:${esc(c.email)}?subject=${encodeURIComponent('【usher in making】お問い合わせありがとうございます')}&body=${encodeURIComponent((c.name || '') + ' 様\n\nこの度はお問い合わせいただきありがとうございます。\n\n')}`
      : '';
    openDrawer('お問い合わせの詳細', `
      <dl class="detail-list">${rows.map(([k, v]) => `<div class="detail-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <p class="drawer-section-label">メッセージ</p>
      <div class="detail-msg">${esc(c.message || '（本文なし）')}</div>
      <p class="drawer-section-label">状態を変更</p>
      <div class="status-actions" id="contact-status-actions">${actions}</div>
      ${replyHref ? `<div class="drawer-foot"><a class="btn btn-soft btn-block" id="reply-btn" href="${replyHref}">メールで返信する</a></div>` : ''}
    `);
    // 返信ボタン押下で「返信済」に
    const rb = $('#reply-btn');
    if (rb) rb.addEventListener('click', () => updateContactStatus(c.id, 'replied'));
    $$('#contact-status-actions [data-status]').forEach((b) =>
      b.addEventListener('click', () => updateContactStatus(c.id, b.dataset.status)));
  }

  async function updateContactStatus(id, status, silent = false) {
    if (!silent) $$('#contact-status-actions .btn').forEach((b) => (b.disabled = true));
    try {
      const { item } = await api('/api/admin?action=update-contact', {
        method: 'POST', body: JSON.stringify({ id, status }),
      });
      const idx = contactCache.findIndex((x) => String(x.id) === String(id));
      if (idx >= 0 && item) contactCache[idx] = item;
      renderContactFilters();
      paintContactRows();
      refreshBadges();
      if (!silent) {
        toast('お問い合わせの状態を更新しました。', 'ok');
        openContactDrawer(id);
      }
    } catch (err) {
      if (!silent && err.message !== 'unauthorized') toast(err.message, 'error');
      if (!silent) $$('#contact-status-actions .btn').forEach((b) => (b.disabled = false));
    }
  }

  // ════════════════ ④ コンテンツ管理 ════════════════
  let content = null;        // /api/content の現在値
  let blockedWorking = [];    // 休業日の編集中コピー
  let calRef = null;          // 表示中カレンダーの基準月

  async function renderContent(root) {
    root.innerHTML = `
      <div class="section-head"><div><h2>コンテンツ管理</h2>
        <p class="sub">公開サイトのお知らせ・プラン・休業日を編集</p></div>
        <span class="sub" id="content-updated"></span></div>
      <div class="tabbar" id="content-tabs">
        <button class="tab-btn is-active" data-ctab="notice">お知らせ</button>
        <button class="tab-btn" data-ctab="plans">プラン管理</button>
        <button class="tab-btn" data-ctab="blocked">休業日</button>
      </div>
      <div class="tab-pane is-active" data-cpane="notice"></div>
      <div class="tab-pane" data-cpane="plans"></div>
      <div class="tab-pane" data-cpane="blocked"></div>`;

    $('#content-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab-btn');
      if (!b) return;
      $$('#content-tabs .tab-btn').forEach((x) => x.classList.toggle('is-active', x === b));
      $$('[data-cpane]').forEach((p) => p.classList.toggle('is-active', p.dataset.cpane === b.dataset.ctab));
    });

    try {
      content = await api('/api/content', { method: 'GET' });
    } catch (err) {
      if (err.message === 'unauthorized') return;
      root.querySelector('[data-cpane="notice"]').innerHTML = emptyState('読み込みに失敗しました', err.message, true);
      toast(err.message, 'error');
      return;
    }
    $('#content-updated').textContent = content.updatedAt ? `最終更新: ${fmtDateTime(content.updatedAt)}` : '';
    renderNoticePane();
    renderPlansPane();
    renderBlockedPane();
  }

  // 部分オブジェクトを POST してマージ保存（契約: POST /api/content）
  async function saveContent(partial, btn, okMsg) {
    const prev = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
    try {
      const res = await api('/api/content', { method: 'POST', body: JSON.stringify(partial) });
      if (res.content) content = res.content;
      $('#content-updated').textContent = content.updatedAt ? `最終更新: ${fmtDateTime(content.updatedAt)}` : '';
      toast(okMsg || '保存しました。', 'ok');
      return true;
    } catch (err) {
      if (err.message !== 'unauthorized') toast(err.message, 'error');
      return false;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = prev; }
    }
  }

  // ─ お知らせ ─
  function renderNoticePane() {
    const n = content.notice || { enabled: false, text: '', link: '' };
    const pane = $('[data-cpane="notice"]');
    pane.innerHTML = `
      <div class="card card-pad editor-card">
        <div class="editor-grid">
          <label class="switch">
            <input type="checkbox" id="notice-enabled" ${n.enabled ? 'checked' : ''} />
            <span class="track"></span>
            <span>トップにお知らせバナーを表示する</span>
          </label>
          <label class="field"><span>お知らせ文</span>
            <textarea id="notice-text" rows="2" placeholder="例）年末年始は休業いたします。">${esc(n.text || '')}</textarea></label>
          <label class="field"><span>リンク URL（任意）</span>
            <input type="text" id="notice-link" placeholder="https://… または /plan.html" value="${esc(n.link || '')}" />
            <p class="help-text">バナーをクリックした際の遷移先。空欄ならリンクなし。</p></label>
        </div>
        <div class="save-bar">
          <button class="btn btn-primary" id="save-notice">保存する</button>
        </div>
      </div>`;
    $('#save-notice').addEventListener('click', (e) => {
      saveContent({ notice: {
        enabled: $('#notice-enabled').checked,
        text: $('#notice-text').value.trim(),
        link: $('#notice-link').value.trim(),
      } }, e.currentTarget, 'お知らせを保存しました。');
    });
  }

  // ─ プラン管理 ─
  function planRow(p = {}, i = 0) {
    const includes = Array.isArray(p.includes) ? p.includes.join('\n') : '';
    const row = document.createElement('div');
    row.className = 'plan-edit' + (p.featured ? ' is-featured' : '');
    if (p.id) row.dataset.id = p.id;
    row.innerHTML = `
      <div class="plan-edit-head">
        <span class="plan-no">プラン ${i + 1}</span>
        <span class="feat-flag" data-feat-label hidden>★ おすすめ</span>
        <span class="spacer"></span>
        <label class="switch" title="おすすめ表示">
          <input type="checkbox" data-k="featured" ${p.featured ? 'checked' : ''} />
          <span class="track"></span><span style="font-size:.8rem">おすすめ</span>
        </label>
        <button type="button" class="btn btn-danger btn-xs" data-remove>削除</button>
      </div>
      <div class="plan-grid">
        <label class="field"><span>プラン名</span><input type="text" data-k="name" value="${esc(p.name || '')}" placeholder="ウェディングフォト" /></label>
        <label class="field"><span>料金</span><input type="text" data-k="price" value="${esc(p.price || '')}" placeholder="¥100,000(税込)" /></label>
        <label class="field"><span>撮影時間など</span><input type="text" data-k="duration" value="${esc(p.duration || '')}" placeholder="撮影2時間ほど" /></label>
        <label class="field"><span>並び順 / ID</span><input type="text" data-k="id" value="${esc(p.id || '')}" placeholder="wedding" /></label>
        <label class="field wide"><span>説明</span><textarea data-k="description" rows="2" placeholder="プランの紹介文">${esc(p.description || '')}</textarea></label>
        <label class="field wide"><span>含まれるもの（1行に1項目）</span><textarea data-k="includes" rows="3" placeholder="データ全カット\nアルバム1冊">${esc(includes)}</textarea></label>
      </div>`;
    row.querySelector('[data-remove]').addEventListener('click', () => { row.remove(); renumberPlans(); });
    const feat = row.querySelector('[data-k="featured"]');
    feat.addEventListener('change', () => row.classList.toggle('is-featured', feat.checked));
    return row;
  }
  function renumberPlans() {
    $$('#plan-list .plan-edit').forEach((row, i) => { row.querySelector('.plan-no').textContent = `プラン ${i + 1}`; });
  }
  function renderPlansPane() {
    const plans = Array.isArray(content.plans) ? content.plans : [];
    const pane = $('[data-cpane="plans"]');
    pane.innerHTML = `
      <div class="plan-list" id="plan-list"></div>
      <button type="button" class="btn btn-ghost btn-sm" id="add-plan">＋ プランを追加</button>
      <div class="save-bar"><button class="btn btn-primary" id="save-plans">プランを保存する</button>
        <p class="help-text" style="margin:0">変更は「保存」を押すまで公開されません。</p></div>`;
    const list = $('#plan-list');
    if (!plans.length) list.appendChild(emptyPlansHint());
    else plans.forEach((p, i) => list.appendChild(planRow(p, i)));
    $('#add-plan').addEventListener('click', () => {
      const hint = list.querySelector('[data-empty]');
      if (hint) hint.remove();
      list.appendChild(planRow({}, list.querySelectorAll('.plan-edit').length));
    });
    $('#save-plans').addEventListener('click', (e) => savePlans(e.currentTarget));
  }
  function emptyPlansHint() {
    const d = document.createElement('div');
    d.setAttribute('data-empty', '');
    d.innerHTML = emptyState('プランがありません', '「＋ プランを追加」から登録してください。');
    return d;
  }
  function savePlans(btn) {
    const plans = $$('#plan-list .plan-edit').map((row, i) => {
      const v = (k) => { const el = row.querySelector(`[data-k="${k}"]`); return el ? el.value.trim() : ''; };
      const includes = v('includes').split('\n').map((s) => s.trim()).filter(Boolean);
      return {
        id: v('id') || `plan-${i + 1}`,
        name: v('name'),
        price: v('price'),
        duration: v('duration'),
        description: v('description'),
        includes,
        featured: row.querySelector('[data-k="featured"]').checked,
      };
    });
    saveContent({ plans }, btn, 'プランを保存しました。');
  }

  // ─ 休業日（カレンダー）─
  function renderBlockedPane() {
    blockedWorking = Array.isArray(content.blockedDates) ? content.blockedDates.slice() : [];
    const now = new Date();
    calRef = { y: now.getFullYear(), m: now.getMonth() };
    const pane = $('[data-cpane="blocked"]');
    pane.innerHTML = `
      <div class="cal-layout">
        <div class="calendar">
          <div class="cal-head">
            <button class="icon-btn" id="cal-prev" aria-label="前の月"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
            <span class="cal-month" id="cal-month"></span>
            <button class="icon-btn" id="cal-next" aria-label="次の月"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
          </div>
          <div class="cal-grid" id="cal-grid"></div>
        </div>
        <div class="blocked-side">
          <h4>休業日の一覧（${'<span id="blocked-count"></span>'}件）</h4>
          <div class="blocked-chips" id="blocked-chips"></div>
          <div class="save-bar"><button class="btn btn-primary" id="save-blocked">休業日を保存する</button></div>
          <p class="help-text">日付をクリックして休業日を切り替えます。保存するまで公開サイトには反映されません。</p>
        </div>
      </div>`;
    $('#cal-prev').addEventListener('click', () => { shiftMonth(-1); });
    $('#cal-next').addEventListener('click', () => { shiftMonth(1); });
    $('#save-blocked').addEventListener('click', (e) =>
      saveContent({ blockedDates: blockedWorking.slice().sort() }, e.currentTarget, '休業日を保存しました。'));
    paintCalendar();
    paintBlockedChips();
  }
  function shiftMonth(d) {
    let m = calRef.m + d, y = calRef.y;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    calRef = { y, m };
    paintCalendar();
  }
  function ymd(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function paintCalendar() {
    const { y, m } = calRef;
    $('#cal-month').textContent = `${y}年 ${m + 1}月`;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const now = new Date();
    const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = ['日', '月', '火', '水', '木', '金', '土'];
    let html = dow.map((d, i) => `<div class="cal-dow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}">${d}</div>`).join('');
    for (let i = 0; i < first; i++) html += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = ymd(y, m, d);
      const cls = ['cal-cell'];
      if (blockedWorking.includes(ds)) cls.push('blocked');
      if (ds === todayStr) cls.push('today');
      html += `<div class="${cls.join(' ')}" data-date="${ds}"><span>${d}</span></div>`;
    }
    const grid = $('#cal-grid');
    grid.innerHTML = html;
    $$('#cal-grid .cal-cell[data-date]').forEach((c) =>
      c.addEventListener('click', () => toggleBlocked(c.dataset.date)));
  }
  function toggleBlocked(ds) {
    const i = blockedWorking.indexOf(ds);
    if (i >= 0) blockedWorking.splice(i, 1);
    else blockedWorking.push(ds);
    paintCalendar();
    paintBlockedChips();
  }
  function paintBlockedChips() {
    const sorted = blockedWorking.slice().sort();
    $('#blocked-count').textContent = sorted.length;
    const wrap = $('#blocked-chips');
    if (!sorted.length) {
      wrap.innerHTML = '<p class="help-text" style="margin:0">休業日は設定されていません。</p>';
      return;
    }
    wrap.innerHTML = sorted.map((d) =>
      `<span class="date-chip">${esc(d)}<button data-rm="${esc(d)}" aria-label="削除"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>`
    ).join('');
    $$('#blocked-chips [data-rm]').forEach((b) =>
      b.addEventListener('click', () => toggleBlocked(b.dataset.rm)));
  }

  // ════════════════ ⑤ 設定 ════════════════
  async function renderSettings(root) {
    root.innerHTML = `<div class="section-head"><div><h2>設定</h2>
      <p class="sub">予約システムとシステム情報</p></div></div>${loadingRow}`;
    try {
      content = await api('/api/content', { method: 'GET' });
    } catch (err) {
      if (err.message === 'unauthorized') return;
      root.innerHTML = `<div class="section-head"><div><h2>設定</h2></div></div>${emptyState('読み込みに失敗しました', err.message, true)}`;
      toast(err.message, 'error');
      return;
    }
    const cap = content.capacityPerDay != null ? content.capacityPerDay : 1;
    root.innerHTML = `
      <div class="section-head"><div><h2>設定</h2><p class="sub">予約システムとシステム情報</p></div></div>
      <div class="card card-pad editor-card" style="margin-bottom:1.2rem">
        <h3 class="card-title">予約の受付上限</h3>
        <p class="help-text" style="margin:.2rem 0 1rem">1日あたりに受け付けるご予約の上限数です。上限に達した日は公開サイトで「満員」と表示されます。</p>
        <label class="field" style="max-width:200px"><span>1日あたりの予約上限</span>
          <input type="number" id="capacity" min="1" step="1" value="${esc(cap)}" /></label>
        <div class="save-bar"><button class="btn btn-primary" id="save-capacity">保存する</button></div>
      </div>
      <div class="card card-pad editor-card">
        <h3 class="card-title">システム情報</h3>
        <dl class="detail-list" style="margin-top:.6rem">
          <div class="detail-row"><dt>メール通知</dt><dd>サーバー側の環境設定で管理（表示のみ）</dd></div>
          <div class="detail-row"><dt>コンテンツ最終更新</dt><dd>${fmtDateTime(content.updatedAt)}</dd></div>
          <div class="detail-row"><dt>登録プラン数</dt><dd>${Array.isArray(content.plans) ? content.plans.length : 0} 件</dd></div>
          <div class="detail-row"><dt>休業日</dt><dd>${Array.isArray(content.blockedDates) ? content.blockedDates.length : 0} 日</dd></div>
        </dl>
      </div>`;
    $('#save-capacity').addEventListener('click', (e) => {
      const val = parseInt($('#capacity').value, 10);
      if (!Number.isFinite(val) || val < 1) { toast('1以上の数値を入力してください。', 'error'); return; }
      saveContent({ capacityPerDay: val }, e.currentTarget, '予約上限を保存しました。');
    });
  }

  // ════════════════ ドロワー制御 ════════════════
  function openDrawer(title, html) {
    $('#drawer-title').textContent = title;
    $('#drawer-body').innerHTML = html;
    $('#drawer').hidden = false;
    $('#drawer-scrim').hidden = false;
  }
  function closeDrawer() {
    $('#drawer').hidden = true;
    $('#drawer-scrim').hidden = true;
  }
  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  // ════════════════ 起動 ════════════════
  console.info(
    '%c usher in making %c 管理コンソール ',
    'background:#2f6f6a;color:#fff;border-radius:3px 0 0 3px;padding:2px 6px;font-weight:700',
    'background:#142028;color:#fff;border-radius:0 3px 3px 0;padding:2px 6px',
    '\n  ルート: #/dashboard, #/reservations, #/contacts, #/content, #/settings' +
    '\n  API   : /api/admin（login/verify/stats/contacts/reservations/update-*）, /api/content' +
    '\n  認証  : Bearer トークン（sessionStorage）／401で自動ログアウト'
  );

  (async function init() {
    if (!getToken()) return showLogin('');
    try {
      const res = await api('/api/admin?action=verify');
      res.ok ? showApp() : showLogin('');
    } catch {
      showLogin('');
    }
  })();
})();
