// Opt-in REAL Supabase checks, not part of npm test. Only dedicated test accounts.
// Retain prior test tombstones; finally clean only this run's exact keys using CAS.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { validateGalleryConfig } from '../src/services/galleryCloudConfig.js';
import { defaultPattern, toArrangement, validatePattern } from '../src/room/pattern.js';
import { EXPECTED_LIVE_TEST_A, safeLiveTestNamespace, mayCleanLiveTestRecord } from './helpers/live-sync-safety.mjs';

const env = process.env, required = ['URL','PUBLIC_KEY','A_EMAIL','A_PASSWORD','B_EMAIL','B_PASSWORD'];
const report = { backend: 'real-supabase', status: 'NOT_RUN', checks: [], cleanup: { complete: true, records: 0 }, failure: null };
const clients = [], tracked = new Map();
let activeStep = 'configuration', namespaceReady = false;
const ensure = (value, name = activeStep) => { if (!value) throw new Error(name); };
const dataOf = result => {
  if (result.error) throw new Error(`${activeStep}:${/^[a-z0-9_-]{1,32}$/i.test(result.error.code || '') ? result.error.code : 'SERVICE_ERROR'}`);
  return result.data;
};
const step = async (name, action) => { activeStep = name; await action(); report.checks.push({ name, passed: true }); };
const identity = (uid, space, entity) => `${uid}:${space}:${entity}`;
const readExact = async (client, uid, space, entity) => dataOf(await client.from('hitori_sync_records')
  .select('*').eq('owner_id', uid).eq('space', space).eq('entity_id', entity).maybeSingle());
