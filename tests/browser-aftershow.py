"""Exercise the three-part aftershow through Chromium and inspect actual PNGs.

Run against a started Vite preview. HITORI_QA_URL overrides the app root,
HITORI_QA_OUTPUT overrides the ignored release/aftershow evidence directory.
"""
from io import BytesIO
import json
import os
from pathlib import Path
import re
from urllib.parse import urlsplit

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.getenv('HITORI_QA_URL', 'http://127.0.0.1:4176/patrol-retest-demo/')
OUT = Path(os.getenv('HITORI_QA_OUTPUT', str(ROOT / 'release' / 'aftershow')))
OUT.mkdir(parents=True, exist_ok=True)
DRAFT = 'hitori-room:aftershow:v1'
TITLE = '蓝弦落在末班车'
ENTRY = '.aftershow-entry'
FLOW = '.aftershow-experience'
FRAME = '.aftershow-stage-frame'
STAMP = '[data-press-stamp]'
PAPER = '[data-press-paper] .aftershow-poster'
POSTER = '[data-aftershow-poster-export] .aftershow-poster'
TRAIN_PAPER = '[data-train-poster] .aftershow-poster'
REFLECTION = '[data-train-reflection] .aftershow-poster'
RANGE = '[data-train-progress]'
MEMENTO = '[data-memento-export]'
REPORT = {'cases': {}, 'pageErrors': [], 'consoleErrors': [], 'blockedWrites': []}


def session(browser, width=1440, height=1000, reduced=False, block_storage=False):
    context = browser.new_context(
        viewport={'width': width, 'height': height}, has_touch=width < 700,
        is_mobile=width < 700, reduced_motion='reduce' if reduced else 'no-preference',
        accept_downloads=True, service_workers='block',
    )
    if block_storage:
        context.add_init_script('''Storage.prototype.setItem = () => {
            throw new DOMException('Test: browser storage disabled', 'QuotaExceededError');
        }''')
    context.add_init_script('''
        window.aftershowAudioContexts = 0;
        window.aftershowSoundStarts = 0;
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (Audio) window.AudioContext = new Proxy(Audio, { construct(target, args, receiver) {
          window.aftershowAudioContexts++;
          return Reflect.construct(target, args, receiver);
        } });
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
          window.aftershowSoundStarts++;
          return start.apply(this, args);
        };
    ''')

    def intercept(route):
        request = route.request
        if urlsplit(request.url).netloc == urlsplit(BASE).netloc:
            route.continue_()
        elif request.method in ('GET', 'OPTIONS'):
            route.fulfill(status=200, content_type='application/json', body='[]',
                          headers={'Access-Control-Allow-Origin': '*'})
        else:
            REPORT['blockedWrites'].append(request.method + ' ' + request.url)
            route.abort()

    context.route('**/*', intercept)
    page = context.new_page()
    page.set_default_timeout(10000)
    page.on('pageerror', lambda error: REPORT['pageErrors'].append(str(error)))
    page.on('console', lambda message: REPORT['consoleErrors'].append(message.text) if message.type == 'error' else None)
    return context, page


def open_route(page, route='aftershow'):
    page.goto(BASE + '#/room/' + route, wait_until='domcontentloaded')
    expect(page.locator(FLOW if route == 'aftershow' else '.discovery-home')).to_be_visible()


def phase(page, name):
    expect(page.locator(FLOW)).to_have_attribute('data-phase', name)


def button(page, name):
    return page.locator(FLOW).get_by_role('button', name=name, exact=True)


def stage_state(page, view, beat):
    expect(page.locator(FRAME)).to_have_attribute('data-view', view)
    expect(page.locator(FRAME)).to_have_attribute('data-beat', str(beat))


def poster_state(poster, view='drums', beat=6, title=None):
    expect(poster).to_have_count(1)
    expect(poster).to_have_attribute('data-poster-view', view)
    expect(poster).to_have_attribute('data-poster-beat', str(beat))
    if title is not None:
        expect(poster).to_have_attribute('data-poster-title', title)
        expect(poster).to_contain_text(title)


def impressions(poster):
    return poster.locator('[data-impression="fixed"]').evaluate_all('''layers =>
      layers.map(layer => ({ink: layer.dataset.ink,
        x: Number(layer.dataset.offsetX), y: Number(layer.dataset.offsetY)}))''')


def count_layers(poster, count):
    expect(poster.locator('[data-impression="fixed"]')).to_have_count(count)


def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (
        page.evaluate('({window: innerWidth, document: document.documentElement.scrollWidth})')
    )


