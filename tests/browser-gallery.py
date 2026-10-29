"""收藏墙浏览器回归：需要 Playwright 和 Chromium，并先启动 Vite 预览服务。

HITORI_QA_URL=http://127.0.0.1:4173/patrol-retest-demo/ python tests/browser-gallery.py
HITORI_QA_OUTPUT 指定截图/报告目录；HITORI_QA_CASE=layouts 或 assets 可定向复测。
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
import os
import traceback

ROOT = Path(__file__).resolve().parents[1]
COLLECTION = json.loads((ROOT / 'src/data/gallery-upload.json').read_text())
BASE = os.environ.get('HITORI_QA_URL', 'http://127.0.0.1:4173/patrol-retest-demo/').rstrip('/') + '/'
OUTPUT = Path(os.environ.get('HITORI_QA_OUTPUT', '/tmp/gallery-qa'))
OUTPUT.mkdir(parents=True, exist_ok=True)
REPORT = {'results': [], 'errors': [], 'httpErrors': []}


def page_for(browser, width=1440, height=900, reduced=False):
    page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=width < 900,
                            reduced_motion='reduce' if reduced else 'no-preference')
    page.on('pageerror', lambda error: REPORT['errors'].append(str(error)))
    page.on('response', lambda response: REPORT['httpErrors'].append(f'{response.status} {response.url}') if response.status >= 400 else None)
    page.goto(BASE + '#/#gallery', wait_until='networkidle')
    return page


def test_layouts(browser):
    total = len(COLLECTION) + 3
    layouts = []
    for width, height in [(1440, 900), (390, 844), (320, 740)]:
        page = page_for(browser, width, height, reduced=width < 900)
        expect(page.locator('.gallery-card')).to_have_count(9)
        for previous in range(9, total, 9):
            page.locator('.gallery-load-more').click()
            expect(page.locator('.gallery-card')).to_have_count(min(previous + 9, total))
            expect(page.locator('.gallery-image-button').nth(previous)).to_be_focused()
        expect(page.locator('.gallery-load-more')).to_have_count(0)

        # 只展开首批卡片时，灯箱仍然可以访问筛选后的完整收藏。
        page.locator('[data-filter="collection"]').click()
        expect(page.locator('.gallery-card')).to_have_count(9)
        page.locator('.gallery-image-button').first.click()
        expect(page.locator('#lightbox-count')).to_have_text(f'01 / {len(COLLECTION):02}')
        expect(page.locator('.lightbox-original')).to_be_visible()
        assert page.locator('.lightbox-original').get_attribute('target') == '_blank'
        page.locator('#lightbox-prev').click()
        expect(page.locator('#lightbox-count')).to_have_text(f'{len(COLLECTION):02} / {len(COLLECTION):02}')
        page.locator('#lightbox-close').click()
        expect(page.locator('.gallery-image-button').first).to_be_focused()

        page.locator('.gallery-view-switch button').nth(1).click()
        expect(page.locator('.gallery-flow-access button')).to_have_count(len(COLLECTION))
        expect(page.locator('.gallery-flow-photo')).to_have_count(len(COLLECTION) * 2)
        for row in page.locator('.gallery-flow-row').all():
            assert row.locator('.gallery-flow-group').first.bounding_box()['width'] >= row.bounding_box()['width']
            track = row.locator('.gallery-flow-track')
            if width == 1440:
                assert track.evaluate('e=>parseFloat(getComputedStyle(e).animationDuration)') >= 169
            else:
                assert track.evaluate('e=>getComputedStyle(e).animationPlayState') == 'paused'
        if width == 1440:
            page.locator('.gallery-flow-wall').hover()
            item = page.locator('.gallery-flow-row').first.locator('.gallery-flow-photo').nth(1)
            title = item.locator('span').inner_text()
            item.click()
            expect(page.locator('#lightbox-title')).to_have_text(title)
            page.locator('#lightbox-close').click()
            assert title in page.evaluate('document.activeElement.textContent')

        # 小幅上传原图应按原始像素显示，不能被灯箱强行撑满。
        small = next(item for item in COLLECTION if max(item['width'], item['height']) <= 300)
        entry = page.locator(f'.gallery-flow-access button[data-preview-id="{small["id"]}"]')
        entry.click()
        image = page.locator('#lightbox-image')
        image.evaluate('e=>e.decode()')
        dimensions = image.evaluate('e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,nw:e.naturalWidth,nh:e.naturalHeight})')
        assert dimensions['width'] <= dimensions['nw'] + 1 and dimensions['height'] <= dimensions['nh'] + 1, dimensions
        page.keyboard.press('Escape')
        expect(page.locator('#lightbox')).to_be_hidden()
        expect(entry).to_be_focused()

        page.locator('.gallery-view-switch button').first.click()
        expect(page.locator('.gallery-card')).to_have_count(9)
        for image in page.locator('.gallery-card img').all():
            assert image.evaluate('e=>getComputedStyle(e).objectFit') == 'contain'
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.locator('#gallery').evaluate("e=>window.scrollTo({top:e.offsetTop,behavior:'instant'})")
        page.screenshot(path=str(OUTPUT / f'gallery-{width}.png'))
        layouts.append({'viewport': [width, height], 'pagination': True, 'focusReturn': True,
                        'allCollectionEntriesReachable': True, 'smallImage': dimensions, 'noOverflow': True})
        page.close()
    return layouts


def test_assets(browser):
    page = page_for(browser, reduced=True)
    page.locator('[data-filter="collection"]').click()
    page.locator('.gallery-image-button').first.click()
    checked = []
    for index, item in enumerate(COLLECTION):
        expect(page.locator('#lightbox-count')).to_have_text(f'{index + 1:02} / {len(COLLECTION):02}')
        expect(page.locator('#lightbox-title')).to_have_text(item['title'])
        image = page.locator('#lightbox-image')
        assert image.get_attribute('src').endswith(item['src']), item['id']
        width, height = image.evaluate('e=>e.decode().then(()=>[e.naturalWidth,e.naturalHeight])')
        assert width > 0 and height > 0, item['id']
        expect(page.locator('.lightbox-image-error')).to_have_count(0)
        if item.get('originalSrc'):
            assert page.locator('.lightbox-original').get_attribute('href').endswith(item['originalSrc'])
        checked.append({'id': item['id'], 'size': [width, height]})
        page.locator('#lightbox-next').click()
    expect(page.locator('#lightbox-count')).to_have_text(f'01 / {len(COLLECTION):02}')
    expect(page.locator('#lightbox-title')).to_have_text(COLLECTION[0]['title'])
    page.locator('#lightbox-image').evaluate('e=>e.decode()')
    page.screenshot(path=str(OUTPUT / 'gallery-lightbox.png'))
    page.locator('#lightbox-close').click()
    expect(page.locator('.gallery-image-button').first).to_be_focused()
    page.close()
    return checked


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('HITORI_CHROMIUM', '/usr/bin/chromium'), args=['--no-sandbox'])
    for name, function in [('layouts', test_layouts), ('assets', test_assets)]:
        if os.environ.get('HITORI_QA_CASE') and os.environ['HITORI_QA_CASE'] != name:
            continue
        try:
            details = function(browser)
            REPORT['results'].append({'name': name, 'result': 'PASS', 'details': details})
            print(f'{name}: PASS', flush=True)
        except Exception as error:
            REPORT['results'].append({'name': name, 'result': 'FAIL', 'error': str(error), 'trace': traceback.format_exc()})
            print(f'{name}: FAIL {error}', flush=True)
        finally:
            for context in browser.contexts:
                context.close()
    browser.close()
REPORT['result'] = 'PASS' if REPORT['results'] and all(item['result'] == 'PASS' for item in REPORT['results']) and not REPORT['errors'] and not REPORT['httpErrors'] else 'FAIL'
(OUTPUT / 'results.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))
print(json.dumps(REPORT, ensure_ascii=False, indent=2))
raise SystemExit(0 if REPORT['result'] == 'PASS' else 1)
