'use strict';
// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const S = require('../public/js/skipper.js');

const approx = (a, b, d = 0.06) => assert.ok(Math.abs(a - b) <= d, `${a} should be within ${d} of ${b}`);

test('classifyTitle reads intros, outros and off-topic sections', () => {
  assert.equal(S.classifyTitle('Intro'), 'intro');
  assert.equal(S.classifyTitle('Cold Open'), 'intro');
  assert.equal(S.classifyTitle('Outro'), 'outro');
  assert.equal(S.classifyTitle('End Credits'), 'outro');
  assert.equal(S.classifyTitle('Thanks for watching!'), 'outro');
  assert.equal(S.classifyTitle('Skit'), 'offtopic');
  assert.equal(S.classifyTitle('Sponsor message'), 'offtopic');
  for (const t of ['Verse 1', 'Chorus', 'Bridge', 'Pillow Talk', 'Final Countdown', '', null]) assert.equal(S.classifyTitle(t), null, String(t));
});

test('parseTimestamps handles the usual description styles', () => {
  const a = S.parseTimestamps('Great song!\n0:00 Intro\n0:25 Verse\n1:10 Chorus\n3:10 Outro\nFollow me', 220);
  assert.deepEqual(a.map(x => [x.start, x.title]), [[0, 'Intro'], [25, 'Verse'], [70, 'Chorus'], [190, 'Outro']]);
  const b = S.parseTimestamps('Intro 0:00\nVerse 0:25\nOutro - 3:10', 220);
  assert.equal(b.length, 3);
  const c = S.parseTimestamps('1. [00:00] Intro\n2. [00:30] Main\n3. (02:50) Credits', 200);
  assert.deepEqual(c.map(x => x.start), [0, 30, 170]);
  const d = S.parseTimestamps('0:00 Intro\n1:00:30 Late', 7200);
  assert.deepEqual(d, [], 'fewer than three');
});

test('parseTimestamps refuses anything YouTube would not treat as chapters', () => {
  assert.deepEqual(S.parseTimestamps('0:30 a\n1:00 b\n2:00 c', 300), [], 'must start at the beginning');
  assert.deepEqual(S.parseTimestamps('0:00 a\n2:00 b\n1:00 c', 300), [], 'out of order');
  assert.deepEqual(S.parseTimestamps('0:00 a\n1:00 b\n9:00 c', 300), [], 'past the end');
  assert.deepEqual(S.parseTimestamps('', 300), []);
});

test('chapters: a short intro and a credits section on a normal song', () => {
  const ch = [{ start: 0, title: 'Intro' }, { start: 20, title: 'Verse 1' }, { start: 100, title: 'Chorus' }, { start: 215, title: 'Outro' }];
  const segs = S.fromChapters(ch, 240);
  assert.equal(segs.length, 2);
  assert.deepEqual([segs[0].kind, segs[0].start, segs[0].end], ['intro', 0, 20]);
  assert.deepEqual([segs[1].kind, segs[1].start, segs[1].end], ['outro', 215, 240]);
  assert.ok(segs.every(s => s.conf >= 0.9));
});

test('chapters: hours-long mixes are protected from skipping real songs', () => {
  const mix = [{ start: 0, title: 'Intro' }, { start: 270, title: 'Song A' }, { start: 700, title: 'Song B' }];
  assert.deepEqual(S.fromChapters(mix, 3600), [], 'a 4½ minute "Intro" is a song, not an intro');
  const short = [{ start: 0, title: 'Intro' }, { start: 80, title: 'Song A' }, { start: 700, title: 'Song B' }];
  const segs = S.fromChapters(short, 3600);
  assert.equal(segs.length, 1);
  assert.ok(segs[0].conf < 0.75, 'long-form confidence is reduced');
});

test('chapters: ignores an "Intro" that is not at the start and credits in the first half', () => {
  assert.deepEqual(S.fromChapters([{ start: 60, title: 'Intro' }, { start: 90, title: 'x' }], 240), []);
  assert.deepEqual(S.fromChapters([{ start: 0, title: 'Verse' }, { start: 40, title: 'Credits' }, { start: 100, title: 'Chorus' }], 240), []);
});

test('chapters: an off-topic skit resolves by where it sits', () => {
  const start = S.fromChapters([{ start: 0, title: 'Skit' }, { start: 30, title: 'Song' }], 240);
  assert.equal(start[0].kind, 'intro');
  const mid = S.fromChapters([{ start: 0, title: 'Song' }, { start: 100, title: 'Ad read' }, { start: 130, title: 'Song' }], 240);
  assert.equal(mid[0].kind, 'break');
});

