#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
localize_blog_images.py — blog_posts.json の Naver 画像をローカル化する。

Naver の pstatic.net は外部サイトからの Referer 付きリクエストを 403 で拒否する
（ホットリンク禁止）ため、記事内の画像をそのまま参照すると訪問者のブラウザでは
すべて壊れて表示される。本スクリプトは blog_posts.json 内の外部画像
（pstatic.net / naver 系）を images/blog/ にダウンロードし、参照を
/images/blog/<hash>.<ext> へ書き換える。

- cover の低解像度サムネ（?type=w2 等）は ?type=w966 に引き上げてから取得。
- ダウンロード失敗した URL は元のまま残す（再実行で再試行できる）。
- 冪等: 既にローカル化済みの URL・既存ファイルはスキップ。

使い方:
    python3 scripts/localize_blog_images.py
    （その後 python3 scripts/bake_blog.py で再ベイク）
"""
import os, re, json, hashlib, sys, time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS = os.path.join(ROOT, "blog_posts.json")
OUTDIR = os.path.join(ROOT, "images", "blog")
RE_REMOTE = re.compile(r'https://[a-z0-9.-]*(?:pstatic\.net|naver\.(?:com|net))/[^"\s)]+', re.I)
UA = {"User-Agent": "Mozilla/5.0 (localize_blog_images)"}


def upgrade(url):
    """サムネ品質の type パラメータを本文表示品質へ引き上げる。"""
    return re.sub(r"\?type=w\d+.*$", "?type=w966", url)


def local_name(url):
    base = url.split("?")[0]
    ext = os.path.splitext(base)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"):
        ext = ".jpg"
    return hashlib.md5(url.encode()).hexdigest()[:16] + ext


def download(url):
    dest = os.path.join(OUTDIR, local_name(url))
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return url, True
    # 高画質版（?type=w966）→ 元 URL の順で試す（blogthumb 等は w966 が 404 のことがある）
    candidates = [upgrade(url)]
    if candidates[0] != url:
        candidates.append(url)
    for cand in candidates:
        for attempt in range(2):
            try:
                req = urllib.request.Request(cand, headers=UA)
                with urllib.request.urlopen(req, timeout=40) as r:
                    data = r.read()
                if data:
                    with open(dest, "wb") as fh:
                        fh.write(data)
                    return url, True
            except Exception as e:
                if attempt == 1 and cand == candidates[-1]:
                    sys.stderr.write("  ! fail %s (%s)\n" % (url, e))
                else:
                    time.sleep(1.2)
    return url, False


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    with open(POSTS, encoding="utf-8") as fh:
        posts = json.load(fh)

    urls = set()
    for p in posts:
        body = p.get("body") or {}
        for loc in ("ja", "en", "ko"):
            urls.update(RE_REMOTE.findall(body.get(loc) or ""))
        cover = p.get("cover") or ""
        if RE_REMOTE.match(cover):
            urls.add(cover)
    urls = sorted(urls)
    print("remote images: %d" % len(urls))

    ok = set()
    with ThreadPoolExecutor(max_workers=6) as ex:
        for url, good in ex.map(download, urls):
            if good:
                ok.add(url)
    print("downloaded/cached %d / %d -> images/blog/" % (len(ok), len(urls)))

    # dthumb-phinf（Instagram ウィジェット等の巻き込みサムネ）は本文から除去する。
    RE_JUNK_IMG = re.compile(
        r'<figure>\s*<img\b[^>]*src="[^"]*dthumb-phinf[^"]*"[^>]*>\s*</figure>|<img\b[^>]*src="[^"]*dthumb-phinf[^"]*"[^>]*>',
        re.I,
    )
    replaced = 0
    for p in posts:
        body = p.get("body") or {}
        for loc in ("ja", "en", "ko"):
            s = body.get(loc) or ""
            s = RE_JUNK_IMG.sub("", s)
            for url in ok:
                if url in s:
                    s = s.replace(url, "/images/blog/" + local_name(url))
                    replaced += 1
            body[loc] = s
        cover = p.get("cover") or ""
        if cover in ok:
            p["cover"] = "/images/blog/" + local_name(cover)
            replaced += 1
        elif cover and not cover.startswith("/"):
            # カバーがダウンロードできなかった場合は本文の最初のローカル画像で代替。
            m = re.search(r'src="(/images/blog/[^"]+)"', body.get("ja") or body.get("ko") or "")
            if m:
                p["cover"] = m.group(1)
                replaced += 1
            else:
                p["cover"] = ""
    with open(POSTS, "w", encoding="utf-8") as fh:
        json.dump(posts, fh, ensure_ascii=False, indent=2)
    print("rewrote %d references in blog_posts.json" % replaced)
    failed = [u for u in urls if u not in ok]
    if failed:
        print("NOTE: %d image(s) failed (kept remote):" % len(failed))
        for u in failed[:10]:
            print("  -", u)


if __name__ == "__main__":
    main()
