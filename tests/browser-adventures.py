"""End-to-end checks for the second six experiences and their companion integration."""
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

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=Path(os.environ.get('HITORI_ADVENTURES_OUTPUT','/tmp/adventures-qa'));OUTPUT.mkdir(parents=True,exist_ok=True)
REPORT={'results':[],'pageErrors':[],'missingAssets':[],'externalRequests':[]}
ROUTES=('play','maze','effects','companion','echo','escape','duet')
class Fixture:
    def __init__(self,browser,width=1440,blocked=False,late=False):
        self.context=browser.new_context(viewport={'width':width,'height':900 if width>800 else 844},has_touch=width<800,reduced_motion='reduce',accept_downloads=True)
        self.context.add_init_script("""(() => {
          window.__audioContexts=[];window.__sourceStarts=0;
          const Native=AudioContext;
          window.AudioContext=new Proxy(Native,{construct(Target,args){const c=new Target(...args);window.__audioContexts.push(c);return c;}});
          const create=Native.prototype.createBufferSource;
          Native.prototype.createBufferSource=function(...args){const source=create.apply(this,args),start=source.start.bind(source);source.start=(...params)=>{window.__sourceStarts++;return start(...params);};return source;};
        })();""")
        if blocked:self.context.add_init_script("Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError');};")
        if late:self.context.add_init_script("""(() => {window.__resumeGates=[];const native=AudioContext.prototype.resume;AudioContext.prototype.resume=async function(){await native.call(this);await new Promise(resolve=>window.__resumeGates.push(resolve));};})();""")
        self.context.route('**/*',self.route)
        self.page=self.context.new_page()
        self.page.on('pageerror',lambda e:REPORT['pageErrors'].append(str(e)))
        self.page.on('response',lambda r:REPORT['missingAssets'].append(r.url) if r.status>=400 and '/assets/' in r.url else None)
    def route(self,route):
        if urlsplit(route.request.url).netloc==urlsplit(BASE).netloc:route.continue_()
        else:REPORT['externalRequests'].append(route.request.url);route.abort()
    def goto(self,path):
        self.page.goto(BASE+'#/room/'+path,wait_until='networkidle')
        expect(self.page.locator('.room-page')).to_be_visible()
        heading={'play':'playroom-title','maze':'maze-title','effects':'effects-title','companion':'companion-title','echo':'echo-title','escape':'escape-title','duet':'duet-title','studio':'studio-title','photobooth':'photo-title'}[path]
        expect(self.page.locator('#'+heading)).to_be_visible()
    def close(self):self.context.close()

def download(page,button,name):
    with page.expect_download(timeout=20000) as pending:button.click()
    path=OUTPUT/name;pending.value.save_as(path);return path.read_bytes()

def test_maze(browser):
    f=Fixture(browser);p=f.page;f.goto('maze')
    for key in ['ArrowDown','ArrowDown','ArrowRight','ArrowRight']:p.keyboard.press(key)
    p.locator('#maze-hide').click();expect(p.locator('.maze-player-box')).to_have_count(1)
    p.locator('#maze-wait').click();p.locator('#maze-hide').click();expect(p.locator('.maze-player')).to_have_count(1)
    p.get_by_role('button',name='本关重新开始',exact=True).click()
    solutions=[['right','right','right','right','down','down','down','down','down','right','right','right','up','up','right','up','up','up'],['right','right','right','down','down','down','down','down','right','right','right','right','up','right','up','up','up','up'],['right','right','down','right','down','down','right','right','right','right','down','right','up','up','up','up']]
    for index,path in enumerate(solutions):
        for action in path:p.keyboard.press({'up':'ArrowUp','down':'ArrowDown','left':'ArrowLeft','right':'ArrowRight'}[action])
        expect(p.locator('.maze-board')).to_have_attribute('data-phase','won')
        if index<2:p.get_by_role('button',name='走向下一幕 →',exact=True).click()
    p.reload(wait_until='networkidle');expect(p.locator('.maze-board')).to_have_attribute('data-phase','won')
    p.locator('#buddy-launcher').click();expect(p.locator('.buddy-reply')).to_contain_text('抵达舞台')
    f.close()

def set_range(locator,value):locator.evaluate('(e,v)=>{e.value=String(v);e.dispatchEvent(new Event("input",{bubbles:true}));}',value)

