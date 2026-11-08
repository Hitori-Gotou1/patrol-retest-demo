import test from 'node:test';
import assert from 'node:assert/strict';
import { rhythmLevels, makeRhythmChart, newRhythmRound, hitRhythmNote, expireRhythmNotes, rhythmResult } from '../src/room/rhythm.js';
import { defaultPattern, validatePattern, togglePatternStep, patternSounds, encodePattern, decodePattern, parsePatternFile, sequencerStep } from '../src/room/pattern.js';
import { emptyPractice, validatePractice, startPractice, advancePractice, pausePractice, resumePractice, remainingPractice, practiceStreak, dateKey } from '../src/room/practice.js';
import { roomStories } from '../src/data/roomStories.js';
import { storyNode, storyEndings, validateStoryProgress } from '../src/room/story.js';
import { journalNotes } from '../src/data/journal.js';
import { validateGuestbookDraft, guestbookIssueBody, guestbookSubmissionUrl, draftFromIssue, validateGuestbookWall, safeGuestbookLink } from '../src/room/guestbook.js';

test('all difficulty charts are ordered, bounded four-lane rounds with a four-beat count-in', () => {
  for (const [level, config] of Object.entries(rhythmLevels)) {
    const chart = makeRhythmChart(level);
    assert.equal(chart.length, config.notes);
    assert.equal(chart[0].at, 4 * 60000 / config.bpm);
    assert.ok(chart.every((note,index) => note.id === index && note.lane >= 0 && note.lane < 4 && (index === 0 || note.at > chart[index-1].at)));
    assert.ok(chart.at(-1).at < 30000);
  }
  assert.throws(() => makeRhythmChart('unknown'));
});

for (const [offset, expected] of [[0, 'Perfect'], [70, 'Perfect'], [71, 'Great'], [130, 'Great'], [131, 'Good'], [180, 'Good']]) {
  test(`rhythm timing ${offset}ms has the correct inclusive judgment window`, () => {
    const round = newRhythmRound('normal'), note = round.notes[0];
    const hit = hitRhythmNote(round, note.lane, note.at + offset);
    assert.equal(hit.notes[0].judgment, expected);
    assert.equal(round.notes[0].judgment, '', 'input state remains reusable');
    assert.equal(hit.combo, 1);
    assert.equal(hitRhythmNote(hit, note.lane, note.at).notes[0].judgment, expected);
    assert.equal(hitRhythmNote(hit, note.lane, note.at).combo, 0, 'the same note cannot score twice');
  });
}

test('wrong lanes, late notes, and repeated taps cannot inflate accuracy', () => {
  let round = newRhythmRound('easy');
  const first = round.notes[0];
  round = hitRhythmNote(round, (first.lane + 1) % 4, first.at);
  assert.equal(round.score, 0);
  assert.equal(round.stray, 1);
  round = hitRhythmNote(round, first.lane, first.at);
  assert.ok(round.score > 0);
  round = expireRhythmNotes(round, 100000);
  assert.equal(round.notes.filter(note => note.judgment === 'Miss').length, 15);
  assert.ok(rhythmResult(round).accuracy < 7);
  assert.equal(expireRhythmNotes(round, 100001), round);
});

test('a complete clean round earns full accuracy, S rank and the real longest combo', () => {
  let round = newRhythmRound('hard');
  for (const note of round.notes) round = hitRhythmNote(round, note.lane, note.at);
  assert.equal(rhythmResult(round).accuracy, 100);
  assert.equal(rhythmResult(round).rank, 'S');
  assert.equal(rhythmResult(round).maxCombo, round.notes.length);
});

test('pattern links and JSON round trip Unicode names without changing the source pattern', () => {
  const pattern = { ...defaultPattern, name: '放学后的雨 · ☂', masks: [0,65535,3,4096] };
  assert.deepEqual(decodePattern(encodePattern(pattern)), pattern);
  assert.deepEqual(parsePatternFile(JSON.stringify(pattern)), pattern);
  const next = togglePatternStep(defaultPattern, 0, 1);
  assert.equal(next.masks[0], defaultPattern.masks[0] ^ 2);
  assert.equal(defaultPattern.masks[0], 0x1111);
  assert.deepEqual(patternSounds({ ...pattern, masks: [1,0,1,0] },0).map(track => track.id), ['guitar','kick']);
});

test('invalid patterns are rejected before they can replace a saved composition', () => {
  for (const changed of [{ version:2 }, { bpm:59 }, { bpm:181 }, { bpm:NaN }, { bpm:100.2 }, { name:'' }, { masks:[1,2] }, { masks:[-1,0,0,0] }, { masks:[65536,0,0,0] }]) {
    assert.throws(() => validatePattern({ ...defaultPattern, ...changed }));
  }
  for (const value of ['', '../x', 'x'.repeat(2049), encodePattern(defaultPattern).slice(0,5)]) assert.throws(() => decodePattern(value));
  assert.throws(() => parsePatternFile(' '.repeat(16385)));
  assert.throws(() => togglePatternStep(defaultPattern, 4, 0));
  assert.equal(sequencerStep(60000, 120), 0, 'a late frame locates the current loop instead of replaying old steps');
});

test('practice records one completed focus even after a long background gap, without starting new rounds', () => {
  const start = Date.UTC(2026,10,8,12);
  const running = startPractice(structuredClone(emptyPractice), start, 1, 1, 'round-a');
  const done = advancePractice(running, start + 3600000);
  assert.equal(done.totalMinutes, 1);
  assert.equal(done.totalSessions, 1);
  assert.equal(done.records.length, 1);
  assert.equal(done.current, null);
  assert.equal(advancePractice(done, start + 7200000), done);
  assert.equal(running.records.length, 0);
});

