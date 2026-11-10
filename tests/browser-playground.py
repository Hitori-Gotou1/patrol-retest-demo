"""Interaction and export checks for the ten playground additions; no external writes."""
import argparse,json,os,struct,threading,traceback
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import expect,sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=Path(os.environ.get('HITORI_PLAYGROUND_OUTPUT','/tmp/playground-qa'));OUTPUT.mkdir(parents=True,exist_ok=True)
REPORT={'results':[],'pageErrors':[],'missingAssets':[],'externalRequests':[]}
TITLES={**{r:r+'-title' for r in ['cards','jigsaw','shop','platform','lights','comic','mix','graffiti','relay','pinball']},'play':'playroom-title'}
class Fixture:
 def __init__(self,browser,width=1440,blocked=False,late=False):
  self.context=browser.new_context(viewport={'width':width,'height':900 if width>800 else 844},has_touch=width<800,reduced_motion='reduce',accept_downloads=True)
  self.context.add_init_script("""(()=>{window.__audioContexts=[];window.__sourceStarts=0;const Native=AudioContext;window.AudioContext=new Proxy(Native,{construct(T,args){const c=new T(...args);window.__audioContexts.push(c);return c;}});const create=Native.prototype.createBufferSource;Native.prototype.createBufferSource=function(...a){const s=create.apply(this,a),start=s.start.bind(s);s.start=(...p)=>{window.__sourceStarts++;return start(...p)};return s;};})();""")
  if blocked:self.context.add_init_script("Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError')}")
  if late:self.context.add_init_script("""(()=>{window.__resumeGates=[];const r=AudioContext.prototype.resume;AudioContext.prototype.resume=async function(){await r.call(this);await new Promise(resolve=>window.__resumeGates.push(resolve));};})();""")
  self.context.route('**/*',self.route);self.page=self.context.new_page();self.page.on('pageerror',lambda e:REPORT['pageErrors'].append(str(e)));self.page.on('response',lambda r:REPORT['missingAssets'].append(r.url) if r.status>=400 and '/assets/' in r.url else None)
 def route(self,route):
  if urlsplit(route.request.url).netloc==urlsplit(BASE).netloc:route.continue_()
  else:REPORT['externalRequests'].append(route.request.url);route.abort()
 def goto(self,path):
  self.page.goto(BASE+'#/room/'+path,wait_until='networkidle');expect(self.page.locator('#'+TITLES[path])).to_be_visible()
 def saved(self,name):
  self.page.wait_for_timeout(210);return self.page.evaluate('(key)=>JSON.parse(localStorage.getItem("hitori-room:"+key+":v1"))',name)
 def close(self):self.context.close()
def set_range(locator,value):locator.evaluate('(e,v)=>{e.value=String(v);e.dispatchEvent(new Event("input",{bubbles:true}))}',value)
def drag_range(p,locator,ratio):
 locator.scroll_into_view_if_needed();b=locator.bounding_box();p.mouse.move(b['x']+8,b['y']+b['height']/2);p.mouse.down();p.mouse.move(b['x']+8+(b['width']-16)*ratio,b['y']+b['height']/2,steps=8);p.mouse.up()
def download(p,button,name):
 with p.expect_download(timeout=25000) as pending:button.click()
 path=OUTPUT/name;pending.value.save_as(path);return path.read_bytes()
def png(data,dimensions):assert data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==dimensions

def cards_jigsaw(browser):
 f=Fixture(browser);p=f.page;f.goto('cards');p.locator('.card-hand button:not([disabled])').first.click();assert int(p.locator('#card-energy').inner_text().split('/')[0])<=3;p.locator('#card-end').click();data=f.saved('cards');assert data['battle']['turn']==2;p.reload(wait_until='networkidle');expect(p.locator('.room-stats')).to_contain_text('2 / 8')
 f.goto('jigsaw');expect(p.locator('.jigsaw-board')).to_be_visible();before=p.locator('[data-slot="0"]').get_attribute('data-tile');p.locator('[data-slot="0"]').drag_to(p.locator('[data-slot="1"]'));assert p.locator('[data-slot="1"]').get_attribute('data-tile')==before
 p.get_by_label('加入旋转挑战',exact=True).check();p.locator('[data-slot="0"]').click();p.get_by_role('button',name='旋转选中块 ↻',exact=True).click();assert f.saved('jigsaw')['puzzle']['moves']==1
 for _ in range(9):
  if p.locator('#jigsaw-hint').is_disabled():break
  p.locator('#jigsaw-hint').click()
 expect(p.locator('.jigsaw-board')).to_have_attribute('data-solved','true');assert f.saved('jigsaw')['best'];p.reload(wait_until='networkidle');expect(p.locator('.jigsaw-board')).to_have_attribute('data-solved','true');f.close()

