#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
usher in making — Vercel build-time bake pipeline (契約 v4, pure Python 3 stdlib)

Flow (only when KV env vars are present):
    1. KV REST GET  uim:pages, uim:seo   (Upstash:  POST {url}/get/{key})
    2. bake_content  -> apply page regions to the static HTML (ja + en)
    3. merge uim:seo into seo/seo.json
    4. python3 seo/build_seo.py apply    -> bake managed <head> SEO/AEO block

Robustness contract: every step is wrapped, all exceptions are logged, and the
process ALWAYS exits 0 — the build must never fail because of content baking.
If KV_REST_API_URL / KV_REST_API_TOKEN are not set, this is an immediate no-op.
"""
import os
import sys
import json
import subprocess
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEO_JSON = os.path.join(ROOT, "seo", "seo.json")
BUILD_SEO = os.path.join(ROOT, "seo", "build_seo.py")


def log(msg):
    print("[vercel_build] %s" % msg, flush=True)


def kv_get(base_url, token, key):
    """Upstash REST GET: POST {url}/get/{key}. Returns parsed value or None."""
    url = base_url.rstrip("/") + "/get/" + key
    req = urllib.request.Request(url, data=b"", method="POST")
    req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    result = payload.get("result")
    if result is None:
        return None
    if isinstance(result, str):
        return json.loads(result)
    return result


def step_bake(pages):
    from bake_content import bake_content
    for loc in ("ja", "en"):
        try:
            n = bake_content(pages, loc, root=ROOT)
            log("baked content (%s): %d files" % (loc, n))
        except Exception as ex:
            log("content bake failed (%s): %s" % (loc, ex))


def step_merge_seo(seo):
    if not isinstance(seo, dict) or not seo:
        log("no uim:seo data — skip SEO merge")
        return
    with open(SEO_JSON, encoding="utf-8") as fh:
        data = json.load(fh)
    pages = data.setdefault("pages", {})
    merged = 0
    for path, entry in seo.items():
        if not isinstance(entry, dict):
            continue
        pages.setdefault(path, {}).update(entry)
        merged += 1
    with open(SEO_JSON, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    log("merged uim:seo into seo/seo.json (%d pages)" % merged)


def step_bake_blog(posts):
    """公開記事からブログ静的ページ・feed・SEO エントリを生成。

    KV の uim:posts が空／未設定なら、リポジトリにコミット済みの
    blog_posts.json（scripts/import_naver_local.mjs で生成）へフォールバック。
    管理画面から KV に記事が入り始めたら KV が優先される。
    """
    if not isinstance(posts, list) or not posts:
        local = os.path.join(ROOT, "blog_posts.json")
        if os.path.exists(local):
            try:
                with open(local, encoding="utf-8") as fh:
                    posts = json.load(fh)
                log("uim:posts empty — fallback to committed blog_posts.json (%d posts)" % len(posts))
            except Exception as ex:
                log("blog_posts.json fallback failed: %s" % ex)
                return
        else:
            log("no uim:posts data — skip blog bake")
            return
    from bake_blog import bake_blog
    urls = bake_blog(posts, root=ROOT)
    pub = len([p for p in posts if isinstance(p, dict) and p.get("status") == "published"])
    log("baked blog: %d published posts, %d urls" % (pub, len(urls)))


def step_apply_seo():
    res = subprocess.run([sys.executable, BUILD_SEO, "apply"],
                         cwd=ROOT, capture_output=True, text=True)
    if res.stdout:
        log("build_seo: " + res.stdout.strip())
    if res.returncode != 0:
        log("build_seo apply nonzero exit %d: %s" % (res.returncode, res.stderr.strip()))


def step_build_sitemap():
    res = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_sitemap.py")],
                         cwd=ROOT, capture_output=True, text=True)
    if res.stdout:
        log("build_sitemap: " + res.stdout.strip())
    if res.returncode != 0:
        log("build_sitemap nonzero exit %d: %s" % (res.returncode, res.stderr.strip()))


def main():
    base_url = os.environ.get("KV_REST_API_URL")
    token = os.environ.get("KV_REST_API_TOKEN")
    if not base_url or not token:
        log("KV env not set — no-op (static HTML left as committed). exit 0")
        return

    log("KV env detected — running bake pipeline")

    pages, seo, posts = {}, {}, []
    try:
        pages = kv_get(base_url, token, "uim:pages") or {}
        log("fetched uim:pages (%d page entries)" % len(pages))
    except Exception as ex:
        log("KV GET uim:pages failed: %s" % ex)
    try:
        seo = kv_get(base_url, token, "uim:seo") or {}
        log("fetched uim:seo (%d page entries)" % len(seo))
    except Exception as ex:
        log("KV GET uim:seo failed: %s" % ex)
    try:
        posts = kv_get(base_url, token, "uim:posts") or []
        log("fetched uim:posts (%d posts)" % len(posts))
    except Exception as ex:
        log("KV GET uim:posts failed: %s" % ex)

    try:
        step_bake(pages)
    except Exception as ex:
        log("step_bake error: %s" % ex)
    try:
        step_bake_blog(posts)
    except Exception as ex:
        log("step_bake_blog error: %s" % ex)
    try:
        step_merge_seo(seo)
    except Exception as ex:
        log("step_merge_seo error: %s" % ex)
    try:
        step_apply_seo()
    except Exception as ex:
        log("step_apply_seo error: %s" % ex)
    try:
        step_build_sitemap()
    except Exception as ex:
        log("step_build_sitemap error: %s" % ex)

    log("pipeline complete. exit 0")


if __name__ == "__main__":
    # Make sibling imports (bake_content) work regardless of cwd.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        main()
    except Exception as ex:
        log("FATAL (swallowed): %s" % ex)
    sys.exit(0)
