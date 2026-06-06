#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
usher in making — content baker (契約 v4, pure Python 3 standard library only)

Applies `uim:pages` regions onto the static HTML at build time so that the
managed body copy is crawler-visible.  This module is also imported by
scripts/insert_region_markers.py (DOM + selector engine) and
scripts/vercel_build.py (bake_content entry point).

Region definitions live in scripts/region_map.json:
    { "<glob>": { "<regionId>": {"selector": ..., "type": "text|lines|photos",
                                 "fields": {...}, "nth": <int?>} } }

`uim:pages` shape:
    { "<path>": { "regions": { "<regionId>": <value> } } }
    text   value -> { "<field>": {"ja": "...", "en": "..."} , ... }
    lines  value -> { "lines": [ {"text": {"ja","en"}, "dim": bool}, ... ] }
    photos value -> { "items": [ {"src": "...", "caption": {"ja","en"}}, ... ] }

Locale: "ja" bakes the root page (path), "en" bakes en/<path>.
Empty / missing localized value => the node is left untouched (never blanked).
"""
import os
import re
import json
import fnmatch
import html as _html
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGION_MAP = os.path.join(ROOT, "scripts", "region_map.json")

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}

_IDENT = re.compile(r"^[a-zA-Z][\w-]*$")


# ---------------------------------------------------------------- escaping
def esc(s):
    """Escape text node content."""
    return _html.escape(s or "", quote=False)


def escq(s):
    """Escape an attribute value."""
    return _html.escape(s or "", quote=True)


# ---------------------------------------------------------------- DOM
class Node:
    __slots__ = ("tag", "attrs", "classes", "children", "parent",
                 "tag_start", "tag_end", "inner_start", "inner_end",
                 "node_end", "starttag_text")

    def __init__(self, tag, attrs, tag_start, tag_end, starttag_text):
        self.tag = tag
        self.attrs = attrs
        self.classes = (attrs.get("class") or "").split()
        self.children = []
        self.parent = None
        self.tag_start = tag_start      # offset of '<'
        self.tag_end = tag_end          # offset just after start-tag '>'
        self.inner_start = tag_end      # offset where inner content begins
        self.inner_end = tag_end        # offset where end-tag '<' begins
        self.node_end = tag_end         # offset just after end-tag '>'
        self.starttag_text = starttag_text


class DOM(HTMLParser):
    """Minimal offset-tracking DOM for the controlled markup in this repo."""

    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self._lines = [0]
        for i, ch in enumerate(text):
            if ch == "\n":
                self._lines.append(i + 1)
        self.root_children = []
        self._stack = []
        self.feed(text)
        self.close()

    def _abs(self):
        line, col = self.getpos()
        return self._lines[line - 1] + col

    def _add(self, node):
        if self._stack:
            node.parent = self._stack[-1]
            self._stack[-1].children.append(node)
        else:
            self.root_children.append(node)

    def _open(self, tag, attrs):
        start = self._abs()
        st = self.get_starttag_text() or ""
        end = start + len(st)
        node = Node(tag, dict(attrs), start, end, st)
        self._add(node)
        return node

    def handle_starttag(self, tag, attrs):
        node = self._open(tag, attrs)
        if tag not in VOID:
            self._stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self._open(tag, attrs)

    def handle_endtag(self, tag):
        pos = self._abs()
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i].tag == tag:
                node = self._stack[i]
                node.inner_end = pos
                gt = self.text.find(">", pos)
                node.node_end = (gt + 1) if gt != -1 else pos
                del self._stack[i:]
                break


def descendants(node):
    for ch in node.children:
        yield ch
        yield from descendants(ch)


def all_nodes(dom):
    for r in dom.root_children:
        yield r
        yield from descendants(r)


# ---------------------------------------------------------------- selectors
def _parse_compound(tok):
    tag = idv = None
    classes = []
    for m in re.finditer(r"([.#]?)([\w-]+)", tok):
        sym, name = m.group(1), m.group(2)
        if sym == ".":
            classes.append(name)
        elif sym == "#":
            idv = name
        else:
            tag = name
    return tag, classes, idv


def _matches(node, comp):
    tag, classes, idv = comp
    if tag and node.tag != tag:
        return False
    if idv and node.attrs.get("id") != idv:
        return False
    for c in classes:
        if c not in node.classes:
            return False
    return True


def select(roots, selector):
    """Descendant-combinator CSS select. Returns matches in document order."""
    parts = [_parse_compound(p) for p in selector.split()]
    matched = list(roots)
    for idx, comp in enumerate(parts):
        nxt = []
        seen = set()
        for ctx in matched:
            pool = descendants(ctx) if idx > 0 else _self_or_desc(ctx)
            for d in pool:
                if _matches(d, comp) and id(d) not in seen:
                    seen.add(id(d))
                    nxt.append(d)
        matched = nxt
    return matched


def _self_or_desc(ctx):
    # First selector part is matched among descendants of the search roots.
    yield from descendants(ctx)


# ---------------------------------------------------------------- region map
def load_region_map(path=REGION_MAP):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def region_defs_for(page_key, region_map=None):
    """Merge every region definition whose glob matches this page's basename."""
    rm = region_map if region_map is not None else load_region_map()
    base = os.path.basename(page_key)
    merged = {}
    for pat, defs in rm.items():
        if fnmatch.fnmatch(base, pat):
            merged.update(defs)
    return merged


