#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
usher in making — sitemap.xml 生成（pure Python 3 stdlib）

リポジトリ上の公開 HTML（ルート *.html・en/*.html・blog/*.html・en/blog/*.html）から
sitemap.xml を再生成する。各 URL に <lastmod>（ファイル更新日）と、ja↔en の
hreflang 代替（xhtml:link）を付与する。ブログ記事も自動で含まれる。

呼び出し:
    python3 scripts/build_sitemap.py      # ローカル / vercel_build から
"""
import os, glob, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://usherinmaking.vercel.app/"
EXCLUDE = {"admin.html", "404.html"}

XHTML_NS = 'xmlns:xhtml="http://www.w3.org/1999/xhtml"'


def rel_files():
    pats = ["*.html", os.path.join("en", "*.html"),
            os.path.join("blog", "*.html"), os.path.join("en", "blog", "*.html")]
    out = []
    for pat in pats:
        for p in glob.glob(os.path.join(ROOT, pat)):
            rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
            if os.path.basename(rel) in EXCLUDE:
                continue
            out.append(rel)
    return sorted(set(out))


def loc_for(rel):
    if rel == "index.html":
        return BASE
    if rel == "en/index.html":
        return BASE + "en/"
    return BASE + rel


def ja_en_pair(rel):
    """(ja_rel, en_rel) を返す。index は 'en/' 扱い。"""
    if rel.startswith("en/"):
        en = rel
        ja = rel[3:]
    else:
        ja = rel
        en = "en/" + rel
    return ja, en


def lastmod(rel):
    try:
        return time.strftime("%Y-%m-%d", time.gmtime(os.path.getmtime(os.path.join(ROOT, rel))))
    except Exception:
        return ""


def priority(rel):
    if rel in ("index.html", "en/index.html"):
        return "1.0"
    if rel in ("reserve.html", "blog.html", "en/blog.html"):
        return "0.9"
    if rel.startswith("blog/") or rel.startswith("en/blog/"):
        return "0.7"
    if rel in ("privacy.html", "tokushoho.html"):
        return "0.3"
    return "0.8"


def main():
    files = set(rel_files())
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" {XHTML_NS}>']
    for rel in sorted(files):
        loc = loc_for(rel)
        ja, en = ja_en_pair(rel)
        alts = []
        if ja in files and en in files:
            alts.append(f'    <xhtml:link rel="alternate" hreflang="ja" href="{loc_for(ja)}" />')
            alts.append(f'    <xhtml:link rel="alternate" hreflang="en" href="{loc_for(en)}" />')
            alts.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{loc_for(ja)}" />')
        lm = lastmod(rel)
        block = [f'  <url>', f'    <loc>{loc}</loc>']
        if lm:
            block.append(f'    <lastmod>{lm}</lastmod>')
        block.append(f'    <priority>{priority(rel)}</priority>')
        block += alts
        block.append('  </url>')
        lines.append("\n".join(block))
    lines.append('</urlset>')
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"sitemap.xml: {len(files)} urls")


if __name__ == "__main__":
    main()
