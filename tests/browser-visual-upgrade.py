"""Production-browser checks and real captures for the visual/motion refinement.
Run with the preview server on 4173. All account/cloud writes are excluded.
PLAYWRIGHT_BROWSERS_PATH=/tmp/hitori-browser-tools python tests/browser-visual-upgrade.py
"""
from pathlib import Path
import json, os, tempfile, traceback
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('HITORI_QA_OUTPUT', ROOT / 'docs/visual-upgrade/previews'))
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('HITORI_QA_URL', 'http://127.0.0.1:4173/patrol-retest-demo/')
REPORT = {'results': [], 'pageErrors': [], 'consoleErrors': [], 'unexpectedWrites': [], 'screenshots': []}
SPY = '''(() => {
 window.__contexts=[]; const Native=window.AudioContext||window.webkitAudioContext;
 if(Native) window.AudioContext=new Proxy(Native,{construct(t,a){const c=new t(...a);window.__contexts.push(c);return c;}});
 window.__observers=[];
 for(const kind of ['IntersectionObserver','ResizeObserver']) {
  const Original=window[kind]; if(!Original) continue;
  window[kind]=class extends Original {
   constructor(...args){super(...args);this.targets=new Set();window.__observers.push(this);}
   observe(el,...rest){this.targets.add(el);return super.observe(el,...rest);}
   unobserve(el){this.targets.delete(el);return super.unobserve(el);}
   disconnect(){this.targets.clear();return super.disconnect();}
  };
 }
})();'''

def context(browser, width=1440, height=900, reduced=False, **kwargs):
    c = browser.new_context(viewport={'width':width,'height':height},has_touch=width<900,
                            reduced_motion='reduce' if reduced else 'no-preference', **kwargs)
    c.add_init_script(SPY)
    def guard(route):
        if any(part in route.request.url for part in ['/rest/v1/', '/auth/v1/', '/storage/v1/']):
            if route.request.method not in ['GET','OPTIONS']:
                REPORT['unexpectedWrites'].append(route.request.method+' '+route.request.url)
            route.fulfill(status=200,content_type='application/json',body='[]',headers={'Access-Control-Allow-Origin':'*'})
        else: route.continue_()
    c.route('**/*',guard)
    c.on('page', lambda page: (page.on('pageerror',lambda e:REPORT['pageErrors'].append(str(e))),
                               page.on('console',lambda m:REPORT['consoleErrors'].append(m.text) if m.type=='error' else None)))
    return c

def goto(page, route, wait=650):
    page.goto(BASE+route,wait_until='networkidle')
    page.wait_for_timeout(wait)

def shot(page, name):
    page.screenshot(path=str(OUT/(name+'.png')))
    REPORT['screenshots'].append(name+'.png')

def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), page.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})')

def detached_observers(page):
    return page.evaluate('window.__observers.flatMap(o=>[...o.targets]).filter(el=>!el.isConnected).map(el=>el.className)')

def test_layouts(browser):
    metrics=[]
    for width,height,label in [(1440,900,'desktop'),(768,1024,'tablet'),(390,844,'mobile'),(360,800,'narrow')]:
        c=context(browser,width,height);page=c.new_page()
        goto(page,'#/room/play')
        art=page.locator('.featured-art').first.bounding_box()
        assert art and art['y']+min(130,art['height'])<height, art
        if width>1000:
            assert page.locator('.featured-art').nth(2).bounding_box()['y']<height
        no_overflow(page);shot(page,'room-'+label)
        assert page.locator('.favorite-activities.is-empty').bounding_box()['height']<100
        expect(page.locator('.topic-sketch')).to_have_count(3)
        goto(page,'#/#gallery',900)
        page.wait_for_function('Math.abs(document.querySelector("#gallery").getBoundingClientRect().top)<4',timeout=5000)
        image=page.locator('.gallery-image-button img').first
        expect(image).to_be_visible()
        box=image.bounding_box()
        effective=max(0,min(height,box['y']+box['height'])-max(102,box['y']))
        assert effective>=160,(width,box,effective)
        assert image.evaluate('el=>el.complete && el.naturalWidth>0')
        no_overflow(page);shot(page,'gallery-'+label)
        metrics.append({'width':width,'height':height,'featuredTop':round(art['y']),'galleryImageVisible':round(effective)})
        if width in [1440,390]:
            for scene in ['home','about','theater','video']:
                goto(page,'#/#'+scene,900)
                expect(page.locator('#'+scene+':not(.scene-pending)')).to_be_visible()
                page.wait_for_function('(id)=>Math.abs(document.getElementById(id).getBoundingClientRect().top)<4',arg=scene,timeout=5000)
                no_overflow(page);shot(page,scene+'-'+label)
            for tab in ['练习唱片','私人放映','原曲导听']:
                page.locator('.media-tabs').get_by_role('button',name=tab).click()
                page.wait_for_timeout(450);no_overflow(page)
            shot(page,'music-guide-'+label)
        c.close()
    return metrics

