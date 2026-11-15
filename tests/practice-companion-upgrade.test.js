import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultRhythmPreferences, validateRhythmPreferences, calibrationOffset, newRhythmRound, hitRhythmNote, rhythmResult, expireRhythmNotes } from '../src/room/rhythm.js';
import { emptyPractice, practiceKey, validatePractice, startPractice, pausePractice, resumePractice, finishPracticeEarly, actualPracticeSeconds, advancePractice, editPracticeRecord, practiceTrend } from '../src/room/practice.js';
import { practiceTransaction } from '../src/room/practiceTransaction.js';
import { defaultCompanion, validateCompanion, rememberActivity, updateCompanionMemory, deleteCompanionMemory, companionReaction } from '../src/room/companion.js';
import { diaryGroups, companionDiaryLimit } from '../src/room/companionDiary.js';

test('calibration uses a bounded robust median and custom key validation rejects collisions', () => {
  assert.equal(calibrationOffset([39, 42, 40, 300, 38, 41]), 41);
  assert.throws(() => calibrationOffset([10, 20, 30]));
  assert.throws(() => calibrationOffset([0, 1, 2, 301]));
  assert.throws(() => validateRhythmPreferences({ ...defaultRhythmPreferences, keys: ['D', 'd', 'j', 'k'] }));
  for (const keys of [['a', 's', ' ', 'f'], ['ArrowLeft', 'f', 'j', 'k'], ['a', 's']]) assert.throws(() => validateRhythmPreferences({ ...defaultRhythmPreferences, keys }));
  assert.deepEqual(validateRhythmPreferences({ version: 1, offsetMs: -80, keys: ['A', 'S', '1', '2'] }), { version: 1, offsetMs: -80, keys: ['a', 's', '1', '2'] });
});

test('rhythm applies input compensation before judging and keeps signed feedback without changing score rules', () => {
  let round = newRhythmRound('easy');
  const first = round.notes[0];
  round = hitRhythmNote(round, first.lane, first.at + 150, 150);
  assert.equal(round.notes[0].judgment, 'Perfect');
  assert.equal(round.notes[0].deviation, 0);
  assert.equal(round.notes[0].rawDeviation, 150);
  assert.equal(round.score, 1020);
  const next = round.notes[1];
  assert.equal(expireRhythmNotes(round, next.at + 150 - 150).notes[1].judgment, '');
  round = hitRhythmNote(round, next.lane, next.at + 60, 150);
  assert.equal(round.notes[1].deviation, -90);
  const result = rhythmResult(round);
  assert.equal(result.early, 1); assert.equal(result.centered, 1); assert.equal(result.late, 0);
  assert.equal(result.distribution.reduce((sum, bucket) => sum + bucket.count, 0), 2);
  for (const deviation of [-180, -70, -15, 0, 15, 70, 180]) {
    const single = newRhythmRound('easy');
    const judged = hitRhythmNote(single, single.notes[0].lane, single.notes[0].at + deviation);
    assert.equal(rhythmResult(judged).distribution.reduce((sum, bucket) => sum + bucket.count, 0), 1, `boundary ${deviation} counted once`);
  }
});

test('practice logs exact actual seconds, paused time is excluded and early finish is never recorded twice', () => {
  const started = Date.UTC(2026, 10, 14, 12);
  let store = startPractice(structuredClone(emptyPractice), started, 25, 5, 'session-a', { track: '那首歌', goal: '副歌慢速', reflection: '手指放松' });
  store = pausePractice(store, started + 45000);
  assert.equal(actualPracticeSeconds(store.current, started + 600000), 45);
  store = resumePractice(store, started + 600000);
  store = finishPracticeEarly(store, started + 615000, true, '今天更顺了');
  assert.equal(store.current, null); assert.equal(store.totalSeconds, 60); assert.equal(store.totalMinutes, 1); assert.equal(store.totalSessions, 1);
  assert.equal(store.records[0].plannedMinutes, 25); assert.equal(store.records[0].actualSeconds, 60); assert.equal(store.records[0].endedEarly, true);
  assert.equal(store.records[0].track, '那首歌'); assert.equal(store.records[0].goal, '副歌慢速'); assert.equal(store.records[0].reflection, '今天更顺了');
  assert.equal(finishPracticeEarly(store, started + 620000, true), store);
  const duplicate = advancePractice(startPractice(store, started + 700000, 1, 0, 'session-a'), started + 760000);
  assert.equal(duplicate.records.length, 1); assert.equal(duplicate.totalSeconds, 60);
});