def shop_platform_pinball(browser):
 f=Fixture(browser);p=f.page;f.goto('shop');p.locator('#shop-open').click()
 products={'guitar':'电吉他弦','bass':'贝斯弦','sticks':'鼓棒','pick':'拨片套装'};effects={'clean':'干净的拨弦','drive':'有力量的失真','delay':'带回声的音色'}
 for _ in range(3):
  text=p.locator('.shop-order h3').inner_text();p.locator('#shop-product').select_option(next(k for k,v in products.items() if v in text));p.locator('#shop-effect').select_option(next(k for k,v in effects.items() if v in text));drag_range(p,p.locator('#shop-tune'),.5);assert abs(float(p.locator('#shop-tune').input_value()))<=1;p.locator('#shop-deliver').click()
 expect(p.locator('.pg-result')).to_contain_text('休息中');assert f.saved('shop')['coins']==225;p.get_by_role('button',name='150 枚店币 · 添置',exact=True).click();assert f.saved('shop')['decorations']==['plant'];p.reload(wait_until='networkidle');expect(p.locator('#shop-coins')).to_have_text('75')
 f.goto('platform');p.locator('#platform-start').click();player=p.locator('#jump-player');x=float(player.get_attribute('data-x'));board=p.locator('.platform-board');board.click(position={'x':30,'y':30});p.keyboard.down('ArrowRight');p.wait_for_timeout(250);p.keyboard.up('ArrowRight');assert float(player.get_attribute('data-x'))>x+35
 jump=p.locator('[data-control=jump]');jump.scroll_into_view_if_needed();b=jump.bounding_box();p.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);p.mouse.down();p.wait_for_timeout(320);p.mouse.up();p.wait_for_timeout(180);assert float(player.get_attribute('data-y'))<330
 p.get_by_role('button',name='暂停',exact=True).click();paused=f.saved('platform')['round'];p.wait_for_timeout(200);assert float(player.get_attribute('data-x'))==paused['x'];p.reload(wait_until='networkidle');expect(p.locator('#platform-start')).to_be_enabled()
 f.goto('pinball');launch=p.locator('[data-control=launch]');launch.scroll_into_view_if_needed();b=launch.bounding_box();p.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);p.mouse.down();p.wait_for_timeout(400);p.mouse.up();expect(p.locator('#pinball-ball')).to_have_attribute('data-phase','playing');p.wait_for_timeout(200);assert float(p.locator('#pinball-ball').get_attribute('cy'))<735
 left=p.locator('[data-control=left]');left.scroll_into_view_if_needed();b=left.bounding_box();before=float(p.locator('[data-flipper=left]').get_attribute('y2'));p.mouse.move(b['x']+10,b['y']+10);p.mouse.down();p.wait_for_timeout(120);assert float(p.locator('[data-flipper=left]').get_attribute('y2'))<before-30;p.mouse.up();p.get_by_role('button',name='暂停',exact=True).click();expect(p.locator('#pinball-resume')).to_be_visible();assert f.saved('pinball')['round']['phase']=='paused';p.reload(wait_until='networkidle');p.locator('#pinball-resume').click();expect(p.locator('#pinball-ball')).to_have_attribute('data-phase','playing');f.close()

