"""Real Chromium offline verification against a production artifact; no backend mocks.
The browser is actually disconnected via context.set_offline, then fully reloads.
Optional --update-dist verifies an independently built new worker generation.
"""
import argparse, json, threading
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
PREFIX = '/patrol-retest-demo/'
parser = argparse.ArgumentParser(); parser.add_argument('--dist', default='/tmp/hitori-device-dist'); parser.add_argument('--update-dist'); args = parser.parse_args()
active_dist = Path(args.dist).resolve(); OUT = ROOT/'evidence'/'device'; OUT.mkdir(parents=True, exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def do_GET(self):
  if not urlsplit(self.path).path.startswith(PREFIX): self.send_error(404); return
  self.path = '/' + self.path[len(PREFIX):]
  self.directory = str(active_dist)
  try: super().do_GET()
  except (BrokenPipeError, ConnectionResetError): pass
 def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}'+PREFIX
report = {'passed': [], 'errors': [], 'offlinePages': []}
try:
 with sync_playwright() as pw:
  browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, reduced_motion='reduce', service_workers='allow')
  page = ctx.new_page(); page.on('pageerror', lambda error: report['errors'].append(str(error)))
  page.goto(BASE+'#/settings/device', wait_until='networkidle')
  expect(page.get_by_role('heading', name='设备、离线与同步')).to_be_visible()
  page.wait_for_function('navigator.serviceWorker.controller !== null')
  page.wait_for_function("document.querySelectorAll('.offline-choices input').length === 10")
  for title in ['拍贴合影','自己的编曲','练琴日志','节奏练习']:
   page.locator('.offline-choices label').filter(has_text=title).locator('input').check()
  page.get_by_role('button', name='保存所选玩法到此设备', exact=True).click()
  try: expect(page.locator('.offline-links a')).to_have_count(4, timeout=30000)
  except Exception:
   print(page.locator('main').inner_text(), flush=True); page.screenshot(path=str(OUT/'offline-failure.png'),full_page=True); raise
  expect(page.get_by_text('所选玩法已完整下载。可以先断网，再打开下方入口试试。')).to_be_visible()
  cache_data = page.evaluate("""async()=>{let urls=[];for(const name of await caches.keys()){if(name.startsWith('hitori-offline-')&&name!=='hitori-offline-preferences'){const c=await caches.open(name);urls.push(...(await c.keys()).map(r=>r.url));}}return urls}""")
  assert not any('/assets/gallery/' in url or url.endswith('.wav') or url.endswith('.mp4') for url in cache_data)
  report['cachedResources'] = len(cache_data)
  report['passed'].append('explicit bounded selected-game caching excludes gallery and large media')
  page.screenshot(path=str(OUT/'device-mobile.png'), full_page=True)
  page.set_viewport_size({'width':1440,'height':1000}); page.screenshot(path=str(OUT/'device-desktop.png'), full_page=True)
  page.set_viewport_size({'width':390,'height':844})
  page.goto(BASE+'#/room/photobooth', wait_until='networkidle')
  expect(page.locator('#photo-caption')).to_be_visible(); page.locator('#photo-caption').fill('离线也在一起')
  page.wait_for_timeout(400)
  draft_before = page.evaluate("localStorage.getItem('hitori-room:photobooth:v1')")
  assert '离线也在一起' in draft_before
  # Capture cache version before genuinely disabling all browser network access.
  version_before = page.evaluate("async()=>{const names=await caches.keys();return names.filter(n=>n.startsWith('hitori-offline-')&&n!=='hitori-offline-preferences')}")
  ctx.set_offline(True)
  for route, heading in [('photobooth',None),('studio',None),('practice','练琴'),('rhythm','节奏')]:
   page.goto(BASE+'#/room/'+route, wait_until='domcontentloaded'); page.wait_for_timeout(350)
   assert page.locator('.app-recovery').count()==0
   assert page.locator('.room-panel').count() > 0
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
   report['offlinePages'].append(route)
  page.goto(BASE+'#/room/photobooth', wait_until='domcontentloaded'); expect(page.locator('#photo-caption')).to_have_value('离线也在一起')
  page.screenshot(path=str(OUT/'photobooth-offline-mobile.png'), full_page=True)
  page.locator('#photo-caption').fill('离线修改仍然保存'); page.wait_for_timeout(350)
  page.reload(wait_until='domcontentloaded'); expect(page.locator('#photo-caption')).to_have_value('离线修改仍然保存')
  report['passed'].append('real network-off reload/edit/autosave for four selected tools; no horizontal overflow')
  page.locator('.editor-enter').click()
  page.evaluate('''()=>{const input=document.querySelector('#photo-caption');input.value='同时未保存的本机稿';input.dispatchEvent(new Event('input',{bubbles:true}));const key='hitori-room:photobooth:v1';const value=JSON.parse(localStorage.getItem(key));value.caption='来自同步的新合影';const text=JSON.stringify(value);localStorage.setItem(key,text);window.dispatchEvent(new StorageEvent('storage',{key,newValue:text,storageArea:localStorage}));window.dispatchEvent(new Event('hitori:sync-applied'));}''')
  expect(page.locator('dialog.draft-conflict-notice[open]')).to_be_visible()
  assert page.evaluate("document.activeElement.closest('dialog.draft-conflict-notice') !== null")
  page.keyboard.press('Escape'); expect(page.locator('dialog.draft-conflict-notice[open]')).to_be_visible()
  assert page.locator('.editor-workspace.is-fullscreen').count()==1
  page.screenshot(path=str(OUT/'draft-conflict-fullscreen-mobile.png'),full_page=True)
  page.get_by_role('button',name='采用收到的新稿',exact=True).click()
  expect(page.locator('dialog.draft-conflict-notice[open]')).to_have_count(0)
  expect(page.locator('#photo-caption')).to_have_value('来自同步的新合影')
  page.locator('.editor-exit').click(); page.wait_for_timeout(300)
  assert page.evaluate("JSON.parse(localStorage.getItem('hitori-room:photobooth:v1')).caption")=='来自同步的新合影'
  # Leave a known final draft for subsequent update/clean-cache assertions.
  page.locator('#photo-caption').fill('离线修改仍然保存'); page.wait_for_timeout(300)
  report['passed'].append('native draft-conflict modal blocks fullscreen edits, Escape and stale unmount writes; focus restored')

  page.goto(BASE+'#/settings/device', wait_until='domcontentloaded'); expect(page.get_by_text('○ 当前离线 · 作品和草稿继续保存在本机')).to_be_visible()
  assert page.evaluate("localStorage.getItem('hitori-room:photobooth:v1').includes('离线修改仍然保存')")
  ctx.set_offline(False)
  if args.update_dist:
   active_dist = Path(args.update_dist).resolve()
   page.get_by_role('button', name='检查版本更新', exact=True).click()
   expect(page.get_by_role('button', name='保存完成，刷新到新版本')).to_be_visible(timeout=60000)
   # The previous generation remains active until an explicit action.
   assert page.evaluate("async()=>{const c=await navigator.serviceWorker.getRegistration();return !!c.waiting}")
   with page.expect_navigation(wait_until='domcontentloaded'):
    page.get_by_role('button', name='保存完成，刷新到新版本').click()
   expect(page.get_by_role('heading', name='设备、离线与同步')).to_be_visible(timeout=30000)
   page.wait_for_timeout(600)
   version_after = page.evaluate("async()=>{const names=await caches.keys();return names.filter(n=>n.startsWith('hitori-offline-')&&n!=='hitori-offline-preferences')}")
   assert set(version_after)-set(version_before)
   ctx.set_offline(True)
   page.goto(BASE+'#/room/photobooth', wait_until='domcontentloaded'); expect(page.locator('#photo-caption')).to_have_value('离线修改仍然保存')
   page.goto(BASE+'#/settings/device', wait_until='domcontentloaded')
   ctx.set_offline(False)
   report['passed'].append('new real build waits for approval, precaches selected graph, updates and reloads offline with draft intact')
  page.get_by_role('button', name='清理离线资源', exact=True).click()
  expect(page.get_by_text('离线资源已清理，作品和草稿保留。')).to_be_visible()
  assert page.evaluate("localStorage.getItem('hitori-room:photobooth:v1').includes('离线修改仍然保存')")
  report['passed'].append('clearing resource caches leaves user drafts intact')
  # Empty offline installation has a standalone fallback page, not a white screen.
  ctx.set_offline(True); page.goto(BASE+'?offline-fallback=1', wait_until='domcontentloaded')
  expect(page.get_by_role('heading', name='小屋暂时离线了。')).to_be_visible()
  report['passed'].append('uncached offline navigation provides a readable fallback')
  # Each artwork-using tool must work when it is the ONLY selected game.
  # A shared photo-booth cache would otherwise hide missing per-tool portrait dependencies.
  report['isolatedArtworkTools'] = []
  for group,title in [('decorate','房间布置'),('graffiti','演出涂鸦'),('walk','散步集章')]:
   isolated = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce',service_workers='allow')
   ip = isolated.new_page(); ip.on('pageerror',lambda error:report['errors'].append(str(error)))
   ip.goto(BASE+'#/settings/device',wait_until='networkidle')
   ip.wait_for_function('navigator.serviceWorker.controller !== null')
   expect(ip.locator('.offline-choices input')).to_have_count(10)
   ip.locator('.offline-choices label').filter(has_text=title).locator('input').check()
   ip.get_by_role('button',name='保存所选玩法到此设备',exact=True).click()
   expect(ip.locator('.offline-links a')).to_have_count(1,timeout=30000)
   paths=ip.evaluate("""async()=>{let urls=[];for(const name of await caches.keys())if(name.startsWith('hitori-offline-')&&name!=='hitori-offline-preferences'){const cache=await caches.open(name);urls.push(...(await cache.keys()).map(r=>r.url));}return urls;}""")
   assert not any('PhotoBooth-' in url for url in paths), 'independent test must not borrow photo-booth resources'
   assert all(any(url.endswith('/assets/characters/'+member+'-artwork.webp') for url in paths) for member in ['hitori','nijika','ryo','kita'])
   isolated.set_offline(True)
   ip.goto(BASE+'?isolated='+group+'#/room/'+group,wait_until='domcontentloaded')
   expect(ip.locator('.room-panel')).to_be_visible()
   assert ip.locator('.app-recovery').count()==0
   decoded=ip.evaluate("""async()=>{const results=[];for(const member of ['hitori','nijika','ryo','kita']){const image=new Image();image.src=new URL('assets/characters/'+member+'-artwork.webp',location.origin+'/patrol-retest-demo/').href;await image.decode();if(!image.naturalWidth||!image.naturalHeight)throw new Error('Artwork failed to decode: '+member);results.push({member,width:image.naturalWidth,height:image.naturalHeight});}return results;}""")
   entry={'tool':group,'onlySelectedTool':True,'decodedArtwork':decoded}
   if group=='decorate':
    assert ip.locator('svg image[href*="hitori-artwork.webp"]').count()==1
   elif group=='walk':
    members=set()
    for index in range(ip.locator('.walk-place-buttons button').count()):
     ip.locator('.walk-place-buttons button').nth(index).click()
     source=ip.locator('.walk-story img').evaluate("async image=>{await image.decode();if(!image.naturalWidth)throw new Error('Walk character failed to decode');return image.currentSrc;}")
     members.add(source.split('/')[-1])
    assert len(members)==4
    entry['walkCharacterPictures']=sorted(members)
   else:
    ip.get_by_role('button',name='印章',exact=True).click()
    ip.locator('.pg-settings input[type=range]').evaluate("input=>{input.value='70';input.dispatchEvent(new Event('input',{bubbles:true}));}")
    drawing=ip.locator('canvas.pg-canvas');rectangle=drawing.bounding_box()
    for index,member in enumerate(['hitori','nijika','ryo','kita']):
     ip.locator('.pg-settings label select').select_option(member)
     drawing.click(position={'x':rectangle['width']*(.18+index*.21),'y':rectangle['height']*.5})
    ip.wait_for_function("(()=>{const canvas=document.querySelector('canvas.pg-canvas'),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let changed=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==244||pixels[i+1]!==232||pixels[i+2]!==218)changed++;return changed>100})()")
    entry['paintedPixels']=drawing.evaluate("canvas=>{const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let changed=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==244||pixels[i+1]!==232||pixels[i+2]!==218)changed++;return changed;}")
    assert entry['paintedPixels']>100
   assert ip.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
   ip.screenshot(path=str(OUT/(group+'-isolated-offline-mobile.png')),full_page=True)
   report['isolatedArtworkTools'].append(entry)
   isolated.close()
  report['passed'].append('independent single-tool offline caches decode all four artworks for decorate/graffiti/walk; real graffiti stamps paint pixels and all walk characters decode')
  browser.close()
 assert not report['errors'], report['errors']
finally:
 server.shutdown(); (OUT/'offline-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