# ---------------------------------------------------------------- locale
def localize(value, locale):
    """Return the usable localized string, or None when there is nothing to set."""
    if value is None:
        return None
    if isinstance(value, str):
        v = value
    elif isinstance(value, dict):
        v = value.get(locale) or value.get("ja") or ""
    else:
        return None
    v = v.strip() if isinstance(v, str) else ""
    return v or None


# ---------------------------------------------------------------- renderers
def _render_text_edits(region_node, value, fields, locale):
    """text: replace each mapped field node's inner content. Returns edits."""
    edits = []
    if not isinstance(value, dict):
        return edits
    for field, fsel in fields.items():
        s = localize(value.get(field), locale)
        if s is None:
            continue
        fnodes = select([region_node], fsel)
        if not fnodes:
            continue
        fn = fnodes[0]
        edits.append((fn.inner_start, fn.inner_end, esc(s)))
    return edits


def _render_lines(value, fields, locale):
    """lines: regenerate span.<item> children. Returns inner HTML or None."""
    if not isinstance(value, dict):
        return None
    lines = value.get("lines")
    if not isinstance(lines, list) or not lines:
        return None
    item_tag, item_classes, _ = _parse_compound(fields.get("item", "span"))
    item_tag = item_tag or "span"
    dim_cls = fields.get("dimClass", "dim")
    out = []
    for ln in lines:
        if not isinstance(ln, dict):
            continue
        txt = localize(ln.get("text"), locale) or ""
        cls = list(item_classes)
        if ln.get("dim") and dim_cls not in cls:
            cls.append(dim_cls)
        cattr = (' class="%s"' % escq(" ".join(cls))) if cls else ""
        out.append("<%s%s>%s</%s>" % (item_tag, cattr, esc(txt), item_tag))
    if not out:
        return None
    return "\n      " + "\n      ".join(out) + "\n    "


