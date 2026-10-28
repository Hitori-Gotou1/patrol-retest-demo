"""真实浏览器回归。默认连接已启动的 Vite 服务；输出 JSON 及截图到 /tmp。
安装：python -m pip install playwright && python -m playwright install chromium
运行：HITORI_QA_URL=http://127.0.0.1:4173/patrol-retest-demo/ python tests/browser-v3.py
可选 HITORI_QA_CASE 只运行一个测试组，HITORI_CHROMIUM 指定浏览器路径。
"""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json, os, traceback

BASE = os.environ.get('HITORI_QA_URL', 'http://127.0.0.1:5173/patrol-retest-demo/')
OUTPUT = Path(os.environ.get('HITORI_QA_OUTPUT', '/tmp/hitori-v3-qa'))
OUTPUT.mkdir(parents=True, exist_ok=True)
OUT = OUTPUT / 'results.json'
REPORT = {'results': [], 'errors': [], 'httpErrors': []}
COLORS = {'hitori': 'rgb(244, 143, 177)', 'nijika':'rgb(246, 201, 69)', 'ryo':'rgb(118, 185, 232)', 'kita':'rgb(233, 102, 112)'}
DIMENSIONS = {'hitori':[977,1610], 'nijika':[1038,3000], 'ryo':[1040,3000], 'kita':[1130,3000]}
AUDIO_SPY = '''(() => {
  const Original = window.AudioContext || window.webkitAudioContext;
  const contexts=[], sources=new Map(); let starts=0, nextId=0;
  window.__audioQA = () => ({contexts:contexts.length, starts, active:[...sources.values()].filter(s=>!s.ended).length, states:contexts.map(c=>c.state)});
  if (!Original) return;
  const Replacement = new Proxy(Original, {construct(target,args) {
    const ctx = new target(...args); contexts.push(ctx);
    for (const method of ['createBufferSource', 'createOscillator']) {
      const original = ctx[method].bind(ctx);
      ctx[method] = (...args) => {
        const node=original(...args), id=++nextId;
        const record={ended:true}; sources.set(id,record);
        const start=node.start.bind(node), stop=node.stop.bind(node);
        node.start=(...args)=>{starts++;record.ended=false;return start(...args)};
        node.stop=(...args)=>{const r=stop(...args);if(!args.length||args[0]<=ctx.currentTime)record.ended=true;return r};
        node.addEventListener('ended',()=>record.ended=true);
        return node;
      };
    }
    return ctx;
  }});
  window.AudioContext=Replacement;
  if(window.webkitAudioContext) window.webkitAudioContext=Replacement;
})();'''

def page_for(browser, width=1440, height=900, reduced=False):
    page=browser.new_page(viewport={'width':width,'height':height}, reduced_motion='reduce' if reduced else 'no-preference', has_touch=width<900)
    page.add_init_script(AUDIO_SPY)
    page.on('pageerror',lambda e: REPORT['errors'].append(str(e)))
    page.on('response',lambda r: REPORT['httpErrors'].append(f'{r.status} {r.url}') if r.status>=400 else None)
    page.goto(BASE+'#/#about',wait_until='networkidle')
    page.wait_for_timeout(800 if not reduced else 100)
    return page

def choose(page, member):
    page.locator('#tab-'+member).click()
    expect(page.locator('#about')).to_have_attribute('data-member',member,timeout=6000)
    expect(page.locator('#about')).to_have_attribute('data-transitioning','false',timeout=6000)
    expect(page.locator('.cast-portrait-image')).to_have_count(1)
    assert page.locator('.cast-background-base').evaluate('(e)=>getComputedStyle(e).backgroundColor')==COLORS[member]
    assert page.locator('.cast-portrait-image').evaluate('(i)=>i.decode().then(()=>[i.naturalWidth,i.naturalHeight])')==DIMENSIONS[member]

def egg_state(page):
    return page.locator('.character-easter-egg').get_attribute('data-state')

def box(page):
    choose(page,'hitori')
    trigger=page.locator('.cast-portrait-trigger')
    page.locator('.cast-art').scroll_into_view_if_needed()
    for _ in range(5):
        trigger.click(force=True)
        page.wait_for_timeout(240)
    expect(page.locator('#character-box')).to_be_visible(timeout=4000)
    expect(page.locator('.character-easter-egg')).to_have_attribute('data-state','boxed',timeout=4000)

