// Opt-in REAL Supabase test. Never runs as part of npm test and never uses the owner session.
// Supply two dedicated empty test accounts. No production user content is read or modified.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { validateGalleryConfig } from '../src/services/galleryCloudConfig.js';
const env = process.env;
const required = ['HITORI_SYNC_TEST_URL','HITORI_SYNC_TEST_PUBLIC_KEY','HITORI_SYNC_TEST_A_EMAIL','HITORI_SYNC_TEST_A_PASSWORD','HITORI_SYNC_TEST_B_EMAIL','HITORI_SYNC_TEST_B_PASSWORD'];
if (required.some(name => !env[name]) || env.HITORI_SYNC_TEST_ALLOW_WRITES !== 'yes-isolated-accounts') {
  console.error('Missing isolated-account test configuration; REAL backend permission test has NOT run. See docs/upgrade/offline-sync.md.');
  process.exit(2);
}
validateGalleryConfig(env.HITORI_SYNC_TEST_URL, env.HITORI_SYNC_TEST_PUBLIC_KEY);
const create = () => createClient(env.HITORI_SYNC_TEST_URL, env.HITORI_SYNC_TEST_PUBLIC_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const a = create(), b = create(), anon = create();
const login = async (client, name) => {
  const result = await client.auth.signInWithPassword({ email: env[`HITORI_SYNC_TEST_${name}_EMAIL`], password: env[`HITORI_SYNC_TEST_${name}_PASSWORD`] });
  if (result.error) throw new Error(`Dedicated account ${name} login failed: ${result.error.code || result.error.name}`);
  assert.ok(result.data.user); return result.data.user.id;
};
const uidA = await login(a, 'A'), uidB = await login(b, 'B'); assert.notEqual(uidA, uidB);
if (env.HITORI_SYNC_TEST_EXPECT_A_UID) assert.equal(uidA, env.HITORI_SYNC_TEST_EXPECT_A_UID, 'A must be the dedicated test account authorized in this session');
for (const [client, uid] of [[a, uidA],[b, uidB]]) {
  const { data, error } = await client.from('hitori_sync_records').select('entity_id').eq('owner_id',uid).limit(1);
  assert.ifError(error); assert.equal(data.length, 0, 'Use dedicated EMPTY test accounts; refusing to change an account with existing sync records.');
}
const entity = `test-${crypto.randomUUID()}`;
const put = (client, expected, deleted = false, operation = crypto.randomUUID()) => client.rpc('hitori_sync_put', { p_space:'favorite',p_entity_id:entity,p_payload:deleted?null:true,p_deleted:deleted,p_expected_revision:expected,p_operation:operation });
const operation = crypto.randomUUID();
let result = await put(a,0,false,operation); assert.ifError(result.error); assert.equal(result.data.accepted,true); assert.equal(result.data.record.revision,1);
result = await put(a,0,false,operation); assert.ifError(result.error); assert.equal(result.data.accepted,true); assert.equal(result.data.record.revision,1,'Idempotent retry must not add a revision');
result = await put(a,0); assert.ifError(result.error); assert.equal(result.data.accepted,false,'Stale revision must be rejected');
for (const client of [b,anon]) {
  const { data, error } = await client.from('hitori_sync_records').select('*').eq('owner_id',uidA);
  assert.ok(error || data.length === 0,'Other account / anonymous visitor can never read A records');
}
const direct = await b.from('hitori_sync_records').upsert({ owner_id:uidA,space:'favorite',entity_id:entity,payload:true,deleted:false,revision:99,last_operation:crypto.randomUUID() });
assert.ok(direct.error,'Direct cross-account mutation must be denied');
const unauth = await put(anon,0); assert.ok(unauth.error,'Anonymous RPC mutation must be denied');
result = await put(b,0); assert.ifError(result.error); assert.equal(result.data.accepted,true); assert.equal(result.data.record.revision,1,'B owns a distinct record with same entity ID');
result = await put(a,1,true); assert.ifError(result.error); assert.equal(result.data.record.deleted,true); assert.equal(result.data.record.revision,2);
result = await put(a,1); assert.ifError(result.error); assert.equal(result.data.accepted,false,'Old offline edit cannot silently resurrect a deletion');
result = await put(b,1,true); assert.ifError(result.error);
console.log('REAL backend verified: isolated read permissions, denied direct/anonymous writes, per-user ID isolation, revision conflict, idempotency, tombstones. Dedicated accounts now contain only test tombstones; delete accounts in Supabase Auth to clean up.');
await a.auth.signOut(); await b.auth.signOut();
