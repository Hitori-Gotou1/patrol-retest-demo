"""Opt-in REAL Supabase browser acceptance using two dedicated accounts / three devices.

No service response is mocked. Browser login, merge, editing, favorites and conflict
choices use the real UI. REST is used only for account/data guards, read assertions,
RLS inspection and revision-checked cleanup of this run's exact keys.
Never record traces, HARs, login screenshots, storageState, passwords or sessions.
"""
import argparse
import base64
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import signal
import sys
import threading
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
PREFIX = '/patrol-retest-demo/'
PHOTO = 'hitori-room:photobooth:v1'
WORKS = 'hitori-room:workshelf:v1'
FAVORITES = 'hitori-room:favorites:v1'
ACTIVITIES = 'hitori-room:activity-favorites:v1'
FAVORITE_ID = 'quiet-guitar'
ACTIVITY_ID = 'photobooth'
EXPECTED_A = 'f72aa1d6-393d-4a6a-a0e0-709537ed170a'
UUID_PATTERN = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
POLICY_ID = re.compile(r'^test-' + UUID_PATTERN + r'$')
POLICY_WORK_ID = re.compile(r'^test-work-' + UUID_PATTERN + r'$')
POLICY_PRACTICE_ID = re.compile(r'^test-practice-' + UUID_PATTERN + r'$')
WORK_ID = re.compile(r'^(?:[0-9]{13}-[a-z0-9]{1,12}|sync-' + UUID_PATTERN + r')$')
REQUIRED = ['HITORI_SYNC_TEST_URL', 'HITORI_SYNC_TEST_PUBLIC_KEY',
            'HITORI_SYNC_TEST_A_EMAIL', 'HITORI_SYNC_TEST_A_PASSWORD',
            'HITORI_SYNC_TEST_B_EMAIL', 'HITORI_SYNC_TEST_B_PASSWORD']


def now():
    return datetime.now(timezone.utc).isoformat()


def key_of(row):
    return row['space'] + ':' + row['entity_id']


