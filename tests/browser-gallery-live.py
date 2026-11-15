"""Opt-in REAL gallery UI acceptance with dedicated accounts and exact-resource cleanup.

HITORI_SYNC_TEST_* credentials and ALLOW_WRITES=yes-isolated-accounts are mandatory.
No fixture responses are used. No storage state, HAR, trace, credentials or tokens are saved.
--guard-only performs configuration/build checks without network or browser startup.
"""
import argparse
import base64
import hashlib
import io
import json
import os
import re
import threading
import time
import uuid
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlencode, urlsplit
from urllib.request import Request, urlopen
from PIL import Image, ImageDraw, PngImagePlugin
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = '/patrol-retest-demo/'
EXPECTED_A_UID = 'f72aa1d6-393d-4a6a-a0e0-709537ed170a'
UUID4 = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
RESOURCE = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?:-thumb|-preview)?\.(?:png|webp|jpg)$')
SAFE_CODE = re.compile(r'^[a-zA-Z0-9_-]{1,32}$')

class LiveFailure(Exception):
    def __init__(self, check, code='CHECK_FAILED'):
        super().__init__(check)
        self.check = check
        self.safe_code = code if SAFE_CODE.fullmatch(str(code)) else 'SERVICE_ERROR'

def require(condition, check):
    if not condition:
        raise LiveFailure(check)

def configuration(env):
    if env.get('HITORI_SYNC_TEST_ALLOW_WRITES') != 'yes-isolated-accounts':
        raise LiveFailure('explicit_isolated_write_authorization_required', 'CONFIG')
    names = ['URL', 'PUBLIC_KEY', 'A_EMAIL', 'A_PASSWORD', 'B_EMAIL', 'B_PASSWORD']
    if any(not env.get('HITORI_SYNC_TEST_'+name) for name in names):
        raise LiveFailure('isolated_account_configuration_required', 'CONFIG')
    config = {name: env['HITORI_SYNC_TEST_'+name] for name in names}
    parsed = urlsplit(config['URL'])
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise LiveFailure('valid_https_project_root_required', 'CONFIG')
    config['URL'] = config['URL'].rstrip('/')
    public_key = bool(re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]+', config['PUBLIC_KEY']))
    if not public_key:
        try:
            payload = config['PUBLIC_KEY'].split('.')[1]
            public_key = json.loads(base64.urlsafe_b64decode(payload+'='*((4-len(payload)%4)%4)))['role'] == 'anon'
        except Exception:
            public_key = False
    if not public_key:
        raise LiveFailure('public_key_only_required', 'CONFIG')
    if env.get('HITORI_SYNC_TEST_A_UID', EXPECTED_A_UID) != EXPECTED_A_UID:
        raise LiveFailure('fixed_dedicated_account_a_uid_required', 'CONFIG')
    if config['A_EMAIL'].strip().lower() == config['B_EMAIL'].strip().lower():
        raise LiveFailure('two_distinct_test_accounts_required', 'CONFIG')
    config['B_UID'] = env.get('HITORI_SYNC_TEST_B_UID', '')
    if config['B_UID'] and (not re.fullmatch(r'[a-f0-9-]{36}', config['B_UID']) or config['B_UID'] == EXPECTED_A_UID):
        raise LiveFailure('distinct_account_b_uid_required', 'CONFIG')
    return config

def generated_resource_path(path):
    parts = path.split('/')
    return len(parts) == 2 and parts[0] == EXPECTED_A_UID and RESOURCE.fullmatch(parts[1]) is not None

