"""Production-build regression for all six activity-room features.

All third-party requests are intercepted. No live issue, message, login or
Supabase write is submitted. Fake browser time verifies real timer UI behavior.
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
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get('HITORI_ROOM_OUTPUT', '/tmp/room-qa'))
OUTPUT.mkdir(parents=True, exist_ok=True)
REPORT = {'results': [], 'pageErrors': [], 'externalRequests': [], 'missingAssets': []}
WALL = {'version': 1, 'updatedAt': '2026-11-08T12:00:00Z', 'posts': [
    {'issue': 17, 'kind': '点歌', 'nickname': '测试访客', 'message': '<img src=x onerror="window.__injected=true">\n推荐一段小旋律。',
     'song': '原创练习 · Demo', 'link': 'https://example.test/song', 'approvedBy': 'station-owner',
     'approvedAt': '2026-11-08T12:00:00Z', 'submittedAt': '2026-11-08T10:00:00Z'}]}


class Fixture:
    def __init__(self, browser, width=1440, clock=False, blocked=False, delayed_audio=False):
        self.context = browser.new_context(viewport={'width': width, 'height': 900 if width > 800 else 844}, reduced_motion='reduce', accept_downloads=True)
        self.context.add_init_script("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});")
        self.context.add_init_script("""(() => {
          window.__audioStarts = 0;
          const native = AudioContext.prototype.createBufferSource;
          AudioContext.prototype.createBufferSource = function(...args) {
            const source = native.apply(this,args), start = source.start.bind(source);
            source.start = (...params) => { window.__audioStarts++; return start(...params); };
            return source;
          };
        })();""")
        if blocked:
            self.context.add_init_script("Storage.prototype.setItem = function(){throw new DOMException('blocked','SecurityError');};")
        if delayed_audio:
            self.context.add_init_script("""(() => {
              const native = AudioContext.prototype.resume;
              AudioContext.prototype.resume = async function() {
                await native.call(this);
                await new Promise(resolve => { window.__releaseAudio = resolve; });
              };
            })();""")
        self.wall = {'version': 1, 'updatedAt': None, 'posts': []}
        self.wall_failed = False
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: REPORT['pageErrors'].append(str(error)))
        self.page.on('response', lambda response: REPORT['missingAssets'].append(response.url)
                     if response.status >= 400 and '/assets/' in response.url and urlsplit(response.url).netloc == urlsplit(BASE).netloc else None)
        self.clock = clock
        if clock:
            self.page.clock.install(time=datetime(2026, 11, 8, 11, tzinfo=timezone.utc))

    def route(self, route):
        request = route.request
        parsed = urlsplit(request.url)
        if parsed.netloc == urlsplit(BASE).netloc:
            if parsed.path.endswith('/community/guestbook.json'):
                route.fulfill(status=503 if self.wall_failed else 200, content_type='application/json', body=json.dumps(self.wall))
            else:
                route.continue_()
        elif request.method == 'GET' and '/rest/v1/gallery_uploads' in parsed.path:
            route.fulfill(status=200, content_type='application/json', body='[]', headers={'Access-Control-Allow-Origin': '*'})
        else:
            REPORT['externalRequests'].append(request.method + ' ' + request.url)
            route.abort()

    def goto(self, page):
        self.page.goto(BASE + '#/room/' + page, wait_until='networkidle')
        expect(self.page.locator('.room-page')).to_be_visible()

    def freeze(self):
        self.page.clock.pause_at(datetime(2026, 11, 8, 12, tzinfo=timezone.utc))

    def close(self):
        self.context.close()


def test_rhythm(browser):
    fixture = Fixture(browser, clock=True)
    page = fixture.page
    fixture.goto('rhythm')
    fixture.freeze()
    page.locator('#rhythm-level').select_option('easy')
    page.locator('#rhythm-start').click()
    expect(page.locator('.rhythm-board')).to_have_attribute('data-phase', 'running')
    expect(page.locator('[data-sfx-enabled]')).to_have_attribute('data-sfx-enabled', 'true')
    page.clock.run_for(2667)
    page.keyboard.press('d')
    assert int(page.locator('#rhythm-score').inner_text()) > 0
    page.keyboard.press('Space')
    expect(page.locator('.rhythm-board')).to_have_attribute('data-phase', 'paused')
    score = page.locator('#rhythm-score').inner_text()
    page.clock.fast_forward(10000)
    page.keyboard.press('d')
    assert page.locator('#rhythm-score').inner_text() == score
    page.keyboard.press('Space')
    expect(page.locator('.rhythm-board')).to_have_attribute('data-phase', 'running')
    page.clock.fast_forward(40000)
    expect(page.locator('#rhythm-result')).to_be_visible()
    best = page.evaluate("JSON.parse(localStorage.getItem('hitori-room:rhythm-best:v1')).easy")
    assert best > 0
    page.reload(wait_until='networkidle')
    page.locator('#rhythm-level').select_option('easy')
    assert page.evaluate("JSON.parse(localStorage.getItem('hitori-room:rhythm-best:v1')).easy") == best
    page.locator('#rhythm-start').click()
    expect(page.locator('.rhythm-board')).to_have_attribute('data-phase', 'running')
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));")
    expect(page.locator('.rhythm-board')).to_have_attribute('data-phase', 'paused')
    fixture.close()


def test_stories(browser):
    fixture = Fixture(browser)
    page = fixture.page
    fixture.goto('stories')
    page.get_by_role('button', name='散场之后的便签', exact=True).click()
    page.locator('.story-choices button').first.click()
    page.locator('.story-choices button').first.click()
    expect(page.locator('.story-ending')).to_contain_text('把夸奖说出口')
    page.reload(wait_until='networkidle')
    expect(page.locator('.story-ending')).to_contain_text('把夸奖说出口')
    expect(page.get_by_role('button', name='散场之后的便签', exact=True)).to_have_attribute('aria-pressed', 'true')
    page.get_by_role('button', name='回到上一幕', exact=True).click()
    page.locator('.story-choices button').nth(1).click()
    expect(page.locator('.story-ending')).to_contain_text('明天也一起练吧')
    expect(page.locator('.story-endings li')).to_have_count(2)
    assert all('✓' in line.inner_text() for line in page.locator('.story-endings li').all())
    page.get_by_role('button', name='从头再读', exact=True).click()
    expect(page.locator('.story-choices button')).to_have_count(2)
    fixture.close()


def test_studio(browser):
    fixture = Fixture(browser, clock=True)
    page = fixture.page
    fixture.goto('studio')
    fixture.freeze()
    page.locator('#pattern-name').fill('测试合奏')
    page.locator('#pattern-bpm').fill('120')
    cell = page.get_by_role('button', name='吉他第2步', exact=True)
    cell.click()
    expect(cell).to_have_attribute('aria-pressed', 'true')
    page.get_by_role('button', name='播放并开启音效', exact=True).click()
    page.clock.run_for(300)
    expect(page.locator('.studio-track button.is-current')).to_have_count(4)
    assert page.evaluate('window.__audioStarts') > 0
    page.get_by_role('button', name='停止播放', exact=True).click()
    starts = page.evaluate('window.__audioStarts')
    page.clock.fast_forward(10000)
    assert page.evaluate('window.__audioStarts') == starts
    page.get_by_role('button', name='分享这段合奏', exact=True).click()
    expect(page.locator('#pattern-share')).to_be_visible()
    copied = page.evaluate('window.__copied')
    assert '#/room/studio?pattern=' in copied
    with page.expect_download() as pending:
        page.get_by_role('button', name='导出编排 JSON', exact=True).click()
    exported = json.loads(Path(pending.value.path()).read_text())
    assert exported['name'] == '测试合奏' and exported['bpm'] == 120
    original = page.evaluate("localStorage.getItem('hitori-room:studio:v1')")
    incoming = {'version': 1, 'name': '朋友的编排', 'bpm': 110, 'masks': [1, 2, 4, 8]}
    encoded = base64.urlsafe_b64encode(json.dumps(incoming, ensure_ascii=False).encode()).decode().rstrip('=')
    fixture.goto('studio?pattern=' + encoded)
    expect(page.locator('#pattern-name')).to_have_value('朋友的编排')
    assert page.evaluate("localStorage.getItem('hitori-room:studio:v1')") == original
    page.get_by_role('button', name='保存为本机编排', exact=True).click()
    assert json.loads(page.evaluate("localStorage.getItem('hitori-room:studio:v1')"))['name'] == '朋友的编排'
    fixture.goto('studio?pattern=not_valid')
    expect(page.locator('.room-status')).to_contain_text('无法读取')
    expect(page.locator('#pattern-name')).to_have_value('朋友的编排')
    page.get_by_label('选择编排文件', exact=True).set_input_files({'name': 'bad.json', 'mimeType': 'application/json', 'buffer': b'{}'})
    expect(page.locator('.room-status')).to_contain_text('有效的编排')
    expect(page.locator('#pattern-name')).to_have_value('朋友的编排')
    fixture.close()


def test_practice(browser):
    fixture = Fixture(browser, clock=True)
    page = fixture.page
    fixture.goto('practice')
    fixture.freeze()
    expect(page.locator('#practice-clock')).to_have_text('25:00')
    page.locator('#focus-minutes').fill('1')
    page.locator('#break-minutes').fill('1')
    page.locator('#practice-start').click()
    page.clock.run_for(10000)
    expect(page.locator('#practice-clock')).to_have_text('00:50')
    page.get_by_role('button', name='暂停计时', exact=True).click()
    page.clock.fast_forward(120000)
    expect(page.locator('#practice-clock')).to_have_text('00:50')
    page.get_by_role('button', name='继续计时', exact=True).click()
    page.clock.run_for(50000)
    expect(page.locator('#practice-total')).to_have_text('1 分钟')
    expect(page.locator('.practice-clock [role=status]')).to_have_text('休息一下')
    page.clock.fast_forward(65000)
    expect(page.locator('#practice-start')).to_be_visible()
    page.reload(wait_until='networkidle')
    expect(page.locator('#practice-total')).to_have_text('1 分钟')
    page.locator('#focus-minutes').fill('1')
    page.locator('#break-minutes').fill('0')
    page.locator('#practice-start').click()
    page.clock.run_for(10000)
    page.reload(wait_until='networkidle')
    expect(page.locator('#practice-clock')).to_have_text('00:50')
    page.clock.fast_forward(60000)
    expect(page.locator('#practice-total')).to_have_text('2 分钟')
    page.clock.fast_forward(600000)
    expect(page.locator('#practice-total')).to_have_text('2 分钟')
    with page.expect_download() as pending:
        page.get_by_role('button', name='导出练习记录', exact=True).click()
    assert json.loads(Path(pending.value.path()).read_text())['totalSessions'] == 2
    fixture.close()


def test_journal(browser):
    fixture = Fixture(browser)
    page = fixture.page
    fixture.goto('notes')
    expect(page.locator('.journal-list article')).not_to_have_count(0)
    note_count = page.locator('.journal-list article').count()
    page.locator('#journal-search').fill('十六个')
    expect(page.locator('.journal-list article')).to_have_count(1)
    page.locator('.journal-list h3 a').click()
    expect(page.get_by_role('heading', name='让小屋多一些声音', exact=True)).to_be_visible()
    page.get_by_role('button', name='标为已读', exact=True).click()
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('button', name='取消已读标记', exact=True)).to_have_attribute('aria-pressed', 'true')
    fixture.goto('notes/not-a-note')
    expect(page.get_by_role('heading', name='这一页还没写下。', exact=True)).to_be_visible()
    page.get_by_role('link', name='返回手记列表', exact=True).click()
    expect(page.locator('.journal-list article')).to_have_count(note_count)
    fixture.close()


def test_guestbook(browser):
    fixture = Fixture(browser)
    fixture.wall = WALL
    page = fixture.page
    fixture.goto('guestbook')
    expect(page.locator('.guestbook-post')).to_have_count(1)
    expect(page.locator('.guestbook-message')).to_contain_text('<img src=x')
    assert page.locator('.guestbook-post img').count() == 0
    assert page.evaluate('window.__injected === undefined')
    page.locator('#letter-message').fill('你好，小屋。')
    page.locator('#letter-name').fill('路过的访客')
    submit = page.get_by_role('link', name='在 GitHub 确认提交 ↗', exact=True)
    submit.click()
    expect(page.locator('.room-status').first).to_contain_text('确认公开提交')
    page.locator('#letter-consent').check()
    href = submit.get_attribute('href')
    parsed = urlsplit(href)
    assert parsed.netloc == 'github.com' and parsed.path.endswith('/issues/new')
    assert 'hitori-guestbook:v1' in parse_qs(parsed.query)['body'][0]
    assert '你好，小屋。' in parse_qs(parsed.query)['body'][0]
    # Inspect the prepared URL without creating a real GitHub issue.
    page.locator('#letter-kind').select_option(label='点歌')
    submit.click()
    expect(page.locator('.room-status').first).to_contain_text('必填')
    page.locator('#letter-song').fill('原创练习曲')
    page.locator('#letter-link').fill('javascript:alert(1)')
    submit.click()
    expect(page.locator('.room-status').first).to_contain_text('HTTPS')
    fixture.wall_failed = True
    page.get_by_role('button', name='刷新来信', exact=True).click()
    expect(page.get_by_text('暂时无法读取来信，可以稍后刷新，或到 GitHub 查看。', exact=True)).to_be_visible()
    fixture.wall_failed = False
    page.get_by_role('button', name='刷新来信', exact=True).click()
    expect(page.get_by_text('暂时无法读取来信，可以稍后刷新，或到 GitHub 查看。', exact=True)).to_have_count(0)
    fixture.close()


def test_lifecycle_and_storage(browser):
    fixture = Fixture(browser, delayed_audio=True)
    page = fixture.page
    fixture.goto('studio')
    page.get_by_role('button', name='播放并开启音效', exact=True).click()
    page.wait_for_function('typeof window.__releaseAudio === "function"')
    page.get_by_role('link', name='站主手记', exact=True).click()
    page.evaluate('window.__releaseAudio()')
    page.wait_for_timeout(200)
    assert page.evaluate('window.__audioStarts') == 0
    fixture.close()
    fixture = Fixture(browser, blocked=True)
    page = fixture.page
    fixture.goto('stories')
    page.locator('.story-choices button').first.click()
    expect(page.locator('.room-status')).to_contain_text('仅本次有效')
    fixture.goto('studio')
    page.locator('#pattern-name').fill('仍可编排')
    expect(page.locator('.room-status')).to_contain_text('无法保存')
    with page.expect_download() as pending:
        page.get_by_role('button', name='导出编排 JSON', exact=True).click()
    assert json.loads(Path(pending.value.path()).read_text())['name'] == '仍可编排'
    fixture.close()


def test_routes_and_layout(browser):
    for width in (1440, 768, 390, 320):
        fixture = Fixture(browser, width=width)
        page = fixture.page
        for route in ('rhythm', 'stories', 'studio', 'practice', 'notes', 'guestbook'):
            fixture.goto(route)
            expect(page.locator('.room-nav [aria-current=page]')).to_have_count(1)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,route)
            page.screenshot(path=str(OUTPUT / f'{route}-{width}.png'))
        page.goto(BASE + '#/#theater', wait_until='networkidle')
        expect(page.get_by_role('link', name='活动室', exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        fixture.close()


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        prefix = '/patrol-retest-demo/'
        if path.startswith(prefix):
            path = '/' + path[len(prefix):]
        return super().translate_path(path)
    def log_message(self, *_args):
        pass


CASES = [('rhythm',test_rhythm),('stories',test_stories),('studio',test_studio),('practice',test_practice),
         ('journal',test_journal),('guestbook',test_guestbook),('lifecycle',test_lifecycle_and_storage),('layouts',test_routes_and_layout)]
parser = argparse.ArgumentParser()
parser.add_argument('--dist', type=Path, default=ROOT/'dist')
parser.add_argument('--case', choices=[name for name,_function in CASES])
args = parser.parse_args()
server = ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(args.dist.resolve())))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}/patrol-retest-demo/'
try:
    with sync_playwright() as playwright:
        executable=os.environ.get('HITORI_CHROMIUM_EXECUTABLE')
        browser=playwright.chromium.launch(**({'executable_path':executable} if executable else {}))
        for name,function in CASES:
            if args.case and name != args.case:
                continue
            try:
                function(browser)
                REPORT['results'].append({'name':name,'result':'PASS'})
                print(name+': PASS',flush=True)
            except Exception as error:
                REPORT['results'].append({'name':name,'result':'FAIL','error':str(error),'trace':traceback.format_exc()})
                print(name+': FAIL '+str(error),flush=True)
            finally:
                for context in browser.contexts:
                    context.close()
        browser.close()
finally:
    server.shutdown();server.server_close()
REPORT['result']='PASS' if all(item['result']=='PASS' for item in REPORT['results']) and not any(REPORT[key] for key in ('pageErrors','externalRequests','missingAssets')) else 'FAIL'
(OUTPUT/'results.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print(json.dumps(REPORT,ensure_ascii=False,indent=2))
raise SystemExit(0 if REPORT['result']=='PASS' else 1)