test('pause and resume freeze remaining time and preserve exactly one focus completion', () => {
  let state = startPractice(structuredClone(emptyPractice), 100000, 2, 1, 'round-b');
  state = pausePractice(state, 130000);
  assert.equal(remainingPractice(state.current, 9999999), 90000);
  assert.equal(advancePractice(state, 9999999), state);
  state = resumePractice(state, 500000);
  assert.equal(state.current.deadline, 590000);
  state = advancePractice(state, 590000);
  assert.equal(state.current.phase, 'break');
  assert.equal(state.totalMinutes, 2);
  state = pausePractice(state, 600000);
  state = resumePractice(state, 700000);
  state = advancePractice(state, 750000);
  assert.equal(state.current, null);
  assert.equal(state.records.length, 1);
});

test('practice validation, retained detail limit and cumulative totals remain consistent', () => {
  for (const minutes of [0,181,1.5,NaN]) assert.throws(() => startPractice(structuredClone(emptyPractice),0,minutes,5,'bad'));
  assert.throws(() => startPractice(structuredClone(emptyPractice),0,1,61,'bad'));
  assert.throws(() => validatePractice({ ...emptyPractice, current:{ phase:'other' } }));
  let state = structuredClone(emptyPractice);
  for (let i=0;i<370;i++) state = advancePractice(startPractice(state,i*1000000,1,0,`round-${i}`),i*1000000+60000);
  assert.equal(state.records.length,365);
  assert.equal(state.totalSessions,370);
  assert.equal(state.totalMinutes,370);
});

test('practice streak permits today or yesterday and stops at calendar gaps', () => {
  const today = new Date(2026,10,8,12);
  const day = offset => { const value=new Date(today); value.setDate(value.getDate()+offset); return dateKey(value); };
  assert.equal(practiceStreak([0,-1,-2].map(offset=>({date:day(offset)})),today),3);
  assert.equal(practiceStreak([-1,-2].map(offset=>({date:day(offset)})),today),2);
  assert.equal(practiceStreak([-2,-3].map(offset=>({date:day(offset)})),today),0);
  assert.equal(practiceStreak([0,0,-1,-3].map(offset=>({date:day(offset)})),today),2);
});

test('every story choice reaches a real node, all endings are reachable, and saved progress survives reload', () => {
  const progress = {};
  for (const story of roomStories) {
    const reached = new Set(), endings = new Set();
    const visit = path => {
      const node = storyNode(story,path); reached.add(node.id);
      assert.ok(node.text && node.speaker);
      if (node.ending) { endings.add(node.ending); progress[story.id] = {path,endings:[...endings]}; }
      else { assert.ok(node.choices.length >= 2); node.choices.forEach((_choice,index)=>visit([...path,index])); }
    };
    visit([]);
    assert.equal(reached.size,Object.keys(story.nodes).length);
    assert.equal(endings.size,storyEndings(story).length);
    assert.ok(endings.size>=2);
  }
  const saved = validateStoryProgress({version:1,lastStory:roomStories.at(-1).id,progress},roomStories);
  assert.equal(saved.lastStory,roomStories.at(-1).id);
  assert.equal(saved.progress[roomStories[0].id].endings.length,2);
  assert.throws(()=>storyNode(roomStories[0],[99]));
  const recovered = validateStoryProgress({version:1,progress:{[roomStories[0].id]:{path:[99],endings:[storyEndings(roomStories[0])[0],'fake']}}},roomStories);
  assert.deepEqual(recovered.progress[roomStories[0].id].path,[]);
  assert.equal(recovered.progress[roomStories[0].id].endings.length,1);
});

test('journal articles have unique shareable slugs, valid dates, and readable original content', () => {
  const slugs = new Set(); assert.ok(journalNotes.length > 0);
  for (const note of journalNotes) {
    assert.match(note.slug,/^[a-z0-9-]+$/); assert.ok(!slugs.has(note.slug)); slugs.add(note.slug);
    assert.ok(Number.isFinite(Date.parse(note.date)) && note.title && note.summary && note.author);
    assert.ok(note.sections.length > 0 && note.sections.every(section=>section.heading && section.text.length > 40));
  }
});

const draft = { kind:'留言',nickname:'访客',message:'喜欢这一段。\n### 内容\n<img src=x onerror=alert(1)>',song:'',link:'' };
test('guestbook draft serializes safely and preserves text without allowing forged section headings', () => {
  const issue = {title:'[小屋来信] 测试',body:guestbookIssueBody(draft)};
  assert.deepEqual(draftFromIssue(issue),draft);
  const url = new URL(guestbookSubmissionUrl(draft));
  assert.equal(url.hostname,'github.com');
  assert.equal(url.searchParams.get('body'),guestbookIssueBody(draft));
  assert.throws(()=>draftFromIssue({...issue,pull_request:{}}));
});

test('guestbook rejects unsafe links, oversized submissions, and incomplete song requests', () => {
  for (const link of ['javascript:alert(1)','data:text/html,x','http://example.com','https://user:password@example.com']) assert.throws(()=>safeGuestbookLink(link));
  assert.throws(()=>validateGuestbookDraft({...draft,kind:'点歌'}));
  assert.throws(()=>validateGuestbookDraft({...draft,message:'x'.repeat(601)}));
  assert.throws(()=>guestbookSubmissionUrl({...draft,message:'好'.repeat(600),song:'歌'.repeat(120),nickname:'名'.repeat(40),link:'https://example.test/'+ '好'.repeat(200)}));
  assert.throws(()=>validateGuestbookWall({version:1,posts:[{...draft,issue:1}]}));
});
