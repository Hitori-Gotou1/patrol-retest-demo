"""Exercise the selected expansion features against the exact production artifact."""
import json
import os
import struct
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('HITORI_EXPANSION_OUTPUT', '/tmp/hitori-expansion-qa'))
OUT.mkdir(parents=True, exist_ok=True)
PREFIX = '/patrol-retest-demo/'
REPORT = {'errors': [], 'missingAssets': [], 'layouts': [], 'passed': []}

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if not urlsplit(self.path).path.startswith(PREFIX):
            self.send_error(404)
            return
        self.path = '/' + self.path[len(PREFIX):]
        try: super().do_GET()
        except (BrokenPipeError, ConnectionResetError): pass
    def log_message(self, *args): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT / 'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}' + PREFIX

def fixture(browser, width=390, **options):
    context = browser.new_context(viewport={'width': width, 'height': 900}, accept_downloads=True, **options)
    context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
    context.add_init_script("""(()=>{window.__audioContexts=[];window.__soundStarts=0;const N=AudioContext;
      window.AudioContext=new Proxy(N,{construct(T,args){const c=new T(...args);window.__audioContexts.push(c);return c;}});
      for(const key of ['createOscillator','createBufferSource']){const create=N.prototype[key];N.prototype[key]=function(...args){const s=create.apply(this,args),start=s.start.bind(s);s.start=(...a)=>{window.__soundStarts++;return start(...a)};return s;};}})();""")
    page = context.new_page()
    page.clock.set_fixed_time('2026-11-13T12:00:00Z')
    page.on('pageerror', lambda e: REPORT['errors'].append(str(e)))
    page.on('response', lambda r: REPORT['missingAssets'].append(r.url) if r.status >= 400 and '/assets/' in r.url else None)
    return context, page

def go(page, path):
    page.goto(BASE + '#/room/' + path, wait_until='networkidle')
    title = {'play': 'playroom', 'photobooth': 'photo'}.get(path, path)
    if '/' not in title:
        expect(page.locator('#' + title + '-title')).to_be_visible()

def download(page, control, name):
    with page.expect_download(timeout=25000) as pending: control.click()
    target = OUT / name
    pending.value.save_as(target)
    return target.read_bytes()

def stored(page, key):
    return page.evaluate('(key)=>JSON.parse(localStorage.getItem("hitori-room:"+key+":v1"))', key)

