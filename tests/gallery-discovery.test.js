import test from 'node:test';
import assert from 'node:assert/strict';
import { filterGallery, imageCharacters, readSavedFavorites, createFavoritesBackup, parseFavoritesBackup, mergeFavorites, maxBackupBytes, galleryRouteImage, galleryImageLocation } from '../src/services/galleryDiscovery.js';

const items = [
  { id: 'first', category: 'collection', title: '夏日 STARRY', alt: '一里与虹夏在舞台上', credit: '作者 Aoi' },
  { id: 'second', category: 'poster', title: '夜色里的凉', alt: '蓝发的凉坐在窗边', credit: '作者 Rika' },
  { id: 'third', category: 'collection', title: '清凉的夏天', alt: '四位成员合奏', credit: '作者 Aoi' },
  { id: 'fourth', category: 'poster', title: '入口票根', alt: 'STARRY 的舞台', credit: '虹夏工作室' }
];
const ids = entries => entries.map(item => item.id);

test('search combines category, caption character, favorites and all query terms', () => {
  const result = filterGallery(items, { category: 'collection', character: 'hitori', query: 'ＳＴＡＲＲＹ aOi', favoritesOnly: true }, new Set(['first', 'second']));
  assert.deepEqual(ids(result), ['first']);
  assert.deepEqual(ids(filterGallery(items, { query: 'STARRY missing' })), []);
  assert.deepEqual(ids(filterGallery(items, { query: '  作者   AOI  ' })), ['first', 'third']);
});

test('member labels use supplied descriptions, including groups, not author names or similar words', () => {
  assert.deepEqual(imageCharacters(items[0]).map(member => member.id), ['hitori', 'nijika']);
  assert.deepEqual(imageCharacters(items[1]).map(member => member.id), ['ryo']);
  assert.equal(imageCharacters(items[2]).length, 4);
  assert.deepEqual(imageCharacters(items[3]), []);
  assert.deepEqual(imageCharacters({ title: '清凉的夏天', alt: '凉爽的风', credit: '山田凉' }), []);
  assert.equal(imageCharacters({ alt: '四位 Q 版成员' }).length, 4);
  assert.deepEqual(imageCharacters({ title: 'guitar', alt: 'RYO and Kita' }).map(member => member.id), ['ryo', 'kita']);
});

test('explicit character metadata can mark or deliberately leave an image untagged', () => {
  assert.deepEqual(imageCharacters({ title: '一里', characters: [] }), []);
  assert.deepEqual(imageCharacters({ characters: ['kita', 'unknown', 'kita'] }).map(member => member.id), ['kita']);
  assert.deepEqual(ids(filterGallery(items, { character: 'unmarked' })), ['fourth']);
  assert.deepEqual(ids(filterGallery(items, { query: '后藤一里' })), ['first', 'third']);
});

test('legacy browser favorites remain readable and retain temporarily unavailable cloud IDs', () => {
  const cloud = 'cloud-11111111-1111-4111-8111-111111111111';
  assert.deepEqual([...readSavedFavorites(JSON.stringify(['quiet-guitar', cloud, 'quiet-guitar']))], ['quiet-guitar', cloud]);
  assert.equal(readSavedFavorites(null).size, 0);
  assert.throws(() => readSavedFavorites('{broken'));
  assert.throws(() => readSavedFavorites('{}'));
});

test('backup round trips IDs only, including unavailable entries, and merges without losing current favorites', () => {
  const original = new Set(['quiet-guitar', 'cloud-11111111-1111-4111-8111-111111111111']);
  const text = createFavoritesBackup(original, new Date('2026-11-08T00:00:00Z'));
  const data = JSON.parse(text);
  assert.equal(data.version, 1);
  assert.equal(data.exportedAt, '2026-11-08T00:00:00.000Z');
  assert.deepEqual([...parseFavoritesBackup(text)], [...original]);
  const current = new Set(['pink-frequency', 'quiet-guitar']);
  assert.deepEqual([...mergeFavorites(current, parseFavoritesBackup(text))], ['pink-frequency', 'quiet-guitar', 'cloud-11111111-1111-4111-8111-111111111111']);
  assert.deepEqual([...current], ['pink-frequency', 'quiet-guitar']);
  assert.equal(parseFavoritesBackup(createFavoritesBackup(new Set())).size, 0);
});

test('invalid or foreign backups are rejected in full instead of partly importing', () => {
  const valid = JSON.parse(createFavoritesBackup(new Set(['quiet-guitar'])));
  for (const text of ['not JSON', 'null', '[]', JSON.stringify({ ...valid, version: 2 }), JSON.stringify({ ...valid, format: 'another-site' }),
    JSON.stringify({ ...valid, ids: ['quiet-guitar', 123] }), JSON.stringify({ ...valid, ids: ['quiet-guitar', '../image'] }),
    JSON.stringify({ ...valid, ids: ['quiet-guitar', '<script>'] })]) {
    assert.throws(() => parseFavoritesBackup(text));
  }
  assert.throws(() => parseFavoritesBackup(' '.repeat(maxBackupBytes + 1)), /1 MiB/);
});

test('deduplication and the import limit apply to the merged result', () => {
  const current = new Set(Array.from({ length: 5000 }, (_, index) => `image-${index}`));
  assert.equal(mergeFavorites(current, new Set(['image-0'])).size, 5000);
  assert.throws(() => mergeFavorites(current, new Set(['extra'])), /5000/);
  assert.equal(current.size, 5000);
});

test('share locations contain only a valid picture ID and a gallery anchor', () => {
  assert.deepEqual(galleryImageLocation('collection-' + 'a'.repeat(64)), { path: '/', query: { image: 'collection-' + 'a'.repeat(64) }, hash: '#gallery' });
  for (const value of [['quiet-guitar'], null, '', '../photo', 'a'.repeat(97), 'photo?token=secret', '__proto__']) {
    assert.equal(galleryRouteImage(value), '');
    assert.throws(() => galleryImageLocation(value));
  }
});