def redact_text(value, secrets):
    text = str(value)
    for secret in sorted(secrets, key=len, reverse=True):
        if secret:
            text = text.replace(secret, '[REDACTED]')
    text = re.sub(r'Bearer\s+[A-Za-z0-9._-]+', 'Bearer [REDACTED]', text)
    return re.sub(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', '[REDACTED_JWT]', text)


def safe_report(value, secrets):
    if isinstance(value, str):
        return redact_text(value, secrets)
    if isinstance(value, list):
        return [safe_report(item, secrets) for item in value]
    if isinstance(value, dict):
        return {key: safe_report(item, secrets) for key, item in value.items()}
    return value


class AcceptanceFailure(Exception):
    pass


class BackendFailure(AcceptanceFailure):
    pass


class Backend:
    def __init__(self, environment, secrets):
        self.root = environment['HITORI_SYNC_TEST_URL'].rstrip('/')
        self.public_key = environment['HITORI_SYNC_TEST_PUBLIC_KEY']
        self.credentials = {name: {'email': environment[f'HITORI_SYNC_TEST_{name}_EMAIL'],
                                   'password': environment[f'HITORI_SYNC_TEST_{name}_PASSWORD']}
                            for name in ['A', 'B']}
        self.sessions = {}
        self.secrets = secrets

    def request(self, method, endpoint, account=None, body=None, allow_denied=False):
        headers = {'apikey': self.public_key, 'Content-Type': 'application/json'}
        if account:
            headers['Authorization'] = 'Bearer ' + self.sessions[account]['token']
        request = Request(self.root + endpoint, method=method, headers=headers,
                          data=json.dumps(body).encode() if body is not None else None)
        try:
            with urlopen(request, timeout=25) as response:
                data = response.read()
                return json.loads(data) if data else None
        except HTTPError as error:
            if allow_denied and error.code in [401, 403]:
                return None
            # Auth errors can contain input or SDK details. Report only service code/status.
            try:
                code = json.loads(error.read()).get('code', 'unknown')
            except Exception:
                code = 'unknown'
            raise BackendFailure(f'Backend {method} failed: HTTP {error.code}, code {code}') from None
        except Exception as error:
            raise BackendFailure(f'Backend {method} transport failed: {type(error).__name__}') from None

    def login(self, account):
        result = self.request('POST', '/auth/v1/token?grant_type=password', body=self.credentials[account])
        token = result.get('access_token')
        uid = result.get('user', {}).get('id')
        if not token or not uid:
            raise BackendFailure('Real Auth did not return the dedicated test account')
        self.sessions[account] = {'token': token, 'uid': uid}
        self.secrets.append(token)
        if result.get('refresh_token'):
            self.secrets.append(result['refresh_token'])
        return uid

    def rows(self, account, owner=None):
        records = {}
        for offset in range(0, 6601, 300):
            query = urlencode({'select': 'space,entity_id,payload,deleted,revision,updated_at',
                               'owner_id': 'eq.' + (owner or self.sessions[account]['uid']),
                               'order': 'space.asc,entity_id.asc', 'limit': '300', 'offset': str(offset)})
            rows = self.request('GET', '/rest/v1/hitori_sync_records?' + query, account,
                                allow_denied=owner is not None)
            if rows is None and owner is not None:
                return {}
            if not isinstance(rows, list):
                raise BackendFailure('Sync table returned an invalid record list')
            for row in rows:
                records[key_of(row)] = row
            if len(rows) < 300:
                return records
        raise BackendFailure('Dedicated account exceeds the bounded test inspection limit')

    def tombstone(self, account, row):
        return self.request('POST', '/rest/v1/rpc/hitori_sync_put', account, {
            'p_space': row['space'], 'p_entity_id': row['entity_id'], 'p_payload': None,
            'p_deleted': True, 'p_expected_revision': row['revision'], 'p_operation': str(uuid4())})

    def logout_own_session(self, account):
        # Scope local avoids invalidating another concurrent test browser or gallery suite.
        self.request('POST', '/auth/v1/logout?scope=local', account)


def validate_public_config(environment):
    root = urlsplit(environment['HITORI_SYNC_TEST_URL'])
    if root.scheme != 'https' or not root.netloc or root.username or root.password or root.path not in ['', '/'] or root.query or root.fragment:
        raise AcceptanceFailure('Only an HTTPS project root is accepted for the test backend')
    key = environment['HITORI_SYNC_TEST_PUBLIC_KEY']
    public = bool(re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]+', key))
    if not public:
        try:
            payload = key.split('.')[1]
            public = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))['role'] == 'anon'
        except Exception:
            public = False
    if not public:
        raise AcceptanceFailure('Only a publishable / legacy anon key is allowed; no server credentials')


def known_tombstone(row, account):
    if row.get('deleted') is not True or row.get('payload') is not None:
        return False
    space, entity = row.get('space'), row.get('entity_id', '')
    if space == 'favorite' and POLICY_ID.fullmatch(entity):
        return True
    if ((space == 'work' and POLICY_WORK_ID.fullmatch(entity))
            or (space == 'draft' and entity == 'studio')
            or (space == 'activity' and entity == ACTIVITY_ID)
            or (space == 'practice' and POLICY_PRACTICE_ID.fullmatch(entity))
            or (space == 'rhythm' and entity == 'easy')):
        return True
    return ((space == 'work' and WORK_ID.fullmatch(entity) is not None)
            or (space == 'draft' and entity == 'photobooth')
            or (space == 'favorite' and entity == FAVORITE_ID)
            or (space == 'activity' and entity == ACTIVITY_ID))


def validate_fresh_dedicated_account(rows, account):
    # Known old test tombstones stay in place. Any active or unknown record stops all writes.
    if any(not known_tombstone(row, account) for row in rows.values()):
        raise AcceptanceFailure(f'Dedicated account {account} contains active or unrecognized records; no content was changed')


