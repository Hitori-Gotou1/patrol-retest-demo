// Guards for opt-in, dedicated-account REAL backend checks; never relax app policy.
export const EXPECTED_LIVE_TEST_A = 'f72aa1d6-393d-4a6a-a0e0-709537ed170a';
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const generated = prefix => new RegExp(`^${prefix}${uuid}$`);
const favoriteId = generated('test-'), workId = generated('test-work-'), conflictWorkId = generated('sync-'), practiceId = generated('test-practice-');
export function knownLiveTestTombstone(row) {
  if (!row || row.deleted !== true || (row.payload !== undefined && row.payload !== null)
    || !Number.isSafeInteger(Number(row.revision)) || Number(row.revision) < 1) return false;
  switch (row.space) {
    case 'favorite': return row.entity_id === 'quiet-guitar' || favoriteId.test(row.entity_id);
    case 'activity': return row.entity_id === 'photobooth';
    case 'draft': return ['photobooth', 'studio'].includes(row.entity_id);
    case 'work': return workId.test(row.entity_id) || conflictWorkId.test(row.entity_id) || /^\d{13}-[a-z0-9]{1,12}$/.test(row.entity_id);
    case 'practice': return practiceId.test(row.entity_id);
    case 'rhythm': return row.entity_id === 'easy';
    default: return false;
  }
}
export function safeLiveTestNamespace(rows, count, maximum = 100) {
  return Array.isArray(rows) && Number.isInteger(count) && count >= 0 && count <= maximum
    && count === rows.length && new Set(rows.map(row => `${row.space}:${row.entity_id}`)).size === count
    && rows.every(knownLiveTestTombstone);
}
export function mayCleanLiveTestRecord(row, operations) {
  // An unrelated concurrent mutation must never be overwritten by cleanup.
  return !!row && (knownLiveTestTombstone(row) || (!row.deleted && operations.has(row.last_operation)));
}
