"""Validate discovery, editorial content, lightweight assets and non-destructive work versions."""
import json
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('HITORI_QA_OUTPUT','/tmp/hitori-experience-qa')); OUT.mkdir(parents=True,exist_ok=True)
BASE='/patrol-retest-demo/'
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if not urlsplit(self.path).path.startswith(BASE):self.send_error(404);return
        self.path='/'+self.path[len(BASE):];super().do_GET()
    def log_message(self,*args):pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
report={'errors':[],'missingAssets':[],'layouts':[]}

def fixture(browser,width=1440,blocked=False):
    context=browser.new_context(viewport={'width':width,'height':844 if width<800 else 1000},reduced_motion='reduce',accept_downloads=True)
    if blocked:context.add_init_script("Storage.prototype.getItem=function(){throw new DOMException('blocked','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError')}")
    context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(origin+'/') else route.abort())
    page=context.new_page();page.on('pageerror',lambda error:report['errors'].append(str(error)))
    page.on('response',lambda response:report['missingAssets'].append(response.url) if response.status>=400 and '/assets/' in response.url else None)
    return context,page

def go(page,path):
    page.goto(origin+BASE+'#/'+path,wait_until='networkidle')

def shelf(page):
    return page.evaluate("JSON.parse(localStorage.getItem('hitori-room:workshelf:v1')).works")

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.environ.get('HITORI_CHROMIUM') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width in [1440,390,320]:
            context,page=fixture(browser,width)
            go(page,'room/play')
            expect(page.locator('.featured-activity')).to_have_count(3)
            first=page.locator('.featured-activity').first.bounding_box()
            assert first['y']+80<page.viewport_size['height'],(width,first)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
            assert page.locator('.featured-art img').first.evaluate('e=>e.complete&&e.naturalWidth>0')
            assert page.locator('.room-nav a').count()==1
            page.screenshot(path=str(OUT/f'room-{width}.png'))
            report['layouts'].append({'width':width,'firstActivityTop':round(first['y'])})
            page.get_by_role('button',name='全部玩法 ＋',exact=True).click()
            expect(page.locator('#room-directory a')).to_have_count(28)
            page.get_by_role('button',name='收起目录 −',exact=True).click()
            page.get_by_role('button',name='做一件作品',exact=True).click();expect(page.locator('.activity-card')).to_have_count(6)
            page.get_by_role('button',name='全部活动 · 28',exact=True).click()
            page.get_by_placeholder('找玩法、作品或声音',exact=True).fill('纸箱迷宫');expect(page.locator('.activity-card')).to_have_count(1)
            page.get_by_placeholder('找玩法、作品或声音',exact=True).fill('完全不存在的玩法');expect(page.locator('.activity-card')).to_have_count(0)
            go(page,'room/works');expect(page.locator('.works-empty')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(OUT/f'works-empty-{width}.png'))
            context.close()
        context,page=fixture(browser,390)
        go(page,'room/photobooth')
        page.locator('#photo-caption').fill('今天的第一张合影')
        page.locator('#save-to-works').click();expect(page.locator('.work-save-bar [role=status]')).to_contain_text('已放进作品架')
        assert shelf(page)[0]['snapshot']['caption']=='今天的第一张合影'
        assert shelf(page)[0]['preview'].startswith('data:image/webp')
        page.locator('#save-to-works').click();expect(page.locator('.work-save-bar [role=status]')).to_contain_text('已放进作品架');assert len(shelf(page))==1
        page.locator('#photo-caption').fill('尚未入架的第二版')
        page.locator('.room-shelf-link').click();expect(page.locator('#works-title')).to_be_visible()
        assert page.locator('.work-preview img').first.evaluate('e=>e.complete&&e.naturalWidth>0')
        page.locator('.work-card').first.get_by_role('button',name='继续编辑 →',exact=True).click()
        expect(page.locator('#photo-caption')).to_have_value('今天的第一张合影')
        assert len(shelf(page))==2 and any(work['snapshot']['caption']=='尚未入架的第二版' for work in shelf(page))
        page.locator('.room-shelf-link').click();expect(page.locator('.work-card')).to_have_count(2)
        page.screenshot(path=str(OUT/'works-saved-mobile.png'),full_page=True)
        with page.expect_download() as download:page.get_by_role('button',name='导出作品架备份 ↓',exact=True).click()
        saved_path=OUT/'works-backup.json';download.value.save_as(saved_path)
        payload=saved_path.read_bytes();assert len(json.loads(payload)['works'])==2
        page.locator('.work-card').first.get_by_role('button',name='移出作品架',exact=True).click();expect(page.locator('.work-card')).to_have_count(1)
        page.get_by_role('button',name='撤销移出',exact=True).click();expect(page.locator('.work-card')).to_have_count(2)
        go(page,'room/play');expect(page.locator('.room-resume')).to_contain_text('结束乐队拍贴机')
        go(page,'room/notes');expect(page.locator('.journal-list article')).to_have_count(13)
        page.locator('#journal-category').select_option('角色小记');expect(page.locator('.journal-list article')).to_have_count(4)
        go(page,'room/notes/four-songs-one-evening');expect(page.locator('.journal-sources a')).to_have_count(1)
        assert '四首歌' in page.title()
        assert page.locator('.room-prose').inner_text().count('青春コンプレックス')>=1
        page.screenshot(path=str(OUT/'article-mobile.png'))
        go(page,'');page.locator('#video').scroll_into_view_if_needed();expect(page.locator('#listening-title')).to_be_visible()
        expect(page.locator('.listening-grid article')).to_have_count(4)
        page.get_by_role('button',name='练习唱片',exact=True).click();page.locator('.music-play').click();page.wait_for_function("!document.querySelector('.music-player audio').paused")
        page.get_by_role('button',name='原曲导听',exact=True).click();assert page.locator('.music-player audio').evaluate('audio=>audio.paused')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        context.close()
        context,page=fixture(browser)
        go(page,'room/works');page.get_by_label('选择作品架备份',exact=True).set_input_files({'name':'backup.json','mimeType':'application/json','buffer':payload})
        expect(page.locator('.work-card')).to_have_count(2)
        assert page.evaluate("localStorage.getItem('hitori-room:photobooth:v1')===null")
        bad=json.loads(payload);bad['works'][0]['preview']='data:image/svg+xml,<svg onload=alert(1)>'
        page.get_by_label('选择作品架备份',exact=True).set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
        expect(page.locator('.room-status')).to_contain_text('作品预览格式无法读取');assert len(shelf(page))==2
        page.screenshot(path=str(OUT/'works-saved-desktop.png'))
        context.close()
        context,page=fixture(browser,blocked=True);go(page,'room/play');expect(page.locator('.featured-activity')).to_have_count(3)
        go(page,'room/works');expect(page.locator('.room-status')).to_contain_text('暂时无法读取')
        go(page,'room/comic');page.locator('#save-to-works').click();expect(page.locator('.work-save-bar [role=status]')).to_contain_text('原记录仍保留')
        context.close()
        browser.close()
    chars=json.loads((ROOT/'src/data/characters.json').read_text())
    total=sum((ROOT/'public'/char['thumbnail']).stat().st_size for char in chars)
    assert total<100000,total
    assert all((ROOT/'public'/char['artwork']).is_file() for char in chars)
    report['thumbnailBytes']=total
    assert not report['errors'],report['errors'];assert not report['missingAssets'],report['missingAssets']
    print(json.dumps(report,ensure_ascii=False,indent=2))
finally:
    server.shutdown()
