"""Exercise the six playroom experiences against the built artifact, without external writes."""
import argparse
import json
import os
import struct
import threading
import traceback
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get('HITORI_PLAYROOM_OUTPUT', '/tmp/playroom-qa'))
OUTPUT.mkdir(parents=True, exist_ok=True)
REPORT = {'results': [], 'pageErrors': [], 'missingAssets': [], 'externalRequests': []}
ROUTES = ('play', 'photobooth', 'decorate', 'walk', 'search', 'concert', 'ambient')

class Fixture:
    def __init__(self, browser, width=1440, blocked=False):
        self.context = browser.new_context(viewport={'width': width, 'height': 900 if width > 800 else 844}, has_touch=width < 800, reduced_motion='reduce', accept_downloads=True)
        self.context.add_init_script("""(() => {
          window.__audioContexts = [];
          const Native = window.AudioContext;
          window.AudioContext = new Proxy(Native, { construct(Target, args) {
            const context = new Target(...args); window.__audioContexts.push(context); return context;
          }});
        })();""")
        if blocked:
            self.context.add_init_script("Storage.prototype.setItem = function(){throw new DOMException('blocked','SecurityError');};")
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda e: REPORT['pageErrors'].append(str(e)))
        self.page.on('response', lambda r: REPORT['missingAssets'].append(r.url) if r.status >= 400 and '/assets/' in r.url else None)
    def route(self, route):
        if urlsplit(route.request.url).netloc == urlsplit(BASE).netloc:
            route.continue_()
        else:
            REPORT['externalRequests'].append(route.request.url)
            route.abort()
    def goto(self, route):
        self.page.goto(BASE + '#/room/' + route, wait_until='networkidle')
        expect(self.page.locator('.room-page')).to_be_visible()
    def close(self): self.context.close()

def download(page, button, name, size):
    with page.expect_download(timeout=20000) as waiting:
        button.click()
    path = OUTPUT / name
    waiting.value.save_as(path)
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    assert struct.unpack('>II', data[16:24]) == size
    assert len(data) > 2000

def test_photobooth(browser):
    f=Fixture(browser);p=f.page;f.goto('photobooth')
    p.locator('#photo-caption').fill('我们的第一张合影')
    p.get_by_role('button',name='添加小星星贴纸',exact=True).click()
    p.get_by_role('button',name='向右移动',exact=True).click()
    star=p.get_by_role('button',name='移动小星星',exact=True)
    star.focus();p.keyboard.press('ArrowDown')
    p.wait_for_timeout(220)
    draft=p.evaluate("JSON.parse(localStorage.getItem('hitori-room:photobooth:v1'))")
    item=next(o for o in draft['objects'] if o['id']=='star')
    assert (item['x'],item['y']) == (368,228)
    person=p.get_by_role('button',name='移动后藤一里',exact=True)
    person.scroll_into_view_if_needed();box=person.bounding_box()
    p.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
    p.mouse.down();p.mouse.move(box['x']+box['width']/2+35,box['y']+box['height']/2+20,steps=5);p.mouse.up()
    p.wait_for_timeout(220)
    moved=p.evaluate("JSON.parse(localStorage.getItem('hitori-room:photobooth:v1')).objects.find(x=>x.id==='hitori').x")
    assert moved>130
    p.reload(wait_until='networkidle');expect(p.locator('#photo-caption')).to_have_value('我们的第一张合影')
    assert p.get_by_role('button',name='移动小星星',exact=True).count()==1
    download(p,p.locator('#photo-export'),'photo.png',(1080,1350))
    p.get_by_role('button',name='重新布置',exact=True).click()
    expect(p.locator('#photo-caption')).to_have_value('今天，也和大家站在一起。')
    p.get_by_role('button',name='撤销重置',exact=True).click()
    expect(p.locator('#photo-caption')).to_have_value('我们的第一张合影')
    f.close()

def test_decoration(browser):
    f=Fixture(browser);p=f.page;f.goto('decorate')
    p.get_by_role('button',name='添加纸箱',exact=True).click()
    p.get_by_role('button',name='轻点互动',exact=True).click()
    expect(p.locator('.play-editor-svg image')).to_have_count(0)
    p.get_by_role('button',name='轻点互动',exact=True).click()
    expect(p.locator('.play-editor-svg image')).to_have_count(1)
    p.get_by_role('button',name='粉色灯光',exact=True).click()
    download(p,p.get_by_role('button',name='保存房间照片 ↓',exact=True),'room.png',(1440,930))
    p.reload(wait_until='networkidle')
    expect(p.get_by_role('button',name='粉色灯光',exact=True)).to_have_attribute('aria-pressed','true')
    assert p.get_by_role('button',name='移动或轻点纸箱',exact=True).count()==2
    f.close()

def test_walk(browser):
    f=Fixture(browser);p=f.page;f.goto('walk')
    buttons=p.locator('.walk-place-buttons button')
    for button in buttons.all():button.click()
    expect(p.locator('.play-badge')).to_have_text('六个街角，都去过了')
    p.reload(wait_until='networkidle');expect(p.locator('.play-badge')).to_be_visible()
    download(p,p.get_by_role('button',name='保存完整散步手帐 ↓',exact=True),'walk.png',(1440,975))
    p.get_by_role('button',name='开始新的散步',exact=True).click()
    expect(p.locator('.play-badge')).to_have_count(0)
    p.get_by_role('button',name='撤销重置',exact=True).click();expect(p.locator('.play-badge')).to_be_visible()
    f.close()

