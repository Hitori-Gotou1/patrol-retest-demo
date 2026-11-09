"""Production-build faults for owner-session recovery and public gallery reads.

Only the fixture Supabase host is accepted; all responses and writes are mocked.
The browser clock exercises real SDK initialization without 12-second sleeps.
"""
import argparse
import base64
import json
import os
import threading
import traceback
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import Error, expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get('HITORI_CLOUD_OUTPUT', '/tmp/hitori-cloud-recovery'))
OUTPUT.mkdir(parents=True, exist_ok=True)
REPORT = {'results': [], 'pageErrors': [], 'unexpectedRequests': []}
UID = '11111111-1111-4111-8111-111111111111'
NOW = datetime(2026, 11, 9, 12, tzinfo=timezone.utc)
USER = {'id': UID, 'email': 'owner@example.test', 'aud': 'authenticated', 'role': 'authenticated',
        'created_at': '2026-10-30T00:00:00Z', 'app_metadata': {}, 'user_metadata': {}}

def token(expired=False):
    encode = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    return encode({'alg': 'HS256', 'typ': 'JWT'}) + '.' + encode({'sub': UID, 'role': 'authenticated',
        'exp': int(NOW.timestamp()) + (-3600 if expired else 3600), 'aud': 'authenticated'}) + '.fixture'

def session(expired=False):
    return {'access_token': token(expired), 'refresh_token': 'fixture-refresh', 'expires_in': 3600,
        'expires_at': int(NOW.timestamp()) + (-3600 if expired else 3600), 'token_type': 'bearer', 'user': USER}

