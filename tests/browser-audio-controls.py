import os,pathlib,json
from playwright.sync_api import sync_playwright
BASE=os.getenv('HITORI_QA_URL','http://127.0.0.1:5174/patrol-retest-demo/')
OUT=pathlib.Path(os.getenv('HITORI_QA_OUTPUT','/workspace/patrol-retest-demo/evidence/audio'));OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=b.new_context(viewport={'width':390,'height':844},accept_downloads=True)
 page=context.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'#/room/studio');page.locator('#studio-title').wait_for()
 buttons=page.locator('.studio-track.is-active-track button:visible')
 assert buttons.count()==8
 for box in buttons.evaluate_all('(xs)=>xs.map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height}))'):
  assert box['width']>=43 and box['height']>=44,box
 page.get_by_role('button',name='⛶ 全屏编辑',exact=True).click()
 page.get_by_role('button',name='贝斯',exact=True).click();page.get_by_role('button',name='第 9–16 步',exact=True).click()
 page.get_by_role('button',name='贝斯第16步',exact=True).click()
 assert page.get_by_role('button',name='贝斯第16步',exact=True).get_attribute('aria-pressed')=='true'
 page.screenshot(path=str(OUT/'studio-mobile-fullscreen.png'))
 with page.expect_download() as download:
  page.locator('.editor-save').click()
 download.value.save_as(OUT/'mobile-pattern.json')
 page.get_by_role('button',name='退出全屏',exact=True).click()
 assert page.locator('.editor-enter').evaluate('(x)=>x===document.activeElement')
 page.locator('.sound-settings summary').first.click()
 page.get_by_role('slider',name='音乐播放器音量',exact=True).fill('0.61')
 page.get_by_role('slider',name='乐器与玩法音效音量',exact=True).fill('0.24')
 page.get_by_role('slider',name='雨夜环境声音量',exact=True).fill('0.13')
 page.get_by_label('总静音',exact=True).check()
 page.reload();page.locator('#studio-title').wait_for()
 prefs=page.evaluate('JSON.parse(localStorage.getItem("hitori-room:sound:v1"))')
 assert prefs['muted'] and prefs['music']==.61 and prefs['effects']==.24 and prefs['ambience']==.13,prefs
 page.get_by_role('button',name='播放并开启音效',exact=True).click()
 page.wait_for_function('document.querySelector(".room-status").textContent.includes("总静音")')
 page.locator('.sound-settings summary').first.click();page.get_by_label('总静音',exact=True).uncheck();page.locator('.sound-settings summary').first.click()
 page.get_by_role('button',name='播放并开启音效',exact=True).click();page.get_by_role('button',name='停止播放',exact=True).wait_for(timeout=45000)
 page.evaluate('window.dispatchEvent(new Event("hitori:audio-device-change"))')
 page.get_by_role('button',name='播放并开启音效',exact=True).wait_for()
 other=page.context.new_page();other.goto(BASE);other.evaluate('''()=>localStorage.setItem('hitori-room:studio:v1',JSON.stringify({version:1,name:'另一设备的新编排',bpm:110,masks:[1,2,4,8]}))''');page.bring_to_front();page.wait_for_function('document.querySelector("#pattern-name")?.value==="另一设备的新编排"');other.close()
 page.goto(BASE+'#/room/project');page.locator('#project-title').wait_for()
 page.locator('#project-video-export').click();page.locator('progress').wait_for(timeout=45000)
 page.wait_for_function('document.querySelector("progress")?.value>.27')
 page.get_by_role('button',name='取消导出',exact=True).click()
 page.wait_for_function('document.querySelector(".room-status").textContent.includes("取消")')
 assert page.locator('#project-video-export').is_enabled()
 page.screenshot(path=str(OUT/'project-mobile.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 result={'mobileSteps':8,'minTarget':'44px height, >=43px measured width','fullscreenSaveAndFocus':True,'soundPreferences':prefs,'videoCancel':True,'deviceEventStopsPlayback':True,'externalDraftAdopted':True,'errors':errors}
 (OUT/'controls.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