def test_search(browser):
    f=Fixture(browser);p=f.page;f.goto('search')
    p.get_by_role('button',name='给一点提示',exact=True).click();p.wait_for_timeout(220)
    round=p.evaluate("JSON.parse(localStorage.getItem('hitori-room:search:v1'))")
    assert len(round['targets'])==6
    wrong=next(node.get_attribute('data-object') for node in p.locator('[data-object]').all() if node.get_attribute('data-object') not in round['targets'])
    p.locator(f'[data-object="{wrong}"]').click()
    for item in round['targets']:p.locator(f'[data-object="{item}"]').click()
    expect(p.locator('.search-board')).to_have_attribute('data-complete','true')
    expect(p.locator('.search-complete')).to_be_visible()
    p.reload(wait_until='networkidle');expect(p.locator('#search-progress')).to_have_text('已收好 6 / 6')
    p.get_by_role('button',name='找齐啦，再来一轮 →',exact=True).click()
    expect(p.locator('#search-progress')).to_have_text('已收好 0 / 6')
    f.close()

def test_concert(browser):
    f=Fixture(browser);p=f.page;f.goto('concert')
    p.locator('#concert-name').fill('今天的第一场')
    p.locator('#concert-launch').click();expect(p.locator('.concert-event')).to_be_visible()
    p.locator('.concert-event-choices button').last.click();expect(p.locator('.concert-result')).to_be_visible()
    p.reload(wait_until='networkidle');expect(p.locator('.concert-result')).to_be_visible()
    download(p,p.get_by_role('button',name='保存演出海报 ↓',exact=True),'concert.png',(1080,1380))
    assert p.locator('.concert-history li').count()==1
    p.get_by_role('button',name='筹备下一场',exact=True).click();expect(p.locator('#concert-launch')).to_be_visible()
    f.close()

def test_ambient(browser):
    f=Fixture(browser);p=f.page;f.goto('ambient')
    assert p.evaluate('window.__audioContexts.length')==0
    p.locator('#ambient-name').fill('今晚的晚风')
    p.get_by_role('button',name='把当前氛围放进收藏 ＋',exact=True).click()
    expect(p.locator('.ambient-saved')).to_contain_text('今晚的晚风')
    p.locator('#ambient-play').click();expect(p.locator('#ambient-stop')).to_be_visible()
    p.wait_for_function("window.__audioContexts.length===2 && window.__audioContexts.every(c=>c.state==='running')")
    p.get_by_role('button',name='关闭互动音效',exact=True).click()
    expect(p.locator('#ambient-play')).to_be_visible()
    p.wait_for_function("window.__audioContexts.every(c=>c.state!=='running')")
    p.locator('#ambient-play').click();expect(p.locator('#ambient-stop')).to_be_visible()
    p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));")
    expect(p.locator('#ambient-play')).to_be_visible()
    p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));")
    expect(p.locator('#ambient-play')).to_be_visible()
    download(p,p.get_by_role('button',name='保存氛围卡 ↓',exact=True),'ambient.png',(1080,1260))
    f.goto('play');p.wait_for_function("window.__audioContexts.at(-1).state==='closed'")
    f.goto('ambient');expect(p.locator('.ambient-saved')).to_contain_text('今晚的晚风')
    assert p.evaluate('window.__audioContexts.filter(c=>c.state==="running").length')==0
    f.close()

def test_layouts_and_storage(browser):
    for width in (1440,390,320):
        f=Fixture(browser,width);p=f.page
        for route in ROUTES:
            f.goto(route)
            expect(p.locator('.room-nav [aria-current=page]')).to_have_count(1)
            assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route)
            p.screenshot(path=str(OUTPUT/f'{route}-{width}.png'),full_page=width<800)
        if width==390:
            f.goto('photobooth')
            p.get_by_role('button',name='添加心动贴纸',exact=True).tap()
            expect(p.get_by_role('button',name='移动心动',exact=True)).to_be_visible()
        f.close()
    f=Fixture(browser,blocked=True);p=f.page;f.goto('photobooth')
    p.locator('#photo-caption').fill('依然可以拍照')
    expect(p.locator('.play-footer-note').last).to_contain_text('无法保存')
    download(p,p.locator('#photo-export'),'photo-blocked-storage.png',(1080,1350))
    f.close()

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self,path):
        if path.startswith('/patrol-retest-demo/'):path='/'+path[len('/patrol-retest-demo/'):]
        return super().translate_path(path)
    def log_message(self,*_args):pass

CASES=[('photobooth',test_photobooth),('decoration',test_decoration),('walk',test_walk),('search',test_search),('concert',test_concert),('ambient',test_ambient),('layouts_storage',test_layouts_and_storage)]
parser=argparse.ArgumentParser();parser.add_argument('--dist',type=Path,default=ROOT/'dist');parser.add_argument('--case',choices=[n for n,_ in CASES]);args=parser.parse_args()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(args.dist.resolve())))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/patrol-retest-demo/'
try:
    with sync_playwright() as p:
        executable=os.environ.get('HITORI_CHROMIUM_EXECUTABLE')
        browser=p.chromium.launch(**({'executable_path':executable} if executable else {}))
        for name,function in CASES:
            if args.case and name!=args.case:continue
            try:
                function(browser);REPORT['results'].append({'name':name,'result':'PASS'});print(name+': PASS',flush=True)
            except Exception as e:
                REPORT['results'].append({'name':name,'result':'FAIL','error':str(e),'trace':traceback.format_exc()});print(name+': FAIL '+str(e),flush=True)
            finally:
                for context in browser.contexts:context.close()
        browser.close()
finally:server.shutdown();server.server_close()
REPORT['result']='PASS' if REPORT['results'] and all(r['result']=='PASS' for r in REPORT['results']) and not any(REPORT[k] for k in ('pageErrors','missingAssets','externalRequests')) else 'FAIL'
(OUTPUT/'results.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print(json.dumps(REPORT,ensure_ascii=False,indent=2));raise SystemExit(0 if REPORT['result']=='PASS' else 1)