def test_routes_and_saves(browser):
    c=context(browser);page=c.new_page();goto(page,'#/room/play')
    page.locator('.featured-activity').first.click()
    expect(page.locator('#photo-title')).to_be_visible()
    expect(page.locator('#room-heading')).to_be_focused()
    page.locator('#save-to-works').click()
    expect(page.locator('.work-save-bar')).to_contain_text('已放进作品架')
    expect(page.locator('.save-stamp')).to_be_visible()
    page.evaluate("() => {window.__nativeSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.includes('works'))throw new Error('Controlled full storage');return window.__nativeSet.call(this,k,v)}}")
    page.locator('#photo-caption').fill('Storage failure should keep this draft')
    page.locator('#save-to-works').click()
    expect(page.locator('.save-stamp')).to_have_count(0)
    expect(page.locator('.work-save-bar')).to_contain_text('未能写入作品架')
    page.evaluate('() => {Storage.prototype.setItem=window.__nativeSet}')
    page.locator('.room-quick-nav').get_by_role('link',name='活动室首页').click()
    expect(page.locator('.featured-activity')).to_have_count(3)
    page.go_back();expect(page.locator('#photo-title')).to_be_visible()
    page.go_forward();expect(page.locator('.featured-activity')).to_have_count(3)
    page.locator('.room-quick-nav button').click();expect(page.locator('#room-directory')).to_have_attribute('aria-hidden','false')
    page.locator('.room-quick-nav button').click();page.wait_for_timeout(350)
    assert page.locator('#room-directory').bounding_box()['height']<1
    for _ in range(3):
        page.locator('.site-navigation-header nav').get_by_role('link',name='心动收藏',exact=True).click()
        expect(page.locator('.gallery-image-button').first).to_be_visible();page.wait_for_timeout(450)
        page.locator('.site-navigation-header nav').get_by_role('link',name='活动室',exact=True).click()
        expect(page.locator('.featured-activity').first).to_be_visible()
    page.wait_for_timeout(400)
    assert detached_observers(page)==[],detached_observers(page)
    assert page.locator('main#main').count()==1
    page.locator('.site-navigation-header nav').get_by_role('link',name='心动收藏',exact=True).focus()
    page.keyboard.press('Enter')
    expect(page.locator('#gallery-title')).to_be_focused(timeout=7000)
    c.close();return 'Path transitions, history, real successful save stamp, failed save without stamp, folds and repeated cleanup.'

