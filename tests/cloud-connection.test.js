import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudTimeoutMs, withCloudDeadline, fetchAuthWithDeadline, cloudServiceMessage } from '../src/services/cloudConnection.js';

test('completed operations return their result and preserve real errors', async () => {
  const result = { session: null };
  assert.equal(await withCloudDeadline(() => result), result);
  const error = new Error('real failure');
  await assert.rejects(withCloudDeadline(() => { throw error; }), candidate => candidate === error);
});

test('a hung operation times out, aborts its request, and discards a late result', async () => {
  let requestSignal, release;
  const pending = withCloudDeadline(signal => {
    requestSignal = signal;
    return new Promise(resolve => { release = resolve; });
  }, { timeoutMs: 10 });
  await assert.rejects(pending, { code: 'CLOUD_TIMEOUT' });
  assert.equal(requestSignal.aborted, true);
  release('stale session');
  await assert.rejects(pending, { code: 'CLOUD_TIMEOUT' });
});

test('caller cancellation stops a running operation without waiting for timeout', async () => {
  const controller = new AbortController();
  let requestSignal;
  const pending = withCloudDeadline(signal => {
    requestSignal = signal;
    return new Promise(() => {});
  }, { signal: controller.signal });
  await Promise.resolve();
  const reason = new DOMException('Leaving page', 'AbortError');
  controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
  assert.equal(requestSignal.reason, reason);
});

test('an already cancelled operation never starts', async () => {
  for (const before of [true, false]) {
    const controller = new AbortController();
    let started = false;
    if (before) controller.abort();
    const pending = withCloudDeadline(() => { started = true; }, { signal: controller.signal });
    if (!before) controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(started, false);
  }
});

test('auth fetch preserves response metadata, JSON and request options', async context => {
  const response = new Response('{"user":{"id":"owner"}}', { status: 200, headers: { 'x-request-id': 'example' } });
  let options;
  context.mock.method(globalThis, 'fetch', async (_input, init) => { options = init; return response; });
  const result = await fetchAuthWithDeadline('https://example.test/auth/v1/user', { headers: { apikey: 'fixture' } });
  assert.equal(result, response);
  assert.equal(result.headers.get('x-request-id'), 'example');
  assert.deepEqual(await result.json(), { user: { id: 'owner' } });
  assert.deepEqual(options.headers, { apikey: 'fixture' });
  assert.equal(options.signal.aborted, false);
});

test('auth timeout also covers a response whose headers arrive but body stalls', async context => {
  let stream, requestSignal;
  const response = new Response(new ReadableStream({ start(controller) { stream = controller; } }));
  context.mock.method(globalThis, 'fetch', async (_input, options) => { requestSignal = options.signal; return response; });
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = fetchAuthWithDeadline('https://example.test/auth/v1/token');
  await Promise.resolve();
  await Promise.resolve();
  context.mock.timers.tick(cloudTimeoutMs);
  await assert.rejects(pending, { code: 'CLOUD_TIMEOUT' });
  assert.equal(requestSignal.aborted, true);
  stream.close();
});

test('failure descriptions distinguish timeout, missing tables and access failures', () => {
  assert.match(cloudServiceMessage({ code: 'CLOUD_TIMEOUT' }), /超时/);
  assert.match(cloudServiceMessage({ status: 401 }), /验证未通过/);
  assert.match(cloudServiceMessage({ status: 403 }), /访问权限/);
  assert.match(cloudServiceMessage({ code: 'PGRST205' }), /数据表/);
  assert.match(cloudServiceMessage({ status: 503 }), /运行中/);
  assert.match(cloudServiceMessage(new TypeError('Failed to fetch')), /网络/);
});