class LiveApi:
    def __init__(self, config):
        self.config = config
        self.tokens = {}
        self.user_ids = {}

    def request(self, method, path, body=None, role='A', binary=False):
        headers = {'apikey': self.config['PUBLIC_KEY']}
        if role in self.tokens:
            headers['Authorization'] = 'Bearer '+self.tokens[role]
        if body is not None:
            headers['Content-Type'] = 'application/json'
        request = Request(self.config['URL']+path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
        try:
            with urlopen(request, timeout=20) as response:
                raw = response.read()
                return raw if binary else (json.loads(raw) if raw else None)
        except HTTPError as error:
            code = 'HTTP_'+str(error.code)
            try:
                detail = json.loads(error.read())
                value = str(detail.get('code', ''))
                if SAFE_CODE.fullmatch(value):
                    code = value
            except Exception:
                pass
            raise LiveFailure('real_backend_request', code) from None
        except (URLError, TimeoutError):
            raise LiveFailure('real_backend_request', 'NETWORK') from None

    def login(self, role, expected=''):
        data = self.request('POST', '/auth/v1/token?grant_type=password', {'email': self.config[role+'_EMAIL'], 'password': self.config[role+'_PASSWORD']}, role='')
        require(isinstance(data, dict) and data.get('access_token') and data.get('user', {}).get('id'), 'authenticated_dedicated_identity')
        self.tokens[role] = data['access_token']
        user = self.request('GET', '/auth/v1/user', role=role)
        uid = user.get('id')
        require(uid == data['user']['id'] and (not expected or uid == expected), 'authenticated_dedicated_identity')
        self.user_ids[role] = uid
        return uid

    def select(self, table, filters, fields='*', role='A', limit=None):
        params = {'select': fields, **{key: 'eq.'+str(value).lower() if isinstance(value, bool) else 'eq.'+str(value) for key, value in filters.items()}}
        if limit:
            params['limit'] = str(limit)
        data = self.request('GET', '/rest/v1/'+table+'?'+urlencode(params), role=role)
        require(isinstance(data, list), 'backend_response_shape')
        return data

    def exact_image(self, image_id):
        rows = self.select('gallery_uploads', {'id': image_id, 'owner_id': EXPECTED_A_UID})
        require(len(rows) == 1, 'generated_image_exact_read')
        return rows[0]

    def hide(self, image_id):
        self.request('PATCH', '/rest/v1/gallery_uploads?'+urlencode({'id': 'eq.'+image_id, 'owner_id': 'eq.'+EXPECTED_A_UID}), {'published': False})

    def delete_exact(self, table, item_id):
        require(UUID4.fullmatch(item_id) is not None and table in ('gallery_uploads', 'gallery_collections'), 'generated_delete_guard')
        self.request('DELETE', '/rest/v1/'+table+'?'+urlencode({'id': 'eq.'+item_id, 'owner_id': 'eq.'+EXPECTED_A_UID}))

    def public_bytes(self, path):
        require(generated_resource_path(path), 'generated_download_guard')
        return self.request('GET', '/storage/v1/object/public/gallery-uploads/'+quote(path, safe='/'), role='', binary=True)

class Capture:
    def __init__(self, marker, config, api):
        self.marker = marker
        self.config = config
        self.api = api
        self.images = {}
        self.collections = set()
        self.paths = set()
        self.planned_ids = set()
        self.file_hashes = set()
        self.allow_upload = False
        self.unsafe = False

    def intercept(self, route, origin, role):
        request = route.request
        parsed = urlsplit(request.url)
        if parsed.netloc == urlsplit(origin).netloc:
            if request.method in ('GET', 'HEAD'):
                route.continue_()
            else:
                self.unsafe = True
                route.abort()
            return
        if parsed.scheme != 'https' or parsed.netloc != urlsplit(self.config['URL']).netloc:
            self.unsafe = True
            route.abort()
            return
        if request.method == 'OPTIONS':
            route.continue_()
            return
        try:
            if self.allow_backend(request, parsed, role):
                route.continue_()
            else:
                self.unsafe = True
                route.abort()
        except Exception:
            self.unsafe = True
            route.abort()

    def allow_backend(self, request, parsed, role):
        path, method, query = parsed.path, request.method, parse_qs(parsed.query)
        if path == '/auth/v1/token' and method == 'POST':
            data = request.post_data_json
            return data.get('email') == self.config[role+'_EMAIL'] and data.get('password') == self.config[role+'_PASSWORD']
        if path in ('/auth/v1/user', '/auth/v1/logout'):
            return method in ('GET', 'POST')
        if path == '/rest/v1/gallery_admins' and method == 'GET':
            return query.get('user_id') == ['eq.'+self.api.user_ids[role]]
        storage_prefix = '/storage/v1/object/gallery-uploads/'
        if path.startswith(storage_prefix) and method == 'POST' and role == 'A' and self.allow_upload:
            target = unquote(path[len(storage_prefix):])
            if not generated_resource_path(target) or (request.header_value('x-upsert') or 'false').lower() != 'false':
                return False
            if target not in self.paths:
                # Do not let even an accidental UUID collision enter the cleanup registry.
                existing = self.api.request('POST', '/storage/v1/object/list/gallery-uploads',
                    {'prefix': EXPECTED_A_UID, 'limit': 10, 'offset': 0, 'search': target.split('/')[1]})
                if not isinstance(existing, list) or any(item.get('name') == target.split('/')[1] for item in existing):
                    return False
            self.paths.add(target)
            return True
        if path == '/storage/v1/object/gallery-uploads' and method == 'DELETE' and role == 'A':
            prefixes = request.post_data_json.get('prefixes', [])
            return bool(prefixes) and all(item in self.paths for item in prefixes)
        public_prefix = '/storage/v1/object/public/gallery-uploads/'
        if path.startswith(public_prefix) and method == 'GET':
            return unquote(path[len(public_prefix):]) in self.paths
        if path == '/rest/v1/gallery_uploads':
            if method == 'GET':
                if query.get('owner_id') == ['eq.'+EXPECTED_A_UID] and role == 'A':
                    return True
                digest = query.get('content_sha256', [''])[0]
                if role == 'A' and digest.startswith('eq.') and digest[3:] in self.file_hashes:
                    return True
                item = query.get('id', [''])[0]
                if role == 'A' and item.startswith('eq.') and UUID4.fullmatch(item[3:]):
                    item_id = item[3:]
                    if item_id in self.images or item_id in self.planned_ids:
                        return True
                    if self.allow_upload and len(self.planned_ids) < 2:
                        self.planned_ids.add(item_id)
                        return True
                return False
            if method == 'POST' and role == 'A' and self.allow_upload:
                data = request.post_data_json
                if isinstance(data, list):
                    if len(data) != 1:
                        return False
                    data = data[0]
                item_id = data.get('id', '')
                valid = item_id in self.planned_ids and data.get('owner_id') == EXPECTED_A_UID and data.get('title', '').startswith(self.marker) and data.get('content_sha256') in self.file_hashes
                valid = valid and all(data.get(field) in self.paths for field in ('object_path', 'thumbnail_path', 'preview_path'))
                if valid:
                    self.images[item_id] = {key: data.get(key) for key in ('id','object_path','thumbnail_path','preview_path','title','width','height','characters','category','tags')}
                return valid
            if method == 'PATCH' and role == 'A':
                item = query.get('id', [''])[0]
                data = request.post_data_json
                return item.startswith('eq.') and item[3:] in self.images and ('title' not in data or data['title'].startswith(self.marker))
            return False
        if path == '/rest/v1/gallery_collections' and method == 'GET':
            return role == 'A' and query.get('owner_id') == ['eq.'+EXPECTED_A_UID]
        if path == '/rest/v1/rpc/gallery_save_collection' and method == 'POST' and role == 'A':
            data = request.post_data_json
            item_id = data.get('collection_id', '')
            members = data.get('image_ids', [])
            valid = UUID4.fullmatch(item_id) is not None and data.get('details', {}).get('title', '').startswith(self.marker)
            valid = valid and bool(members) and all(member.startswith('cloud-') and member[6:] in self.images for member in members)
            if valid:
                self.collections.add(item_id)
            return valid
        return False

class PagesHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if not urlsplit(self.path).path.startswith(BASE):
            self.send_error(404)
            return
        self.path = '/'+self.path[len(BASE):]
        super().do_GET()

    def log_message(self, *_args):
        pass

def build_guard(dist):
    info = json.loads((dist/'build-info.json').read_text())
    entry = (dist/info['entry']).resolve()
    require(info.get('base') == BASE and entry.is_relative_to(dist.resolve()) and entry.is_file(), 'pages_build_prefix_and_entry')

def generated_png(marker, index):
    size = (3000, 2000) if index == 0 else (2000, 3000)
    image = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    width, height = size
    draw.rounded_rectangle((180, 180, width-180, height-180), radius=100, fill=(240, 132+index*20, 180, 160))
    draw.rectangle((350, 400, width-350, height-400), outline=(255, 241, 210, 255), width=35)
    draw.text((400, height//2), marker+' / '+str(index+1), fill=(58, 35, 65, 255), stroke_width=2)
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text('hitori-live-check', marker+':'+str(index))
    output = io.BytesIO()
    image.save(output, format='PNG', pnginfo=metadata)
    return output.getvalue()

def save_redacted(page, output):
    page.evaluate("document.activeElement?.blur();scrollTo({top:0,behavior:'instant'})")
    page.screenshot(path=str(output), full_page=True,
        mask=[page.locator('.admin-session,input[type=email],input[type=password]')],
        style='.admin-session,input[type=email],input[type=password]{visibility:hidden!important}')

def cleanup(api, capture):
    result = {'attempted': True, 'collections': True, 'images': True, 'storage': True, 'verifiedAbsent': True, 'complete': False}
    for table, items in [('gallery_collections', capture.collections), ('gallery_uploads', capture.images)]:
        for item_id in items:
            succeeded = False
            for _ in range(3):
                try:
                    api.delete_exact(table, item_id)
                    succeeded = True
                    break
                except Exception:
                    time.sleep(.3)
            if not succeeded:
                result['collections' if table == 'gallery_collections' else 'images'] = False
    for path in capture.paths:
        succeeded = False
        for _ in range(3):
            try:
                require(generated_resource_path(path), 'generated_storage_cleanup_guard')
                api.request('DELETE', '/storage/v1/object/gallery-uploads', {'prefixes': [path]})
                succeeded = True
                break
            except Exception:
                time.sleep(.3)
        if not succeeded:
            result['storage'] = False
    for table, items in [('gallery_collections', capture.collections), ('gallery_uploads', capture.images)]:
        for item_id in items:
            try:
                if api.select(table, {'id': item_id, 'owner_id': EXPECTED_A_UID}, fields='id'):
                    result['verifiedAbsent'] = False
            except Exception:
                result['verifiedAbsent'] = False
    for path in capture.paths:
        try:
            name = path.split('/')[1]
            items = api.request('POST', '/storage/v1/object/list/gallery-uploads', {'prefix': EXPECTED_A_UID, 'limit': 10, 'offset': 0, 'search': name})
            if not isinstance(items, list) or any(item.get('name') == name for item in items):
                result['verifiedAbsent'] = False
        except Exception:
            result['verifiedAbsent'] = False
    result['complete'] = all(result[key] for key in ('collections', 'images', 'storage', 'verifiedAbsent'))
    return result

def run(dist, env=None, guard_only=False):
    env = os.environ if env is None else env
    output = Path(env.get('REPORT_DIR') or env.get('HITORI_SYNC_TEST_REPORT_DIR') or '/tmp/hitori-gallery-live')
    report = {'backend': 'real-supabase-browser', 'status': 'NOT_RUN', 'liveBackendAttempted': False,
              'verified': False, 'checks': [], 'pageErrorsObserved': False, 'unsafeRequestsBlocked': False,
              'cleanup': {'attempted': False, 'complete': False}, 'failure': None}
    config = api = capture = server = browser = context_a = context_b = None
    active_step = 'configuration_guard'
    def passed(name):
        report['checks'].append({'name': name, 'passed': True})
    try:
        config = configuration(env)
        build_guard(dist)
        passed('explicit_public_configuration_fixed_account_and_pages_build_guards')
        if guard_only:
            passed('guard_only_no_network_or_browser_startup')
        else:
            api = LiveApi(config)
            report['liveBackendAttempted'] = True
            active_step = 'real_authentication_and_empty_dedicated_owner_guard'
            uid_a = api.login('A', EXPECTED_A_UID)
            uid_b = api.login('B', config['B_UID'])
            require(uid_a != uid_b, active_step)
            require(len(api.select('gallery_admins', {'user_id': uid_a}, fields='user_id')) == 1, active_step)
            require(api.select('gallery_admins', {'user_id': uid_b}, fields='user_id', role='B') == [], active_step)
            require(api.select('gallery_uploads', {'owner_id': uid_a}, fields='id,preview_path,characters,category,tags,published,sort_order', limit=1) == [], active_step)
            require(api.select('gallery_collections', {'owner_id': uid_a}, fields='id', limit=1) == [], active_step)
            passed(active_step)
            marker = 'LIVE-GALLERY-'+uuid.uuid4().hex
            capture = Capture(marker, config, api)
            payloads = [generated_png(marker, index) for index in range(2)]
            capture.file_hashes = {hashlib.sha256(payload).hexdigest() for payload in payloads}
            server = ThreadingHTTPServer(('127.0.0.1', 0), partial(PagesHandler, directory=str(dist.resolve())))
            threading.Thread(target=server.serve_forever, daemon=True).start()
            origin = 'http://127.0.0.1:'+str(server.server_port)
            base = origin+BASE
            output.mkdir(parents=True, exist_ok=True)
            with sync_playwright() as playwright:
                executable = env.get('HITORI_CHROMIUM_EXECUTABLE')
                browser = playwright.chromium.launch(**({'executable_path': executable} if executable else {}), args=['--no-sandbox'])
                def new_context(role, width=390):
                    context = browser.new_context(viewport={'width': width, 'height': 844}, reduced_motion='reduce', service_workers='block')
                    context.route('**/*', lambda route: capture.intercept(route, origin, role))
                    context.on('page', lambda page: page.on('pageerror', lambda _error: report.__setitem__('pageErrorsObserved', True)))
                    return context
                def login_ui(context, role):
                    page = context.new_page()
                    page.goto(base+'#/manage-gallery', wait_until='domcontentloaded')
                    page.locator('#owner-email').fill(config[role+'_EMAIL'])
                    page.locator('#owner-password').fill(config[role+'_PASSWORD'])
                    page.locator('.admin-login button[type=submit]').click()
                    return page
                active_step = 'real_browser_a_login_and_two_file_metadata_queue'
                context_a = new_context('A')
                page = login_ui(context_a, 'A')
                expect(page.locator('.admin-tabs')).to_be_visible(timeout=30000)
                page.locator('#gallery-upload-file').set_input_files([
                    {'name': marker+'-01.png', 'mimeType': 'image/png', 'buffer': payloads[0]},
                    {'name': marker+'-02.png', 'mimeType': 'image/png', 'buffer': payloads[1]}])
                expect(page.locator('.queue-list>li')).to_have_count(2, timeout=30000)
                for index, characters in enumerate([['后藤一里', '喜多郁代'], ['伊地知虹夏', '山田凉']]):
                    task = page.locator('.queue-list>li').nth(index)
                    task.locator('details>summary').click()
                    task.locator('input[id$="-title"]').fill(marker+'-0'+str(index+1))
                    task.locator('textarea[id$="-alt"]').fill('本次真实浏览器验收生成图形，测试后自动清理。')
                    task.locator('input[id$="-creator"]').fill('一里小屋 · 隔离验收图形')
                    task.locator('input[id$="-credit"]').fill('本站生成的临时验收图形')
                    task.locator('select[id$="-category"]').select_option('illustration' if index == 0 else 'poster')
                    for character in characters:
                        task.get_by_label(character, exact=True).check()
                    task.locator('input[id$="-tags"]').fill('隔离验收，雨夜')
                require(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), active_step)
                passed(active_step)
                active_step = 'real_sequential_upload_and_cloud_1920_preview_bytes'
                capture.allow_upload = True
                page.get_by_role('button', name='开始发布 2 张', exact=True).click()
                uploaded = []
                for index in range(2):
                    page.wait_for_function('(count)=>document.querySelectorAll(".task-done").length>=count', arg=index+1, timeout=120000)
                    records = [row for row in capture.images.values() if row['title'] == marker+'-0'+str(index+1)]
                    require(len(records) == 1, active_step)
                    row = api.exact_image(records[0]['id'])
                    # The UI has genuinely published this row. Close its visibility window immediately.
                    require(row['published'] is True, active_step)
                    api.hide(row['id'])
                    require(row['category'] == ('illustration' if index == 0 else 'poster') and len(row['characters']) == 2 and row['tags'] == ['隔离验收','雨夜'], active_step)
                    preview = Image.open(io.BytesIO(api.public_bytes(row['preview_path'])))
                    thumb = Image.open(io.BytesIO(api.public_bytes(row['thumbnail_path'])))
                    require(preview.size == ((1920,1280) if index == 0 else (1280,1920)), active_step)
                    require(thumb.size == ((640,427) if index == 0 else (427,640)), active_step)
                    require(preview.mode == 'RGBA' and preview.getpixel((0,0))[3] == 0, active_step)
                    require(row['object_path'] != row['preview_path'] and row['preview_path'] in capture.paths, active_step)
                    uploaded.append(row)
                capture.allow_upload = False
                expect(page.locator('.task-done')).to_have_count(2)
                save_redacted(page, output/'gallery-live-upload-mobile.png')
                passed(active_step)
                active_step = 'real_ui_search_metadata_edit_sort_hide_and_restore'
                page.get_by_role('button', name='已发布图片', exact=True).click()
                page.locator('.workbench-filters input[type=search]').fill(marker+'-01')
                page.locator('.workbench-filters button').click()
                expect(page.locator('.published-list>li')).to_have_count(1, timeout=30000)
                page.get_by_role('button', name='编辑信息与顺序', exact=True).click()
                edited_title = marker+'-01-edited'
                page.locator('.edit-image input[id$="-title"]').fill(edited_title)
                page.locator('.edit-image input[type=number]').fill('999998')
                page.get_by_role('button', name='保存修改', exact=True).click()
                expect(page.locator('.published-list h3')).to_have_text(edited_title, timeout=30000)
                current = api.exact_image(uploaded[0]['id'])
                require(current['sort_order'] == 999998 and current['title'] == edited_title and current['object_path'] == uploaded[0]['object_path'], active_step)
                page.get_by_role('button', name='恢复展示', exact=True).click()
                expect(page.get_by_role('button', name='下架', exact=True)).to_be_visible(timeout=30000)
                require(api.exact_image(current['id'])['published'] is True, active_step)
                page.get_by_role('button', name='下架', exact=True).click()
                expect(page.get_by_role('button', name='恢复展示', exact=True)).to_be_visible(timeout=30000)
                require(api.exact_image(current['id'])['published'] is False, active_step)
                require(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), active_step)
                save_redacted(page, output/'gallery-live-workbench-mobile.png')
                passed(active_step)
                active_step = 'real_ui_private_collection_two_members_and_order'
                page.get_by_role('button', name='主题合集', exact=True).click()
                page.get_by_role('button', name='新建合集', exact=True).click()
                page.get_by_label('合集标题', exact=True).fill(marker+'-collection')
                page.get_by_label('简介', exact=True).fill('本次真实浏览器验收的临时合集，随后精确清理。')
                members = ['cloud-'+row['id'] for row in uploaded]
                page.get_by_label('图片编号（每行一个，按展示顺序排列）', exact=True).fill('\n'.join(members))
                page.get_by_label('展示顺序', exact=True).fill('999999')
                page.get_by_label('在公开合集页展示', exact=True).uncheck()
                page.get_by_role('button', name='保存合集', exact=True).click()
                expect(page.locator('.collection-list').first).to_contain_text(marker+'-collection', timeout=30000)
                require(len(capture.collections) == 1, active_step)
                collection_id = next(iter(capture.collections))
                collections = api.select('gallery_collections', {'id': collection_id, 'owner_id': uid_a}, fields='id,published,sort_order,gallery_collection_items(image_id,sort_order)')
                require(len(collections) == 1 and collections[0]['published'] is False and collections[0]['sort_order'] == 999999, active_step)
                actual_members = [item['image_id'] for item in sorted(collections[0]['gallery_collection_items'], key=lambda item:item['sort_order'])]
                require(actual_members == members, active_step)
                page.set_viewport_size({'width':1440,'height':900})
                require(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), active_step)
                save_redacted(page, output/'gallery-live-collections-desktop.png')
                passed(active_step)
                active_step = 'real_browser_b_non_owner_notice_and_no_management_controls'
                context_b = new_context('B')
                bpage = login_ui(context_b, 'B')
                expect(bpage.get_by_role('heading', name='这个账号没有上传权限', exact=True)).to_be_visible(timeout=30000)
                expect(bpage.locator('.admin-tabs,.admin-upload')).to_have_count(0)
                save_redacted(bpage, output/'gallery-live-b-denied-redacted.png')
                passed(active_step)
                report['unsafeRequestsBlocked'] = capture.unsafe
                require(not capture.unsafe and not report['pageErrorsObserved'], 'no_unexpected_network_writes_or_browser_errors')
                passed('no_unexpected_network_writes_or_browser_errors')
                report['status'] = 'PASS'
                report['verified'] = True
                context_b.close(); context_b = None
                context_a.close(); context_a = None
                browser.close(); browser = None
    except LiveFailure as error:
        report['status'] = 'FAIL' if report['liveBackendAttempted'] else 'NOT_RUN'
        report['failure'] = {'check': active_step, 'code': error.safe_code}
    except Exception as error:
        report['status'] = 'FAIL' if report['liveBackendAttempted'] else 'NOT_RUN'
        report['failure'] = {'check': active_step, 'code': type(error).__name__ if SAFE_CODE.fullmatch(type(error).__name__) else 'BROWSER_OR_SERVICE_ERROR'}
    finally:
        for context in (context_b, context_a):
            if context:
                try: context.close()
                except Exception: pass
        if browser:
            try: browser.close()
            except Exception: pass
        if capture and api:
            report['unsafeRequestsBlocked'] = capture.unsafe
            # Browser closure aborts outstanding requests. Use only the paths/IDs captured before each attempted write.
            time.sleep(.5)
            report['cleanup'] = cleanup(api, capture)
            if not report['cleanup']['complete']:
                report['status'] = 'FAIL'; report['verified'] = False
                report['failure'] = report['failure'] or {'check':'exact_generated_resource_cleanup','code':'CLEANUP_INCOMPLETE'}
        if api:
            for role in api.tokens:
                try: api.request('POST', '/auth/v1/logout?scope=local', role=role)
                except Exception: pass
        if server:
            server.shutdown(); server.server_close()
    output.mkdir(parents=True, exist_ok=True)
    (output/'browser-gallery-live.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Explicitly authorized real gallery UI acceptance; no production owner data is modified.')
    parser.add_argument('--dist', type=Path, required=True)
    parser.add_argument('--guard-only', action='store_true')
    args = parser.parse_args()
    result = run(args.dist, guard_only=args.guard_only)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['status']=='PASS' else 2 if result['status']=='NOT_RUN' else 1)
