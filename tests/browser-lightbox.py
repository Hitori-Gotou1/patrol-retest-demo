"""Progressive lightbox regression against the real production build.

Run `npm run build`, then `python tests/browser-lightbox.py`. By default the
test serves dist/ on an ephemeral local port. HITORI_QA_URL (or GALLERY_TEST_URL)
can instead point to an existing preview server.

Original requests and native decode completion are independently controlled. All
cloud requests are answered locally; this test never writes to Supabase.
"""
from pathlib import Path
from urllib.parse import urlparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
import json
import os
import re
import threading
import traceback

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
COLLECTION = json.loads((ROOT / 'src/data/gallery-upload.json').read_text())
BASE = os.environ.get('GALLERY_TEST_URL') or os.environ.get('HITORI_QA_URL')
OUTPUT = Path(os.environ.get('HITORI_LIGHTBOX_QA_OUTPUT', '/tmp/gallery-lightbox-qa'))
OUTPUT.mkdir(parents=True, exist_ok=True)
REPORT = {'results': [], 'pageErrors': [], 'unexpectedRequests': []}

# Hold only detached full-image decodes. The native browser decoder still runs,
# and decoding a rendered thumbnail (including in assertions) stays untouched.
DECODE_CONTROL = """(() => {
  const nativeDecode = HTMLImageElement.prototype.decode;
  const qa = window.__lightboxQA = { held: new Set(), pending: [], decoded: [] };
  qa.release = (path, reject = false) => {
    qa.held.delete(path);
    for (const entry of qa.pending.filter(entry => entry.path === path && !entry.released)) {
      entry.released = true;
      reject ? entry.reject(new DOMException('Test decode failure', 'EncodingError')) : entry.resolve();
    }
  };
  HTMLImageElement.prototype.decode = function() {
    const source = this.currentSrc || this.src;
    const path = source.slice(source.indexOf('assets/'));
    const detachedOriginal = !this.isConnected && source.includes('/originals/');
    return nativeDecode.call(this).then(() => {
      if (!detachedOriginal) return;
      qa.decoded.push(path);
      if (qa.held.has(path)) return new Promise((resolve, reject) => {
        qa.pending.push({ path, resolve, reject, released: false });
      });
    });
  };
})();"""