def test_photos(browser):
    c=context(browser);page=c.new_page();goto(page,'#/#gallery',900)
    page.evaluate('''window.__flightCount=0;window.__home=document.querySelector('main');new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList?.contains('photo-flight'))window.__flightCount++}))).observe(document.body,{childList:true,subtree:true})''')
    page.locator('.gallery-image-button').first.click()
    expect(page.locator('#lightbox')).to_be_visible();page.wait_for_timeout(480)
    assert page.evaluate('window.__flightCount')>=1,'Photo must actually fly from its thumbnail'
    assert page.evaluate('window.__home===document.querySelector("main")'),'Query changes remounted home'
    page.locator('[aria-label="放大图片"]').click();expect(page.locator('.lightbox-zoom-controls output')).to_have_text('140%')
    surface=page.locator('.lightbox-zoom-surface');surface.dblclick();page.wait_for_timeout(100)
    page.locator('.lightbox-zoom-controls').get_by_role('button',name='适配屏幕').click()
    for _ in range(6):page.locator('#lightbox-next').click()
    page.wait_for_timeout(260)
    assert page.locator('#lightbox-count').inner_text().startswith('07')
    share=page.url
    page.go_back();expect(page.locator('#lightbox')).to_be_hidden()
    expect(page.locator('.gallery-image-button').first).to_be_focused()
    page.go_forward();expect(page.locator('#lightbox')).to_be_visible()
    page.locator('#lightbox-close').click();expect(page.locator('#lightbox')).to_be_hidden()
    page.locator('.gallery-filter-toggle').click();expect(page.locator('#gallery-advanced')).to_have_attribute('aria-hidden','false')
    page.locator('#gallery-character').select_option('hitori');page.wait_for_timeout(350)
    expect(page.locator('.gallery-filter-chips')).to_be_visible()
    page.locator('.gallery-filter-toggle').click();page.wait_for_timeout(320)
    expect(page.locator('.gallery-filter-chips')).to_contain_text('后藤一里')
    page.locator('.gallery-filter-chips button').click();page.wait_for_timeout(350)
    page.locator('.gallery-view-switch').get_by_role('button',name='流动视图').click();expect(page.locator('.gallery-flow-view')).to_be_visible()
    page.wait_for_timeout(350);no_overflow(page)
    page.locator('.gallery-flow-access button').first.click();expect(page.locator('#lightbox')).to_be_visible()
    page.locator('#lightbox-close').click();expect(page.locator('#lightbox')).to_be_hidden()
    goto(page,share.removeprefix(BASE),800)
    expect(page.locator('#lightbox')).to_be_visible()
    page.locator('#lightbox-close').click();expect(page.locator('#lightbox')).to_be_hidden()
    assert '?image=' not in page.url
    page.locator('.gallery-view-switch').get_by_role('button',name='收藏墙').click();page.wait_for_timeout(320)
    page.locator('.gallery-image-button').first.click();expect(page.locator('#lightbox')).to_be_visible()
    page.evaluate("const el=document.querySelector('#gallery-search');el.value='nonexistent-result-zzz';el.dispatchEvent(new Event('input',{bubbles:true}))")
    page.wait_for_timeout(350)
    page.locator('#lightbox-close').click();expect(page.locator('#lightbox')).to_be_hidden()
    assert page.evaluate('document.body.style.overflow')!='hidden'
    expect(page.locator('#gallery-title')).to_be_focused()
    c.close();return 'Real photo flight, zoom, rapid steps, query identity, back/forward, filters, flow, share reload and missing-origin fallback.'

