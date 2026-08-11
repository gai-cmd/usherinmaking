import json, os

SRC = '/Users/gai/personal/works/usherinmaking/translations/source/batch-1.json'
OUT = '/Users/gai/personal/works/usherinmaking/translations/batch-1.json'

SOURCE = json.load(open(SRC, encoding='utf-8'))
BY_SLUG = {p['slug']: p for p in SOURCE}


def src_paras(slug):
    return BY_SLUG[slug]['body'].split('\n\n')


def build_entry(slug, locale, title, paras):
    """paras: list; each item is either a list of lines (str) or {'img': alt}."""
    sp = src_paras(slug)
    if len(sp) != len(paras):
        raise SystemExit('%s/%s paragraph count %d != source %d' % (slug, locale, len(paras), len(sp)))
    out = []
    for i, (s, t) in enumerate(zip(sp, paras)):
        if isinstance(t, dict):
            if not s.startswith('!['):
                raise SystemExit('%s/%s para %d marked image but source is not' % (slug, locale, i))
            url = s[s.index('](') + 2:-1]
            out.append('![%s](%s)' % (t['img'], url))
            continue
        if s.startswith('!['):
            raise SystemExit('%s/%s para %d is image in source but not in translation' % (slug, locale, i))
        if len(s.split('\n')) != len(t):
            raise SystemExit('%s/%s para %d line count %d != source %d' % (
                slug, locale, i, len(t), len(s.split('\n'))))
        out.append('\n'.join(t))
    return {'slug': slug, 'locale': locale, 'title': title, 'body': '\n\n'.join(out)}


def emit(entries, append=False):
    existing = []
    if append and os.path.exists(OUT):
        existing = json.load(open(OUT, encoding='utf-8'))
    data = existing + entries
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('wrote %d entries (total)' % len(data))
