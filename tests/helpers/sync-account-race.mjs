// An isolated load of the actual module. Expose internal boundaries for a race
// regression without adding production exports, credentials, or network calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const sourceUrl = new URL('../../src/services/cloudSync.js', import.meta.url);
const original = await fs.readFile(sourceUrl, 'utf8');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const json = value => JSON.stringify(value);
const stateKey = uid => `hitori-room:sync-state:${uid}:v1`;
const blank = owner => ({ version: 1, base: { [`work:private-${owner}`]: { revision: 2, hash: `${owner}-history` } }, observed: {}, outbox: {}, lastSuccess: null, conflicts: [] });
const choice = { space: 'favorite', entity_id: 'private-a', payload: true, deleted: false, expected: 0 };
const resultRow = { space: 'favorite', entity_id: 'private-a', payload: true, deleted: false, revision: 1, updated_at: '2026-11-14T00:00:00Z', last_operation: '11111111-1111-4111-8111-111111111111' };

async function fixture({ clientPromise, session, fetchResponse, describe } = {}) {
  const values = new Map([[stateKey('a'), json(blank('a'))], [stateKey('b'), json(blank('b'))]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  let fetchCalls = 0;
  const client = { auth: { getSession: session || (async () => ({ data: { session: { user: { id: 'a' }, access_token: 'isolated-no-token' } }, error: null })) } };
  const context = vm.createContext({ crypto, TextEncoder, TextDecoder, URL, Request, DOMException, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    localStorage: storage, navigator: { onLine: true }, __testClientPromise: clientPromise || Promise.resolve(client),
    fetch: async (...args) => { fetchCalls++; return fetchResponse ? fetchResponse(...args) : { ok: true, json: async () => ({ accepted: true, record: resultRow }) }; } });
  assert.match(original, /let clientPromise, accountState,/u, 'Test injection point changed; update the isolated regression harness.');
  const source = original.replace('let clientPromise, accountState,', 'let clientPromise = globalThis.__testClientPromise, accountState,')
    + '\nexport const raceHooks={acceptUser,putRecord,state:()=>accountState,generation:()=>generation};';
  const module = new vm.SourceTextModule(source, { context, identifier: sourceUrl.href, initializeImportMeta(meta) {
    meta.env = { VITE_SUPABASE_URL: 'https://isolated-sync-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_isolated_test' };
  } });
  await module.link(async specifier => {
    const imported = await import(specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : specifier);
    const names = Object.keys(imported);
    return new vm.SyntheticModule(names, function () { for (const name of names) this.setExport(name, name === 'describeRecord' && describe ? describe(imported[name]) : imported[name]); }, { context });
  });
  await module.evaluate();
  const { raceHooks: hooks, syncStatus } = module.namespace;
  await hooks.acceptUser({ id: 'a', email: 'a@isolated.invalid' });
  syncStatus.enabled = true;
  return { hooks, syncStatus, values, client, fetchCalls: () => fetchCalls };
}
function assertUnchangedAfterSwitch(fixture, aBefore, bBefore, bState) {
  assert.equal(fixture.values.get(stateKey('a')), aBefore, 'A persisted state changed after account switch');
  assert.equal(fixture.values.get(stateKey('b')), bBefore, 'B persisted state changed due to an old A request');
  assert.equal(json(fixture.hooks.state()), bState, 'B in-memory state contains an old A request');
}
async function switchToB(fixture) {
  await fixture.hooks.acceptUser({ id: 'b', email: 'b@isolated.invalid' });
  return { a: fixture.values.get(stateKey('a')), b: fixture.values.get(stateKey('b')), state: json(fixture.hooks.state()) };
}
const checks = [];
{
  const f = await fixture(), capturedA = f.hooks.state(), generationA = f.hooks.generation();
  const before = await switchToB(f);
  await assert.rejects(f.hooks.putRecord('a', 'favorite:private-a', choice, generationA, capturedA), { name: 'AbortError' });
  assertUnchangedAfterSwitch(f, before.a, before.b, before.state); assert.equal(f.fetchCalls(), 0);
  checks.push('stale generation is rejected before any state mutation');
}
{
  const clientGate = deferred();
  const f = await fixture({ clientPromise: clientGate.promise }), capturedA = f.hooks.state(), generationA = f.hooks.generation();
  const pending = f.hooks.putRecord('a', 'favorite:private-a', choice, generationA, capturedA);
  const before = await switchToB(f); clientGate.resolve(f.client);
  await assert.rejects(pending, { name: 'AbortError' }); assertUnchangedAfterSwitch(f, before.a, before.b, before.state); assert.equal(f.fetchCalls(), 0);
  checks.push('account switch while obtaining client preserves both accounts');
}
{
  const started = deferred(), sessionGate = deferred();
  const f = await fixture({ session: () => { started.resolve(); return sessionGate.promise; } }), capturedA = f.hooks.state(), generationA = f.hooks.generation();
  const pending = f.hooks.putRecord('a', 'favorite:private-a', choice, generationA, capturedA); await started.promise;
  const before = await switchToB(f); sessionGate.resolve({ data: { session: { user: { id: 'a' }, access_token: 'old-a-token' } }, error: null });
  await assert.rejects(pending, { name: 'AbortError' }); assertUnchangedAfterSwitch(f, before.a, before.b, before.state); assert.equal(f.fetchCalls(), 0);
  checks.push('account switch while obtaining session sends no old payload');
}
{
  const started = deferred(), responseGate = deferred();
  const f = await fixture({ fetchResponse: () => { started.resolve(); return responseGate.promise; } }), capturedA = f.hooks.state(), generationA = f.hooks.generation();
  const pending = f.hooks.putRecord('a', 'favorite:private-a', choice, generationA, capturedA); await started.promise;
  const before = await switchToB(f); responseGate.resolve({ ok: true, json: async () => ({ accepted: true, record: resultRow }) });
  await assert.rejects(pending, { name: 'AbortError' }); assertUnchangedAfterSwitch(f, before.a, before.b, before.state);
  assert.ok(JSON.parse(before.a).outbox['favorite:private-a'], 'A pending intent is retained for its own future retry');
  checks.push('late response cannot update either account state after switching');
}
{
  const started = deferred(), hashGate = deferred();
  const f = await fixture({ describe: actual => async row => { const result = await actual(row); started.resolve(); await hashGate.promise; return result; } }), capturedA = f.hooks.state(), generationA = f.hooks.generation();
  const pending = f.hooks.putRecord('a', 'favorite:private-a', choice, generationA, capturedA); await started.promise;
  const before = await switchToB(f); hashGate.resolve();
  await assert.rejects(pending, { name: 'AbortError' }); assertUnchangedAfterSwitch(f, before.a, before.b, before.state);
  checks.push('late content hashing cannot write a previous account base');
}
console.log(JSON.stringify({ result: 'PASS', checks, backend: 'none; actual source in isolated VM' }));