def unhidden_portrait(page):
    assert page.locator('.cast-portrait-image').evaluate('''e=>{for(let p=e;p&&!p.classList.contains('cast-art');p=p.parentElement){const s=getComputedStyle(p);if(+s.opacity<.95||s.visibility==='hidden'||s.display==='none')return false}return true}''')

def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')

def open_instrument(page):
    toggle=page.locator('.instrument-toggle')
    if toggle.get_attribute('aria-expanded')!='true': toggle.click()
    expect(toggle).to_have_attribute('aria-expanded','true')
    expect(page.locator('.instrument-pad').first).to_be_visible()

def open_stage(page, skip=True):
    page.locator('#enter-starry').click()
    expect(page.locator('#starry-live-dialog')).to_be_visible()
    if skip and page.locator('#starry-skip').is_visible(): page.locator('#starry-skip').click()
    if skip: expect(page.locator('#starry-live-dialog')).to_have_attribute('data-phase','ready',timeout=6000)

def close_stage(page):
    page.locator('#starry-exit').click()
    expect(page.locator('#starry-live-dialog')).to_have_count(0)
    assert page.evaluate('document.body.style.overflow')!='hidden'

def test_transitions(browser):
    page=page_for(browser)
    for member in ['nijika','ryo','kita','hitori']: choose(page,member)
    page.evaluate("['ryo','hitori','nijika','kita'].forEach(id=>document.querySelector('#tab-'+id).click())")
    expect(page.locator('#about')).to_have_attribute('data-member','kita',timeout=7000)
    expect(page.locator('#about')).to_have_attribute('data-transitioning','false',timeout=7000)
    choose(page,'hitori')
    page.locator('#tab-ryo').click()
    page.locator('.cast-portrait-trigger').dispatch_event('click')
    expect(page.locator('#about')).to_have_attribute('data-member','ryo',timeout=6000)
    expect(page.locator('#about')).to_have_attribute('data-transitioning','false',timeout=6000)
    expect(page.locator('#character-box')).to_be_hidden()
    unhidden_portrait(page)
    # Verify a real in-progress circle, rather than a static theme replacement.
    page.locator('#tab-kita').click()
    page.wait_for_timeout(320)
    circle=page.locator('.cast-background-reveal').evaluate('(e)=>({clip:getComputedStyle(e).clipPath,opacity:getComputedStyle(e).opacity})')
    assert circle['clip'].startswith('circle(') and float(circle['opacity']) > 0,circle
    expect(page.locator('#about')).to_have_attribute('data-transitioning','false',timeout=6000)
    no_overflow(page)
    page.close()

def test_eggs(browser):
    page=page_for(browser)
    box(page)
    page.locator('#character-box').click(force=True)
    expect(page.locator('.character-easter-egg')).to_have_attribute('data-state','idle',timeout=4000)
    unhidden_portrait(page)
    box(page)
    choose(page,'nijika')
    expect(page.locator('#character-box')).to_be_hidden()
    unhidden_portrait(page)
    for member in ['nijika','ryo','kita']:
        choose(page,member)
        page.locator('.cast-portrait-trigger').click(force=True)
        page.wait_for_timeout(120)
        assert egg_state(page)!='boxed'
        page.wait_for_timeout(2800)
        expect(page.locator('.character-easter-egg')).to_have_attribute('data-state','idle',timeout=2000)
        unhidden_portrait(page)
    choose(page,'hitori')
    box(page)
    # Actual browser history routing unmounts all transient artwork safely.
    page.evaluate("location.hash='#/about'")
    expect(page.locator('#about')).to_have_count(0)
    page.evaluate("location.hash='#/#about'")
    expect(page.locator('#about')).to_be_visible()
    expect(page.locator('#character-box')).to_be_hidden()
    unhidden_portrait(page)
    page.close()

