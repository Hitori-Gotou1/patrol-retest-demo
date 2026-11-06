import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressiveImage } from '../src/services/progressiveImage.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function setup({ cached = false } = {}) {
  const states = [], images = [];
  const loader = createProgressiveImage({
    onChange: state => states.push(state),
    createImage: () => {
      const decode = deferred();
      const image = {
        complete: cached, naturalWidth: cached ? 1000 : 0, decodeCalls: 0,
        decode: () => { image.decodeCalls++; return decode.promise; },
        removeAttribute: () => { image.cancelled = true; },
        decoded: decode
      };
      images.push(image);
      return image;
    }
  });
  return { loader, images, states, state: () => states.at(-1) };
}

test('shows the selected thumbnail until the full image has loaded and decoded', async () => {
  const { loader, images, state } = setup();
  loader.load('first-full.webp', 'first-thumb.webp');
  assert.deepEqual(state(), { source: 'first-thumb.webp', status: 'loading', unavailable: false });
  assert.equal(images.length, 1, 'opening loads only the requested original');
  const loading = images[0].onload();
  assert.equal(state().source, 'first-thumb.webp', 'load alone must not replace the preview');
  images[0].decoded.resolve();
  await loading;
  assert.deepEqual(state(), { source: 'first-full.webp', status: 'ready', unavailable: false });
});

test('rapid selection changes ignore old load, error, and decode results', async () => {
  const { loader, images, states, state } = setup();
  loader.load('a.webp', 'a-thumb.webp');
  const oldLoad = images[0].onload, oldError = images[0].onerror;
  const firstDecode = oldLoad();
  loader.load('b.webp', 'b-thumb.webp');
  const secondDecode = images[1].onload();
  loader.load('c.webp', 'c-thumb.webp');
  const beforeLateEvents = states.length;
  await oldLoad();
  oldError();
  loader.displayError('a-thumb.webp');
  images[0].decoded.resolve();
  images[1].decoded.reject(new Error('decode finished after navigation'));
  await Promise.all([firstDecode, secondDecode]);
  assert.equal(states.length, beforeLateEvents);
  assert.equal(state().source, 'c-thumb.webp');
  assert.equal(images[0].cancelled, true);
  assert.equal(images[1].cancelled, true);
  const thirdDecode = images[2].onload();
  images[2].decoded.resolve();
  await thirdDecode;
  assert.equal(state().source, 'c.webp');
});

test('closing and unmount cancellation suppress late callbacks, including the same reopened source', async () => {
  const { loader, images, states, state } = setup();
  loader.load('a.webp', 'a-thumb.webp');
  const oldDecode = images[0].onload();
  const oldError = images[0].onerror;
  loader.clear();
  assert.equal(state().status, 'idle');
  loader.load('a.webp', 'a-thumb.webp');
  const pendingCount = states.length;
  images[0].decoded.resolve();
  await oldDecode;
  oldError();
  assert.equal(states.length, pendingCount);
  const reopenedDecode = images[1].onload();
  loader.cancel();
  images[1].decoded.reject(new Error('unmounted during decoding'));
  await reopenedDecode;
  assert.equal(states.length, pendingCount);
});

for (const failure of ['network', 'decode']) {
  test(`${failure} failure keeps a usable thumbnail and reports fallback`, async () => {
    const { loader, images, state } = setup();
    loader.load('full.webp', 'thumb.webp');
    if (failure === 'network') images[0].onerror();
    else {
      const loading = images[0].onload();
      images[0].decoded.reject(new Error('invalid encoded image'));
      await loading;
    }
    assert.deepEqual(state(), { source: 'thumb.webp', status: 'fallback', unavailable: false });
    loader.displayError('thumb.webp');
    assert.equal(state().status, 'error');
    assert.equal(state().unavailable, true);
  });
}

test('a failed thumbnail does not prevent the original from loading', async () => {
  const { loader, images, state } = setup();
  loader.load('full.webp', 'thumb.webp');
  loader.displayError('thumb.webp');
  assert.equal(state().unavailable, true);
  assert.equal(state().status, 'loading');
  const loading = images[0].onload();
  images[0].decoded.resolve();
  await loading;
  assert.deepEqual(state(), { source: 'full.webp', status: 'ready', unavailable: false });
});

test('thumbnail and original failure shows the existing error state', () => {
  const { loader, images, state } = setup();
  loader.load('full.webp', 'thumb.webp');
  loader.displayError('thumb.webp');
  images[0].onerror();
  assert.equal(state().status, 'error');
  assert.equal(state().unavailable, true);
});

for (const thumbnail of [undefined, 'full.webp']) {
  test(`an image with ${thumbnail ? 'an identical thumbnail URL' : 'no thumbnail'} loads normally and cannot claim a fallback`, async () => {
    const { loader, images, state } = setup();
    loader.load('full.webp', thumbnail);
    assert.equal(state().source, 'full.webp');
    const loading = images[0].onload();
    images[0].decoded.resolve();
    await loading;
    assert.equal(state().status, 'ready');
    loader.load('full.webp', thumbnail);
    images[1].onerror();
    assert.equal(state().status, 'error');
    assert.equal(state().unavailable, true);
  });
}

test('an already cached image still waits for decode and only decodes once', async () => {
  const { loader, images, state } = setup({ cached: true });
  loader.load('full.webp', 'thumb.webp');
  assert.equal(images[0].decodeCalls, 1);
  assert.equal(state().source, 'thumb.webp');
  await images[0].onload();
  assert.equal(images[0].decodeCalls, 1);
  images[0].decoded.resolve();
  await Promise.resolve();
  assert.equal(state().status, 'ready');
});
