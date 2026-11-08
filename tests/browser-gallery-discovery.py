"""Search, favorites backup, and share-link regression on a production build.

Build with the documented gallery-test.supabase.co fixture configuration first.
Every external request is intercepted; no production Supabase data is accessed.
"""
import argparse
import json
import os
import threading
import traceback
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
COLLECTION = json.loads((ROOT / 'src/data/gallery-upload.json').read_text())
KEY = 'hitori-room:favorites:v1'
OUTPUT = Path(os.environ.get('HITORI_DISCOVERY_OUTPUT', '/tmp/gallery-discovery-qa'))
OUTPUT.mkdir(parents=True, exist_ok=True)
REPORT = {'results': [], 'pageErrors': [], 'unexpectedRequests': [], 'missingAssets': []}
UID = '11111111-1111-4111-8111-111111111111'
CID = '77777777-7777-4777-8777-777777777777'
CLOUD_ID = 'cloud-' + CID
ROW = {'id': CID, 'title': '云端虹夏测试', 'alt': '虹夏在舞台前', 'credit': 'Test Artist',
       'object_path': f'{UID}/{CID}.jpg', 'thumbnail_path': f'{UID}/{CID}-thumb.webp', 'width': 600, 'height': 600}


def backup(ids):
    return json.dumps({'format': 'hitori-room:favorites', 'version': 1, 'ids': ids})


class Fixture:
    def __init__(self, browser, *, width=1440, saved=None, clipboard='success', storage_blocked=False, delayed=False, failed=False):
        self.context = browser.new_context(viewport={'width': width, 'height': 900 if width > 800 else 844},
                                           reduced_motion='reduce', accept_downloads=True)
        if saved is not None:
            value = json.dumps(json.dumps(saved))
            self.context.add_init_script(f"if (!sessionStorage.getItem('qa-seeded')) {{ localStorage.setItem('{KEY}', {value}); sessionStorage.setItem('qa-seeded', '1'); }}")
        if storage_blocked:
            self.context.add_init_script("Storage.prototype.setItem = function() { throw new DOMException('blocked', 'SecurityError'); };")
        self.context.add_init_script("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedLink = value; "
                                     + ("throw new Error('denied');" if clipboard == 'denied' else '') + " } } });")
        self.pending = []
        self.delayed = delayed
        self.failed = failed
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: REPORT['pageErrors'].append(str(error)))
        self.page.on('response', lambda response: REPORT['missingAssets'].append(response.url)
                     if response.status >= 400 and '/assets/' in response.url and urlsplit(response.url).netloc == urlsplit(BASE).netloc else None)

    def route(self, route):
        request = route.request
        parsed = urlsplit(request.url)
        if parsed.netloc == urlsplit(BASE).netloc:
            route.continue_()
        elif parsed.netloc == 'gallery-test.supabase.co' and request.method == 'GET':
            if parsed.path == '/rest/v1/gallery_uploads':
                if self.delayed:
                    self.pending.append(route)
                else:
                    self.reply_cloud(route)
            elif '/storage/v1/object/public/' in parsed.path:
                item = COLLECTION[0]
                field = 'thumbnail' if '-thumb.' in parsed.path else 'originalSrc'
                route.fulfill(content_type='image/webp' if field == 'thumbnail' else 'image/jpeg', body=(ROOT / 'public' / item[field]).read_bytes())
            else:
                REPORT['unexpectedRequests'].append(request.method + ' ' + request.url)
                route.abort()
        else:
            REPORT['unexpectedRequests'].append(request.method + ' ' + request.url)
            route.abort()

    def reply_cloud(self, route):
        route.fulfill(status=503 if self.failed else 200, content_type='application/json',
                      body=json.dumps({'message': 'controlled failure'} if self.failed else [ROW]),
                      headers={'Access-Control-Allow-Origin': '*'})

    def release_cloud(self):
        self.delayed = False
        for route in self.pending:
            self.reply_cloud(route)
        self.pending.clear()

    def goto(self, suffix='#/#gallery', wait='networkidle'):
        self.page.goto(BASE + suffix, wait_until=wait)
        expect(self.page.locator('#gallery')).to_be_visible()

    def close(self):
        self.context.close()

    def import_file(self, text):
        if self.page.locator('.gallery-backup').get_attribute('open') is None:
            self.page.locator('.gallery-backup summary').click()
        self.page.get_by_label('选择收藏备份文件', exact=True).set_input_files({'name': 'favorites.json', 'mimeType': 'application/json', 'buffer': text.encode()})