def test_photo_touch(browser):
    c=context(browser,390,844);page=c.new_page();goto(page,'#/#gallery',900)
    page.locator('.gallery-image-button').first.click();expect(page.locator('#lightbox')).to_be_visible();page.wait_for_timeout(450)
    surface=page.locator('.lightbox-zoom-surface');box=surface.bounding_box()
    x=box['x']+box['width']/2;y=box['y']+box['height']/2
    def pointer(kind,id,px,py):
        surface.dispatch_event(kind,{'pointerType':'touch','pointerId':id,'button':0,'clientX':px,'clientY':py,'bubbles':True})
    for _ in range(2):
        pointer('pointerdown',1,x,y);pointer('pointerup',1,x,y);page.wait_for_timeout(55)
    expect(page.locator('.lightbox-zoom-controls output')).to_have_text('300%')
    pointer('pointerdown',1,x,y);pointer('pointermove',1,x+75,y);pointer('pointerup',1,x+75,y)
    assert 'translate(0px, 0px)' not in page.locator('#lightbox-image').get_attribute('style')
    pointer('pointerdown',1,x-40,y);pointer('pointerdown',2,x+40,y)
    pointer('pointermove',2,x+100,y)
    assert int(page.locator('.lightbox-zoom-controls output').inner_text().strip('%'))>300
    pointer('pointerup',2,x+100,y);pointer('pointerup',1,x-40,y)
    page.locator('.lightbox-zoom-controls').get_by_role('button',name='适配屏幕').click()
    expect(page.locator('.lightbox-zoom-controls output')).to_have_text('100%')
    pointer('pointerdown',1,x+70,y);pointer('pointermove',1,x-70,y);pointer('pointerup',1,x-70,y)
    expect(page.locator('#lightbox-count')).to_have_text('02 / 54')
    page.locator('#lightbox-close').click();expect(page.locator('#lightbox')).to_be_hidden()
    no_overflow(page);c.close()
    return 'Mobile double-tap zoom, drag, two-pointer pinch, fit, swipe navigation and close remain independent of the flight.'

def test_characters(browser):
    for width,height in [(1440,900),(390,844)]:
        c=context(browser,width,height);page=c.new_page();goto(page,'#/#about',900)
        for member in ['nijika','ryo','hitori','kita']:
            page.locator('#tab-'+member).click();page.wait_for_timeout(45)
        expect(page.locator('#about')).to_have_attribute('data-member','kita',timeout=1100)
        expect(page.locator('#about')).to_have_attribute('data-transitioning','false',timeout=1100)
        assert page.locator('.cast-background-base').evaluate("el=>getComputedStyle(el).backgroundColor")=='rgb(233, 102, 112)'
        page.locator('#tab-kita').focus();page.keyboard.press('ArrowLeft')
        expect(page.locator('#tab-ryo')).to_be_focused()
        expect(page.locator('#about')).to_have_attribute('data-member','ryo')
        expect(page.locator('#about')).to_have_attribute('data-transitioning','false')
        if width<900:
            art=page.locator('.cast-art')
            art.dispatch_event('pointerdown',{'pointerType':'touch','clientX':260,'clientY':280,'pointerId':7})
            art.dispatch_event('pointerup',{'pointerType':'touch','clientX':130,'clientY':282,'pointerId':7})
            expect(page.locator('#about')).to_have_attribute('data-member','kita')
        no_overflow(page);c.close()
    return 'Last selection wins within one compact reveal; keyboard focus, colors and mobile swipe stay coordinated.'

def open_cinema_mood(page):
    details = page.locator('.cinema-mood-bar')
    if details.get_attribute('open') is None:
        details.locator('summary').press('Enter')
    return details