def shot(page, filename, locate=None):
    if locate:
        locate.scroll_into_view_if_needed()
    page.screenshot(path=OUT / filename, animations='disabled')


def wait_ready(control):
    expect(control).to_be_enabled()
    expect(control).not_to_have_attribute('aria-disabled', 'true')


def stamp(page, number):
    control = page.locator(STAMP)
    wait_ready(control)
    control.click()
    count_layers(page.locator(POSTER), number)


def tab_to(page, locator, limit=100):
    # Actual sequential focus navigation. No click, DOM focus, or forced action.
    for _ in range(limit):
        if locator.evaluate('(node) => node === document.activeElement'):
            return
        page.keyboard.press('Tab')
    raise AssertionError('Tab cannot reach ' + str(locator))


def key_activate(page, locator):
    tab_to(page, locator)
    page.keyboard.press('Enter')


def download(page, trigger, filename):
    with page.expect_download(timeout=20000) as pending:
        trigger()
    result = pending.value
    assert result.failure() is None, result.failure()
    path = OUT / filename
    result.save_as(path)
    with Image.open(path) as png:
        assert png.format == 'PNG' and png.width >= 480 and png.height >= 620, png.size
        artwork = png.convert('RGB').copy()
    assert len(artwork.getcolors(artwork.width * artwork.height)) > 400
    return artwork


def ticket_points(page, poster_png, memento_png):
    # Compare the artist's actual poster raster with the mounted export's paper crop.
    box = page.locator(MEMENTO + ' .aftershow-poster').evaluate('''poster => {
      const geometry = {};
      for (const key of ['x', 'y', 'width', 'height']) geometry[key] = Number(poster.getAttribute(key));
      const root = poster.ownerSVGElement.viewBox.baseVal;
      return {...geometry, rootWidth: root.width, rootHeight: root.height};
    }''')
    sx = memento_png.width / box['rootWidth']
    sy = memento_png.height / box['rootHeight']
    crop = memento_png.crop(tuple(round(value) for value in (
        box['x'] * sx, box['y'] * sy,
        (box['x'] + box['width']) * sx, (box['y'] + box['height']) * sy,
    )))
    size = (240, 310)
    difference = ImageChops.difference(crop.resize(size, Image.Resampling.LANCZOS),
                                       poster_png.resize(size, Image.Resampling.LANCZOS))
    channel_error = ImageStat.Stat(difference).mean
    assert max(channel_error) < 6, channel_error
    return [round(delta, 2) for delta in channel_error]