def test_effects(browser):
    f=Fixture(browser);p=f.page;f.goto('effects')
    assert p.evaluate('window.__audioContexts.length')==0
    panel=p.locator('.room-panel').bounding_box();strings=p.locator('.tone-strings').bounding_box()
    assert strings['x']>=panel['x'] and strings['y']>=panel['y'] and strings['height']>200
    slider=p.locator('#tone-drive');slider.scroll_into_view_if_needed();bounds=slider.bounding_box()
    p.mouse.move(bounds['x']+8+(bounds['width']-16)*.3,bounds['y']+bounds['height']/2)
    p.mouse.down();p.mouse.move(bounds['x']+8+(bounds['width']-16)*.8,bounds['y']+bounds['height']/2,steps=8);p.mouse.up()
    assert float(slider.input_value())>.7,'pedal reordering must not capture a slider drag'
    set_range(slider,.3)
    p.locator('.effect-pedal[data-effect=drive] header').drag_to(p.locator('.effect-pedal[data-effect=delay] header'))
    assert p.locator('.effect-pedal').evaluate_all('(xs)=>xs.map(e=>e.dataset.effect)')==['delay','drive','reverb']
    p.get_by_role('button',name='把失真向前移动',exact=True).click()
    clean=download(p,p.locator('#tone-wav'),'clean-tone.wav')
    p.locator('.effect-pedal[data-effect=drive] .effect-bypass').click();set_range(p.locator('#tone-drive'),.8)
    p.get_by_role('button',name='把失真向后移动',exact=True).click()
    p.locator('#tone-name').fill('测试的舞台音色');p.locator('#tone-save').click()
    tone=p.evaluate("JSON.parse(localStorage.getItem('hitori-room:guitar-tone:v1'))")
    assert tone['drive']==.8 and tone['order']==['delay','drive','reverb']
    driven=download(p,p.locator('#tone-wav'),'driven-tone.wav')
    for data in [clean,driven]:
        assert data[:4]==b'RIFF' and data[8:12]==b'WAVE'
        assert struct.unpack('<I',data[24:28])[0]==22050
        samples=struct.unpack('<'+str((len(data)-44)//2)+'h',data[44:]);assert max(abs(s) for s in samples)>100
    assert clean!=driven
    assert max(abs(s) for s in struct.unpack('<100h',driven[-200:]))==0
    tone_input=p.get_by_label('选择音色 JSON 文件',exact=True)
    tone_input.set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"version":1}'})
    expect(p.locator('.room-status')).to_contain_text('有效的音色 JSON')
    tone_input.set_input_files({'name':'valid.json','mimeType':'application/json','buffer':json.dumps({**tone,'name':'导入的音色'}).encode()})
    expect(p.locator('#tone-name')).to_have_value('导入的音色')
    assert p.evaluate("JSON.parse(localStorage.getItem('hitori-room:guitar-tone:v1')).name")=='测试的舞台音色'
    p.locator('#effects-strum').click();p.wait_for_function('window.__sourceStarts>=6')
    p.get_by_role('button',name='关闭互动音效',exact=True).click()
    p.wait_for_function("window.__audioContexts.every(c=>c.state!=='running')")
    f.goto('studio');expect(p.locator('.studio-tone')).to_contain_text('测试的舞台音色')
    p.locator('#studio-use-tone').check();p.get_by_role('button',name='播放并开启音效',exact=True).click()
    expect(p.get_by_role('button',name='停止播放',exact=True)).to_be_visible()
    p.wait_for_function('window.__sourceStarts>6')
    p.get_by_role('button',name='关闭互动音效',exact=True).click()
    expect(p.get_by_role('button',name='播放并开启音效',exact=True)).to_be_visible()
    f.goto('play');p.wait_for_function("window.__audioContexts.at(-1).state==='closed'")
    f.close()

def test_companion(browser):
    f=Fixture(browser);p=f.page;f.goto('photobooth')
    p.locator('#photo-caption').fill('伙伴看见的合影')
    png=download(p,p.locator('#photo-export'),'companion-photo.png');assert png[:8]==b'\x89PNG\r\n\x1a\n'
    p.locator('#buddy-launcher').click();expect(p.locator('.buddy-reply')).to_contain_text('伙伴看见的合影')
    p.get_by_role('button',name='关闭伙伴面板',exact=True).click();f.goto('companion')
    expect(p.locator('.buddy-memories')).to_contain_text('伙伴看见的合影')
    p.get_by_role('button',name='山田凉',exact=True).click()
    p.get_by_label('在页面角落显示伙伴',exact=True).uncheck()
    expect(p.locator('#buddy-launcher')).to_have_count(0)
    p.locator('.buddy-gifts button').first.click()
    assert p.evaluate("JSON.parse(localStorage.getItem('hitori-room:companion:v1')).enabled") is False
    p.reload(wait_until='networkidle');expect(p.get_by_label('在页面角落显示伙伴',exact=True)).not_to_be_checked()
    expect(p.locator('.buddy-memories')).to_contain_text('伙伴看见的合影')
    p.get_by_label('在页面角落显示伙伴',exact=True).check();expect(p.locator('#buddy-launcher')).to_be_visible()
    p.get_by_label('收成小按钮',exact=True).check();expect(p.locator('.room-companion.is-compact')).to_have_count(1)
    before=p.evaluate("JSON.parse(localStorage.getItem('hitori-room:companion:v1')).memories.length")
    p.evaluate("window.dispatchEvent(new CustomEvent('hitori:activity',{detail:{id:'bad',kind:'constructor',detail:'bad',at:0}}))")
    assert p.evaluate("JSON.parse(localStorage.getItem('hitori-room:companion:v1')).memories.length")==before
    f.close()

def test_echo(browser):
    f=Fixture(browser);p=f.page;f.goto('echo')
    p.locator('#echo-listen').click();expect(p.locator('.echo-stage')).to_have_attribute('data-phase','input',timeout=12000)
    # Read the deterministic sequence from the saved seed, as a listener would reproduce it.
    data=p.evaluate("JSON.parse(localStorage.getItem('hitori-room:echo:v1'))")
    def shuffle(values,seed):
        out=list(values);state=seed&0xffffffff
        for i in range(len(out)-1,0,-1):
            state=(1664525*state+1013904223)&0xffffffff;j=state%(i+1);out[i],out[j]=out[j],out[i]
        return out
    sequence=[shuffle(range(6),data['seed']+i*7919)[0] for i in range(3)]
    for note in sequence:p.locator('.echo-keys button').nth(note).click()
    expect(p.locator('.echo-stage')).to_have_attribute('data-phase','result');expect(p.locator('.adventure-score')).to_have_text('100%')
    p.locator('#echo-compare').click();expect(p.locator('.echo-stage')).to_have_attribute('data-phase','compare')
    p.get_by_role('button',name='关闭互动音效',exact=True).click();expect(p.locator('.echo-stage')).to_have_attribute('data-phase','result')
    p.reload(wait_until='networkidle');expect(p.locator('.adventure-score')).to_have_text('100%')
    p.locator('#echo-next').click();expect(p.locator('.echo-slots>span')).to_have_count(4)
    f.close()

def test_escape(browser):
    f=Fixture(browser);p=f.page;f.goto('escape')
    def inspect(label):p.locator('.escape-places button').filter(has_text=label).click()
    inspect('票根');expect(p.locator('.escape-clue')).to_contain_text('蓝 1')
    inspect('储物箱');p.locator('#escape-pin').fill('1234');p.get_by_role('button',name='试着打开储物箱',exact=True).click();expect(p.locator('.room-status')).to_contain_text('没有对上')
    p.locator('#escape-pin').fill('2413');p.get_by_role('button',name='试着打开储物箱',exact=True).click();expect(p.locator('.escape-clue')).to_contain_text('一枚保险丝')
    inspect('配电');p.get_by_role('button',name='装入找到的保险丝',exact=True).click()
    inspect('接线');
    for i,color in enumerate(['pink','blue','yellow']):p.locator('.escape-clue select').nth(i).select_option(color)
    p.locator('#escape-wire').click();p.reload(wait_until='networkidle');inspect('接线')
    for i,color in enumerate(['pink','blue','yellow']):expect(p.locator('.escape-clue select').nth(i)).to_have_value(color)
    inspect('控制台')
    for index in [0,4,8]:p.locator(f'[data-light="{index}"]').click()
    inspect('舞台的门');p.locator('#escape-door').click();expect(p.locator('.adventure-result')).to_contain_text('灯亮了')
    png=download(p,p.get_by_role('button',name='保存开灯纪念卡 ↓',exact=True),'escape-card.png')
    assert struct.unpack('>II',png[16:24])==(1440,900)
    p.reload(wait_until='networkidle');expect(p.locator('.adventure-result')).to_contain_text('灯亮了')
    p.get_by_role('button',name='开始新的一夜',exact=True).click();expect(p.locator('.escape-places')).to_be_visible()
    p.get_by_role('button',name='撤销重置',exact=True).click();expect(p.locator('.adventure-result')).to_contain_text('灯亮了')
    f.close()

def test_duet(browser):
    f=Fixture(browser);p=f.page;f.goto('duet')
    p.locator('#duet-quiz').click()
    for choice in [0,1,2,3,0]:p.locator(f'.duet-options [data-choice="{choice}"]').click()
    expect(p.locator('.duet-cover')).to_contain_text('答案，先收进信封')
    assert p.locator('.duet-results').count()==0
    p.reload(wait_until='networkidle');p.locator('#duet-handoff').click()
    for choice in [0,1,2,3,0]:p.locator(f'.duet-options [data-choice="{choice}"]').click()
    expect(p.locator('.adventure-score')).to_have_text('5 / 5')
    p.get_by_role('button',name='再一起玩提示接力 →',exact=True).click()
    symbols={'✦':0,'○':1,'□':2,'△':3}
    for turn in range(3):
        code=[symbols[node.inner_text()] for node in p.locator('.relay-code strong').all()]
        assert len(code)==4+turn
        p.locator('#relay-cover').click();expect(p.locator('.relay-code')).to_have_count(0)
        for value in code:p.locator(f'.relay-buttons [data-symbol="{value}"]').click()
        p.locator('#relay-check').click();expect(p.locator('.adventure-result')).to_contain_text('这一串，接通了')
        p.locator('#relay-next').click()
    expect(p.locator('.adventure-result')).to_contain_text('三段提示，一起传到了最后')
    p.reload(wait_until='networkidle');expect(p.locator('.adventure-result')).to_contain_text('三段提示，一起传到了最后')
    f.close()

def test_layouts_lifecycle_storage(browser):
    for width in [1440,390,320]:
        f=Fixture(browser,width);p=f.page
        for route in ROUTES:
            f.goto(route);expect(p.locator('.room-nav [aria-current=page]')).to_have_count(1)
            assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),(route,width)
            if route=='effects':
                panel=p.locator('.room-panel').bounding_box();strings=p.locator('.tone-strings').bounding_box()
                assert strings['x']>=panel['x'] and strings['y']>=panel['y'] and strings['height']>200
            p.screenshot(path=str(OUTPUT/f'{route}-{width}.png'),full_page=width<800)
        if width==390:
            f.goto('maze');p.get_by_role('button',name='向右走',exact=True).tap();expect(p.locator('.maze-board')).to_have_attribute('data-position','2,1')
            p.locator('#buddy-launcher').tap();expect(p.locator('#buddy-dialog')).to_be_visible();assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
        f.close()
    f=Fixture(browser,blocked=True);p=f.page;f.goto('maze');p.get_by_role('button',name='向右走',exact=True).click()
    expect(p.locator('.play-footer-note')).to_contain_text('无法保存');f.close()
    f=Fixture(browser,late=True);p=f.page;f.goto('effects');p.locator('#effects-strum').click()
    p.wait_for_function('window.__resumeGates.length===2');f.goto('play')
    p.evaluate('window.__resumeGates.forEach(resolve=>resolve())');p.wait_for_timeout(150)
    assert p.evaluate('window.__sourceStarts')==0,'a late permission response cannot sound after navigation'
    assert p.evaluate("window.__audioContexts.at(-1).state")=="closed"
    f.close()

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self,path):
        if path.startswith('/patrol-retest-demo/'):path='/'+path[len('/patrol-retest-demo/'):]
        return super().translate_path(path)
    def log_message(self,*_args):pass

