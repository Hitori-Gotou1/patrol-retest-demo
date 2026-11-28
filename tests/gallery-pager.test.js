import test from 'node:test';
import assert from 'node:assert/strict';
import { createGalleryPager, mergeGalleryPages, clearGalleryMetadataCache } from '../src/services/galleryPager.js';
import { fittedImageSize, clampImagePan } from '../src/services/galleryZoom.js';

const row = (id, sortOrder = 0, createdAt = '2026-11-14T00:00:00Z') => ({ id, sortOrder, createdAt });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('first page is published before the next request, and search explicitly exhausts all pages', async () => {
  const second = deferred(); const snapshots = []; let calls = 0;
  const pager = createGalleryPager({ pageSize: 2, onChange: state => snapshots.push(state), fetchPage: async ({ cursor }) => {
    calls++;
    return cursor ? second.promise : { items: [row('a'), row('b')], cursor: 'page-2', hasMore: true };
  } });
  await pager.start();
  assert.equal(calls, 1);
  assert.deepEqual(pager.snapshot().items.map(item => item.id), ['b', 'a']);
  assert.equal(pager.snapshot().complete, false);
  const searching = pager.ensureComplete();
  await Promise.resolve();
  assert.equal(calls, 2);
  assert.equal(pager.snapshot().items.length, 2);
  second.resolve({ items: [row('rare-match')], hasMore: false });
  await searching;
  assert.equal(pager.snapshot().complete, true);
  assert.ok(pager.snapshot().items.some(item => item.id === 'rare-match'));
  assert.ok(snapshots.some(state => state.items.length === 2 && state.loading === false));
});

test('concurrent load-more is shared and duplicate rows are stably merged', async () => {
  let calls = 0;
  const pager = createGalleryPager({ fetchPage: async ({ cursor }) => {
    calls++;
    return cursor ? { items: [row('b', 4), row('c', 2)], hasMore: false } : { items: [row('a'), row('b', 3)], hasMore: true, cursor: 'next' };
  } });
  await pager.start();
  await Promise.all([pager.loadMore(), pager.loadMore(), pager.loadMore()]);
  assert.equal(calls, 2);
  assert.deepEqual(pager.snapshot().items.map(item => item.id), ['a', 'c', 'b']);
  assert.equal(pager.snapshot().items.find(item => item.id === 'b').sortOrder, 4);
});

test('failed later page retains current content and is retryable', async () => {
  let failed = true;
  const pager = createGalleryPager({ fetchPage: async ({ cursor }) => {
    if (!cursor) return { items: [row('first')], hasMore: true, cursor: 'next' };
    if (failed) throw new Error('offline');
    return { items: [row('second')], hasMore: false };
  } });
  await pager.start(); await pager.loadMore();
  assert.equal(pager.snapshot().items.length, 1);
  assert.match(pager.snapshot().error.message, /offline/);
  failed = false; await pager.loadMore();
  assert.equal(pager.snapshot().items.length, 2);
  assert.equal(pager.snapshot().error, null);
});

test('an older late request cannot replace a refreshed result, even if it ignores cancellation', async () => {
  const first = deferred(); let calls = 0;
  const pager = createGalleryPager({ fetchPage: () => ++calls === 1 ? first.promise : Promise.resolve({ items: [row('new')], hasMore: false }) });
  const initial = pager.start(); await Promise.resolve();
  await pager.refresh(); first.resolve({ items: [row('old')], hasMore: false }); await initial;
  assert.deepEqual(pager.snapshot().items.map(item => item.id), ['new']);
});

test('metadata is reused within TTL, and stale refresh failure retains the cache', async () => {
  clearGalleryMetadataCache(); let time = 1000; let calls = 0;
  const config = { cacheKey: 'test-only', ttl: 500, now: () => time, fetchPage: async () => { calls++; return { items: [row('cached')], hasMore: false }; } };
  const first = createGalleryPager(config); await first.start(); first.dispose();
  const second = createGalleryPager(config); await second.start();
  assert.equal(calls, 1);
  second.dispose(); time = 2000;
  const third = createGalleryPager({ ...config, fetchPage: async () => { throw new Error('network'); } });
  await third.start();
  assert.deepEqual(third.snapshot().items.map(item => item.id), ['cached']);
  assert.equal(third.snapshot().error.message, 'network');
});

test('non-advancing cursors stop instead of making an infinite search loop', async () => {
  const pager = createGalleryPager({ fetchPage: async () => ({ items: [row('a')], hasMore: true, cursor: 'same' }) });
  await pager.start(); await pager.ensureComplete();
  assert.match(pager.snapshot().error.message, /分页位置/);
});

test('disposing stops late results from mutating an unmounted gallery', async () => {
  const pending = deferred(); const pager = createGalleryPager({ fetchPage: () => pending.promise });
  const started = pager.start(); await Promise.resolve(); pager.dispose();
  pending.resolve({ items: [row('late')], hasMore: false }); await started;
  assert.equal(pager.snapshot().items.length, 0);
});

test('sorting honors owner order, date, then unique ID', () => {
  assert.deepEqual(mergeGalleryPages([row('a', 0, '2026-01-01')], [row('b', 0, '2026-02-01'), row('c', -1)]).map(item => item.id), ['c', 'b', 'a']);
});

test('image fitting preserves aspect ratio and never enlarges a small image', () => {
  assert.deepEqual(fittedImageSize(1800, 1200, 900, 400), { width: 600, height: 400 });
  assert.deepEqual(fittedImageSize(100, 100, 900, 400), { width: 100, height: 100 });
  assert.deepEqual(fittedImageSize(800, 1000, 326, 431, { allowUpscale: true }), { width: 326, height: 407.5 });
  assert.deepEqual(fittedImageSize(800, 1000, 1500, 1250, { allowUpscale: true }), { width: 1000, height: 1250 });
  assert.deepEqual(fittedImageSize(0, 100, 900, 400), { width: 0, height: 0 });
});

test('zoom pan is bounded to the visible image edges and resets at fit', () => {
  assert.deepEqual(clampImagePan({ x: 999, y: -999, scale: 2, width: 600, height: 400, availableWidth: 900, availableHeight: 400 }), { x: 150, y: -200 });
  assert.deepEqual(clampImagePan({ x: 999, y: -999, scale: 1, width: 600, height: 400, availableWidth: 900, availableHeight: 400 }), { x: 0, y: 0 });
});