def complete_journey(browser):
    ctx, page = session(browser)
    open_route(page, 'play')
    entry = page.locator(ENTRY)
    expect(entry).to_be_visible()
    expect(entry.locator('img')).to_be_visible()
    page.wait_for_function('el => el.complete && el.naturalWidth > 0', arg=entry.locator('img').element_handle())
    shot(page, 'entry-desktop.png', entry)
    entry.click()
    phase(page, 'stage')
    stage_state(page, 'audience', 1)
    button(page, '播放八拍').click()
    expect(page.locator(FRAME)).to_have_attribute('data-beat', '6', timeout=12000)
    button(page, '暂停播放').click()
    stage_state(page, 'audience', 6)
    view_captures = {}
    for view in ('audience', 'guitar', 'wing', 'drums'):
        page.locator(f'[data-aftershow-view="{view}"]').click()
        stage_state(page, view, 6)
        expect(button(page, '播放八拍')).to_be_visible()
        # Compare real renders rather than just the per-camera data attributes.
        path = OUT / f'beat-six-{view}.png'
        view_captures[view] = Image.open(BytesIO(page.locator(FRAME).screenshot(path=path))).convert('RGB')
    reference = view_captures['audience'].resize((240, 150))
    frame_differences = {}
    for view, frame in view_captures.items():
        if view != 'audience':
            delta = ImageStat.Stat(ImageChops.difference(reference, frame.resize((240, 150)))).mean
            assert max(delta) > 6, (view, delta)
            frame_differences[view] = round(max(delta), 1)
    assert page.evaluate('window.aftershowAudioContexts') == 0
    shot(page, 'stage-desktop.png', page.locator(FRAME))

    button(page, '把这一拍印下来').click()
    phase(page, 'press')
    poster = page.locator(POSTER)
    poster_state(poster)
    stamp(page, 1)
    stamp(page, 2)
    prior = impressions(poster)
    page.locator('[data-press-ink="blue"]').click()
    page.locator('[data-press-offset="right"]').click(click_count=2)
    blue_candidate = page.locator(PAPER).locator('[data-ink="blue"][data-impression="candidate"]')
    expect(blue_candidate).to_have_count(1)
    offset = int(blue_candidate.get_attribute('data-offset-x'))
    assert offset > 0, offset
    assert impressions(poster) == prior
    stamp(page, 3)
    first_blue = impressions(poster)[-1]
    assert first_blue == {'ink': 'blue', 'x': offset, 'y': 0}, first_blue
    page.locator('[data-press-undo]').click()
    count_layers(poster, 2)
    stamp(page, 3)
    assert impressions(poster)[-1] == first_blue
    stamp(page, 4)
    page.locator('[data-press-title]').fill(TITLE)
    poster_state(poster, title=TITLE)
    page.wait_for_function('''([key, title]) => localStorage.getItem(key)?.includes(title)''', arg=[DRAFT, TITLE])
    page.reload(wait_until='domcontentloaded')
    expect(page.locator(FLOW)).to_be_visible()
    phase(page, 'press')
    poster_state(poster, title=TITLE)
    expect(page.locator('[data-press-title]')).to_have_value(TITLE)
    expected_ink = impressions(poster)
    assert expected_ink[2] == first_blue and len(expected_ink) == 4, expected_ink
    no_overflow(page)
    shot(page, 'press-desktop.png', page.locator('[data-press-paper]'))
    png = download(page, lambda: page.locator('[data-press-export]').click(), 'aftershow-blue-offset-poster.png')
    page.locator('[data-press-train]').click()
    phase(page, 'train')
    page.locator('[data-train-stop="tunnel"]').click()
    expect(page.locator(RANGE)).to_have_value('50')
    expect(page.locator(REFLECTION)).to_be_visible()
    for selector in (TRAIN_PAPER, REFLECTION, MEMENTO + ' .aftershow-poster'):
        placement = page.locator(selector)
        poster_state(placement, title=TITLE)
        assert impressions(placement) == expected_ink
    shot(page, 'train-tunnel-desktop.png', page.locator(TRAIN_PAPER))
    page.locator('[data-train-stop="homes"]').click()
    page.locator('[data-train-flip]').click()
    ticket = page.locator('[data-train-ticket-back]')
    expect(ticket).to_contain_text(TITLE)
    expect(ticket).to_contain_text(re.compile('第\\s*6\\s*拍'))
    expect(ticket).to_contain_text('鼓位')
    souvenir = download(page, lambda: button(page, '保存散场纪念图').click(), 'aftershow-last-train-memento.png')
    error = ticket_points(page, png, souvenir)
    shot(page, 'train-ticket-back-desktop.png', ticket)
    page.locator('[data-aftershow-step="press"]').click()
    phase(page, 'press')
    assert impressions(poster) == expected_ink
    poster_state(poster, title=TITLE)
    ctx.close()
    return {'view': 'drums', 'beat': 6, 'title': TITLE, 'blueOffset': first_blue,
            'inkOrder': [layer['ink'] for layer in expected_ink], 'viewVariation': frame_differences,
            'posterPng': png.size, 'mementoPng': souvenir.size, 'mementoPosterMeanRgbError': error}


def rapid_and_lifecycle(browser):
    ctx, page = session(browser)
    open_route(page)
    button(page, '播放八拍').click()
    expect(page.locator(FRAME)).to_have_attribute('data-beat', '3', timeout=6000)
    page.locator('[data-aftershow-view="wing"]').click()
    expect(page.locator(FRAME)).to_have_attribute('data-view', 'wing')
    expect(page.locator(FRAME)).to_have_attribute('data-beat', '5', timeout=6000)
    page.evaluate('''() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }''')
    expect(button(page, '播放八拍')).to_be_visible()
    paused_at = page.locator(FRAME).get_attribute('data-beat')
    page.wait_for_timeout(1000)
    expect(page.locator(FRAME)).to_have_attribute('data-beat', paused_at)
    page.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
    page.locator('[data-aftershow-beat="5"]').click()
    button(page, '把这一拍印下来').click()
    phase(page, 'press')
    # One user double-click plus another click in the same press cycle.
    control = page.locator(STAMP)
    control.dblclick(delay=20)
    control.evaluate('(node) => node.click()')
    wait_ready(control)
    count_layers(page.locator(POSTER), 1)
    page.locator('[data-aftershow-step="stage"]').click()
    expect(page.locator(FLOW)).to_have_attribute('data-phase', 'stage')
    stage_state(page, 'wing', 5)
    page.locator('[data-aftershow-beat="7"]').click()
    button(page, '把这一拍印下来').click()
    guard = page.get_by_role('dialog')
    expect(guard).to_be_visible()
    guard.get_by_role('button', name=re.compile('保留|继续使用')).click()
    phase(page, 'press')
    poster_state(page.locator(POSTER), view='wing', beat=5)
    count_layers(page.locator(POSTER), 1)
    page.locator('[data-aftershow-step="stage"]').click()
    page.locator('[data-aftershow-beat="7"]').click()
    button(page, '把这一拍印下来').click()
    guard.get_by_role('button', name=re.compile('替换|换成')).click()
    phase(page, 'press')
    poster_state(page.locator(POSTER), view='wing', beat=7)
    count_layers(page.locator(POSTER), 0)
    ctx.close()
    return {'impressionsPerBurst': 1, 'backgroundPausedAt': paused_at, 'replaceRequiresChoice': True}