CASES=[('maze',test_maze),('effects',test_effects),('companion',test_companion),('echo',test_echo),('escape',test_escape),('duet',test_duet),('layouts_lifecycle_storage',test_layouts_lifecycle_storage)]
parser=argparse.ArgumentParser();parser.add_argument('--dist',type=Path,default=ROOT/'dist');parser.add_argument('--case',choices=[n for n,_ in CASES]);args=parser.parse_args()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(args.dist.resolve())))
threading.Thread(target=server.serve_forever,daemon=True).start();BASE=f'http://127.0.0.1:{server.server_port}/patrol-retest-demo/'
try:
    with sync_playwright() as playwright:
        executable=os.environ.get('HITORI_CHROMIUM_EXECUTABLE')
        browser=playwright.chromium.launch(**({'executable_path':executable} if executable else {}))
        for name,function in CASES:
            if args.case and args.case!=name:continue
            try:function(browser);REPORT['results'].append({'name':name,'result':'PASS'});print(name+': PASS',flush=True)
            except Exception as e:REPORT['results'].append({'name':name,'result':'FAIL','error':str(e),'trace':traceback.format_exc()});print(name+': FAIL '+str(e),flush=True)
            finally:
                for context in browser.contexts:context.close()
        browser.close()
finally:server.shutdown();server.server_close()
REPORT['result']='PASS' if REPORT['results'] and all(r['result']=='PASS' for r in REPORT['results']) and not any(REPORT[k] for k in ['pageErrors','missingAssets','externalRequests']) else 'FAIL'
(OUTPUT/'results.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print(json.dumps(REPORT,ensure_ascii=False,indent=2));raise SystemExit(0 if REPORT['result']=='PASS' else 1)
