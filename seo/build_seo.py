#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
usher in making — SEO / AEO manager (no build tools required, pure Python 3)

ONE source of truth:  seo/seo.json
Two commands:
    python3 seo/build_seo.py extract   # read current pages -> (re)create seo/seo.json
    python3 seo/build_seo.py apply      # write seo.json -> inject managed <head> block into every page

What it manages (the block between <!-- SEO:START --> and <!-- SEO:END -->):
    <title>, meta description / keywords / robots, canonical,
    Open Graph, Twitter Card, hreflang (ja / en / x-default),
    JSON-LD structured data (AEO):
        - LocalBusiness (PhotographyBusiness)   ... every page, from "_site"
        - WebSite                                ... pages with "website": true
        - BreadcrumbList                         ... pages with "breadcrumb"
        - Product                                ... pages with "product"
        - ImageGallery                           ... pages with "gallery"
        - FAQPage                                ... pages with "faq"

Everything else in <head> (fonts, stylesheet) is left untouched.
To add a page: add an entry under "pages" in seo.json and run `apply`.
"""
import sys, os, re, json, glob, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEO_JSON = os.path.join(ROOT, "seo", "seo.json")
START = "<!-- SEO:START (managed by seo/build_seo.py — edit seo/seo.json then: python3 seo/build_seo.py apply) -->"
END = "<!-- SEO:END -->"
EXCLUDE = {"siano.html"}

# ---------------------------------------------------------------- helpers
def html_files():
    fs = [os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "*.html"))]
    return sorted(f for f in fs if f not in EXCLUDE)

def read(f):
    with open(os.path.join(ROOT, f), encoding="utf-8") as fh:
        return fh.read()

def write(f, s):
    with open(os.path.join(ROOT, f), "w", encoding="utf-8") as fh:
        fh.write(s)

def attr(s):
    """escape a value for use inside a double-quoted HTML attribute"""
    return html.escape(s or "", quote=True)

def find_attr(content, pattern):
    m = re.search(pattern, content, re.I | re.S)
    return m.group(1).strip() if m else ""

def parse_ldjson(content):
    blocks = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
                        content, re.I | re.S)
    out = []
    for b in blocks:
        try:
            out.append(json.loads(b))
        except Exception:
            pass
    return out

# ---------------------------------------------------------------- extract
def extract():
    site = {
        "name": "usher in making",
        "alternateName": "usherinmaking",
        "baseUrl": "https://usherinmaking.jp/",
        "businessType": "PhotographyBusiness",
        "logo": "https://usherinmaking.jp/wp-content/uploads/2021/05/logo_195_48-1.png",
        "description": "沖縄で活動している唯一の韓国女性カメラマン。沖縄ウェディングフォト、前撮り、セルフウェディング、記念日撮影、家族写真を韓流スタイルで撮影します。",
        "areaServed": "Okinawa, Japan",
        "sameAs": [
            "https://instagram.com/usherinmaking",
            "https://blog.naver.com/moya100"
        ],
        "localeJa": "ja_JP",
        "localeEn": "en_US",
        "defaultOgImage": "https://usherinmaking.jp/wp-content/uploads/2021/06/오키나와스냅_어셔린메이킹-0197.jpg"
    }
    base = site["baseUrl"]
    pages = {}
    for f in html_files():
        c = read(f)
        if "<title>" not in c:
            continue
        title = find_attr(c, r"<title>(.*?)</title>")
        desc = find_attr(c, r'<meta\s+name="description"\s+content="(.*?)"')
        kw = find_attr(c, r'<meta\s+name="keywords"\s+content="(.*?)"')
        canon = find_attr(c, r'<link\s+rel="canonical"\s+href="(.*?)"')
        ogimg = find_attr(c, r'<meta\s+property="og:image"\s+content="(.*?)"')
        ogtype = find_attr(c, r'<meta\s+property="og:type"\s+content="(.*?)"') or "website"
        slug = canon[len(base):] if canon.startswith(base) else ""

        entry = {
            "slug": slug,
            "title": html.unescape(title),
            "description": html.unescape(desc),
            "keywords": html.unescape(kw),
            "ogType": ogtype,
            "ogImage": ogimg or "",
        }
        for d in parse_ldjson(c):
            t = d.get("@type")
            if t == "WebSite":
                entry["website"] = True
            elif t == "BreadcrumbList":
                items = sorted(d.get("itemListElement", []), key=lambda x: x.get("position", 0))
                entry["breadcrumb"] = [[i.get("name", ""), i.get("item", "")] for i in items]
            elif t == "Product":
                img = d.get("image")
                if isinstance(img, list):
                    img = img[0] if img else ""
                entry["product"] = {"name": d.get("name", ""), "image": img or "",
                                    "description": d.get("description", "")}
            elif t == "ImageGallery":
                imgs = d.get("image") or []
                if not imgs and d.get("associatedMedia"):
                    imgs = [m.get("contentUrl", "") for m in d["associatedMedia"]]
                entry["gallery"] = [u for u in imgs if u]
            elif t == "FAQPage":
                qa = []
                for q in d.get("mainEntity", []):
                    a = q.get("acceptedAnswer", {})
                    qa.append([q.get("name", ""), a.get("text", "")])
                entry["faq"] = qa
        pages[f] = entry

    data = {"_site": site, "pages": pages}
    os.makedirs(os.path.dirname(SEO_JSON), exist_ok=True)
    with open(SEO_JSON, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    print(f"extracted {len(pages)} pages -> {os.path.relpath(SEO_JSON, ROOT)}")

# ---------------------------------------------------------------- apply
def jsonld(obj):
    return '<script type="application/ld+json">\n' + \
           json.dumps(obj, ensure_ascii=False, indent=2) + "\n</script>"

def build_block(site, f, p):
    base = site["baseUrl"]
    slug = p.get("slug", "")
    url = base + slug
    title = p.get("title", site["name"])
    desc = p.get("description", site.get("description", ""))
    kw = p.get("keywords", "")
    ogtype = p.get("ogType", "website")
    ogimg = p.get("ogImage") or site.get("defaultOgImage", "")

    L = [START]
    L.append(f"<title>{attr(title)}</title>")
    L.append(f'<meta name="description" content="{attr(desc)}" />')
    if kw:
        L.append(f'<meta name="keywords" content="{attr(kw)}" />')
    L.append('<meta name="robots" content="index,follow" />')
    L.append(f'<link rel="canonical" href="{attr(url)}" />')
    # Open Graph
    L.append(f'<meta property="og:type" content="{attr(ogtype)}" />')
    L.append(f'<meta property="og:site_name" content="{attr(site["name"])}" />')
    L.append(f'<meta property="og:title" content="{attr(title)}" />')
    L.append(f'<meta property="og:description" content="{attr(desc)}" />')
    L.append(f'<meta property="og:url" content="{attr(url)}" />')
    L.append(f'<meta property="og:image" content="{attr(ogimg)}" />')
    L.append(f'<meta property="og:locale" content="{attr(site.get("localeJa","ja_JP"))}" />')
    L.append(f'<meta property="og:locale:alternate" content="{attr(site.get("localeEn","en_US"))}" />')
    # Twitter
    L.append('<meta name="twitter:card" content="summary_large_image" />')
    L.append(f'<meta name="twitter:title" content="{attr(title)}" />')
    L.append(f'<meta name="twitter:description" content="{attr(desc)}" />')
    L.append(f'<meta name="twitter:image" content="{attr(ogimg)}" />')
    # hreflang
    L.append(f'<link rel="alternate" hreflang="ja" href="{attr(url)}" />')
    L.append(f'<link rel="alternate" hreflang="en" href="{attr(base + "en/" + slug)}" />')
    L.append(f'<link rel="alternate" hreflang="x-default" href="{attr(url)}" />')

    # ---- JSON-LD (AEO) ----
    biz = {
        "@context": "https://schema.org",
        "@type": site.get("businessType", "LocalBusiness"),
        "name": site["name"],
        "alternateName": site.get("alternateName", ""),
        "url": url,
        "logo": site.get("logo", ""),
        "image": ogimg,
        "description": site.get("description", ""),
        "areaServed": {"@type": "Place", "name": site.get("areaServed", "")},
        "sameAs": site.get("sameAs", []),
    }
    L.append(jsonld(biz))

    if p.get("website"):
        L.append(jsonld({
            "@context": "https://schema.org", "@type": "WebSite",
            "name": site["name"], "url": base, "inLanguage": "ja",
            "description": desc,
        }))
    if p.get("breadcrumb"):
        L.append(jsonld({
            "@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "name": n, "item": u}
                for i, (n, u) in enumerate(p["breadcrumb"])
            ],
        }))
    if p.get("product"):
        pr = p["product"]
        L.append(jsonld({
            "@context": "https://schema.org", "@type": "Product",
            "name": pr.get("name", ""), "image": pr.get("image", ""),
            "description": pr.get("description", ""),
            "brand": {"@type": "Brand", "name": site["name"]},
        }))
    if p.get("gallery"):
        L.append(jsonld({
            "@context": "https://schema.org", "@type": "ImageGallery",
            "name": title, "description": desc, "image": p["gallery"],
        }))
    if p.get("faq"):
        L.append(jsonld({
            "@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": q,
                 "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in p["faq"]
            ],
        }))
    L.append(END)
    return "\n".join(L)

# patterns for legacy (un-marked) SEO tags
LEGACY = [
    r'<title>.*?</title>',
    r'<meta\s+name="description"[^>]*>',
    r'<meta\s+name="keywords"[^>]*>',
    r'<meta\s+name="robots"[^>]*>',
    r'<meta\s+property="og:[^"]*"[^>]*>',
    r'<meta\s+name="twitter:[^"]*"[^>]*>',
    r'<link\s+rel="canonical"[^>]*>',
    r'<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>',
    r'<script[^>]*type="application/ld\+json"[^>]*>.*?</script>',
    r'<!--\s*(?:Open Graph|Twitter|hreflang)\s*-->',
]

def strip_legacy(c):
    # remove any previously managed block first
    c = re.sub(re.escape(START) + r".*?" + re.escape(END), "", c, flags=re.S)
    for pat in LEGACY:
        c = re.sub(pat, "", c, flags=re.I | re.S)
    # tidy blank lines inside head
    c = re.sub(r"\n[ \t]*\n[ \t]*\n+", "\n\n", c)
    return c

def apply():
    with open(SEO_JSON, encoding="utf-8") as fh:
        data = json.load(fh)
    site, pages = data["_site"], data["pages"]
    n = 0
    for f, p in pages.items():
        path = os.path.join(ROOT, f)
        if not os.path.exists(path):
            print(f"  ! skip (missing): {f}")
            continue
        c = read(f)
        c = strip_legacy(c)
        block = build_block(site, f, p)
        # insert after viewport meta, else after charset, else after <head>
        for anchor in (r'(<meta[^>]*name="viewport"[^>]*>)',
                       r'(<meta[^>]*charset[^>]*>)',
                       r'(<head[^>]*>)'):
            m = re.search(anchor, c, re.I)
            if m:
                c = c[:m.end()] + "\n" + block + c[m.end():]
                break
        write(f, c)
        n += 1
    print(f"applied managed SEO/AEO block to {n} pages")

# ---------------------------------------------------------------- main
if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "apply"
    if cmd == "extract":
        extract()
    elif cmd == "apply":
        apply()
    else:
        print(__doc__)
        sys.exit(1)
