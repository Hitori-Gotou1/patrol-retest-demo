"""Real Chromium acceptance for mobile workspaces, curated templates and activity pins."""
import json, os, threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence'/'mobile'
OUT.mkdir(parents=True,exist_ok=True)
PREFIX='/patrol-retest-demo/'
class Handler(SimpleHTTPRequestHandler):
 def do_GET(self):
  if not urlsplit(self.path).path.startswith(PREFIX): self.send_error(404); return
  self.path='/'+self.path[len(PREFIX):]
  try: super().do_GET()
  except (BrokenPipeError,ConnectionResetError): pass
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=os.environ.get('HITORI_MOBILE_DIST',str(ROOT/'dist'))))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}'+PREFIX
report={'layouts':[],'flows':[],'errors':[],'downloads':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for width,height in [(320,740),(390,844),(430,932),(768,1024),(1440,1000),(844,390)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=width<900,accept_downloads=True,reduced_motion='reduce')
   ctx.route('**/*',lambda route:route.continue_() if route.request.url.startswith(BASE) else route.abort())
   page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
   for route in ['play','photobooth','comic','decorate','graffiti','lights']:
    page.goto(BASE+'#/room/'+route,wait_until='networkidle')
    expect(page.locator('.discovery-home' if route=='play' else '.editor-workspace')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route,page.evaluate('document.documentElement.scrollWidth'))
    report['layouts'].append([width,height,route])
    if route=='play':
     expect(page.locator('.room-topic-grid a')).to_have_count(3)
     expect(page.locator('.featured-activity')).to_have_count(3)
     if width==390:
      page.locator('.activity-favorite-toggle').first.click()
      expect(page.locator('.favorite-activity-list article')).to_have_count(1)
      other=ctx.new_page();other.goto(BASE+'#/room/play',wait_until='networkidle');other.locator('.favorite-activity-list article button').last.click()
      expect(page.locator('.favorite-activity-list article')).to_have_count(0)
      other.close();report['flows'].append('常用活动跨标签页取消即时生效')
     if width in [390,1440]: page.screenshot(path=str(OUT/f'discovery-{width}.png'),full_page=True)
     continue
    page.locator('.editor-enter').click()
    expect(page.locator('.editor-workspace')).to_have_class(__import__('re').compile('is-fullscreen'))
    expect(page.locator('.editor-exit')).to_be_focused()
    box=page.locator('.editor-workspace').bounding_box();assert box['y']<=1 and abs(box['height']-height)<3,(width,height,route,box)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route,'fullscreen')
    for selector in ['.editor-exit','.editor-save']:
     b=page.locator(selector).bounding_box();assert b['height']>=44 and b['width']>=44,(width,selector,b)
    if route=='lights' and width<=760:
     buttons=page.locator('.light-timeline button:visible');expect(buttons).to_have_count(12)
     page.locator('.light-mobile-segments button').nth(2).click();expect(page.locator('.light-timeline button:visible').first).to_have_attribute('aria-label','灯 1 第 9 步')
     b=page.locator('.light-timeline button:visible').first.bounding_box();assert b['width']>=44 and b['height']>=44,b
    if width==390:
     if route=='photobooth':
      page.locator('#photo-caption').fill('手机修改后的合影')
      page.locator('.editor-save-work').click();expect(page.locator('.editor-workspace-notice')).to_contain_text('已存入作品架')
     if route=='comic':page.locator('.editor-workspace-tools textarea').fill('这句对白来自手机。')
     if route=='graffiti':
      b=page.locator('canvas').bounding_box();page.touchscreen.tap(b['x']+b['width']/2,b['y']+b['height']/2)
     if route=='decorate':page.get_by_role('button',name='添加落地灯',exact=True).click()
     with page.expect_download(timeout=25000) as pending:page.locator('.editor-save').click()
     file=OUT/f'{route}-mobile.png';pending.value.save_as(file);data=file.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n' and len(data)>1000
     report['downloads'].append({'file':str(file.relative_to(ROOT)),'bytes':len(data)})
     page.screenshot(path=str(OUT/f'editor-{route}-390.png'))
    page.keyboard.press('Escape');expect(page.locator('.editor-workspace')).not_to_have_class(__import__('re').compile('is-fullscreen'))
    expect(page.locator('.editor-enter')).to_be_focused()
    if width==390 and route=='photobooth':
     page.locator('.template-toggle').click();page.get_by_role('button',name='使用这套模板 →').first.click();expect(page.locator('#photo-caption')).not_to_have_value('手机修改后的合影')
     page.get_by_role('button',name='恢复使用模板前的草稿').click();expect(page.locator('#photo-caption')).to_have_value('手机修改后的合影');report['flows'].append('手机拍贴全屏编辑、真实PNG、退出焦点、模板恢复原草稿')
   page.goto(BASE+'#/room/play',wait_until='networkidle');page.get_by_role('button',name='打开全站搜索与设置').click();expect(page.locator('#site-search')).to_be_focused();page.keyboard.press('Escape');expect(page.get_by_role('button',name='打开全站搜索与设置')).to_be_focused()
   ctx.close()
  browser.close()
 assert not report['errors'],report['errors']
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
finally:server.shutdown()
