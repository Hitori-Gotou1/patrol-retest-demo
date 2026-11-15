"""Real Chromium checks of calibration, exact practice logging and the long diary.
Uses isolated local browser storage; never authenticates or accesses production data.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('HITORI_QA_URL', 'http://127.0.0.1:4396/patrol-retest-demo/')
OUT = Path(os.environ.get('HITORI_QA_OUTPUT', '/tmp/hitori-practice-qa'))
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as runner:
    browser = runner.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL + '#/room/rhythm')
    expect(page.locator('#rhythm-title')).to_be_visible()
    page.get_by_role('button', name='校准与键位').click()
    keys = ['a', 's', 'z', 'x']
    for lane, key in zip(['一里 · 吉他', '虹夏 · 节拍', '凉 · 贝斯', '喜多 · 和弦'], keys):
        page.get_by_role('textbox', name=lane + '键位', exact=True).fill(key)
    page.get_by_role('button', name='保存键位与补偿', exact=True).click()
    assert page.evaluate("JSON.parse(localStorage.getItem('hitori-room:rhythm-preferences:v1')).keys") == keys
    page.get_by_role('textbox', name='喜多 · 和弦键位', exact=True).fill('a')
    page.get_by_role('button', name='保存键位与补偿', exact=True).click()
    expect(page.locator('.room-status')).to_contain_text('四个不同')
    assert page.evaluate("JSON.parse(localStorage.getItem('hitori-room:rhythm-preferences:v1')).keys") == keys
    page.get_by_role('textbox', name='喜多 · 和弦键位', exact=True).fill('x')
    page.get_by_role('button', name='开始八拍校准', exact=True).click()
    for beat in range(1, 9):
        expect(page.locator('.calibration-pulse')).to_have_text(str(beat), timeout=2500)
        page.get_by_role('button', name='跟着节拍轻点 / 空格', exact=True).click()
    expect(page.get_by_role('button', name='应用本次校准', exact=True)).to_be_enabled(timeout=2500)
    page.get_by_role('button', name='应用本次校准', exact=True).click()
    offset = page.evaluate("JSON.parse(localStorage.getItem('hitori-room:rhythm-preferences:v1')).offsetMs")
    assert -300 <= offset <= 300
    page.get_by_role('button', name='重置校准', exact=True).click()
    assert page.evaluate("JSON.parse(localStorage.getItem('hitori-room:rhythm-preferences:v1')).offsetMs") == 0
    page.screenshot(path=str(OUT / 'rhythm-desktop.png'), full_page=True)

    page.goto(URL + '#/room/practice')
    expect(page.locator('#practice-title')).to_be_visible()
    page.locator('#practice-track').fill('那首歌 · 测试练习')
    page.locator('#practice-goal').fill('副歌慢速弹顺')
    page.locator('#focus-minutes').fill('1')
    page.locator('#break-minutes').fill('0')
    page.locator('#practice-start').click()
    expect(page.get_by_role('button', name='暂停计时', exact=True)).to_be_visible()
    page.evaluate("""() => {const key='hitori-room:practice:v1'; const state=JSON.parse(localStorage.getItem(key)); state.current.deadline-=15000; localStorage.setItem(key,JSON.stringify(state)); window.dispatchEvent(new StorageEvent('storage',{key,storageArea:localStorage}));}""")
    page.get_by_role('button', name='结束本轮', exact=True).click()
    expect(page.locator('#practice-end-title')).to_be_visible()
    page.get_by_placeholder('今天哪一点更顺手了？').fill('今天更顺手了')
    page.get_by_role('button', name='保存实际时长并结束', exact=True).click()
    expect(page.locator('.practice-records')).to_contain_text('今天更顺手了')
    data = page.evaluate("JSON.parse(localStorage.getItem('hitori-room:practice:v1'))")
    assert data['totalSessions'] == 1 and len(data['records']) == 1
    assert 15 <= data['records'][0]['actualSeconds'] <= 19
    assert data['records'][0]['plannedMinutes'] == 1
    assert data['records'][0]['endedEarly'] is True
    page.get_by_role('button', name='写心得', exact=True).click()
    page.get_by_label('这一轮的心得', exact=True).fill('已经可以放松弹了')
    page.get_by_role('button', name='收好心得', exact=True).click()
    expect(page.locator('.practice-records')).to_contain_text('已经可以放松弹了')
    page.get_by_role('combobox', name='查看', exact=True).select_option('30')
    assert page.locator('.trend-bars [role=listitem]').count() == 30
    page.screenshot(path=str(OUT / 'practice-desktop.png'), full_page=True)

    # Two isolated pages in one origin share storage and Web Locks. Both see one
    # active timer and a simultaneous deadline cannot create two records.
    second = context.new_page()
    second.goto(URL + '#/room/practice')
    expect(second.locator('#practice-start')).to_be_visible()
    page.locator('#practice-start').click()
    expect(second.get_by_role('button', name='暂停计时', exact=True)).to_be_visible()
    page.evaluate("""() => {const key='hitori-room:practice:v1';const state=JSON.parse(localStorage.getItem(key));state.current.deadline=Date.now()-10;localStorage.setItem(key,JSON.stringify(state));window.dispatchEvent(new StorageEvent('storage',{key,storageArea:localStorage}));}""")
    expect(page.locator('#practice-start')).to_be_visible()
    expect(second.locator('#practice-start')).to_be_visible()
    data = page.evaluate("JSON.parse(localStorage.getItem('hitori-room:practice:v1'))")
    assert data['totalSessions'] == 2 and len(data['records']) == 2
    second.close()

    page.goto(URL + '#/room/companion')
    expect(page.locator('#diary-title')).to_be_visible()
    expect(page.locator('.diary-page').first).to_be_visible()
    original = page.locator('.diary-page').count()
    page.locator('.diary-page').first.get_by_role('button', name='收藏重要回忆').click()
    page.get_by_label('只看重要回忆', exact=True).check()
    assert page.locator('.diary-page').count() == 1
    page.get_by_label('只看重要回忆', exact=True).uncheck()
    page.locator('.diary-page').first.get_by_role('button', name='关联一件作品', exact=True).click()
    expect(page.locator('.diary-inline')).to_contain_text('作品架还空着')
    page.locator('.diary-inline').get_by_role('button', name='取消', exact=True).click()
    page.locator('.diary-page').first.get_by_role('button', name='删除这一页', exact=True).click()
    page.get_by_role('button', name='确认删除这一页', exact=True).click()
    assert page.locator('.diary-page').count() == original - 1
    page.reload()
    expect(page.locator('#diary-title')).to_be_visible()
    assert page.locator('.diary-page').count() == original - 1
    page.screenshot(path=str(OUT / 'companion-desktop.png'), full_page=True)

    for width, height, label in [(375, 812, 'narrow'), (430, 932, 'wide'), (768, 1024, 'tablet')]:
        page.set_viewport_size({'width': width, 'height': height})
        for tool in ['rhythm', 'practice', 'companion']:
            page.goto(URL + '#/room/' + tool)
            expect(page.locator('.room-panel')).to_be_visible()
            page.wait_for_timeout(150)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (tool, width, 'horizontal overflow')
            if tool == 'rhythm':
                for pad in page.locator('.rhythm-pads button').all():
                    box = pad.bounding_box()
                    assert box['width'] >= 44 and box['height'] >= 44
            page.screenshot(path=str(OUT / f'{tool}-{label}.png'), full_page=True)
    assert not errors, errors
    (OUT / 'result.json').write_text(json.dumps({'status':'passed','checks':['calibration actual eight taps','custom key collision rejection','exact early practice record','editable reflection','month chart','two-tab one timer one completion','diary pin/delete persistence','4 viewport layouts','44px touch pads','reduced motion'], 'calibrationMeasuredMs':offset, 'practiceSeconds':data['totalSeconds'], 'pageErrors':errors}, ensure_ascii=False, indent=2))
    context.close()
    browser.close()
print(OUT)
