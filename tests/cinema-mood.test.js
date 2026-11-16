import test from 'node:test';
import assert from 'node:assert/strict';
import { cinemaMoods, cinemaMoodKey, readCinemaMood, saveCinemaMood, validateCinemaMood } from '../src/room/cinemaMood.js';

test('cinema preferences recover from old or damaged data and retain a static design', () => {
  assert.deepEqual(validateCinemaMood(null), { version: 1, mood: 'warm', dynamic: true });
  assert.deepEqual(validateCinemaMood({ mood: 'unknown', dynamic: false }), { version: 1, mood: 'warm', dynamic: false });
  let stored;
  globalThis.localStorage = { getItem: () => stored, setItem: (key, value) => { assert.equal(key, cinemaMoodKey); stored = value; } };
  for (const mood of cinemaMoods) {
    assert.equal(saveCinemaMood({ mood: mood.id, dynamic: false }), true);
    assert.equal(readCinemaMood().mood, mood.id);
    assert.equal(readCinemaMood().dynamic, false);
  }
  stored = '{broken';
  assert.equal(readCinemaMood().mood, 'warm');
  globalThis.localStorage = { getItem: () => { throw new Error('unavailable'); }, setItem: () => { throw new Error('full'); } };
  assert.deepEqual(readCinemaMood(), { version: 1, mood: 'warm', dynamic: true });
  assert.equal(saveCinemaMood({ mood: 'rain' }), false);
  delete globalThis.localStorage;
});
