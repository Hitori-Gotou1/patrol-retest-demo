import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPattern, validatePattern, toArrangement, editPatternBar, patternSounds, arrangementPosition, encodePattern, decodePattern, parsePatternFile } from '../src/room/pattern.js';
import { arrangementDuration, arrangementEvents, audioBufferWav, renderArrangement } from '../src/audio/arrangementEngine.js';
import { defaultProject, validateProject, projectPosition } from '../src/room/projects.js';
import { soundGain, defaultSoundPreferences, validateSoundPreferences } from '../src/audio/soundPreferences.js';

test('legacy patterns remain byte-compatible while arrangements round trip every bar and loop range', () => {
  assert.deepEqual(validatePattern(defaultPattern), defaultPattern);
  let pattern = editPatternBar(defaultPattern, 'copy', 0);
  pattern.bars[0].name = '前奏'; pattern.bars[1].name = '主歌'; pattern.bars[1].masks = [0, 0, 0, 1];
  assert.deepEqual(decodePattern(encodePattern(pattern)), pattern);
  assert.deepEqual(parsePatternFile(JSON.stringify(pattern)), pattern);
  assert.equal(pattern.bars.length, 2); assert.equal(defaultPattern.version, 1);
  assert.equal(patternSounds(pattern, 0, 1)[0].id, 'hat');
  assert.equal(arrangementPosition(2500, pattern).bar, 1);
  assert.equal(arrangementPosition(5000, pattern).cycle, 2);
  assert.equal(arrangementPosition(5000, pattern, 1).done, true);
  pattern.loop = { start: 1, end: 1 };
  assert.equal(arrangementPosition(0, pattern).bar, 1);
  assert.equal(arrangementDuration(pattern, 2), 5);
  const events = arrangementEvents(pattern, 2);
  assert.equal(events.length, 2); assert.equal(events[1].at, 2.5);
});

test('bar editing copies independently, keeps valid ranges and enforces existing bounded data expectations', () => {
  let pattern = editPatternBar(defaultPattern, 'copy', 0);
  pattern.bars[1].masks[0] = 0;
  assert.notEqual(pattern.bars[0].masks[0], 0);
  const moved = editPatternBar(pattern, 'move', 1, 0);
  assert.equal(moved.bars[0].masks[0], 0);
  assert.deepEqual(editPatternBar(moved, 'delete', 0).loop, { start: 0, end: 0 });
  assert.throws(() => editPatternBar(defaultPattern, 'delete', 0));
  while (pattern.bars.length < 16) pattern = editPatternBar(pattern, 'copy', 0);
  assert.throws(() => editPatternBar(pattern, 'copy', 0));
  assert.throws(() => validatePattern({ ...pattern, loop: { start: 0, end: 16 } }));
  assert.throws(() => validatePattern({ ...pattern, bars: [pattern.bars[0], pattern.bars[0]] }));
  assert.throws(() => validatePattern({ ...toArrangement(defaultPattern), bars: [] }));
});

test('project clock covers all selected bars and legacy projects still complete on their old schedule', () => {
  const project = validateProject({ ...defaultProject, pattern: editPatternBar(defaultPattern, 'copy', 0), cycles: 2 });
  assert.equal(projectPosition(2500, project).bar, 1);
  assert.equal(projectPosition(5000, project).cycle, 2);
  assert.equal(projectPosition(10000, project).done, true);
  assert.equal(projectPosition(10000, validateProject(defaultProject)).done, true);
});

test('WAV bytes use PCM16 stereo and preserve known sample values', async () => {
  const channels = [new Float32Array([0, .5, -1]), new Float32Array([1, -.5, 0])];
  const blob = audioBufferWav({ numberOfChannels: 2, length: 3, sampleRate: 44100, getChannelData: i => channels[i] });
  const bytes = await blob.arrayBuffer(), view = new DataView(bytes);
  assert.equal(blob.type, 'audio/wav'); assert.equal(bytes.byteLength, 56);
  assert.equal(new TextDecoder().decode(new Uint8Array(bytes, 0, 4)), 'RIFF');
  assert.equal(view.getUint16(22, true), 2); assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getInt16(46, true), 32767); assert.equal(view.getInt16(48, true), 16384);
});

test('oversized renders and already-cancelled requests fail before allocating audio nodes', async () => {
  let pattern = toArrangement(defaultPattern); pattern.bpm = 60;
  while (pattern.bars.length < 16) pattern = editPatternBar(pattern, 'copy', 0);
  await assert.rejects(renderArrangement(pattern, { cycles: 16, OfflineContext: class { constructor() { throw new Error('should not allocate'); } } }), /三分钟/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(renderArrangement(defaultPattern, { signal: controller.signal, OfflineContext: class { constructor() { throw new Error('should not allocate'); } } }), /取消/);
});

test('sound categories validate independently and master mute silences all while retaining levels', () => {
  const preferences = validateSoundPreferences({ ...defaultSoundPreferences, muted: true, music: .7, effects: .3, ambience: .1 });
  for (const category of ['music', 'effects', 'ambience']) assert.equal(soundGain(preferences, category), 0);
  assert.equal(soundGain({ ...preferences, muted: false }, 'music'), .7);
  assert.throws(() => validateSoundPreferences({ ...preferences, ambience: .7 }));
  assert.throws(() => validateSoundPreferences({ ...preferences, music: NaN }));
});

test('streaming WebM duration is inserted in Segment/Info without changing existing payload', async () => {
  const { withWebmDuration } = await import('../src/audio/webmDuration.js');
  // Unknown-length Segment, Info(TimecodeScale=1,000,000), and empty Tracks.
  const bytes = new Uint8Array([0x18,0x53,0x80,0x67,0xff,0x15,0x49,0xa9,0x66,0x87,0x2a,0xd7,0xb1,0x83,0x0f,0x42,0x40,0x16,0x54,0xae,0x6b,0x80]);
  const blob = await withWebmDuration(new Blob([bytes], {type:'video/webm'}), 7.45);
  const patched = new Uint8Array(await blob.arrayBuffer());
  assert.equal(patched.length,bytes.length+11); assert.equal(patched[9],0x92);
  assert.deepEqual([...patched.slice(17,20)],[0x44,0x89,0x88]);
  assert.equal(new DataView(patched.buffer).getFloat64(20),7450);
  assert.deepEqual([...patched.slice(28)],[0x16,0x54,0xae,0x6b,0x80]);
  assert.equal((await withWebmDuration(blob,8)).size,blob.size);
  await assert.rejects(withWebmDuration(new Blob(['bad']), 1));
});
