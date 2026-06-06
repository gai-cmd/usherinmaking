/* ===================================================================
   usher in making — 公開サイトと管理コンテンツの連携 (site-content.js)

   役割:
     1. GET /api/content を1回だけ取得（結果は Promise でキャッシュし、
        reserve.js など他スクリプトからも再利用できるよう window に公開）。
     2. notice（お知らせ）が有効なら、ページ上部に閉じられる告知バナーを注入。
        閉じた状態は sessionStorage に記憶（本文が変わると再表示）。
     3. 文書内に [data-content="plans"] があり plans があれば、
        既存の .plan-card マークアップを再利用してカードを差し替え。

   絶対原則:
     - API が落ちても何もしない（コンソール警告のみ）。静的 HTML をそのまま維持。
     - css/site.css は触らない。最小限のスタイルはこのファイルが <style> で注入。

   注意:
     - 契約 (.agents/contract.md) では notice={enabled,text,link}、
       plan={id,name,price,duration,includes[],description,featured}。
       一方、現行 API は notice=文字列、plan={id,title,desc,price} を返す場合がある。
       どちらの形でも壊れないよう両対応で正規化する。
=================================================================== */
(function () {
  'use strict';

  var ENDPOINT = '/api/content';
  var NOTICE_DISMISS_KEY = 'uim:notice:dismissed'; // 値 = 閉じた本文のハッシュ

  // ── 単一フェッチ（Promise キャッシュ）─────────────────────────────
  var contentPromise = null;
  function loadContent() {
    if (contentPromise) return contentPromise;
    contentPromise = fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (err) {
        // 失敗時は null。呼び出し側は静的コンテンツを維持する。
        console.warn('[site-content] /api/content の取得に失敗しました。静的コンテンツを維持します。', err);
        return null;
      });
    return contentPromise;
  }

  // ── 正規化（契約形 / 現行 API 形の両対応）─────────────────────────
  function normalizeNotice(content) {
    var n = content && content.notice;
    if (!n) return { enabled: false, text: '', link: '' };
    if (typeof n === 'string') {
      var t = n.trim();
      return { enabled: !!t, text: t, link: '' };
    }
    return {
      enabled: !!n.enabled,
      text: (n.text || '').toString().trim(),
      link: (n.link || '').toString().trim(),
    };
  }

  function normalizePlans(content) {
    var arr = content && Array.isArray(content.plans) ? content.plans : [];
    return arr
      .map(function (p) {
        p = p || {};
        return {
          id: (p.id || '').toString(),
          name: (p.name || p.title || '').toString(),
          price: (p.price || '').toString(),
          duration: (p.duration || '').toString(),
          includes: Array.isArray(p.includes) ? p.includes.map(String) : [],
          description: (p.description || p.desc || '').toString(),
          featured: !!p.featured,
        };
      })
      // 名前も料金も無い空エントリは描画しない
      .filter(function (p) {
        return p.name || p.price;
      });
  }

  // plan-spec 用の説明文（duration / includes / description を改行で連結）
  function planSpecText(p) {
    var lines = [];
    if (p.duration) lines.push(p.duration);
    if (p.includes && p.includes.length) {
      Array.prototype.push.apply(lines, p.includes);
    }
    if (p.description) lines.push(p.description);
    return lines.join('\n');
  }

  // ── お知らせバナー ────────────────────────────────────────────────
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return '' + h;
  }

  function noticeDismissed(text) {
    try {
      return sessionStorage.getItem(NOTICE_DISMISS_KEY) === hashStr(text);
    } catch (e) {
      return false;
    }
  }
  function rememberDismiss(text) {
    try {
      sessionStorage.setItem(NOTICE_DISMISS_KEY, hashStr(text));
    } catch (e) {
      /* sessionStorage 不可でも黙って続行 */
    }
  }

  var stylesInjected = false;
  function injectNoticeStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css =
      '.uim-notice{background:var(--paper,#f2ede6);border-bottom:1px solid var(--line,#e3dcd2);' +
      'font-family:var(--jp,"Shippori Mincho B1",serif);animation:uimNoticeIn .5s var(--ease,ease)}' +
      '@keyframes uimNoticeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}' +
      '.uim-notice-inner{max-width:var(--maxw,1200px);margin:0 auto;padding:12px 24px;' +
      'display:flex;align-items:center;gap:16px}' +
      '.uim-notice-text{flex:1 1 auto;color:var(--muted,#8a8079);font-size:.9rem;line-height:1.7;' +
      'letter-spacing:.03em;text-align:center}' +
      '.uim-notice-text a{color:var(--gold,#b29270);border-bottom:1px solid var(--gold,#b29270);' +
      'margin-left:.5em;white-space:nowrap}' +
      '.uim-notice-close{flex:0 0 auto;background:none;border:none;color:var(--muted,#8a8079);' +
      'font-size:1.25rem;line-height:1;cursor:pointer;padding:2px 6px;transition:color .25s}' +
      '.uim-notice-close:hover{color:var(--gold,#b29270)}' +
      '@media(max-width:640px){.uim-notice-inner{padding:10px 16px;gap:10px}' +
      '.uim-notice-text{font-size:.82rem;text-align:left}}';
    var style = document.createElement('style');
    style.setAttribute('data-uim', 'notice');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function renderNotice(notice) {
    if (!notice.enabled || !notice.text) return;
    if (noticeDismissed(notice.text)) return;
    if (document.querySelector('.uim-notice')) return; // 二重注入防止

    injectNoticeStyles();

    var bar = document.createElement('div');
    bar.className = 'uim-notice';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'お知らせ');

    var inner = document.createElement('div');
    inner.className = 'uim-notice-inner';

    var textEl = document.createElement('span');
    textEl.className = 'uim-notice-text';
    textEl.textContent = notice.text; // textContent で XSS 安全

    if (notice.link) {
      var a = document.createElement('a');
      a.href = notice.link;
      a.textContent = '詳しく見る';
      // 外部リンクなら安全属性を付与
      if (/^https?:\/\//i.test(notice.link)) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      textEl.appendChild(a);
    }

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'uim-notice-close';
    closeBtn.setAttribute('aria-label', '閉じる');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function () {
      rememberDismiss(notice.text);
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    });

    inner.appendChild(textEl);
    inner.appendChild(closeBtn);
    bar.appendChild(inner);

    // ヘッダーの直前（無ければ body 先頭）に挿入
    var header = document.querySelector('.site-header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(bar, header);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  // ── プランカード差し替え ──────────────────────────────────────────
  function buildPlanCard(p) {
    var card = document.createElement('div');
    card.className = 'plan-card' + (p.featured ? ' featured' : '');

    if (p.featured && p.name) {
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = p.name;
      card.appendChild(badge);
    }

    var h3 = document.createElement('h3');
    h3.textContent = p.name;
    card.appendChild(h3);

    if (p.price) {
      var price = document.createElement('p');
      price.className = 'plan-price';
      price.textContent = p.price;
      card.appendChild(price);
    }

    var spec = planSpecText(p);
    if (spec) {
      var specEl = document.createElement('p');
      specEl.className = 'plan-spec'; // CSS で white-space:pre-line のため改行が活きる
      specEl.textContent = spec;
      card.appendChild(specEl);
    }
    return card;
  }

  function renderPlans(plans) {
    if (!plans || !plans.length) return;
    var containers = document.querySelectorAll('[data-content="plans"]');
    if (!containers.length) return;

    Array.prototype.forEach.call(containers, function (container) {
      var frag = document.createDocumentFragment();
      plans.forEach(function (p) {
        frag.appendChild(buildPlanCard(p));
      });
      container.innerHTML = '';
      container.appendChild(frag);
    });
  }

  // ── スタジオ情報（SNS / メール）の差し替え ───────────────────────
  //   契約 v2: 値が空でない項目だけ、対応するリンクの href を置換する。
  //   空値なら静的 HTML をそのまま維持（絶対に空で上書きしない）。
  function normalizeStudio(content) {
    var s = (content && content.studio) || {};
    return {
      line: (s.line || '').toString().trim(),
      instagram: (s.instagram || '').toString().trim(),
      kakao: (s.kakao || '').toString().trim(),
      blog: (s.blog || '').toString().trim(),
      email: (s.email || '').toString().trim(),
    };
  }

  function applyStudio(studio) {
    // SNS リンク: セレクタ → 置換値（空値はスキップ）
    var links = [
      ['a[href*="line.me"]', studio.line],
      ['a[href*="instagram.com"]', studio.instagram],
      ['a[href*="qr.kakao.com"]', studio.kakao],
      ['a[href*="blog.naver.com"]', studio.blog],
    ];
    links.forEach(function (pair) {
      var sel = pair[0];
      var val = pair[1];
      if (!val) return; // 空値 = 静的リンクを維持
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (a) {
        a.setAttribute('href', val);
      });
    });

    // メール: mailto: リンクがあり、かつ値が空でなければ置換
    if (studio.email) {
      Array.prototype.forEach.call(
        document.querySelectorAll('a[href^="mailto:"]'),
        function (a) {
          a.setAttribute('href', 'mailto:' + studio.email);
        }
      );
    }
  }

  // ── ヒーロー（トップの見出し）の差し替え ──────────────────────────
  //   [data-content="hero"] 内の eyebrow / title / subtitle を、
  //   値が空でないフィールドだけ置換する。
  function normalizeHero(content) {
    var h = (content && content.hero) || {};
    return {
      eyebrow: (h.eyebrow || '').toString().trim(),
      title: (h.title || '').toString().trim(),
      subtitle: (h.subtitle || '').toString().trim(),
    };
  }

  function setTextIfPresent(el, value) {
    if (el && value) el.textContent = value;
  }

  function applyHero(hero) {
    if (!hero.eyebrow && !hero.title && !hero.subtitle) return; // 全空 = 何もしない
    var containers = document.querySelectorAll('[data-content="hero"]');
    if (!containers.length) return;
    Array.prototype.forEach.call(containers, function (c) {
      setTextIfPresent(c.querySelector('.eyebrow'), hero.eyebrow);
      setTextIfPresent(c.querySelector('h1'), hero.title);
      // subtitle は data-field を最優先、無ければ既存の .lede / .subtitle / .ph-jp
      var subEl =
        c.querySelector('[data-field="subtitle"]') ||
        c.querySelector('.lede') ||
        c.querySelector('.subtitle') ||
        c.querySelector('.ph-jp');
      setTextIfPresent(subEl, hero.subtitle);
    });
  }

  // ── イベント（モニター募集など）の差し替え ────────────────────────
  //   [data-content="event"] に enabled && title のときだけ反映。
  //   既存マークアップを尊重し、空のフィールドは触らない。
  function normalizeEvent(content) {
    var e = (content && content.event) || {};
    return {
      enabled: !!e.enabled,
      title: (e.title || '').toString().trim(),
      body: (e.body || '').toString().trim(),
      period: (e.period || '').toString().trim(),
    };
  }

  function applyEvent(ev) {
    if (!ev.enabled || !ev.title) return; // disabled or タイトル無し → 静的維持
    var containers = document.querySelectorAll('[data-content="event"]');
    if (!containers.length) return;
    Array.prototype.forEach.call(containers, function (c) {
      // title: data-field を優先、無ければ .section-title / 最初の h2
      var titleEl =
        c.querySelector('[data-field="title"]') ||
        c.querySelector('.section-title') ||
        c.querySelector('h2');
      setTextIfPresent(titleEl, ev.title);

      // body / period: 既存の data-field 要素があれば反映（hidden を解除）。
      [['body', ev.body], ['period', ev.period]].forEach(function (pair) {
        var key = pair[0];
        var val = pair[1];
        if (!val) return; // 空値は触らない
        var el = c.querySelector('[data-field="' + key + '"]');
        if (!el) return; // 専用要素が無ければ既存マークアップを尊重して何もしない
        el.textContent = val;
        el.removeAttribute('hidden');
      });
    });
  }

  // ── 公開 API（reserve.js 等から再利用）────────────────────────────
  window.UIMContent = {
    load: loadContent,
    normalizeNotice: normalizeNotice,
    normalizePlans: normalizePlans,
    normalizeStudio: normalizeStudio,
    normalizeHero: normalizeHero,
    normalizeEvent: normalizeEvent,
  };

  // ── 起動 ──────────────────────────────────────────────────────────
  function start() {
    loadContent().then(function (content) {
      if (!content) return; // 取得失敗 → 静的コンテンツ維持
      try {
        renderNotice(normalizeNotice(content));
      } catch (e) {
        console.warn('[site-content] お知らせの描画に失敗しました。', e);
      }
      try {
        renderPlans(normalizePlans(content));
      } catch (e) {
        console.warn('[site-content] プランの描画に失敗しました。', e);
      }
      try {
        applyStudio(normalizeStudio(content));
      } catch (e) {
        console.warn('[site-content] スタジオ情報の反映に失敗しました。', e);
      }
      try {
        applyHero(normalizeHero(content));
      } catch (e) {
        console.warn('[site-content] ヒーローの反映に失敗しました。', e);
      }
      try {
        applyEvent(normalizeEvent(content));
      } catch (e) {
        console.warn('[site-content] イベントの反映に失敗しました。', e);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