class FixturePage:
    def __init__(self, browser, *, mobile=False, held=(), failed=()):
        self.context = browser.new_context(
            viewport={'width': 390 if mobile else 1440, 'height': 844 if mobile else 900},
            has_touch=mobile, reduced_motion='reduce')
        self.page = self.context.new_page()
        self.held = set(held)
        self.failed = set(failed)
        self.pending = {}
        self.original_requests = []
        self.context.route('**/*', self.route)
        self.page.add_init_script(DECODE_CONTROL)
        self.page.on('pageerror', lambda error: REPORT['pageErrors'].append(str(error)))
        self.page.goto(BASE + '#/#gallery', wait_until='domcontentloaded')
        expect(self.page.locator('.gallery-image-button').first).to_be_visible()

    def route(self, route):
        request = route.request
        parsed = urlparse(request.url)
        if any(part in parsed.path for part in ('/rest/v1/', '/auth/v1/', '/storage/v1/')):
            # Even when the tested build has real configuration, no request ever
            # reaches that service. Published rows are irrelevant to these tests.
            if request.method not in ('GET', 'OPTIONS'):
                REPORT['unexpectedRequests'].append(f'{request.method} {request.url}')
            route.fulfill(status=200, content_type='application/json', body='[]', headers={
                'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'})
            return
        if parsed.netloc != urlparse(BASE).netloc:
            REPORT['unexpectedRequests'].append(f'{request.method} {request.url}')
            route.abort()
            return
        marker = parsed.path.find('/assets/')
        asset_path = parsed.path[marker + 1:] if marker >= 0 else ''
        if '/originals/' in asset_path:
            self.original_requests.append(asset_path)
        if asset_path in self.failed:
            route.fulfill(status=503, body='Controlled image failure')
        elif asset_path in self.held:
            self.pending.setdefault(asset_path, []).append(route)
        else:
            route.continue_()

    def release_request(self, path):
        self.held.discard(path)
        requests = self.pending.pop(path, [])
        assert requests, f'No pending request for {path}'
        fixture = ROOT / 'public' / path
        for route in requests:
            route.fulfill(content_type='image/jpeg', body=fixture.read_bytes())

    def select_collection(self):
        self.page.locator('[data-filter="collection"]').click()
        expect(self.page.locator('.gallery-card h3').first).to_have_text(COLLECTION[0]['title'])
        for image in self.page.locator('.gallery-image-button img').all()[:3]:
            image.evaluate('image => image.decode()')

    def hold_decode(self, item):
        self.page.evaluate('path => window.__lightboxQA.held.add(path)', item['src'])

    def wait_decode(self, item):
        self.page.wait_for_function(
            'path => window.__lightboxQA.pending.some(entry => entry.path === path && !entry.released)',
            arg=item['src'])

    def release_decode(self, item, *, reject=False):
        self.page.evaluate('([path, reject]) => window.__lightboxQA.release(path, reject)',
                           [item['src'], reject])

    def open(self, index=0):
        self.page.locator('.gallery-image-button').nth(index).click()
        expect(self.page.locator('#lightbox')).to_be_visible()

    def thumbnail(self, item):
        image = self.page.locator('#lightbox-image')
        expect(image).to_be_visible()
        expect(image).to_have_attribute('src', re.compile(re.escape(item['thumbnail']) + '$'))
        expect(image).to_have_attribute('alt', item['alt'])
        assert image.evaluate('image => image.complete && image.naturalWidth > 0')
        expect(self.page.locator('#lightbox-title')).to_have_text(item['title'])

    def full_image(self, item):
        image = self.page.locator('#lightbox-image')
        expect(image).to_be_visible()
        expect(image).to_have_attribute('src', re.compile(re.escape(item['src']) + '$'))
        expect(image).to_have_attribute('data-state', 'ready')
        image.evaluate('image => image.decode()')
        expect(image).to_have_attribute('alt', item['alt'])
        expect(self.page.locator('#lightbox-title')).to_have_text(item['title'])

    def close(self):
        self.context.close()


def test_preview_then_decode(browser):
    item = COLLECTION[0]
    fixture = FixturePage(browser, held=[item['src']])
    fixture.select_collection()
    assert not fixture.original_requests, 'Browsing thumbnails fetched originals'
    fixture.hold_decode(item)
    fixture.open()
    fixture.thumbnail(item)
    assert fixture.page.evaluate('document.body.style.overflow') == 'hidden'
    expect(fixture.page.locator('#lightbox-close')).to_be_focused()
    fixture.release_request(item['src'])
    fixture.wait_decode(item)
    fixture.thumbnail(item)
    fixture.release_decode(item)
    fixture.full_image(item)
    assert set(fixture.original_requests) == {item['src']}, fixture.original_requests
    original = fixture.page.locator('.lightbox-original')
    expect(original).to_have_attribute('href', re.compile(re.escape(item['originalSrc']) + '$'))
    expect(original).to_have_attribute('target', '_blank')
    fixture.page.keyboard.press('Escape')
    expect(fixture.page.locator('#lightbox')).to_be_hidden()
    expect(fixture.page.locator('.gallery-image-button').first).to_be_focused()
    assert fixture.page.evaluate('document.body.style.overflow') == ''
    fixture.close()
    return 'Thumbnail remains visible through network delay and native decode; only selected original fetched.'


