import test from 'node:test';
import assert from 'node:assert/strict';
import { createInteractionCounter } from '../src/composables/interactionCounter.js';
import { easterEggSettings } from '../src/data/interactions.js';

test('连击有冷却且五次有效互动才触发纸箱', () => {
  let time = 0;
  const counter = createInteractionCounter(easterEggSettings, () => time);
  assert.equal(counter.hit(), 'shy');
  time += 50; assert.equal(counter.hit(), null);
  time = 200; assert.equal(counter.hit(), 'shy');
  time = 400; assert.equal(counter.hit(), 'panic');
  time = 600; assert.equal(counter.hit(), 'panic');
  time = 800; assert.equal(counter.hit(), 'box');
});
test('过期连击、角色切换和关闭纸箱后都从第一次开始', () => {
  let time = 0;
  const counter = createInteractionCounter(easterEggSettings, () => time);
  counter.hit(); time = 200; counter.hit();
  time = 5000; assert.equal(counter.hit(), 'shy');
  time = 5200; counter.hit(); counter.reset();
  assert.equal(counter.hit(), 'shy');
});
