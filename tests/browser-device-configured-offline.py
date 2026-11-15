"""Configured frontend, real offline SW/cache flow with no downloaded Auth SDK.
Uses a production build with a valid-format isolated fixture URL/key; no backend success is mocked.
"""
import argparse,json,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];PREFIX='/patrol-retest-demo/'
parser=argparse.ArgumentParser();parser.add_argument('--dist',default='/tmp/hitori-device-configured');args=parser.parse_args();DIST=Path(args.dist).resolve()
OUT=ROOT/'evidence'/'device';OUT.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def do_GET(self):
  if not urlsplit(self.path).path.startswith(PREFIX):self.send_error(404);return
  self.path='/'+self.path[len(PREFIX):];self.directory=str(DIST)
  try:super().do_GET()
  except(BrokenPipeError,ConnectionResetError):pass
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}'+PREFIX
sdk_names=[file.name for file in (DIST/'assets').glob('*.js') if 'supabase-js' in file.read_text()]
assert sdk_names,'Configured verification requires a real Supabase SDK build chunk'
report={'passed':[],'errors':[],'backend':'none; configured fixture frontend; no mocked service success','sdkFiles':sdk_names}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce',service_workers='allow')
  ctx.route('**/*',lambda route:route.continue_() if route.request.url.startswith(BASE) else route.abort())
  page=ctx.new_page();requests=[];page.on('request',lambda request:requests.append(request.url));page.on('pageerror',lambda error:report['errors'].append(str(error)))
  # Start from the activity home, so opening online settings cannot warm the SDK cache.
  page.goto(BASE+'#/room/play',wait_until='networkidle');page.wait_for_function('navigator.serviceWorker.controller !== null')
  result=page.evaluate("""async()=>{const registration=await navigator.serviceWorker.ready,channel=new MessageChannel();return await new Promise((resolve,reject)=>{channel.port1.onmessage=event=>event.data.ok?resolve(event.data):reject(new Error(event.data.error));(navigator.serviceWorker.controller||registration.active).postMessage({type:'HITORI_CACHE_SELECTION',groups:['walk'],requestId:'configured-offline-check'},[channel.port2]);});}""")
  assert result['groups']==['walk']
  assert not any(any(name in url for name in sdk_names) for url in requests),'SDK must not have been visited before going offline'
  cached=page.evaluate("""async()=>{let urls=[];for(const name of await caches.keys())if(name.startsWith('hitori-offline-')&&name!=='hitori-offline-preferences'){const cache=await caches.open(name);urls.push(...(await cache.keys()).map(r=>r.url));}return urls;}""")
  assert not any(any(name in url for name in sdk_names) for url in cached)
  report['passed'].append('configured activity home/cache selection never downloads or caches optional Auth SDK')
  ctx.set_offline(True);page.goto(BASE+'?configured-offline=1#/settings/device',wait_until='domcontentloaded')
  expect(page.get_by_role('heading',name='设备、离线与同步')).to_be_visible()
  expect(page.locator('.offline-links a')).to_have_count(1)
  expect(page.locator('.device-login')).to_be_visible()
  expect(page.get_by_text('当前离线，本机和已下载玩法继续可用。联网后会重新准备同步连接。')).to_be_visible()
  assert page.locator('.app-recovery').count()==0
  assert not page.get_by_text('站主尚未配置同步服务。',exact=False).count()
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
  page.screenshot(path=str(OUT/'configured-offline-settings-mobile.png'),full_page=True)
  report['passed'].append('configured offline settings opens cache controls and login scope without SDK or recovery screen')
  with page.expect_request(lambda request:any(name in request.url for name in sdk_names),timeout=15000):ctx.set_offline(False)
  expect(page.get_by_role('heading',name='设备、离线与同步')).to_be_visible()
  expect(page.get_by_text('● 当前在线',exact=True)).to_be_visible()
  report['passed'].append('online event retries initialization and loads the real SDK after offline startup')
  assert not report['errors'],report['errors']
  browser.close()
finally:
 server.shutdown();(OUT/'configured-offline-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