def test_search(browser):
    fixture = Fixture(browser)
    page = fixture.page
    fixture.goto()
    page.locator('[data-filter=collection]').click()
    page.locator('#gallery-search').fill('aRTist')
    page.locator('#gallery-character').select_option('nijika')
    expect(page.locator('.gallery-card')).to_have_count(1)
    expect(page.locator('.gallery-card h3')).to_have_text(ROW['title'])
    page.locator('.gallery-image-button').click()
    expect(page.locator('#lightbox-count')).to_have_text('01 / 01')
    expect(page.locator('#lightbox-next')).to_have_count(0)
    page.keyboard.press('Escape')
    expect(page.locator('#lightbox')).to_be_hidden()
    page.locator('#gallery-search').fill('不存在的标题')
    expect(page.locator('.gallery-card')).to_have_count(0)
    expect(page.locator('.gallery-empty')).to_contain_text('没有符合')
    page.locator('.gallery-reset-filters').click()
    expect(page.locator('.gallery-card')).to_have_count(9)
    page.locator('.gallery-load-more').click()
    expect(page.locator('.gallery-card')).to_have_count(18)
    page.locator('#gallery-character').select_option('hitori')
    assert page.locator('.gallery-card').count() <= 9
    page.locator('.gallery-view-switch button').nth(1).click()
    for entry in page.locator('.gallery-flow-access button').all():
        assert entry.get_attribute('data-preview-id') != CLOUD_ID
    fixture.close()


def test_backup(browser):
    unknown = 'cloud-99999999-9999-4999-8999-999999999999'
    fixture = Fixture(browser, saved=['quiet-guitar', unknown])
    page = fixture.page
    fixture.goto()
    fixture.import_file(backup(['quiet-guitar', 'pink-frequency', CLOUD_ID]))
    expect(page.locator('.gallery-backup-message')).to_contain_text('已合并 4 条')
    before = page.evaluate(f'localStorage.getItem("{KEY}")')
    fixture.import_file('{broken')
    expect(page.locator('.gallery-backup-message[role=alert]')).to_be_visible()
    assert page.evaluate(f'localStorage.getItem("{KEY}")') == before
    fixture.import_file(backup(['quiet-guitar', '../unsafe']))
    expect(page.locator('.gallery-backup-message[role=alert]')).to_be_visible()
    assert page.evaluate(f'localStorage.getItem("{KEY}")') == before
    fixture.import_file(' ' * (1024 * 1024 + 1))
    expect(page.locator('.gallery-backup-message')).to_contain_text('1 MiB')
    assert page.evaluate(f'localStorage.getItem("{KEY}")') == before
    with page.expect_download() as pending:
        page.get_by_role('button', name='导出收藏', exact=True).click()
    data = json.loads(Path(pending.value.path()).read_text())
    assert data['format'] == 'hitori-room:favorites' and data['version'] == 1
    assert set(data['ids']) == {'quiet-guitar', 'pink-frequency', CLOUD_ID, unknown}
    assert set(data) == {'format', 'version', 'exportedAt', 'ids'}
    page.reload(wait_until='networkidle')
    page.locator('.gallery-favorites-only').click()
    expect(page.locator('.gallery-card')).to_have_count(3)
    page.locator('#gallery-search').fill(ROW['title'])
    page.locator('.gallery-image-button').click()
    page.locator('.lightbox-favorite').click()
    expect(page.locator('#lightbox-title')).to_have_text(ROW['title'])
    expect(page.locator('#lightbox-count')).to_have_text('01 / 01')
    page.keyboard.press('Escape')
    expect(page.locator('#lightbox')).to_be_hidden()
    expect(page.locator('.gallery-card')).to_have_count(0)
    expect(page.locator('#gallery-title')).to_be_focused()
    assert unknown in json.loads(page.evaluate(f'localStorage.getItem("{KEY}")'))
    fixture.close()


