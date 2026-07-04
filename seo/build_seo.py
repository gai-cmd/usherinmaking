#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
usher in making — SEO / AEO manager (pure Python 3, no build tools)

ONE source of truth:  seo/seo.json
    python3 seo/build_seo.py extract   # read pages -> (re)create seo/seo.json
    python3 seo/build_seo.py apply      # seo.json -> inject managed <head> block into every page

Manages (between <!-- SEO:START --> and <!-- SEO:END -->):
    title, meta description/keywords/robots, canonical, Open Graph, Twitter Card,
    hreflang (ja/en/x-default), and JSON-LD:
        LocalBusiness(PhotographyBusiness) [all] · WebSite [website:true]
        BreadcrumbList [breadcrumb] · Product [product] · ImageGallery [gallery] · FAQPage [faq]

Covers BOTH the Japanese pages (root *.html) and the English pages (en/*.html).
Page keys in seo.json are paths relative to the project root (e.g. "about.html", "en/about.html").
English pages are auto-detected by a slug starting with "en/" (locale + hreflang flip).
Image URLs that are site-relative ("/images/...") are emitted as ABSOLUTE on the
production domain (baseUrl) so og:image / JSON-LD images are valid after launch.
Fonts/stylesheet and everything else in <head> are left untouched.
"""
import sys, os, re, json, glob, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEO_JSON = os.path.join(ROOT, "seo", "seo.json")
START = "<!-- SEO:START (managed by seo/build_seo.py — edit seo/seo.json then: python3 seo/build_seo.py apply) -->"
END = "<!-- SEO:END -->"
EXCLUDE = {"siano.html"}

# ---------------------------------------------------------------- helpers
def html_files():
    fs = glob.glob(os.path.join(ROOT, "*.html")) + glob.glob(os.path.join(ROOT, "en", "*.html"))
    rel = [os.path.relpath(p, ROOT) for p in fs]
    return sorted(f for f in rel if os.path.basename(f) not in EXCLUDE)

def read(f):
    with open(os.path.join(ROOT, f), encoding="utf-8") as fh:
        return fh.read()

def write(f, s):
    with open(os.path.join(ROOT, f), "w", encoding="utf-8") as fh:
        fh.write(s)

def attr(s):
    return html.escape(s or "", quote=True)

def find_attr(content, pattern):
    m = re.search(pattern, content, re.I | re.S)
    return m.group(1).strip() if m else ""

def parse_ldjson(content):
    out = []
    for b in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', content, re.I | re.S):
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
        "baseUrl": "https://usherinmaking.vercel.app/",
        "businessType": "PhotographyBusiness",
        "logo": "/images/logo.png",
        "description": "沖縄で活動している唯一の韓国女性カメラマン。沖縄ウェディングフォト、前撮り、セルフウェディング、記念日撮影、家族写真を韓流スタイルで撮影します。",
        "descriptionEn": "usher in making is the only Korean female photographer based in Okinawa. We shoot Okinawa wedding photos, pre-wedding, self-wedding, anniversary and family snaps in a soft Korean style.",
        "areaServed": "Okinawa, Japan",
        "priceRange": "¥¥",
        "telephone": "",
        "email": "",
        "address": {"addressCountry": "JP", "addressRegion": "沖縄県", "addressLocality": "", "postalCode": "", "streetAddress": ""},
        "geo": {"latitude": "", "longitude": ""},
        "openingHours": "",
        "sameAs": [
            "https://www.instagram.com/usherinmaking/",
            "https://blog.naver.com/usherinmaking/",
            "https://line.me/ti/p/8Udy1kYg1l",
        ],
        "localeJa": "ja_JP",
        "localeEn": "en_US",
        "defaultOgImage": "/images/up/" ,  # set/normalised by scripts/og_cleanup.py
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
        # slug mirrors the ACTUAL deployed file structure (flat .html), so canonical
        # matches the real URL on the host (no old-WordPress URL mismatch).
        if f == "index.html":
            slug = ""
        elif f == "en/index.html":
            slug = "en/"
        else:
            slug = f  # e.g. "about.html" or "en/about.html"
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
                entry["product"] = {"name": d.get("name", ""), "image": img or "", "description": d.get("description", "")}
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
    return '<script type="application/ld+json">\n' + json.dumps(obj, ensure_ascii=False, indent=2) + "\n</script>"

def faq_pairs(p, is_en):
    """faq を (q, a) ペアの list に正規化する。
    2 つの保存形式を受け付ける:
      - seo.json 由来:   [[q, a], ...]（文字列ペア。ページ単位で言語別）
      - KV(/api/seo) 由来: [{"q": {ja,en}, "a": {ja,en}}, ...]（i18n オブジェクト）
    """
    out = []
    for item in p.get("faq") or []:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            q, a = item[0], item[1]
        elif isinstance(item, dict):
            q, a = item.get("q", ""), item.get("a", "")
        else:
            continue
        def pick(v):
            if isinstance(v, dict):
                en = (v.get("en") or "").strip()
                ja = (v.get("ja") or "").strip()
                return (en or ja) if is_en else (ja or en)
            return (v or "").strip() if isinstance(v, str) else ""
        q, a = pick(q), pick(a)
        if q and a:
            out.append((q, a))
    return out

# ---- 可視 FAQ セクション（本文へベイク） -----------------------------------
# Google の構造化データポリシー: FAQPage のマークアップ内容はページ上で
# ユーザーに見えていなければならない。head の JSON-LD と同じ seo.json の
# faq データから、本文にも管理ブロックとして Q&A セクションを注入する。
FAQ_START = "<!-- FAQ:START (managed by seo/build_seo.py — edit seo/seo.json faq then: python3 seo/build_seo.py apply) -->"
FAQ_END = "<!-- FAQ:END -->"

def build_faq_section(p, is_en):
    faq = faq_pairs(p, is_en)
    if not faq:
        return ""
    heading = "FAQ" if is_en else "よくある質問"
    items = []
    for q, a in faq:
        items.append(
            '    <div class="faq-item">\n'
            f'      <dt>{attr(q)}</dt>\n'
            f'      <dd>{attr(a)}</dd>\n'
            '    </div>'
        )
    return (
        f"{FAQ_START}\n"
        '<section class="faq-section" aria-label="FAQ">\n'
        '  <div class="faq-inner">\n'
        f'    <h2>{heading}</h2>\n'
        '    <dl class="faq-list">\n' + "\n".join(items) + "\n    </dl>\n"
        "  </div>\n"
        "</section>\n"
        f"{FAQ_END}"
    )

def inject_faq(c, p, is_en):
    """既存の FAQ 管理ブロックを除去し、faq があればフッター直前に再注入。"""
    c = re.sub(re.escape(FAQ_START) + r".*?" + re.escape(FAQ_END) + r"\n?", "", c, flags=re.S)
    section = build_faq_section(p, is_en)
    if not section:
        return c
    m = re.search(r'<footer[\s>]', c, re.I)
    if m:
        return c[:m.start()] + section + "\n\n" + c[m.start():]
    m = re.search(r'</body>', c, re.I)
    if m:
        return c[:m.start()] + section + "\n" + c[m.start():]
    return c

def build_block(site, f, p):
    base = site["baseUrl"]
    rbase = base.rstrip("/")
    def absu(u):
        if not u:
            return u
        if u.startswith("http"):
            return u
        if u.startswith("/"):
            return rbase + u
        return u

    slug = p.get("slug", "")
    is_en = slug.startswith("en/")
    jpslug = slug[3:] if is_en else slug
    enslug = slug if is_en else ("en/" + slug)
    url = base + slug
    title = p.get("title", site["name"])
    desc = p.get("description", site.get("description", ""))
    kw = p.get("keywords", "")
    ogtype = p.get("ogType", "website")
    ogimg = absu(p.get("ogImage") or site.get("defaultOgImage", ""))
    locale = site["localeEn"] if is_en else site["localeJa"]
    alt = site["localeJa"] if is_en else site["localeEn"]

    L = [START]
    L.append(f"<title>{attr(title)}</title>")
    L.append(f'<meta name="description" content="{attr(desc)}" />')
    if kw:
        L.append(f'<meta name="keywords" content="{attr(kw)}" />')
    L.append('<meta name="robots" content="index,follow" />')
    L.append(f'<link rel="canonical" href="{attr(url)}" />')
    L.append(f'<meta property="og:type" content="{attr(ogtype)}" />')
    L.append(f'<meta property="og:site_name" content="{attr(site["name"])}" />')
    L.append(f'<meta property="og:title" content="{attr(title)}" />')
    L.append(f'<meta property="og:description" content="{attr(desc)}" />')
    L.append(f'<meta property="og:url" content="{attr(url)}" />')
    L.append(f'<meta property="og:image" content="{attr(ogimg)}" />')
    L.append(f'<meta property="og:locale" content="{attr(locale)}" />')
    L.append(f'<meta property="og:locale:alternate" content="{attr(alt)}" />')
    L.append('<meta name="twitter:card" content="summary_large_image" />')
    L.append(f'<meta name="twitter:title" content="{attr(title)}" />')
    L.append(f'<meta name="twitter:description" content="{attr(desc)}" />')
    L.append(f'<meta name="twitter:image" content="{attr(ogimg)}" />')
    L.append(f'<meta property="og:image:alt" content="{attr(title)}" />')
    L.append(f'<meta name="twitter:image:alt" content="{attr(title)}" />')
    L.append('<link rel="icon" href="/favicon.png" />')
    L.append('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
    L.append(f'<link rel="alternate" type="application/rss+xml" title="{attr(site["name"])} — Blog" href="{attr(rbase + "/feed.xml")}" />')
    L.append(f'<link rel="alternate" hreflang="ja" href="{attr(base + jpslug)}" />')
    L.append(f'<link rel="alternate" hreflang="en" href="{attr(base + enslug)}" />')
    L.append(f'<link rel="alternate" hreflang="x-default" href="{attr(base + jpslug)}" />')

    bizdesc = (site.get("descriptionEn") if is_en else "") or site.get("description", "")
    biz = {
        "@context": "https://schema.org",
        "@type": site.get("businessType", "LocalBusiness"),
        "name": site["name"],
        "alternateName": site.get("alternateName", ""),
        "url": url,
        "logo": absu(site.get("logo", "")),
        "image": ogimg,
        "description": bizdesc,
        "areaServed": {"@type": "Place", "name": site.get("areaServed", "")},
        "sameAs": site.get("sameAs", []),
    }
    if site.get("priceRange"):
        biz["priceRange"] = site["priceRange"]
    if site.get("telephone"):
        biz["telephone"] = site["telephone"]
    if site.get("email"):
        biz["email"] = site["email"]
    # PostalAddress: always know country/region; add the rest only when supplied
    addr = site.get("address") or {}
    post = {"@type": "PostalAddress"}
    for k in ("streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"):
        if addr.get(k):
            post[k] = addr[k]
    if len(post) > 1:
        biz["address"] = post
    geo = site.get("geo") or {}
    if geo.get("latitude") and geo.get("longitude"):
        biz["geo"] = {"@type": "GeoCoordinates", "latitude": geo["latitude"], "longitude": geo["longitude"]}
    if site.get("openingHours"):
        biz["openingHoursSpecification"] = {"@type": "OpeningHoursSpecification", "description": site["openingHours"]}
    L.append(jsonld(biz))

    if p.get("website"):
        L.append(jsonld({"@context": "https://schema.org", "@type": "WebSite",
                         "name": site["name"], "url": base, "inLanguage": ("en" if is_en else "ja"),
                         "description": desc}))
    if p.get("breadcrumb"):
        # Rebuild item URLs deterministically — the stored URLs point at the old
        # domain / WordPress paths (all 404). Keep the stored NAMES only:
        #   first  -> home (base);  last -> this page's canonical url;
        #   middle -> base + (en/) + <name>.html IF that flat file exists, else drop.
        crumbs = p["breadcrumb"]
        last = len(crumbs) - 1
        prefix = "en/" if is_en else ""
        items = []
        for i, (n, _old) in enumerate(crumbs):
            if i == 0:
                items.append((n, base))
            elif i == last:
                items.append((n, url))
            else:
                cand = n.strip().lower()
                if os.path.exists(os.path.join(ROOT, prefix + cand + ".html")):
                    items.append((n, base + prefix + cand + ".html"))
                # else: drop this middle crumb (don't emit a 404)
        L.append(jsonld({"@context": "https://schema.org", "@type": "BreadcrumbList",
                         "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u}
                                             for i, (n, u) in enumerate(items)]}))
    if p.get("product"):
        pr = p["product"]
        L.append(jsonld({"@context": "https://schema.org", "@type": "Product",
                         "name": pr.get("name", ""), "image": absu(pr.get("image", "")),
                         "description": pr.get("description", ""),
                         "brand": {"@type": "Brand", "name": site["name"]}}))
    if p.get("gallery"):
        L.append(jsonld({"@context": "https://schema.org", "@type": "ImageGallery",
                         "name": title, "description": desc, "image": [absu(x) for x in p["gallery"]]}))
    faq = faq_pairs(p, is_en)
    if faq:
        L.append(jsonld({"@context": "https://schema.org", "@type": "FAQPage",
                         "mainEntity": [{"@type": "Question", "name": q,
                                         "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}))
    if p.get("article"):
        art = p["article"]
        # E-E-A-T: seo.json の _site.authorName（撮影者名）が設定されていれば
        # Person として明示し、about ページへリンクする。無ければ Organization。
        if site.get("authorName"):
            author = {"@type": "Person", "name": site["authorName"],
                      "url": base + ("en/about.html" if is_en else "about.html")}
        else:
            author = {"@type": "Organization", "name": art.get("author") or site["name"]}
        L.append(jsonld({"@context": "https://schema.org", "@type": "BlogPosting",
                         "headline": title,
                         "image": [ogimg] if ogimg else [],
                         "datePublished": art.get("datePublished", ""),
                         "dateModified": art.get("dateModified", "") or art.get("datePublished", ""),
                         "inLanguage": ("en" if is_en else "ja"),
                         "author": author,
                         "publisher": {"@type": "Organization", "name": site["name"],
                                       "logo": {"@type": "ImageObject", "url": absu(site.get("logo", ""))}},
                         "mainEntityOfPage": {"@type": "WebPage", "@id": url},
                         "description": desc}))
    L.append(END)
    return "\n".join(L)

LEGACY = [
    r'<title>.*?</title>',
    r'<meta\s+name="description"[^>]*>',
    r'<meta\s+name="keywords"[^>]*>',
    r'<meta\s+name="robots"[^>]*>',
    r'<meta\s+property="og:[^"]*"[^>]*>',
    r'<meta\s+name="twitter:[^"]*"[^>]*>',
    r'<link\s+rel="canonical"[^>]*>',
    r'<link\s+rel="(?:icon|apple-touch-icon)"[^>]*>',
    r'<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>',
    r'<script[^>]*type="application/ld\+json"[^>]*>.*?</script>',
    r'<!--\s*(?:Open Graph|Twitter|hreflang)\s*-->',
]

def strip_legacy(c):
    c = re.sub(re.escape(START) + r".*?" + re.escape(END), "", c, flags=re.S)
    for pat in LEGACY:
        c = re.sub(pat, "", c, flags=re.I | re.S)
    c = re.sub(r"\n[ \t]*\n[ \t]*\n+", "\n\n", c)
    return c

def apply():
    with open(SEO_JSON, encoding="utf-8") as fh:
        data = json.load(fh)
    site, pages = data["_site"], data["pages"]
    n = 0
    for f, p in pages.items():
        if not os.path.exists(os.path.join(ROOT, f)):
            print(f"  ! skip (missing): {f}")
            continue
        c = strip_legacy(read(f))
        block = build_block(site, f, p)
        for anchor in (r'(<meta[^>]*name="viewport"[^>]*>)', r'(<meta[^>]*charset[^>]*>)', r'(<head[^>]*>)'):
            m = re.search(anchor, c, re.I)
            if m:
                c = c[:m.end()] + "\n" + block + c[m.end():]
                break
        # 可視 FAQ セクション（JSON-LD と同じデータを本文にもベイク）
        c = inject_faq(c, p, p.get("slug", "").startswith("en/"))
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
