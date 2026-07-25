#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""images/manifest.json 생성 (v2)

관리자 이미지 픽커용 메타데이터:
  { "version": 2,
    "images": [ { "src": "/images/up/xx.jpg",
                  "usedIn": ["index.html", "en/wedding.html"],  # 이 이미지를 쓰는 페이지
                  "w": 1200, "h": 800,                          # 픽셀 (판별 실패 시 null)
                  "kb": 152 } ] }

- 표준 라이브러리만 사용 (JPEG SOF / PNG IHDR / GIF / WEBP 헤더 직접 파싱).
- usedIn 은 root + en/ 의 *.html 에서 파일명 등장 여부로 판정 (siano.html 제외).
- v1 소비자 호환: 픽커는 d.images[i].src 또는 (구형) 문자열 배열 둘 다 처리할 것.

Usage:
    python3 scripts/build_image_manifest.py
"""

import json
import os
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UP_DIR = ROOT / "images" / "up"
MANIFEST = ROOT / "images" / "manifest.json"

EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def image_size(path):
    """순수 파이썬 헤더 파싱으로 (w, h). 실패 시 (None, None)."""
    try:
        with open(path, "rb") as f:
            head = f.read(32)
            if head.startswith(b"\x89PNG\r\n\x1a\n"):  # PNG IHDR
                w, h = struct.unpack(">II", head[16:24])
                return w, h
            if head[:6] in (b"GIF87a", b"GIF89a"):  # GIF
                w, h = struct.unpack("<HH", head[6:10])
                return w, h
            if head[:4] == b"RIFF" and head[8:12] == b"WEBP":  # WEBP
                fmt = head[12:16]
                if fmt == b"VP8X":
                    w = int.from_bytes(head[24:27], "little") + 1
                    h = int.from_bytes(head[27:30], "little") + 1
                    return w, h
                if fmt == b"VP8 ":
                    f.seek(26)
                    b = f.read(4)
                    w = struct.unpack("<H", b[0:2])[0] & 0x3FFF
                    h = struct.unpack("<H", b[2:4])[0] & 0x3FFF
                    return w, h
                return None, None
            if head[:2] == b"\xff\xd8":  # JPEG — SOF 마커 탐색
                f.seek(2)
                while True:
                    b = f.read(2)
                    if len(b) < 2 or b[0] != 0xFF:
                        return None, None
                    marker = b[1]
                    if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                        continue
                    seg = f.read(2)
                    if len(seg) < 2:
                        return None, None
                    (length,) = struct.unpack(">H", seg)
                    if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                        data = f.read(5)
                        h, w = struct.unpack(">HH", data[1:5])
                        return w, h
                    f.seek(length - 2, 1)
    except Exception:
        pass
    return None, None


def collect_pages():
    pages = []
    for base, label in ((ROOT, ""), (ROOT / "en", "en/")):
        if not base.is_dir():
            continue
        for p in sorted(base.glob("*.html")):
            if p.name == "siano.html":
                continue
            pages.append((p, label + p.name))
    return pages


def main():
    if not UP_DIR.is_dir():
        print(f"[manifest] not found: {UP_DIR}", file=sys.stderr)
        return 1

    files = sorted(
        p for p in UP_DIR.iterdir() if p.is_file() and p.suffix.lower() in EXTS
    )

    # 사용처 인덱스
    usage = {p.name: [] for p in files}
    for path, page in collect_pages():
        try:
            body = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for p in files:
            if p.name in body:
                usage[p.name].append(page)

    images = []
    for p in files:
        w, h = image_size(p)
        images.append(
            {
                "src": "/images/up/" + p.name,
                "usedIn": usage[p.name],
                "w": w,
                "h": h,
                "kb": round(p.stat().st_size / 1024),
            }
        )

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST.open("w", encoding="utf-8") as f:
        json.dump({"version": 2, "images": images}, f, ensure_ascii=False)
        f.write("\n")

    used = sum(1 for i in images if i["usedIn"])
    sized = sum(1 for i in images if i["w"])
    print(
        f"[manifest v2] {len(images)} images "
        f"(used: {used} / unused: {len(images) - used} / sized: {sized}) -> images/manifest.json"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
