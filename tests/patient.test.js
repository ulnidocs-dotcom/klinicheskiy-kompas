const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

test('materials: unique ids, known categories, each has source', () => {
  const ids = new Set();
  for (const m of KK.data.materials) {
    assert.ok(!ids.has(m.id), m.id); ids.add(m.id);
    assert.ok(['about', 'treatment', 'practice'].includes(m.cat), m.id);
    assert.ok(m.source && m.title && m.summary && m.body.length, m.id);
  }
  assert.ok(KK.data.materials.filter((m) => m.cat === 'practice').length >= 4);
});

test('patient copy has no alarming words or digits-as-scores', () => {
  const bad = /тяж[её]л|критич|выраженн|!|балл/i;
  for (const m of KK.data.materials) {
    const text = [m.title, m.summary, ...m.body.map((b) => (typeof b === 'string' ? b : (b.items || []).join(' ')))].join(' ');
    assert.doesNotMatch(text, bad, m.id);
  }
});

test('practiceOfDay is deterministic per date', () => {
  const a = KK.patientApp.practiceOfDay(new Date(2026, 9, 19, 8, 0).toISOString());
  const b = KK.patientApp.practiceOfDay(new Date(2026, 9, 19, 20, 0).toISOString());
  assert.equal(a.id, b.id);
  assert.equal(a.cat, 'practice');
});

test('dueScales returns scales older than period', () => {
  const now = '2026-10-19T12:00:00.000Z';
  const latest = { phq9: { at: '2026-10-01T10:00:00Z' }, gad7: { at: '2026-10-15T10:00:00Z' }, cssrs: null };
  assert.deepEqual(KK.patientApp.dueScales(latest, now, 14), ['phq9']);
  assert.deepEqual(KK.patientApp.dueScales({ phq9: null, gad7: null }, now, 14), ['gad7', 'phq9']);
});

test('checkinSummary is gentle text', () => {
  const t = KK.patientApp.checkinSummary([{ payload: { mood: 2 } }, { payload: { mood: 2 } }, { payload: { mood: 4 } }, { payload: { mood: 4 } }]);
  assert.match(t, /настроение/i);
  assert.doesNotMatch(t, /\d/);
});
