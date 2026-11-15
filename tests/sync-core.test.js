import test from 'node:test';
import assert from 'node:assert/strict';
import { contentHash, reconcileRecord, validateSyncRecord, canSwitchAccount } from '../src/services/syncCore.js';
import { readSyncSnapshot, stageSyncSnapshot, snapshotHashes, applyStagedSnapshot } from '../src/services/syncStorage.js';
import { worksKey, saveWork, maxWorks, readWorks } from '../src/room/workshelf.js';
import { defaultPhoto } from '../src/room/playroom.js';
const store = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values }; };
const row = (payload, revision = 1, deleted = false, space = 'work') => ({ space, entity_id: 'item-1', payload, revision, deleted, updated_at: new Date(1000 * revision).toISOString() });
test('content hashes are stable across object key ordering and distinguish tombstones', async () => {
  assert.equal(await contentHash({ b: 2, a: 1 }), await contentHash({ a: 1, b: 2 }));
  assert.notEqual(await contentHash(null, true), await contentHash(null, false));
});
test('empty first device pulls a remote work rather than writing empty data over it', async () => {
  const remote = row({ title: '另一台设备的作品' });
  assert.equal((await reconcileRecord({ remote, firstConnection: true })).action, 'pull');
});
test('untouched local work accepts a later remote edit', async () => {
  const old = { title: '旧标题' }, remote = row({ title: '新标题' }, 2);
  assert.equal((await reconcileRecord({ local: { payload: old }, remote, base: { hash: await contentHash(old), revision: 1 } })).action, 'pull');
});
test('local deletion is submitted with the last known remote revision', async () => {
  const remote = row({ title: '作品' }, 4);
  const plan = await reconcileRecord({ remote, base: { hash: await contentHash(remote.payload), revision: 4 } });
  assert.equal(plan.action, 'push'); assert.equal(plan.deleted, true); assert.equal(plan.expected, 4);
});
test('concurrent delete and a newer edit requires an explicit choice', async () => {
  const plan = await reconcileRecord({ remote: row({ title: '新内容' }, 5), base: { hash: await contentHash({ title: '旧内容' }), revision: 4 } });
  assert.equal(plan.action, 'conflict');
});
test('simultaneous edits of a draft are retained as a conflict', async () => {
  const remote = row({ name: '云端编曲' }, 2, false, 'draft');
  const plan = await reconcileRecord({ local: { payload: { name: '本机编曲' } }, remote, base: { hash: await contentHash({ name: '原曲' }), revision: 1 } });
  assert.equal(plan.action, 'conflict');
});
test('first connection does not resurrect a remotely deleted bookmark', async () => {
  const plan = await reconcileRecord({ local: { payload: true }, remote: row(null, 2, true, 'favorite'), firstConnection: true });
  assert.equal(plan.action, 'pull');
});
test('concurrent rhythm records merge the higher score', async () => {
  const plan = await reconcileRecord({ local: { payload: 8000 }, remote: row(9000, 3, false, 'rhythm'), base: { hash: await contentHash(5000), revision: 1 } });
  assert.equal(plan.payload, 9000); assert.equal(plan.expected, 3);
});
test('malformed remote records are rejected before local mutation', () => {
  assert.throws(() => validateSyncRecord({ ...row({}), space: 'secrets' }));
  assert.throws(() => validateSyncRecord({ ...row({}), entity_id: '../another-user' }));
  assert.throws(() => validateSyncRecord(row({}, 0)));
  assert.throws(() => validateSyncRecord(row({}, 1, true)));
});
test('account changes cannot use dirty previous-account local data', () => {
  assert.equal(canSwitchAccount({ localOwner: 'a', userId: 'b', enabled: false, dirty: true, conflicts: false }), false);
  assert.equal(canSwitchAccount({ localOwner: 'a', userId: 'b', enabled: false, dirty: false, conflicts: true }), false);
  assert.equal(canSwitchAccount({ localOwner: 'a', userId: 'b', enabled: false, dirty: false, conflicts: false }), true);
});
test('staging a 25th version enforces the existing shelf limit and never mutates storage', () => {
  const storage = store(), records = {};
  for (let i = 0; i < maxWorks; i++) saveWork('photobooth', { ...structuredClone(defaultPhoto), caption: `合影 ${i}` }, '', storage);
  const before = storage.getItem(worksKey), local = readSyncSnapshot(storage);
  Object.assign(records, local);
  const work = structuredClone(readWorks(storage)[0]); work.id = 'extra-version'; work.title = '第二台设备的版本'; work.snapshot.caption = '新的一张';
  records['work:extra-version'] = { space: 'work', entity_id: work.id, payload: work };
  assert.throws(() => stageSyncSnapshot(records, storage), /最多放 24/);
  assert.equal(storage.getItem(worksKey), before);
});
test('drafts and works are separate records, and applying does not overwrite the active practice timer', async () => {
  const storage = store(); saveWork('photobooth', defaultPhoto, '', storage);
  storage.setItem('hitori-room:photobooth:v1', JSON.stringify(defaultPhoto));
  const timer = { id: 'session', phase: 'focus', minutes: 10, breakMinutes: 2, deadline: Date.now() + 600000, remaining: 600000 };
  storage.setItem('hitori-room:practice:v1', JSON.stringify({ version: 1, records: [], totalMinutes: 0, totalSessions: 0, current: timer }));
  const records = readSyncSnapshot(storage);
  assert.ok(records['draft:photobooth']); assert.equal(Object.keys(records).filter(key => key.startsWith('work:')).length, 1);
  const hashes = await snapshotHashes(records); assert.equal(hashes['draft:photobooth'].length, 64);
  applyStagedSnapshot(stageSyncSnapshot(records, storage), storage);
  assert.equal(JSON.parse(storage.getItem('hitori-room:practice:v1')).current.id, timer.id);
});
test('invalid cloud draft is rejected without replacing a valid local draft', () => {
  const storage = store(); storage.setItem('hitori-room:photobooth:v1', JSON.stringify(defaultPhoto));
  const original = storage.getItem('hitori-room:photobooth:v1');
  assert.throws(() => stageSyncSnapshot({ 'draft:photobooth': { space: 'draft', entity_id: 'photobooth', payload: { version: 999 } } }, storage));
  assert.equal(storage.getItem('hitori-room:photobooth:v1'), original);
});
test('first connection with a same-ID work and remote tombstone preserves an explicit conflict', async () => {
  for (const space of ['work','draft','practice']) {
    const plan = await reconcileRecord({ local: { payload: { title: '本机新内容' } }, remote: row(null, 3, true, space), firstConnection: true });
    assert.equal(plan.action, 'conflict');
  }
});
test('same snapshot with distinct IDs and metadata stays as two saved versions', () => {
  const storage = store(); saveWork('photobooth', defaultPhoto, '', storage);
  const original = readWorks(storage)[0];
  const a = { ...original, id: 'work-a', title: 'A', tags: ['A'], pinned: false };
  const b = { ...original, id: 'work-b', title: 'B', tags: ['B'], pinned: true };
  const records = { 'work:work-a': { space: 'work', entity_id: a.id, payload: a }, 'work:work-b': { space: 'work', entity_id: b.id, payload: b } };
  applyStagedSnapshot(stageSyncSnapshot(records, storage), storage);
  const works = readWorks(storage); assert.equal(works.length, 2);
  assert.equal(works.find(work => work.id === 'work-b').pinned, true);
  assert.deepEqual(works.find(work => work.id === 'work-b').tags, ['B']);
});
test('work tombstones are submitted before replacements when a full shelf changes', async () => {
  const { orderSyncPlans } = await import('../src/services/syncCore.js');
  const plans = [{ space: 'work', entity_id: 'new', payload: { large: 'payload' }, deleted: false }, { space: 'work', entity_id: 'old', payload: null, deleted: true }];
  assert.equal(orderSyncPlans(plans)[0].entity_id, 'old');
});