def test_history_and_clipboard(browser):
    fixture = Fixture(browser)
    page = fixture.page
    fixture.goto()
    count = page.evaluate('history.length')
    page.locator('.gallery-image-button').first.click()
    expect(page.locator('#lightbox-title')).to_have_text(ROW['title'])
    assert page.evaluate('history.length') == count + 1
    page.locator('#lightbox-next').click()
    expect(page.locator('#lightbox-title')).to_have_text('把心事，弹给夜晚听')
    assert page.evaluate('history.length') == count + 1
    page.locator('.lightbox-share').click()
    expect(page.locator('.lightbox-share-field [role=status]')).to_have_text('分享链接已复制。')
    shared = page.evaluate('window.__copiedLink')
    assert shared == BASE + '#/?image=quiet-guitar#gallery', shared
    page.go_back()
    expect(page.locator('#lightbox')).to_be_hidden()
    expect(page.locator('.gallery-image-button').first).to_be_focused()
    page.go_forward()
    expect(page.locator('#lightbox-title')).to_have_text('把心事，弹给夜晚听')
    page.keyboard.press('Escape')
    expect(page.locator('#lightbox')).to_be_hidden()
    fixture.close()

    fixture = Fixture(browser, clipboard='denied')
    page = fixture.page
    fixture.goto('#/?image=' + COLLECTION[-1]['id'] + '#gallery')
    expect(page.locator('#lightbox-title')).to_have_text(COLLECTION[-1]['title'])
    page.reload(wait_until='networkidle')
    expect(page.locator('#lightbox-title')).to_have_text(COLLECTION[-1]['title'])
    page.locator('.lightbox-share').click()
    expect(page.locator('.lightbox-share-field [role=status]')).to_contain_text('请选中')
    expect(page.locator('#gallery-share-link')).to_be_focused()
    assert page.locator('#gallery-share-link').input_value() == BASE + '#/?image=' + COLLECTION[-1]['id'] + '#gallery'
    page.locator('#lightbox-close').click()
    expect(page.locator('#lightbox')).to_be_hidden()
    assert 'image=' not in page.url
    assert page.url.startswith(BASE)
    fixture.close()


def test_cloud_link(browser):
    fixture = Fixture(browser, delayed=True)
    page = fixture.page
    fixture.goto('#/?image=' + CLOUD_ID + '#gallery', wait='domcontentloaded')
    expect(page.locator('.gallery-link-notice')).to_contain_text('正在查找')
    fixture.release_cloud()
    expect(page.locator('#lightbox-title')).to_have_text(ROW['title'])
    expect(page.locator('#lightbox-image')).to_have_attribute('data-state', 'ready')
    fixture.close()

    fixture = Fixture(browser, failed=True)
    page = fixture.page
    fixture.goto('#/?image=' + CLOUD_ID + '#gallery')
    expect(page.locator('.gallery-link-notice')).to_contain_text('暂时无法找到')
    fixture.failed = False
    page.locator('.gallery-cloud-notice button').click()
    expect(page.locator('#lightbox-title')).to_have_text(ROW['title'])
    fixture.close()

    fixture = Fixture(browser)
    page = fixture.page
    fixture.goto('#/?image=not-found#gallery')
    expect(page.locator('.gallery-link-notice')).to_contain_text('暂时无法找到')
    expect(page.locator('#lightbox')).to_be_hidden()
    page.locator('.gallery-link-notice button').click()
    expect(page.locator('.gallery-link-notice')).to_have_count(0)
    expect(page.locator('.gallery-card')).to_have_count(9)
    fixture.close()


