#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Normalize image URLs inside seo/seo.json for real-domain deployment:
remap any old WordPress image URL (usherinmaking.jp/wp-content/uploads/...) to the
localized asset path (/images/up/<hash>.<ext>, or /images/logo.png for the logo).
build_seo.py's apply() then emits these as ABSOLUTE production URLs in og:image /
Twitter / JSON-LD. Images that were never downloaded keep their original URL.

Run order:
    python3 seo/build_seo.py extract
    python3 scripts/og_cleanup.py
    python3 seo/build_seo.py apply
"""
import os, re, json, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEO = os.path.join(ROOT, "seo", "seo.json")
WP = re.compile(r'^https://usherinmaking\.jp/wp-content/uploads/')

def localpath(url):
    if "logo_195_48-1.png" in url:
        return "/images/logo.png"
    ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
    if len(ext) > 5:
        ext = ".jpg"
    p = "/images/up/" + hashlib.md5(url.encode()).hexdigest()[:16] + ext
    return p if os.path.exists(ROOT + p) else None

def conv(v, stats):
    if isinstance(v, str):
        if WP.match(v):
            lp = localpath(v)
            if lp:
                stats[0] += 1
                return lp
            stats[1] += 1
        return v
    if isinstance(v, list):
        return [conv(x, stats) for x in v]
    if isinstance(v, dict):
        return {k: conv(x, stats) for k, x in v.items()}
    return v

def main():
    data = json.load(open(SEO, encoding="utf-8"))
    stats = [0, 0]  # remapped, kept-remote
    data = conv(data, stats)
    # ensure a sensible default OG image (the localized hero shot)
    hero = "https://usherinmaking.jp/wp-content/uploads/2021/06/오키나와스냅_어셔린메이킹-0197.jpg"
    lp = localpath(hero)
    if lp:
        data["_site"]["defaultOgImage"] = lp
    json.dump(data, open(SEO, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"og_cleanup: remapped {stats[0]} image URL(s) to local; kept {stats[1]} remote (no local copy)")

if __name__ == "__main__":
    main()
