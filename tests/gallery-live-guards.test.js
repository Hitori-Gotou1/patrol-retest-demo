import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { EXPECTED_GALLERY_TEST_A_UID, readGalleryLiveConfig, galleryTestOwnedPath, markedTestPng, runGalleryLivePolicy } from './gallery-live-policy.mjs';
const config = () => ({
  HITORI_SYNC_TEST_ALLOW_WRITES: 'yes-isolated-accounts',
  HITORI_SYNC_TEST_URL: 'https://gallery-live-fixture.supabase.co',
  HITORI_SYNC_TEST_PUBLIC_KEY: 'sb_publishable_fixture_only',
  HITORI_SYNC_TEST_A_EMAIL: 'isolated-a@example.test', HITORI_SYNC_TEST_A_PASSWORD: 'not-real-a',
  HITORI_SYNC_TEST_B_EMAIL: 'isolated-b@example.test', HITORI_SYNC_TEST_B_PASSWORD: 'not-real-b'
});
const id = '11111111-1111-4111-8111-111111111111';

test('live acceptance requires explicit write authorization, all credentials, public key and fixed A identity', () => {
  assert.doesNotThrow(() => readGalleryLiveConfig(config()));
  for (const field of Object.keys(config())) {
    const missing = config(); delete missing[field]; assert.throws(() => readGalleryLiveConfig(missing));
  }
  for (const values of [
    { HITORI_SYNC_TEST_A_UID: id },
    { HITORI_SYNC_TEST_PUBLIC_KEY: 'sb_secret_do_not_use' },
    { HITORI_SYNC_TEST_URL: 'http://gallery-live-fixture.supabase.co' },
    { HITORI_SYNC_TEST_URL: 'https://user:password@gallery-live-fixture.supabase.co' },
    { HITORI_SYNC_TEST_B_EMAIL: 'ISOLATED-A@example.test' },
    { HITORI_SYNC_TEST_B_UID: EXPECTED_GALLERY_TEST_A_UID }
  ]) assert.throws(() => readGalleryLiveConfig({ ...config(), ...values }));
});

test('resource paths are confined to the approved dedicated owner and freshly generated UUID shape', () => {
  assert.equal(galleryTestOwnedPath(EXPECTED_GALLERY_TEST_A_UID, id, '-thumb'), `${EXPECTED_GALLERY_TEST_A_UID}/${id}-thumb.png`);
  assert.throws(() => galleryTestOwnedPath(id, id));
  assert.throws(() => galleryTestOwnedPath(EXPECTED_GALLERY_TEST_A_UID, '../existing-object'));
  assert.throws(() => galleryTestOwnedPath(EXPECTED_GALLERY_TEST_A_UID, id, '/../existing'));
});

function chunks(png, type) {
  const result = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === type) result.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  return result;
}
test('unique test PNG keeps icon dimensions and actual compressed pixel data intact', async () => {
  const original = await readFile(new URL('../public/icons/hitori-192.png', import.meta.url));
  const first = markedTestPng(original, id);
  const second = markedTestPng(original, `${id}:22222222-2222-4222-8222-222222222222`);
  assert.notDeepEqual(first, second);
  assert.deepEqual(chunks(first, 'IHDR'), chunks(original, 'IHDR'));
  assert.deepEqual(inflateSync(Buffer.concat(chunks(first, 'IDAT'))), inflateSync(Buffer.concat(chunks(original, 'IDAT'))));
  assert.equal(first.readUInt32BE(16), 192); assert.equal(first.readUInt32BE(20), 192);
  assert.equal(chunks(first, 'IEND').length, 1);
  assert.throws(() => markedTestPng(Buffer.from('not a png'), id));
  assert.throws(() => markedTestPng(original, 'not-a-generated-uuid'));
});

test('missing configuration exits without any real network attempt or sensitive report fields', async () => {
  const previousFetch = globalThis.fetch; let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('network must not run'); };
  try {
    const report = await runGalleryLivePolicy({});
    assert.equal(requests, 0);
    assert.equal(report.status, 'NOT_RUN');
    assert.equal(report.liveBackendAttempted, false);
    assert.equal(report.verified, false);
    assert.equal(report.cleanup.attempted, false);
    assert.equal(report.failure.code, 'CONFIG');
    const text = JSON.stringify(report);
    for (const secret of ['not-real-a', 'not-real-b', 'isolated-a@example.test', 'sb_publishable_fixture_only']) assert.ok(!text.includes(secret));
  } finally { globalThis.fetch = previousFetch; }
});
