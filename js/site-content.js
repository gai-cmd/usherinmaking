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

  // ── 多言語（JA / EN）────────────────────────────────────────────────
  //   契約 v3: URL 경로が /en/ で시작하면 en、그 외는 ja。
  //   다국어 필드는 文字列 / {ja,en} 객체 모두 수용。en 비면 ja로 fallback。
  var LOCALE = /^\/en(\/|$)/.test(location.pathname) ? 'en' : 'ja';

  function t(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      var en = (v.en == null ? '' : '' + v.en).trim();
      var ja = (v.ja == null ? '' : '' + v.ja).trim();
      return LOCALE === 'en' ? en || ja : ja || en;
    }
    return '' + v;
  }

  // ── URL スキームの許可リスト（javascript: 等の危険スキームを遮断）────
  //   管理コンテンツ由来の href に使う。http(s) / mailto / 相対 / アンカーのみ許可。
  function safeHref(url) {
    var u = ('' + (url == null ? '' : url)).trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (/^mailto:/i.test(u)) return u;
    if (u.charAt(0) === '/' || u.charAt(0) === '#') return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; // その他スキームは拒否
    return u; // 相対パス
  }

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
      var s = n.trim();
      return { enabled: !!s, text: s, link: '' };
    }
    var text = t(n.text).trim();
    return {
      enabled: !!n.enabled,
      text: text,
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
          // name / description は多言語（文字列 or {ja,en}）→ locale で解決
          name: t(p.name || p.title || '').trim(),
          price: (p.price || '').toString(),
          duration: (p.duration || '').toString(),
          includes: Array.isArray(p.includes) ? p.includes.map(String) : [],
          description: t(p.description || p.desc || '').trim(),
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

    var noticeHref = safeHref(notice.link);
    if (noticeHref) {
      var a = document.createElement('a');
      a.href = noticeHref;
      a.textContent = '詳しく見る';
      // 外部リンクなら安全属性を付与
      if (/^https?:\/\//i.test(noticeHref)) {
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
      // data-plan-group="wedding" 等があれば id 接頭辞でフィルタ
      //（無指定は従来どおり全件 — 既存ページ互換）
      var group = container.getAttribute('data-plan-group');
      var list = group
        ? plans.filter(function (p) { return p && p.id && p.id.indexOf(group + '-') === 0; })
        : plans;
      if (!list.length) return; // 該当グループ無し → 静的カードを維持
      var frag = document.createDocumentFragment();
      list.forEach(function (p) {
        frag.appendChild(buildPlanCard(p));
      });
      container.innerHTML = '';
      container.appendChild(frag);
    });
  }

  // ── ギャラリー写真の差し替え ──────────────────────────────────────
  //   契約 v3: [data-content^="gallery:"] の各コンテナごとに、
  //   content.galleries[スロット].items の表示項目を、
  //   「そのコンテナの既存子マークアップ」をテンプレートとして再描画する。
  //
  //   既存子要素を順番にテンプレート（リング）として使い回すため、
  //   既存と同数のときはレイアウト変種（例: .tile.wide）も位置ごとに保たれる。
  //   データが無い / 失敗 / 表示項目ゼロ のときは静的 HTML を一切変えない。

  // 新たに差し込んだ .reveal 要素にアニメーション（visible 付与）を効かせる。
  function revealNew(scope) {
    var nodes = scope.querySelectorAll('.reveal:not(.visible)');
    if (!nodes.length) return;
    if (typeof IntersectionObserver !== 'function') {
      Array.prototype.forEach.call(nodes, function (n) {
        n.classList.add('visible');
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    Array.prototype.forEach.call(nodes, function (n) {
      io.observe(n);
    });
  }

  function normalizeGalleryItems(slotData) {
    var items = slotData && Array.isArray(slotData.items) ? slotData.items : null;
    if (!items) return null; // データ無し → 呼び出し側で静的維持
    return items.filter(function (it) {
      // visible が明示的に false の項目だけ除外（既定は表示）
      return it && it.visible !== false && (it.src || it.href);
    });
  }

  // テンプレート要素（既存子のクローン）に 1 項目分の値を流し込む。
  function fillGalleryNode(node, item) {
    var matches = node.matches ? node.matches.bind(node) : function () { return false; };
    var link = matches('a') ? node : node.querySelector('a');
    var img = matches('img') ? node : node.querySelector('img');
    var caption = t(item.caption);

    var itemHref = safeHref(item.href);
    if (link && itemHref) link.setAttribute('href', itemHref);
    if (img) {
      if (item.src) img.setAttribute('src', item.src);
      if (caption) img.setAttribute('alt', caption); // caption は表示テキスト＝alt に反映
    }
    if (caption) {
      var fc = node.querySelector('figcaption');
      if (fc) fc.textContent = caption;
      if (link) {
        // 既存マークアップに title / aria-label があれば caption に合わせる
        if (link.hasAttribute('title')) link.setAttribute('title', caption);
        if (link.hasAttribute('aria-label')) link.setAttribute('aria-label', caption);
      }
    }
  }

  // コンテナの既存子要素をテンプレートのリングとして使い回し、items を再描画する。
  //   gallery（data-content）と pages の photos リージョン（data-region）で共用。
  //   既存と同数のときはレイアウト変種（例: .tile.wide）も位置ごとに保たれる。
  //   雛形が無い / items が空のときは false を返し、呼び出し側で静的維持する。
  function renderPhotoItems(container, items) {
    if (!items || !items.length) return false;
    var templates = Array.prototype.slice.call(container.children);
    if (!templates.length) return false; // 雛形が無い → 安全側で何もしない

    // フラグメントを完成させてから一括差し替え（途中失敗で空にしない）
    var frag = document.createDocumentFragment();
    items.forEach(function (item, i) {
      var tpl = templates[i % templates.length];
      var node = tpl.cloneNode(true);
      fillGalleryNode(node, item);
      frag.appendChild(node);
    });

    container.innerHTML = '';
    container.appendChild(frag);
    revealNew(container);
    return true;
  }

  function renderGalleries(content) {
    var containers = document.querySelectorAll('[data-content^="gallery:"]');
    if (!containers.length) return;
    var galleries = (content && content.galleries) || {};

    Array.prototype.forEach.call(containers, function (container) {
      try {
        var attr = container.getAttribute('data-content') || '';
        var slot = attr.slice('gallery:'.length).trim();
        if (!slot) return;

        var items = normalizeGalleryItems(galleries[slot]);
        if (!items || !items.length) return; // データ無し / 表示項目ゼロ → 静的維持

        renderPhotoItems(container, items); // 既存マークアップをテンプレートに再描画
      } catch (e) {
        // このコンテナだけ静的維持。他コンテナには影響させない。
        console.warn('[site-content] ギャラリーの描画に失敗しました。静的のまま維持します。', e);
      }
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
      var val = safeHref(pair[1]);
      if (!val) return; // 空値・不正スキーム = 静的リンクを維持
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
      eyebrow: t(h.eyebrow).trim(),
      title: t(h.title).trim(),
      subtitle: t(h.subtitle).trim(),
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
      title: t(e.title).trim(),
      body: t(e.body).trim(),
      period: t(e.period).trim(),
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

  // ── 契約 v4: ページ本文（regions）のプレビュー反映 ────────────────
  //   GET /api/pages?path=<キー> の regions を、HTML 内の [data-region] ノードに
  //   適用する（クライアントはプレビュー用。クローラ向けの確定値はビルド時ベイク）。
  //
  //   設計方針:
  //     - 値の形からタイプを判定するので region_map.json をクライアントで取得しない
  //       （404 → コンソールエラーを避け、不要なリクエストもしない）。
  //         text   = { <field>: {ja,en} }（または単独の {ja,en}）
  //         lines  = { lines: [ { text:{ja,en}, dim:bool } ] }
  //         photos = { items: [ { src, caption:{ja,en} } ] }
  //     - text の field→要素は region_map.json の fields 構造に合わせた別名表で解決
  //       （data-field 明示 → 別名セレクタの順。例: eyebrow→.eyebrow, title→h1/h2, sub→.ph-jp）。
  //     - lines/photos は「コンテナの既存子マークアップ」をテンプレートに再生成（クラス・構造を維持）。
  //     - 空値・未存在リージョンは無視。fetch 失敗時は無変更。

  // 現在パス → pages キー。'/'・'/index.html'→'index.html'、'/en/about.html'→'about.html'（locale は別途）。
  function pageKey() {
    var seg = location.pathname.replace(/\/+$/, ''); // 末尾スラッシュ除去
    seg = seg.substring(seg.lastIndexOf('/') + 1);   // ファイル名のみ（/en/ も自然に除去）
    return seg || 'index.html';
  }

  // 値の形から region タイプを判定（region_map に依存しない）
  function detectRegionType(v) {
    if (!v || typeof v !== 'object') return null;
    if (Array.isArray(v.items)) return 'photos';
    if (Array.isArray(v.lines)) return 'lines';
    return 'text';
  }

  // {ja,en} 単独の多言語リーフか？（field マップと区別するため）
  function isLocaleLeaf(v) {
    return v && typeof v === 'object' && (typeof v.ja === 'string' || typeof v.en === 'string');
  }

  // region_map.json の fields に対応する field→セレクタ別名（コンテナ内で解決）
  var FIELD_ALIAS = {
    eyebrow: '.eyebrow',
    title: 'h1, h2, .section-title, .ph-title',
    sub: '.ph-jp',
    subtitle: '.lede, .subtitle, .ph-jp',
    lede: '.lede',
    body: 'p',
    desc: 'p',
    period: '.period',
  };

  function resolveFieldEl(container, field) {
    var sel = '[data-field="' + field + '"]';
    var el = container.querySelector(sel);          // ① 明示マーカー優先
    if (el) return el;
    if (container.matches && container.matches(sel)) return container; // ② コンテナ自身
    return FIELD_ALIAS[field] ? container.querySelector(FIELD_ALIAS[field]) : null; // ③ 別名
  }

  // text 형: フィールドごとに該当要素の textContent を差し替え（空フィールドは無視）
  function renderTextRegion(node, value) {
    if (isLocaleLeaf(value)) {
      var s = t(value);
      if (s) node.textContent = s;
      return;
    }
    Object.keys(value).forEach(function (field) {
      var s = t(value[field]);
      if (!s) return; // 空値は触らない
      var el = resolveFieldEl(node, field);
      if (el) el.textContent = s;
    });
  }

  // lines 형: 既存 span のクラスパターン（word / dim 等）を雛形に再生成
  function renderLinesRegion(node, lines) {
    var spans = node.getElementsByTagName('span');
    // 先頭 span のクラスから dim を除いたものをベースクラスとして踏襲
    var baseClass = spans.length
      ? (spans[0].className || '')
          .split(/\s+/)
          .filter(function (c) { return c && c !== 'dim'; })
          .join(' ')
      : '';

    var frag = document.createDocumentFragment();
    lines.forEach(function (ln, i) {
      var text = t(ln && ln.text);
      if (!text) return;
      if (frag.childNodes.length) frag.appendChild(document.createTextNode(' ')); // 単語間の空白を維持
      var span = document.createElement('span');
      var cls = baseClass;
      if (ln.dim) cls = (cls ? cls + ' ' : '') + 'dim';
      if (cls) span.className = cls;
      span.textContent = text;
      frag.appendChild(span);
    });
    if (!frag.childNodes.length) return; // 有効行なし → 静的維持
    node.innerHTML = '';
    node.appendChild(frag);
  }

  // regions を [data-region] ノードへ適用
  function applyRegions(data) {
    var regions = data && data.regions;
    if (!regions) return;
    var nodes = document.querySelectorAll('[data-region]');
    Array.prototype.forEach.call(nodes, function (node) {
      try {
        var id = node.getAttribute('data-region');
        if (!id || !Object.prototype.hasOwnProperty.call(regions, id)) return;
        var value = regions[id];
        var type = detectRegionType(value);
        if (!type) return; // 空・未存在 → 無視

        if (type === 'text') {
          renderTextRegion(node, value);
        } else if (type === 'lines') {
          var lines = value.lines.filter(function (l) { return l && t(l.text); });
          if (lines.length) renderLinesRegion(node, lines);
        } else if (type === 'photos') {
          var items = value.items.filter(function (it) { return it && it.src; });
          if (items.length) renderPhotoItems(node, items); // 既存マークアップを再利用
        }
      } catch (e) {
        // このリージョンだけ静的維持。他には影響させない。
        console.warn('[site-content] リージョンの描画に失敗しました。静的のまま維持します。', e);
      }
    });
  }

  // pages の単一フェッチ（Promise キャッシュ）。[data-region] がある時だけ呼ぶ。
  var pagesPromise = null;
  function loadPages() {
    if (pagesPromise) return pagesPromise;
    var url = '/api/pages?path=' + encodeURIComponent(pageKey());
    pagesPromise = fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (err) {
        console.warn('[site-content] /api/pages の取得に失敗しました。静的コンテンツを維持します。', err);
        return null;
      });
    return pagesPromise;
  }

  // ── 公開 API（reserve.js 等から再利用）────────────────────────────
  window.UIMContent = {
    load: loadContent,
    loadPages: loadPages,
    pageKey: pageKey,
    locale: LOCALE,
    t: t,
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
        renderGalleries(content);
      } catch (e) {
        console.warn('[site-content] ギャラリーの描画に失敗しました。', e);
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

    // 契約 v4: ページ本文（regions）のプレビュー。
    //   /api/content とは独立。[data-region] が 1 つも無ければ fetch 自体を省略。
    if (document.querySelector('[data-region]')) {
      loadPages().then(function (data) {
        if (!data) return; // 取得失敗 → 静的維持
        try {
          applyRegions(data);
        } catch (e) {
          console.warn('[site-content] ページ本文の反映に失敗しました。', e);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
