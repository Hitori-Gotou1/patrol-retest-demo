import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFrame, expandFrames, filmStripArt, initialAnimation } from '../src/room/festival/animation.js';
import { examplePatch, initialPiece, needlePaths, patchArt, removeStitch, stitchCrossings } from '../src/room/festival/patch.js';
import { initialRoom, pointAlongRoute, readings, seats, speedOfSound, taskResults } from '../src/room/festival/soundcheck.js';
import { cropViewBox, cutLine, foldedOrder, imposition, initialZine, pageText, printSheetArt, wrapText } from '../src/room/festival/zine.js';

test('front stitches retain their selected holes and the back connects ends of the same thread', () => {
  const piece = initialPiece();
  piece.stitches = [
    { id: 'a', from: 'A', to: 'B', color: 'blue' },
    { id: 'b', from: 'C', to: 'D', color: 'blue' },
    { id: 'c', from: 'B', to: 'E', color: 'yellow' },
    { id: 'd', from: 'F', to: 'A', color: 'blue' }
  ];
  const { front, back } = needlePaths(piece);
  assert.deepEqual(front.map(({ a, b }) => [a.id, b.id]), [['A', 'B'], ['C', 'D'], ['B', 'E'], ['F', 'A']]);
  assert.deepEqual(back.map(({ a, b, color }) => [a.id, b.id, color]), [['B', 'C', 'blue'], ['D', 'F', 'blue']]);
  const reverse = patchArt(piece, { side: 'back' }).content;
  assert.match(reverse, /translate\(300\) scale\(-1 1\)/);
  assert.match(reverse, /x1="199" y1="85" x2="227" y2="125"/);
  removeStitch(piece, 'b');
  assert.deepEqual(needlePaths(piece).back.map(({ from, to }) => [from, to]), [['B', 'F']]);
});

test('changing which thread is on top changes only the specified crossing in the exported art', () => {
  const piece = examplePatch();
  piece.stitches.push({ id: 'third', from: 'G', to: 'H', color: 'rose' });
  const current = stitchCrossings(piece);
  assert.ok(current.length > 1);
  const target = current.find(item => item.id === 'sample-6:sample-7');
  assert.equal(target.top.color, 'blue');
  const before = patchArt(piece).content.replace(/fest-weft-\d+/g, 'weft');
  piece.crossings[target.id] = target.second.id;
  const after = patchArt(piece).content.replace(/fest-weft-\d+/g, 'weft');
  const re = /<g data-crossing="sample-6:sample-7"[\s\S]*?<\/g><\/g>/;
  assert.equal(before.replace(re, ''), after.replace(re, ''));
  assert.match(before, /data-crossing="sample-6:sample-7" data-over="blue"/);
  assert.match(after, /data-crossing="sample-6:sample-7" data-over="yellow"/);
});

test('held frames expand in playback order and appear as separate numbered PNG cells', () => {
  const model = initialAnimation();
  model.frames[1].hold = 3;
  const slots = expandFrames(model.frames);
  assert.deepEqual(slots.map(({ frameIndex, repeat }) => [frameIndex, repeat]), [[0, 0], [1, 0], [1, 1], [1, 2], [2, 0]]);
  assert.deepEqual([...filmStripArt(model).content.matchAll(/data-film-slot="(\d+)" data-source-frame="(\d+)"/g)]
    .map(([, slot, frame]) => [Number(slot), Number(frame)]), [[1, 1], [2, 2], [3, 2], [4, 2], [5, 3]]);
  const copy = copyFrame(model.frames[1], 'independent');
  copy.pose.elbow = 55;
  copy.hold = 1;
  assert.equal(model.frames[1].pose.elbow, 9);
  assert.equal(model.frames[1].hold, 3);
});

test('mirror paths use physical arrival times and a curtain attenuates only its own reflection', () => {
  const room = initialRoom();
  const [direct, left, rear] = readings(room);
  assert.equal(direct.ms, 3000 / speedOfSound);
  assert.equal(left.distance, Math.hypot(10, 3));
  assert.equal(left.points[1].x, 0);
  assert.equal(left.points[1].y, 3.5);
  assert.ok(Math.abs(rear.distance - 23) < 1e-10);
  assert.equal(rear.points[1].y, 15);
  const atWall = pointAlongRoute(rear, 13 / rear.distance);
  assert.ok(Math.abs(atWall.y - 15) < 1e-10);
  const withCurtain = readings({ ...room, curtains: { ...room.curtains, rear: true } });
  assert.deepEqual(withCurtain.slice(0, 2), [direct, left]);
  assert.equal(withCurtain[2].ms, rear.ms);
  assert.ok(withCurtain[2].relative < rear.relative * .08);
  assert.notEqual(readings({ ...room, depth: 18 })[2].ms, rear.ms);
});

test('both trial commissions have reachable states and fail when their readings miss the target', () => {
  const room = initialRoom();
  assert.equal(taskResults('front-dry', room).every(item => item.done), false);
  assert.ok(taskResults('front-dry', { ...room, curtains: { left: false, rear: true } }).every(item => item.done));
  assert.equal(taskResults('echo-order', room).every(item => item.done), false);
  assert.ok(taskResults('echo-order', { ...room, seat: 'side', listener: seats.side }).every(item => item.done));
});

test('landscape A4 imposes both rows, correct rotations and a slit that preserves the outer folds', () => {
  assert.deepEqual(imposition.map(({ page, rotation }) => [page, rotation]), [[5, 180], [4, 180], [3, 180], [2, 180], [6, 0], [7, 0], [8, 0], [1, 0]]);
  assert.deepEqual(foldedOrder(), Array.from({ length: 8 }, (_, index) => ({ page: index + 1, rotation: 0 })));
  assert.deepEqual(cutLine, { x1: 297, x2: 891, y: 420 });
  const proof = printSheetArt(initialZine().pages, { proof: true });
  assert.equal(proof.width / proof.height, 297 / 210);
  assert.match(proof.content, /x1="297" y1="420" x2="891" y2="420" stroke="#942e48"/);
  assert.deepEqual([...proof.content.matchAll(/data-print-page="(\d+)" data-rotation="(\d+)"/g)]
    .map(([, page, angle]) => [Number(page), Number(angle)]), imposition.map(({ page, rotation }) => [page, rotation]));
  const pages = initialZine().pages;
  [pages[1], pages[2]] = [pages[2], pages[1]];
  const sheet = printSheetArt(pages).content;
  assert.match(sheet.match(/data-print-page="2"[\s\S]*?(?=data-print-page="6")/)[0], /拨片背面/);
});

test('caption overset is reported, and crop zoom consistently yields a bounded viewport', () => {
  assert.deepEqual(wrapText('甲乙丙丁戊', 22, 10, 2), { lines: ['甲乙', '丙…'], overflow: true });
  const [cover] = initialZine().pages;
  cover.title = '超长标题'.repeat(30);
  assert.equal(pageText(cover, 1).title.overflow, true);
  assert.deepEqual(cropViewBox({ width: 320, height: 144 }, { w: 200, h: 100 }, { x: 1, y: -1, zoom: 2 }), '160 0 160 80');
});
