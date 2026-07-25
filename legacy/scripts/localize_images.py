#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Localize remote images: download every usherinmaking.jp/wp-content/uploads/* image
referenced in src="" / url() of the HTML and CSS into images/up/, and rewrite those
references to a site-root path (/images/up/<hash>.<ext>).

- og:image / twitter:image / JSON-LD image (meta "content" and structured data) are
  LEFT as absolute remote URLs on purpose (social/structured data want absolute URLs).
- Downloads run concurrently; failures keep the original remote URL untouched.

Usage:
    python3 scripts/localize_images.py            # download + rewrite
    python3 scripts/localize_images.py --dry-run  # just report what it would do
"""
import os, re, sys, glob, hashlib, urllib.request, time
from urllib.parse import urlsplit, urlunsplit, quote
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, "images", "up")
RE_URL = re.compile(r'https://usherinmaking\.jp/wp-content/uploads/[^"\')\s]+')
UA = {"User-Agent": "Mozilla/5.0 (localize_images)"}
DRY = "--dry-run" in sys.argv

def targets():
    return (
        glob.glob(os.path.join(ROOT, "*.html"))
        + glob.glob(os.path.join(ROOT, "en", "*.html"))
        + glob.glob(os.path.join(ROOT, "css", "*.css"))
    )

def local_name(url):
    ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
    if len(ext) > 5:
        ext = ".jpg"
    return hashlib.md5(url.encode()).hexdigest()[:16] + ext

def collect():
    urls = set()
    for f in targets():
        c = open(f, encoding="utf-8").read()
        # only URLs used as an image src or in a CSS/inline url(...)
        for m in re.finditer(r'(?:src=["\']|url\(["\']?)(' + RE_URL.pattern + r')', c):
            urls.add(m.group(1))
    return sorted(urls)

def encode_url(url):
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, quote(p.path), quote(p.query, safe="=&"), ""))

def download(url):
    dest = os.path.join(OUTDIR, local_name(url))
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return (url, True)
    enc = encode_url(url)
    for attempt in range(3):
        try:
            req = urllib.request.Request(enc, headers=UA)
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            if data:
                with open(dest, "wb") as fh:
                    fh.write(data)
                return (url, True)
        except Exception as e:
            if attempt == 2:
                sys.stderr.write(f"  ! fail {url} ({e})\n")
            else:
                time.sleep(1.5)
    return (url, False)

def main():
    os.makedirs(OUTDIR, exist_ok=True)
    urls = collect()
    print(f"found {len(urls)} unique image URLs used as src/url()")
    if DRY:
        for u in urls[:10]:
            print("  ", u, "->", "/images/up/" + local_name(u))
        print("  …(dry run, nothing downloaded)")
        return

    ok = set()
    with ThreadPoolExecutor(max_workers=6) as ex:
        for url, good in ex.map(download, urls):
            if good:
                ok.add(url)
    print(f"downloaded/cached {len(ok)} / {len(urls)} images into images/up/")

    # rewrite only successfully-downloaded URLs, only in src/url() contexts
    changed = 0
    for f in targets():
        c = open(f, encoding="utf-8").read()
        orig = c
        for url in ok:
            L = "/images/up/" + local_name(url)
            c = (c.replace('src="' + url + '"', 'src="' + L + '"')
                   .replace("src='" + url + "'", "src='" + L + "'")
                   .replace('url(' + url + ')', 'url(' + L + ')')
                   .replace('url("' + url + '")', 'url("' + L + '")')
                   .replace("url('" + url + "')", "url('" + L + "')"))
        if c != orig:
            open(f, "w", encoding="utf-8").write(c)
            changed += 1
    print(f"rewrote references in {changed} files")
    failed = [u for u in urls if u not in ok]
    if failed:
        print(f"NOTE: {len(failed)} image(s) failed to download and keep their remote URL:")
        for u in failed[:20]:
            print("   -", u)

if __name__ == "__main__":
    main()