def keyboard_reduced(browser):
    ctx, page = session(browser, reduced=True)
    open_route(page)
    expect(page.locator(FLOW)).to_have_attribute('data-reduced', 'true')
    key_activate(page, page.locator('[data-aftershow-view="drums"]'))
    key_activate(page, page.locator('[data-aftershow-beat="6"]'))
    stage_state(page, 'drums', 6)
    key_activate(page, button(page, '把这一拍印下来'))
    phase(page, 'press')
    for count in range(1, 5):
        if count == 3:
            key_activate(page, page.locator('[data-press-offset="right"]'))
        control = page.locator(STAMP)
        wait_ready(control)
        key_activate(page, control)
        count_layers(page.locator(POSTER), count)
    title = page.locator('[data-press-title]')
    tab_to(page, title)
    page.keyboard.insert_text('静音完成')
    expect(title).to_have_value('静音完成')
    key_activate(page, page.locator('[data-press-train]'))
    phase(page, 'train')
    key_activate(page, page.locator('[data-train-stop="tunnel"]'))
    expect(page.locator(REFLECTION)).to_be_visible()
    key_activate(page, page.locator('[data-train-stop="homes"]'))
    key_activate(page, page.locator('[data-train-flip]'))
    expect(page.locator('[data-train-ticket-back]')).to_contain_text('静音完成')
    download(page, lambda: key_activate(page, button(page, '保存散场纪念图')), 'keyboard-reduced-memento.png')
    assert page.evaluate('window.aftershowAudioContexts') == 0
    no_overflow(page)
    ctx.close()
    return {'keys': ['Tab', 'Enter'], 'motion': 'reduce', 'finished': True}


def touch_slide(cdp, start, end):
    def point(x, y):
        return {'x': x, 'y': y, 'id': 1, 'radiusX': 2, 'radiusY': 2, 'force': .9}

    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point(*start)]})
    for index in range(1, 13):
        progress = index / 12
        position = [left + (right - left) * progress for left, right in zip(start, end)]
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [point(*position)]})
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})


def hit_control(locator):
    locator.scroll_into_view_if_needed()
    return locator.evaluate('''node => {
      const box = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }''')


def mobile(browser):
    cases = []
    for width, height in [(360, 800), (390, 844)]:
        ctx, page = session(browser, width, height)
        open_route(page)
        phase(page, 'stage')
        no_overflow(page)
        assert page.locator(FRAME).bounding_box()['y'] + 100 < height
        assert hit_control(button(page, '播放八拍'))
        page.locator('[data-aftershow-view="drums"]').tap()
        page.locator('[data-aftershow-beat="6"]').tap()
        stage_state(page, 'drums', 6)
        if width == 390:
            shot(page, 'stage-mobile.png', page.locator(FRAME))
        assert hit_control(button(page, '把这一拍印下来'))
        button(page, '把这一拍印下来').tap()
        phase(page, 'press')
        no_overflow(page)
        assert hit_control(page.locator(STAMP))
        stamp(page, 1)
        wait_ready(page.locator(STAMP))
        page.locator('[data-press-ink="blue"]').tap()
        plate = page.locator('[data-press-drag]')
        assert hit_control(plate)
        cdp = ctx.new_cdp_session(page)
        pos = plate.bounding_box()
        middle = (pos['x'] + pos['width'] * .35, pos['y'] + pos['height'] / 2)
        touch_slide(cdp, middle, (middle[0] + 20, middle[1]))
        candidate = page.locator(PAPER + ' [data-impression="candidate"][data-ink="blue"]')
        expect(candidate).not_to_have_attribute('data-offset-x', '0')
        stamp(page, 2)
        wait_ready(page.locator('[data-press-train]'))
        page.locator('[data-press-title]').fill(TITLE)
        if width == 390:
            shot(page, 'press-mobile.png', page.locator('[data-press-paper]'))
        assert hit_control(page.locator('[data-press-train]'))
        page.locator('[data-press-train]').tap()
        phase(page, 'train')
        no_overflow(page)
        rail = page.locator(RANGE)
        assert hit_control(rail)
        rail_pos = rail.bounding_box()
        mid = rail_pos['y'] + rail_pos['height'] / 2
        touch_slide(cdp, (rail_pos['x'] + 16, mid),
                    (rail_pos['x'] + rail_pos['width'] * .54, mid))
        progress = int(rail.input_value())
        assert 28 < progress < 76, progress
        expect(page.locator(REFLECTION)).to_be_visible()
        if width == 390:
            shot(page, 'train-tunnel-mobile.png', page.locator(TRAIN_PAPER))
        page.evaluate('window.scrollTo(0, 0)')
        # Pan outside the slider, over the stage's panel. Verify native document scrolling.
        touch_slide(cdp, (width * .34, height * .75), (width * .34, height * .34))
        page.wait_for_function('window.scrollY > 30')
        expect(rail).to_have_value(str(progress))
        arrival = page.locator('[data-train-stop="homes"]')
        assert hit_control(arrival)
        arrival.tap()
        assert hit_control(page.locator('[data-train-flip]'))
        cases.append({'width': width, 'touchProgress': progress, 'panScroll': True,
                      'blueOffset': impressions(page.locator(TRAIN_PAPER))[-1]['x']})
        ctx.close()
    return cases


