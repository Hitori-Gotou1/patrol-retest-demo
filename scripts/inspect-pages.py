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


def inspect_browser(url):
    from playwright.sync_api import expect, sync_playwright

    errors = []
    origin = urlsplit(url).netloc
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(reduced_motion='reduce')
        # Permit only static GETs from this Pages host; never call live Supabase.
        context.route('**/*', lambda route: route.continue_()
                      if route.request.method == 'GET' and urlsplit(route.request.url).netloc == origin
                      else route.abort())
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        cases = []

        def check():
            expect(page.locator('.gallery-admin')).to_be_visible()
            expect(page.get_by_role('heading', name='站主登录', exact=True)).to_be_visible()
            page.wait_for_load_state('networkidle')
            assert page.evaluate('location.hash') == '#/manage-gallery'

        page.goto(url + '#/manage-gallery', wait_until='networkidle')
        check()
        cases.append('fresh direct management link')
        page.reload(wait_until='networkidle')
        check()
        cases.append('management refresh')
        page.goto(url + '#/', wait_until='networkidle')
        page.evaluate("location.hash = '#/manage-gallery'")
        check()
        cases.append('location.hash assignment from home')
        assert not errors, errors
        browser.close()
    return {'result': 'PASS', 'cases': cases, 'pageErrors': errors, 'supabaseRequests': 'blocked'}


if __name__ == '__main__':
    args = argparse.ArgumentParser()
    args.add_argument('url')
    args.add_argument('--browser', action='store_true')
    options = args.parse_args()
    url = options.url
    parts = urlsplit(url)
    fresh = urlunsplit((parts.scheme, parts.netloc, parts.path, f'route-check={time.time_ns()}', ''))
    print(json.dumps({'normal': inspect(url), 'cacheBusted': inspect(fresh)}, indent=2))
    if options.browser:
        print(json.dumps({'browser': inspect_browser(url)}, indent=2))
