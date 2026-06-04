#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Replace remaining placeholder/broken images with real localized photos.
For each <img> whose src is a picsum.photos placeholder OR a still-remote
usherinmaking.jp/wp-content image (download 404), pick a real /images/up/ photo:
  1) if the <img> is wrapped in <a href="LOCAL.html">, use that page's first photo
  2) else if its alt text matches a known gallery/dress, use that page's first photo
  3) else fall back to a rotating real photo from the pool
siano.html (the standalone design demo) is left untouched.
"""
import os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TITLE2FILE = {
  'ウェディング':'gallery-wedding.html','晴れの日、8月':'gallery-hare-8.html','8月':'gallery-self-8.html',
  '七五三お祝い':'gallery-family-753.html','デート':'gallery-date.html','11月':'gallery-11.html',
  '家族':'gallery-family.html','デート雨天':'gallery-date-rain.html','6月日本カップル':'gallery-jp-couple-6.html',
  '7月末':'gallery-couple-7.html','曇り1月':'gallery-kumori-1.html','2月、桜':'gallery-sakura-2.html',
  '晴れの日、9月':'gallery-hare-9.html','晴れの日、7月':'gallery-hare-7.html','晴れの日、6月':'gallery-hare-6.html',
  '晴れの日、4月':'gallery-hare-4.html','晴れの日、3月':'gallery-hare-3.html',
}

def norm(s): return re.sub(r'\s+', '', s or '')
T2F = {norm(k): v for k, v in TITLE2FILE.items()}

def first_photo(htmlpath):
    try:
        c = open(htmlpath, encoding='utf-8').read()
    except Exception:
        return None
    m = re.search(r'(/images/up/[A-Za-z0-9]+\.(?:jpg|jpeg|png))', c)
    return m.group(1) if m else None

POOL = sorted(glob.glob(os.path.join(ROOT, 'images', 'up', '*.jpg')))
POOL = ['/images/up/' + os.path.basename(p) for p in POOL]

BAD = re.compile(r'https://picsum\.photos/[^"\')]+|https://usherinmaking\.jp/wp-content/uploads/[^"\')]+')
# an <img ...src="BAD"...> optionally preceded by an <a href="LINK">
IMG = re.compile(r'(?:<a\s+href="([^"]+)"[^>]*>\s*)?<img\b[^>]*\bsrc="(' + BAD.pattern + r')"[^>]*>', re.I)

def resolve_local(href, base_is_en):
    if not href or href.startswith('http') or href.startswith('#'):
        return None
    rel = href[1:] if href.startswith('/') else (('en/' + href) if base_is_en and '/' not in href else href)
    p = os.path.join(ROOT, rel)
    return first_photo(p) if os.path.exists(p) else None

def main():
    files = [f for f in (glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, 'en', '*.html')))
             if os.path.basename(f) != 'siano.html']
    pool_i = [0]
    total = 0
    for fp in files:
        is_en = '/en/' in fp.replace(os.sep, '/')
        c = open(fp, encoding='utf-8').read()
        # capture alt for fallback matching, per-match
        def sub(m):
            whole, href, bad = m.group(0), m.group(1), m.group(2)
            alt_m = re.search(r'\balt="([^"]*)"', whole)
            alt = alt_m.group(1) if alt_m else ''
            new = resolve_local(href, is_en)
            if not new:
                f2 = T2F.get(norm(alt))
                if f2:
                    new = first_photo(os.path.join(ROOT, ('en/' + f2) if is_en else f2)) or first_photo(os.path.join(ROOT, f2))
            if not new and POOL:
                new = POOL[pool_i[0] % len(POOL)]; pool_i[0] += 1
            if not new:
                return whole
            return whole.replace(bad, new)
        nc, n = IMG.subn(sub, c)
        if nc != c:
            open(fp, 'w', encoding='utf-8').write(nc); total += n
    print(f"replaced {total} placeholder/broken image(s) with real photos")

if __name__ == '__main__':
    main()
