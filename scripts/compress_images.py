#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shrink heavy localized images IN PLACE by fetching WordPress's smaller size variants
(<=1200px wide) from the original site and overwriting the matching /images/up/<hash> file.
No image library needed (downloads pre-made variants). Non-destructive: only overwrites
a file when a smaller variant is actually found and is smaller than the current file.
Filenames are unchanged, so no HTML edits are required.
"""
import os, re, sys, hashlib, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = os.path.join(ROOT, "images", "up")
UA = {"User-Agent": "Mozilla/5.0 (compress)"}
MAXW = 1200
MIN_BYTES = 250 * 1024  # only bother with files >250KB

def enc(url):
    p = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((p.scheme, p.netloc, urllib.parse.quote(p.path), p.query, ""))

def fetch_text(url):
    try:
        return urllib.request.urlopen(urllib.request.Request(enc(url), headers=UA), timeout=30).read().decode("utf-8", "ignore")
    except Exception:
        return ""

def fetch_bytes(url):
    try:
        return urllib.request.urlopen(urllib.request.Request(enc(url), headers=UA), timeout=40).read()
    except Exception:
        return b""

def localname(url):
    ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
    if len(ext) > 5: ext = ".jpg"
    return hashlib.md5(url.encode()).hexdigest()[:16] + ext

def strip_size(u):  # ".../name-819x1024.jpg" -> ".../name.jpg"
    return re.sub(r'-\d+x\d+(\.\w+)$', r'\1', u)

def discover_pages():
    seeds = ['https://usherinmaking.jp/' + s for s in
             ['', 'about/', 'wedding/', 'anniversary/', 'dress/', 'plan/', 'contact/']]
    pages = set(seeds)
    pages.add('https://usherinmaking.jp/plan/%e3%83%a2%e3%83%8b%e3%82%bf%e3%83%bc%e5%8b%9f%e9%9b%86/')
    for s in seeds:
        html = fetch_text(s)
        for m in re.findall(r'href="(https://usherinmaking\.jp/(?:portfolio|product)/[^"]+)"', html):
            pages.add(m.split('"')[0])
    return pages

def main():
    pages = discover_pages()
    print(f"discovered {len(pages)} source pages")
    # map: local file path -> best variant url (<=MAXW, largest)
    plan = {}
    for pg in pages:
        html = fetch_text(pg)
        for tag in re.findall(r'<img[^>]+>', html):
            srcset = re.search(r'\bsrcset="([^"]+)"', tag)
            src = re.search(r'\bsrc="([^"]+)"', tag)
            urls = []
            if src: urls.append(src.group(1))
            variants = []  # (width, url)
            if srcset:
                for part in srcset.group(1).split(','):
                    seg = part.strip().split()
                    if len(seg) >= 2 and seg[1].endswith('w'):
                        try: variants.append((int(seg[1][:-1]), seg[0]))
                        except: pass
                urls += [u for _, u in variants]
            urls = [u for u in urls if 'wp-content/uploads' in u]
            if not urls: continue
            # candidate local files: hash of each url + the size-stripped "original"
            keys = set()
            for u in urls:
                keys.add(u); keys.add(strip_size(u))
            target = None
            for k in keys:
                lf = os.path.join(UP, localname(k))
                if os.path.exists(lf) and os.path.getsize(lf) >= MIN_BYTES:
                    target = lf; break
            if not target: continue
            small = [(w, u) for (w, u) in variants if w <= MAXW]
            if not small: continue
            w, vurl = max(small)
            prev = plan.get(target)
            if not prev or prev[0] < w:
                plan[target] = (w, vurl)

    print(f"{len(plan)} heavy images matched a <= {MAXW}px variant; downloading…")
    saved = [0]; cnt = [0]
    def work(item):
        lf, (w, vurl) = item
        data = fetch_bytes(vurl)
        if data and len(data) < os.path.getsize(lf):
            before = os.path.getsize(lf)
            open(lf, "wb").write(data)
            saved[0] += before - len(data); cnt[0] += 1
    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(work, plan.items()))
    print(f"shrunk {cnt[0]} images; saved {saved[0]//1024//1024} MB")
    print(f"images/up total now: ", end="")
    sys.stdout.flush()
    os.system(f"du -sh {UP} | cut -f1")

if __name__ == "__main__":
    main()