def lights_comic_graffiti(browser):
 f=Fixture(browser);p=f.page;f.goto('graffiti');canvas=p.locator('canvas');canvas.scroll_into_view_if_needed();b=canvas.bounding_box();p.mouse.move(b['x']+b['width']*.25,b['y']+b['height']*.5);p.mouse.down();p.mouse.move(b['x']+b['width']*.6,b['y']+b['height']*.5,steps=15);p.mouse.up();data=f.saved('graffiti');assert len(data['layers'][1]['strokes'])==1 and len(data['layers'][1]['strokes'][0]['points'])>5
 pixels=canvas.evaluate('e=>Array.from(e.getContext("2d").getImageData(e.width*.4,e.height*.5,1,1).data)');assert pixels[:3]==[167,94,131],pixels
 p.locator('#graffiti-undo').click();assert len(f.saved('graffiti')['layers'][1]['strokes'])==0;p.get_by_role('button',name='重做',exact=True).click();assert len(f.saved('graffiti')['layers'][1]['strokes'])==1
 png(download(p,p.locator('#graffiti-export'),'graffiti.png'),(900,600));p.locator('#graffiti-backdrop').click();assert p.evaluate("localStorage.getItem('hitori-room:stage-background:v1').startsWith('data:image/jpeg')")
 f.goto('lights');p.get_by_label('使用涂鸦墙保存的背景',exact=True).check();drag_range(p,p.locator('#light-position'),.8);assert float(p.locator('#light-position').input_value())>650
 light=json.loads(download(p,p.get_by_role('button',name='导出编排 JSON',exact=True),'lights.json'));assert len(light['cues'])==3 and light['background'];png(download(p,p.locator('#lights-png'),'lights.png'),(1350,780))
 p.locator('#lights-play').click();p.wait_for_timeout(240);expect(p.locator('.light-playing')).to_have_count(3);p.get_by_role('button',name='停止',exact=True).click();expect(p.locator('.light-playing')).to_have_count(0)
 p.locator('input[type=file]').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{}'});expect(p.locator('.pg-status')).to_contain_text('三束灯光')
 f.goto('comic');character=p.locator('.comic-character').first;character.scroll_into_view_if_needed();b=character.bounding_box();p.mouse.move(b['x']+b['width']*.5,b['y']+b['height']*.6);p.mouse.down();p.mouse.move(b['x']+b['width']*.5+30,b['y']+b['height']*.6+10,steps=10);p.mouse.up();data=f.saved('comic');assert data['panels'][0]['objects'][0]['x']>210,data['panels'][0]['objects'][0]
 p.get_by_label('标题',exact=True).fill('四格导出验证');p.get_by_label('对白',exact=False).fill('我们一起从第一拍开始。');png(download(p,p.locator('#comic-export'),'comic.png'),(1260,870));p.locator('#comic-layout').select_option('vertical');png(download(p,p.locator('#comic-export'),'comic-vertical.png'),(640,1670));p.reload(wait_until='networkidle');expect(p.get_by_label('标题',exact=True)).to_have_value('四格导出验证');f.close()

