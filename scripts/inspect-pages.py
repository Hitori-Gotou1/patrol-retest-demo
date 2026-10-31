"""Read-only Pages bundle inspection; does not log configuration or call Supabase."""
import argparse
import hashlib
import json
import time
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.entries = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('type') == 'module' and attrs.get('src'):
            self.entries.append(attrs['src'])


def fetch(url):
    request = Request(url, headers={'User-Agent': 'Hitori-Routing-Check', 'Cache-Control': 'no-cache'})
    with urlopen(request, timeout=20) as response:
        return response.read(), {key: response.headers.get(key) for key in ('ETag', 'Last-Modified', 'Cache-Control', 'Age')}


def inspect(url):
    html, headers = fetch(url)
    parser = Scripts()
    parser.feed(html.decode('utf-8'))
    entries = []
    for src in parser.entries:
        bundle, _ = fetch(urljoin(url, src))
        entries.append({'src': src, 'sha256': hashlib.sha256(bundle).hexdigest(),
                        'hasManageGallery': b'/manage-gallery' in bundle,
                        'hasAdminChunk': b'GalleryAdminView' in bundle})
    return {'headers': headers, 'htmlSha256': hashlib.sha256(html).hexdigest(), 'entries': entries}


if __name__ == '__main__':
    args = argparse.ArgumentParser()
    args.add_argument('url')
    url = args.parse_args().url
    parts = urlsplit(url)
    fresh = urlunsplit((parts.scheme, parts.netloc, parts.path, f'route-check={time.time_ns()}', ''))
    print(json.dumps({'normal': inspect(url), 'cacheBusted': inspect(fresh)}, indent=2))
