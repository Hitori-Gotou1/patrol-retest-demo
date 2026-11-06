"""Exercise the built Pages app, including the real hashchange/history behavior.

No login or upload is submitted. External services are intercepted in every
browser context, so the test cannot mutate the production Supabase project.
"""
import argparse
import json
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = '/patrol-retest-demo/'


class PagesHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if not urlsplit(self.path).path.startswith(BASE):
            self.send_error(404)
            return
        self.path = '/' + self.path[len(BASE):]
        super().do_GET()

    def log_message(self, *_args):
        pass


def run(dist, configuration):
    info = json.loads((dist / 'build-info.json').read_text())
    assert info['base'] == BASE, info
    assert (dist / info['entry']).is_file(), info
    if os.environ.get('GITHUB_SHA'):
        assert info['commit'] == os.environ['GITHUB_SHA'], info

    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(PagesHandler, directory=str(dist)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f'http://127.0.0.1:{server.server_port}'
    url = origin + BASE
    errors, missing_assets, external_writes, cases = [], [], [], []

    def intercept(route):
        request = route.request
        if request.url.startswith(origin + '/'):
            route.continue_()
            return
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            external_writes.append(request.method + ' ' + urlsplit(request.url).path)
        if request.method == 'GET' and '/rest/v1/gallery_uploads' in request.url:
            route.fulfill(status=200, content_type='application/json', body='[]',
                          headers={'Access-Control-Allow-Origin': '*'})
        else:
            route.abort()

    def check_admin(page):
        expect(page.locator('.gallery-admin')).to_be_visible()
        page.wait_for_load_state('networkidle')
        expect(page).to_have_url(url + '#/manage-gallery')
        expect(page).to_have_title('上传收藏 · HITORI ROOM')
        expect(page.locator('#home')).to_have_count(0)
        if configuration == 'login':
            expect(page.get_by_role('heading', name='站主登录', exact=True)).to_be_visible()
            expect(page.get_by_label('邮箱', exact=True)).to_be_visible()
            expect(page.get_by_label('密码', exact=True)).to_be_visible()
        elif configuration == 'unconfigured':
            expect(page.get_by_role('heading', name='上传入口尚未启用')).to_be_visible()
        else:
            expect(page.locator('.admin-login, #setup-title')).to_be_visible()
        assert page.evaluate('location.hash') == '#/manage-gallery'
        assert page.locator('meta[name="hitori-build"]').get_attribute('content') == info['commit']

    try:
        with sync_playwright() as p:
            launch = {'headless': True}
            if os.environ.get('HITORI_CHROMIUM_EXECUTABLE'):
                launch['executable_path'] = os.environ['HITORI_CHROMIUM_EXECUTABLE']
            browser = p.chromium.launch(**launch)
            for width in (1440, 390):
                context = browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion='reduce')
                context.route('**/*', intercept)
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('response', lambda response: missing_assets.append(response.url)
                        if response.status >= 400 and response.url.startswith(origin + BASE + 'assets/') else None)

                page.goto(url + '#/manage-gallery', wait_until='networkidle')
                check_admin(page)
                cases.append(f'{width}: direct management link')
                page.reload(wait_until='networkidle')
                check_admin(page)
                cases.append(f'{width}: management refresh')

                page.goto(url + '#/', wait_until='networkidle')
                page.evaluate("location.hash = '#/manage-gallery'")
                check_admin(page)
                cases.append(f'{width}: location.hash assignment')

                page.goto(url + '#/#gallery', wait_until='networkidle')
                page.locator('.gallery-manage-link').click()
                check_admin(page)
                page.locator('.admin-back').click()
                expect(page).to_have_url(url + '#/#gallery')
                expect(page.locator('#gallery')).to_be_visible()
                page.go_back(wait_until='networkidle')
                check_admin(page)
                page.go_forward(wait_until='networkidle')
                expect(page).to_have_url(url + '#/#gallery')
                cases.append(f'{width}: gallery link, return, back and forward')

                # Legacy shared links are normalized on application startup.
                page.goto('about:blank')
                page.goto(url + '#gallery', wait_until='networkidle')
                expect(page).to_have_url(url + '#/#gallery')
                expect(page.locator('#gallery')).to_be_visible()
                page.goto(url + '#/about', wait_until='networkidle')
                expect(page).to_have_url(url + '#/about')
                expect(page.locator('main')).to_be_visible()
                page.goto(url + '#/missing-route', wait_until='networkidle')
                expect(page).to_have_url(url + '#/')
                expect(page.locator('#home')).to_be_visible()
                cases.append(f'{width}: legacy anchor, about and unknown-route fallback')
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()

    assert not errors, errors
    assert not missing_assets, missing_assets
    assert not external_writes, external_writes
    print(json.dumps({'result': 'PASS', 'configuration': configuration, 'commit': info['commit'],
                      'cases': cases, 'pageErrors': errors, 'missingAssets': missing_assets,
                      'externalWrites': external_writes}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dist', type=Path, default=ROOT / 'dist')
    parser.add_argument('--configuration', choices=('auto', 'login', 'unconfigured'), default='auto')
    args = parser.parse_args()
    run(args.dist.resolve(), args.configuration)
