import test from 'node:test';
import assert from 'node:assert/strict';
import { createInteractionAudioEngine } from '../src/audio/interactionAudioEngine.js';

function fixture() {
  let hidden = false, created = 0, state;
  const resumes = [], sources = [];
  const context = {
    state: 'suspended', sampleRate: 2000, currentTime: 0, destination: {}, deferred: false,
    createGain: () => ({ gain: { value: 0, setTargetAtTime(value) { this.value = value; } }, connect() {}, disconnect() {} }),
    createBuffer: (_, size) => ({ getChannelData: () => new Float32Array(size) }),
    createBufferSource() {
      const source = { started: false, stopped: false, disconnected: false, connect() {}, disconnect() { this.disconnected = true; }, start() { this.started = true; }, stop() { this.stopped = true; } };
      sources.push(source); return source;
    },
    resume() {
      if (this.deferred) return new Promise(resolve => resumes.push(() => { this.state = 'running'; resolve(); }));
      this.state = 'running'; return Promise.resolve();
    },
    suspend() { this.state = 'suspended'; return Promise.resolve(); },
    close() { this.state = 'closed'; return Promise.resolve(); }
  };
  const engine = createInteractionAudioEngine({ createContext: () => { created++; return context; }, onState: value => { state = value; }, isHidden: () => hidden });
  return { engine, context, sources, resumes, hide: () => { hidden = true; }, get created() { return created; }, get state() { return state; } };
}

test('默认静音不创建上下文，开启后复用上下文，音量被安全限制', async () => {
  const f = fixture();
  assert.equal(await f.engine.play('guitar', 196), false);
  assert.equal(f.created, 0);
  assert.equal(await f.engine.setEnabled(true), true);
  assert.equal(await f.engine.play('guitar', 196), true);
  assert.equal(await f.engine.play('bass', 55), true);
  assert.equal(f.created, 1);
  f.engine.setVolume(9); assert.equal(f.state.volume, .5);
  f.engine.setVolume(-1); assert.equal(f.state.volume, 0);
  f.engine.setVolume(NaN); assert.equal(f.state.volume, 0);
  f.engine.dispose(); assert.equal(f.context.state, 'closed');
});

test('静音先于 resume 完成时不播放，并重新挂起晚到的上下文', async () => {
  const f = fixture(); f.context.deferred = true;
  const enabling = f.engine.setEnabled(true);
  await f.engine.setEnabled(false);
  f.resumes.shift()(); assert.equal(await enabling, false);
  assert.equal(f.context.state, 'suspended');
  assert.equal(f.sources.length, 0);
  assert.equal(await f.engine.play('kick'), false);
  f.engine.dispose();
});

test('页面隐藏先于待播放 resume 完成时，不补放过期音效', async () => {
  const f = fixture(); await f.engine.setEnabled(true);
  f.context.state = 'suspended'; f.context.deferred = true;
  const playing = f.engine.play('snare', undefined, 'instrument');
  f.hide(); f.engine.suspend(); f.resumes.shift()();
  assert.equal(await playing, false);
  assert.equal(f.context.state, 'suspended');
  assert.equal(f.sources.length, 0); f.engine.dispose();
});

test('释放组件仅取消本组件待播声，不误取消另一组件的有效声', async () => {
  const f = fixture(); await f.engine.setEnabled(true);
  f.context.state = 'suspended'; f.context.deferred = true;
  const old = f.engine.play('kick', undefined, 'stage');
  const valid = f.engine.play('bass', 55, 'instrument');
  f.engine.release('stage');
  for (const resume of f.resumes) resume();
  assert.equal(await old, false); assert.equal(await valid, true);
  assert.equal(f.sources.length, 1); assert.equal(f.state.activeVoices, 1);
  f.engine.dispose();
});

test('最多五个声部，单组件停止与全局静音均正确释放音频节点', async () => {
  const f = fixture(); await f.engine.setEnabled(true);
  for (let i = 0; i < 8; i++) await f.engine.play('guitar', 196, i % 2 ? 'stage' : 'instrument');
  assert.equal(f.state.activeVoices, 5);
  assert.ok(f.sources.slice(0, 3).every(source => source.stopped && source.disconnected));
  f.engine.stop('stage'); assert.equal(f.state.activeVoices, 2);
  await f.engine.setEnabled(false); assert.equal(f.state.activeVoices, 0);
  assert.ok(f.sources.every(source => source.stopped && source.disconnected));
  assert.equal(f.context.state, 'suspended'); f.engine.dispose();
});

test('卸载期间的待开启 Promise 完成后，上下文保持关闭', async () => {
  const f = fixture(); f.context.deferred = true;
  const enabling = f.engine.setEnabled(true); f.engine.dispose();
  f.resumes.shift()(); assert.equal(await enabling, false);
  assert.equal(f.context.state, 'closed'); assert.equal(f.sources.length, 0);
});
