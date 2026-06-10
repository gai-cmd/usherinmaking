// ════════════════════════════════════════════════════════════════
// 관리 콘솔 — usher in making
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
      showLogin('세션이 만료되었습니다. 다시 로그인해 주세요.');
      throw new Error('unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `오류가 발생했습니다 (${res.status})`);
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
      <div class="ml-cell"><em class="ml-tag">일본어</em>${ctrl('ja')}</div>
      <div class="ml-cell"><em class="ml-tag en">영어(EN)</em>${ctrl('en')}</div>
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
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  }
  function relTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)    return '방금 전';
    if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    return fmtDate(iso);
  }

  // 状態 → バッジ表示（契約のステータス値に準拠）
  const RESV_STATUS = {
    pending:   { label: '대기', tone: 'amber' },
    confirmed: { label: '확정', tone: 'green' },
    cancelled: { label: '취소', tone: 'gray'  },
  };
  const CONTACT_STATUS = {
    new:     { label: '신규',     tone: 'blue'  },
    read:    { label: '확인',     tone: 'gray'  },
    replied: { label: '답변완료', tone: 'green' },
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
  const loadingRow = '<div class="loading-row"><span class="spinner"></span>불러오는 중…</div>';

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
    btn.textContent = '로그인 중…';
    try {
      const res = await fetch('/api/admin?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: $('#password').value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '비밀번호가 올바르지 않습니다.');
      setToken(data.token);
      $('#password').value = '';
      showApp();
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('is-error');
    } finally {
      btn.disabled = false;
      btn.textContent = '로그인';
    }
  });

  $('#logout-btn').addEventListener('click', () => {
    clearToken();
    showLogin('');
  });

  // ════════════════ ルーティング ════════════════
  const ROUTES = {
    dashboard:    { title: '대시보드',     render: renderDashboard },
    reservations: { title: '예약 관리',    render: renderReservations },
    contacts:     { title: '문의',         render: renderContacts },
    content:      { title: '콘텐츠 관리',  render: renderContent },
    pages:        { title: '페이지 관리',  render: renderPages },
    blog:         { title: '블로그',       render: renderBlog },
    seo:          { title: 'SEO / AEO',    render: renderSeo },
    settings:     { title: '설정',         render: renderSettings },
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
    root.innerHTML = `<div class="section-head"><div><h2>대시보드</h2>
      <p class="sub">문의·예약 현황</p></div></div>
      <div class="stat-grid" id="stat-grid">${loadingRow}</div>
      <div class="card"><div class="card-head-row"><h3 class="card-title">최근 활동</h3></div>
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
        stat('blue',  ICO_MAIL,  s.inquiries?.new ?? 0,        '신규 문의') +
        stat('amber', ICO_CLOCK, s.reservations?.pending ?? 0, '예약(대기 중)') +
        stat('green', ICO_CHECK, s.reservations?.upcoming ?? 0,'예정된 예약') +
        stat('teal',  ICO_CAL,   s.reservations?.total ?? 0,   '누적 예약');

      const recent = Array.isArray(s.recent) ? s.recent : [];
      const act = $('#activity');
      if (!recent.length) {
        act.innerHTML = emptyState('아직 데이터가 없습니다', '새로운 문의나 예약이 여기에 표시됩니다.');
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
              <strong>${esc(r.name || '이름 없음')}</strong>
              <div class="a-sum">${esc(isResv ? '예약' : '문의')}・${esc(r.summary || '')}</div>
            </div>
            <span class="activity-time">${relTime(r.createdAt)}</span>
          </div>`;
        }).join('');
      }
    } catch (err) {
      if (err.message === 'unauthorized') return;
      $('#stat-grid').innerHTML = '';
      $('#activity').innerHTML = emptyState('불러오기에 실패했습니다', err.message, true);
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
        <div><h2>예약 관리</h2><p class="sub">예약 확인 및 상태 변경</p></div>
        <div class="filters" id="resv-filters"></div>
      </div>
      <div class="table-wrap"><div class="table-scroll"><table class="data">
        <thead><tr>
          <th>희망일</th><th>이름</th><th>플랜</th><th>연락처</th><th>상태</th><th class="nowrap">접수일</th>
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
      $('#resv-body').innerHTML = `<tr><td colspan="6">${emptyState('불러오기에 실패했습니다', err.message, true)}</td></tr>`;
      toast(err.message, 'error');
    }
  }
  function renderResvFilters() {
    const counts = { all: resvCache.length, pending: 0, confirmed: 0, cancelled: 0 };
    resvCache.forEach((r) => { if (counts[r.status] != null) counts[r.status]++; });
    const defs = [
      ['all', '전체'], ['pending', '대기'], ['confirmed', '확정'], ['cancelled', '취소'],
    ];
    $('#resv-filters').innerHTML = defs.map(([k, label]) =>
      `<button class="chip${resvFilter === k ? ' is-active' : ''}" data-filter="${k}">${label}<span class="count">${counts[k] || 0}</span></button>`
    ).join('');
  }
  function paintResvRows() {
    const body = $('#resv-body');
    const items = resvFilter === 'all' ? resvCache : resvCache.filter((r) => r.status === resvFilter);
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="6">${emptyState('아직 데이터가 없습니다', '이 조건의 예약이 없습니다.')}</td></tr>`;
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
      ['희망일', esc(r.date || '—')],
      ['이름', esc(r.name || '—')],
      ['플랜', esc(r.plan || '—')],
      ['이메일', r.email ? `<a class="cell-mail" href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : '—'],
      ['연락처', esc(r.contact || '—')],
      ['접수일', fmtDateTime(r.createdAt)],
      ['수정일', fmtDateTime(r.updatedAt)],
    ];
    const actions = Object.entries(RESV_STATUS).map(([k, s]) =>
      `<button class="btn btn-ghost btn-sm${r.status === k ? ' is-current' : ''}" data-status="${k}">${esc(s.label)}</button>`
    ).join('');
    openDrawer('예약 상세', `
      <dl class="detail-list">${rows.map(([k, v]) => `<div class="detail-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${r.message ? `<p class="drawer-section-label">메시지</p><div class="detail-msg">${esc(r.message)}</div>` : ''}
      <p class="drawer-section-label">상태 변경</p>
      <div class="status-actions" id="resv-status-actions">${actions}</div>
      ${r.email ? `<div class="drawer-foot"><a class="btn btn-soft btn-block" href="mailto:${esc(r.email)}?subject=${encodeURIComponent('【usher in making】ご予約について')}">이메일로 연락하기</a></div>` : ''}
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
      toast('예약 상태를 변경했습니다.', 'ok');
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
        <div><h2>문의</h2><p class="sub">수신한 문의 관리</p></div>
        <div class="filters" id="contact-filters"></div>
      </div>
      <div class="table-wrap"><div class="table-scroll"><table class="data">
        <thead><tr>
          <th>이름</th><th>이메일</th><th>희망일</th><th>상태</th><th class="nowrap">접수일</th>
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
      $('#contact-body').innerHTML = `<tr><td colspan="5">${emptyState('불러오기에 실패했습니다', err.message, true)}</td></tr>`;
      toast(err.message, 'error');
    }
  }
  function renderContactFilters() {
    const counts = { all: contactCache.length, new: 0, read: 0, replied: 0 };
    contactCache.forEach((c) => { if (counts[c.status] != null) counts[c.status]++; });
    const defs = [['all', '전체'], ['new', '신규'], ['read', '확인'], ['replied', '답변완료']];
    $('#contact-filters').innerHTML = defs.map(([k, label]) =>
      `<button class="chip${contactFilter === k ? ' is-active' : ''}" data-cfilter="${k}">${label}<span class="count">${counts[k] || 0}</span></button>`
    ).join('');
  }
  function paintContactRows() {
    const body = $('#contact-body');
    const items = contactFilter === 'all' ? contactCache : contactCache.filter((c) => c.status === contactFilter);
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="5">${emptyState('아직 데이터가 없습니다', '이 조건의 문의가 없습니다.')}</td></tr>`;
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
      ['이름', esc(c.name || '—')],
      ['이메일', c.email ? `<a class="cell-mail" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'],
      ['희망일', esc(c.date || '—')],
      ['접수일', fmtDateTime(c.createdAt)],
      ['수정일', fmtDateTime(c.updatedAt)],
    ];
    const actions = Object.entries(CONTACT_STATUS).map(([k, s]) =>
      `<button class="btn btn-ghost btn-sm${c.status === k ? ' is-current' : ''}" data-status="${k}">${esc(s.label)}</button>`
    ).join('');
    const replyHref = c.email
      ? `mailto:${esc(c.email)}?subject=${encodeURIComponent('【usher in making】お問い合わせありがとうございます')}&body=${encodeURIComponent((c.name || '') + ' 様\n\nこの度はお問い合わせいただきありがとうございます。\n\n')}`
      : '';
    openDrawer('문의 상세', `
      <dl class="detail-list">${rows.map(([k, v]) => `<div class="detail-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <p class="drawer-section-label">메시지</p>
      <div class="detail-msg">${esc(c.message || '(본문 없음)')}</div>
      <p class="drawer-section-label">상태 변경</p>
      <div class="status-actions" id="contact-status-actions">${actions}</div>
      ${replyHref ? `<div class="drawer-foot"><a class="btn btn-soft btn-block" id="reply-btn" href="${replyHref}">이메일로 답변하기</a></div>` : ''}
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
        toast('문의 상태를 변경했습니다.', 'ok');
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
      <div class="section-head"><div><h2>콘텐츠 관리</h2>
        <p class="sub">공개 사이트의 공지·플랜·휴무일·각종 정보 편집</p></div>
        <span class="sub" id="content-updated"></span></div>
      <div class="tabbar" id="content-tabs">
        <button class="tab-btn is-active" data-ctab="notice">공지</button>
        <button class="tab-btn" data-ctab="plans">플랜 관리</button>
        <button class="tab-btn" data-ctab="blocked">휴무일</button>
        <button class="tab-btn" data-ctab="studio">스튜디오 정보</button>
        <button class="tab-btn" data-ctab="hero">메인</button>
        <button class="tab-btn" data-ctab="event">이벤트</button>
        <button class="tab-btn" data-ctab="gallery">갤러리</button>
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
      root.querySelector('[data-cpane="notice"]').innerHTML = emptyState('불러오기에 실패했습니다', err.message, true);
      toast(err.message, 'error');
      return;
    }
    $('#content-updated').textContent = content.updatedAt ? `최종 수정: ${fmtDateTime(content.updatedAt)}` : '';
    renderNoticePane();
    renderPlansPane();
    renderBlockedPane();
    renderStudioPane();
    renderHeroPane();
    renderEventPane();
    renderGalleryPane();
  }

  // 空欄維持の共通案内文（hero / event）
  const KEEP_HINT = '비워두면 현재 사이트 표시를 유지합니다.';

  // 部分オブジェクトを POST してマージ保存（契約: POST /api/content）
  async function saveContent(partial, btn, okMsg) {
    const prev = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
    try {
      const res = await api('/api/content', { method: 'POST', body: JSON.stringify(partial) });
      if (res.content) content = res.content;
      $('#content-updated').textContent = content.updatedAt ? `최종 수정: ${fmtDateTime(content.updatedAt)}` : '';
      toast(okMsg || '저장했습니다.', 'ok');
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
            <span>메인에 공지 배너 표시</span>
          </label>
          ${mlField('notice-text', '공지 문구', n.text, { textarea: true, rows: 2, ph: '예) 연말연시는 휴무입니다.' })}
          <label class="field"><span>링크 URL(선택)</span>
            <input type="text" id="notice-link" placeholder="https://… 또는 /plan.html" value="${esc(n.link || '')}" />
            <p class="help-text">배너 클릭 시 이동할 주소. 비워두면 링크 없음.</p></label>
        </div>
        <div class="save-bar">
          <button class="btn btn-primary" id="save-notice">저장</button>
        </div>
      </div>`;
    $('#save-notice').addEventListener('click', (e) => {
      saveContent({ notice: {
        enabled: $('#notice-enabled').checked,
        text: mlReadId('notice-text'),
        link: $('#notice-link').value.trim(),
      } }, e.currentTarget, '공지를 저장했습니다.');
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
        <span class="plan-no">플랜 ${i + 1}</span>
        <span class="feat-flag" data-feat-label hidden>★ 추천</span>
        <span class="spacer"></span>
        <label class="switch" title="추천 표시">
          <input type="checkbox" data-k="featured" ${p.featured ? 'checked' : ''} />
          <span class="track"></span><span style="font-size:.8rem">추천</span>
        </label>
        <button type="button" class="btn btn-danger btn-xs" data-remove>삭제</button>
      </div>
      <div class="plan-grid">
        <div class="field wide"><span>플랜명</span>${mlInputs('data-k', 'name', p.name, { ph: '예) 웨딩 포토' })}</div>
        <label class="field"><span>요금</span><input type="text" data-k="price" value="${esc(p.price || '')}" placeholder="¥100,000(세금포함)" /></label>
        <label class="field"><span>촬영 시간 등</span><input type="text" data-k="duration" value="${esc(p.duration || '')}" placeholder="예) 촬영 2시간" /></label>
        <label class="field"><span>정렬 순서 / ID</span><input type="text" data-k="id" value="${esc(p.id || '')}" placeholder="wedding" /></label>
        <div class="field wide"><span>설명</span>${mlInputs('data-k', 'description', p.description, { textarea: true, rows: 2, ph: '플랜 소개문' })}</div>
        <label class="field wide"><span>포함 내역(한 줄에 한 항목)</span><textarea data-k="includes" rows="3" placeholder="데이터 전체 컷\n앨범 1권">${esc(includes)}</textarea></label>
      </div>`;
    row.querySelector('[data-remove]').addEventListener('click', () => { row.remove(); renumberPlans(); });
    const feat = row.querySelector('[data-k="featured"]');
    feat.addEventListener('change', () => row.classList.toggle('is-featured', feat.checked));
    return row;
  }
  function renumberPlans() {
    $$('#plan-list .plan-edit').forEach((row, i) => { row.querySelector('.plan-no').textContent = `플랜 ${i + 1}`; });
  }
  function renderPlansPane() {
    const plans = Array.isArray(content.plans) ? content.plans : [];
    const pane = $('[data-cpane="plans"]');
    pane.innerHTML = `
      <div class="plan-list" id="plan-list"></div>
      <button type="button" class="btn btn-ghost btn-sm" id="add-plan">＋ 플랜 추가</button>
      <div class="save-bar"><button class="btn btn-primary" id="save-plans">플랜 저장</button>
        <p class="help-text" style="margin:0">변경 사항은 [저장]을 누르기 전까지 공개되지 않습니다.</p></div>`;
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
    d.innerHTML = emptyState('플랜이 없습니다', '[＋ 플랜 추가]로 등록해 주세요.');
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
    saveContent({ plans }, btn, '플랜을 저장했습니다.');
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
            <button class="icon-btn" id="cal-prev" aria-label="이전 달"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
            <span class="cal-month" id="cal-month"></span>
            <button class="icon-btn" id="cal-next" aria-label="다음 달"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
          </div>
          <div class="cal-grid" id="cal-grid"></div>
        </div>
        <div class="blocked-side">
          <h4>휴무일 목록(${'<span id="blocked-count"></span>'}일)</h4>
          <div class="blocked-chips" id="blocked-chips"></div>
          <div class="save-bar"><button class="btn btn-primary" id="save-blocked">휴무일 저장</button></div>
          <p class="help-text">날짜를 클릭해 휴무일을 켜고 끕니다. 저장하기 전까지 공개 사이트에 반영되지 않습니다.</p>
        </div>
      </div>`;
    $('#cal-prev').addEventListener('click', () => { shiftMonth(-1); });
    $('#cal-next').addEventListener('click', () => { shiftMonth(1); });
    $('#save-blocked').addEventListener('click', (e) =>
      saveContent({ blockedDates: blockedWorking.slice().sort() }, e.currentTarget, '휴무일을 저장했습니다.'));
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
    $('#cal-month').textContent = `${y}년 ${m + 1}월`;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const now = new Date();
    const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = ['일', '월', '화', '수', '목', '금', '토'];
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
      wrap.innerHTML = '<p class="help-text" style="margin:0">설정된 휴무일이 없습니다.</p>';
      return;
    }
    wrap.innerHTML = sorted.map((d) =>
      `<span class="date-chip">${esc(d)}<button data-rm="${esc(d)}" aria-label="삭제"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>`
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
          <label class="field"><span>이메일</span>
            <input type="text" id="studio-email" placeholder="info@example.com" value="${esc(s.email || '')}" /></label>
          <p class="help-text">공개 사이트 전 페이지의 SNS 링크·연락처에 반영됩니다.</p>
        </div>
        <div class="save-bar">
          <button class="btn btn-primary" id="save-studio">저장</button>
        </div>
      </div>`;
    $('#save-studio').addEventListener('click', (e) => {
      saveContent({ studio: {
        line: $('#studio-line').value.trim(),
        instagram: $('#studio-instagram').value.trim(),
        kakao: $('#studio-kakao').value.trim(),
        blog: $('#studio-blog').value.trim(),
        email: $('#studio-email').value.trim(),
      } }, e.currentTarget, '스튜디오 정보를 저장했습니다.');
    });
  }

  // ─ トップ（メインヒーロー）─
  function renderHeroPane() {
    const h = content.hero || {};
    const pane = $('[data-cpane="hero"]');
    pane.innerHTML = `
      <div class="card card-pad editor-card">
        <div class="editor-grid">
          ${mlField('hero-eyebrow', '아이브로우(소제목)', h.eyebrow, { ph: '예) OKINAWA WEDDING PHOTO' })}
          ${mlField('hero-title', '제목', h.title, { ph: '메인 카피' })}
          ${mlField('hero-subtitle', '서브 제목', h.subtitle, { textarea: true, rows: 2, ph: '보조 리드문' })}
          <p class="help-text">${esc(KEEP_HINT)}</p>
        </div>
        <div class="save-bar">
          <button class="btn btn-primary" id="save-hero">저장</button>
        </div>
      </div>`;
    $('#save-hero').addEventListener('click', (e) => {
      saveContent({ hero: {
        eyebrow: mlReadId('hero-eyebrow'),
        title: mlReadId('hero-title'),
        subtitle: mlReadId('hero-subtitle'),
      } }, e.currentTarget, '메인 내용을 저장했습니다.');
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
            <span>이벤트 정보를 공개 사이트에 표시</span>
          </label>
          ${mlField('event-title', '제목', ev.title, { ph: '예) 여름 캠페인' })}
          ${mlField('event-body', '본문', ev.body, { textarea: true, rows: 4, ph: '이벤트 내용' })}
          ${mlField('event-period', '기간', ev.period, { ph: '예) 2026/07/01〜2026/08/31' })}
          <p class="help-text">${esc(KEEP_HINT)}</p>
        </div>
        <div class="save-bar">
          <button class="btn btn-primary" id="save-event">저장</button>
        </div>
      </div>`;
    $('#save-event').addEventListener('click', (e) => {
      saveContent({ event: {
        enabled: $('#event-enabled').checked,
        title: mlReadId('event-title'),
        body: mlReadId('event-body'),
        period: mlReadId('event-period'),
      } }, e.currentTarget, '이벤트 정보를 저장했습니다.');
    });
  }

  // ─ ギャラリー（契約 v3）─
  const GAL_SLOTS = [
    ['top', '메인'],
    ['top-dress', '메인·드레스'],
    ['wedding', '웨딩'],
    ['anniversary', '애니버서리'],
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
        <label class="field" style="max-width:300px"><span>슬롯(표시 위치)</span>
          <select id="gal-slot">
            ${GAL_SLOTS.map(([k, label]) => `<option value="${k}"${k === galSlot ? ' selected' : ''}>${esc(label)}</option>`).join('')}
          </select></label>
        <div class="gal-add-bar">
          <button type="button" class="btn btn-ghost btn-sm" id="gal-pick">＋ 이미지 선택</button>
          <button type="button" class="btn btn-ghost btn-sm" id="gal-upload">⤴ 업로드</button>
          <input type="file" id="gal-file" accept="image/*" multiple hidden />
        </div>
      </div>
      <p class="help-text" style="margin:.2rem 0 1rem">[이미지 선택]으로 기존 이미지에서 추가하거나, 기기에서 [업로드]합니다. 표시 순서는 ▲▼로 변경, 표시 토글로 공개/비공개를 전환합니다.</p>
      <div class="gal-items" id="gal-items"></div>
      <div class="save-bar"><button class="btn btn-primary" id="save-gallery">갤러리 저장</button>
        <p class="help-text" style="margin:0">변경 사항은 [저장]을 누르기 전까지 공개되지 않습니다.</p></div>`;

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
            <button type="button" class="icon-btn gal-mini" data-act="up" aria-label="위로" title="위로"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></button>
            <button type="button" class="icon-btn gal-mini" data-act="down" aria-label="아래로" title="아래로"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
            <label class="switch" title="공개/비공개"><input type="checkbox" data-vis ${it.visible ? 'checked' : ''} /><span class="track"></span><span style="font-size:.78rem">표시</span></label>
            <button type="button" class="btn btn-danger btn-xs" data-act="del">삭제</button>
          </div>
        </div>
        ${mlInputs('data-cap', i, it.caption, { ph: '캡션' })}
        <label class="field"><span>링크(href·선택)</span><input type="text" data-href value="${esc(it.href || '')}" placeholder="예) gallery-hare-8.html" /></label>
      </div>
    </div>`;
  }

  function paintGalItems() {
    const sel = $('#gal-slot'); if (sel) sel.value = galSlot;
    const slot = galWorking[galSlot] || { items: [] };
    const wrap = $('#gal-items');
    if (!slot.items.length) {
      wrap.innerHTML = emptyState('이미지가 없습니다', '[＋ 이미지 선택] 또는 [업로드]로 추가해 주세요.');
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
    saveContent({ galleries }, btn, '갤러리를 저장했습니다.');
  }

  function addSrcsToGallery(srcs) {
    const items = galWorking[galSlot].items;
    srcs.forEach((src) => items.push(normGalItem({ src, visible: true })));
    paintGalItems();
    toast(`${srcs.length}개 이미지를 추가했습니다. 저장을 잊지 마세요.`, 'ok');
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
    if (f === 'index.html') name = '메인';
    else if (f === 'wedding.html') name = '웨딩';
    else if (f === 'anniversary.html') name = '애니버서리';
    else if (/^dress.*\.html$/i.test(f)) name = '드레스';
    else if (/^gallery-.*\.html$/i.test(f)) name = '갤러리 상세';
    else if (/^plan/i.test(f)) name = '플랜';
    else if (/^contact/i.test(f)) name = '문의';
    else if (/^about/i.test(f)) name = 'ABOUT';
    else name = f;
    return en ? 'EN:' + name : name;
  }

  // フィルタ用カテゴリ（EN/JA を問わず基本ページで分類）。該当しないものは「その他」。
  function pageCategory(path) {
    let p = String(path || '');
    if (p.startsWith('en/')) p = p.slice(3);
    const f = p.split('/').pop();
    if (f === 'index.html') return '메인';
    if (f === 'wedding.html') return '웨딩';
    if (f === 'anniversary.html') return '애니버서리';
    if (/^dress.*\.html$/i.test(f)) return '드레스';
    if (/^gallery-.*\.html$/i.test(f)) return '갤러리 상세';
    return '기타';
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
      <label class="field picker-f-use"><span>사용 페이지</span>
        <select id="picker-use">
          <option value="">전체</option>
          <option value="메인">메인</option>
          <option value="웨딩">웨딩</option>
          <option value="애니버서리">애니버서리</option>
          <option value="드레스">드레스</option>
          <option value="갤러리 상세">갤러리 상세</option>
          <option value="기타">기타</option>
        </select>
      </label>
      <div class="picker-orient" id="picker-orient" role="group" aria-label="방향으로 필터">
        <button type="button" data-orient="all" class="is-on">전체</button>
        <button type="button" data-orient="portrait">세로</button>
        <button type="button" data-orient="landscape">가로</button>
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
    if (p) p.innerHTML = '<div class="picker-preview-empty">이미지에 커서를 올리면<br>여기에 크게 표시됩니다</div>';
  }

  function showPreview(im) {
    const p = $('#picker-preview');
    if (!p) return;
    const o = orientOf(im);
    const oLabel = o === 'portrait' ? '세로' : o === 'landscape' ? '가로' : '—';
    const fname = (im.src || '').split('/').pop();
    const uses = im.usedIn.length
      ? im.usedIn.map((x) => `<li>${esc(humanPage(x))}<small>${esc(x)}</small></li>`).join('')
      : '<li class="muted">사용 페이지 없음</li>';
    p.innerHTML = `
      <div class="picker-preview-img"><img src="${esc(im.src)}" alt="" /></div>
      <div class="picker-preview-info">
        <strong title="${esc(im.src)}">${esc(fname)}</strong>
        <dl>
          <div><dt>방향</dt><dd>${oLabel}</dd></div>
          <div><dt>크기</dt><dd>${im.w && im.h ? `${im.w}×${im.h}px` : '알 수 없음'}</dd></div>
          <div><dt>용량</dt><dd>${im.kb ? im.kb + 'KB' : '알 수 없음'}</dd></div>
        </dl>
        <div class="picker-preview-uses"><span>사용 페이지(${im.usedIn.length})</span><ul>${uses}</ul></div>
      </div>`;
  }

  // サムネイルセル（オーバーレイ情報つき）
  function pickCell(im) {
    const src = im.src;
    const o = orientOf(im);
    const orientLabel = o === 'portrait' ? '세로' : o === 'landscape' ? '가로' : '';
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
        if (pickerFilterUse === '기타') {
          if (im.usedIn.some((p) => pageCategory(p) !== '기타')) return false;
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
      grid.innerHTML = emptyState('이미지를 찾을 수 없습니다', 'scripts/build_image_manifest.py 를 실행해 manifest.json 을 생성해 주세요.');
      pickerVisibleCount = 0;
      updatePickerCount();
      return;
    }
    const list = filteredImages();
    pickerVisibleCount = list.length;
    if (!list.length) {
      grid.innerHTML = emptyState('해당하는 이미지가 없습니다', '검색 조건·필터를 변경해 주세요.');
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
    if (el) el.textContent = `선택 ${pickerSelected.length}개 / 표시 ${pickerVisibleCount}/${total}개`;
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
      r.onerror = () => reject(new Error('파일을 불러오지 못했습니다.'));
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
        if (res.status === 501) { toast('이미지 업로드는 Blob 미연결로 사용할 수 없습니다', 'error'); break; }
        if (res.status === 401) { clearToken(); showLogin('세션이 만료되었습니다. 다시 로그인해 주세요.'); return urls; }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { toast(data.error || `업로드에 실패했습니다 (${res.status})`, 'error'); break; }
        if (data.url) urls.push(data.url);
      } catch (err) {
        toast(err.message || '업로드에 실패했습니다.', 'error');
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
      <option value=""${current ? '' : ' selected'}>— 페이지 선택 —</option>
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
      <div class="section-head"><div><h2>페이지 관리</h2>
        <p class="sub">각 페이지의 본문(히어로·제목·사진 등)을 일본어 / 영어로 편집</p></div></div>
      <div class="card card-pad" style="margin-bottom:1.2rem">
        <label class="field" style="max-width:440px"><span>편집할 페이지</span>
          <div id="pg-select-wrap"><select disabled><option>불러오는 중…</option></select></div></label>
        <p class="help-text">영어 페이지는 같은 항목의 [영어(EN)] 칸에서 편집합니다(en/ 별도 페이지가 아닙니다).</p>
      </div>
      <div id="pg-body">${emptyState('페이지를 선택해 주세요', '위 선택기에서 편집할 페이지를 선택합니다.')}</div>`;
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
      body.innerHTML = emptyState('페이지를 선택해 주세요', '위 선택기에서 편집할 페이지를 선택합니다.');
      return;
    }
    body.innerHTML = loadingRow;
    try {
      const data = await api(`/api/pages?path=${encodeURIComponent(path)}`, { method: 'GET' });
      const regions = (data && data.regions) || {};
      pageRegions = Object.entries(regions).map(([id, val]) => normRegion(id, val));
      if (!pageRegions.length) {
        body.innerHTML = emptyState('편집 가능한 영역이 없습니다', '이 페이지에는 편집 가능한 영역(data-region)이 정의되어 있지 않습니다.');
        return;
      }
      body.innerHTML = `
        <p class="help-text" style="margin:0 0 1rem">일본어 / 영어 모두 편집할 수 있습니다. 영어가 비어 있으면 공개 시 일본어로 채워집니다.</p>
        <div id="pg-regions"></div>
        <div class="save-bar"><button class="btn btn-primary" id="save-pages">이 페이지 저장</button>
          <p class="help-text" style="margin:0">저장 후 헤더의 [발행(사이트 재구축)]으로 운영 사이트에 반영됩니다.</p></div>`;
      paintPageRegions();
      $('#save-pages').addEventListener('click', (e) => savePage(e.currentTarget));
    } catch (err) {
      if (err.message === 'unauthorized') return;
      body.innerHTML = emptyState('불러오기에 실패했습니다', err.message, true);
      toast(err.message, 'error');
    }
  }

  const PG_TYPE_LABEL = { text: '텍스트', lines: '행 목록', photos: '사진' };

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
              <label class="switch" title="흐리게 표시(dim)"><input type="checkbox" data-dim ${l.dim ? 'checked' : ''} /><span class="track"></span><span style="font-size:.78rem">흐리게</span></label>
              <button type="button" class="icon-btn gal-mini" data-lact="up" aria-label="위로" title="위로"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></button>
              <button type="button" class="icon-btn gal-mini" data-lact="down" aria-label="아래로" title="아래로"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
              <button type="button" class="btn btn-danger btn-xs" data-lact="del">삭제</button>
            </div>
          </div>`).join('');
        return `<div class="pg-region" data-ri="${i}">${head}
          <div class="pg-lines">${lines || '<p class="help-text" style="margin:0">행이 없습니다. [＋ 행 추가]로 추가해 주세요.</p>'}</div>
          <button type="button" class="btn btn-ghost btn-sm" data-addline>＋ 행 추가</button></div>`;
      }
      // photos
      const items = r.items.map((it, j) => {
        const fname = (it.src || '').split('/').pop();
        return `<div class="gal-item" data-pi="${j}">
          <div class="gal-thumb"><img src="${esc(it.src)}" alt="" loading="lazy" /></div>
          <div class="gal-body">
            <div class="gal-item-head"><span class="gal-fname" title="${esc(it.src)}">${esc(fname)}</span>
              <div class="gal-ctrls">
                <button type="button" class="icon-btn gal-mini" data-pact="up" aria-label="위로" title="위로"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></button>
                <button type="button" class="icon-btn gal-mini" data-pact="down" aria-label="아래로" title="아래로"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
                <button type="button" class="btn btn-danger btn-xs" data-pact="del">삭제</button>
              </div>
            </div>
            ${mlInputs('data-pcap', `r${i}p${j}`, it.caption, { ph: '캡션' })}
          </div>
        </div>`;
      }).join('');
      return `<div class="pg-region" data-ri="${i}">${head}
        <div class="gal-add-bar" style="margin-bottom:.7rem">
          <button type="button" class="btn btn-ghost btn-sm" data-pact="pick">＋ 이미지 선택</button>
          <button type="button" class="btn btn-ghost btn-sm" data-pact="upload">⤴ 업로드</button>
          <input type="file" data-pfile accept="image/*" multiple hidden />
        </div>
        <div class="gal-items">${items || emptyState('이미지가 없습니다', '[＋ 이미지 선택] 또는 [업로드]로 추가해 주세요.')}</div></div>`;
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
      if (pickBtn) pickBtn.addEventListener('click', () => openPicker({ onAdd: (srcs) => { srcs.forEach((src) => r.items.push({ src, caption: { ja: '', en: '' } })); paintPageRegions(); toast(`${srcs.length}개 이미지를 추가했습니다. 저장을 잊지 마세요.`, 'ok'); } }));
      const upBtn = card.querySelector('[data-pact="upload"]');
      const fileInp = card.querySelector('[data-pfile]');
      if (upBtn && fileInp) {
        upBtn.addEventListener('click', () => fileInp.click());
        fileInp.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files || []); e.target.value = '';
          const urls = await uploadFiles(files);
          if (urls.length) { urls.forEach((src) => r.items.push({ src, caption: { ja: '', en: '' } })); paintPageRegions(); toast(`${urls.length}개 이미지를 추가했습니다. 저장을 잊지 마세요.`, 'ok'); }
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
    btn.disabled = true; btn.textContent = '저장 중…';
    try {
      await api('/api/pages', { method: 'POST', body: JSON.stringify({ path: pagesPath, regions }) });
      toast('페이지를 저장했습니다. 발행하면 운영 사이트에 반영됩니다.', 'ok');
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
        <p class="sub">검색엔진·AI검색용 메타 정보와 FAQ 편집</p></div></div>
      <div class="card card-pad aeo-guide">
        <div class="aeo-head"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z"/><path d="M9 21h6"/></svg>AEO(AI검색) 작성 가이드</div>
        <ul class="aeo-list">
          <li><strong>FAQ는 [질문형]으로</strong> — 사용자가 실제로 검색·질문하는 문장을 그대로 Q로 작성합니다.</li>
          <li><strong>description은 [검색 의도]를 충족</strong> — 누구에게 무엇을 제공하는지 첫 1~2문장에서 명확히.</li>
          <li><strong>고유명사＋지역 키워드</strong>를 포함 — 예: 오키나와／웨딩 포토／전촬영.</li>
        </ul>
      </div>
      <div class="card card-pad" style="margin:1.2rem 0">
        <label class="field" style="max-width:440px"><span>편집할 페이지</span>
          <div id="seo-select-wrap"><select disabled><option>불러오는 중…</option></select></div></label>
        <p class="help-text">영어 페이지는 <code>en/</code>으로 시작하는 경로를 선택하세요.</p>
      </div>
      <div id="seo-body">${emptyState('페이지를 선택해 주세요', '위 셀렉터에서 편집할 페이지를 선택합니다.')}</div>`;
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
      body.innerHTML = emptyState('페이지를 선택해 주세요', '위 셀렉터에서 편집할 페이지를 선택합니다.');
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
            <label class="field"><span>제목 (title)</span>
              <input type="text" id="seo-title" value="${esc(s.title || '')}" placeholder="페이지 제목｜usher in making" /></label>
            <label class="field"><span>설명 (description)</span>
              <textarea id="seo-desc" rows="3" placeholder="검색 의도를 충족하는 설명문 (120~160자 정도)">${esc(s.description || '')}</textarea></label>
            <label class="field"><span>키워드 (keywords, 쉼표 구분)</span>
              <textarea id="seo-keywords" rows="2" placeholder="沖縄ウェディングフォト, 前撮り, …">${esc(s.keywords || '')}</textarea></label>
            <div class="field"><span>OG 이미지 (ogImage)</span>
              <div class="seo-og-row">
                <div class="seo-og-thumb"${og ? '' : ' hidden'} id="seo-og-thumb"><img src="${esc(og)}" alt="" /></div>
                <input type="text" id="seo-og" value="${esc(og)}" placeholder="/images/up/xxxx.jpg" />
                <button type="button" class="btn btn-ghost btn-sm" id="seo-og-pick">이미지 선택</button>
              </div></div>
          </div>
        </div>
        <h3 class="card-title" style="margin:1.5rem 0 .3rem">FAQ (자주 묻는 질문)</h3>
        <p class="help-text" style="margin:0 0 1rem">AI 검색·리치 리절트용. 질문형 Q와 검색 의도에 답하는 A를 일본어/영어로 작성하세요.</p>
        <div id="faq-list"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="faq-add">＋ FAQ 추가</button>
        <div class="save-bar"><button class="btn btn-primary" id="save-seo">SEO / FAQ 저장</button>
          <p class="help-text" style="margin:0">저장 후 헤더의 [발행]으로 실제 사이트에 반영됩니다.</p></div>`;
      $('#seo-og-pick').addEventListener('click', () => openPicker({ single: true, onAdd: (srcs) => setSeoOg(srcs[0]) }));
      $('#seo-og').addEventListener('input', (e) => setSeoOg(e.target.value.trim(), true));
      $('#faq-add').addEventListener('click', () => { faqWorking.push({ q: { ja: '', en: '' }, a: { ja: '', en: '' } }); paintFaq(); });
      $('#save-seo').addEventListener('click', (e) => saveSeo(e.currentTarget));
      paintFaq();
    } catch (err) {
      if (err.message === 'unauthorized') return;
      body.innerHTML = emptyState('불러오기에 실패했습니다', err.message, true);
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
      wrap.innerHTML = '<p class="help-text" style="margin:0 0 .8rem">FAQ가 아직 없습니다. [＋ FAQ 추가]로 등록해 주세요.</p>';
      return;
    }
    wrap.innerHTML = faqWorking.map((f, i) => `
      <div class="faq-item" data-fi="${i}">
        <div class="faq-head"><span class="pg-rtype">FAQ ${i + 1}</span><span class="spacer"></span>
          <button type="button" class="btn btn-danger btn-xs" data-faq-del>삭제</button></div>
        <div class="field"><span>질문 (Q)</span>${mlInputs('data-fq', `f${i}q`, f.q, { ph: '예) 沖縄での撮影は何時間かかりますか？' })}</div>
        <div class="field"><span>답변 (A)</span>${mlInputs('data-fa', `f${i}a`, f.a, { textarea: true, rows: 3, ph: '질문에 직접 답하는 간결한 문장' })}</div>
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
    btn.disabled = true; btn.textContent = '저장 중…';
    try {
      await api('/api/seo', { method: 'POST', body: JSON.stringify({ path: seoPath, seo }) });
      toast('SEO / FAQ를 저장했습니다. [발행]하면 실제 사이트에 반영됩니다.', 'ok');
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
      if (res.status === 401) { clearToken(); showLogin('세션이 만료되었습니다. 다시 로그인해 주세요.'); return; }
      if (res.status === 501) { showRebuildSetup(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || `발행에 실패했습니다 (${res.status})`, 'error'); return; }
      toast('재구축을 시작했습니다 (반영까지 약 1~2분)', 'ok');
    } catch (err) {
      toast(err.message || '발행에 실패했습니다.', 'error');
    } finally {
      rebuildBusy = false;
    }
  }
  function showRebuildSetup() {
    openDrawer('발행 설정이 필요합니다', `
      <div class="detail-msg" style="margin-bottom:1.2rem">Vercel에서 Deploy Hook을 만들고 환경변수 <code>DEPLOY_HOOK_URL</code>을 설정해 주세요.</div>
      <p class="drawer-section-label">설정 순서</p>
      <ol class="setup-steps">
        <li>Vercel 프로젝트 → Settings → Git → Deploy Hooks에서 새 훅 생성.</li>
        <li>발급된 URL을 환경변수 <code>DEPLOY_HOOK_URL</code>에 설정.</li>
        <li>재배포 후 [발행] 버튼으로 실제 사이트에 반영됩니다.</li>
      </ol>
      <p class="help-text">편집 내용은 이미 저장돼 있습니다. Deploy Hook 설정 후 [발행]을 누르면 반영됩니다.</p>`);
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
    root.innerHTML = `<div class="section-head"><div><h2>설정</h2>
      <p class="sub">예약 시스템과 시스템 정보</p></div></div>${loadingRow}`;
    try {
      content = await api('/api/content', { method: 'GET' });
    } catch (err) {
      if (err.message === 'unauthorized') return;
      root.innerHTML = `<div class="section-head"><div><h2>설정</h2></div></div>${emptyState('불러오기에 실패했습니다', err.message, true)}`;
      toast(err.message, 'error');
      return;
    }
    const cap = content.capacityPerDay != null ? content.capacityPerDay : 1;
    root.innerHTML = `
      <div class="section-head"><div><h2>설정</h2><p class="sub">예약 시스템과 시스템 정보</p></div></div>
      <div class="card card-pad editor-card" style="margin-bottom:1.2rem">
        <h3 class="card-title">예약 접수 상한</h3>
        <p class="help-text" style="margin:.2rem 0 1rem">하루에 받을 예약 상한 수입니다. 상한에 도달한 날은 공개 사이트에서 '만석(満員)'으로 표시됩니다.</p>
        <label class="field" style="max-width:200px"><span>1일 예약 상한</span>
          <input type="number" id="capacity" min="1" step="1" value="${esc(cap)}" /></label>
        <div class="save-bar"><button class="btn btn-primary" id="save-capacity">저장</button></div>
      </div>
      <div class="card card-pad editor-card" style="margin-bottom:1.2rem">
        <h3 class="card-title">발행 (사이트 재구축)</h3>
        <p class="help-text" style="margin:.2rem 0 1rem">편집 내용은 저장돼 있습니다. [발행]을 누르면 실제 HTML에 반영됩니다 (약 1~2분 소요). SEO·본문 변경은 발행 후 검색엔진 크롤러에 반영됩니다.</p>
        <div class="save-bar" style="margin-top:0;border-top:none;padding-top:0">
          <button class="btn btn-primary" id="publish-settings">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
            발행 (사이트 재구축)</button>
        </div>
      </div>
      <div class="card card-pad editor-card">
        <h3 class="card-title">시스템 정보</h3>
        <dl class="detail-list" style="margin-top:.6rem">
          <div class="detail-row"><dt>메일 알림</dt><dd>서버 환경변수로 관리 (표시 전용)</dd></div>
          <div class="detail-row"><dt>콘텐츠 최종 수정</dt><dd>${fmtDateTime(content.updatedAt)}</dd></div>
          <div class="detail-row"><dt>등록 플랜 수</dt><dd>${Array.isArray(content.plans) ? content.plans.length : 0}개</dd></div>
          <div class="detail-row"><dt>휴무일</dt><dd>${Array.isArray(content.blockedDates) ? content.blockedDates.length : 0}일</dd></div>
        </dl>
      </div>`;
    $('#save-capacity').addEventListener('click', (e) => {
      const val = parseInt($('#capacity').value, 10);
      if (!Number.isFinite(val) || val < 1) { toast('1 이상의 숫자를 입력해 주세요.', 'error'); return; }
      saveContent({ capacityPerDay: val }, e.currentTarget, '예약 상한을 저장했습니다.');
    });
    $('#publish-settings').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      const prev = b.innerHTML;
      b.disabled = true; b.textContent = '발행 중…';
      await rebuild();
      b.disabled = false; b.innerHTML = prev;
    });
  }

  // ════════════════ ブログ ════════════════
  const BLOG_STATUS = {
    draft:     { label: '초안',   tone: 'amber' },
    published: { label: '공개',   tone: 'green' },
  };
  const tline = (v) => esc((v && (v.ja || v.ko || v.en)) || '(제목 없음)');

  async function renderBlog(root) {
    root.innerHTML = `<div class="section-head">
        <div><h2>블로그</h2><p class="sub">기사 작성·번역, 네이버블로그 가져오기. [공개]로 발행하면 사이트 재구축 시 정적 페이지로 반영됩니다.</p></div>
        <div class="head-actions">
          <button class="btn btn-ghost" id="blog-import-open">네이버 가져오기</button>
          <button class="btn btn-primary" id="blog-new">새 글</button>
        </div>
      </div>${loadingRow}`;
    let posts = [];
    try {
      posts = (await api('/api/posts?all=1', { method: 'GET' })).posts || [];
    } catch (err) {
      if (err.message === 'unauthorized') return;
      root.querySelector('.loading-row').outerHTML = emptyState('불러오기에 실패했습니다', err.message, true);
      toast(err.message, 'error');
      return;
    }
    const rows = posts.length
      ? posts.map((p) => `
        <tr data-id="${esc(p.id)}">
          <td><strong>${tline(p.title)}</strong><br><span class="sub">/blog/${esc(p.slug)}.html</span></td>
          <td>${badge(BLOG_STATUS, p.status)}</td>
          <td>${esc(p.category || '—')}</td>
          <td>${esc(p.date || '—')}</td>
          <td class="lang-flags"><span class="${p.hasJa ? 'on' : 'off'}">JA</span> <span class="${p.hasEn ? 'on' : 'off'}">EN</span></td>
          <td class="row-actions">
            <button class="btn btn-ghost btn-sm" data-act="edit">편집</button>
            <button class="btn btn-ghost btn-sm" data-act="del">삭제</button>
          </td>
        </tr>`).join('')
      : '';
    root.querySelector('.loading-row').outerHTML = posts.length
      ? `<div class="card"><table class="data-table blog-table">
          <thead><tr><th>제목</th><th>상태</th><th>카테고리</th><th>날짜</th><th>번역</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
      : emptyState('아직 기사가 없습니다', '[새 글] 또는 [네이버 가져오기]로 시작하세요.');

    $('#blog-new').addEventListener('click', () => blogEdit(root, null));
    $('#blog-import-open').addEventListener('click', () => blogImport(root));
    root.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelector('[data-act="edit"]').addEventListener('click', () => blogEdit(root, id));
      tr.querySelector('[data-act="del"]').addEventListener('click', async () => {
        if (!confirm('이 기사를 삭제할까요?')) return;
        try {
          await api('/api/posts', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) });
          toast('삭제했습니다.', 'ok');
          renderBlog(root);
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  }

  // ─── 記事エディタ ───────────────────────────────────────────────────────────
  async function blogEdit(root, id) {
    root.innerHTML = loadingRow;
    let post = { id: '', slug: '', status: 'draft', category: '', tags: [], cover: '', date: '', author: 'usher in making', title: {ja:'',en:'',ko:''}, excerpt: {ja:'',en:'',ko:''}, body: {ja:'',en:'',ko:''} };
    if (id) {
      try { post = (await api(`/api/posts?all=1&id=${encodeURIComponent(id)}`, { method: 'GET' })).post; }
      catch (err) { if (err.message === 'unauthorized') return; toast(err.message, 'error'); return renderBlog(root); }
    }
    const tri = (base, m, opts = {}) => {
      const rows = opts.rows || 2;
      const ctl = (lang) => opts.textarea
        ? `<textarea id="${base}-${lang}" rows="${rows}" class="mono">${esc(m[lang] || '')}</textarea>`
        : `<input type="text" id="${base}-${lang}" value="${esc(m[lang] || '')}" />`;
      return `<div class="tri-pair">
        <div class="tri-cell"><em class="ml-tag">일본어 JA</em>${ctl('ja')}</div>
        <div class="tri-cell"><em class="ml-tag en">영어 EN</em>${ctl('en')}</div>
        <div class="tri-cell"><em class="ml-tag ko">원문 KO</em>${ctl('ko')}</div>
      </div>`;
    };
    root.innerHTML = `
      <div class="section-head"><div><h2>${id ? '기사 편집' : '새 기사'}</h2>
        <p class="sub">${post.source && post.source.url ? `원본: <a href="${esc(post.source.url)}" target="_blank" rel="noopener">네이버 글</a>` : '직접 작성'}</p></div>
        <div class="head-actions"><button class="btn btn-ghost" id="blog-back">← 목록</button></div>
      </div>
      <div class="card card-pad editor-card">
        <div class="field-grid">
          <label class="field"><span>슬러그 (URL)</span><input type="text" id="b-slug" value="${esc(post.slug)}" placeholder="okinawa-family-snap" /></label>
          <label class="field"><span>상태</span><select id="b-status">
            <option value="draft"${post.status==='draft'?' selected':''}>초안</option>
            <option value="published"${post.status==='published'?' selected':''}>공개</option>
          </select></label>
          <label class="field"><span>카테고리</span><input type="text" id="b-category" value="${esc(post.category)}" placeholder="스냅" /></label>
          <label class="field"><span>날짜</span><input type="date" id="b-date" value="${esc(post.date)}" /></label>
          <label class="field"><span>태그 (쉼표로 구분)</span><input type="text" id="b-tags" value="${esc((post.tags||[]).join(', '))}" /></label>
          <label class="field"><span>커버 이미지</span><span class="pick-row"><input type="text" id="b-cover" value="${esc(post.cover)}" placeholder="/images/up/... 또는 https://" /><button type="button" class="btn btn-ghost btn-sm" id="b-cover-pick">선택</button></span></label>
        </div>
        <div class="field"><span>제목</span>${tri('b-title', post.title)}</div>
        <div class="field"><span>요약 (목록·검색 설명)</span>${tri('b-excerpt', post.excerpt, {textarea:true, rows:2})}</div>
        <div class="field"><span>본문 (HTML)</span>${tri('b-body', post.body, {textarea:true, rows:14})}</div>
        <div class="translate-bar">
          <span class="sub">원문(KO)에서 번역 → </span>
          <button class="btn btn-ghost btn-sm" id="b-tr-ja">일본어 번역</button>
          <button class="btn btn-ghost btn-sm" id="b-tr-en">영어 번역</button>
          <span class="sub tr-hint">번역은 저장 후 실행됩니다.</span>
        </div>
        <div class="save-bar">
          <button class="btn btn-ghost" id="b-preview" type="button">미리보기(JA)</button>
          <button class="btn btn-primary" id="b-save">저장</button>
        </div>
      </div>`;

    const readForm = () => ({
      id: post.id || undefined,
      slug: $('#b-slug').value.trim(),
      status: $('#b-status').value,
      category: $('#b-category').value.trim(),
      date: $('#b-date').value.trim(),
      tags: $('#b-tags').value.split(',').map((s) => s.trim()).filter(Boolean),
      cover: $('#b-cover').value.trim(),
      title: { ja: $('#b-title-ja').value, en: $('#b-title-en').value, ko: $('#b-title-ko').value },
      excerpt: { ja: $('#b-excerpt-ja').value, en: $('#b-excerpt-en').value, ko: $('#b-excerpt-ko').value },
      body: { ja: $('#b-body-ja').value, en: $('#b-body-en').value, ko: $('#b-body-ko').value },
    });
    const save = async () => {
      const res = await api('/api/posts', { method: 'POST', body: JSON.stringify({ action: 'save', post: readForm() }) });
      post = res.post;
      return post;
    };

    $('#blog-back').addEventListener('click', () => renderBlog(root));
    $('#b-cover-pick').addEventListener('click', () => openPicker({ single: true, onAdd: (srcs) => { $('#b-cover').value = srcs[0] || ''; } }));
    $('#b-save').addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true; b.textContent = '저장 중…';
      try { await save(); toast('저장했습니다.', 'ok'); blogEdit(root, post.id); }
      catch (err) { toast(err.message, 'error'); b.disabled = false; b.textContent = '저장'; }
    });
    $('#b-preview').addEventListener('click', () => {
      const html = $('#b-body-ja').value || $('#b-body-ko').value;
      openDrawer('미리보기 (JA)', `<div class="post-preview">${html}</div>`);
    });
    const doTranslate = async (target, btn) => {
      const prev = btn.textContent; btn.disabled = true; btn.textContent = '번역 중…';
      try {
        await save();
        const res = await api('/api/posts', { method: 'POST', body: JSON.stringify({ action: 'translate', id: post.id, target }) });
        post = res.post;
        toast(`${target === 'ja' ? '일본어' : '영어'} 번역 완료.`, 'ok');
        blogEdit(root, post.id);
      } catch (err) {
        toast(err.message, 'error'); btn.disabled = false; btn.textContent = prev;
      }
    };
    $('#b-tr-ja').addEventListener('click', (e) => doTranslate('ja', e.currentTarget));
    $('#b-tr-en').addEventListener('click', (e) => doTranslate('en', e.currentTarget));
  }

  // ─── Naver RSS 取り込み ──────────────────────────────────────────────────────
  async function blogImport(root) {
    root.innerHTML = `
      <div class="section-head"><div><h2>네이버블로그 가져오기</h2>
        <p class="sub">RSS에서 최신 글 목록을 불러와 선택한 글을 초안으로 가져옵니다. 가져온 뒤 편집에서 번역·공개하세요.</p></div>
        <div class="head-actions"><button class="btn btn-ghost" id="blog-back">← 목록</button></div>
      </div>
      <div class="card card-pad editor-card">
        <label class="field" style="max-width:360px"><span>블로그 ID</span>
          <span class="pick-row"><input type="text" id="imp-id" value="usherinmaking" /><button class="btn btn-primary btn-sm" id="imp-load">불러오기</button></span></label>
        <div id="imp-list"></div>
      </div>`;
    $('#blog-back').addEventListener('click', () => renderBlog(root));
    const load = async () => {
      const wrap = $('#imp-list'); wrap.innerHTML = loadingRow;
      let items = [];
      try { items = (await api('/api/posts', { method: 'POST', body: JSON.stringify({ action: 'rss', blogId: $('#imp-id').value.trim() }) })).items || []; }
      catch (err) { wrap.innerHTML = emptyState('불러오기 실패', err.message, true); return; }
      if (!items.length) { wrap.innerHTML = emptyState('글이 없습니다', 'RSS에서 항목을 찾지 못했습니다.'); return; }
      wrap.innerHTML = `
        <div class="imp-toolbar"><label><input type="checkbox" id="imp-all" /> 전체 선택</label>
          <button class="btn btn-primary btn-sm" id="imp-go">선택 가져오기</button></div>
        <ul class="imp-items">${items.map((it, i) => `
          <li><label>
            <input type="checkbox" class="imp-chk" data-i="${i}" />
            ${it.thumbnail ? `<img src="${esc(it.thumbnail)}" alt="" loading="lazy" />` : '<span class="imp-noimg"></span>'}
            <span class="imp-meta"><strong>${esc(it.title)}</strong><span class="sub">${esc(it.date || '')} · ${esc(it.category || '')}</span></span>
          </label></li>`).join('')}</ul>`;
      const chks = wrap.querySelectorAll('.imp-chk');
      $('#imp-all').addEventListener('change', (e) => chks.forEach((c) => (c.checked = e.target.checked)));
      $('#imp-go').addEventListener('click', async (e) => {
        const picked = Array.from(chks).filter((c) => c.checked).map((c) => items[+c.dataset.i]);
        if (!picked.length) { toast('가져올 글을 선택하세요.', 'error'); return; }
        const b = e.currentTarget; b.disabled = true;
        let ok = 0, skip = 0, fail = 0;
        for (const it of picked) {
          b.textContent = `가져오는 중… ${ok + skip + fail + 1}/${picked.length}`;
          try {
            await api('/api/posts', { method: 'POST', body: JSON.stringify({ action: 'import', blogId: $('#imp-id').value.trim(), logNo: it.logNo, category: it.category, date: it.date }) });
            ok++;
          } catch (err) { (err.message && err.message.includes('이미') ? skip++ : fail++); }
        }
        toast(`가져오기 완료: ${ok}건${skip ? `, 중복 ${skip}건` : ''}${fail ? `, 실패 ${fail}건` : ''}`, fail ? 'error' : 'ok');
        renderBlog(root);
      });
    };
    $('#imp-load').addEventListener('click', load);
    load();
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
    '%c usher in making %c 관리 콘솔 ',
    'background:#2f6f6a;color:#fff;border-radius:3px 0 0 3px;padding:2px 6px;font-weight:700',
    'background:#142028;color:#fff;border-radius:0 3px 3px 0;padding:2px 6px',
    '\n  라우트: #/dashboard, #/reservations, #/contacts, #/content, #/pages, #/seo, #/settings' +
    '\n  API   : /api/admin, /api/content, /api/pages, /api/seo, /api/rebuild, /api/upload' +
    '\n  인증  : Bearer 토큰 (sessionStorage) / 401이면 자동 로그아웃'
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