def routing_and_storage(browser):
    ctx, page = session(browser, 390, 844, block_storage=True)
    open_route(page, 'play')
    page.get_by_role('button', name=re.compile('全部玩法')).click()
    expect(page.locator('#room-directory a[href$="/room/aftershow"]')).to_be_visible()
    page.get_by_role('button', name=re.compile('收起目录')).click()
    expect(page.locator('.activity-cards a[href$="/room/aftershow"]')).to_be_visible()
    page.locator('.site-tools-button').click()
    page.locator('#site-search').fill('散场以后')
    result = page.locator('.site-search-results a[href$="/room/aftershow"]')
    expect(result).to_be_visible()
    result.click()
    phase(page, 'stage')
    assert page.url.endswith('#/room/aftershow')
    open_route(page)
    page.locator('[data-aftershow-step="train"]').click()
    phase(page, 'train')
    expect(page.locator(TRAIN_PAPER).locator('[data-impression="fixed"]')).to_have_count(4)
    page.locator('[data-train-stop="homes"]').tap()
    page.locator('[data-train-flip]').tap()
    download(page, lambda: button(page, '保存散场纪念图').tap(), 'storage-blocked-default-memento.png')
    ctx.close()
    return {'entryRoutes': ['room directory', 'activity catalog', 'site search', 'shared hash route'],
            'storageDenied': True, 'defaultPosterExported': True}


def sound_preferences(browser):
    ctx, page = session(browser)
    open_route(page)
    page.get_by_role('button', name='开启互动音效', exact=True).click()
    expect(page.get_by_role('button', name='关闭互动音效', exact=True)).to_be_visible()
    page.reload(wait_until='domcontentloaded')
    expect(button(page, '播放八拍')).to_be_visible()
    assert page.evaluate('window.aftershowAudioContexts') == 0
    button(page, '播放八拍').click()
    page.wait_for_function('window.aftershowSoundStarts > 0')
    page.get_by_role('button', name='关闭互动音效', exact=True).click()
    starts = page.evaluate('window.aftershowSoundStarts')
    expect(page.locator(FRAME)).to_have_attribute('data-beat', '4', timeout=5000)
    assert page.evaluate('window.aftershowSoundStarts') == starts
    ctx.close()
    return {'silentOnEntry': True, 'restoredOnPlay': True, 'mutedOnToggle': True}


if __name__ == '__main__':
    cases = [complete_journey, rapid_and_lifecycle, keyboard_reduced, mobile, routing_and_storage, sound_preferences]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.getenv('HITORI_CHROMIUM', '/usr/bin/chromium'), args=['--no-sandbox'])
        try:
            for case in cases:
                name = case.__name__
                if os.getenv('HITORI_QA_CASE') not in (None, name):
                    continue
                REPORT['cases'][name] = case(browser)
                print(f'PASS {name}', flush=True)
        finally:
            browser.close()
            (OUT / 'results.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2) + '\n')
    assert not REPORT['pageErrors'], REPORT['pageErrors']
    assert not REPORT['consoleErrors'], REPORT['consoleErrors']
    assert not REPORT['blockedWrites'], REPORT['blockedWrites']
    print(OUT / 'results.json')