def test_cinema(browser):
    c=context(browser);page=c.new_page();goto(page,'#/#video',900)
    expect(page.locator('#video')).to_have_attribute('data-mood','warm')
    assert page.evaluate('window.__contexts.length')==0
    expect(page.locator('.cinema-mood-choices')).to_be_hidden()
    open_cinema_mood(page)
    for mood in ['warm','rain','stage']:
        page.locator('[data-mood-choice="'+mood+'"]').click();page.wait_for_timeout(750)
        expect(page.locator('#video')).to_have_attribute('data-mood',mood)
        shot(page,'mood-'+mood+'-desktop')
    for mood in ['rain','warm','rain','stage']:page.locator('[data-mood-choice="'+mood+'"]').click()
    page.wait_for_timeout(750)
    page.wait_for_function('Number(getComputedStyle(document.querySelector(".mood-stage")).opacity)>.999',timeout=2000)
    page.wait_for_function('Number(getComputedStyle(document.querySelector(".mood-rain")).opacity)<.001',timeout=2000)
    page.reload(wait_until='networkidle');page.wait_for_timeout(800)
    expect(page.locator('#video')).to_have_attribute('data-mood','stage')
    page.locator('.media-tabs').get_by_role('button',name='练习唱片').click()
    expect(page.locator('.music-play')).to_be_visible()
    page.locator('.music-play').click()
    page.wait_for_function('document.querySelector("audio") && !document.querySelector("audio").paused')
    page.wait_for_function('parseFloat(document.querySelector("#video").style.getPropertyValue("--audio-glow"))>0')
    volume=page.locator('audio').evaluate('el=>el.volume')
    open_cinema_mood(page)
    for mood in ['rain','warm','stage']:page.locator('[data-mood-choice="'+mood+'"]').click()
    assert page.locator('audio').evaluate('el=>el.volume')==volume
    assert not page.locator('audio').evaluate('el=>el.paused')
    assert page.evaluate('window.__contexts.length')==1
    page.locator('.music-play').click();page.wait_for_timeout(100)
    assert page.locator('#video').evaluate('el=>Number(el.style.getPropertyValue("--audio-glow"))')==0
    page.locator('.cinema-dynamic-toggle').click()
    expect(page.locator('#video')).to_have_attribute('data-dynamic','false')
    page.locator('.cinema-dynamic-toggle').click()
    expect(page.locator('#video')).to_have_attribute('data-dynamic','true')
    page.locator('.music-play').click();page.wait_for_function('!document.querySelector("audio").paused')
    page.evaluate("window.dispatchEvent(new CustomEvent('hitori:media-start',{detail:{owner:'other-local-media'}}))")
    page.wait_for_function('document.querySelector("audio").paused')
    for label in ['私人放映','原曲导听','练习唱片']:
        page.locator('.media-tabs').get_by_role('button',name=label).click();page.wait_for_timeout(350)
        expect(page.locator('#video')).to_have_attribute('data-mood','stage')
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'))")
    expect(page.locator('#video')).to_have_attribute('data-ambient','paused')
    expect(page.locator('#video')).to_have_attribute('data-dynamic','false')
    assert page.locator('audio').evaluate('el=>el.paused')
    page.evaluate("delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));window.scrollTo({top:0,behavior:'instant'})")
    expect(page.locator('#video')).to_have_attribute('data-ambient','paused')
    page.locator('.site-navigation-header nav').get_by_role('link',name='活动室',exact=True).click()
    expect(page.locator('.featured-activity').first).to_be_visible();page.wait_for_timeout(350)
    assert detached_observers(page)==[],detached_observers(page)
    assert page.evaluate('window.__contexts.every(c=>c.state==="closed")')
    c.close()
    c=context(browser,390,844);page=c.new_page();goto(page,'#/#video',900)
    open_cinema_mood(page)
    for mood in ['warm','rain','stage']:
        page.locator('[data-mood-choice="'+mood+'"]').click();page.wait_for_timeout(700);shot(page,'mood-'+mood+'-mobile');no_overflow(page)
    c.close()
    return 'All three moods, persistence, rapid cross-fades, three tabs, one real analyser, actual play/pause/media claims, hidden/offscreen pause and disposal.'

def test_reduced_and_storage(browser):
    c=context(browser,390,844,reduced=True);page=c.new_page();goto(page,'#/#video')
    expect(page.locator('#video')).to_have_attribute('data-dynamic','false')
    open_cinema_mood(page)
    expect(page.locator('.cinema-dynamic-toggle')).to_be_disabled()
    page.locator('[data-mood-choice="rain"]').click()
    expect(page.locator('.mood-rain')).to_have_class('cinema-mood mood-rain is-selected')
    assert page.locator('.rain-window i').first.evaluate('el=>getComputedStyle(el).animationName')=='none'
    page.emulate_media(reduced_motion='no-preference');page.wait_for_timeout(100)
    expect(page.locator('#video')).to_have_attribute('data-dynamic','true')
    page.locator('.site-tools-button').click()
    page.get_by_role('button',name='阅读、声音与设置',exact=True).click()
    page.locator('.tools-settings select').nth(2).select_option('reduce')
    page.get_by_role('button',name='应用并记住设置',exact=True).click()
    page.get_by_role('button',name='关闭搜索与设置',exact=True).click()
    expect(page.locator('#video')).to_have_attribute('data-dynamic','false')
    goto(page,'#/#gallery')
    page.locator('.gallery-image-button').first.click();expect(page.locator('#lightbox')).to_be_visible()
    assert page.locator('.photo-flight').count()==0
    page.locator('#lightbox-close').click();expect(page.locator('#lightbox')).to_be_hidden()
    c.close()
    c=context(browser);c.add_init_script("Storage.prototype.getItem=()=>{throw new Error('blocked')};Storage.prototype.setItem=()=>{throw new Error('blocked')}")
    page=c.new_page();goto(page,'#/#video')
    expect(page.locator('#video')).to_have_attribute('data-mood','warm')
    open_cinema_mood(page)
    page.locator('[data-mood-choice="rain"]').click()
    expect(page.locator('#video')).to_have_attribute('data-mood','rain')
    expect(page.locator('.cinema-mood-notice')).to_contain_text('浏览器暂时无法记住')
    c.close();return 'OS and site reduced-motion take precedence; static moods remain distinct; unavailable storage keeps current controls usable.'