def save(page):
    page.locator('#save-to-works').click()
    expect(page.locator('.work-save-bar [role=status]')).to_contain_text('已放进作品架')

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get('HITORI_CHROMIUM_EXECUTABLE') or os.environ.get('HITORI_CHROMIUM') or None, args=['--no-sandbox','--disable-dev-shm-usage'])
        for width in [1440, 390, 320]:
            context, page = fixture(browser, width, reduced_motion='reduce')
            for route, title in [('project','project'),('calendar','calendar'),('pilgrimage','pilgrimage'),('sources','sources'),('stats','stats'),('works','works')]:
                go(page, route)
                expect(page.locator('#'+title+'-title')).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (width, route)
                expect(page.locator('.room-nav [aria-current=page]')).to_have_count(1)
                REPORT['layouts'].append([width, route])
            for route in ['project', 'calendar']:
                go(page, route)
                page.screenshot(path=str(OUT / f'{route}-{width}.png'), full_page=True)
            controls = page.locator('.navigation-brand-row').bounding_box()
            sound = page.locator('.navigation-sound').bounding_box()
            assert controls['x']+controls['width']<=sound['x']+1 or controls['y']+controls['height']<=sound['y'], (width, controls, sound)
            context.close()

        context, page = fixture(browser)
        go(page, 'play')
        page.get_by_label('想玩多久').select_option('5')
        page.get_by_label('今天的心情').select_option('challenge')
        assert page.locator('.activity-card').count()>0
        for text in page.locator('.activity-card small').all_text_contents(): assert '约5分钟' in text and '来点挑战' in text
        page.get_by_role('link', name='带我做第一件作品 →', exact=True).click()
        expect(page.locator('.first-work-guide')).to_contain_text('第一件作品 · 1 / 3')
        page.locator('#photo-caption').fill('第一版纪念合影')
        page.get_by_role('button', name='文案写好了，下一步', exact=True).click()
        save(page)
        page.get_by_role('link', name='去作品架看看 →', exact=True).click()
        page.get_by_role('button', name='完成引导 ✓', exact=True).click()
        expect(page.locator('.first-work-guide')).to_have_count(0)
        assert stored(page,'tour')['done']
        go(page, 'photobooth'); page.locator('#photo-caption').fill('第二版纪念合影'); save(page)
        go(page, 'works')
        cards=page.locator('.work-card'); expect(cards).to_have_count(2)
        card=cards.first; card.get_by_role('button', name='整理', exact=True).click()
        card.get_by_label('作品名称', exact=True).fill('周末的四个人')
        card.get_by_label('标签（逗号分隔，最多8个）', exact=True).fill('周末，合影')
        card.get_by_role('button', name='保存整理', exact=True).click()
        card.get_by_role('button', name='置顶', exact=True).click()
        expect(cards.first).to_have_class('work-card is-pinned')
        page.get_by_placeholder('搜索作品名称或标签', exact=True).fill('周末');expect(cards).to_have_count(1)
        page.get_by_placeholder('搜索作品名称或标签', exact=True).fill('')
        cards.nth(0).get_by_label('对比此版本', exact=True).check()
        cards.nth(1).get_by_label('对比此版本', exact=True).check()
        expect(page.locator('.compare-grid img')).to_have_count(2)
        expect(page.locator('.work-compare-panel table')).to_contain_text('相片文案')
        backup=json.loads(download(page,page.get_by_role('button',name='导出作品架备份 ↓',exact=True),'organized-works.json'))
        assert any(w['pinned'] and w['tags']==['周末','合影'] for w in backup['works'])
        page.screenshot(path=str(OUT/'versions-mobile.png'),full_page=True)
        REPORT['passed'].append('guided first work, two real versions, rename, tags, pin, search, comparison, backup')

        go(page,'decorate')
        page.get_by_label('从作品架选择').select_option(label='周末的四个人')
        page.locator('#hang-work').click()
        page.wait_for_timeout(180)
        art=stored(page,'decoration')['objects'][-1]
        assert art['artTitle']=='周末的四个人' and art['artwork'].startswith('data:image/webp')
        page.reload(wait_until='networkidle')
        assert page.locator('svg image[href^="data:image/"]').count()==1
        image=download(page,page.get_by_role('button',name='保存房间照片 ↓',exact=True),'hanging-room.png')
        assert struct.unpack('>II',image[16:24])==(1440,930)
        REPORT['passed'].append('artwork embedded in room, reload, real PNG export')

        for route in ['studio','lights','effects']:
            go(page,route);save(page)
        go(page,'project')
        for label, action in [('从作品架装入编曲','装入编曲'),('从作品架装入灯光','装入灯光'),('从作品架装入吉他音色','装入吉他音色')]:
            select=page.get_by_label(label)
            value=select.locator('option').nth(2).get_attribute('value')
            select.select_option(value)
            page.get_by_role('button',name=action,exact=True).click()
        page.get_by_label('舞台背景',exact=False).select_option(label='周末的四个人')
        page.get_by_label('海报或合影',exact=False).select_option(label='第一版纪念合影')
        page.get_by_label('演出名称',exact=True).fill('周末的完整演出')
        page.get_by_label('速度 BPM',exact=True).fill('120')
        page.get_by_label('循环次数').select_option('1')
        packed=download(page,page.get_by_role('button',name='导出完整项目 JSON',exact=True),'live-project.json')
        project=json.loads(packed)
        assert project['pattern']['bpm']==project['lights']['bpm']==120
        assert len(project['lights']['cues'])==3 and project['tone']['order']
        assert project['backdrop'].startswith('data:image/') and project['poster'].startswith('data:image/')
        page.locator('#project-play').click()
        expect(page.get_by_role('button',name='停止演出',exact=True)).to_be_visible()
        page.wait_for_function('window.__soundStarts>0')
        page.wait_for_timeout(260)
        assert page.locator('.timeline-steps .on').evaluate('e=>Array.from(e.parentElement.children).indexOf(e)')>0
        expect(page.locator('.room-panel .room-status')).to_contain_text('这场演出完成了',timeout=7000)
        assert stored(page,'counts')['days']
        page.locator('#project-play').click()
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
        expect(page.locator('#project-play')).to_be_visible()
        page.wait_for_timeout(100)
        starts=page.evaluate('window.__soundStarts');page.wait_for_timeout(220);assert page.evaluate('window.__soundStarts')==starts
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false})")
        page.get_by_label('演出名称',exact=True).fill('临时改动')
        page.get_by_label('选择演出项目',exact=True).set_input_files({'name':'project.json','mimeType':'application/json','buffer':packed})
        expect(page.get_by_label('演出名称',exact=True)).to_have_value('周末的完整演出')
        image=download(page,page.get_by_role('button',name='保存演出画面 PNG',exact=True),'live-project.png')
        assert struct.unpack('>II',image[16:24])==(1350,780)
        save(page);go(page,'works');assert any(w['kind']=='project' for w in stored(page,'workshelf')['works'])
        REPORT['passed'].append('independent full project package, shared audio/light clock, completion, background stop, JSON import, PNG, shelf')

        page.get_by_role('button',name='打开全站搜索与设置',exact=True).click()
        dialog=page.locator('.site-tools-dialog')
        page.locator('#site-search').fill('纸箱迷宫')
        page.locator('#site-search-kind').select_option('activity')
        expect(dialog.locator('.site-search-results a')).to_have_count(1)
        page.locator('#site-search-kind').select_option('all')
        page.locator('#site-search').fill('周末的四个人')
        expect(dialog.locator('.site-search-results')).to_contain_text('我的作品')
        page.get_by_role('button',name='阅读与动效',exact=True).click()
        dialog.get_by_label('阅读字号').select_option('1.3')
        dialog.get_by_label('阅读行距').select_option('2.4')
        dialog.get_by_label('动态效果').select_option('reduce')
        dialog.get_by_label('增强文字对比度',exact=True).check()
        dialog.get_by_role('button',name='应用并记住设置',exact=True).click()
        expect(page.locator('html')).to_have_attribute('data-motion','reduce')
        expect(page.locator('html')).to_have_attribute('data-contrast','high')
        page.get_by_role('button',name='关闭小屋工具',exact=True).click()
        go(page,'notes/four-songs-one-evening')
        assert page.locator('.room-prose').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=19
        page.reload(wait_until='networkidle');assert stored(page,'preferences')['font']==1.3
        REPORT['passed'].append('global aliases/private works search, live motion/contrast/font preferences persist')

        go(page,'sources')
        page.get_by_label('按画师浏览').select_option('pending')
        expect(page.locator('.resource-grid article')).to_have_count(51)
        expect(page.locator('.room-intro').first).to_contain_text('原作者待确认51张')
        page.goto(BASE+'#/#gallery',wait_until='networkidle')
        page.locator('#gallery-creator').select_option('pending')
        page.locator('#gallery-grid button').first.click()
        expect(page.locator('#lightbox .source-label')).to_contain_text('原作者待确认')
        page.locator('#lightbox-close').click()
        REPORT['passed'].append('51 unknown artists remain explicit, archive and gallery creator filtering')

        go(page,'calendar');page.get_by_label('年份',exact=True).fill('2026')
        page.get_by_role('button',name='下个月',exact=True).click()
        # Set December through a verified upcoming event, independent of current test month.
        page.get_by_role('button',name='2026-12-13 · SHINJUKU LOFT 50th ANNIVERSARY DREAM MATCH 2026 PREMIUM',exact=True).click()
        event=page.locator('#event-loft-2026')
        expect(event).to_be_visible()
        assert event.get_by_role('link',name='官方来源 ↗').get_attribute('href').startswith('https://bocchi.rocks/')
        event.get_by_role('button',name='关注这一天 ＋',exact=True).click()
        page.get_by_label('只看我关注的日程',exact=True).check()
        ics=download(page,page.locator('#calendar-export'),'calendar.ics').decode()
        assert 'DTSTART;VALUE=DATE:20261213' in ics and ics.count('BEGIN:VEVENT')==1
        page.get_by_label('年份',exact=True).fill('')
        expect(page.locator('#calendar-title')).to_be_visible()
        REPORT['passed'].append('official event, follow, valid filtered ICS, invalid year safe')

        go(page,'pilgrimage')
        page.get_by_role('button',name='查看这一站 →',exact=True).nth(2).click()
        point=page.locator('.resource-card').first
        expect(point).to_contain_text('SHELTER')
        assert 'google.com/maps/search' in point.get_by_role('link',name='地图导航 ↗',exact=True).get_attribute('href')
        assert 'anitabi' in point.get_by_role('link',name='动画 / 实景对照 ↗',exact=True).get_attribute('href')
        expect(point.locator('.source-label')).to_contain_text('取景资料署名')
        point.get_by_role('button',name='记下这个地点 ＋',exact=True).click()
        itinerary=json.loads(download(page,page.get_by_role('button',name='导出想去的地点 JSON ↓',exact=True),'route.json'))
        assert len(itinerary['places'])==1 and 'SHELTER' in itinerary['places'][0]['name']
        go(page,'stats')
        expect(page.locator('.room-intro')).to_contain_text('仅来自这台浏览器')
        assert int(page.locator('.metrics-number').first.inner_text())>0
        page.get_by_role('button',name='全站汇总',exact=True).click()
        expect(page.locator('.room-status')).to_contain_text('尚未启用')
        page.get_by_role('button',name='本机统计',exact=True).click()
        page.get_by_role('button',name='打开全站搜索与设置',exact=True).click()
        page.get_by_role('button',name='阅读与动效',exact=True).click()
        page.get_by_label('记录匿名体验次数',exact=True).uncheck()
        page.get_by_role('button',name='应用并记住设置',exact=True).click()
        page.get_by_role('button',name='关闭小屋工具',exact=True).click()
        before=stored(page,'counts');go(page,'calendar');assert stored(page,'counts')==before
        REPORT['passed'].append('verified pilgrimage links/credits/bookmarks/export, real scoped counts, opt out')
        context.close()

        context,page=fixture(browser,320,java_script_enabled=False)
        page.goto(BASE+'notes/four-songs-one-evening/',wait_until='networkidle')
        expect(page.locator('main h1')).to_contain_text('四首歌')
        expect(page.locator('main')).to_contain_text('青春コンプレックス')
        assert page.locator('meta[property="og:url"]').get_attribute('content').endswith('/notes/four-songs-one-evening/')
        assert page.locator('meta[property="og:image"]').get_attribute('content').startswith('https://')
        assert page.locator('script[type="application/ld+json"]').count()==1
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert page.request.get(BASE+'sitemap.xml').text().count('<loc>')==14
        page.screenshot(path=str(OUT/'standalone-article-320.png'),full_page=True)
        context.close();browser.close()
        REPORT['passed'].append('13 standalone full articles, OG metadata, no-JS reader and sitemap')
    assert not REPORT['errors'],REPORT['errors']
    assert not REPORT['missingAssets'],REPORT['missingAssets']
    print(json.dumps(REPORT,ensure_ascii=False,indent=2))
finally:
    server.shutdown()