def validate_artifact(dist, backend):
    if not (dist / 'index.html').is_file() or not (dist / 'build-info.json').is_file():
        raise AcceptanceFailure('Build a real production artifact before running this acceptance')
    bundles = '\n'.join(file.read_text(errors='replace') for file in (dist / 'assets').glob('*.js'))
    if backend.root not in bundles or backend.public_key not in bundles:
        raise AcceptanceFailure('Production artifact is not configured for this exact public test backend')


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if not urlsplit(self.path).path.startswith(PREFIX):
            self.send_error(404)
            return
        self.path = '/' + self.path[len(PREFIX):]
        try:
            super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *_):
        pass


def local_snapshot(page):
    # This intentionally reads only the advertised application scopes, never auth storage.
    return page.evaluate("""({photo,works,favorites,activities})=>({
      photo:JSON.parse(localStorage.getItem(photo)||'null'),
      works:JSON.parse(localStorage.getItem(works)||'{"version":1,"works":[]}').works,
      favorites:JSON.parse(localStorage.getItem(favorites)||'[]'),
      activities:JSON.parse(localStorage.getItem(activities)||'[]')})""",
                         {'photo': PHOTO, 'works': WORKS, 'favorites': FAVORITES, 'activities': ACTIVITIES})


def status(page, uid):
    return page.evaluate("""uid=>{const state=JSON.parse(localStorage.getItem('hitori-room:sync-state:'+uid+':v1')||'{}');return {
      lastSuccess:state.lastSuccess||null,pending:Object.keys(state.outbox||{}).length,
      conflictKeys:(state.conflicts||[]).map(item=>item.key)};}""", uid)


def goto(page, base, route, first=False):
    if first:
        page.goto(base + '#' + route, wait_until='networkidle')
    else:
        page.evaluate('route=>{location.hash=route}', route)
    if route == '/settings/device':
        page.get_by_role('heading', name='设备、离线与同步').wait_for(state='visible')
    elif route == '/room/photobooth':
        page.locator('#photo-caption').wait_for(state='visible')


def wait_caption_saved(page, caption):
    page.wait_for_function("""({key,caption})=>JSON.parse(localStorage.getItem(key)||'{}').caption===caption""",
                           arg={'key': PHOTO, 'caption': caption})


def wait_sync_success(page, uid, previous=None):
    page.wait_for_function("""({uid,previous})=>{const state=JSON.parse(localStorage.getItem('hitori-room:sync-state:'+uid+':v1')||'{}');return !!state.lastSuccess&&state.lastSuccess!==previous&&!(state.conflicts||[]).length&&!Object.keys(state.outbox||{}).length;}""",
                           arg={'uid': uid, 'previous': previous})


def login_and_enable(page, base, credentials, uid, expect, first=False):
    goto(page, base, '/settings/device', first=first)
    form = page.locator('.device-login')
    expect(form).to_be_visible()
    form.locator('input[type=email]').fill(credentials['email'])
    form.locator('input[type=password]').fill(credentials['password'])
    form.get_by_role('button', name='登录同步账号', exact=True).click()
    expect(form).to_have_count(0)
    expect(page.locator('.device-account')).to_be_visible()
    page.locator('.device-merge > .device-consent input').check()
    page.get_by_role('button', name='先查看合并预览', exact=True).click()
    confirm = page.get_by_role('button', name='确认连接并合并', exact=True)
    expect(confirm).to_be_visible()
    confirm.click()
    # Re-running a dedicated test may encounter the retained photobooth tombstone.
    # Keep the newly edited test draft through the public, explicit conflict UI.
    page.wait_for_function("""uid=>{const value=JSON.parse(localStorage.getItem('hitori-room:sync-state:'+uid+':v1')||'{}');return !!value.lastSuccess||(value.conflicts||[]).length>0;}""", arg=uid)
    current = status(page, uid)
    if current['conflictKeys']:
        if current['conflictKeys'] != ['draft:photobooth']:
            raise AcceptanceFailure('First merge encountered an unexpected conflict; no automatic overwrite was attempted')
        page.locator('.device-conflicts').get_by_role('button', name='保留本机', exact=True).click()
    wait_sync_success(page, uid)


def sync_now(page, base, uid, expect):
    goto(page, base, '/settings/device')
    button = page.get_by_role('button', name='立即同步 / 失败重试', exact=True)
    expect(button).to_be_enabled()
    previous = status(page, uid)['lastSuccess']
    button.click()
    wait_sync_success(page, uid, previous)