def test_rapid_navigation(browser):
    first, second, third = COLLECTION[:3]
    fixture = FixturePage(browser, held=[second['src']])
    fixture.select_collection()
    for item in (first, second, third):
        fixture.hold_decode(item)
    fixture.open()
    fixture.wait_decode(first)
    fixture.page.keyboard.press('ArrowRight')
    fixture.thumbnail(second)
    fixture.page.locator('#lightbox-next').click()
    fixture.wait_decode(third)
    fixture.thumbnail(third)
    fixture.page.keyboard.press('ArrowLeft')
    fixture.thumbnail(second)
    # Complete two obsolete decodes in the opposite order from navigation.
    fixture.release_decode(third)
    fixture.release_decode(first)
    fixture.page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    fixture.thumbnail(second)
    expect(fixture.page.locator('#lightbox-count')).to_have_text(f'02 / {len(COLLECTION):02}')
    fixture.release_request(second['src'])
    fixture.wait_decode(second)
    fixture.thumbnail(second)
    fixture.release_decode(second)
    fixture.full_image(second)
    fixture.close()
    return 'Out-of-order previous decodes cannot replace the current selection after next/next/previous.'


def test_failure_fallbacks(browser):
    first, second = COLLECTION[:2]
    fixture = FixturePage(browser, mobile=True, failed=[first['src']])
    fixture.select_collection()
    fixture.open()
    fixture.thumbnail(first)
    expect(fixture.page.locator('#lightbox-image')).to_have_attribute('data-state', 'fallback')
    expect(fixture.page.locator('.lightbox-preview-notice')).to_be_visible()
    fixture.thumbnail(first)
    assert fixture.page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    fixture.hold_decode(second)
    fixture.page.locator('#lightbox-next').click()
    fixture.wait_decode(second)
    fixture.release_decode(second, reject=True)
    expect(fixture.page.locator('#lightbox-image')).to_have_attribute('data-state', 'fallback')
    expect(fixture.page.locator('.lightbox-preview-notice')).to_be_visible()
    fixture.thumbnail(second)
    fixture.page.keyboard.press('Escape')
    expect(fixture.page.locator('.gallery-image-button').first).to_be_focused()
    fixture.close()

    # Failure of the thumbnail must still allow its original to recover.
    fixture = FixturePage(browser, failed=[first['thumbnail']], held=[first['src']])
    fixture.page.locator('[data-filter="collection"]').click()
    fixture.open()
    fixture.release_request(first['src'])
    fixture.full_image(first)
    fixture.close()

    # If neither asset is available, keep the established error and navigation.
    fixture = FixturePage(browser, failed=[first['thumbnail'], first['src']])
    fixture.page.locator('[data-filter="collection"]').click()
    fixture.open()
    expect(fixture.page.locator('#lightbox-image')).to_have_attribute('data-state', 'error')
    expect(fixture.page.locator('#lightbox-image')).to_be_hidden()
    expect(fixture.page.locator('.lightbox-image-error')).to_be_visible()
    fixture.page.locator('#lightbox-next').click()
    fixture.full_image(second)
    fixture.close()
    return 'Network/decode failure retains the mobile preview; broken previews recover or show a navigable error.'


def test_close_and_unmount(browser):
    first = COLLECTION[0]
    fixture = FixturePage(browser)
    fixture.select_collection()
    fixture.hold_decode(first)
    fixture.open()
    fixture.wait_decode(first)
    fixture.page.keyboard.press('Escape')
    expect(fixture.page.locator('#lightbox')).to_be_hidden()
    expect(fixture.page.locator('.gallery-image-button').first).to_be_focused()
    closed_markup = fixture.page.locator('#lightbox').inner_html()
    fixture.release_decode(first)
    fixture.page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    expect(fixture.page.locator('#lightbox')).to_be_hidden()
    expect(fixture.page.locator('.gallery-image-button').first).to_be_focused()
    assert fixture.page.locator('#lightbox').inner_html() == closed_markup
    assert fixture.page.evaluate('document.body.style.overflow') == ''

    fixture.hold_decode(first)
    fixture.open()
    fixture.wait_decode(first)
    fixture.page.evaluate("location.hash = '#/about'")
    expect(fixture.page.locator('#lightbox')).to_have_count(0)
    fixture.release_decode(first)
    fixture.page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    expect(fixture.page.locator('#lightbox')).to_have_count(0)
    assert fixture.page.evaluate('document.body.style.overflow') == ''
    fixture.close()
    return 'Closing and route unmount invalidate late decode completion and restore scrolling/focus.'