test('crowd: maps categories, drops bad submissions', () => {
  const items = [
    { segment: [0, 14], category: 'intro', votes: 4, actionType: 'skip', videoDuration: 240 },
    { segment: [215, 240], category: 'outro', votes: 2, locked: 1, actionType: 'skip', videoDuration: 240 },
    { segment: [100, 120], category: 'sponsor', votes: 3, actionType: 'skip', videoDuration: 240 },
    { segment: [0, 10], category: 'intro', votes: -2, actionType: 'skip' },
    { segment: [0, 10], category: 'intro', votes: 5, actionType: 'skip', videoDuration: 400 },
    { segment: [10, 200], category: 'music_offtopic', votes: 5, actionType: 'skip', videoDuration: 240 },
    { segment: [30, 40], category: 'poi_highlight', votes: 5, actionType: 'skip' },
    { segment: [30, 40], category: 'intro', votes: 5, actionType: 'mute' },
  ];
  const segs = S.fromCrowd(items, 240);
  assert.deepEqual(segs.map(s => s.kind), ['intro', 'outro', 'break']);
  assert.equal(segs[1].conf, 0.95, 'locked submissions are trusted');
  assert.ok(segs[0].conf > 0.8);
});

test('crowd: new unvoted submissions are weak, not trusted', () => {
  const [s] = S.fromCrowd([{ segment: [0, 12], category: 'music_offtopic', votes: 0, actionType: 'skip' }], 200);
  assert.equal(s.kind, 'intro');
  assert.ok(s.conf <= 0.5);
});

test('silence: finds a quiet lead-in, dead air and a hidden-track gap', () => {
  const segs = S.fromSilence({ dur: 240, silences: [[0, 3], [100, 112], [222, 240]] }, 240);
  const by = Object.fromEntries(segs.map(s => [s.kind, s]));
  assert.equal(by.intro.end, 3); approx(by.intro.to, 2.8);
  assert.equal(by.outro.start, 222);
  assert.equal(by.break.start, 100); approx(by.break.to, 111.8);
});

test('silence: ignores short pauses, tiny lead-ins and very short files', () => {
  assert.deepEqual(S.fromSilence({ dur: 240, silences: [[0, 1.2], [100, 103], [237, 240]] }, 240), []);
  assert.deepEqual(S.fromSilence({ dur: 15, silences: [[0, 4]] }, 15), []);
  assert.deepEqual(S.fromSilence(null, 240), []);
  assert.deepEqual(S.fromSilence({ dur: 240, silences: [[30, 36]] }, 240).map(s => s.kind), ['break']);
});

test('plan: agreement between sources raises confidence', () => {
  const one = S.plan(S.fromChapters([{ start: 0, title: 'Intro' }, { start: 15, title: 'x' }], 200), 200);
  const both = S.plan([
    ...S.fromChapters([{ start: 0, title: 'Intro' }, { start: 15, title: 'x' }], 200),
    ...S.fromCrowd([{ segment: [0, 14], category: 'intro', votes: 3, actionType: 'skip', videoDuration: 200 }], 200),
    ...S.fromSilence({ dur: 200, silences: [[0, 14.5]] }, 200),
  ], 200);
  assert.ok(both.intro.conf > one.intro.conf, `${both.intro.conf} > ${one.intro.conf}`);
  assert.ok(both.intro.conf > 0.95);
  assert.deepEqual(both.intro.why.sort(), ['chapter', 'crowd', 'silence']);
});

test('plan: silence supplies the exact moment sound returns', () => {
  const p = S.plan([
    ...S.fromCrowd([{ segment: [0, 5], category: 'intro', votes: 4, actionType: 'skip', videoDuration: 200 }], 200),
    ...S.fromSilence({ dur: 200, silences: [[0, 3.4]] }, 200),
  ], 200);
  approx(p.intro.to, 3.2);
});

test('plan: conflicting evidence picks the better supported answer', () => {
  const p = S.plan([
    { kind: 'intro', start: 0, end: 12, src: 'crowd', conf: 0.5 },
    { kind: 'intro', start: 0, end: 40, src: 'chapter', conf: 0.92 },
  ], 200);
  assert.equal(p.intro.end, 40);
});

test('plan: an "intro" beyond the first half of the song is rejected, outro must be late', () => {
  const p = S.plan([
    { kind: 'intro', start: 0, end: 150, src: 'crowd', conf: 0.9 },
    { kind: 'outro', start: 40, end: 200, src: 'crowd', conf: 0.9 },
  ], 200);
  assert.equal(p.intro, null);
  assert.equal(p.outro, null);
});

