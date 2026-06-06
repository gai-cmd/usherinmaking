#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build images/manifest.json — a flat, sorted list of every uploaded image under
images/up/ so the admin gallery editor can offer an image picker without a server.

Output (images/manifest.json):
    { "images": ["/images/up/0050ef5841c8d683.jpg", ...] }

- Scans images/up/ for *.jpg / *.jpeg / *.png / *.webp (case-insensitive).
- Paths are site-root absolute ("/images/up/<name>") and sorted alphabetically.
- Re-runnable: overwrites the manifest each time, reflecting the current folder.

Usage:
    python3 scripts/build_image_manifest.py
"""

import json
import sys
from pathlib import Path

# scripts/ の一つ上がプロジェクトルート。
ROOT = Path(__file__).resolve().parent.parent
UP_DIR = ROOT / "images" / "up"
MANIFEST = ROOT / "images" / "manifest.json"

EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def collect_images():
    if not UP_DIR.is_dir():
        return []
    images = []
    for p in UP_DIR.iterdir():
        if p.is_file() and p.suffix.lower() in EXTS:
            images.append("/images/up/" + p.name)
    images.sort()
    return images


def main():
    images = collect_images()
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST.open("w", encoding="utf-8") as f:
        json.dump({"images": images}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"manifest: {MANIFEST.relative_to(ROOT)} — {len(images)} 件の画像を書き出しました。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