def mix_relay(browser):
 f=Fixture(browser);p=f.page;f.goto('mix');assert p.evaluate('window.__sourceStarts')==0;drag_range(p,p.locator('[data-mix-volume="0"]'),.8);assert float(p.locator('[data-mix-volume="0"]').input_value())>.7
 for i,value in enumerate([.55,.65,.6,.4]):set_range(p.locator('[data-mix-volume]').nth(i),value)
 p.locator('#mix-check').click();expect(p.locator('.pg-score')).to_have_text('100 / 100');before=f.saved('mix')['channels'];p.locator('#mix-reference').click();expect(p.locator('[data-mix-volume]').first).to_be_disabled();assert f.saved('mix')['channels']==before;p.locator('#mix-reference').click()
 wav=download(p,p.locator('#mix-export'),'mix.wav');assert wav[:4]==b'RIFF' and struct.unpack('<H',wav[22:24])[0]==2 and struct.unpack('<I',wav[24:28])[0]==22050;samples=struct.unpack('<'+str((len(wav)-44)//2)+'h',wav[44:]);assert max(abs(v) for v in samples)>100;assert any(samples[i]!=samples[i+1] for i in range(0,len(samples),2))
 p.locator('#mix-play').click();p.wait_for_function('window.__sourceStarts>=4');p.get_by_role('button',name='关闭互动音效',exact=True).click();p.wait_for_function("window.__audioContexts.every(c=>c.state!=='running')");p.locator('#mix-play').click();p.wait_for_function('window.__sourceStarts>=8');f.goto('relay');p.wait_for_function("window.__audioContexts.at(-1).state==='closed'")
 p.get_by_role('button',name='本机练习',exact=True).click()
 for i in range(6):
  p.locator('textarea').fill(f'第 {i+1} 位写下的一句。');p.locator('#relay-practice').click()
  if i<5:expect(p.locator('.relay-complete')).to_have_count(0)
 expect(p.locator('.relay-complete li')).to_have_count(6);p.reload(wait_until='networkidle');p.get_by_role('button',name='本机练习',exact=True).click();expect(p.locator('.relay-complete li')).to_have_count(6)
 p.get_by_role('button',name='公开接龙 · 站主审核',exact=True).click();p.locator('textarea').fill('这一句等待审核后才会出现。');expect(p.locator('#relay-submit')).to_have_count(0);p.get_by_label('我知道内容会公开，且需要站主审核。',exact=True).check();expect(p.locator('#relay-submit')).to_be_visible();query=parse_qs(urlsplit(p.locator('#relay-submit').get_attribute('href')).query);assert query['labels']==['hitori-relay'] and '"parentIssue": 0' in query['body'][0];f.close()

def layouts_lifecycle(browser):
 for width in [1440,390,320]:
  f=Fixture(browser,width);p=f.page
  for route in TITLES:
   f.goto(route);expect(p.locator('.room-nav [aria-current=page]')).to_have_count(1);assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),(route,width);p.screenshot(path=str(OUTPUT/f'{route}-{width}.png'),full_page=width<800)
  p.get_by_role('button',name='全部 · 22',exact=True).click();expect(p.locator('.play-card')).to_have_count(22)
  if width==390:
   f.goto('graffiti');canvas=p.locator('canvas');canvas.scroll_into_view_if_needed();b=canvas.bounding_box();x=b['x']+b['width']*.3;y=b['y']+b['height']*.5;cdp=f.context.new_cdp_session(p);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+45,'y':y+20}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert len(f.saved('graffiti')['layers'][1]['strokes'])==1
   f.goto('platform');p.locator('#platform-start').tap();p.locator('[data-control=jump]').tap();p.wait_for_timeout(180);assert float(p.locator('#jump-player').get_attribute('data-y'))<360
  f.close()
 f=Fixture(browser,blocked=True);p=f.page;f.goto('cards');p.locator('#card-end').click();p.wait_for_timeout(200);expect(p.locator('.pg-small').last).to_contain_text('无法保存');f.close()
 f=Fixture(browser,late=True);p=f.page;f.goto('mix');p.locator('#mix-play').click();p.wait_for_function('window.__resumeGates.length>=1');f.goto('play');p.evaluate('window.__resumeGates.forEach(r=>r())');p.wait_for_timeout(150);assert p.evaluate('window.__sourceStarts')==0;f.close()
 f=Fixture(browser);p=f.page;f.context.route('**/community/relay-stories.json*',lambda r:r.fulfill(status=503,body='offline'));f.goto('relay');expect(p.locator('.pg-status')).to_contain_text('暂时无法读取');expect(p.locator('#relay-submit')).to_have_count(0);f.close()

class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  if path.startswith('/patrol-retest-demo/'):path='/'+path[len('/patrol-retest-demo/'):]
  return super().translate_path(path)
 def log_message(self,*_args):pass
CASES=[('cards_jigsaw',cards_jigsaw),('shop_platform_pinball',shop_platform_pinball),('lights_comic_graffiti',lights_comic_graffiti),('mix_relay',mix_relay),('layouts_lifecycle',layouts_lifecycle)]
parser=argparse.ArgumentParser();parser.add_argument('--dist',type=Path,default=ROOT/'dist');parser.add_argument('--case',choices=[n for n,_ in CASES]);args=parser.parse_args();server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(args.dist.resolve())));threading.Thread(target=server.serve_forever,daemon=True).start();BASE=f'http://127.0.0.1:{server.server_port}/patrol-retest-demo/'
try:
 with sync_playwright() as playwright:
  executable=os.environ.get('HITORI_CHROMIUM_EXECUTABLE');browser=playwright.chromium.launch(**({'executable_path':executable} if executable else {}))
  for name,function in CASES:
   if args.case and args.case!=name:continue
   try:function(browser);REPORT['results'].append({'name':name,'result':'PASS'});print(name+': PASS',flush=True)
   except Exception as e:REPORT['results'].append({'name':name,'result':'FAIL','error':str(e),'trace':traceback.format_exc()});print(name+': FAIL '+traceback.format_exc(),flush=True)
   finally:
    for context in browser.contexts:context.close()
  browser.close()
finally:server.shutdown();server.server_close()
REPORT['result']='PASS' if REPORT['results'] and all(r['result']=='PASS' for r in REPORT['results']) and not any(REPORT[k] for k in ['pageErrors','missingAssets','externalRequests']) else 'FAIL';(OUTPUT/'results.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2));print(json.dumps(REPORT,ensure_ascii=False,indent=2));raise SystemExit(0 if REPORT['result']=='PASS' else 1)
