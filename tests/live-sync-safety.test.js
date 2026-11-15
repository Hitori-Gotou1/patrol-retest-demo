import test from 'node:test';
import assert from 'node:assert/strict';
import { knownLiveTestTombstone, safeLiveTestNamespace, mayCleanLiveTestRecord } from './helpers/live-sync-safety.mjs';
const id = '11111111-1111-4111-8111-111111111111';
const tombstone = (space, entity_id) => ({ space, entity_id, deleted: true, revision: 2, payload: null });
test('real backend repeat runs allow only known deleted test entities', () => {
  const rows = [tombstone('favorite', `test-${id}`), tombstone('favorite', 'quiet-guitar'),
    tombstone('activity', 'photobooth'), tombstone('draft', 'studio'), tombstone('draft', 'photobooth'),
    tombstone('work', `test-work-${id}`), tombstone('work', `sync-${id}`), tombstone('work', '1794800000000-abc123'),
    tombstone('practice', `test-practice-${id}`), tombstone('rhythm', 'easy')];
  assert.ok(safeLiveTestNamespace([], 0)); assert.ok(safeLiveTestNamespace(rows, rows.length));
  for (const row of rows) {
    assert.ok(knownLiveTestTombstone(row));
    for (const changes of [{ deleted: false }, { payload: true }, { revision: 0 }]) assert.ok(!knownLiveTestTombstone({ ...row, ...changes }));
  }
  for (const row of [tombstone('draft', 'comic'), tombstone('work', 'personal-existing'), tombstone('favorite', 'another-image'),
    tombstone('rhythm', 'hard'), tombstone('unknown', 'photobooth')]) assert.ok(!knownLiveTestTombstone(row));
});
test('partial reads, excessive rows, active or unknown content fail before writes', () => {
  const row = tombstone('draft', 'studio');
  for (const [rows, count, maximum] of [[[row], 2, 100], [[row], null, 100], [[row, row], 2, 100], [[row], 1, 0],
    [[{ ...row, deleted: false }], 1, 100], [[tombstone('draft', 'comic')], 1, 100]]) assert.ok(!safeLiveTestNamespace(rows, count, maximum));
});
test('cleanup accepts only submitted operations or already deleted known test records', () => {
  const row = { ...tombstone('draft', 'studio'), deleted: false, payload: { version: 1 }, last_operation: id };
  assert.ok(mayCleanLiveTestRecord(row, new Set([id])));
  assert.ok(!mayCleanLiveTestRecord(row, new Set()));
  assert.ok(!mayCleanLiveTestRecord({ ...row, last_operation: 'concurrent-operation' }, new Set([id])));
  assert.ok(mayCleanLiveTestRecord(tombstone('draft', 'studio'), new Set()));
  assert.ok(!mayCleanLiveTestRecord(tombstone('draft', 'comic'), new Set()));
  assert.ok(!mayCleanLiveTestRecord(null, new Set([id])));
});
