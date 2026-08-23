"""공개 사이트 정적 미러 — 서버 없이 브라우저로 열어보는 비상 사본.

wget --mirror 대신 직접 쓰는 이유: 이 맥의 리졸버(라우터)가 옛 네임서버를 오래
캐시해 정본 도메인이 옛 호스팅으로 풀리는 일이 있었다(2026-08-24). wget 은
리졸버를 우회할 수 없지만 여기서는 getaddrinfo 를 가로채 정본 IP 로 못박는다.

사용: python3 scripts/backup/mirror.py <정본 URL> <대상 폴더> [정본 IP]
  정본 IP 를 주면 그 도메인은 무조건 그 IP 로 접속한다(TLS SNI 는 도메인 그대로).

받는 것: 사이트맵의 모든 페이지 + 각 페이지가 참조하는 같은 호스트의 자산
(_next/static CSS·JS, /images, _next/image 변형). 이미지 원본은 03-blob 에 있으므로
여기서는 페이지가 실제로 쓰는 변형만 받는다 — 오프라인에서 사진이 보이려면 필요하다.
"""
import html
import os
import re
import socket
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlsplit, unquote

site, dest = sys.argv[1].rstrip('/'), sys.argv[2]
host = urlsplit(site).netloc
pin_ip = sys.argv[3] if len(sys.argv) > 3 else None

if pin_ip:
    _orig = socket.getaddrinfo

    def _pinned(h, *a, **k):
        return _orig(pin_ip if h == host else h, *a, **k)

    socket.getaddrinfo = _pinned

UA = 'usherinmaking-backup-mirror/1 (+local)'
opener = urllib.request.build_opener()
opener.addheaders = [('User-Agent', UA), ('Accept-Language', 'ja')]


def get(url: str) -> tuple[bytes, str] | None:
    try:
        with opener.open(url, timeout=40) as r:
            # 정본 밖으로 튀는 리다이렉트는 받지 않는다 — 다른 호스트의 내용이 섞인다.
            if urlsplit(r.geturl()).netloc != host:
                return None
            return r.read(), r.headers.get('Content-Type', '')
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f'\n  실패 {url} — {e}\n')
        return None


def local_path(url: str) -> str:
    """URL → 저장 경로. 쿼리는 파일명에 섞고, 확장자 없는 페이지는 .html 을 붙인다."""
    u = urlsplit(url)
    p = unquote(u.path) or '/'
    if p.endswith('/'):
        p += 'index'
    if u.query:
        p += '?' + unquote(u.query)
    if not re.search(r'\.[a-z0-9]{2,5}$', p, re.I) or u.query:
        if not re.search(r'\.(css|js|png|jpe?g|webp|avif|svg|ico|mp4|txt|xml)$', p, re.I):
            p += '.html'
    return os.path.join(dest, host, p.lstrip('/'))


def save(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)


ASSET_RE = re.compile(r'(?:src|href)=["\']([^"\']+)["\']', re.I)
SRCSET_RE = re.compile(r'srcset=["\']([^"\']+)["\']', re.I)


def assets_in(page_url: str, doc: str) -> set[str]:
    out = set()
    cands = ASSET_RE.findall(doc)
    for ss in SRCSET_RE.findall(doc):
        cands += [part.strip().split(' ')[0] for part in ss.split(',')]
    for c in cands:
        c = html.unescape(c)
        if c.startswith(('data:', 'mailto:', 'tel:', '#')):
            continue
        full = urljoin(page_url, c)
        u = urlsplit(full)
        if u.netloc != host:
            continue
        # 페이지 링크가 아니라 자산만: _next/, /images/, 확장자 있는 것.
        if u.path.startswith(('/_next/', '/images/', '/brand/')) or re.search(
            r'\.(css|js|png|jpe?g|webp|avif|svg|ico|mp4|txt|xml)$', u.path, re.I
        ):
            out.add(full.split('#')[0])
    return out


# 1) 사이트맵 → 페이지 목록
sm = get(f'{site}/sitemap.xml')
if not sm:
    sys.exit('사이트맵을 받지 못했습니다')
save(local_path(f'{site}/sitemap.xml'), sm[0])
pages = sorted(set(re.findall(r'<loc>([^<]+)</loc>', sm[0].decode('utf-8', 'replace'))))
pages += [f'{site}/robots.txt']
print(f'페이지 {len(pages)}개', flush=True)

# 2) 페이지 받기 (동시 8) + 자산 수집
assets: set[str] = set()
done = 0


def fetch_page(url: str) -> None:
    global done
    r = get(url)
    if r:
        data, ctype = r
        save(local_path(url), data)
        if 'html' in ctype:
            assets.update(assets_in(url, data.decode('utf-8', 'replace')))
    done += 1
    if done % 100 == 0:
        print(f'  페이지 {done}/{len(pages)} · 자산 후보 {len(assets)}', flush=True)


with ThreadPoolExecutor(8) as ex:
    list(ex.map(fetch_page, pages))

# 3) 자산 받기 (동시 12) — 이미 있으면 건너뛴다
todo = [a for a in sorted(assets) if not os.path.exists(local_path(a))]
print(f'자산 {len(assets)}개 중 받을 것 {len(todo)}개', flush=True)
got = 0


def fetch_asset(url: str) -> None:
    global got
    r = get(url)
    if r:
        save(local_path(url), r[0])
        got += 1
        if got % 500 == 0:
            print(f'  자산 {got}/{len(todo)}', flush=True)


with ThreadPoolExecutor(12) as ex:
    list(ex.map(fetch_asset, todo))

total = sum(len(f) for _, _, f in os.walk(dest))
print(f'완료 · 페이지 {done} · 자산 {got} · 파일 총 {total}', flush=True)
