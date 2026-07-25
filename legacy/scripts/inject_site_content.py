#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
inject_site_content.py — 全 HTML に site-content.js の <script> を1行注入する。

対象:
  - リポジトリ直下 (*.html) と en/ 配下 (en/*.html)
  - 除外: admin.html, siano.html（別エージェント所有 / 専用ページ）

挙動:
  - </body> の直前に <script defer src="/js/site-content.js"></script> を挿入。
  - 冪等: ファイル内に既に "site-content.js" を参照する箇所があればスキップ
    （index/plan/reserve の既存タグも重複させない）。

使い方:
  python3 scripts/inject_site_content.py
"""

import os
import re
import sys

SNIPPET = '<script defer src="/js/site-content.js"></script>'
EXCLUDE = {"admin.html", "siano.html"}
# </body> の直前に挿入（大文字小文字を無視し、最後の出現箇所を対象にする）
BODY_CLOSE_RE = re.compile(r"</body\s*>", re.IGNORECASE)


def repo_root():
    # scripts/ の1つ上 = リポジトリ直下
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def target_files(root):
    files = []
    for d in (root, os.path.join(root, "en")):
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            if not name.endswith(".html"):
                continue
            if name in EXCLUDE:
                continue
            files.append(os.path.join(d, name))
    return files


def inject(path):
    """戻り値: 'added' / 'skipped' / 'no-body'"""
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    # 冪等: 既に site-content.js を参照していれば何もしない
    if "site-content.js" in html:
        return "skipped"

    matches = list(BODY_CLOSE_RE.finditer(html))
    if not matches:
        return "no-body"

    # 最後の </body> の直前に挿入
    m = matches[-1]
    new_html = html[: m.start()] + SNIPPET + "\n" + html[m.start():]

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_html)
    return "added"


def main():
    root = repo_root()
    files = target_files(root)

    added, skipped, nobody = [], [], []
    for path in files:
        rel = os.path.relpath(path, root)
        result = inject(path)
        if result == "added":
            added.append(rel)
        elif result == "skipped":
            skipped.append(rel)
        else:
            nobody.append(rel)

    print("=== inject_site_content.py ===")
    print("対象 HTML: %d 件 (admin.html / siano.html は除外)" % len(files))
    print("追加: %d 件" % len(added))
    for r in added:
        print("  + %s" % r)
    print("スキップ(既存): %d 件" % len(skipped))
    if nobody:
        print("</body> 無しでスキップ: %d 件" % len(nobody))
        for r in nobody:
            print("  ! %s" % r)

    return 0


if __name__ == "__main__":
    sys.exit(main())
