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
  var planOpts = Array.prototype.slice.call(document.querySelectorAll('.plan-opt'));

  if (!grid) return; // reserve.html 以外では何もしない

  var today = new Date();
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
      .then(function (r) { return r.ok ? r.json() : { full: [] }; })
      .then(function (data) {
        var full = (data && (data.full || data.reserved)) || [];
        monthCache[key] = full;
        return full;
      })
      .catch(function () { monthCache[key] = []; return []; })
      .then(function (full) {
        if (loadingEl) loadingEl.style.display = 'none';
        return full;
      });
  }

  // ── 描画 ──────────────────────────────────────────────────────
  function render() {
    var key = ym(viewYear, viewMonth);
    titleEl.innerHTML =
      '<span>' + viewYear + '</span> ' + JP_MONTH[viewMonth + 1] +
      '<span class="cal-jp">／' + monthEnNarrow(viewMonth) + '</span>';

    prevBtn.disabled = key <= minKey;
    nextBtn.disabled = key >= maxKey;

    fetchMonth(key).then(function (fullDates) {
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

  // プラン選択
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
    summaryEl.innerHTML =
      '<span class="ss-label">撮影日</span><strong>' +
      (selectedDate ? formatJpDate(selectedDate) : '未選択') + '</strong>' +
      '<span class="ss-label">プラン</span><strong>' +
      (plan || '未選択') + '</strong>';
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
        return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
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
  updateSummary();
  render();
})();