def record(browser):
    temporary_video=tempfile.TemporaryDirectory(prefix='hitori-recording-')
    c=context(browser,1440,900,record_video_dir=temporary_video.name,record_video_size={'width':1440,'height':900})
    page=c.new_page();goto(page,'#/#home',800)
    page.locator('.site-navigation-header nav').get_by_role('link',name='活动室',exact=True).click();page.wait_for_timeout(900)
    page.locator('.featured-activity').first.click();page.wait_for_timeout(900)
    page.locator('.site-navigation-header nav').get_by_role('link',name='心动收藏',exact=True).click();page.wait_for_timeout(1300)
    page.locator('.gallery-image-button').first.click();page.wait_for_timeout(900)
    page.locator('#lightbox-next').click();page.wait_for_timeout(600)
    page.locator('#lightbox-close').click();page.wait_for_timeout(750)
    page.locator('.site-navigation-header nav').get_by_role('link',name='音乐放映室',exact=True).click();page.wait_for_timeout(1100)
    page.locator('.media-tabs').get_by_role('button',name='练习唱片').click();page.wait_for_timeout(700)
    open_cinema_mood(page)
    for mood in ['warm','rain','stage']:
        page.locator('[data-mood-choice="'+mood+'"]').click();page.wait_for_timeout(1400)
    video=page.video;c.close()
    video.save_as(str(OUT/'visual-tour.webm'))
    temporary_video.cleanup()
    return 'visual-tour.webm'

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('HITORI_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    for name,fn in [('responsive-layouts',test_layouts),('routes-and-save-feedback',test_routes_and_saves),('photo-continuity',test_photos),('photo-touch',test_photo_touch),('character-input',test_characters),('cinema-lifecycle',test_cinema),('motion-and-storage',test_reduced_and_storage)]:
        if os.environ.get('HITORI_QA_CASE') and name not in os.environ['HITORI_QA_CASE'].split(','): continue
        try:
            detail=fn(browser);REPORT['results'].append({'name':name,'result':'PASS','detail':detail});print(name,'PASS',flush=True)
        except Exception:
            REPORT['results'].append({'name':name,'result':'FAIL','detail':traceback.format_exc()});print(name,'FAIL',traceback.format_exc(),flush=True)
    if os.environ.get('HITORI_QA_RECORD')=='1':
        try: REPORT['recording']=record(browser)
        except Exception: REPORT['recordingError']=traceback.format_exc()
    browser.close()
REPORT['result']='PASS' if all(r['result']=='PASS' for r in REPORT['results']) and not REPORT['pageErrors'] and not REPORT['consoleErrors'] and not REPORT['unexpectedWrites'] else 'FAIL'
Path(os.environ.get('HITORI_QA_REPORT',str(OUT.parent/'browser-results.json'))).write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(REPORT,ensure_ascii=False,indent=2))
raise SystemExit(0 if REPORT['result']=='PASS' else 1)