def test_cached_and_no_thumbnail(browser):
    fixture = FixturePage(browser)
    fixture.select_collection()
    first = COLLECTION[0]
    # Decode and retain a native Image so the browser has an already decoded
    # resource before the lightbox creates its full-image loader.
    fixture.page.evaluate('''async path => {
      window.__cachedOriginal = new Image();
      window.__cachedOriginal.src = new URL(path, location.href).href;
      await window.__cachedOriginal.decode();
    }''', first['src'])
    fixture.open()
    fixture.full_image(first)
    fixture.page.locator('#lightbox-close').click()
    fixture.page.locator('[data-filter="poster"]').click()
    fixture.open()
    image = fixture.page.locator('#lightbox-image')
    expect(image).to_have_attribute('src', re.compile(r'assets/pink-frequency\.svg$'))
    image.evaluate('image => image.decode()')
    expect(image).to_have_attribute('data-state', 'ready')
    expect(image).to_be_visible()
    expect(fixture.page.locator('.lightbox-image-error')).to_have_count(0)
    fixture.page.keyboard.press('ArrowLeft')
    expect(image).to_have_attribute('src', re.compile(r'assets/live-ticket\.svg$'))
    image.evaluate('image => image.decode()')
    expect(image).to_have_attribute('data-state', 'ready')
    fixture.close()
    return 'Already decoded originals and native entries without a thumbnail display correctly, including wraparound.'


class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        prefix = '/patrol-retest-demo/'
        if path.startswith(prefix):
            path = '/' + path[len(prefix):]
        return super().translate_path(path)

    def log_message(self, *args):
        pass


server = None
if BASE:
    BASE = BASE.rstrip('/') + '/'
else:
    if not (ROOT / 'dist/index.html').is_file():
        raise SystemExit('Build the production app with npm run build before running this test.')
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(PreviewHandler, directory=str(ROOT / 'dist')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    BASE = f'http://127.0.0.1:{server.server_port}/patrol-retest-demo/'

try:
    with sync_playwright() as playwright:
        executable = os.environ.get('HITORI_CHROMIUM_EXECUTABLE') or os.environ.get('HITORI_CHROMIUM')
        if not executable and Path('/usr/bin/chromium').is_file():
            executable = '/usr/bin/chromium'
        browser = playwright.chromium.launch(
            **({'executable_path': executable} if executable else {}), args=['--no-sandbox'])
        for name, test in [
            ('preview-and-decode', test_preview_then_decode),
            ('rapid-navigation', test_rapid_navigation),
            ('failure-fallbacks', test_failure_fallbacks),
            ('close-and-unmount', test_close_and_unmount),
            ('cached-and-no-thumbnail', test_cached_and_no_thumbnail),
        ]:
            try:
                details = test(browser)
                REPORT['results'].append({'name': name, 'result': 'PASS', 'details': details})
                print(f'{name}: PASS', flush=True)
            except Exception as error:
                REPORT['results'].append({'name': name, 'result': 'FAIL', 'error': str(error),
                                          'trace': traceback.format_exc()})
                print(f'{name}: FAIL {error}', flush=True)
            finally:
                for context in browser.contexts:
                    context.close()
        browser.close()
finally:
    if server:
        server.shutdown()
        server.server_close()

REPORT['result'] = 'PASS' if all(result['result'] == 'PASS' for result in REPORT['results']) and not (
    REPORT['pageErrors'] or REPORT['unexpectedRequests']) else 'FAIL'
(OUTPUT / 'results.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))
print(json.dumps(REPORT, ensure_ascii=False, indent=2))
raise SystemExit(0 if REPORT['result'] == 'PASS' else 1)
