#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reproduce the original site's SNS logos (footer) + wire the JP↔EN language switch.
- Footer `.sns` text links -> brand-logo icons (LINE / Instagram / KakaoTalk / Naver Blog),
  using the real PNG logos downloaded from the original site (images/sns/*.png).
- JP pages: point the EN switch to the matching en/ page (or en/ home if none).
Root-absolute asset paths (/images/sns/...) so it works in both / and /en/.
"""
import os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NEW_SNS = (
    '<div class="sns">'
    '<a href="https://line.me/ti/p/8Udy1kYg1l" target="_blank" rel="noopener" aria-label="LINE"><img src="/images/sns/line.png" alt="LINE" /></a>'
    '<a href="https://www.instagram.com/usherinmaking/" target="_blank" rel="noopener" aria-label="Instagram"><img src="/images/sns/instagram.png" alt="Instagram" /></a>'
    '<a href="http://qr.kakao.com/talk/YdBfdGeaBd1EXL3ZVVpEJrSpzMU-" target="_blank" rel="noopener" aria-label="KakaoTalk"><img src="/images/sns/kakao.png" alt="KakaoTalk" /></a>'
    '<a class="sns-blog" href="https://blog.naver.com/moya100" target="_blank" rel="noopener" aria-label="Naver Blog">blog</a>'
    '</div>'
)

SNS_RE = re.compile(r'<div class="sns">.*?</div>', re.S)
LANG_JP_RE = re.compile(
    r'<div class="lang"><a href="#" class="active">JP</a><span>/</span><a href="#">EN</a></div>')

EN_PAGES = {"index.html","about.html","wedding.html","anniversary.html","dress.html","plan.html","contact.html"}

def fix(path, is_en):
    c = open(path, encoding="utf-8").read()
    orig = c
    c, n = SNS_RE.subn(NEW_SNS, c)
    if not is_en:
        base = os.path.basename(path)
        target = base if base in EN_PAGES else "index.html"
        c = LANG_JP_RE.sub(
            '<div class="lang"><a href="#" class="active">JP</a><span>/</span>'
            f'<a href="/en/{target}">EN</a></div>', c)
    if c != orig:
        open(path, "w", encoding="utf-8").write(c)
        return n
    return 0

def main():
    root_html = [p for p in glob.glob(os.path.join(ROOT, "*.html"))
                 if os.path.basename(p) != "siano.html"]
    en_html = glob.glob(os.path.join(ROOT, "en", "*.html"))
    total_sns = 0
    for p in root_html:
        total_sns += fix(p, is_en=False)
    for p in en_html:
        total_sns += fix(p, is_en=True)
    print(f"updated SNS footer in {total_sns} pages; lang switch wired on {len(root_html)} JP pages")

if __name__ == "__main__":
    main()
