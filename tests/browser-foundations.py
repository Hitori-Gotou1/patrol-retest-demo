"""Production-artifact checks: real loading/route recovery, lazy scenes and crawler pages.
External services are not contacted. Measurements compare the exact baseline SHA
with the upgraded artifact on the same browser/server, with service workers blocked.
"""
import argparse, json, threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];PREFIX='/patrol-retest-demo/'
OUT=ROOT/'evidence'/'foundations';OUT.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def do_GET(self):
  if not urlsplit(self.path).path.startswith(PREFIX):self.send_error(404);return
  self.path='/'+self.path[len(PREFIX):]
  try:super().do_GET()
  except(BrokenPipeError,ConnectionResetError):pass
 def log_message(self,*args):pass
def host(dist):
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(dist)))
 threading.Thread(target=server.serve_forever,daemon=True).start();return server,f'http://127.0.0.1:{server.server_port}'+PREFIX
parser=argparse.ArgumentParser();parser.add_argument('--dist',default='/tmp/hitori-integration-dist');parser.add_argument('--baseline',default='/tmp/hitori-baseline-dist');args=parser.parse_args()
server,BASE=host(Path(args.dist));oldserver,OLD=host(Path(args.baseline));fault={'active':False}
report={'passed':[],'injectedFaults':[],'errors':[],'measurements':{},'layouts':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  def context(width=1440,**options):
   ctx=browser.new_context(viewport={'width':width,'height':900},service_workers='block',reduced_motion='reduce',**options)
   ctx.route('**/*',lambda route:route.continue_() if route.request.url.startswith((BASE,OLD)) else route.abort())
   return ctx
  # Measured at the settled initial viewport, before scrolling or opening tools.
  for label,base in [('baseline_219c550',OLD),('upgraded',BASE)]:
   ctx=context();ctx.add_init_script("window.__audioContexts=0;const AC=window.AudioContext;window.AudioContext=new Proxy(AC,{construct(T,args){window.__audioContexts++;return new T(...args)}})")
   page=ctx.new_page();page.goto(base,wait_until='networkidle');expect(page.locator('#hero-title')).to_be_visible();page.wait_for_timeout(250)
   report['measurements'][label]=page.evaluate('''()=>{const r=performance.getEntriesByType('resource');const js=r.filter(e=>/\\.js(?:\\?|$)/.test(e.name));return {scriptRequests:js.length,scriptDecodedBytes:js.reduce((n,e)=>n+e.decodedBodySize,0),scriptTransferBytes:js.reduce((n,e)=>n+e.transferSize,0),audioContexts:window.__audioContexts,scriptNames:js.map(e=>e.name.split('/').pop()),mediaElements:document.querySelectorAll('audio,video').length,scenes:document.querySelectorAll('main > .scene').length}}''')
   if label=='upgraded':
    assert page.locator('#gallery.scene-pending').count()==1
    assert page.locator('#video.scene-pending').count()==1
    assert not any('GalleryScene-' in name or 'MusicPlayer-' in name or 'StarryLiveMode-' in name for name in report['measurements'][label]['scriptNames'])
   ctx.close()
  report['passed'].append('same-browser baseline and initial-view module measurements')
  ctx=context();page=ctx.new_page();page.on('pageerror',lambda e:report['injectedFaults' if fault['active'] else 'errors'].append(str(e)))
  page.goto(BASE+'#/#gallery',wait_until='networkidle');expect(page.locator('#gallery-title')).to_be_visible();assert page.locator('main > .scene').count()==5
  page.goto(BASE+'#/?image=quiet-guitar#gallery',wait_until='networkidle');expect(page.locator('.gallery-lightbox[open]')).to_be_visible()
  page.keyboard.press('Escape');expect(page.locator('.gallery-lightbox[open]')).to_have_count(0)
  # All anchors are reserved before a scene is imported. Direct video links open it.
  page.goto(BASE+'#/#video',wait_until='networkidle');expect(page.locator('#video-title')).to_be_visible();assert page.locator('.music-player').count()==0
  page.get_by_role('button',name='练习唱片',exact=True).click();expect(page.locator('.music-player')).to_be_visible()
  page.get_by_role('button',name='原曲导听',exact=True).click();page.get_by_role('button',name='练习唱片',exact=True).click();assert page.locator('.music-player').count()==1
  report['passed'].append('lazy anchor/direct gallery link/preview escape and music initialization once')
  # Static pages are validated with JavaScript disabled, as an ordinary crawler.
  static=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});p=static.new_page()
  for route,title in [('','一里小屋'),('featured/after-school-ticket/','放学之后'),('albums/before-the-show/','开演之前'),('notes/hitori-small-courage/','')]:
   # Actual note slug selected from the generated folder, rather than assuming a title.
   if route.startswith('notes/'):
    route='notes/'+next((Path(args.dist)/'notes').iterdir()).name+'/'
   response=p.goto(BASE+route,wait_until='networkidle');assert response.status==200,(route,response.status)
   assert p.locator('meta[property="og:title"]').get_attribute('content')
   image=p.locator('meta[property="og:image"]').get_attribute('content');assert image.startswith('https://hitori-gotou1.github.io/patrol-retest-demo/')
   if route:assert p.locator('main').inner_text().strip()
  p.goto(BASE+'featured/after-school-ticket/');p.screenshot(path=str(OUT/'public-share-mobile.png'),full_page=True);static.close()
  report['passed'].append('crawler-readable website/article/curated-work/album pages without JavaScript')
  # Navigation failures preserve local content and use an explicit refresh, no loop.
  page.goto(BASE,wait_until='networkidle');page.evaluate("localStorage.setItem('hitori:recovery-sentinel','saved draft')")
  denied={'active':True,'hits':0};fault['active']=True
  def fail_route(route):
   if denied['active']:denied['hits']+=1;route.abort()
   else:route.continue_()
  page.route('**/PhotoBooth-*.js',fail_route)
  page.evaluate("location.hash='#/room/photobooth'")
  expect(page.locator('.app-recovery')).to_be_visible();expect(page.locator('.app-recovery')).to_contain_text('刷新网站版本')
  page.wait_for_timeout(600);assert denied['hits']==1,denied
  assert page.evaluate("localStorage.getItem('hitori:recovery-sentinel')")=='saved draft'
  denied['active']=False
  page.get_by_role('button',name='刷新网站版本',exact=True).click();expect(page.locator('#photo-title')).to_be_visible();assert page.evaluate("localStorage.getItem('hitori:recovery-sentinel')")=='saved draft'
  fault['active']=False
  report['passed'].append('route-chunk network failure, no automatic refresh loop, explicit reload restores route and local data')
  ctx.close()
  # A search-module failure is contained in its dialog; current content remains usable.
  ctx=context();page=ctx.new_page();page.route('**/siteSearch-*.js',lambda route:route.abort())
  page.goto(BASE,wait_until='networkidle');page.get_by_role('button',name='打开全站搜索与设置',exact=True).click()
  expect(page.locator('.site-tools-dialog [role=alert]')).to_contain_text('搜索暂时没能载入')
  expect(page.locator('#hero-title')).to_be_visible();page.keyboard.press('Escape')
  expect(page.get_by_role('button',name='打开全站搜索与设置',exact=True)).to_be_focused();ctx.close()
  report['passed'].append('search-module failure stays local, preserves current page and keyboard focus')
  # Failure before Vue starts uses the real HTML fallback.
  ctx=context();page=ctx.new_page();page.route('**/assets/index-*.js',lambda route:route.abort())
  page.goto(BASE,wait_until='networkidle');expect(page.locator('#boot-retry')).to_be_visible();expect(page.locator('#boot-status')).to_have_attribute('data-state','error');ctx.close()
  report['passed'].append('entry script failure shows readable retry before application mount')
  # New full pages across narrow, broad phone, tablet and desktop.
  for width in [320,390,430,768,1440]:
   ctx=context(width);page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
   for route in ['#/collections','#/collections/before-the-show','#/settings/device','#/room/project','#/room/practice','#/room/companion']:
    page.goto(BASE+route,wait_until='networkidle');expect(page.locator('#main')).to_be_visible();page.wait_for_timeout(80)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route,page.evaluate('document.documentElement.scrollWidth'))
    report['layouts'].append([width,route])
    if width in [390,1440] and route in ['#/collections','#/settings/device']:
     page.screenshot(path=str(OUT/(route.split('/')[-1]+f'-{width}.png')),full_page=True)
   ctx.close()
  report['passed'].append('30 new-page viewport layout checks without document horizontal overflow')
  assert not report['errors'],report['errors']
  browser.close()
finally:
 server.shutdown();oldserver.shutdown();(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
