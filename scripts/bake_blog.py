#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
usher in making — ブログ静的ベイク（pure Python 3 stdlib）

公開記事（uim:posts のうち status=published）から:
    blog.html / en/blog.html              … 記事一覧
    blog/<slug>.html / en/blog/<slug>.html … 各記事
    feed.xml                               … RSS（日本語）
を生成し、seo/seo.json に各ブログページの SEO エントリ（article フラグ付き）を
登録する。実際の <head> メタ/JSON-LD は後段の seo/build_seo.py apply が注入する。

呼び出し:
    from bake_blog import bake_blog ; bake_blog(posts, root=ROOT)   # vercel_build から
    python3 scripts/bake_blog.py                                    # ローカル（任意の blog_posts.json）

robustness: ベイクは例外を投げてもビルドを壊さない方針（vercel_build 側で握る）。
"""
import os, re, json, html, glob
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEO_JSON = os.path.join(ROOT, "seo", "seo.json")

def _base_url():
    """ドメインの単一情報源は seo/seo.json の _site.baseUrl（無ければ既定値）。"""
    try:
        with open(SEO_JSON, encoding="utf-8") as fh:
            u = (json.load(fh).get("_site") or {}).get("baseUrl") or ""
        if u.startswith("http"):
            return u if u.endswith("/") else u + "/"
    except Exception:
        pass
    return "https://usherinmaking.vercel.app/"

BASE_URL = _base_url()

# ── chrome（site.css 既存スタイルを利用。サブディレクトリ対策で全て絶対パス）──
FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com" />\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Shippori+Mincho+B1:wght@400;500;600;700&display=swap" rel="stylesheet" />\n'
    '<link rel="stylesheet" href="/css/site.css" />'
)

NAV_JA = [("/about.html","ABOUT"),("/wedding.html","WEDDING"),("/anniversary.html","ANNIVERSARY"),
          ("/dress.html","DRESS"),("/plan.html","PLAN"),("/event.html","EVENT"),
          ("/blog.html","BLOG"),("/contact.html","CONTACT"),("/reserve.html","RESERVE")]
NAV_EN = [("/en/about.html","ABOUT"),("/en/wedding.html","WEDDING"),("/en/anniversary.html","ANNIVERSARY"),
          ("/en/dress.html","DRESS"),("/en/plan.html","PLAN"),("/en/event.html","EVENT"),
          ("/en/blog.html","BLOG"),("/en/contact.html","CONTACT")]

SNS = ('<div class="sns">'
       '<a href="https://line.me/ti/p/8Udy1kYg1l" target="_blank" rel="noopener" aria-label="LINE"><img src="/images/sns/line.png" alt="LINE" loading="lazy" decoding="async"></a>'
       '<a href="https://www.instagram.com/usherinmaking/" target="_blank" rel="noopener" aria-label="Instagram"><img src="/images/sns/instagram.png" alt="Instagram" loading="lazy" decoding="async"></a>'
       '<a href="http://qr.kakao.com/talk/YdBfdGeaBd1EXL3ZVVpEJrSpzMU-" target="_blank" rel="noopener" aria-label="KakaoTalk"><img src="/images/sns/kakao.png" alt="KakaoTalk" loading="lazy" decoding="async"></a>'
       '<a class="sns-blog" href="https://blog.naver.com/usherinmaking/" target="_blank" rel="noopener" aria-label="Naver Blog">blog</a></div>')


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def header(is_en):
    nav = NAV_EN if is_en else NAV_JA
    home = "/en/index.html" if is_en else "/index.html"
    lang = ('<div class="lang"><a href="/index.html">JP</a><span>/</span><a href="/en/index.html" class="active">EN</a></div>'
            if is_en else
            '<div class="lang"><a href="#" class="active">JP</a><span>/</span><a href="/en/index.html">EN</a></div>')
    links = "\n      ".join(f'<a href="{u}">{t}</a>' for u, t in nav)
    return (f'<header class="site-header">\n  <div class="header-inner">\n'
            f'    <a href="{home}" class="logo"><img src="/images/logo.png" alt="usher in making" loading="lazy" decoding="async"></a>\n'
            f'    <nav class="nav">\n      {links}\n    </nav>\n'
            f'    <div class="header-right">\n      {lang}\n'
            f'      <button class="menu-toggle" aria-label="menu"><span></span><span></span><span></span></button>\n'
            f'    </div>\n  </div>\n</header>')


def footer(is_en):
    nav = NAV_EN if is_en else NAV_JA
    extra = "" if is_en else '<a href="/privacy.html">プライバシーポリシー</a><a href="/tokushoho.html">特定商取引法に基づく表記</a>'
    links = "".join(f'<a href="{u}">{t}</a>' for u, t in nav)
    return (f'<footer class="site-footer">\n  <div class="footer-inner">\n    <div>\n'
            f'      <p class="logo"><img src="/images/logo.png" alt="usher in making" loading="lazy" decoding="async"></p>\n'
            f'      <p class="footer-tagline">Okinawa Wedding &amp; Anniversary Photo Studio</p>\n      {SNS}\n    </div>\n'
            f'    <nav class="footer-nav">{links}{extra}</nav>\n  </div>\n'
            f'  <div class="copyright">© 2026 usher in making. All rights reserved.</div>\n</footer>')


def page_shell(is_en, body_html):
    lang = "en" if is_en else "ja"
    # build_seo apply が <meta viewport> の直後に管理ブロックを注入する。
    return (f'<!DOCTYPE html>\n<html lang="{lang}">\n<head>\n'
            f'<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
            f'{FONTS}\n</head>\n<body>\n{header(is_en)}\n\n{body_html}\n\n{footer(is_en)}\n'
            f'<script src="/js/site.js"></script>\n</body>\n</html>\n')


# ── 言語別フィールド取り出し（ja は空なら ko にフォールバック）──────────────────
def pick(m, lang):
    m = m or {}
    if lang == "en":
        return (m.get("en") or "").strip()
    return (m.get("ja") or m.get("ko") or "").strip()


def card(p, is_en):
    lang = "en" if is_en else "ja"
    slug = p.get("slug", "")
    url = (f"/en/blog/{slug}.html" if is_en else f"/blog/{slug}.html")
    title = pick(p.get("title"), lang) or "(無題)"
    ex = pick(p.get("excerpt"), lang)
    cover = p.get("cover") or ""
    img = (f'<img src="{esc(cover)}" alt="{esc(title)}" loading="lazy" decoding="async">'
           if cover else '<span class="blog-card-noimg"></span>')
    meta = " · ".join(x for x in [esc(p.get("date","")), esc(p.get("category",""))] if x)
    return (f'<a class="blog-card" href="{url}">\n  <div class="blog-card-thumb">{img}</div>\n'
            f'  <div class="blog-card-body"><span class="blog-card-meta">{meta}</span>'
            f'<h2>{esc(title)}</h2><p>{esc(ex)}</p></div>\n</a>')


def index_body(posts, is_en):
    heading = "Blog" if is_en else "ブログ"
    sub = "Okinawa photo stories & news" if is_en else "沖縄フォトの記録・お知らせ"
    cards = "\n".join(card(p, is_en) for p in posts)
    empty = ('<p class="blog-empty">' + ("Coming soon." if is_en else "準備中です。") + "</p>")
    grid = f'<div class="blog-grid">\n{cards}\n</div>' if posts else empty
    return (f'<main class="blog-index" id="blog-root">\n'
            f'  <div class="blog-head"><h1>{heading}</h1><p>{sub}</p></div>\n  {grid}\n</main>')


def post_body(p, is_en):
    lang = "en" if is_en else "ja"
    title = pick(p.get("title"), lang) or "(無題)"
    body = pick(p.get("body"), lang)
    cover = p.get("cover") or ""
    author = p.get("author") or "usher in making"
    # 著者・発行日を本文にも明示（E-E-A-T / AI 引用対策: 目に見える出典情報）
    meta_parts = []
    if p.get("date"):
        label = "Published" if is_en else "公開日"
        meta_parts.append(f'<time datetime="{esc(p["date"])}">{label}: {esc(p["date"])}</time>')
    if p.get("category"):
        meta_parts.append(esc(p.get("category", "")))
    meta_parts.append(("By " if is_en else "撮影・執筆: ") + esc(author))
    meta = " · ".join(meta_parts)
    back = "/en/blog.html" if is_en else "/blog.html"
    back_t = "← Blog" if is_en else "← ブログ一覧"
    hero = (f'<div class="blog-post-cover"><img src="{esc(cover)}" alt="{esc(title)}" decoding="async"></div>'
            if cover else "")
    return (f'<main class="blog-post-wrap">\n  <article class="blog-post">\n'
            f'    <a class="blog-back" href="{back}">{back_t}</a>\n'
            f'    <span class="blog-post-meta">{meta}</span>\n    <h1>{esc(title)}</h1>\n    {hero}\n'
            f'    <div class="blog-post-body">\n{body}\n    </div>\n  </article>\n</main>')


def write(rel, content):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True) if os.path.dirname(rel) else None
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)


# ── feed.xml（日本語）──────────────────────────────────────────────────────────
def _rfc822(ymd):
    """"YYYY-MM-DD" → RFC 822（RSS pubDate 形式、JST 09:00 固定）。不正なら空。"""
    try:
        d = datetime.strptime(ymd, "%Y-%m-%d")
        return d.strftime("%a, %d %b %Y 09:00:00 +0900")
    except Exception:
        return ""

def build_feed(posts):
    items = []
    latest = ""
    for p in posts[:30]:
        url = BASE_URL + f"blog/{p.get('slug','')}.html"
        title = pick(p.get("title"), "ja") or "(無題)"
        desc = pick(p.get("excerpt"), "ja")
        pub = _rfc822(p.get("date") or "")
        if not latest and pub:
            latest = pub  # posts は新しい順ソート済み
        items.append(
            "    <item>\n"
            f"      <title>{esc(title)}</title>\n"
            f"      <link>{esc(url)}</link>\n"
            f"      <guid>{esc(url)}</guid>\n"
            f"      <description>{esc(desc)}</description>\n"
            + (f"      <pubDate>{pub}</pubDate>\n" if pub else "")
            + (f"      <category>{esc(p.get('category',''))}</category>\n" if p.get("category") else "")
            + "    </item>"
        )
    last_build = latest or datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n'
            '    <title>usher in making — Blog</title>\n'
            f'    <link>{BASE_URL}blog.html</link>\n'
            f'    <atom:link href="{BASE_URL}feed.xml" rel="self" type="application/rss+xml" />\n'
            '    <description>沖縄ウェディング・記念日フォトのブログ</description>\n'
            '    <language>ja</language>\n'
            f'    <lastBuildDate>{last_build}</lastBuildDate>\n'
            + "\n".join(items) + "\n  </channel>\n</rss>\n")


# ── seo.json 登録 ──────────────────────────────────────────────────────────────
def seo_entry(slug, is_en, title, desc, cover, breadcrumb, article=None):
    e = {"slug": slug, "title": title, "description": desc,
         "keywords": "", "ogType": "article" if article else "website",
         "ogImage": cover or "", "breadcrumb": breadcrumb}
    if article:
        e["article"] = article
    return e


def update_seo_json(entries):
    try:
        with open(SEO_JSON, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return
    pages = data.setdefault("pages", {})
    # 既存のブログ系エントリを掃除（冪等）
    for k in list(pages.keys()):
        if k in ("blog.html", "en/blog.html") or k.startswith("blog/") or k.startswith("en/blog/"):
            del pages[k]
    pages.update(entries)
    with open(SEO_JSON, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


def bake_blog(posts, root=ROOT):
    """published 記事から全ブログページ・feed・SEO エントリを生成。生成 URL を返す。"""
    global ROOT
    ROOT = root
    pub = [p for p in (posts or []) if (p or {}).get("status") == "published"]
    # 日付の新しい順
    pub.sort(key=lambda p: (p.get("date") or p.get("updatedAt") or ""), reverse=True)
    ja_posts = [p for p in pub if pick(p.get("title"), "ja")]
    en_posts = [p for p in pub if pick(p.get("title"), "en")]

    seo_entries = {}
    urls = []

    # 一覧
    write("blog.html", page_shell(False, index_body(ja_posts, False)))
    write(os.path.join("en", "blog.html"), page_shell(True, index_body(en_posts, True)))
    seo_entries["blog.html"] = seo_entry(
        "blog.html", False, "ブログ｜usher in making", "沖縄ウェディング・前撮り・記念日フォトのブログ。撮影の記録やお知らせをお届けします。",
        "", [["ホーム", BASE_URL], ["ブログ", BASE_URL + "blog.html"]])
    seo_entries["en/blog.html"] = seo_entry(
        "en/blog.html", True, "Blog | usher in making", "Okinawa wedding, pre-wedding and anniversary photo stories and news from usher in making.",
        "", [["Home", BASE_URL], ["Blog", BASE_URL + "en/blog.html"]])
    urls += [BASE_URL + "blog.html", BASE_URL + "en/blog.html"]

    # 各記事（ja / en）
    for p in ja_posts:
        slug = p.get("slug", "")
        rel = f"blog/{slug}.html"
        write(rel, page_shell(False, post_body(p, False)))
        title = pick(p.get("title"), "ja")
        desc = pick(p.get("excerpt"), "ja") or title
        seo_entries[rel] = seo_entry(
            rel, False, f"{title}｜usher in making", desc, p.get("cover", ""),
            [["ホーム", BASE_URL], ["ブログ", BASE_URL + "blog.html"], [title, BASE_URL + rel]],
            article={"datePublished": p.get("date", ""), "author": p.get("author", "usher in making")})
        urls.append(BASE_URL + rel)
    for p in en_posts:
        slug = p.get("slug", "")
        rel = f"en/blog/{slug}.html"
        write(rel, page_shell(True, post_body(p, True)))
        title = pick(p.get("title"), "en")
        desc = pick(p.get("excerpt"), "en") or title
        seo_entries[rel] = seo_entry(
            rel, True, f"{title} | usher in making", desc, p.get("cover", ""),
            [["Home", BASE_URL], ["Blog", BASE_URL + "en/blog.html"], [title, BASE_URL + rel]],
            article={"datePublished": p.get("date", ""), "author": p.get("author", "usher in making")})
        urls.append(BASE_URL + rel)

    write("feed.xml", build_feed(ja_posts))
    update_seo_json(seo_entries)
    return urls


if __name__ == "__main__":
    posts = []
    local = os.path.join(ROOT, "blog_posts.json")
    if os.path.exists(local):
        try:
            with open(local, encoding="utf-8") as fh:
                posts = json.load(fh)
        except Exception as ex:
            print("blog_posts.json 読み込み失敗:", ex)
    n = bake_blog(posts, root=ROOT)
    print(f"baked blog: {len(n)} urls, {len([p for p in posts if p.get('status')=='published'])} published posts")
