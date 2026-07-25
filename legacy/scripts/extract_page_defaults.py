#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_page_defaults.py  —  契約 v4 / エージェントA 所有

scripts/region_map.json の定義に従い、静的 HTML（ルート + en/）から
本文テキスト・写真を抽出して以下を生成する:

  api/_lib/page_defaults.json   ページ本文の既定値（GET /api/pages の土台）
  api/_lib/seo_defaults.json    SEO/AEO の既定値（GET /api/seo の土台。seo/seo.json から変換）

標準ライブラリ（html.parser）のみ使用。Node 不要・python3 で実行可。

── region_map.json の値タイプと、ここで出力する値の形 ──────────────────────────
  text  : { "<field>": { "ja": "...", "en": "..." }, ... }   （fields の各キーごと）
  lines : { "lines": [ { "text": { "ja": "...", "en": "..." }, "dim": false }, ... ] }
  photos: { "items": [ { "src": "/images/..", "caption": { "ja": "...", "en": "" } }, ... ] }

  page_defaults.json の構造（契約 uim:pages と同形）:
    { "<path>": { "regions": { "<regionId>": <上記いずれかの値> } } }

  en/ ページは別エントリではなく、同じ path キーの値の en ロケールとして格納する
  （ルート HTML から ja、en/<path> から en を取り出して結合）。