class Fixture:
    def __init__(self, browser, saved=None, fault='', width=390):
        self.context = browser.new_context(viewport={'width': width, 'height': 844}, reduced_motion='reduce')
        if saved is not None:
            self.context.add_init_script('localStorage.setItem("hitori-room:owner-session:v1",' + json.dumps(json.dumps(saved)) + ');')
        self.fault = fault
        self.held = []
        self.requests = []
        self.rows = []
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: REPORT['pageErrors'].append(str(error)))
        self.page.clock.install(time=NOW)
        self.page.clock.pause_at(datetime(2026, 11, 9, 12, 0, 1, tzinfo=timezone.utc))

    def reply(self, route, body, status=200):
        route.fulfill(status=status, content_type='application/json', body=json.dumps(body),
            headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*'})

    def route(self, route):
        request = route.request
        parsed = urlsplit(request.url)
        if parsed.netloc == urlsplit(BASE).netloc:
            if self.fault == 'sdk' and parsed.path.endswith('/' + SDK.name):
                self.held.append((route, None))
            else:
                route.continue_()
            return
        if parsed.netloc != 'gallery-test.supabase.co':
            REPORT['unexpectedRequests'].append(request.method + ' ' + request.url)
            route.abort()
            return
        self.requests.append(request.method + ' ' + parsed.path)
        if request.method == 'OPTIONS':
            self.reply(route, {})
        elif '/auth/v1/token' in parsed.path:
            if self.fault in ('refresh', 'login'):
                self.held.append((route, session()))
            else:
                self.reply(route, session())
        elif '/auth/v1/user' in parsed.path:
            if self.fault == 'user':
                self.reply(route, {'message': 'offline'}, 503)
            else:
                self.reply(route, USER)
        elif '/auth/v1/logout' in parsed.path:
            self.reply(route, {})
        elif '/rest/v1/gallery_admins' in parsed.path:
            if self.fault == 'permission':
                self.held.append((route, [{'user_id': UID}]))
            else:
                self.reply(route, [{'user_id': UID}])
        elif '/rest/v1/gallery_uploads' in parsed.path:
            if self.fault == 'gallery':
                self.held.append((route, self.rows))
            elif self.fault.startswith('http-'):
                self.reply(route, {'code': 'PGRST205' if self.fault == 'http-404' else 'fixture'}, int(self.fault[5:]))
            else:
                self.reply(route, self.rows)
        elif '/storage/v1/object/public/' in parsed.path:
            route.fulfill(content_type='image/jpeg', body=(ROOT/'public/assets/gallery/2026-10-29/originals/collection-01.jpg').read_bytes())
        else:
            REPORT['unexpectedRequests'].append(request.method + ' ' + request.url)
            route.abort()

    def goto(self, suffix='#/manage-gallery'):
        self.page.goto(BASE + suffix, wait_until='domcontentloaded')

    def wait_held(self):
        for _ in range(100):
            if self.held:
                return
            self.page.wait_for_timeout(50)
        raise AssertionError('The expected stalled request did not start: ' + repr(self.requests))

    def recover(self):
        self.fault = ''
        for route, data in self.held:
            try:
                if data is None:
                    route.fulfill(content_type='application/javascript', body=SDK.read_bytes())
                else:
                    self.reply(route, data)
            except Error:
                pass  # The deadline may have already cancelled this request.
        self.held.clear()

    def close(self):
        self.context.close()

def test_sdk(browser):
    fixture = Fixture(browser, fault='sdk')
    page = fixture.page
    fixture.goto(); fixture.wait_held()
    page.clock.fast_forward(13000)
    expect(page.locator('.admin-login')).to_be_visible()
    expect(page.locator('.admin-feedback.is-error')).to_contain_text('超时')
    expect(page.locator('.admin-notice[role=status]')).to_have_count(0)
    fixture.recover()
    page.get_by_role('button', name='重新检查登录状态', exact=True).click()
    expect(page.locator('.admin-login button[type=submit]')).to_be_enabled()
    fixture.close()

def test_expired_session(browser):
    fixture = Fixture(browser, saved=session(True), fault='refresh')
    page = fixture.page
    fixture.goto(); fixture.wait_held()
    page.clock.fast_forward(13000)
    expect(page.locator('.admin-notice[role=status]')).to_have_count(0)
    expect(page.get_by_role('button', name='重新检查登录状态', exact=True)).to_be_visible()
    expect(page.locator('.admin-feedback.is-error')).to_contain_text('超时')
    fixture.recover()
    page.clock.run_for(1000)
    page.get_by_role('button', name='重新检查登录状态', exact=True).click()
    page.clock.run_for(1000)
    expect(page.locator('.admin-upload')).to_be_visible()
    expect(page.locator('#gallery-upload-file')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(OUTPUT/'owner-recovered-390.png'), full_page=True)
    fixture.close()

def test_permission(browser):
    fixture = Fixture(browser, saved=session(), fault='permission')
    page = fixture.page
    fixture.goto(); fixture.wait_held()
    page.clock.fast_forward(13000)
    expect(page.get_by_role('heading', name='暂时无法确认上传权限', exact=True)).to_be_visible()
    expect(page.get_by_role('heading', name='这个账号没有上传权限', exact=True)).to_have_count(0)
    fixture.recover()
    page.get_by_role('button', name='重新检查登录状态', exact=True).click()
    expect(page.locator('.admin-upload')).to_be_visible()
    expect(page.locator('.admin-feedback.is-error')).to_have_count(0)
    fixture.close()

def test_user_unavailable(browser):
    fixture = Fixture(browser, saved=session(), fault='user')
    page = fixture.page
    fixture.goto()
    expect(page.get_by_role('heading', name='暂时无法确认上传权限', exact=True)).to_be_visible()
    expect(page.get_by_role('heading', name='这个账号没有上传权限', exact=True)).to_have_count(0)
    fixture.fault = ''
    page.get_by_role('button', name='重新检查登录状态', exact=True).click()
    expect(page.locator('.admin-upload')).to_be_visible()
    fixture.close()

def test_login(browser):
    fixture = Fixture(browser, fault='login')
    page = fixture.page
    fixture.goto()
    page.locator('#owner-email').fill(USER['email'])
    page.locator('#owner-password').fill('fixture-password')
    page.locator('.admin-login button[type=submit]').click(); fixture.wait_held()
    page.clock.fast_forward(13000)
    expect(page.locator('.admin-login button[type=submit]')).to_be_enabled()
    expect(page.locator('.admin-feedback.is-error')).to_contain_text('超时')
    fixture.recover()
    page.locator('.admin-login button[type=submit]').click()
    page.clock.run_for(1000)
    expect(page.locator('.admin-upload')).to_be_visible()
    fixture.close()

def test_public_gallery(browser):
    for width in (390, 320):
        fixture = Fixture(browser, fault='gallery', width=width)
        page = fixture.page
        fixture.goto('#/#gallery'); fixture.wait_held()
        expect(page.locator('.gallery-card')).to_have_count(9)
        expect(page.get_by_role('link', name='站主上传图片 ↗', exact=True)).to_be_visible()
        page.clock.fast_forward(13000)
        expect(page.locator('.gallery-cloud-notice')).to_contain_text('超时')
        expect(page.locator('.gallery-card')).to_have_count(9)
        fixture.recover()
        row_id = '22222222-2222-4222-8222-222222222222'
        fixture.rows = [{'id': row_id, 'object_path': UID+'/'+row_id+'.jpg', 'title': '网络恢复后的收藏', 'width': 300, 'height': 300}]
        page.evaluate("window.dispatchEvent(new Event('online'))")
        expect(page.locator('.gallery-cloud-notice')).to_have_count(0)
        expect(page.locator('[data-filter=all] span')).to_have_text('55')
        expect(page.locator('.gallery-card h3').first).to_have_text('网络恢复后的收藏')
        page.locator('.gallery-view-switch button').nth(1).click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        fixture.close()

def test_http_errors(browser):
    for status, message in ((401,'验证未通过'),(403,'访问权限'),(404,'数据表'),(503,'运行中')):
        fixture = Fixture(browser, fault='http-'+str(status))
        page = fixture.page
        fixture.goto('#/#gallery')
        expect(page.locator('.gallery-cloud-notice')).to_contain_text(message)
        expect(page.locator('.gallery-card')).to_have_count(9)
        fixture.close()

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        prefix = '/patrol-retest-demo/'
        if path.startswith(prefix): path = '/' + path[len(prefix):]
        return super().translate_path(path)
    def log_message(self, *_args): pass

CASES = [('sdk',test_sdk),('expired-session',test_expired_session),('permission',test_permission),
         ('user-unavailable',test_user_unavailable),('login',test_login),('public-gallery',test_public_gallery),('http-errors',test_http_errors)]
parser = argparse.ArgumentParser()
parser.add_argument('--dist', type=Path, required=True)
parser.add_argument('--case', choices=[name for name,_ in CASES])
args = parser.parse_args()
SDK = next(path for path in (args.dist/'assets').glob('*.js') if 'Multiple GoTrueClient instances' in path.read_text())
server = ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(args.dist.resolve())))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}/patrol-retest-demo/'
try:
    with sync_playwright() as playwright:
        executable = os.environ.get('HITORI_CHROMIUM_EXECUTABLE')
        browser = playwright.chromium.launch(**({'executable_path':executable} if executable else {}))
        for name,function in CASES:
            if args.case and args.case != name: continue
            try:
                function(browser)
                REPORT['results'].append({'name':name,'result':'PASS'})
                print(name+': PASS',flush=True)
            except Exception as error:
                REPORT['results'].append({'name':name,'result':'FAIL','error':str(error),'trace':traceback.format_exc()})
                print(name+': FAIL '+str(error),flush=True)
            finally:
                for context in browser.contexts: context.close()
        browser.close()
finally:
    server.shutdown(); server.server_close()
REPORT['result']='PASS' if all(item['result']=='PASS' for item in REPORT['results']) and not REPORT['pageErrors'] and not REPORT['unexpectedRequests'] else 'FAIL'
(OUTPUT/'results.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print(json.dumps(REPORT,ensure_ascii=False,indent=2))
raise SystemExit(0 if REPORT['result']=='PASS' else 1)
