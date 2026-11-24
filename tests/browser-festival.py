"""Run against a built Vite preview. Set HITORI_QA_OUTPUT to keep browser evidence."""
import json
import os
from pathlib import Path
from subprocess import check_output
from urllib.parse import urlsplit

from PIL import Image, ImageChops
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.getenv('HITORI_QA_URL', 'http://127.0.0.1:4173/patrol-retest-demo/')
OUT = Path(os.getenv('HITORI_QA_OUTPUT', ROOT / 'release' / 'festival'))
OUT.mkdir(parents=True, exist_ok=True)
PREFIX = 'hitori-room:festival:'
FESTIVAL = '#/room/festival'
REPORT = {'cases': {}, 'pageErrors': []}


def session(browser, width=1440, height=900, reduced=False, blocked=False, video=False):
    options = {'viewport': {'width': width, 'height': height}, 'has_touch': width < 700,
               'is_mobile': width < 700, 'reduced_motion': 'reduce' if reduced else 'no-preference',
               'accept_downloads': True, 'service_workers': 'block', 'locale': 'zh-CN'}
    if video:
        options.update(record_video_dir=OUT, record_video_size={'width': 1152, 'height': 720})
    context = browser.new_context(**options)
    if blocked:
        context.add_init_script("""
            const set = Storage.prototype.setItem, get = Storage.prototype.getItem;
            Storage.prototype.setItem = function(key, value) {
              if (key.startsWith('hitori-room:festival:')) throw new DOMException('Blocked test storage', 'QuotaExceededError');
              return set.call(this, key, value);
            };
            Storage.prototype.getItem = function(key) {
              if (key.startsWith('hitori-room:festival:')) throw new DOMException('Blocked test storage', 'SecurityError');
              return get.call(this, key);
            };
        """)
    context.add_init_script("""
        window.drumProbe = {starts: [], stops: 0};
        const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
        AudioBufferSourceNode.prototype.start = function(when) {
          window.drumProbe.starts.push(when);
          return start.apply(this, arguments);
        };
        AudioBufferSourceNode.prototype.stop = function() {
          window.drumProbe.stops++;
          return stop.apply(this, arguments);
        };
    """)

    def limit_to_preview(route):
        if urlsplit(route.request.url).netloc == urlsplit(BASE).netloc:
            route.continue_()
        else:
            route.fulfill(status=200, content_type='application/json', body='[]',
                          headers={'Access-Control-Allow-Origin': '*'})

    context.route('**/*', limit_to_preview)
    page = context.new_page()
    page.set_default_timeout(9000)
    page.on('pageerror', lambda error: REPORT['pageErrors'].append(str(error)))
    return context, page


def button(page, name):
    return page.locator('.fest-shell').get_by_role('button', name=name, exact=True)


def open_booth(page, booth=''):
    page.goto(BASE + FESTIVAL + ('/' + booth if booth else ''), wait_until='domcontentloaded')
    expect(page.locator('.fest-station' if booth else '.fest-desk-grid')).to_be_visible()


def stored(page, name):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))?.data', PREFIX + name + ':v1')


def capture(page, name, *, full=False):
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=OUT / name, full_page=full, animations='disabled')


def download(page, name, file, expected=None):
    with page.expect_download(timeout=30000) as info:
        button(page, name).click()
    target = OUT / file
    info.value.save_as(target)
    with Image.open(target) as source:
        source.load()
        assert source.format == 'PNG'
        assert source.mode in ('RGB', 'RGBA')
        if expected:
            assert source.size == expected, (file, source.size)
        assert len(source.convert('RGB').getcolors(source.width * source.height)) > 30
    return target


def sew(page, first, last, *, touch=False, keyboard=False):
    for pin in (first, last):
        hole = button(page, f'针孔 {pin}')
        if touch:
            hole.tap()
        elif keyboard:
            hole.press('Enter')
        else:
            hole.click()


def selected_page(page, number):
    tab = page.locator('.fest-page-tabs').get_by_role('button', name=f'第 {number} 页', exact=False)
    tab.click()


def choose_work(page, source, variant, version=1):
    page.get_by_label('稿件来源', exact=True).select_option(source)
    page.get_by_label('稿件版本', exact=True).select_option(index=version)
    page.get_by_label('选入内容', exact=True).select_option(variant)