"""

import json
import os
import sys
import fnmatch
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGION_MAP = os.path.join(ROOT, "scripts", "region_map.json")
SEO_SRC = os.path.join(ROOT, "seo", "seo.json")
OUT_PAGES = os.path.join(ROOT, "api", "_lib", "page_defaults.json")
OUT_SEO = os.path.join(ROOT, "api", "_lib", "seo_defaults.json")

# 抽出対象から外すページ（契約: admin / siano は対象外）
EXCLUDE = {"admin.html", "siano.html"}

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}


# ─── 軽量 DOM ツリー ─────────────────────────────────────────────────────────
class Node:
    __slots__ = ("tag", "attrs", "classes", "children", "parent")

    def __init__(self, tag, attrs, parent):
        self.tag = tag
        self.attrs = {k: (v if v is not None else "") for k, v in attrs}
        cls = self.attrs.get("class", "")
        self.classes = set(cls.split())
        self.children = []   # Node もしくは str（テキストノード）を文書順に保持
        self.parent = parent


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", [], None)
        self.stack = [self.root]

    def _mk(self, tag, attrs):
        # この HTML は <img src=".." / loading="..">  のように壊れた書式があるため
        # 名前が "/" の属性は無視する。
        clean = [(k, v) for (k, v) in attrs if k != "/"]
        return Node(tag, clean, self.stack[-1])

    def handle_starttag(self, tag, attrs):
        node = self._mk(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        node = self._mk(tag, attrs)
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse_html(text):
    tb = TreeBuilder()
    tb.feed(text)
    return tb.root


# ─── テキスト・選択子ユーティリティ ──────────────────────────────────────────
def node_text(node):
    parts = []
    for c in node.children:
        if isinstance(c, str):
            parts.append(c)
        else:
            parts.append(node_text(c))
    return "".join(parts)


def norm(s):
    return " ".join(s.split())


def parse_selector(sel):
    """ "a.b c" -> [(tag|None, {classes}), ...]  （子孫結合子のみ対応） """
    toks = []
    for part in sel.split():
        if part.startswith("."):
            toks.append((None, set(c for c in part[1:].split(".") if c)))
        else:
            segs = part.split(".")
            tag = segs[0] or None
            toks.append((tag, set(c for c in segs[1:] if c)))
    return toks


def _match_tok(node, tok):
    tag, classes = tok
    if tag is not None and node.tag != tag:
        return False
    return classes.issubset(node.classes)


def _match_chain(node, toks):
    if not toks or not _match_tok(node, toks[-1]):
        return False
    i = len(toks) - 2
    anc = node.parent
    while i >= 0 and anc is not None:
        if _match_tok(anc, toks[i]):
            i -= 1
        anc = anc.parent
    return i < 0


def iter_nodes(root):
    for c in root.children:
        if isinstance(c, Node):
            yield c
            yield from iter_nodes(c)


def find_all(root, selector):
    toks = parse_selector(selector)
    return [n for n in iter_nodes(root) if _match_chain(n, toks)]


# ─── タイプ別の抽出（1ロケール分の生データを返す） ───────────────────────────
def extract_text(region, fields):
    """ -> { field: str } """
    out = {}
    for fname, fsel in fields.items():
        found = find_all(region, fsel)
        out[fname] = norm(node_text(found[0])) if found else ""
    return out


def extract_lines(region, fields):
    """ -> [ (text, dim_bool) ] """
    item_sel = fields.get("item", "span")
    dim_class = fields.get("dimClass", "dim")
    res = []
    for n in find_all(region, item_sel):
        res.append((norm(node_text(n)), dim_class in n.classes))
    return res


def extract_photos(region, fields):
    """ -> [ (src, caption) ] """
    item_sel = fields.get("item", "figure")
    img_sel = fields.get("img", "img")
    caption_from = fields.get("captionFrom", "alt")
    res = []
    for it in find_all(region, item_sel):
        imgs = find_all(it, img_sel)
        if not imgs:
            continue
        img = imgs[0]
        src = img.attrs.get("src", "")
        if caption_from == "alt":
            cap = img.attrs.get("alt", "")
        else:
            cnodes = find_all(it, caption_from)
            cap = node_text(cnodes[0]) if cnodes else ""
        res.append((src, norm(cap)))
    return res


def find_region_node(tree, rdef):
    nodes = find_all(tree, rdef["selector"])
    nth = rdef.get("nth", 0)
    if 0 <= nth < len(nodes):
        return nodes[nth]
    return None


def extract_region(tree, rdef):
    """ 1ロケールの tree から rdef に対応する生データを返す（無ければ None）。 """
    region = find_region_node(tree, rdef)
    if region is None:
        return None
    t = rdef["type"]
    fields = rdef.get("fields", {})
    if t == "text":
        return extract_text(region, fields)
    if t == "lines":
        return extract_lines(region, fields)
    if t == "photos":
        return extract_photos(region, fields)
    return None


# ─── ja / en を結合して契約形の値を作る ─────────────────────────────────────
def combine_text(ja, en):
    en = en or {}
    out = {}
    for field, jav in ja.items():
        out[field] = {"ja": jav, "en": en.get(field, "")}
    return out


def combine_lines(ja, en):
    en = en or []
    lines = []
    for i, (jt, dim) in enumerate(ja):
        et = en[i][0] if i < len(en) else ""
        lines.append({"text": {"ja": jt, "en": et}, "dim": bool(dim)})
    return {"lines": lines}


def combine_photos(ja, en):
    en = en or []
    items = []
    for i, (src, cap) in enumerate(ja):
        ecap = en[i][1] if i < len(en) else ""
        items.append({"src": src, "caption": {"ja": cap, "en": ecap}})
    return {"items": items}


COMBINE = {"text": combine_text, "lines": combine_lines, "photos": combine_photos}


# ─── メイン ──────────────────────────────────────────────────────────────────
def regions_for(path, region_map):
    """ path にマッチする region_map のエントリ（regionId -> def）をマージして返す。 """
    merged = {}
    for pattern, regions in region_map.items():
        if fnmatch.fnmatch(path, pattern):
            merged.update(regions)
    return merged


def build_page_defaults(region_map):
    files = sorted(f for f in os.listdir(ROOT)
                   if f.endswith(".html") and f not in EXCLUDE)
    out = {}
    stats = {"pages": 0, "regions": 0}
    for fname in files:
        rdefs = regions_for(fname, region_map)
        if not rdefs:
            continue
        ja_tree = parse_html(_read(os.path.join(ROOT, fname)))
        en_path = os.path.join(ROOT, "en", fname)
        en_tree = parse_html(_read(en_path)) if os.path.exists(en_path) else None

        regions = {}
        for rid, rdef in rdefs.items():
            ja = extract_region(ja_tree, rdef)
            if ja is None:
                continue  # このページにこのリージョンは存在しない
            en = extract_region(en_tree, rdef) if en_tree is not None else None
            regions[rid] = COMBINE[rdef["type"]](ja, en)
            stats["regions"] += 1

        if regions:
            out[fname] = {"regions": regions}
            stats["pages"] += 1
    return out, stats


def build_seo_defaults():
    """ seo/seo.json の pages を path 別オブジェクト + faq:[] に変換。 """
    with open(SEO_SRC, "r", encoding="utf-8") as fp:
        seo = json.load(fp)
    pages = seo.get("pages", {})
    out = {}
    for path, obj in pages.items():
        o = dict(obj)
        o.setdefault("faq", [])  # faq:[{q:{ja,en},a:{ja,en}}] の構造（初期は空）
        out[path] = o
    return out


def _read(p):
    with open(p, "r", encoding="utf-8") as fp:
        return fp.read()


def main():
    with open(REGION_MAP, "r", encoding="utf-8") as fp:
        region_map = json.load(fp)

    pages, stats = build_page_defaults(region_map)
    seo = build_seo_defaults()

    os.makedirs(os.path.dirname(OUT_PAGES), exist_ok=True)
    with open(OUT_PAGES, "w", encoding="utf-8") as fp:
        json.dump(pages, fp, ensure_ascii=False, indent=2, sort_keys=True)
        fp.write("\n")
    with open(OUT_SEO, "w", encoding="utf-8") as fp:
        json.dump(seo, fp, ensure_ascii=False, indent=2, sort_keys=True)
        fp.write("\n")

    print("[extract_page_defaults] page_defaults.json: "
          "{pages} ページ / {regions} リージョン".format(**stats))
    print("[extract_page_defaults] seo_defaults.json: {} ページ".format(len(seo)))
    print("  ->", os.path.relpath(OUT_PAGES, ROOT))
    print("  ->", os.path.relpath(OUT_SEO, ROOT))


if __name__ == "__main__":
    main()