test('plan: outro reaching the end is flagged toEnd; two separate breaks both survive', () => {
  const p = S.plan([
    { kind: 'outro', start: 180, end: 200, src: 'chapter', conf: 0.9 },
    { kind: 'break', start: 50, end: 70, src: 'crowd', conf: 0.8 },
    { kind: 'break', start: 120, end: 135, src: 'crowd', conf: 0.8 },
  ], 200);
  assert.equal(p.outro.toEnd, true);
  assert.equal(p.breaks.length, 2);
});

test('actionFor: modes and sureness', () => {
  const seg = c => ({ conf: c });
  assert.equal(S.actionFor(seg(0.9), 'off', 'balanced'), 'none');
  assert.equal(S.actionFor(seg(0.9), 'button', 'balanced'), 'button');
  assert.equal(S.actionFor(seg(0.9), 'auto', 'balanced'), 'auto');
  assert.equal(S.actionFor(seg(0.6), 'auto', 'balanced'), 'button', 'not sure enough to skip by itself');
  assert.equal(S.actionFor(seg(0.4), 'auto', 'balanced'), 'none');
  assert.equal(S.actionFor(seg(0.6), 'auto', 'careful'), 'none', 'careful mode wants 0.7 even for a button');
  assert.equal(S.actionFor(seg(0.75), 'auto', 'careful'), 'button');
  assert.equal(S.actionFor(seg(0.55), 'auto', 'eager'), 'auto');
  assert.equal(S.actionFor(seg(0.95), 'auto', 'balanced', 'none'), 'none', 'the person rejected it before');
  assert.equal(S.actionFor(seg(0.95), 'auto', 'balanced', 'button'), 'button', 'downgraded after an undo');
  assert.equal(S.actionFor(seg(0.95), 'auto', 'nonsense'), 'auto');
});

test('due: fires only inside a segment, once, and respects honoured sections', () => {
  const plan = { intro: { kind: 'intro', start: 0, end: 20, to: 20, conf: 0.9, toEnd: false }, outro: { kind: 'outro', start: 200, end: 220, to: 220, conf: 0.9, toEnd: true }, breaks: [] };
  const o = { intro: 'auto', outro: 'button', breaks: 'off', sure: 'balanced', fired: {}, honored: {} };
  assert.equal(S.due(plan, 0.2, o).act, 'auto');
  assert.equal(S.due(plan, 21, o), null, 'past the intro');
  assert.equal(S.due(plan, 100, o), null);
  assert.equal(S.due(plan, 199.8, o).act, 'button', 'a moment of lead-in before the outro');
  assert.equal(S.due(plan, 210, o).seg.kind, 'outro');
  o.fired['intro@0'] = true;
  assert.equal(S.due(plan, 5, o), null, 'already skipped');
  o.fired = {}; o.honored['intro@0'] = true;
  assert.equal(S.due(plan, 5, o), null, 'the person seeked back into it');
  assert.equal(S.due(null, 5, o), null);
});

test('SponsorBlock helpers: privacy-preserving lookup', async () => {
  const id = 'dQw4w9WgXcQ';
  const want = crypto.createHash('sha256').update(id).digest('hex').slice(0, 4);
  assert.equal(await S.hashPrefix(id), want);
  const url = S.crowdUrl(want);
  assert.ok(url.startsWith('https://sponsor.ajay.app/api/skipSegments/' + want));
  assert.ok(!url.includes(id), 'the video id itself is never sent');
  const json = [{ videoID: 'other-video', segments: [{ segment: [0, 1], category: 'intro' }] }, { videoID: id, segments: [{ segment: [0, 9], category: 'intro', votes: 2 }] }];
  assert.equal(S.pickCrowd(json, id).length, 1);
  assert.deepEqual(S.pickCrowd(json, 'nope'), []);
  assert.deepEqual(S.pickCrowd(null, id), []);
});

test('end to end: a typical music video with a spoken intro and dead air', () => {
  const dur = 214;
  const segs = [
    ...S.fromChapters([], dur),
    ...S.fromCrowd([{ segment: [0, 11.2], category: 'music_offtopic', votes: 6, actionType: 'skip', videoDuration: 214 }], dur),
    ...S.fromSilence({ dur, silences: [[0, 0.9], [206, 214]] }, dur),
  ];
  const p = S.plan(segs, dur);
  assert.equal(p.intro.kind, 'intro');
  approx(p.intro.to, 11.2, 0.1);
  assert.ok(p.intro.conf >= 0.8);
  assert.equal(p.outro.toEnd, true);
  assert.equal(S.actionFor(p.intro, 'auto', 'balanced'), 'auto');
});
