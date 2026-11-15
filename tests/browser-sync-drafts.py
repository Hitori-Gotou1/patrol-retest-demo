"""Real browser regression for draft replacement and account-bound editors.
Uses a local production build, no backend and no production user data.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence' / 'sync-review'
OUT.mkdir(parents=True, exist_ok=True)
REPORT = {'checks': [], 'pageErrors': [], 'backend': 'none; local production frontend only'}
PHOTO = 'hitori-room:photobooth:v1'
STUDIO = 'hitori-room:studio:v1'
OWNER = 'hitori-room:sync-local-owner:v1'
DEFAULT_PHOTO = '今天，也和大家站在一起。'
DEFAULT_STUDIO = '今晚的第一段'
class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.startswith('/patrol-retest-demo/'): path = '/' + path[len('/patrol-retest-demo/'):]
        return super().translate_path(path)
    def log_message(self, *_): pass

def passed(label): REPORT['checks'].append(label)
def leave(page):
    page.evaluate("location.hash='#/room'")
    expect(page.locator('#photo-caption, #pattern-name')).to_have_count(0)
def stored(page, key): return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', key)
def incoming(page, key, field, value, new_owner=None, remove=False):
    page.evaluate("""({key, field, value, newOwner, remove, ownerKey}) => {
      const record = JSON.parse(localStorage.getItem(key)||'{}'); record[field] = value;
      if (newOwner !== null) localStorage.setItem(ownerKey,newOwner);
      if (remove) localStorage.removeItem(key); else localStorage.setItem(key,JSON.stringify(record));
      window.dispatchEvent(new StorageEvent('storage',{key,newValue:remove?null:JSON.stringify(record),storageArea:localStorage}));
      if(newOwner !== null) window.dispatchEvent(new StorageEvent('storage',{key:ownerKey,newValue:newOwner,storageArea:localStorage}));
      window.dispatchEvent(new Event('hitori:sync-applied'));
    }""", {'key':key,'field':field,'value':value,'newOwner':new_owner,'remove':remove,'ownerKey':OWNER})
def unsaved_incoming(page, caption, remote_caption, owner=None, remove=False):
    page.evaluate("""({caption, remoteCaption, owner, remove, key, ownerKey}) => {
      const input=document.querySelector('#photo-caption');input.value=caption;input.dispatchEvent(new Event('input',{bubbles:true}));
      const record=JSON.parse(localStorage.getItem(key));record.caption=remoteCaption;
      if(owner!==null)localStorage.setItem(ownerKey,owner);
      if(remove)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(record));
      window.dispatchEvent(new StorageEvent('storage',{key,newValue:remove?null:JSON.stringify(record),storageArea:localStorage}));
      window.dispatchEvent(new Event('hitori:sync-applied'));
    }""", {'caption':caption,'remoteCaption':remote_caption,'owner':owner,'remove':remove,'key':PHOTO,'ownerKey':OWNER})

parser=argparse.ArgumentParser();parser.add_argument('--dist',type=Path,required=True);args=parser.parse_args()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(args.dist.resolve())))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/patrol-retest-demo/'
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium')
        context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce',accept_downloads=True,service_workers='block')
        context.route('**/*',lambda route:route.continue_() if urlsplit(route.request.url).netloc==urlsplit(BASE).netloc else route.abort())
        page=context.new_page();page.on('pageerror',lambda error:REPORT['pageErrors'].append(str(error)))
        page.goto(BASE+'#/room/photobooth',wait_until='networkidle')
        page.locator('#photo-caption').fill('本机打开的旧草稿A')
        page.wait_for_function("JSON.parse(localStorage.getItem('hitori-room:photobooth:v1')||'{}').caption==='本机打开的旧草稿A'")
        incoming(page,PHOTO,'caption','同步接收的新草稿B')
        expect(page.locator('#photo-caption')).to_have_value('同步接收的新草稿B')
        leave(page)
        assert stored(page,PHOTO)['caption']=='同步接收的新草稿B'
        passed('原草稿覆盖复现关闭：新稿更新编辑器，离开后仍保留新稿B')

        page.goto(BASE+'#/room/photobooth',wait_until='networkidle')
        page.evaluate('(key)=>localStorage.setItem(key,"account-a")',OWNER)
        page.locator('#photo-caption').fill('原账号的私人草稿A')
        page.wait_for_function("JSON.parse(localStorage.getItem('hitori-room:photobooth:v1')).caption==='原账号的私人草稿A'")
        incoming(page,PHOTO,'caption',None,new_owner='account-b',remove=True)
        expect(page.locator('#photo-caption')).to_have_value(DEFAULT_PHOTO)
        leave(page)
        assert stored(page,PHOTO)['caption']==DEFAULT_PHOTO
        passed('账号切换且新账号没有草稿时采用工具默认，旧账号内容不回写')

        page.goto(BASE+'#/room/photobooth',wait_until='networkidle')
        unsaved_incoming(page,'正在编辑尚未保存C','另一设备的新稿D')
        dialog=page.locator('.draft-conflict-notice')
        expect(dialog).to_be_visible()
        assert stored(page,PHOTO)['caption']=='另一设备的新稿D'
        with page.expect_download() as download_info:
            dialog.get_by_role('button',name='先导出当前内容 JSON',exact=True).click()
        downloaded=OUT/'unsaved-current-draft.json';download_info.value.save_as(downloaded)
        assert json.loads(downloaded.read_text())['caption']=='正在编辑尚未保存C'
        passed('真正同时修改展示可操作原生冲突弹窗，本机未保存稿可实际导出')
        page.keyboard.press('Escape');expect(dialog).to_be_visible()
        page.screenshot(path=str(OUT/'draft-conflict-mobile.png'))
        dialog.get_by_role('button',name='采用收到的新稿',exact=True).click()
        expect(dialog).not_to_be_visible();expect(page.locator('#photo-caption')).to_have_value('另一设备的新稿D')
        leave(page);assert stored(page,PHOTO)['caption']=='另一设备的新稿D'
        passed('明确采用收到的新稿后继续编辑与退出，未被迟到旧保存覆盖')

        page.goto(BASE+'#/room/photobooth',wait_until='networkidle')
        unsaved_incoming(page,'旧账号仍未保存E',None,owner='account-c',remove=True)
        expect(dialog).to_be_visible();expect(dialog).to_contain_text('同步账号已切换')
        expect(dialog.get_by_role('button',name='保留当前编辑',exact=True)).to_have_count(0)
        assert page.evaluate('(key)=>localStorage.getItem(key)',PHOTO) is None
        dialog.get_by_role('button',name='采用收到的新稿',exact=True).click()
        expect(page.locator('#photo-caption')).to_have_value(DEFAULT_PHOTO)
        leave(page);assert stored(page,PHOTO)['caption']==DEFAULT_PHOTO
        passed('切账号时未保存旧稿留在冲突内，禁止直接写入新账号空草稿')

        page.goto(BASE+'#/room/studio',wait_until='networkidle')
        page.locator('#pattern-name').fill('打开的旧编排A')
        page.wait_for_function("JSON.parse(localStorage.getItem('hitori-room:studio:v1')||'{}').name==='打开的旧编排A'")
        incoming(page,STUDIO,'name','另一设备的编排B')
        expect(page.locator('#pattern-name')).to_have_value('另一设备的编排B')
        leave(page);assert stored(page,STUDIO)['name']=='另一设备的编排B'
        page.goto(BASE+'#/room/studio',wait_until='networkidle')
        incoming(page,STUDIO,'name',None,new_owner='account-d',remove=True)
        expect(page.locator('#pattern-name')).to_have_value(DEFAULT_STUDIO)
        leave(page)
        after=stored(page,STUDIO)
        assert after is None or after['name']==DEFAULT_STUDIO
        passed('独立编曲编辑器接收新编排且切空账号恢复defaultPattern，退出不回写旧稿')

        page.goto(BASE+'#/room/photobooth',wait_until='networkidle')
        other=context.new_page();other.goto(BASE+'#/about',wait_until='networkidle')
        other.evaluate("""(key)=>{const next=JSON.parse(localStorage.getItem(key));next.caption='另一标签发来的真实storage事件';localStorage.setItem(key,JSON.stringify(next));}""",PHOTO)
        expect(page.locator('#photo-caption')).to_have_value('另一标签发来的真实storage事件')
        other.close();leave(page)
        assert stored(page,PHOTO)['caption']=='另一标签发来的真实storage事件'
        passed('两个真实标签页的原生storage事件更新草稿，退出后保存正确版本')
        assert not REPORT['pageErrors'],REPORT['pageErrors']
        passed('真实Chromium无未捕获页面异常')
        REPORT['result']='PASS'
        browser.close()
finally:
    server.shutdown();server.server_close()
    (OUT/'browser-results.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print(json.dumps(REPORT,ensure_ascii=False,indent=2))