test('short practice is explicit, discard does not record and legacy JSON remains readable', () => {
  const old = validatePractice({ version: 1, current: null, totalMinutes: 40, totalSessions: 2, records: [{ id: 'old', date: '2026-11-13', minutes: 20 }] });
  assert.equal(old.totalSeconds, 2400); assert.equal(old.records[0].actualSeconds, 1200); assert.equal(old.records[0].plannedMinutes, 20);
  let store = startPractice(old, 0, 10, 0, 'short');
  assert.equal(finishPracticeEarly(store, 15000, false).totalSessions, 2);
  store = finishPracticeEarly(store, 15000, true);
  assert.equal(store.records.at(-1).minutes, 0); assert.equal(store.records.at(-1).actualSeconds, 15);
  assert.equal(validatePractice(JSON.parse(JSON.stringify(store))).records.length, 2);
  store = editPracticeRecord(store, 'short', { reflection: 'x'.repeat(300) });
  assert.equal(store.records.at(-1).reflection.length, 240);
  assert.equal(store.totalSeconds, 2415);
});

test('week/month trends aggregate actual seconds by calendar date', () => {
  const now = new Date(2026, 10, 14, 12);
  const records = [{ date: '2026-11-14', minutes: 0, actualSeconds: 45 }, { date: '2026-11-14', minutes: 2, actualSeconds: 120 }, { date: '2026-11-10', minutes: 4 }];
  const week = practiceTrend(records, now, 7), month = practiceTrend(records, now, 30);
  assert.equal(week.length, 7); assert.equal(month.length, 30); assert.equal(week.at(-1).seconds, 165); assert.equal(week.at(-1).sessions, 2);
  assert.equal(week.reduce((sum, day) => sum + day.seconds, 0), 405);
  assert.throws(() => practiceTrend(records, now, 365));
});

test('serialized multi-tab transactions start one timer and commit one completion from fresh shared state', async () => {
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  let queue = Promise.resolve();
  const locks = { request(_name, callback) { const result = queue.then(callback); queue = result.catch(() => {}); return result; } };
  await Promise.all(['tab-a', 'tab-b'].map(id => practiceTransaction(latest => latest.current ? latest : startPractice(latest, 0, 1, 0, id), { storage, locks })));
  assert.equal(JSON.parse(data.get(practiceKey)).current.id, 'tab-a');
  await Promise.all([1, 2].map(() => practiceTransaction(latest => advancePractice(latest, 60000), { storage, locks })));
  const final = validatePractice(JSON.parse(data.get(practiceKey)));
  assert.equal(final.totalSessions, 1); assert.equal(final.records.length, 1); assert.equal(final.current, null);
  const invalidRaw = '{bad'; data.set(practiceKey, invalidRaw);
  await assert.rejects(practiceTransaction(latest => latest, { storage, locks }));
  assert.equal(data.get(practiceKey), invalidRaw, 'malformed stored data was retained');
});

test('companion migrates recent memories, adds bounded long diary, retains pinned pages and supports work association', () => {
  const oldEvent = { id: 'old-photo', kind: 'photo', detail: '生日合影', at: 1 };
  let state = validateCompanion({ ...defaultCompanion, diary: undefined, memories: [oldEvent, null], member: 'nijika' });
  assert.equal(state.diary.length, 1); assert.equal(state.diary[0].member, 'nijika');
  state = updateCompanionMemory(state, oldEvent.id, { pinned: true, workId: 'work-a', workTitle: '那张照片' });
  for (let index = 0; index < 220; index++) state = rememberActivity(state, { id: `event-${index}`, kind: 'practice', detail: '练习', at: index + 2 });
  assert.equal(state.diary.length, companionDiaryLimit); assert.equal(state.memories.length, 8); assert.equal(state.seen.length, 80);
  assert.equal(state.diary.find(entry => entry.id === oldEvent.id).workId, 'work-a');
  const important = diaryGroups(state.diary, { pinned: true });
  assert.equal(important.reduce((sum, day) => sum + day.memories.length, 0), 1);
  assert.throws(() => updateCompanionMemory(state, 'missing', { pinned: true }));
});

test('deleted companion pages stay deleted during catch-up and each character has an original distinct response', () => {
  const event = { id: 'one', kind: 'project', detail: '那一晚', at: Date.UTC(2026, 10, 14) };
  let state = rememberActivity(defaultCompanion, event);
  state = deleteCompanionMemory(state, event.id);
  state = rememberActivity(state, event);
  assert.equal(state.diary.length, 0); assert.equal(state.memories.length, 0); assert.ok(state.diaryDeleted.includes(event.id));
  const replies = ['hitori', 'nijika', 'ryo', 'kita'].map(member => companionReaction(member, event));
  assert.equal(new Set(replies).size, 4); assert.ok(replies.every(reply => !reply.includes('undefined')));
  assert.equal(diaryGroups([{ ...event, member: 'kita' }])[0].date, '2026-11-14');
});