def test_audio_instruments(browser):
    page=page_for(browser,reduced=True)
    assert page.evaluate('__audioQA().contexts')==0
    for member,kind,count in [('hitori','guitar',6),('nijika','drums',3),('ryo','bass',4),('kita','guitar',6)]:
        choose(page,member);open_instrument(page)
        expect(page.locator('.instrument-panel')).to_have_attribute('data-instrument',kind)
        pads=page.locator('.instrument-pad');assert pads.count()==count
        for index in range(count): pads.nth(index).click()
        assert page.evaluate('__audioQA().contexts')==0
        if kind != 'drums':
            assert page.locator('.instrument-vibration').first.evaluate("e=>getComputedStyle(e,'::before').width")!='0px'
        no_overflow(page)
    page.locator('#strum-button').click()
    assert page.evaluate('__audioQA().contexts')==0
    # Music playback owns its own context; interaction mute must leave its state and volume alone.
    page.locator('.music-play').click()
    page.wait_for_function("document.querySelector('.music-player audio').paused===false")
    volume=page.locator('.music-player audio').evaluate('a=>a.volume')
    current=page.locator('.music-player audio').evaluate('a=>a.currentSrc')
    page.locator('.site-header .sound-toggle').click()
    expect(page.locator('.site-header .sound-toggle')).to_have_attribute('aria-pressed','true')
    page.locator('.site-header .sound-settings summary').click()
    page.locator('.site-header .sfx-volume').evaluate("e=>{e.value=.12;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    expect(page.locator('.site-header .sfx-volume')).to_have_attribute('aria-valuetext','24%')
    page.locator('.site-header .sound-settings summary').click()
    contexts=page.evaluate('__audioQA().contexts')
    assert contexts==2,contexts
    choose(page,'nijika');open_instrument(page)
    first=page.locator('.instrument-pad').first;first.focus()
    before=page.evaluate('__audioQA().starts')
    for key in ['a','s','d']: page.keyboard.press(key)
    page.wait_for_function(f'__audioQA().starts>{before}')
    # Controls are scoped; left/right keys inside panel do not change character.
    page.keyboard.press('ArrowRight')
    expect(page.locator('#about')).to_have_attribute('data-member','nijika')
    page.locator('.site-header .sound-toggle').click()
    expect(page.locator('.site-header .sound-toggle')).to_have_attribute('aria-pressed','false')
    page.wait_for_timeout(150)
    assert page.evaluate('__audioQA().active')==0
    assert page.locator('.music-player audio').evaluate('a=>!a.paused')
    assert page.locator('.music-player audio').evaluate('a=>a.volume')==volume
    assert page.locator('.music-player audio').evaluate('a=>a.currentSrc')==current
    page.locator('.music-play').click()
    assert page.locator('.music-player audio').evaluate('a=>a.paused')
    # Mute then instrument interaction remains silent without recreating contexts.
    before=page.evaluate('__audioQA().starts')
    page.locator('.instrument-pad').first.click()
    page.wait_for_timeout(150)
    assert page.evaluate('__audioQA().starts')==before
    assert page.evaluate('__audioQA().contexts')==contexts
    page.close()

def test_stage(browser):
    page=page_for(browser)
    choose(page,'ryo')
    # Exit mid-intro, reopen and skip, replay, native Escape and repeated mount/unmount.
    open_stage(page,skip=False)
    expect(page.locator('#starry-live-dialog')).to_have_attribute('data-phase','intro')
    close_stage(page)
    expect(page.locator('#enter-starry')).to_be_focused()
    open_stage(page)
    expect(page.locator('#about')).to_have_attribute('data-member','ryo')
    for mode in ['warm','colors','spotlight']:
        page.locator('[data-light-mode="'+mode+'"]').click()
        expect(page.locator('#starry-live-dialog')).to_have_attribute('data-lighting',mode)
    for member in COLORS:
        page.locator('[data-stage-member="'+member+'"]').click()
        expect(page.locator('#starry-live-dialog')).to_have_attribute('data-selected-member',member)
    page.locator('#starry-beat').click()
    assert page.evaluate('__audioQA().contexts')==0
    page.locator('#starry-replay').click()
    expect(page.locator('#starry-live-dialog')).to_have_attribute('data-phase','intro')
    page.locator('#starry-skip').click()
    expect(page.locator('#starry-live-dialog')).to_have_attribute('data-phase','ready')
    page.screenshot(path=str(OUTPUT / 'stage-desktop.png'))
    for _ in range(20):
        page.keyboard.press('Tab')
        assert page.evaluate('document.querySelector("#starry-live-dialog").contains(document.activeElement)')
    page.keyboard.press('Escape')
    expect(page.locator('#starry-live-dialog')).to_have_count(0)
    expect(page.locator('#enter-starry')).to_be_focused()
    for _ in range(3): open_stage(page,skip=False);close_stage(page)
    expect(page.locator('#about')).to_have_attribute('data-member','ryo')
    choose(page,'kita');unhidden_portrait(page)
    page.locator('.site-header .sound-toggle').click()
    open_stage(page,skip=False)
    expect(page.locator('#starry-live-dialog')).to_have_attribute('data-phase','ready',timeout=6500)
    expect(page.locator('#starry-live-dialog')).to_have_attribute('data-lighting','colors')
    page.locator('#starry-beat').click()
    assert page.evaluate('__audioQA().starts')>0
    close_stage(page)
    page.wait_for_function('__audioQA().active===0')
    assert page.evaluate('document.querySelectorAll("dialog[open]").length')==0
    # Leaving the route while the opening sequence runs must dispose the modal and scroll lock.
    open_stage(page,skip=False)
    page.evaluate("location.hash='#/about'")
    expect(page.locator('#starry-live-dialog')).to_have_count(0)
    assert page.evaluate('document.body.style.overflow')!='hidden'
    page.close()

def test_hidden_cleanup(browser):
    page=page_for(browser,reduced=True)
    box(page)
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
    expect(page.locator('#character-box')).to_be_hidden()
    expect(page.locator('.character-easter-egg')).to_have_attribute('data-state','idle')
    page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
    unhidden_portrait(page)
    page.locator('.site-header .sound-toggle').click()
    open_instrument(page)
    page.locator('.instrument-pad').first.click()
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(150)
    assert page.evaluate('__audioQA().active')==0
    assert all(state!='running' for state in page.evaluate('__audioQA().states'))
    page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
    open_stage(page)
    page.locator('#starry-beat').click()
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(150)
    assert page.evaluate('__audioQA().active')==0
    page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
    close_stage(page)
    choose(page,'kita')
    page.close()

def test_layouts_reduced(browser):
    for width,height in [(390,844),(320,740),(844,390)]:
        page=page_for(browser,width,height,reduced=True)
        brand=page.locator('.navigation-brand-row').bounding_box()
        sound=page.locator('.navigation-sound').bounding_box()
        assert brand['x']+brand['width']<=sound['x']+1 or brand['y']+brand['height']<=sound['y'],(brand,sound)
        for member in COLORS:
            choose(page,member);open_instrument(page);no_overflow(page)
            page.locator('.instrument-pad').first.click()
            # Horizontal touch gestures beginning on instrument controls must not navigate members.
            pad=page.locator('.instrument-pad').first
            pad.dispatch_event('pointerdown',{'pointerId':1,'pointerType':'touch','clientX':200,'clientY':200,'bubbles':True})
            pad.dispatch_event('pointerup',{'pointerId':1,'pointerType':'touch','clientX':80,'clientY':200,'bubbles':True})
            expect(page.locator('#about')).to_have_attribute('data-member',member)
        choose(page,'hitori');box(page)
        page.locator('#character-box').click(force=True)
        expect(page.locator('.character-easter-egg')).to_have_attribute('data-state','idle')
        open_stage(page)
        expect(page.locator('#starry-live-dialog')).to_have_attribute('data-phase','ready')
        no_overflow(page)
        assert page.locator('#starry-live-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        exit_bounds=page.locator('#starry-exit').bounding_box()
        assert exit_bounds['x']>=0 and exit_bounds['y']>=0 and exit_bounds['x']+exit_bounds['width']<=width+1 and exit_bounds['y']+exit_bounds['height']<=height+1,exit_bounds
        for member in COLORS:
            figure=page.locator('[data-stage-member="'+member+'"] img')
            assert figure.evaluate('(i)=>i.complete&&i.naturalHeight>0')
            r=figure.bounding_box()
            assert r['width']>0 and r['height']>0
        page.screenshot(path=str(OUTPUT / f'stage-{width}x{height}.png'))
        close_stage(page)
        expect(page.locator('#about')).to_have_attribute('data-member','hitori')
        no_overflow(page)
        page.close()

def test_mobile_eggs(browser):
    for width,height,reduced in [(390,844,False),(320,740,True),(844,390,True)]:
        page=page_for(browser,width,height,reduced)
        for member in COLORS:
            choose(page,member);no_overflow(page)
        choose(page,'hitori')
        page.locator('.cast-art').scroll_into_view_if_needed()
        for index in range(5):
            trigger=page.locator('.cast-portrait-trigger').bounding_box()
            page.touchscreen.tap(trigger['x']+trigger['width']/2,trigger['y']+trigger['height']/2)
            page.wait_for_timeout(240)
        expect(page.locator('.character-easter-egg')).to_have_attribute('data-state','boxed',timeout=4000)
        page.screenshot(path=str(OUTPUT / f'egg-{width}x{height}.png'))
        page.locator('#character-box').tap(force=True)
        expect(page.locator('.character-easter-egg')).to_have_attribute('data-state','idle',timeout=4000)
        unhidden_portrait(page);no_overflow(page)
        page.close()


def test_keyboard_egg(browser):
    for reduced in [False, True]:
        page=page_for(browser,reduced=reduced)
        page.locator('.cast-art').scroll_into_view_if_needed()
        page.locator('.cast-portrait-trigger').focus()
        for _ in range(5):
            page.keyboard.press('Enter');page.wait_for_timeout(240)
        expect(page.locator('.character-easter-egg')).to_have_attribute('data-state','boxed',timeout=4000)
        expect(page.locator('#character-box')).to_be_focused()
        page.keyboard.press('Enter')
        expect(page.locator('.character-easter-egg')).to_have_attribute('data-state','idle',timeout=4000)
        expect(page.locator('.cast-portrait-trigger')).to_be_focused()
        unhidden_portrait(page)
        page.close()


def test_existing_media_smoke(browser):
    page=page_for(browser,reduced=True)
    page.locator('.music-play').click()
    page.wait_for_function("document.querySelector('.music-player audio').paused===false")
    page.locator('.music-play').click()
    assert page.locator('.music-player audio').evaluate('a=>a.paused')
    page.locator('.gallery-image-button').first.click()
    expect(page.locator('#lightbox')).to_be_visible()
    title=page.locator('#lightbox-title').inner_text()
    page.locator('#lightbox-next').click()
    assert page.locator('#lightbox-title').inner_text()!=title
    page.locator('#lightbox-close').click()
    expect(page.locator('#lightbox')).to_be_hidden()
    page.locator('.gallery-view-switch button').nth(1).click()
    expect(page.locator('.gallery-flow-view')).to_be_visible()
    no_overflow(page)
    page.close()


def run_case(browser,name,fn):
    try:
        fn(browser)
        REPORT['results'].append({'name':name,'result':'PASS'})
        print(name+': PASS',flush=True)
    except Exception as e:
        REPORT['results'].append({'name':name,'result':'FAIL','error':str(e),'trace':traceback.format_exc()})
        print(name+': FAIL '+str(e),flush=True)
        for index,context in enumerate(browser.contexts):
            for pi,page in enumerate(context.pages):
                try: page.screenshot(path=f'/tmp/hitori-v3-failure-{name.replace(" ","-")}-{index}-{pi}.png')
                except Exception: pass
    finally:
        for context in browser.contexts: context.close()
    OUT.write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))

with sync_playwright() as playwright:
    chromium_path = os.environ.get('HITORI_CHROMIUM', '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    browser=playwright.chromium.launch(executable_path=chromium_path,args=['--no-sandbox'])
    for name,fn in [('original transitions',test_transitions),('character eggs',test_eggs),('audio and instruments',test_audio_instruments),('stage lifecycle',test_stage),('visibility cleanup (simulated event)',test_hidden_cleanup),('mobile and reduced motion',test_layouts_reduced),('mobile touch eggs',test_mobile_eggs),('keyboard egg focus',test_keyboard_egg),('existing gallery and music',test_existing_media_smoke)]:
        if not os.environ.get('HITORI_QA_CASE') or name==os.environ.get('HITORI_QA_CASE'):run_case(browser,name,fn)
    browser.close()
REPORT['result']='PASS' if all(r['result']=='PASS' for r in REPORT['results']) and not REPORT['errors'] and not REPORT['httpErrors'] else 'FAIL'
OUT.write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print(json.dumps(REPORT,ensure_ascii=False,indent=2))
raise SystemExit(0 if REPORT['result']=='PASS' else 1)
