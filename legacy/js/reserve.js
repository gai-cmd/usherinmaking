/* ===================================================================
   usher in making — 予約カレンダー (reserve.html only)
   - 月カレンダーUI（vanilla JS）で撮影日を選択
   - GET /api/reservations?month=YYYY-MM で当月の満席日を取得し灰色で無効化
   - プラン選択 + 申込フォーム（お名前 / 連絡先 / メッセージ）
   - POST /api/reservations で予約申込
   site.js / site.css は共用のため触らない（このファイルは reserve.html だけが読み込む）。
=================================================================== */
(function () {
  'use strict';

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var JP_MONTH = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  // 予約受付の上限（先何ヶ月先まで戻る/進めるか）
  var MAX_FORWARD_MONTHS = 12;

  var grid = document.getElementById('cal-grid');
  var titleEl = document.getElementById('cal-title');
  var prevBtn = document.getElementById('cal-prev');
  var nextBtn = document.getElementById('cal-next');
  var loadingEl = document.getElementById('cal-loading');

  var form = document.getElementById('reserve-form');
  var dateInput = document.getElementById('field-date');
  var planInput = document.getElementById('field-plan');
  var submitBtn = document.getElementById('reserve-submit');
  var msgEl = document.getElementById('form-msg');
  var summaryEl = document.getElementById('sel-summary');
  var planPick = document.getElementById('plan-pick');
  // プラン選択肢は静的 HTML を初期値とし、/api/content の plans があれば差し替える。
  // bindPlanOpts() で都度クリックハンドラを張り直すため可変。
  var planOpts = [];

  if (!grid) return; // reserve.html 以外では何もしない

  // 「今日」はスタジオ所在地（沖縄 = JST, UTC+9）基準。海外からの閲覧でも
  // サーバー側の過去日判定（JST）と同じ日付境界で表示する。
  var _now = new Date();
  var today = new Date(_now.getTime() + _now.getTimezoneOffset() * 60000 + 9 * 3600000);
  today.setHours(0, 0, 0, 0);

  var viewYear = today.getFullYear();
  var viewMonth = today.getMonth(); // 0-11
  var selectedDate = null;          // "YYYY-MM-DD"
  var fullSet = {};                 // { "YYYY-MM-DD": true }（当月の満席日）
  var monthCache = {};              // { "YYYY-MM": [fullDates] }

  // 月の境界（過去は当月まで、未来は MAX_FORWARD_MONTHS まで）
  var minKey = ym(today.getFullYear(), today.getMonth());
  var maxDate = new Date(today.getFullYear(), today.getMonth() + MAX_FORWARD_MONTHS, 1);
  var maxKey = ym(maxDate.getFullYear(), maxDate.getMonth());

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ym(y, m) { return y + '-' + pad(m + 1); }
  function ymd(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }

  // ── データ取得 ────────────────────────────────────────────────
  function fetchMonth(key) {
    if (monthCache[key]) return Promise.resolve(monthCache[key]);
    if (loadingEl) loadingEl.style.display = 'block';
    return fetch('/api/reservations?month=' + encodeURIComponent(key), {
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        if (!r.ok) throw new Error('month fetch failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var full = (data && (data.full || data.reserved)) || [];
        monthCache[key] = full;
        return full;
      })
      .catch(function () {
        // 取得失敗はキャッシュしない（次回の描画で再取得できるようにする）。
        // 空き状況が不明のまま「全日空き」に見せない。
        return null;
      })
      .then(function (full) {
        if (loadingEl) loadingEl.style.display = 'none';
        return full;
      });
  }

  // ── 描画 ──────────────────────────────────────────────────────
  var renderSeq = 0; // 月送り連打時に古いレスポンスで塗らないための世代トークン

  function render() {
    var key = ym(viewYear, viewMonth);
    var seq = ++renderSeq;
    titleEl.innerHTML =
      '<span>' + viewYear + '</span> ' + JP_MONTH[viewMonth + 1] +
      '<span class="cal-jp">／' + monthEnNarrow(viewMonth) + '</span>';

    prevBtn.disabled = key <= minKey;
    nextBtn.disabled = key >= maxKey;

    fetchMonth(key).then(function (fullDates) {
      if (seq !== renderSeq) return; // すでに別の月へ移動済み
      if (fullDates === null) {
        fullSet = {};
        paint();
        showMsg('err', '空き状況の取得に失敗しました。表示は最新でない場合があります。');
        return;
      }
      fullSet = {};
      fullDates.forEach(function (d) { fullSet[d] = true; });
      paint();
    });
  }

  function paint() {
    grid.innerHTML = '';

    // 曜日ヘッダ
    DOW.forEach(function (d, i) {
      var c = document.createElement('div');
      c.className = 'cal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '');
      c.textContent = d;
      grid.appendChild(c);
    });

    var firstDow = new Date(viewYear, viewMonth, 1).getDay();
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // 先頭の空セル
    for (var e = 0; e < firstDow; e++) {
      var empty = document.createElement('div');
      empty.className = 'cal-cell is-empty';
      grid.appendChild(empty);
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var cellDate = new Date(viewYear, viewMonth, d);
      cellDate.setHours(0, 0, 0, 0);
      var key = ymd(viewYear, viewMonth, d);
      var dow = cellDate.getDay();

      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-cell' + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '');
      cell.setAttribute('data-date', key);

      var isPast = cellDate < today;
      var isFull = !!fullSet[key];
      var disabled = isPast || isFull;

      var num = document.createElement('span');
      num.textContent = d;
      cell.appendChild(num);

      var state = document.createElement('span');
      state.className = 'cal-state';
      if (isPast) {
        state.textContent = '';
      } else if (isFull) {
        state.textContent = '× 満席';
        cell.classList.add('is-full');
      } else {
        state.textContent = '○ 空き';
        cell.classList.add('is-open');
      }
      cell.appendChild(state);

      if (disabled) {
        cell.classList.add('is-disabled');
        cell.disabled = true;
        cell.setAttribute('aria-disabled', 'true');
      } else {
        cell.addEventListener('click', onPickDate);
      }

      if (selectedDate === key) cell.classList.add('is-selected');

      cell.setAttribute(
        'aria-label',
        viewYear + '年' + JP_MONTH[viewMonth + 1] + d + '日' +
          (isFull ? ' 満席' : isPast ? '' : ' 空きあり')
      );

      grid.appendChild(cell);
    }
  }

  function monthEnNarrow(m) {
    var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[m];
  }

  // ── 操作 ──────────────────────────────────────────────────────
  function onPickDate(ev) {
    var key = ev.currentTarget.getAttribute('data-date');
    selectedDate = key;
    if (dateInput) dateInput.value = key;
    // 選択ハイライト更新
    Array.prototype.forEach.call(grid.querySelectorAll('.cal-cell'), function (c) {
      c.classList.toggle('is-selected', c.getAttribute('data-date') === key);
    });
    updateSummary();
    clearMsg();
  }

  prevBtn.addEventListener('click', function () {
    if (ym(viewYear, viewMonth) <= minKey) return;
    viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    render();
  });
  nextBtn.addEventListener('click', function () {
    if (ym(viewYear, viewMonth) >= maxKey) return;
    viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render();
  });

  // プラン選択 — 現在 DOM 上の .plan-opt にクリックハンドラを張る（差し替え後も再利用）
  function bindPlanOpts() {
    planOpts = Array.prototype.slice.call(document.querySelectorAll('.plan-opt'));
    planOpts.forEach(function (opt) {
      var radio = opt.querySelector('input[type="radio"]');
      opt.addEventListener('click', function () {
        if (radio) radio.checked = true;
        planOpts.forEach(function (o) { o.classList.remove('is-checked'); });
        opt.classList.add('is-checked');
        if (planInput) planInput.value = radio ? radio.value : '';
        updateSummary();
      });
    });
  }

  // /api/content の plans から選択肢を組み立て（既存マークアップ・クラスを再利用）
  function planDescText(p) {
    if (p.duration || (p.includes && p.includes.length)) {
      var parts = [];
      if (p.duration) parts.push(p.duration);
      if (p.includes && p.includes.length) parts.push(p.includes.join('・'));
      return parts.join('／');
    }
    return p.description || '';
  }

  function buildPlanOptions(plans) {
    if (!planPick || !plans || !plans.length) return false;

    var frag = document.createDocumentFragment();
    plans.forEach(function (p) {
      var name = p.name || '';
      var price = p.price || '';
      if (!name && !price) return;
      // API へ送る値（plan）は静的版と同じく「名前 料金」の形に揃える
      var value = (name + (price ? ' ' + price : '')).trim();

      var label = document.createElement('label');
      label.className = 'plan-opt';

      var radioSpan = document.createElement('span');
      radioSpan.className = 'po-radio';

      var main = document.createElement('span');
      main.className = 'po-main';
      var nameEl = document.createElement('span');
      nameEl.className = 'po-name';
      nameEl.textContent = name;
      var descEl = document.createElement('span');
      descEl.className = 'po-desc';
      descEl.textContent = planDescText(p);
      main.appendChild(nameEl);
      main.appendChild(descEl);

      var priceEl = document.createElement('span');
      priceEl.className = 'po-price';
      priceEl.textContent = price;

      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'plan';
      input.value = value; // value 経由のみ。textContent と合わせ XSS 安全

      label.appendChild(radioSpan);
      label.appendChild(main);
      label.appendChild(priceEl);
      label.appendChild(input);
      frag.appendChild(label);
    });

    if (!frag.childNodes.length) return false;
    planPick.innerHTML = '';
    planPick.appendChild(frag);
    bindPlanOpts();
    return true;
  }

  // 管理コンテンツの plans を取得して選択肢を差し替え（失敗・空なら静的版を維持）
  function loadPlansFromContent() {
    var loader =
      window.UIMContent && typeof window.UIMContent.load === 'function'
        ? window.UIMContent.load()
        : fetch('/api/content', { headers: { Accept: 'application/json' } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; });

    Promise.resolve(loader)
      .then(function (content) {
        if (!content) return; // 取得失敗 → 静的 fallback 維持
        var plans =
          window.UIMContent && typeof window.UIMContent.normalizePlans === 'function'
            ? window.UIMContent.normalizePlans(content)
            : (Array.isArray(content.plans) ? content.plans : []);
        buildPlanOptions(plans);
      })
      .catch(function (err) {
        console.warn('[reserve] プラン取得に失敗。静的プランを維持します。', err);
      });
  }

  function selectedPlanLabel() {
    var checked = document.querySelector('.plan-opt input[type="radio"]:checked');
    return checked ? checked.value : '';
  }

  function formatJpDate(key) {
    var p = key.split('-');
    return p[0] + '年' + Number(p[1]) + '月' + Number(p[2]) + '日';
  }

  function updateSummary() {
    if (!summaryEl) return;
    var plan = selectedPlanLabel();
    if (!selectedDate && !plan) {
      summaryEl.className = 'sel-summary empty';
      summaryEl.textContent = '撮影日とプランをお選びください。';
      return;
    }
    summaryEl.className = 'sel-summary';
    // プラン名は /api/content 由来（管理画面で編集可能）のため、
    // innerHTML 連結ではなく textContent で組み立てる（XSS 対策）。
    summaryEl.textContent = '';
    [
      ['撮影日', selectedDate ? formatJpDate(selectedDate) : '未選択'],
      ['プラン', plan || '未選択'],
    ].forEach(function (pair) {
      var label = document.createElement('span');
      label.className = 'ss-label';
      label.textContent = pair[0];
      var val = document.createElement('strong');
      val.textContent = pair[1];
      summaryEl.appendChild(label);
      summaryEl.appendChild(val);
    });
  }

  // ── 送信 ──────────────────────────────────────────────────────
  function showMsg(type, text) {
    if (!msgEl) return;
    msgEl.className = 'form-msg show ' + type;
    msgEl.textContent = text;
  }
  function clearMsg() {
    if (!msgEl) return;
    msgEl.className = 'form-msg';
    msgEl.textContent = '';
  }

  var submitting = false;

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (submitting) return;
    clearMsg();

    var contact = (document.getElementById('field-contact') || {}).value || '';
    // 連絡先がメール形式なら email としても送る（専用入力欄が無いため自動判定）。
    // サーバー側（api/reservations.js）でも同様に判定するが、フィールドを揃えておく。
    var isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.trim());

    var data = {
      date: selectedDate || (dateInput && dateInput.value) || '',
      plan: selectedPlanLabel(),
      name: (document.getElementById('field-name') || {}).value || '',
      contact: contact,
      email: isEmail ? contact.trim() : '',
      message: (document.getElementById('field-message') || {}).value || '',
      _hp: (document.getElementById('field-company') || {}).value || '',
    };

    if (!data.date) { showMsg('err', '撮影日をカレンダーから選択してください。'); return; }
    if (!data.name.trim() || !data.contact.trim()) {
      showMsg('err', 'お名前とご連絡先（メール／電話／LINE）をご入力ください。');
      return;
    }

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中…';

    fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (r) {
        // 本文が JSON でなくても成功／失敗の判定は落とさない
        // （成功後の parse 失敗で「通信エラー→再送→二重予約」となるのを防ぐ）。
        return r
          .json()
          .catch(function () { return {}; })
          .then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
      })
      .then(function (res) {
        if (res.ok) {
          showMsg(
            'ok',
            'ご予約の申し込みを受け付けました。担当者より折り返しご連絡いたします。\n' +
              '（撮影日：' + formatJpDate(data.date) + '）'
          );
          form.reset();
          // 予約済みの月を再取得して満席を反映
          var key = data.date.slice(0, 7);
          delete monthCache[key];
          selectedDate = null;
          planOpts.forEach(function (o) { o.classList.remove('is-checked'); });
          updateSummary();
          render();
        } else if (res.status === 409) {
          showMsg('err', res.body.error || 'その日は既に満席です。別の日をお選びください。');
          // 満席化したので当月を再描画
          delete monthCache[data.date.slice(0, 7)];
          render();
        } else {
          showMsg('err', (res.body && res.body.error) || '送信に失敗しました。時間をおいて再度お試しください。');
        }
      })
      .catch(function () {
        showMsg('err', '通信エラーが発生しました。電波状況をご確認のうえ再度お試しください。');
      })
      .then(function () {
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'この内容で予約を申し込む';
      });
  });

  // 初期化
  bindPlanOpts();        // まず静的選択肢をバインド（fallback）
  loadPlansFromContent(); // /api/content があれば差し替え
  updateSummary();
  render();
})();
