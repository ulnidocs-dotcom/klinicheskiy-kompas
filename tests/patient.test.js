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

test('patientScale/nextScales whitelist own, patient-facing scales only', () => {
  const app = KK.patientApp;
  assert.ok(app.patientScale('phq9'));
  for (const k of ['__proto__', 'constructor', 'toString', '', null, undefined]) assert.equal(app.patientScale(k), null, String(k));
  if (KK.data.scales.cssrs.audience === 'doctor') assert.equal(app.patientScale('cssrs'), null);
  assert.deepEqual(app.nextScales('gad7,__proto__,constructor,phq9,nope'), ['gad7', 'phq9']);
  assert.deepEqual(app.nextScales(null), []);
});

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('phqAlertOpen: «врач уведомлён» only with an open si_phq9 alert', () => {
  const s = KK.createStore({ storage: memStorage(), clock: () => new Date('2026-10-19T12:00:00Z') });
  s.reset();
  const app = KK.patientApp;
  assert.equal(app.phqAlertOpen(s.alerts({ patientId: 'p_anna', open: true })), false);
  const dm = s.alerts({ patientId: 'p_dmitry', open: true });
  assert.equal(app.phqAlertOpen(dm), true);
  dm.filter((a) => a.ruleId === 'si_phq9').forEach((a) => s.ackAlert(a.id, 'Просмотрено'));
  assert.equal(app.phqAlertOpen(s.alerts({ patientId: 'p_dmitry', open: true })), false);
});

test('scaleHistory skips C-SSRS and incomplete forms, uses saved band text', () => {
  const sc = (scaleId, answers, at) => ({ type: 'scale', at, payload: KK.scales.score(scaleId, answers) });
  const ev = [
    sc('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 0], '2026-10-01T10:00:00Z'),
    sc('gad7', [1, 1], '2026-10-02T10:00:00Z'),
    sc('cssrs', [0, 0, null, null, null, 0], '2026-10-03T10:00:00Z'),
    sc('gad7', [0, 0, 0, 0, 0, 0, 0], '2026-10-04T10:00:00Z'),
  ];
  const h = KK.patientApp.scaleHistory(ev);
  assert.deepEqual(h.map((x) => x.scaleId), ['gad7', 'phq9']);
  assert.equal(h[1].label, ev[0].payload.band.patientText || 'Ответы получены врачом.');
  assert.ok(h.every((x) => !/\d/.test(x.label)));
});
