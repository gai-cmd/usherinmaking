#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
usher in making — region marker injector (契約 v4, pure Python 3 stdlib)

Idempotently inserts  data-region="<regionId>"  onto the target nodes defined in
scripts/region_map.json, across the root *.html pages and en/*.html pages
(admin.html and siano.html excluded).

Only the start tag of each target node is touched; nothing else in the HTML
changes.  Running it twice is a no-op (a node that already carries data-region
is skipped).  scripts/bake_content.py later finds these markers by attribute.

    python3 scripts/insert_region_markers.py
"""
import os
import glob

from bake_content import (ROOT, DOM, select, load_region_map, region_defs_for)

EXCLUDE = {"admin.html", "siano.html"}


def target_files():
    fs = glob.glob(os.path.join(ROOT, "*.html")) + \
        glob.glob(os.path.join(ROOT, "en", "*.html"))
    out = []
    for p in fs:
        if os.path.basename(p) in EXCLUDE:
            continue
        out.append(p)
    return sorted(out)


def _insert_pos(node):
    """Offset at which to splice the attribute (just before the closing '>')."""
    if node.starttag_text.rstrip().endswith("/>"):
        return node.tag_end - 2
    return node.tag_end - 1


def process_file(file_path, region_map):
    with open(file_path, encoding="utf-8") as fh:
        text = fh.read()
    dom = DOM(text)
    defs = region_defs_for(os.path.basename(file_path), region_map)
    if not defs:
        return False

    inserts = []   # (position, regionId)
    used = set()
    for rid, d in defs.items():
        matches = select(dom.root_children, d["selector"])
        if "nth" in d:
            n = d["nth"]
            targets = [matches[n]] if 0 <= n < len(matches) else []
        else:
            targets = matches[:1]
        for node in targets:
            if id(node) in used:
                continue
            if "data-region=" in node.starttag_text:
                continue  # idempotent
            used.add(id(node))
            inserts.append((_insert_pos(node), rid))

    if not inserts:
        return False
    inserts.sort(key=lambda x: x[0], reverse=True)
    for pos, rid in inserts:
        text = text[:pos] + (' data-region="%s"' % rid) + text[pos:]
    with open(file_path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return True


def main():
    region_map = load_region_map()
    changed = 0
    for fp in target_files():
        if process_file(fp, region_map):
            changed += 1
    print("inserted region markers into %d files" % changed)
    return changed


if __name__ == "__main__":
    main()