def _render_photos(region_node, value, fields, locale):
    """photos: regenerate <figure><img></figure> children using the existing
    markup pattern (figure class + img attrs cloned from the first child)."""
    if not isinstance(value, dict):
        return None
    items = value.get("items")
    if not isinstance(items, list) or not items:
        return None

    item_tag = (_parse_compound(fields.get("item", "figure"))[0]) or "figure"
    img_tag = (_parse_compound(fields.get("img", "img"))[0]) or "img"

    # Use the first existing item as the structural template.
    tmpl_fig = next((c for c in region_node.children if c.tag == item_tag), None)
    fig_class = tmpl_fig.attrs.get("class", "") if tmpl_fig else ""
    extra = ""
    if tmpl_fig is not None:
        tmpl_img = next((d for d in descendants(tmpl_fig) if d.tag == img_tag), None)
        if tmpl_img is not None:
            for k, v in tmpl_img.attrs.items():
                if k in ("src", "alt") or not _IDENT.match(k):
                    continue
                extra += (' %s="%s"' % (k, escq(v))) if v is not None else (" %s" % k)
    if not extra:
        extra = ' loading="lazy"'

    fc = (' class="%s"' % escq(fig_class)) if fig_class else ""
    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        src = it.get("src") or ""
        if not src:
            continue
        cap = localize(it.get("caption"), locale) or ""
        out.append('<%s%s><%s src="%s" alt="%s"%s /></%s>'
                   % (item_tag, fc, img_tag, escq(src), escq(cap), extra, item_tag))
    if not out:
        return None
    return "\n      " + "\n      ".join(out) + "\n    "


# ---------------------------------------------------------------- bake
def page_file(page_key, locale, root=ROOT):
    if locale == "en":
        return os.path.join(root, "en", page_key)
    return os.path.join(root, page_key)


def bake_file(file_path, regions, defs, locale):
    """Apply regions to one HTML file in place. Returns True if changed."""
    with open(file_path, encoding="utf-8") as fh:
        text = fh.read()
    dom = DOM(text)
    by_id = {}
    for n in all_nodes(dom):
        rid = n.attrs.get("data-region")
        if rid is not None and rid not in by_id:
            by_id[rid] = n

    edits = []
    for rid, value in regions.items():
        node = by_id.get(rid)
        if node is None:
            continue
        d = defs.get(rid)
        if not d:
            continue
        typ = d.get("type")
        fields = d.get("fields", {})
        if typ == "text":
            edits.extend(_render_text_edits(node, value, fields, locale))
        elif typ == "lines":
            inner = _render_lines(value, fields, locale)
            if inner is not None:
                edits.append((node.inner_start, node.inner_end, inner))
        elif typ == "photos":
            inner = _render_photos(node, value, fields, locale)
            if inner is not None:
                edits.append((node.inner_start, node.inner_end, inner))

    if not edits:
        return False
    edits.sort(key=lambda e: e[0], reverse=True)
    for s, e, rep in edits:
        text = text[:s] + rep + text[e:]
    with open(file_path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return True


def bake_content(pages, locale, root=ROOT, region_map=None):
    """Bake `uim:pages` into the static HTML for one locale. Returns #files changed."""
    if not isinstance(pages, dict):
        return 0
    rm = region_map if region_map is not None else load_region_map()
    changed = 0
    for page_key, pdata in pages.items():
        if not isinstance(pdata, dict):
            continue
        regions = pdata.get("regions")
        if not isinstance(regions, dict) or not regions:
            continue
        fp = page_file(page_key, locale, root)
        if not os.path.exists(fp):
            continue
        defs = region_defs_for(page_key, rm)
        if not defs:
            continue
        try:
            if bake_file(fp, regions, defs, locale):
                changed += 1
        except Exception as ex:  # never let one page break the build
            print("  ! bake failed for %s (%s): %s" % (page_key, locale, ex))
    return changed


# ---------------------------------------------------------------- CLI (manual)
if __name__ == "__main__":
    import sys
    # Usage: bake_content.py <pages.json> [root]
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)
    with open(sys.argv[1], encoding="utf-8") as fh:
        pages = json.load(fh)
    base = sys.argv[2] if len(sys.argv) > 2 else ROOT
    for loc in ("ja", "en"):
        n = bake_content(pages, loc, root=base)
        print("baked %s: %d files" % (loc, n))