const create = () => {
  const client = createClient(env.HITORI_SYNC_TEST_URL, env.HITORI_SYNC_TEST_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options = {}) => fetch(input, { ...options,
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }) }
  });
  clients.push(client); return client;
};
const mutate = async (client, uid, space, entity, payload, revision, operation = randomUUID(), deleted = false) => {
  ensure(namespaceReady, 'dedicated_namespace_preflight_required');
  const key = identity(uid, space, entity);
  if (!tracked.has(key)) tracked.set(key, { client, uid, space, entity, operations: new Set() });
  tracked.get(key).operations.add(operation);
  return dataOf(await client.rpc('hitori_sync_put', { p_space: space, p_entity_id: entity, p_payload: deleted ? null : payload,
    p_deleted: deleted, p_expected_revision: revision, p_operation: operation }));
};
try {
  ensure(required.every(name => env[`HITORI_SYNC_TEST_${name}`]) && env.HITORI_SYNC_TEST_ALLOW_WRITES === 'yes-isolated-accounts');
  validateGalleryConfig(env.HITORI_SYNC_TEST_URL, env.HITORI_SYNC_TEST_PUBLIC_KEY);
  const url = new URL(env.HITORI_SYNC_TEST_URL);
  ensure(!url.username && !url.password && url.pathname === '/');
  ensure(!env.HITORI_SYNC_TEST_EXPECT_A_UID || env.HITORI_SYNC_TEST_EXPECT_A_UID === EXPECTED_LIVE_TEST_A);
  const a = create(), b = create(), anon = create();
  const login = async (client, name) => {
    const result = dataOf(await client.auth.signInWithPassword({ email: env[`HITORI_SYNC_TEST_${name}_EMAIL`], password: env[`HITORI_SYNC_TEST_${name}_PASSWORD`] }));
    const confirmed = dataOf(await client.auth.getUser());
    ensure(result.user?.id && result.user.id === confirmed.user?.id); return result.user.id;
  };
  let uidA, uidB;
  const baselines = new Map();
  await step('real_auth_and_dedicated_account_identity', async () => {
    uidA = await login(a, 'A'); uidB = await login(b, 'B');
    ensure(uidA === EXPECTED_LIVE_TEST_A && uidA !== uidB);
  });
  await step('empty_or_known_deleted_test_namespaces_only', async () => {
    for (const [client, uid] of [[a, uidA], [b, uidB]]) {
      const result = await client.from('hitori_sync_records').select('space,entity_id,deleted,revision', { count: 'exact' }).eq('owner_id', uid).range(0, 99);
      const rows = dataOf(result); ensure(safeLiveTestNamespace(rows, result.count));
      for (const row of rows) baselines.set(identity(uid, row.space, row.entity_id), Number(row.revision));
    }
    namespaceReady = true;
  });
  const initial = (uid, space, entity) => baselines.get(identity(uid, space, entity)) || 0;
  const entity = `test-${randomUUID()}`;
  await step('revision_compare_and_swap_and_idempotent_retry', async () => {
    const operation = randomUUID();
    let result = await mutate(a, uidA, 'favorite', entity, true, 0, operation);
    ensure(result.accepted && result.record.revision === 1);
    result = await mutate(a, uidA, 'favorite', entity, true, 0, operation);
    ensure(result.accepted && result.record.revision === 1);
    result = await mutate(a, uidA, 'favorite', entity, true, 0);
    ensure(!result.accepted && result.record.revision === 1);
  });
  await step('cross_account_and_anonymous_read_and_direct_write_denied', async () => {
    for (const client of [b, anon]) {
      const response = await client.from('hitori_sync_records').select('entity_id').eq('owner_id', uidA);
      ensure(response.error ? response.error.code === '42501' : response.data.length === 0);
    }
    for (const [client, owner] of [[a, uidA], [b, uidA]]) {
      const response = await client.from('hitori_sync_records').upsert({ owner_id: owner, space: 'favorite', entity_id: entity,
        payload: true, deleted: false, revision: 99, last_operation: randomUUID() });
      ensure(response.error?.code === '42501');
    }
    const denied = await anon.rpc('hitori_sync_put', { p_space: 'favorite', p_entity_id: entity, p_payload: true,
      p_deleted: false, p_expected_revision: 0, p_operation: randomUUID() });
    ensure(denied.error?.code === '42501');
    const separate = await mutate(b, uidB, 'favorite', entity, true, 0);
    ensure(separate.accepted && separate.record.revision === 1);
  });
  await step('deletion_tombstone_rejects_stale_offline_resurrection', async () => {
    const deleted = await mutate(a, uidA, 'favorite', entity, null, 1, randomUUID(), true);
    ensure(deleted.accepted && deleted.record.deleted && deleted.record.payload === null && deleted.record.revision === 2);
    const stale = await mutate(a, uidA, 'favorite', entity, true, 1);
    ensure(!stale.accepted && stale.record.deleted && stale.record.revision === 2);
  });
  const legacy = validatePattern(defaultPattern), arrangement = toArrangement(legacy);
  arrangement.bars.push({ id: 'live-bar-2', name: '主歌', masks: [0x2222, 0x1010, 0x1111, 0xaaaa] });
  arrangement.loop.end = 1; validatePattern(arrangement);
  await step('separate_work_versions_and_v1_v2_arrangements_round_trip', async () => {
    for (const [index, snapshot] of [legacy, arrangement].entries()) {
      const id = `test-work-${randomUUID()}`;
      const work = { id, kind: 'studio', snapshot, at: Date.now(), title: `隔离验收编曲 · 版本${index + 1}`, preview: '', tags: ['验收'], pinned: false };
      const saved = await mutate(a, uidA, 'work', id, work, 0);
      ensure(saved.accepted && saved.record.payload.id === id);
      const read = await readExact(a, uidA, 'work', id);
      ensure(JSON.stringify(validatePattern(read.payload.snapshot)) === JSON.stringify(snapshot));
    }
    const revision = initial(uidA, 'draft', 'studio');
    let saved = await mutate(a, uidA, 'draft', 'studio', legacy, revision); ensure(saved.accepted);
    saved = await mutate(a, uidA, 'draft', 'studio', arrangement, revision + 1);
    ensure(saved.accepted && saved.record.revision === revision + 2);
    const stale = await mutate(a, uidA, 'draft', 'studio', legacy, revision + 1);
    ensure(!stale.accepted && stale.record.payload.version === 2);
  });
  await step('activity_and_explicitly_supported_practice_rhythm_progress', async () => {
    const practiceId = `test-practice-${randomUUID()}`;
    const practice = { id: practiceId, date: new Date().toISOString().slice(0, 10), minutes: 1,
      actualSeconds: 60, plannedMinutes: 1, track: '隔离验收', goal: '验证同步', reflection: '随后自动清理', endedEarly: false };
    for (const [space, id, payload] of [['activity', 'photobooth', { rank: 0 }], ['practice', practiceId, practice], ['rhythm', 'easy', 1234]]) {
      const saved = await mutate(a, uidA, space, id, payload, initial(uidA, space, id)); ensure(saved.accepted);
      const read = await readExact(a, uidA, space, id);
      ensure(typeof payload === 'object' ? Object.keys(payload).every(key => read.payload[key] === payload[key]) : read.payload === payload);
      const hidden = await b.from('hitori_sync_records').select('entity_id').eq('owner_id', uidA).eq('space', space).eq('entity_id', id);
      ensure(!hidden.error && hidden.data.length === 0);
    }
  });
  report.status = 'PASSED';
} catch (error) {
  report.status = activeStep === 'configuration' ? 'NOT_RUN' : 'FAILED';
  report.failure = { check: activeStep, code: /^[a-z0-9_:-]{1,100}$/i.test(error.message || '') ? error.message : 'CHECK_FAILED' };
} finally {
  for (const { client, uid, space, entity, operations } of tracked.values()) {
    try {
      let row = await readExact(client, uid, space, entity); if (!row) continue;
      ensure(mayCleanLiveTestRecord(row, operations), 'cleanup_concurrent_or_unknown_mutation_refused');
      if (!row.deleted) {
        const result = dataOf(await client.rpc('hitori_sync_put', { p_space: space, p_entity_id: entity, p_payload: null,
          p_deleted: true, p_expected_revision: row.revision, p_operation: randomUUID() }));
        ensure(result.accepted && result.record.deleted, 'cleanup_compare_and_swap');
      }
      row = await readExact(client, uid, space, entity);
      ensure(row?.deleted && row.payload === null, 'cleanup_tombstone_verification'); report.cleanup.records++;
    } catch { report.cleanup.complete = false; }
  }
  await Promise.allSettled(clients.map(client => client.auth.signOut({ scope: 'local' })));
  if (!report.cleanup.complete) report.status = 'FAILED';
  const reportDir = env.REPORT_DIR || env.HITORI_SYNC_TEST_REPORT_DIR;
  if (reportDir) { await mkdir(reportDir, { recursive: true }); await writeFile(join(reportDir, 'sync-live-policy.json'), JSON.stringify(report, null, 2) + '\n'); }
  console.log(`REAL backend sync policy: ${report.status}; ${report.checks.length} checks; test cleanup ${report.cleanup.complete ? 'complete' : 'FAILED'}.`);
  if (report.failure) console.log(`Check: ${report.failure.check}; code: ${report.failure.code}`);
  process.exitCode = report.status === 'PASSED' ? 0 : report.status === 'NOT_RUN' ? 2 : 1;
}
