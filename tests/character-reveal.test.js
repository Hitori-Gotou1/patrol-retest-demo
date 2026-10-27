import test from 'node:test';
import assert from 'node:assert/strict';
import { revealGeometry } from '../src/composables/useCharacterTransition.js';

function coversEveryCorner(width, height, point) {
  const circle = revealGeometry(width, height, ...point);
  assert.ok(circle.x >= 0 && circle.x <= width);
  assert.ok(circle.y >= 0 && circle.y <= height);
  for (const corner of [[0, 0], [width, 0], [0, height], [width, height]]) {
    const distanceSquared = (corner[0] - circle.x) ** 2 + (corner[1] - circle.y) ** 2;
    assert.ok(circle.radius ** 2 > distanceSquared, `${width}×${height}, origin ${point}, uncovered corner ${corner}`);
  }
}

test('完整覆盖桌面、手机长幕及头像位于边缘的四角', () => {
  for (const [w, h] of [[1440, 900], [1440, 768], [390, 1400], [320, 1700], [2560, 1080]]) {
    for (const point of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h / 2], [w * .8, h * .96]]) coversEveryCorner(w, h, point);
  }
});

test('布局改变或按钮在边界之外时仍使用区域内的安全圆心', () => {
  for (const [w, h] of [[390, 1500], [320, 1800], [844, 700]]) {
    for (const point of [[-20, 1600], [1500, -10], [w * .73, h * .93]]) coversEveryCorner(w, h, point);
  }
});
