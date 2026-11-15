"""Real Chromium checks for gallery pagination, deep links, and image gestures.

The frontend and images are real build artifacts. Supabase responses are local
contract fixtures, not production-backend verification. No credentials or writes.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import threading
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'evidence' / 'gallery-upgrade'
OUTPUT.mkdir(parents=True, exist_ok=True)
COLLECTION = json.loads((ROOT / 'src/data/gallery-upload.json').read_text())
UID = '11111111-1111-4111-8111-111111111111'
ROWS = []
for index in range(80):
    image_id = f'{index:08x}-1111-4111-8111-{index:012x}'
    ROWS.append({'id': image_id, 'title': '稀有第75张' if index == 75 else f'云端收藏{index:02d}',
                 'alt': '明确标注角色喜多', 'credit': '本地测试图片，不代表作者信息',
                 'creator': '测试明确作者', 'source_url': 'https://example.com/source',
                 'object_path': f'{UID}/{image_id}.jpg', 'thumbnail_path': f'{UID}/{image_id}-thumb.webp',
                 'preview_path': f'{UID}/{image_id}-preview.webp', 'width': 1500, 'height': 870,
                 'characters': ['kita'], 'category': 'collection', 'tags': ['雨夜'],
                 'created_at': f'2026-11-14T00:{79-index:02d}:00Z', 'published': True, 'sort_order': 0})
# Valid sortable ISO minutes, including the first records.
for index, row in enumerate(ROWS):
    row['created_at'] = f'2026-11-{14-index//60:02d}T00:{59-index%60:02d}:00Z'
REPORT = {'checks': [], 'pageErrors': [], 'backend': 'local contract fixture only'}

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        prefix = '/patrol-retest-demo/'
        if path.startswith(prefix): path = '/' + path[len(prefix):]
        return super().translate_path(path)
    def log_message(self, *_): pass

class Fixture:
    def __init__(self, browser, width=1440, mobile=False):
        self.context = browser.new_context(viewport={'width': width, 'height': 900 if width > 800 else 844},
                                           reduced_motion='reduce', has_touch=mobile, is_mobile=mobile)
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: REPORT['pageErrors'].append(str(error)))
        self.calls = []
        self.hold_later = False
        self.fail_later = False
        self.pending = []
    def route(self, route):
        parsed = urlsplit(route.request.url)
        if parsed.netloc == urlsplit(BASE).netloc: route.continue_(); return
        if parsed.netloc != 'gallery-test.supabase.co': route.abort(); return
        if '/storage/v1/object/public/' in parsed.path:
            thumbnail = '-thumb.' in parsed.path
            item = COLLECTION[0]
            route.fulfill(content_type='image/webp' if thumbnail else 'image/jpeg', body=(ROOT / 'public' / item['thumbnail' if thumbnail else 'originalSrc']).read_bytes())
            return
        if parsed.path != '/rest/v1/gallery_uploads':
            route.fulfill(content_type='application/json', body='[]', headers={'Access-Control-Allow-Origin': '*'})
            return
        self.calls.append(parsed.query)
        query = parse_qs(parsed.query)
        if query.get('id'):
            result = [row for row in ROWS if row['id'] == query['id'][0].removeprefix('eq.')]
        else:
            cursor = query.get('or', [''])[0]
            if cursor and self.hold_later: self.pending.append(route); return
            if cursor and self.fail_later:
                route.fulfill(status=503, content_type='application/json', body='{"message":"controlled offline"}')
                return
            found = re.search(r'id\.lt\.([a-f0-9-]{36})', cursor)
            offset = next((i + 1 for i, row in enumerate(ROWS) if found and row['id'] == found[1]), 0)
            result = ROWS[offset:offset+int(query.get('limit', [37])[0])]
        route.fulfill(content_type='application/json', body=json.dumps(result), headers={'Access-Control-Allow-Origin': '*'})
    def release(self):
        self.hold_later = False
        pending, self.pending = self.pending, []
        for route in pending: self.route(route)
    def goto(self, suffix='#/#gallery'):
        self.page.goto(BASE + suffix, wait_until='networkidle')
        expect(self.page.locator('#gallery')).to_be_visible()
    def close(self): self.context.close()

def check(condition, label):
    assert condition, label
    REPORT['checks'].append(label)

def test_pagination(browser):
    fixture = Fixture(browser); page = fixture.page
    fixture.goto()
    expect(page.locator('.gallery-cloud-controls')).to_contain_text('36 张')
    check(len(fixture.calls) == 1, '首批36张即显示，未自动请求全部80张')
    fixture.hold_later = True
    page.locator('#gallery-search').fill('稀有第75张')
    expect(page.locator('.gallery-search-coverage')).to_contain_text('正在检索全部')
    check(page.locator('.gallery-empty').count() == 0, '全量检索未结束时不误报空结果')
    fixture.release()
    expect(page.locator('.gallery-card h3')).to_have_text('稀有第75张')
    expect(page.locator('.gallery-cloud-controls')).to_contain_text('全部读取')
    check(len(fixture.calls) >= 3, '搜索能命中第三批云端图片')
    page.locator('.gallery-image-button').click()
    expect(page.locator('#lightbox-image')).to_have_attribute('data-state', 'ready')
    expect(page.locator('.source-label')).to_contain_text('测试明确作者')
    page.get_by_role('button', name='放大图片', exact=True).click()
    check(page.locator('.lightbox-zoom-controls output').inner_text() != '100%', '缩放控制改变真实图像比例')
    page.get_by_role('button', name='适配屏幕', exact=True).click()
    expect(page.locator('.lightbox-zoom-controls output')).to_have_text('100%')
    surface = page.locator('.lightbox-zoom-surface')
    surface.dblclick()
    check('is-zoomed' in surface.get_attribute('class'), '桌面双击进入内部缩放')
    box = surface.bounding_box()
    page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
    page.mouse.down(); page.mouse.move(box['x'] + box['width']/2 + 100, box['y'] + box['height']/2 + 35, steps=5); page.mouse.up()
    check('translate(0px, 0px)' not in page.locator('#lightbox-image').get_attribute('style'), '放大后可拖动且不会切图')
    page.locator('#lightbox-close').click()
    expect(page.locator('#lightbox')).not_to_be_visible()
    check(page.evaluate('document.activeElement.classList.contains("gallery-image-button")'), '关闭后焦点回到打开按钮')
    page.screenshot(path=str(OUTPUT/'gallery-desktop.png'))
    fixture.close()

def test_failure_deeplink(browser):
    fixture = Fixture(browser); page = fixture.page
    fixture.goto()
    fixture.fail_later = True
    page.locator('#gallery-search').fill('稀有第75张')
    expect(page.locator('.gallery-cloud-notice')).to_be_visible()
    expect(page.locator('.gallery-cloud-controls')).to_contain_text('36 张')
    check(page.locator('.gallery-empty').count() == 0, '后续请求失败保留已有内容且不误报完整空结果')
    fixture.fail_later = False
    page.get_by_role('button', name='重试读取', exact=True).click()
    expect(page.locator('.gallery-card h3')).to_have_text('稀有第75张')
    check(True, '失败后重试恢复到完整搜索结果')
    fixture.close()
    fixture = Fixture(browser); page = fixture.page
    target = 'cloud-' + ROWS[75]['id']
    fixture.goto('#/?image=' + target + '#gallery')
    expect(page.locator('#lightbox-title')).to_have_text('稀有第75张')
    check(any('id=eq.' in query for query in fixture.calls), '分享地址直接按ID定位未加载图片')
    check(len([query for query in fixture.calls if 'id=eq.' not in query]) == 1, '打开远端分享无需先下载全部元数据')
    fixture.close()

def dispatch_touch(page, event, pointer_id, x, y):
    page.locator('.lightbox-zoom-surface').dispatch_event(event, {'pointerId': pointer_id, 'pointerType':'touch', 'clientX':x, 'clientY':y, 'button':0, 'bubbles':True})

def test_mobile(browser):
    for width in [360, 430, 768]:
        fixture = Fixture(browser, width=width, mobile=True); page = fixture.page
        fixture.goto()
        check(page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'{width}px图库无横向溢出')
        page.locator('.gallery-image-button').first.click()
        expect(page.locator('#lightbox-image')).to_have_attribute('data-state', 'ready')
        surface = page.locator('.lightbox-zoom-surface'); box = surface.bounding_box()
        center = (box['x'] + box['width']/2, box['y'] + box['height']/2)
        page.touchscreen.tap(*center); page.touchscreen.tap(*center)
        check('is-zoomed' in surface.get_attribute('class'), f'{width}px真实触摸双击放大')
        title = page.locator('#lightbox-title').inner_text()
        dispatch_touch(page, 'pointerdown', 7, *center)
        dispatch_touch(page, 'pointermove', 7, center[0]+70, center[1]+20)
        dispatch_touch(page, 'pointerup', 7, center[0]+70, center[1]+20)
        check(page.locator('#lightbox-title').inner_text() == title, f'{width}px放大拖动不会误触切图')
        page.get_by_role('button', name='适配屏幕', exact=True).click()
        expect(page.locator('.lightbox-zoom-controls output')).to_have_text('100%')
        page.locator('#lightbox-next').click()
        expect(page.locator('.lightbox-zoom-controls output')).to_have_text('100%')
        page.screenshot(path=str(OUTPUT/f'gallery-preview-{width}.png'))
        check(page.locator('#lightbox-close').bounding_box()['width'] >= 44, f'{width}px关闭触控区域至少44px')
        page.locator('#lightbox-close').click()
        fixture.close()

parser = argparse.ArgumentParser(); parser.add_argument('--dist', type=Path, required=True); args = parser.parse_args()
server = ThreadingHTTPServer(('127.0.0.1',0), partial(Handler, directory=str(args.dist.resolve())))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}/patrol-retest-demo/'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('HITORI_CHROMIUM_EXECUTABLE','/usr/bin/chromium'))
        for name, fn in [('pagination-and-zoom',test_pagination),('failure-and-deeplink',test_failure_deeplink),('mobile',test_mobile)]:
            fn(browser); print(name+': PASS', flush=True)
        browser.close()
    check(not REPORT['pageErrors'], '无浏览器页面异常')
    REPORT['result'] = 'PASS'
finally:
    server.shutdown(); server.server_close()
    (OUTPUT/'results.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print(json.dumps(REPORT,ensure_ascii=False,indent=2))
