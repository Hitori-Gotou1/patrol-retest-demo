"""Opt-in read-only smoke test of the existing PUBLIC gallery configuration.
Only GET/HEAD/OPTIONS are allowed; there is no sign-in or production mutation.
"""
import json,os,threading,urllib.request
from functools import partial
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];PREFIX='/patrol-retest-demo/';OUT=ROOT/'evidence'/'production-read';OUT.mkdir(parents=True,exist_ok=True)
config=dict(line.split('=',1) for line in (ROOT/'.env.local').read_text().splitlines() if '=' in line)
project=config['VITE_SUPABASE_URL'];key=config['VITE_SUPABASE_PUBLISHABLE_KEY'];headers={'apikey':key}
if not key.startswith('sb_publishable_'):headers['Authorization']='Bearer '+key
with urllib.request.urlopen(urllib.request.Request(project+'/rest/v1/gallery_uploads?select=id&limit=1',headers=headers),timeout=20) as r:rows=json.loads(r.read())
class Handler(SimpleHTTPRequestHandler):
 def do_GET(self):
  if not urlsplit(self.path).path.startswith(PREFIX):self.send_error(404);return
  self.path='/'+self.path[len(PREFIX):]
  try:super().do_GET()
  except(BrokenPipeError,ConnectionResetError):pass
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start();BASE=f'http://127.0.0.1:{server.server_port}'+PREFIX
report={'mode':'real public Supabase GET only; no authentication or writes','passed':[],'pageErrors':[],'blockedWrites':[],'backendResponses':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
  def restrict(route):
   request=route.request
   if request.method not in ('GET','HEAD','OPTIONS'):report['blockedWrites'].append(request.method+' '+urlsplit(request.url).path);route.abort();return
   if request.url.startswith((BASE,project+'/')):route.continue_()
   else:route.abort()
  context.route('**/*',restrict);page=context.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
  page.on('response',lambda response:report['backendResponses'].append({'path':urlsplit(response.url).path,'status':response.status}) if response.url.startswith(project+'/rest/') else None)
  page.goto(BASE+'#/#gallery',wait_until='networkidle');expect(page.locator('#gallery-title')).to_be_visible();expect(page.locator('.gallery-cloud-error')).to_have_count(0)
  if rows:
   page.goto(BASE+'#/?image=cloud-'+rows[0]['id']+'#gallery',wait_until='networkidle');expect(page.locator('#lightbox[open]')).to_be_visible()
   page.wait_for_function("(()=>{const image=document.querySelector('#lightbox-image');return image&&image.complete&&image.naturalWidth>0})()",timeout=30000)
   page.wait_for_function("['ready','fallback'].includes(document.querySelector('#lightbox-image')?.dataset.state)",timeout=45000)
   page.screenshot(path=str(OUT/'existing-cloud-image-mobile.png'))
   report['passed'].append('real existing cloud image old-schema fallback, deep link, actual image decode')
   page.keyboard.press('Escape')
  for width in [390,1440]:
   page.set_viewport_size({'width':width,'height':900});page.goto(BASE+'#/room/play',wait_until='networkidle');expect(page.locator('.room-topic-grid a')).to_have_count(3);page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(OUT/f'discovery-{width}.png'),full_page=True)
  page.goto(BASE+'#/collections',wait_until='networkidle');expect(page.locator('.collection-card-grid>a')).to_have_count(2);expect(page.locator('.collections-error')).to_contain_text('云端合集暂时无法读取')
  report['passed'].append('real missing new collection schema shows honest recoverable status and confirmed static albums')
  page.goto(BASE+'#/manage-gallery',wait_until='networkidle');expect(page.get_by_role('heading',name='站主登录',exact=True)).to_be_visible();report['passed'].append('real configured management remains signed out; no fake login')
  page.goto(BASE+'#/settings/device',wait_until='networkidle');expect(page.get_by_role('button',name='登录同步账号',exact=True)).to_be_visible();report['passed'].append('same public backend reused for optional sync; no account sign-in attempted')
  assert not report['pageErrors'],report['pageErrors'];assert not report['blockedWrites'],report['blockedWrites']
  context.close();browser.close()
finally:
 server.shutdown();(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
