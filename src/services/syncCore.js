// Per-record, revision-based sync. This is deliberately not an import/export format.
export const syncSpaces = ['work', 'draft', 'favorite', 'activity', 'practice', 'rhythm'];
export const recordKey = value => `${value.space}:${value.entity_id}`;
export const stableJson = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export async function contentHash(value, deleted = false) {
  const bytes = new TextEncoder().encode(deleted ? 'deleted' : stableJson(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function validateSyncRecord(row) {
  if (!row || !syncSpaces.includes(row.space) || typeof row.entity_id !== 'string' || !/^[\w-]{1,100}$/.test(row.entity_id)
    || !Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.deleted !== 'boolean'
    || (row.deleted ? row.payload !== null : row.payload == null)
    || new TextEncoder().encode(JSON.stringify(row.payload)).length > 900000) throw new Error('云端同步记录格式无法读取，本机内容未被替换。');
  return { space: row.space, entity_id: row.entity_id, revision: row.revision, deleted: row.deleted,
    payload: row.payload, updated_at: row.updated_at, last_operation: row.last_operation };
}
export async function describeRecord(row) {
  return { revision: row.revision, hash: await contentHash(row.payload, row.deleted), deleted: row.deleted };
}
// local may be absent. A missing local entity means deletion only when we have seen it before.
export async function reconcileRecord({ local, remote, base, firstConnection = false }) {
  if (!remote) return local ? { action: 'push', payload: local.payload, deleted: false, expected: 0 } : { action: 'none' };
  const remoteHash = await contentHash(remote.payload, remote.deleted);
  const localDeleted = !local;
  const localHash = await contentHash(local?.payload ?? null, localDeleted);
  if (localHash === remoteHash) return { action: 'same', remote };
  if (!base) {
    if (!local) return { action: 'pull', remote };
    if (remote.deleted && firstConnection && ['favorite', 'activity'].includes(remote.space)) return { action: 'pull', remote };
    if (['favorite', 'activity'].includes(remote.space)) return { action: 'pull', remote };
    if (remote.space === 'rhythm') return { action: 'push', payload: Math.max(local.payload, remote.payload || 0), deleted: false, expected: remote.revision };
    return { action: 'conflict', local, remote };
  }
  if (localHash === base.hash) return { action: 'pull', remote };
  if (remoteHash === base.hash) return { action: 'push', payload: local?.payload ?? null, deleted: localDeleted, expected: remote.revision };
  if (remote.space === 'rhythm' && !localDeleted && !remote.deleted) return { action: 'push', payload: Math.max(local.payload, remote.payload), deleted: false, expected: remote.revision };
  // A concurrent removal wins for a bookmark; it cannot resurrect an old collection entry.
  if (['favorite', 'activity'].includes(remote.space)) {
    if (localDeleted || remote.deleted) return { action: remote.deleted ? 'pull' : 'push', remote,
      payload: null, deleted: true, expected: remote.revision };
    return { action: 'pull', remote };
  }
  return { action: 'conflict', local, remote };
}
export function orderSyncPlans(plans) {
  return [...plans].sort((a, b) => Number(b.deleted) - Number(a.deleted) || (a.space === 'work' && b.space === 'work' ? JSON.stringify(a.payload).length - JSON.stringify(b.payload).length : 0));
}
export function canSwitchAccount({ localOwner, userId, enabled, dirty, conflicts }) {
  return !localOwner || localOwner === userId || (!enabled && !dirty && !conflicts);
}