def remote_caption(backend):
    row = backend.rows('A').get('draft:photobooth')
    return row.get('payload', {}).get('caption') if row and not row['deleted'] else None


def cleanup(backend, baseline, exact_keys, run_marker, report):
    outcomes = []
    for account in ['A', 'B']:
        if account not in baseline:
            continue
        before = baseline[account]
        current = backend.rows(account)
        allowed = exact_keys[account]
        # A failure may happen after the UI created a conflict copy but before the
        # success assertion could capture its ID. The random run marker identifies
        # only this run's newly created work; no existing row is adopted for cleanup.
        if account == 'A':
            for key, row in current.items():
                if (key not in before and row['space'] == 'work' and not row['deleted']
                        and WORK_ID.fullmatch(row['entity_id'])
                        and str(row.get('payload', {}).get('snapshot', {}).get('caption', '')).startswith(run_marker)):
                    allowed.add(key)
        for key, row in current.items():
            if key not in allowed:
                if key not in before or row != before[key]:
                    raise AcceptanceFailure('An untracked record appeared or changed; cleanup left it untouched')
                continue
            if key in before and row == before[key]:
                continue
            if row['deleted']:
                continue
            if row['space'] == 'work' and not str(row.get('payload', {}).get('snapshot', {}).get('caption', '')).startswith(run_marker):
                raise AcceptanceFailure('A tracked work no longer has this run marker; cleanup left it untouched')
            if row['space'] == 'draft' and not str(row.get('payload', {}).get('caption', '')).startswith(run_marker):
                raise AcceptanceFailure('A tracked draft no longer has this run marker; cleanup left it untouched')
            if row['space'] == 'favorite' and row.get('payload') is not True:
                raise AcceptanceFailure('Tracked favorite payload changed unexpectedly; cleanup left it untouched')
            if row['space'] == 'activity' and row.get('payload') != {'rank': 0}:
                raise AcceptanceFailure('Tracked activity payload changed unexpectedly; cleanup left it untouched')
            for attempt in range(4):
                result = backend.tombstone(account, row)
                if result.get('accepted'):
                    outcomes.append({'account': account, 'space': row['space'], 'result': 'tombstone'})
                    break
                newer = result.get('record')
                if not newer or newer.get('deleted'):
                    break
                # Only retry an unchanged test payload after a revision race.
                if newer.get('payload') != row.get('payload'):
                    raise AcceptanceFailure('Cleanup revision conflict changed the test payload; it was left untouched')
                row = newer
            else:
                raise AcceptanceFailure('Cleanup could not obtain a current test revision')
        after = backend.rows(account)
        for key in allowed:
            if key in after and not after[key]['deleted']:
                raise AcceptanceFailure('This run still has an active record after cleanup')
        for key, old in before.items():
            if key not in allowed and after.get(key) != old:
                raise AcceptanceFailure('A pre-existing test tombstone changed unexpectedly')
            if key in allowed and (key not in after or not after[key]['deleted']):
                raise AcceptanceFailure('A reused dedicated-test key was not returned to a tombstone')
    report['cleanup'] = {'result': 'PASS', 'operations': outcomes,
                         'scope': 'only this run exact created/mutated keys; old unrelated tombstones retained'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path(os.environ.get('HITORI_LIVE_OUTPUT', ROOT / 'evidence/backend-live/sync')))
    parser.add_argument('--timeout-ms', type=int, default=60000)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'result': 'NOT_RUN', 'startedAt': now(), 'backend': 'REAL Supabase; no mocked service success',
              'plannedDevices': 3, 'devicesStarted': 0, 'checks': [], 'pageErrors': [], 'cleanup': {'result': 'NOT_NEEDED'}}
    secrets = [os.environ[name] for name in REQUIRED if os.environ.get(name)]

    def redact(value):
        return redact_text(value, secrets)[:1800]

    def write_report():
        report['finishedAt'] = now()
        (args.output / 'browser-results.json').write_text(
            json.dumps(safe_report(report, secrets), ensure_ascii=False, indent=2))

    def passed(label):
        report['checks'].append(label)
        print('LIVE SYNC: ' + label, flush=True)

    missing = [name for name in REQUIRED if not os.environ.get(name)]
    if missing or os.environ.get('HITORI_SYNC_TEST_ALLOW_WRITES') != 'yes-isolated-accounts':
        report['reason'] = 'Missing isolated-account credentials or explicit write guard; real acceptance did not run'
        report['missingVariables'] = missing
        write_report()
        print(report['reason'], flush=True)
        return 2

    backend = None
    baseline = {}
    exact_keys = {'A': {'draft:photobooth', 'favorite:' + FAVORITE_ID, 'activity:' + ACTIVITY_ID}, 'B': set()}
    marker = 'LIVE-' + uuid4().hex[:8]
    report['runMarker'] = marker
    server = None
    browser = None
    preflight_complete = False
    exit_code = 1
    def cancelled(_signal, _frame):
        raise AcceptanceFailure('Runner cancelled the acceptance; attempting exact-key test cleanup')
    signal.signal(signal.SIGTERM, cancelled)
    signal.signal(signal.SIGINT, cancelled)
    try:
        validate_public_config(os.environ)
        backend = Backend(os.environ, secrets)
        validate_artifact(args.dist.resolve(), backend)
        uid_a, uid_b = backend.login('A'), backend.login('B')
        expected_a = os.environ.get('HITORI_SYNC_TEST_EXPECTED_A_UID', EXPECTED_A)
        if uid_a != expected_a or uid_a == uid_b:
            raise AcceptanceFailure('Dedicated account identity check failed; no content was changed')
        for account in ['A', 'B']:
            records = backend.rows(account)
            validate_fresh_dedicated_account(records, account)
            baseline[account] = records
        preflight_complete = True
        report['preflight'] = {'matchedExpectedA': True, 'distinctB': True,
                               'existingTestTombstones': {name: len(rows) for name, rows in baseline.items()}}
        passed('real Auth identities verified; both dedicated accounts contain only recognized test tombstones')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(args.dist.resolve())))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_port}' + PREFIX
        from playwright.sync_api import sync_playwright, expect
        with sync_playwright() as pw:
            launch = {'args': ['--no-sandbox', '--disable-dev-shm-usage']}
            executable = os.environ.get('HITORI_CHROMIUM')
            if not executable and Path('/usr/bin/chromium').exists():
                executable = '/usr/bin/chromium'
            if executable:
                launch['executable_path'] = executable
            browser = pw.chromium.launch(**launch)
            contexts = []
            for width in [1440, 390, 820]:
                context = browser.new_context(viewport={'width': width, 'height': 900},
                                              has_touch=width < 1000, is_mobile=width == 390,
                                              reduced_motion='reduce', service_workers='block')
                context.add_init_script("""try{localStorage.setItem('hitori-room:preferences:v1',JSON.stringify({version:1,font:1,line:2.1,contrast:false,motion:'reduce',metrics:false}));}catch{}""")
                context.set_default_timeout(args.timeout_ms)
                context.set_default_navigation_timeout(args.timeout_ms)
                contexts.append(context)
            first, second, other = [context.new_page() for context in contexts]
            report['devicesStarted'] = len(contexts)
            for page in [first, second, other]:
                page.on('pageerror', lambda error: report['pageErrors'].append(redact(error)))

            initial = marker + ' · 第一张合影'
            offline = marker + ' · 离线改稿'
            left = marker + ' · 设备一改稿'
            right = marker + ' · 设备二改稿'
            goto(first, base, '/room/photobooth', first=True)
            first.locator('#photo-caption').fill(initial)
            wait_caption_saved(first, initial)
            first.locator('.editor-save-work').click()
            expect(first.locator('.editor-workspace-notice')).to_contain_text('已存入作品架')
            first_works = local_snapshot(first)['works']
            if len(first_works) != 1 or first_works[0]['snapshot']['caption'] != initial:
                raise AcceptanceFailure('The real photo editor did not save exactly one test work')
            original_work_id = first_works[0]['id']
            exact_keys['A'].add('work:' + original_work_id)
            login_and_enable(first, base, backend.credentials['A'], uid_a, expect)
            passed('device A1 logged in and explicitly previewed/enabled the real local-to-cloud merge')

            goto(first, base, '/room/photobooth')
            favorite = first.locator('.activity-pin-current')
            expect(favorite).to_have_attribute('aria-pressed', 'false')
            favorite.click()
            first.wait_for_function('key=>JSON.parse(localStorage.getItem(key)||"[]").includes("photobooth")', arg=ACTIVITIES)
            goto(first, base, '/?image=' + FAVORITE_ID + '#gallery')
            expect(first.locator('.gallery-lightbox[open]')).to_be_visible()
            expect(first.locator('.lightbox-favorite')).to_have_attribute('aria-pressed', 'false')
            first.locator('.lightbox-favorite').click()
            first.wait_for_function('key=>JSON.parse(localStorage.getItem(key)||"[]").includes("quiet-guitar")', arg=FAVORITES)
            first.keyboard.press('Escape')
            sync_now(first, base, uid_a, expect)
            rows = backend.rows('A')
            if (rows.get('work:' + original_work_id, {}).get('deleted') is not False
                    or remote_caption(backend) != initial
                    or rows.get('favorite:' + FAVORITE_ID, {}).get('payload') is not True
                    or rows.get('activity:' + ACTIVITY_ID, {}).get('deleted') is not False):
                raise AcceptanceFailure('Real backend did not contain the saved work, draft, image favorite and activity favorite')
            passed('real photo work/draft, static-image favorite and favorite activity were persisted to the live backend')

            login_and_enable(second, base, backend.credentials['A'], uid_a, expect, first=True)
            snapshot = local_snapshot(second)
            if (len(snapshot['works']) != 1 or snapshot['works'][0]['id'] != original_work_id
                    or snapshot['photo']['caption'] != initial
                    or snapshot['favorites'] != [FAVORITE_ID] or snapshot['activities'] != [ACTIVITY_ID]):
                raise AcceptanceFailure('Device A2 did not load the complete supported A1 scope')
            passed('independent device A2 logged in, opted in and received the same work ID, draft and both favorites')

            login_and_enable(other, base, backend.credentials['B'], uid_b, expect, first=True)
            snapshot_b = local_snapshot(other)
            if snapshot_b['works'] or snapshot_b['photo'] is not None or snapshot_b['favorites'] or snapshot_b['activities']:
                raise AcceptanceFailure('The other account received data from A')
            if backend.rows('B', owner=uid_a):
                raise AcceptanceFailure('Real RLS exposed A records to B')
            passed('independent account B has an empty personal scope and cannot read A records through real RLS')

            goto(second, base, '/room/photobooth')
            expect(second.locator('#photo-caption')).to_have_value(initial)
            contexts[1].set_offline(True)
            second.locator('#photo-caption').fill(offline)
            wait_caption_saved(second, offline)
            second.wait_for_function("uid=>Object.hasOwn(JSON.parse(localStorage.getItem('hitori-room:sync-state:'+uid+':v1')||'{}').outbox||{},'draft:photobooth')", arg=uid_a)
            if remote_caption(backend) != initial:
                raise AcceptanceFailure('Offline edits unexpectedly changed the live server')
            contexts[1].set_offline(False)
            sync_now(second, base, uid_a, expect)
            if remote_caption(backend) != offline:
                raise AcceptanceFailure('Reconnected device did not upload its offline draft')
            sync_now(first, base, uid_a, expect)
            if local_snapshot(first)['photo']['caption'] != offline:
                raise AcceptanceFailure('The other device did not receive the reconnected draft')
            passed('real browser offline edit stayed local, queued durably, retried online and reached the other device')

            # Both devices share one acknowledged revision, then edit with no network.
            sync_now(second, base, uid_a, expect)
            contexts[0].set_offline(True)
            contexts[1].set_offline(True)
            for page, caption in [(first, left), (second, right)]:
                goto(page, base, '/room/photobooth')
                page.locator('#photo-caption').fill(caption)
                wait_caption_saved(page, caption)
            if remote_caption(backend) != offline:
                raise AcceptanceFailure('Concurrent offline setup changed the shared base')
            contexts[0].set_offline(False)
            sync_now(first, base, uid_a, expect)
            if remote_caption(backend) != left:
                raise AcceptanceFailure('Device A1 did not publish its real concurrent draft')
            contexts[1].set_offline(False)
            goto(second, base, '/settings/device')
            conflict = second.locator('.device-conflicts')
            expect(conflict).to_be_visible()
            if status(second, uid_a)['conflictKeys'] != ['draft:photobooth'] or local_snapshot(second)['photo']['caption'] != right:
                raise AcceptanceFailure('The real concurrent draft was not retained as an explicit conflict')
            conflict.screenshot(path=str(args.output / 'live-draft-conflict-mobile.png'))
            conflict.get_by_role('button', name='保留本机，云端另存版本', exact=True).click()
            wait_sync_success(second, uid_a)
            snapshot = local_snapshot(second)
            copies = [work for work in snapshot['works'] if work['id'] != original_work_id and work['snapshot'].get('caption') == left]
            if len(copies) != 1 or snapshot['photo']['caption'] != right or remote_caption(backend) != right:
                raise AcceptanceFailure('Conflict choice failed to keep both actual drafts as a draft and a work version')
            exact_keys['A'].add('work:' + copies[0]['id'])
            sync_now(first, base, uid_a, expect)
            if {work['id'] for work in local_snapshot(first)['works']} != {work['id'] for work in snapshot['works']}:
                raise AcceptanceFailure('The preserved cloud version did not reach the other device')
            passed('real two-device draft conflict preserved both edits through the explicit keep-local/save-cloud-version choice')

            sync_now(other, base, uid_b, expect)
            snapshot_b = local_snapshot(other)
            if snapshot_b['works'] or snapshot_b['photo'] is not None or snapshot_b['favorites'] or snapshot_b['activities'] or backend.rows('B', owner=uid_a):
                raise AcceptanceFailure('Account isolation failed after offline and conflict changes')
            goto(second, base, '/room/photobooth')
            expect(second.locator('#photo-caption')).to_have_value(right)
            second.locator('.room-panel').screenshot(path=str(args.output / 'live-synced-photo-mobile.png'))
            goto(first, base, '/room/works')
            expect(first.locator('.work-card')).to_have_count(2)
            first.locator('.works-grid').screenshot(path=str(args.output / 'live-synced-work-versions-desktop.png'))
            passed('B remained isolated after all changes; real saved work versions and final photo are visible on A devices')
            if report['pageErrors']:
                raise AcceptanceFailure('Browser reported an uncaught application error; see the redacted page error list')
            browser.close()
            browser = None
        report['result'] = 'PASS'
        exit_code = 0
    except Exception as error:
        report['result'] = 'FAIL'
        report['failure'] = {'type': type(error).__name__, 'message': redact(error)}
        print('LIVE SYNC failed: ' + redact(error), flush=True)
    finally:
        if browser is not None:
            try:
                browser.close()
            except Exception:
                pass
        if server is not None:
            server.shutdown()
        if backend is not None and preflight_complete:
            try:
                # Browser contexts are closed first, so their background polling cannot
                # resurrect records while the exact-key CAS cleanup is running.
                cleanup(backend, baseline, exact_keys, marker, report)
            except Exception as error:
                report['cleanup'] = {'result': 'FAIL', 'message': redact(error)}
                report['result'] = 'FAIL'
                exit_code = 1
        if backend is not None:
            for account in list(backend.sessions):
                try:
                    backend.logout_own_session(account)
                except Exception:
                    # Expiring an already closed auth session is separate from data cleanup.
                    pass
        write_report()
    print(json.dumps({'result': report['result'], 'checksPassed': len(report['checks']),
                      'cleanup': report['cleanup']['result'], 'report': str(args.output / 'browser-results.json')}, ensure_ascii=False), flush=True)
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