def compare_film_cells(filename):
    with Image.open(filename) as exported:
        cells = [exported.crop((int(x * 2), int(y * 2), int((x + 172) * 2), int((y + 121) * 2)))
                 for x, y in [(23, 52), (215, 52), (407, 52), (599, 52), (23, 210)]]
        # SVG rasterization can round subpixels differently between adjacent cells.
        for repeated in cells[2:4]:
            delta = ImageChops.difference(cells[1].convert('RGB'), repeated.convert('RGB'))
            assert max(high for _, high in delta.getextrema()) <= 2
        assert ImageChops.difference(cells[0].convert('RGB'), cells[1].convert('RGB')).getbbox()
        assert ImageChops.difference(cells[1].convert('RGB'), cells[4].convert('RGB')).getbbox()


def proof_reading(png):
    with Image.open(png) as raw:
        assert raw.size == (3564, 2520)
        # Traverse the folded leaves around the slit from the bottom-right cover.
        traversal = [(1, 3), (0, 3), (0, 2), (0, 1), (0, 0), (1, 0), (1, 1), (1, 2)]
        flat = Image.new('RGB', (1188, 840), '#54404a')
        w, h = 891, 1260
        for index, (row, col) in enumerate(traversal):
            leaf = raw.crop((col * w, row * h, (col + 1) * w, (row + 1) * h)).convert('RGB')
            # The proof arrow has a high-contrast ink colour unique to the arrow.
            arrow = Image.new('L', leaf.size)
            pixels = leaf.get_flattened_data() if hasattr(leaf, 'get_flattened_data') else leaf.getdata()
            arrow.putdata([255 if rgb == (139, 78, 88) else 0 for rgb in pixels])
            bounds = arrow.getbbox()
            assert bounds and (bounds[1] > h // 2 if row == 0 else bounds[3] < h // 2)
            if row == 0:
                leaf = leaf.rotate(180)
            flat.paste(leaf.resize((287, 406)), ((index % 4) * 297 + 5, (index // 4) * 420 + 7))
        flat.save(OUT / '12-校样按折后顺序.png')


def main_journey(browser):
    context, page = session(browser, video=os.getenv('HITORI_QA_VIDEO') == '1')
    page.goto(BASE + '#/room/play')
    expect(page.locator('.festival-entry')).to_be_visible()
    capture(page, '01-活动室入口.png')
    page.get_by_role('button', name='全部玩法', exact=False).click()
    expect(page.locator('#room-directory').get_by_role('link', name='地下文化祭', exact=True)).to_be_visible()
    page.get_by_role('button', name='打开全站搜索与设置').click()
    page.locator('#site-search').fill('琴盒布章社')
    expect(page.locator('.site-search-results').get_by_role('link', name='琴盒布章社', exact=False)).to_have_attribute('href', '#/room/festival/patch')
    page.get_by_role('button', name='关闭搜索与设置').click()
    page.locator('.festival-entry').click()
    expect(page.locator('.fest-desk-card')).to_have_count(4)
    capture(page, '02-摊位桌面.png')

    page.locator('.fest-desk-card').filter(has_text='琴盒布章社').click()
    for pair in [('A', 'B'), ('C', 'D'), ('E', 'F'), ('B', 'C'), ('D', 'E'), ('F', 'A'), ('A', 'D')]:
        sew(page, *pair)
    button(page, '金黄').click()
    sew(page, 'B', 'E')
    button(page, '撤销一针').click()
    assert len(stored(page, 'patch')['pieces']['pick']['stitches']) == 7
    button(page, '重做一针').click()
    button(page, '正反面穿线').click()
    crossing = page.locator('.fest-patch-board [data-crossing]')
    expect(crossing).to_have_count(1)
    expect(crossing).to_have_attribute('data-over', 'yellow')
    page.get_by_label('交叉点 1 · 哪条线在上层').select_option(index=0)
    expect(crossing).to_have_attribute('data-over', 'blue')
    capture(page, '03-布章蓝线上层.png')
    button(page, '翻到背面').click()
    expect(page.get_by_role('img', name='布章背面针路')).to_be_visible()
    expect(page.locator('.fest-path-list')).to_contain_text('B → C')
    button(page, '装到琴盒上').click()
    page.get_by_label('布章边形').select_option('crest')
    page.get_by_label('锁边针距').select_option('3')
    button(page, '右移').click()
    page.get_by_label('角度', exact=False).press('ArrowRight')
    for number in (1, 2, 3):
        button(page, f'缝点 {number}').click()
    button(page, '揭起一角').click()
    expect(button(page, '放下布角')).to_be_visible()
    button(page, '放下布角').click()
    button(page, '拆下重放').click()
    assert stored(page, 'patch')['pieces']['pick']['mount']['pins'] == []
    for number in (1, 3):
        button(page, f'缝点 {number}').click()
    button(page, '保存为一版布章').click()
    patch = stored(page, 'editions-patch')['items'][0]
    download(page, '下载琴盒 PNG', '成品-琴盒实装.png', (1860, 1080))
    download(page, '下载正反面工艺卡', '成品-布章工艺卡.png', (1520, 860))
    page.reload(wait_until='domcontentloaded')
    expect(button(page, '缝点 3')).to_have_attribute('aria-pressed', 'true')
    assert stored(page, 'patch')['pieces']['pick']['mount']['pins'] == [0, 2]

    page.get_by_role('link', name='带去动画柜', exact=True).click()
    expect(button(page, '起始姿势')).to_be_visible()
    page.get_by_label('选择布章版本').select_option(patch['id'])
    button(page, '挂到纸偶').click()
    decoration = page.locator('.fest-pose-board [data-puppet-patch]')
    before = decoration.get_attribute('transform')
    expect(decoration.locator('[data-over="blue"]')).to_have_count(1)
    button(page, '肘关节加 5 度').press('Space')
    assert decoration.get_attribute('transform') != before
    button(page, '逐格工作台').click()
    button(page, '落棒前停三格').click()
    button(page, '复制本帧').click()
    button(page, '肩关节加 5 度').click()
    frames = stored(page, 'animation')['frames']
    assert frames[1]['pose']['shoulder'] != frames[2]['pose']['shoulder'] and frames[1]['hold'] == 3
    button(page, '前移本帧').click()
    button(page, '后移本帧').click()
    button(page, '删除本帧').click()
    button(page, '加入回弹姿势').click()
    assert len(stored(page, 'animation')['frames']) == 4
    button(page, '删除本帧').click()
    button(page, '第 1 帧').click()
    button(page, '手摇放映').click()
    expect(page.locator('.fest-counter')).to_contain_text('第 1 / 5 格')
    button(page, '下一格').press('Enter')
    expect(page.locator('.fest-counter')).to_contain_text('停留 1/3')
    crank = page.get_by_role('button', name='手柄，顺时针拖动前进，逆时针后退')
    crank.press('ArrowRight')
    expect(page.locator('.fest-counter')).to_contain_text('停留 2/3')
    crank.press('ArrowLeft')
    expect(page.locator('.fest-counter')).to_contain_text('停留 1/3')
    bounds = crank.bounding_box()
    x, y = bounds['x'] + bounds['width'] / 2, bounds['y'] + bounds['height'] / 2
    page.mouse.move(x, y - 22)
    page.mouse.down()
    page.mouse.move(x + 17, y - 14, steps=8)
    page.mouse.up()
    expect(page.locator('.fest-counter')).to_contain_text('停留 2/3')
    button(page, '打开静态逐格页').click()
    assert page.locator('.fest-static-film [data-film-slot]').evaluate_all('(cells) => cells.map(el => +el.dataset.sourceFrame)') == [1, 2, 2, 2, 3]
    capture(page, '04-手摇放映.png')
    button(page, '保存为一版动画').click()
    animation = stored(page, 'editions-animation')['items'][0]
    compare_film_cells(download(page, '下载编号帧条 PNG', '成品-动画编号帧条.png', (1600, 738)))

    page.get_by_role('navigation', name='文化祭展位').get_by_role('link', name='空场试声').click()
    button(page, '后排').click()
    button(page, '固定为调整前').click()
    button(page, '敲鼓试声').click()
    assert page.evaluate('window.drumProbe.starts.length') == 0
    row = page.locator('[data-reading="rear"]')
    expect(row).to_contain_text('47.0 ms')
    expect(row).to_contain_text('26.9%')
    button(page, '开启试听声音').click()
    page.wait_for_function('window.drumProbe.starts.length === 3')
    hits = page.evaluate('window.drumProbe.starts')
    assert round((hits[2] - hits[0]) * 1000, 1) == 17.3
    # Retrigger within the sample's lifetime, even on a heavily loaded test host.
    button(page, '敲鼓试声').evaluate('(drum) => { drum.click(); drum.click(); }')
    page.wait_for_function('window.drumProbe.starts.length >= 9 && window.drumProbe.stops > 0')
    button(page, '后墙挂帘').click()
    expect(row).to_contain_text('47.0 ms')
    expect(row).to_contain_text('1.9%')
    button(page, '查看调整前').click()
    expect(row).to_contain_text('26.9%')
    button(page, '当前试声').click()
    button(page, '慢放路径').click()
    expect(row).to_contain_text('47.0 ms')
    button(page, '静音试听').click()
    capture(page, '05-后排挂帘试声.png', full=True)
    button(page, '保存为一版试声单').click()
    report = stored(page, 'editions-soundcheck')['items'][0]
    download(page, '下载试声单 PNG', '成品-空场试声单.png', (1812, 1224))

    page.locator('.fest-output').get_by_role('link', name='去编辑部选稿').click()
    expect(page.get_by_label('稿件版本')).to_be_visible()
    choose_work(page, 'patch', 'front')
    button(page, '用选中稿件替换').click()
    page.get_by_label('短标题').fill('蓝线压过金线')
    page.get_by_label('图说或短文').fill('琴盒上的八针拨片，蓝线在上。')
    selected_page(page, 4)
    choose_work(page, 'animation', 'strip')
    button(page, '用选中稿件替换').click()
    page.get_by_label('短标题').fill('落棒前停三格')
    selected_page(page, 6)
    choose_work(page, 'soundcheck', 'compare')
    button(page, '用选中稿件替换').click()
    page.get_by_label('短标题').fill('后墙挂了吸声帘')
    page.get_by_label('图说或短文').fill('后排，后墙的反射在 47.0 ms 抵达。挂帘使强度从 26.9% 降到 1.9%。')
    button(page, '上移一页').click()
    page.reload(wait_until='domcontentloaded')
    expect(page.get_by_label('短标题')).to_have_value('后墙挂了吸声帘')
    zine = stored(page, 'zine')['pages']
    assert [item['id'] for item in zine] == ['zine-page-1', 'zine-page-2', 'zine-page-3', 'zine-page-4',
                                          'zine-page-6', 'zine-page-5', 'zine-page-7', 'zine-page-8']
    assert zine[0]['slots'][0]['asset']['data'] == patch['data']
    assert zine[3]['slots'][0]['asset']['data'] == animation['data']
    assert zine[3]['slots'][0]['asset']['last'] == 5
    assert zine[4]['slots'][0]['asset']['data'] == report['data']
    capture(page, '06-编辑部收稿换页.png', full=True)
    button(page, '屏幕阅读').click()
    button(page, '跨页校对').click()
    selected_page(page, 4)
    expect(page.locator('.fest-paper-pages svg[role=img]')).to_have_count(2)
    capture(page, '07-屏幕跨页校对.png')
    button(page, 'A4 单面折页').click()
    button(page, '切换页码与朝向校样').click()
    proof_reading(download(page, '下载高清整张 PNG', '校样-A4页码与朝向.png', (3564, 2520)))
    page.pdf(path=OUT / '校样-A4打印.pdf', prefer_css_page_size=True, print_background=True)
    button(page, '查看真实稿件').click()
    panel = page.locator('.fest-sheet')
    assert panel.locator('[data-print-page]').evaluate_all('(nodes) => nodes.map(n => [+n.dataset.printPage, +n.dataset.rotation])') == [[5, 180], [4, 180], [3, 180], [2, 180], [6, 0], [7, 0], [8, 0], [1, 0]]
    expect(panel.locator('[data-print-page="5"]')).to_contain_text('后墙挂了吸声帘')
    expect(panel.locator('[data-print-page="6"]')).to_contain_text('在透光台上')
    button(page, '查看折叠示意').click()
    for _ in range(3):
        button(page, '下一步').click()
    expect(page.locator('.fest-fold-guide')).to_contain_text('2—3、4—5、6—7')
    capture(page, '08-A4真实稿件与折法.png', full=True)
    download(page, '下载高清整张 PNG', '成品-A4八页小刊.png', (3564, 2520))
    page.pdf(path=OUT / '成品-A4打印.pdf', prefer_css_page_size=True, print_background=True)
    for filename in ('校样-A4打印.pdf', '成品-A4打印.pdf'):
        info = check_output(['pdfinfo', str(OUT / filename)], text=True)
        assert 'Pages:           1' in info and 'A4' in info and '841' in info and '594' in info, info
    body = check_output(['pdftotext', '-layout', str(OUT / '成品-A4打印.pdf'), '-'], text=True)
    assert '蓝线压过金线' in body
    # Text extraction follows the physical line direction in the upside-down row.
    assert '落棒前停三格'[::-1] in body and '后墙挂了吸声帘'[::-1] in body

    if os.getenv('HITORI_QA_VIDEO') == '1':
        context.storage_state(path=OUT / '.journey-state.json')
    video = page.video
    context.close()
    if video:
        video.save_as(OUT / '操作记录-从布章社到编辑部.webm')
        video.delete()
    return {'mountSewingPoints': [1, 3], 'overlap': 'blue over yellow', 'expandedFrames': [1, 2, 2, 2, 3],
            'rearEcho': {'ms': 47.0, 'barePercent': 26.9, 'curtainPercent': 1.9},
            'pageIds': [item['id'] for item in zine]}


def mobile_and_fresh(browser):
    results = []
    for width, height in ((360, 800), (390, 844)):
        context, page = session(browser, width, height, reduced=True)
        open_booth(page, 'zine')
        assert stored(page, 'editions-patch') is None
        expect(page.get_by_label('短标题')).to_have_value('地下文化祭')
        button(page, '文字安全区').tap()
        page.get_by_label('短标题').fill('很长的标题会触发校对反馈' * 7)
        expect(page.locator('.fest-fit-warning')).to_be_visible()
        page.get_by_label('短标题').fill('手机上的小刊')
        button(page, '放大').tap()
        button(page, '右移裁切').tap()
        button(page, '下移一页').tap()
        selected_page(page, 7)
        page.get_by_label('稿件来源', exact=True).select_option('animation')
        page.get_by_label('选入内容', exact=True).select_option('frame')
        page.get_by_label('选择一格', exact=True).select_option('4')
        button(page, '把选中稿件放进来').tap()
        assert stored(page, 'zine')['pages'][6]['slots'][0]['asset']['first'] == 4
        button(page, '移出这页').tap()
        assert stored(page, 'zine')['pages'][6]['slots'][0]['asset'] is None
        button(page, 'A4 单面折页').tap()
        capture(page, f'移动-{width}-A4折页.png')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')

        open_booth(page, 'patch')
        sew(page, 'A', 'B', touch=True)
        button(page, '空白底布').tap()
        sew(page, 'A1', 'C3', touch=True)
        button(page, '盘起的琴线').tap()
        sew(page, 'A', 'B', touch=True)
        button(page, '鼓棒').tap()
        sew(page, 'A', 'B', touch=True)
        button(page, '拨片').tap()
        sew(page, 'C', 'D', keyboard=True)
        sew(page, 'G', 'H', touch=True)
        page.get_by_label('拆除哪一针').select_option(index=3)
        button(page, '拆除').tap()
        assert len(stored(page, 'patch')['pieces']['pick']['stitches']) == 2
        button(page, '正反面穿线').tap()
        button(page, '翻到背面').press('Enter')
        expect(page.locator('.fest-path-list')).to_contain_text('B → C')
        capture(page, f'移动-{width}-布章背面.png')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')

        open_booth(page, 'animation')
        button(page, '落点').tap()
        joint = page.get_by_role('button', name='拖动肘关节；左右方向键调角度')
        joint.press('ArrowRight')
        button(page, '逐格工作台').tap()
        button(page, '在后面插入').tap()
        assert len(stored(page, 'animation')['frames']) == 4
        button(page, '手摇放映').tap()
        button(page, '下一格').tap()
        button(page, '播放').tap()
        expect(button(page, '暂停')).to_be_visible()
        button(page, '暂停').tap()
        capture(page, f'移动-{width}-放映.png')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')

        open_booth(page, 'soundcheck')
        button(page, '后墙挂帘').tap()
        expect(page.get_by_text('委托完成，可以留下试声单。')).to_be_visible()
        button(page, '后墙撤帘').tap()
        button(page, '听清两次反射的先后').tap()
        button(page, '侧台').tap()
        expect(page.get_by_text('委托完成，可以留下试声单。')).to_be_visible()
        before = page.locator('[data-reading="rear"]').inner_text()
        page.get_by_label('后墙位置', exact=False).press('ArrowRight')
        assert page.locator('[data-reading="rear"]').inner_text() != before
        button(page, '敲鼓试声').tap()
        assert page.evaluate('window.drumProbe.starts.length') == 0
        capture(page, f'移动-{width}-试声.png')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        results.append([width, height])
        context.close()
    return {'viewports': results, 'freshZine': True, 'keyboardAndTouch': True, 'reducedMotion': True, 'bothCommissions': True}


def storage_fallback(browser):
    context, page = session(browser, 390, 844, blocked=True)
    open_booth(page, 'patch')
    expect(page.locator('.fest-storage')).to_contain_text('本机存储不可用')
    sew(page, 'A', 'B', touch=True)
    button(page, '保存为一版布章').tap()
    expect(page.locator('.fest-output')).to_contain_text('已放入本次选稿架')
    download(page, '下载正反面工艺卡', '无存储-布章工艺卡.png', (1520, 860))
    page.get_by_role('navigation', name='文化祭展位').get_by_role('link', name='同人志编辑部').tap()
    choose_work(page, 'patch', 'back')
    button(page, '用选中稿件替换').tap()
    expect(page.locator('.fest-controls')).to_contain_text('布章第 1 版')
    button(page, 'A4 单面折页').tap()
    download(page, '下载高清整张 PNG', '无存储-A4小刊.png', (3564, 2520))
    context.close()
    return {'sameTabTransfer': True, 'download': True}


def version_isolation(browser):
    context, page = session(browser, reduced=True)
    open_booth(page, 'patch')
    sew(page, 'A', 'B')
    button(page, '保存为一版布章').click()
    open_booth(page, 'zine')
    choose_work(page, 'patch', 'front')
    button(page, '用选中稿件替换').click()
    first = stored(page, 'zine')['pages'][0]['slots'][0]['asset']
    open_booth(page, 'patch')
    sew(page, 'C', 'D')
    button(page, '保存为一版布章').click()
    alternatives = stored(page, 'editions-patch')['items']
    assert len(alternatives) == 2
    open_booth(page, 'zine')
    assert stored(page, 'zine')['pages'][0]['slots'][0]['asset'] == first
    choose_work(page, 'patch', 'back', version=2)
    button(page, '用选中稿件替换').click()
    selected = stored(page, 'zine')['pages'][0]['slots'][0]['asset']
    assert selected['edition'] == alternatives[1]['id'] and selected['variant'] == 'back'
    button(page, '移出这页').click()
    assert stored(page, 'editions-patch')['items'] == alternatives
    context.close()
    return {'explicitReplacement': True, 'unchangedOriginals': True}


def main():
    cases = [main_journey, mobile_and_fresh, storage_fallback, version_isolation]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.getenv('HITORI_CHROMIUM', '/usr/bin/chromium'), args=['--no-sandbox'])
        REPORT['browser'] = browser.version
        REPORT['preview'] = BASE
        try:
            for case in cases:
                if os.getenv('HITORI_QA_CASE') in (None, case.__name__):
                    REPORT['cases'][case.__name__] = case(browser)
                    print('PASS', case.__name__, flush=True)
        finally:
            browser.close()
            (OUT / 'results.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2) + '\n')
    assert not REPORT['pageErrors'], REPORT['pageErrors']


if __name__ == '__main__':
    main()
