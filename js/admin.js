// ════════════════════════════════════════════════════════════════
// 管理コンソール — usher in making
//  ・ハッシュルーティング（#/dashboard 等）による 7 セクション切替
//    dashboard / reservations / contacts / content / pages / seo / settings
//  ・/api/admin・/api/content・/api/pages・/api/seo・/api/rebuild と連携
//  ・トークンは sessionStorage 保持／401 で自動ログアウト
//  ・契約（.agents/contract.md：契約 v4）のエンドポイント・スキーマに厳密準拠
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

  // ─── 多言語（JA/EN）ヘルパー（契約 v3）──────────────────
  //   保存値は { ja, en } オブジェクト。後方互換として文字列も {ja:値, en:''} に正規化。
  function ml(v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return { ja: v.ja == null ? '' : String(v.ja), en: v.en == null ? '' : String(v.en) };
    }
    return { ja: v == null ? '' : String(v), en: '' };
  }
  // JA/EN 2入力の HTML を生成。attrName は 'id'（単一フォーム）か 'data-k'（プラン行内）。
  function mlInputs(attrName, base, val, opts = {}) {
    const m = ml(val);
    const ph = opts.ph || '';
    const ctrl = (lang) => {
      const a = `${attrName}="${base}-${lang}"`;
      return opts.textarea
        ? `<textarea ${a} rows="${opts.rows || 2}" placeholder="${esc(ph)}">${esc(m[lang])}</textarea>`
        : `<input type="text" ${a} placeholder="${esc(ph)}" value="${esc(m[lang])}" />`;
    };
    return `<div class="ml-pair">
      <div class="ml-cell"><em class="ml-tag">日本語</em>${ctrl('ja')}</div>
      <div class="ml-cell"><em class="ml-tag en">English</em>${ctrl('en')}</div>
    </div>`;
  }
  // ラベル付きの JA/EN フィールド（単一フォーム用、id 参照）。
  function mlField(base, label, val, opts) {
    return `<div class="field"><span>${esc(label)}</span>${mlInputs('id', base, val, opts)}</div>`;
  }
  // 読み出し: id ベース / 行（data-k）ベース。
  function mlReadId(base) {
    const g = (lang) => { const el = $(`#${base}-${lang}`); return el ? el.value.trim() : ''; };
    return { ja: g('ja'), en: g('en') };
  }
  function mlReadRow(row, k) {
    const g = (lang) => { const el = row.querySelector(`[data-k="${k}-${lang}"]`); return el ? el.value.trim() : ''; };
    return { ja: g('ja'), en: g('en') };
  }

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
    pages:        { title: 'ページ管理',     render: renderPages },
    seo:          { title: 'SEO / AEO',      render: renderSeo },
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
        <p class="sub">公開サイトのお知らせ・プラン・休業日・各種情報を編集</p></div>
        <span class="sub" id="content-updated"></span></div>
      <div class="tabbar" id="content-tabs">
        <button class="tab-btn is-active" data-ctab="notice">お知らせ</button>
        <button class="tab-btn" data-ctab="plans">プラン管理</button>
        <button class="tab-btn" data-ctab="blocked">休業日</button>
        <button class="tab-btn" data-ctab="studio">スタジオ情報</button>
        <button class="tab-btn" data-ctab="hero">トップ</button>
        <button class="tab-btn" data-ctab="event">イベント</button>
        <button class="tab-btn" data-ctab="gallery">ギャラリー</button>
      </div>
      <div class="tab-pane is-active" data-cpane="notice"></div>
      <div class="tab-pane" data-cpane="plans"></div>
      <div class="tab-pane" data-cpane="blocked"></div>
      <div class="tab-pane" data-cpane="studio"></div>
      <div class="tab-pane" data-cpane="hero"></div>
      <div class="tab-pane" data-cpane="event"></div>
      <div class="tab-pane" data-cpane="gallery"></div>`;

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
    renderStudioPane();
    renderHeroPane();
    renderEventPane();
    renderGalleryPane();
  }

  // 空欄維持の共通案内文（hero / event）
  const KEEP_HINT = '空欄の場合は現在のサイト表示を維持します。';

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
          ${mlField('notice-text', 'お知らせ文', n.text, { textarea: true, rows: 2, ph: '例）年末年始は休業いたします。' })}
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
        text: mlReadId('notice-text'),
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
        <div class="field wide"><span>プラン名</span>${mlInputs('data-k', 'name', p.name, { ph: 'ウェディングフォト' })}</div>
        <label class="field"><span>料金</span><input type="text" data-k="price" value="${esc(p.price || '')}" placeholder="¥100,000(税込)" /></label>
        <label class="field"><span>撮影時間など</span><input type="text" data-k="duration" value="${esc(p.duration || '')}" placeholder="撮影2時間ほど" /></label>
        <label class="field"><span>並び順 / ID</span><input type="text" data-k="id" value="${esc(p.id || '')}" placeholder="wedding" /></label>
        <div class="field wide"><span>説明</span>${mlInputs('data-k', 'description', p.description, { textarea: true, rows: 2, ph: 'プランの紹介文' })}</div>
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
        name: mlReadRow(row, 'name'),
        price: v('price'),
        duration: v('duration'),
        description: mlReadRow(row, 'description'),
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

  // ─ スタジオ情報（SNS・メール）─
  function renderStudioPane() {
    const s = content.studio || {};
    const pane = $('[data-cpane="studio"]');
    pane.innerHTML = `
      <div class="card card-pad editor-card">
        <div class="editor-grid">
          <label class="field"><span>LINE URL</span>
            <input type="text" id="studio-line" placeholder="https://line.me/ti/p/…" value="${esc(s.line || '')}" /></label>
          <label class="field"><span>Instagram URL</span>
            <input type="text" id="studio-instagram" placeholder="https://www.instagram.com/…" value="${esc(s.instagram || '')}" /></label>
          <label class="field"><span>KakaoTalk URL</span>
            <input type="text" id="studio-kakao" placeholder="http://qr.kakao.com/talk/…" value="${esc(s.kakao || '')}" /></label>
          <label class="field"><span>Blog URL</span>
            <input type="text" id="studio-blog" placeholder="https://blog.naver.com/…" value="${esc(s.blog || '')}" /></label>
          <label class="field"><span>メール</span>
            <input type="text" id="studio-email" placeholder="info@example.com" value="${esc(s.email || '')}" /></label>
          <p class="help-text">公開サイト全ページの SNS リンク・連絡先に反映されます。</p>
        </div>
        <div class="save-bar">
          <button class="btn btn-primary" id="save-studio">保存する</button>
        </div>
      </div>`;
    $('#save-studio').addEventListener('click', (e) => {
      saveContent({ studio: {
        line: $('#studio-line').value.trim(),
        instagram: $('#studio-instagram').value.trim(),
        kakao: $('#studio-kakao').value.trim(),
        blog: $('#studio-blog').value.trim(),
        email: $('#studio-email').value.trim(),
      } }, e.currentTarget, 'スタジオ情報を保存しました。');
    });
  }

  // ─ トップ（メインヒーロー）─
  function renderHeroPane() {
    const h = content.hero || {};
    const pane = $('[data-cpane="hero"]');
    pane.innerHTML = `
      <div class="card card-pad editor-card">
        <div class="editor-grid">
          ${mlField('hero-eyebrow', 'アイブロウ（小見出し）', h.eyebrow, { ph: '例）OKINAWA WEDDING PHOTO' })}
          ${mlField('hero-title', 'タイトル', h.title, { ph: 'メインのキャッチコピー' })}
          ${mlField('hero-subtitle', 'サブタイトル', h.subtitle, { textarea: true, rows: 2, ph: '補足のリード文' })}
          <p class="help-text">${esc(KEEP_HINT)}</p>
        </div>
        <div class="save-bar">
          <button class="btn btn-primary" id="save-hero">保存する</button>
        </div>
      </div>`;
    $('#save-hero').addEventListener('click', (e) => {
      saveContent({ hero: {
        eyebrow: mlReadId('hero-eyebrow'),
        title: mlReadId('hero-title'),
        subtitle: mlReadId('hero-subtitle'),
      } }, e.currentTarget, 'トップの内容を保存しました。');
    });
  }

  // ─ イベント ─
  function renderEventPane() {
    const ev = content.event || {};
    const pane = $('[data-cpane="event"]');
    pane.innerHTML = `
      <div class="card card-pad editor-card">
        <div class="editor-grid">
          <label class="switch">
            <input type="checkbox" id="event-enabled" ${ev.enabled ? 'checked' : ''} />
            <span class="track"></span>
            <span>イベント情報を公開サイトに表示する</span>
          </label>
          ${mlField('event-title', 'タイトル', ev.title, { ph: '例）夏季キャンペーン' })}
          ${mlField('event-body', '本文', ev.body, { textarea: true, rows: 4, ph: 'イベントの内容' })}
          ${mlField('event-period', '期間', ev.period, { ph: '例）2026/07/01〜2026/08/31' })}
          <p class="help-text">${esc(KEEP_HINT)}</p>
        </div>
        <div class="save-bar">
          <button class="btn btn-primary" id="save-event">保存する</button>
        </div>
      </div>`;
    $('#save-event').addEventListener('click', (e) => {
      saveContent({ event: {
        enabled: $('#event-enabled').checked,
        title: mlReadId('event-title'),
        body: mlReadId('event-body'),
        period: mlReadId('event-period'),
      } }, e.currentTarget, 'イベント情報を保存しました。');
    });
  }

  // ─ ギャラリー（契約 v3）─
  const GAL_SLOTS = [
    ['top', 'トップ'],
    ['top-dress', 'トップ・ドレス'],
    ['wedding', 'ウェディング'],
    ['anniversary', 'アニバーサリー'],
  ];
  let galWorking = {};        // 編集中の全スロット { slot: { items:[...] } }
  let galSlot = 'top';        // 表示中スロット
  let manifestImages = null;  // images/manifest.json のキャッシュ（正規化済みオブジェクト配列）
  let pickerSelected = [];    // ピッカーで選択中の src
  let pickerOnAdd = null;     // 確定時コールバック (srcs[]) => void（ギャラリー / ページ写真 / OG画像で共用）
  let pickerSingle = false;   // 単一選択モード（OG画像など）
  let pickerFilterUse = '';   // 使用ページ絞り込み（カテゴリ名 / '' = すべて）
  let pickerFilterOrient = 'all'; // 向き絞り込み（all / portrait / landscape）
  let pickerVisibleCount = 0; // フィルタ後の表示件数（カウント表示用）

  function normGalItem(it) {
    it = it || {};
    return {
      src: it.src ? String(it.src) : '',
      href: it.href ? String(it.href) : '',
      caption: ml(it.caption),
      visible: it.visible !== false,
    };
  }
  function normGalleries(g) {
    const out = {};
    GAL_SLOTS.forEach(([k]) => {
      const slot = g && g[k];
      const items = slot && Array.isArray(slot.items) ? slot.items : [];
      out[k] = { items: items.map(normGalItem).filter((it) => it.src) };
    });
    return out;
  }

  function renderGalleryPane() {
    galWorking = normGalleries(content.galleries);
    if (!galWorking[galSlot]) galSlot = 'top';
    const pane = $('[data-cpane="gallery"]');
    pane.innerHTML = `
      <div class="gal-toolbar">
        <label class="field" style="max-width:300px"><span>スロット（表示位置）</span>
          <select id="gal-slot">
            ${GAL_SLOTS.map(([k, label]) => `<option value="${k}"${k === galSlot ? ' selected' : ''}>${esc(label)}</option>`).join('')}
          </select></label>
        <div class="gal-add-bar">
          <button type="button" class="btn btn-ghost btn-sm" id="gal-pick">＋ 画像を選ぶ</button>
          <button type="button" class="btn btn-ghost btn-sm" id="gal-upload">⤴ アップロード</button>
          <input type="file" id="gal-file" accept="image/*" multiple hidden />
        </div>
      </div>
      <p class="help-text" style="margin:.2rem 0 1rem">サムネイルの「画像を選ぶ」で既存画像から追加、または端末から「アップロード」します。表示順は ▲▼ で変更、表示トグルで公開/非公開を切替。</p>
      <div class="gal-items" id="gal-items"></div>
      <div class="save-bar"><button class="btn btn-primary" id="save-gallery">ギャラリーを保存する</button>
        <p class="help-text" style="margin:0">変更は「保存」を押すまで公開されません。</p></div>`;

    $('#gal-slot').addEventListener('change', (e) => { galSlot = e.target.value; paintGalItems(); });
    $('#gal-pick').addEventListener('click', () => openPicker({ onAdd: addSrcsToGallery }));
    $('#gal-upload').addEventListener('click', () => $('#gal-file').click());
    $('#gal-file').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []); e.target.value = '';
      const urls = await uploadFiles(files);
      if (urls.length) { addSrcsToGallery(urls); }
    });
    $('#save-gallery').addEventListener('click', (e) => saveGalleries(e.currentTarget));
    paintGalItems();
  }

  function galItemCard(it, i) {
    const fname = (it.src || '').split('/').pop();
    return `<div class="gal-item${it.visible ? '' : ' is-hidden'}" data-idx="${i}">
      <div class="gal-thumb"><img src="${esc(it.src)}" alt="" loading="lazy" /></div>
      <div class="gal-body">
        <div class="gal-item-head">
          <span class="gal-fname" title="${esc(it.src)}">${esc(fname)}</span>
          <div class="gal-ctrls">
            <button type="button" class="icon-btn gal-mini" data-act="up" aria-label="上へ" title="上へ"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></button>
            <button type="button" class="icon-btn gal-mini" data-act="down" aria-label="下へ" title="下へ"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
            <label class="switch" title="公開/非公開"><input type="checkbox" data-vis ${it.visible ? 'checked' : ''} /><span class="track"></span><span style="font-size:.78rem">表示</span></label>
            <button type="button" class="btn btn-danger btn-xs" data-act="del">削除</button>
          </div>
        </div>
        ${mlInputs('data-cap', i, it.caption, { ph: 'キャプション' })}
        <label class="field"><span>リンク先（href・任意）</span><input type="text" data-href value="${esc(it.href || '')}" placeholder="例）gallery-hare-8.html" /></label>
      </div>
    </div>`;
  }

  function paintGalItems() {
    const sel = $('#gal-slot'); if (sel) sel.value = galSlot;
    const slot = galWorking[galSlot] || { items: [] };
    const wrap = $('#gal-items');
    if (!slot.items.length) {
      wrap.innerHTML = emptyState('画像がありません', '「＋ 画像を選ぶ」または「アップロード」から追加してください。');
      return;
    }
    wrap.innerHTML = slot.items.map((it, i) => galItemCard(it, i)).join('');
    $$('#gal-items .gal-item').forEach((card) => {
      const i = Number(card.dataset.idx);
      const item = slot.items[i];
      if (!item) return;
      // キャプションは mlInputs('data-cap', i, …) が data-cap="<i>-ja|en" で出力。
      card.querySelectorAll('[data-cap]').forEach((inp) => {
        const lang = inp.getAttribute('data-cap').endsWith('-en') ? 'en' : 'ja';
        inp.addEventListener('input', () => { item.caption[lang] = inp.value; });
      });
      const hrefEl = card.querySelector('[data-href]');
      if (hrefEl) hrefEl.addEventListener('input', () => { item.href = hrefEl.value.trim(); });
      const vis = card.querySelector('[data-vis]');
      if (vis) vis.addEventListener('change', () => { item.visible = vis.checked; card.classList.toggle('is-hidden', !vis.checked); });
      card.querySelector('[data-act="up"]').addEventListener('click', () => moveGalItem(i, -1));
      card.querySelector('[data-act="down"]').addEventListener('click', () => moveGalItem(i, 1));
      card.querySelector('[data-act="del"]').addEventListener('click', () => { slot.items.splice(i, 1); paintGalItems(); });
    });
  }

  function moveGalItem(i, dir) {
    const items = galWorking[galSlot].items;
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    paintGalItems();
  }

  function saveGalleries(btn) {
    const galleries = {};
    GAL_SLOTS.forEach(([k]) => {
      const items = (galWorking[k] ? galWorking[k].items : []).map((it) => ({
        src: it.src,
        href: it.href || '',
        caption: { ja: it.caption.ja || '', en: it.caption.en || '' },
        visible: it.visible !== false,
      }));
      galleries[k] = { items };
    });
    saveContent({ galleries }, btn, 'ギャラリーを保存しました。');
  }

  function addSrcsToGallery(srcs) {
    const items = galWorking[galSlot].items;
    srcs.forEach((src) => items.push(normGalItem({ src, visible: true })));
    paintGalItems();
    toast(`${srcs.length} 件の画像を追加しました。保存を忘れずに。`, 'ok');
  }

  // ════════════════ 画像ピッカー（manifest.json v2）════════════════
  //   ギャラリー / ページ写真 / OG画像で共用。
  //   opts.onAdd(srcs[]) : 確定時に呼ばれる。opts.single : 単一選択モード。
  //   manifest v2 形式: { src, usedIn:[...], w, h, kb }。v1（文字列配列）も後方互換で受ける。

  // SVG（選択チェック）
  const PICK_CHECK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  // manifest を正規化（v1 文字列配列 / v2 オブジェクト配列 / 旧トップレベル配列のいずれも吸収）
  function normManifest(data) {
    let arr = [];
    if (Array.isArray(data)) arr = data;
    else if (data && Array.isArray(data.images)) arr = data.images;
    return arr.map((it) => {
      if (typeof it === 'string') return { src: it, usedIn: [], w: 0, h: 0, kb: 0 };
      it = it || {};
      return {
        src: String(it.src || ''),
        usedIn: Array.isArray(it.usedIn) ? it.usedIn.map(String) : [],
        w: Number(it.w) || 0,
        h: Number(it.h) || 0,
        kb: Number(it.kb) || 0,
      };
    }).filter((im) => im.src);
  }

  // 使用ページのパスを人が読める名前へ。en/ 接頭辞は「EN:」を付ける。
  function humanPage(path) {
    let p = String(path || '');
    let en = false;
    if (p.startsWith('en/')) { en = true; p = p.slice(3); }
    const f = p.split('/').pop();
    let name;
    if (f === 'index.html') name = 'トップ';
    else if (f === 'wedding.html') name = 'ウェディング';
    else if (f === 'anniversary.html') name = 'アニバーサリー';
    else if (/^dress.*\.html$/i.test(f)) name = 'ドレス';
    else if (/^gallery-.*\.html$/i.test(f)) name = 'ギャラリー詳細';
    else if (/^plan/i.test(f)) name = 'プラン';
    else if (/^contact/i.test(f)) name = 'お問い合わせ';
    else if (/^about/i.test(f)) name = 'ABOUT';
    else name = f;
    return en ? 'EN:' + name : name;
  }

  // フィルタ用カテゴリ（EN/JA を問わず基本ページで分類）。該当しないものは「その他」。
  function pageCategory(path) {
    let p = String(path || '');
    if (p.startsWith('en/')) p = p.slice(3);
    const f = p.split('/').pop();
    if (f === 'index.html') return 'トップ';
    if (f === 'wedding.html') return 'ウェディング';
    if (f === 'anniversary.html') return 'アニバーサリー';
    if (/^dress.*\.html$/i.test(f)) return 'ドレス';
    if (/^gallery-.*\.html$/i.test(f)) return 'ギャラリー詳細';
    return 'その他';
  }

  function orientOf(im) {
    if (im.w && im.h) return im.h > im.w ? 'portrait' : 'landscape';
    return '';
  }

  // モーダルへフィルタバー・プレビューパネルを 1 度だけ注入（admin.html は変更しない）
  function ensurePickerUI() {
    if ($('#picker-filters')) return;
    const grid = $('#picker-grid');
    if (!grid) return;
    const parent = grid.parentNode;

    // ① フィルタバー（使用ページ / 向き）
    const bar = document.createElement('div');
    bar.className = 'picker-filters';
    bar.id = 'picker-filters';
    bar.innerHTML = `
      <label class="field picker-f-use"><span>使用ページ</span>
        <select id="picker-use">
          <option value="">すべて</option>
          <option value="トップ">トップ</option>
          <option value="ウェディング">ウェディング</option>
          <option value="アニバーサリー">アニバーサリー</option>
          <option value="ドレス">ドレス</option>
          <option value="ギャラリー詳細">ギャラリー詳細</option>
          <option value="その他">その他</option>
        </select>
      </label>
      <div class="picker-orient" id="picker-orient" role="group" aria-label="向きで絞り込み">
        <button type="button" data-orient="all" class="is-on">全</button>
        <button type="button" data-orient="portrait">縦</button>
        <button type="button" data-orient="landscape">横</button>
      </div>`;
    parent.insertBefore(bar, grid);

    // ② 本体（グリッド + プレビュー）を flex で横並びに
    const body = document.createElement('div');
    body.className = 'picker-body';
    parent.insertBefore(body, grid);
    body.appendChild(grid);
    const prev = document.createElement('aside');
    prev.className = 'picker-preview';
    prev.id = 'picker-preview';
    body.appendChild(prev);

    // リスナー
    $('#picker-use').addEventListener('change', (e) => { pickerFilterUse = e.target.value; paintPicker(); });
    $$('#picker-orient button').forEach((b) =>
      b.addEventListener('click', () => {
        pickerFilterOrient = b.dataset.orient;
        $$('#picker-orient button').forEach((x) => x.classList.toggle('is-on', x === b));
        paintPicker();
      }));
  }

  function resetPreview() {
    const p = $('#picker-preview');
    if (p) p.innerHTML = '<div class="picker-preview-empty">画像にカーソルを合わせると<br>ここに大きく表示されます</div>';
  }

  function showPreview(im) {
    const p = $('#picker-preview');
    if (!p) return;
    const o = orientOf(im);
    const oLabel = o === 'portrait' ? '縦長' : o === 'landscape' ? '横長' : '—';
    const fname = (im.src || '').split('/').pop();
    const uses = im.usedIn.length
      ? im.usedIn.map((x) => `<li>${esc(humanPage(x))}<small>${esc(x)}</small></li>`).join('')
      : '<li class="muted">使用ページなし</li>';
    p.innerHTML = `
      <div class="picker-preview-img"><img src="${esc(im.src)}" alt="" /></div>
      <div class="picker-preview-info">
        <strong title="${esc(im.src)}">${esc(fname)}</strong>
        <dl>
          <div><dt>向き</dt><dd>${oLabel}</dd></div>
          <div><dt>サイズ</dt><dd>${im.w && im.h ? `${im.w}×${im.h}px` : '不明'}</dd></div>
          <div><dt>容量</dt><dd>${im.kb ? im.kb + 'KB' : '不明'}</dd></div>
        </dl>
        <div class="picker-preview-uses"><span>使用ページ（${im.usedIn.length}）</span><ul>${uses}</ul></div>
      </div>`;
  }

  // サムネイルセル（オーバーレイ情報つき）
  function pickCell(im) {
    const src = im.src;
    const o = orientOf(im);
    const orientLabel = o === 'portrait' ? '縦' : o === 'landscape' ? '横' : '';
    const badges = im.usedIn.slice(0, 2)
      .map((x) => `<span class="pick-badge">${esc(humanPage(x))}</span>`).join('');
    const more = im.usedIn.length > 2
      ? `<span class="pick-badge pick-badge-more">+${im.usedIn.length - 2}</span>` : '';
    return `<button type="button" class="pick-cell${pickerSelected.includes(src) ? ' is-sel' : ''}" data-src="${esc(src)}" title="${esc(src)}">
      <img src="${esc(src)}" alt="" loading="lazy" />
      <span class="pick-check" aria-hidden="true">${PICK_CHECK_SVG}</span>
      <span class="pick-meta">
        <span class="pick-meta-top">
          ${orientLabel ? `<span class="pick-orient">${orientLabel}</span>` : ''}
          ${im.kb ? `<span class="pick-kb">${im.kb}KB</span>` : ''}
        </span>
        <span class="pick-badges">${badges}${more}</span>
      </span>
    </button>`;
  }

  async function openPicker(opts = {}) {
    pickerOnAdd = typeof opts.onAdd === 'function' ? opts.onAdd : null;
    pickerSingle = !!opts.single;
    pickerSelected = [];
    pickerFilterUse = '';
    pickerFilterOrient = 'all';
    $('#picker').hidden = false;
    $('#picker-scrim').hidden = false;
    ensurePickerUI();
    // フィルタ UI を初期状態へ
    $('#picker-search').value = '';
    const useSel = $('#picker-use'); if (useSel) useSel.value = '';
    $$('#picker-orient button').forEach((b) => b.classList.toggle('is-on', b.dataset.orient === 'all'));
    resetPreview();
    const grid = $('#picker-grid');
    if (!manifestImages) {
      grid.innerHTML = loadingRow;
      try {
        const res = await fetch('/images/manifest.json', { cache: 'no-cache' });
        const data = await res.json();
        manifestImages = normManifest(data);
      } catch {
        manifestImages = [];
      }
    }
    paintPicker();
  }
  function closePicker() {
    $('#picker').hidden = true;
    $('#picker-scrim').hidden = true;
  }

  // 検索語・フィルタを適用した一覧
  function filteredImages() {
    const q = ($('#picker-search') ? $('#picker-search').value : '').trim().toLowerCase();
    return manifestImages.filter((im) => {
      if (q && !im.src.toLowerCase().includes(q)) return false;
      if (pickerFilterOrient !== 'all' && orientOf(im) !== pickerFilterOrient) return false;
      if (pickerFilterUse) {
        if (pickerFilterUse === 'その他') {
          if (im.usedIn.some((p) => pageCategory(p) !== 'その他')) return false;
        } else if (!im.usedIn.some((p) => pageCategory(p) === pickerFilterUse)) {
          return false;
        }
      }
      return true;
    });
  }

  function paintPicker() {
    const grid = $('#picker-grid');
    if (!manifestImages || !manifestImages.length) {
      grid.innerHTML = emptyState('画像が見つかりません', 'scripts/build_image_manifest.py を実行して manifest.json を生成してください。');
      pickerVisibleCount = 0;
      updatePickerCount();
      return;
    }
    const list = filteredImages();
    pickerVisibleCount = list.length;
    if (!list.length) {
      grid.innerHTML = emptyState('該当する画像がありません', '検索条件・フィルターを変更してください。');
      updatePickerCount();
      return;
    }
    grid.innerHTML = list.map(pickCell).join('');
    $$('#picker-grid .pick-cell').forEach((cell) => {
      const src = cell.dataset.src;
      const im = manifestImages.find((x) => x.src === src);
      cell.addEventListener('click', () => toggleSelect(src, cell));
      // ダブルクリックで即確定（単一・複数いずれも該当画像を選択して決定）
      cell.addEventListener('dblclick', () => { selectOne(src); confirmPicker(); });
      if (im) {
        cell.addEventListener('mouseenter', () => showPreview(im));
        cell.addEventListener('focus', () => showPreview(im));
      }
    });
    updatePickerCount();
  }

  function toggleSelect(src, cell) {
    const idx = pickerSelected.indexOf(src);
    if (pickerSingle) {
      // 単一選択: 他の選択を解除して 1 件だけ
      pickerSelected = idx >= 0 ? [] : [src];
      $$('#picker-grid .pick-cell').forEach((c) => c.classList.toggle('is-sel', c.dataset.src === src && idx < 0));
    } else {
      if (idx >= 0) pickerSelected.splice(idx, 1); else pickerSelected.push(src);
      cell.classList.toggle('is-sel', pickerSelected.includes(src));
    }
    updatePickerCount();
  }

  function selectOne(src) {
    if (pickerSingle) {
      pickerSelected = [src];
      $$('#picker-grid .pick-cell').forEach((c) => c.classList.toggle('is-sel', c.dataset.src === src));
    } else if (!pickerSelected.includes(src)) {
      pickerSelected.push(src);
    }
  }

  function updatePickerCount() {
    const total = manifestImages ? manifestImages.length : 0;
    const el = $('#picker-count');
    if (el) el.textContent = `選択 ${pickerSelected.length} 件 ／ 表示 ${pickerVisibleCount}/${total}件`;
    const add = $('#picker-add');
    if (add) add.disabled = pickerSelected.length === 0;
  }

  function confirmPicker() {
    if (!pickerSelected.length) return;
    const srcs = pickerSelected.slice();
    const cb = pickerOnAdd;
    closePicker();
    if (cb) cb(srcs);
  }

  // ─ アップロード（/api/upload・base64 JSON）─
  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
      r.readAsDataURL(file);
    });
  }
  //   端末から /api/upload へアップロードし、成功した URL の配列を返す（保存先は呼び出し側が決める）。
  async function uploadFiles(files) {
    const urls = [];
    if (!files.length) return urls;
    for (const file of files) {
      try {
        const dataUrl = await readAsDataURL(file);
        const base64 = String(dataUrl).split(',')[1] || '';
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ filename: file.name, contentType: file.type, data: base64 }),
        });
        if (res.status === 501) { toast('画像アップロードは Blob 未接続のため利用できません', 'error'); break; }
        if (res.status === 401) { clearToken(); showLogin('セッションの有効期限が切れました。再度ログインしてください。'); return urls; }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { toast(data.error || `アップロードに失敗しました (${res.status})`, 'error'); break; }
        if (data.url) urls.push(data.url);
      } catch (err) {
        toast(err.message || 'アップロードに失敗しました。', 'error');
        break;
      }
    }
    return urls;
  }

  // ════════════════ ⑤ ページ管理（契約 v4）════════════════
  //  GET /api/pages?path=X → {path, regions}（KV+defaults マージ）／ POST {path, regions} 部分マージ。
  //  region 値の形で型を判定: {lines:[...]}=lines / {items:[...]}=photos / それ以外=text({ja,en})。
  //  en/ は別エントリではなく同一キーの locale 扱い（契約 v4）→ 非en パスのみ列挙。
  const PAGE_PATHS_FALLBACK = [
    'index.html', 'about.html', 'wedding.html', 'anniversary.html', 'dress.html',
    'plan.html', 'event.html', 'contact.html', 'reserve.html',
    'gallery-hare-3.html', 'gallery-hare-4.html', 'gallery-hare-6.html', 'gallery-hare-7.html',
    'gallery-hare-8.html', 'gallery-hare-9.html', 'gallery-kumori-1.html', 'gallery-sakura-2.html',
    'gallery-11.html', 'gallery-couple-7.html', 'gallery-jp-couple-6.html', 'gallery-self-8.html',
    'gallery-date.html', 'gallery-date-rain.html', 'gallery-family.html', 'gallery-family-753.html',
    'gallery-wedding.html', 'gallery-x11.html', 'gallery-x13.html', 'gallery-x17.html',
    'gallery-x18.html', 'gallery-x20.html',
    'dress-abreel.html', 'dress-annabel-white.html', 'dress-hanabi-vintage-line.html',
    'dress-nanimo.html', 'dress-retro-vintage.html', 'dress-roco-29.html',
    'dress-wearable-33.html', 'dress-yure-30.html',
  ];
  // SEO は en/ も別キー（seo.json マイグレーション）→ reserve 以外は en/ 版も候補に。
  const SEO_PATHS_FALLBACK = (() => {
    const noEn = new Set(['reserve.html', 'privacy.html', 'tokushoho.html']);
    const out = [];
    PAGE_PATHS_FALLBACK.forEach((p) => { out.push(p); if (!noEn.has(p)) out.push('en/' + p); });
    return out;
  })();

  let pagesPath = '';      // 選択中ページ
  let pageRegions = [];    // [{id, type:'text'|'lines'|'photos', value|lines|items}]

  // API レスポンスからパス一覧を寛容に抽出（{paths}/{pages}/配列/オブジェクトキー 等）。
  function extractPaths(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data.filter((x) => typeof x === 'string');
    for (const key of ['paths', 'pages', 'keys', 'list', 'defaults']) {
      const v = data[key];
      if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
      if (v && typeof v === 'object') return Object.keys(v);
    }
    return [];
  }
  async function fetchPathList(endpoint) {
    try {
      const data = await api(endpoint, { method: 'GET' });
      const list = extractPaths(data);
      if (list.length) return list;
    } catch (_) { /* path 必須で 400 等 → フォールバックへ */ }
    return null;
  }
  function pageSelectHtml(id, list, current) {
    return `<select id="${id}">
      <option value=""${current ? '' : ' selected'}>— ページを選択 —</option>
      ${list.map((p) => `<option value="${esc(p)}"${p === current ? ' selected' : ''}>${esc(p)}</option>`).join('')}
    </select>`;
  }

  // region 正規化（型判定）
  function normRegion(id, val) {
    if (val && typeof val === 'object' && Array.isArray(val.lines)) {
      return { id, type: 'lines', lines: val.lines.map((l) => ({ text: ml(l && l.text), dim: !!(l && l.dim) })) };
    }
    if (val && typeof val === 'object' && Array.isArray(val.items)) {
      return { id, type: 'photos', items: val.items.map((it) => ({ src: it && it.src ? String(it.src) : '', caption: ml(it && it.caption) })).filter((it) => it.src) };
    }
    return { id, type: 'text', value: ml(val) };
  }

  async function renderPages(root) {
    root.innerHTML = `
      <div class="section-head"><div><h2>ページ管理</h2>
        <p class="sub">各ページの本文（ヒーロー・見出し・写真など）を JA / EN で編集</p></div></div>
      <div class="card card-pad" style="margin-bottom:1.2rem">
        <label class="field" style="max-width:440px"><span>編集するページ</span>
          <div id="pg-select-wrap"><select disabled><option>読み込み中…</option></select></div></label>
        <p class="help-text">英語ページは同じ項目の「English」欄で編集します（en/ の別ページではありません）。</p>
      </div>
      <div id="pg-body">${emptyState('ページを選択してください', '上のセレクターから編集するページを選びます。')}</div>`;
    const list = (await fetchPathList('/api/pages')) || PAGE_PATHS_FALLBACK;
    const wrap = $('#pg-select-wrap');
    if (!wrap) return; // ビューが切替済み
    wrap.innerHTML = pageSelectHtml('pg-select', list, pagesPath);
    $('#pg-select').addEventListener('change', (e) => loadPage(e.target.value));
    if (pagesPath && list.includes(pagesPath)) loadPage(pagesPath);
  }

  async function loadPage(path) {
    pagesPath = path;
    const body = $('#pg-body');
    if (!body) return;
    if (!path) {
      body.innerHTML = emptyState('ページを選択してください', '上のセレクターから編集するページを選びます。');
      return;
    }
    body.innerHTML = loadingRow;
    try {
      const data = await api(`/api/pages?path=${encodeURIComponent(path)}`, { method: 'GET' });
      const regions = (data && data.regions) || {};
      pageRegions = Object.entries(regions).map(([id, val]) => normRegion(id, val));
      if (!pageRegions.length) {
        body.innerHTML = emptyState('編集できる領域がありません', 'このページには編集可能な領域（data-region）が定義されていません。');
        return;
      }
      body.innerHTML = `
        <p class="help-text" style="margin:0 0 1rem">JA / EN 両方を編集できます。EN が空欄の場合、公開時に JA で補完されます。</p>
        <div id="pg-regions"></div>
        <div class="save-bar"><button class="btn btn-primary" id="save-pages">このページを保存する</button>
          <p class="help-text" style="margin:0">保存後、ヘッダーの「公開」で本番サイトに反映されます。</p></div>`;
      paintPageRegions();
      $('#save-pages').addEventListener('click', (e) => savePage(e.currentTarget));
    } catch (err) {
      if (err.message === 'unauthorized') return;
      body.innerHTML = emptyState('読み込みに失敗しました', err.message, true);
      toast(err.message, 'error');
    }
  }

  const PG_TYPE_LABEL = { text: 'テキスト', lines: '行リスト', photos: '写真' };

  function paintPageRegions() {
    const wrap = $('#pg-regions');
    if (!wrap) return;
    wrap.innerHTML = pageRegions.map((r, i) => {
      const head = `<div class="pg-region-head"><span class="pg-rtype">${PG_TYPE_LABEL[r.type] || r.type}</span><code class="pg-rid">${esc(r.id)}</code></div>`;
      if (r.type === 'text') {
        return `<div class="pg-region" data-ri="${i}">${head}${mlInputs('data-rk', `r${i}`, r.value, { textarea: true, rows: 2 })}</div>`;
      }
      if (r.type === 'lines') {
        const lines = r.lines.map((l, j) => `
          <div class="pg-line" data-li="${j}">
            <div class="pg-line-main">${mlInputs('data-lk', `r${i}l${j}`, l.text)}</div>
            <div class="pg-line-ctrls">
              <label class="switch" title="淡色表示（dim）"><input type="checkbox" data-dim ${l.dim ? 'checked' : ''} /><span class="track"></span><span style="font-size:.78rem">淡色</span></label>
              <button type="button" class="icon-btn gal-mini" data-lact="up" aria-label="上へ" title="上へ"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></button>
              <button type="button" class="icon-btn gal-mini" data-lact="down" aria-label="下へ" title="下へ"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
              <button type="button" class="btn btn-danger btn-xs" data-lact="del">削除</button>
            </div>
          </div>`).join('');
        return `<div class="pg-region" data-ri="${i}">${head}
          <div class="pg-lines">${lines || '<p class="help-text" style="margin:0">行がありません。「＋ 行を追加」で追加してください。</p>'}</div>
          <button type="button" class="btn btn-ghost btn-sm" data-addline>＋ 行を追加</button></div>`;
      }
      // photos
      const items = r.items.map((it, j) => {
        const fname = (it.src || '').split('/').pop();
        return `<div class="gal-item" data-pi="${j}">
          <div class="gal-thumb"><img src="${esc(it.src)}" alt="" loading="lazy" /></div>
          <div class="gal-body">
            <div class="gal-item-head"><span class="gal-fname" title="${esc(it.src)}">${esc(fname)}</span>
              <div class="gal-ctrls">
                <button type="button" class="icon-btn gal-mini" data-pact="up" aria-label="上へ" title="上へ"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></button>
                <button type="button" class="icon-btn gal-mini" data-pact="down" aria-label="下へ" title="下へ"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
                <button type="button" class="btn btn-danger btn-xs" data-pact="del">削除</button>
              </div>
            </div>
            ${mlInputs('data-pcap', `r${i}p${j}`, it.caption, { ph: 'キャプション' })}
          </div>
        </div>`;
      }).join('');
      return `<div class="pg-region" data-ri="${i}">${head}
        <div class="gal-add-bar" style="margin-bottom:.7rem">
          <button type="button" class="btn btn-ghost btn-sm" data-pact="pick">＋ 画像を選ぶ</button>
          <button type="button" class="btn btn-ghost btn-sm" data-pact="upload">⤴ アップロード</button>
          <input type="file" data-pfile accept="image/*" multiple hidden />
        </div>
        <div class="gal-items">${items || emptyState('画像がありません', '「＋ 画像を選ぶ」または「アップロード」から追加してください。')}</div></div>`;
    }).join('');
    bindPageRegions();
  }

  function bindPageRegions() {
    $$('#pg-regions .pg-region').forEach((card) => {
      const r = pageRegions[Number(card.dataset.ri)];
      if (!r) return;
      if (r.type === 'text') {
        card.querySelectorAll('[data-rk]').forEach((inp) => {
          const lang = inp.getAttribute('data-rk').endsWith('-en') ? 'en' : 'ja';
          inp.addEventListener('input', () => { r.value[lang] = inp.value; });
        });
        return;
      }
      if (r.type === 'lines') {
        $$('.pg-line', card).forEach((row) => {
          const j = Number(row.dataset.li);
          const line = r.lines[j];
          if (!line) return;
          row.querySelectorAll('[data-lk]').forEach((inp) => {
            const lang = inp.getAttribute('data-lk').endsWith('-en') ? 'en' : 'ja';
            inp.addEventListener('input', () => { line.text[lang] = inp.value; });
          });
          const dim = row.querySelector('[data-dim]');
          if (dim) dim.addEventListener('change', () => { line.dim = dim.checked; });
          row.querySelector('[data-lact="up"]').addEventListener('click', () => moveInArr(r.lines, j, -1));
          row.querySelector('[data-lact="down"]').addEventListener('click', () => moveInArr(r.lines, j, 1));
          row.querySelector('[data-lact="del"]').addEventListener('click', () => { r.lines.splice(j, 1); paintPageRegions(); });
        });
        card.querySelector('[data-addline]').addEventListener('click', () => { r.lines.push({ text: { ja: '', en: '' }, dim: false }); paintPageRegions(); });
        return;
      }
      // photos
      $$('.gal-item', card).forEach((row) => {
        const j = Number(row.dataset.pi);
        const item = r.items[j];
        if (!item) return;
        row.querySelectorAll('[data-pcap]').forEach((inp) => {
          const lang = inp.getAttribute('data-pcap').endsWith('-en') ? 'en' : 'ja';
          inp.addEventListener('input', () => { item.caption[lang] = inp.value; });
        });
        row.querySelector('[data-pact="up"]').addEventListener('click', () => moveInArr(r.items, j, -1));
        row.querySelector('[data-pact="down"]').addEventListener('click', () => moveInArr(r.items, j, 1));
        row.querySelector('[data-pact="del"]').addEventListener('click', () => { r.items.splice(j, 1); paintPageRegions(); });
      });
      const pickBtn = card.querySelector('[data-pact="pick"]');
      if (pickBtn) pickBtn.addEventListener('click', () => openPicker({ onAdd: (srcs) => { srcs.forEach((src) => r.items.push({ src, caption: { ja: '', en: '' } })); paintPageRegions(); toast(`${srcs.length} 件の画像を追加しました。保存を忘れずに。`, 'ok'); } }));
      const upBtn = card.querySelector('[data-pact="upload"]');
      const fileInp = card.querySelector('[data-pfile]');
      if (upBtn && fileInp) {
        upBtn.addEventListener('click', () => fileInp.click());
        fileInp.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files || []); e.target.value = '';
          const urls = await uploadFiles(files);
          if (urls.length) { urls.forEach((src) => r.items.push({ src, caption: { ja: '', en: '' } })); paintPageRegions(); toast(`${urls.length} 件の画像を追加しました。保存を忘れずに。`, 'ok'); }
        });
      }
    });
  }

  function moveInArr(arr, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    paintPageRegions();
  }

  function collectPageRegions() {
    const out = {};
    pageRegions.forEach((r) => {
      if (r.type === 'lines') {
        out[r.id] = { lines: r.lines.map((l) => ({ text: { ja: l.text.ja || '', en: l.text.en || '' }, dim: !!l.dim })) };
      } else if (r.type === 'photos') {
        out[r.id] = { items: r.items.map((it) => ({ src: it.src, caption: { ja: it.caption.ja || '', en: it.caption.en || '' } })) };
      } else {
        out[r.id] = { ja: r.value.ja || '', en: r.value.en || '' };
      }
    });
    return out;
  }

  async function savePage(btn) {
    if (!pagesPath) return;
    const regions = collectPageRegions();
    const prev = btn.textContent;
    btn.disabled = true; btn.textContent = '保存中…';
    try {
      await api('/api/pages', { method: 'POST', body: JSON.stringify({ path: pagesPath, regions }) });
      toast('ページを保存しました。公開で本番に反映されます。', 'ok');
    } catch (err) {
      if (err.message !== 'unauthorized') toast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = prev;
    }
  }

  // ════════════════ ⑥ SEO / AEO（契約 v4）════════════════
  //  GET /api/seo?path=X → {path, seo}／POST {path, seo} 部分マージ（slug/breadcrumb 等は保持）。
  //  title/description/keywords/ogImage は選択ページ（言語）単位の単一値。
  //  英語版は en/ 始まりのパスを選択して編集（seo.json は en/ も別キー）。FAQ は q/a を JA/EN で保持。
  let seoPath = '';
  let faqWorking = [];

  function normFaq(arr) {
    return (Array.isArray(arr) ? arr : []).map((f) => ({ q: ml(f && f.q), a: ml(f && f.a) }));
  }

  async function renderSeo(root) {
    root.innerHTML = `
      <div class="section-head"><div><h2>SEO / AEO</h2>
        <p class="sub">検索エンジン・AI検索向けのメタ情報と FAQ を編集</p></div></div>
      <div class="card card-pad aeo-guide">
        <div class="aeo-head"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z"/><path d="M9 21h6"/></svg>AEO（AI検索）作成ガイド</div>
        <ul class="aeo-list">
          <li><strong>FAQ は「質問形」で</strong> — ユーザーが実際に検索・質問する文をそのまま Q にします。</li>
          <li><strong>description は「検索意図」を満たす</strong> — 誰に何を提供するかを最初の1〜2文で明確に。</li>
          <li><strong>固有名詞＋地域キーワード</strong>を含める — 例：沖縄／ウェディングフォト／前撮り。</li>
        </ul>
      </div>
      <div class="card card-pad" style="margin:1.2rem 0">
        <label class="field" style="max-width:440px"><span>編集するページ</span>
          <div id="seo-select-wrap"><select disabled><option>読み込み中…</option></select></div></label>
        <p class="help-text">英語ページは <code>en/</code> 始まりのパスを選択してください。</p>
      </div>
      <div id="seo-body">${emptyState('ページを選択してください', '上のセレクターから編集するページを選びます。')}</div>`;
    const list = (await fetchPathList('/api/seo')) || SEO_PATHS_FALLBACK;
    const wrap = $('#seo-select-wrap');
    if (!wrap) return;
    wrap.innerHTML = pageSelectHtml('seo-select', list, seoPath);
    $('#seo-select').addEventListener('change', (e) => loadSeo(e.target.value));
    if (seoPath && list.includes(seoPath)) loadSeo(seoPath);
  }

  async function loadSeo(path) {
    seoPath = path;
    const body = $('#seo-body');
    if (!body) return;
    if (!path) {
      body.innerHTML = emptyState('ページを選択してください', '上のセレクターから編集するページを選びます。');
      return;
    }
    body.innerHTML = loadingRow;
    try {
      const data = await api(`/api/seo?path=${encodeURIComponent(path)}`, { method: 'GET' });
      const s = (data && data.seo && typeof data.seo === 'object') ? data.seo : (data || {});
      faqWorking = normFaq(s.faq);
      const og = s.ogImage || '';
      body.innerHTML = `
        <div class="card card-pad editor-card">
          <div class="editor-grid">
            <label class="field"><span>タイトル（title）</span>
              <input type="text" id="seo-title" value="${esc(s.title || '')}" placeholder="ページタイトル｜usher in making" /></label>
            <label class="field"><span>ディスクリプション（description）</span>
              <textarea id="seo-desc" rows="3" placeholder="検索意図を満たす説明文（120〜160字程度）">${esc(s.description || '')}</textarea></label>
            <label class="field"><span>キーワード（keywords・カンマ区切り）</span>
              <textarea id="seo-keywords" rows="2" placeholder="沖縄ウェディングフォト, 前撮り, …">${esc(s.keywords || '')}</textarea></label>
            <div class="field"><span>OG画像（ogImage）</span>
              <div class="seo-og-row">
                <div class="seo-og-thumb"${og ? '' : ' hidden'} id="seo-og-thumb"><img src="${esc(og)}" alt="" /></div>
                <input type="text" id="seo-og" value="${esc(og)}" placeholder="/images/up/xxxx.jpg" />
                <button type="button" class="btn btn-ghost btn-sm" id="seo-og-pick">画像を選ぶ</button>
              </div></div>
          </div>
        </div>
        <h3 class="card-title" style="margin:1.5rem 0 .3rem">FAQ（よくある質問）</h3>
        <p class="help-text" style="margin:0 0 1rem">AI検索・リッチリザルト向け。質問形の Q と、検索意図に答える A を JA / EN で。</p>
        <div id="faq-list"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="faq-add">＋ FAQ を追加</button>
        <div class="save-bar"><button class="btn btn-primary" id="save-seo">SEO / FAQ を保存する</button>
          <p class="help-text" style="margin:0">保存後、ヘッダーの「公開」で本番サイトに反映されます。</p></div>`;
      $('#seo-og-pick').addEventListener('click', () => openPicker({ single: true, onAdd: (srcs) => setSeoOg(srcs[0]) }));
      $('#seo-og').addEventListener('input', (e) => setSeoOg(e.target.value.trim(), true));
      $('#faq-add').addEventListener('click', () => { faqWorking.push({ q: { ja: '', en: '' }, a: { ja: '', en: '' } }); paintFaq(); });
      $('#save-seo').addEventListener('click', (e) => saveSeo(e.currentTarget));
      paintFaq();
    } catch (err) {
      if (err.message === 'unauthorized') return;
      body.innerHTML = emptyState('読み込みに失敗しました', err.message, true);
      toast(err.message, 'error');
    }
  }

  function setSeoOg(src, fromInput) {
    const input = $('#seo-og');
    const thumb = $('#seo-og-thumb');
    if (input && !fromInput) input.value = src || '';
    if (thumb) {
      if (src) { thumb.querySelector('img').src = src; thumb.hidden = false; }
      else thumb.hidden = true;
    }
  }

  function paintFaq() {
    const wrap = $('#faq-list');
    if (!wrap) return;
    if (!faqWorking.length) {
      wrap.innerHTML = '<p class="help-text" style="margin:0 0 .8rem">FAQ はまだありません。「＋ FAQ を追加」から登録してください。</p>';
      return;
    }
    wrap.innerHTML = faqWorking.map((f, i) => `
      <div class="faq-item" data-fi="${i}">
        <div class="faq-head"><span class="pg-rtype">FAQ ${i + 1}</span><span class="spacer"></span>
          <button type="button" class="btn btn-danger btn-xs" data-faq-del>削除</button></div>
        <div class="field"><span>質問（Q）</span>${mlInputs('data-fq', `f${i}q`, f.q, { ph: '例）沖縄での撮影は何時間かかりますか？' })}</div>
        <div class="field"><span>回答（A）</span>${mlInputs('data-fa', `f${i}a`, f.a, { textarea: true, rows: 3, ph: '質問に直接答える簡潔な文' })}</div>
      </div>`).join('');
    $$('#faq-list .faq-item').forEach((item) => {
      const i = Number(item.dataset.fi);
      const f = faqWorking[i];
      if (!f) return;
      item.querySelectorAll('[data-fq]').forEach((inp) => {
        const lang = inp.getAttribute('data-fq').endsWith('-en') ? 'en' : 'ja';
        inp.addEventListener('input', () => { f.q[lang] = inp.value; });
      });
      item.querySelectorAll('[data-fa]').forEach((inp) => {
        const lang = inp.getAttribute('data-fa').endsWith('-en') ? 'en' : 'ja';
        inp.addEventListener('input', () => { f.a[lang] = inp.value; });
      });
      item.querySelector('[data-faq-del]').addEventListener('click', () => { faqWorking.splice(i, 1); paintFaq(); });
    });
  }

  async function saveSeo(btn) {
    if (!seoPath) return;
    const seo = {
      title: $('#seo-title').value.trim(),
      description: $('#seo-desc').value.trim(),
      keywords: $('#seo-keywords').value.trim(),
      ogImage: $('#seo-og').value.trim(),
      faq: faqWorking
        .map((f) => ({ q: { ja: f.q.ja || '', en: f.q.en || '' }, a: { ja: f.a.ja || '', en: f.a.en || '' } }))
        .filter((f) => f.q.ja || f.q.en || f.a.ja || f.a.en),
    };
    const prev = btn.textContent;
    btn.disabled = true; btn.textContent = '保存中…';
    try {
      await api('/api/seo', { method: 'POST', body: JSON.stringify({ path: seoPath, seo }) });
      toast('SEO / FAQ を保存しました。公開で本番に反映されます。', 'ok');
    } catch (err) {
      if (err.message !== 'unauthorized') toast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = prev;
    }
  }

  // ════════════════ 公開（サイト再構築）════════════════
  //  POST /api/rebuild → 200:再構築開始 / 501:Deploy Hook 未設定の案内。
  let rebuildBusy = false;
  async function rebuild() {
    if (rebuildBusy) return;
    rebuildBusy = true;
    try {
      const res = await fetch('/api/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { clearToken(); showLogin('セッションの有効期限が切れました。再度ログインしてください。'); return; }
      if (res.status === 501) { showRebuildSetup(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || `公開に失敗しました (${res.status})`, 'error'); return; }
      toast('再構築を開始しました（反映まで約1〜2分）', 'ok');
    } catch (err) {
      toast(err.message || '公開に失敗しました。', 'error');
    } finally {
      rebuildBusy = false;
    }
  }
  function showRebuildSetup() {
    openDrawer('公開の設定が必要です', `
      <div class="detail-msg" style="margin-bottom:1.2rem">Vercel で Deploy Hook を作成し、環境変数 <code>DEPLOY_HOOK_URL</code> を設定してください。</div>
      <p class="drawer-section-label">設定手順</p>
      <ol class="setup-steps">
        <li>Vercel プロジェクト → Settings → Git → Deploy Hooks で新規フックを作成。</li>
        <li>発行された URL を環境変数 <code>DEPLOY_HOOK_URL</code> に設定。</li>
        <li>再デプロイ後、「公開」ボタンで本番サイトに反映されます。</li>
      </ol>
      <p class="help-text">編集内容はすでに保存済みです。Deploy Hook 設定後に「公開」を押すと反映されます。</p>`);
  }
  // ヘッダーの「公開」ボタン（アプリシェルの静的要素）
  $('#publish-top').addEventListener('click', async () => {
    const b = $('#publish-top');
    b.disabled = true;
    await rebuild();
    b.disabled = false;
  });

  // ════════════════ ⑦ 設定 ════════════════
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
      <div class="card card-pad editor-card" style="margin-bottom:1.2rem">
        <h3 class="card-title">公開（サイト再構築）</h3>
        <p class="help-text" style="margin:.2rem 0 1rem">編集内容は保存済みです。「公開」を押すと本番HTMLに反映されます（反映まで約1〜2分）。SEO・本文の変更はこの公開後にクローラーへ反映されます。</p>
        <div class="save-bar" style="margin-top:0;border-top:none;padding-top:0">
          <button class="btn btn-primary" id="publish-settings">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
            公開（サイト再構築）</button>
        </div>
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
    $('#publish-settings').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      const prev = b.innerHTML;
      b.disabled = true; b.textContent = '公開中…';
      await rebuild();
      b.disabled = false; b.innerHTML = prev;
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawer(); closePicker(); } });

  // 画像ピッカー（静的要素）の制御
  $('#picker-close').addEventListener('click', closePicker);
  $('#picker-scrim').addEventListener('click', closePicker);
  $('#picker-add').addEventListener('click', confirmPicker);
  $('#picker-search').addEventListener('input', () => paintPicker());

  // ════════════════ 起動 ════════════════
  console.info(
    '%c usher in making %c 管理コンソール ',
    'background:#2f6f6a;color:#fff;border-radius:3px 0 0 3px;padding:2px 6px;font-weight:700',
    'background:#142028;color:#fff;border-radius:0 3px 3px 0;padding:2px 6px',
    '\n  ルート: #/dashboard, #/reservations, #/contacts, #/content, #/pages, #/seo, #/settings' +
    '\n  API   : /api/admin, /api/content, /api/pages, /api/seo, /api/rebuild, /api/upload' +
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