def test_storage_and_mobile(browser):
    fixture = Fixture(browser)
    page = fixture.page
    fixture.goto()
    other = fixture.context.new_page()
    other.goto(BASE + '#/#gallery', wait_until='networkidle')
    other.evaluate(f'localStorage.setItem("{KEY}", JSON.stringify(["quiet-guitar"]))')
    expect(page.locator('.gallery-favorites-only span')).to_have_text('1')
    other.close()
    fixture.close()

    fixture = Fixture(browser, storage_blocked=True)
    page = fixture.page
    fixture.goto()
    page.locator('.favorite').first.click()
    expect(page.locator('.favorite').first).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('#gallery-status')).to_contain_text('仅本次有效')
    page.locator('.gallery-backup summary').click()
    with page.expect_download() as pending:
        page.get_by_role('button', name='导出收藏', exact=True).click()
    assert json.loads(Path(pending.value.path()).read_text())['ids'] == [CLOUD_ID]
    fixture.close()

    for width in (1440, 390, 320):
        fixture = Fixture(browser, width=width)
        page = fixture.page
        fixture.goto()
        page.locator('#gallery').evaluate("element => window.scrollTo({top: element.offsetTop, behavior: 'instant'})")
        page.screenshot(path=str(OUTPUT / f'gallery-discovery-{width}.png'))
        page.locator('.gallery-backup summary').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.locator('.gallery-image-button').first.click()
        page.locator('.lightbox-share').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        expect(page.locator('#lightbox-image')).to_have_attribute('data-state', 'ready')
        page.keyboard.press('Escape')
        expect(page.locator('#lightbox')).to_be_hidden()
        assert page.evaluate('document.body.style.overflow') != 'hidden'
        fixture.close()


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        prefix = '/patrol-retest-demo/'
        if path.startswith(prefix):
            path = '/' + path[len(prefix):]
        return super().translate_path(path)

    def log_message(self, *_args):
        pass


parser = argparse.ArgumentParser()
parser.add_argument('--dist', type=Path, required=True)
parser.add_argument('--case', choices=('search', 'backup', 'history-and-clipboard', 'cloud-links', 'storage-and-mobile'))
args = parser.parse_args()
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(args.dist.resolve())))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}/patrol-retest-demo/'
try:
    with sync_playwright() as playwright:
        executable = os.environ.get('HITORI_CHROMIUM_EXECUTABLE')
        browser = playwright.chromium.launch(**({'executable_path': executable} if executable else {}))
        for name, function in [('search', test_search), ('backup', test_backup), ('history-and-clipboard', test_history_and_clipboard),
                               ('cloud-links', test_cloud_link), ('storage-and-mobile', test_storage_and_mobile)]:
            if args.case and args.case != name:
                continue
            try:
                function(browser)
                REPORT['results'].append({'name': name, 'result': 'PASS'})
                print(name + ': PASS', flush=True)
            except Exception as error:
                REPORT['results'].append({'name': name, 'result': 'FAIL', 'error': str(error), 'trace': traceback.format_exc()})
                print(name + ': FAIL ' + str(error), flush=True)
            finally:
                for context in browser.contexts:
                    context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
REPORT['result'] = 'PASS' if all(item['result'] == 'PASS' for item in REPORT['results']) and not any(REPORT[key] for key in ('pageErrors', 'unexpectedRequests', 'missingAssets')) else 'FAIL'
(OUTPUT / 'results.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))
print(json.dumps(REPORT, ensure_ascii=False, indent=2))
raise SystemExit(0 if REPORT['result'] == 'PASS' else 1)
