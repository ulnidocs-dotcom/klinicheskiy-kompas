const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const NOW = '2026-10-19T12:00:00.000Z';
const at = (d) => KK.util.shiftDays(NOW, -d);
const scale = (id, answers, d) => ({ type: 'scale', at: at(d), payload: KK.scales.score(id, answers) });
const patient = (over = {}) => Object.assign({
  id: 'p1', age: 40, sex: 'f', pregnant: false, lactating: false,
  diagnoses: [{ code: 'F41.1', text: 'ГТР' }], meds: [], allergies: [], conditions: [],
  labs: { egfr: 95, childPugh: 'none' }, history: {},
  plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: at(30), timesPerDay: 2 },
}, over);
const dosesFor = (days) => {
  const out = [];
  for (let d = 1; d <= days; d++) out.push({ type: 'dose', at: at(d), payload: { slot: 'утро', taken: true } }, { type: 'dose', at: at(d), payload: { slot: 'вечер', taken: true } });
  return out;
};
const run = (p, events) => KK.rules.evaluate(KK.rules.buildContext(p, events, NOW));
const ids = (sig) => sig.map((s) => s.ruleId).sort();

test('every rule declares id, level, source and functions', () => {
  for (const r of KK.data.rules) {
    assert.ok(r.id && r.level && r.source && typeof r.when === 'function' && typeof r.text === 'function', r.id);
  }
});

test('stable patient → no signals', () => {
  const ev = [...dosesFor(14), scale('phq9', [1, 1, 0, 1, 0, 0, 1, 0, 0], 2), scale('gad7', [1, 1, 1, 0, 0, 1, 0], 2)];
  assert.deepEqual(run(patient(), ev), []);
});

test('PHQ-9 item 9 > 0 → critical + required', () => {
  const ev = [...dosesFor(14), scale('phq9', [3, 3, 2, 2, 2, 3, 2, 2, 2], 0)];
  const sig = run(patient(), ev);
  const si = sig.find((s) => s.ruleId === 'si_phq9');
  assert.equal(si.level, 'critical');
  assert.equal(si.routing, 'required');
  assert.ok(sig.find((s) => s.ruleId === 'phq9_severe'));
  assert.equal(KK.rules.routing(sig), 'required');
});

test('sorted: critical first', () => {
  const ev = [...dosesFor(14), scale('phq9', [3, 3, 2, 2, 2, 3, 2, 2, 2], 0)];
  assert.equal(run(patient(), ev)[0].level, 'critical');
});

test('PHQ-9 15–19 → info + desirable', () => {
  const ev = [...dosesFor(14), scale('phq9', [2, 2, 2, 2, 2, 2, 2, 2, 0], 0)];
  const sig = run(patient(), ev);
  assert.deepEqual(ids(sig), ['phq9_modsevere']);
  assert.equal(KK.rules.routing(sig), 'desirable');
});

test('worsening ≥5 between two last GAD-7', () => {
  const ev = [...dosesFor(14), scale('gad7', [1, 1, 1, 0, 0, 1, 0], 14), scale('gad7', [2, 2, 2, 1, 1, 1, 1], 0)];
  assert.ok(run(patient(), ev).some((s) => s.ruleId === 'worsening'));
});

test('3 full days without doses → important', () => {
  const ev = [{ type: 'dose', at: at(5), payload: { slot: 'утро', taken: true } }];
  const s = run(patient(), ev).find((x) => x.ruleId === 'missed_doses');
  assert.equal(s.level, 'important');
});

test('SOS within 24h → critical', () => {
  const ev = [...dosesFor(14), { type: 'sos', at: at(0), payload: {} }];
  assert.equal(run(patient(), ev).find((s) => s.ruleId === 'sos').level, 'critical');
});

test('severe adverse event → critical', () => {
  const ev = [...dosesFor(14), { type: 'ae', at: at(0), payload: { items: [{ id: 'dizziness', severity: 'severe' }] } }];
  assert.ok(run(patient(), ev).some((s) => s.ruleId === 'ae_severe'));
});

test('contraindication present → important', () => {
  const sig = run(patient({ labs: { egfr: 52, childPugh: 'none' } }), dosesFor(14));
  assert.equal(sig.find((s) => s.ruleId === 'contraindication').level, 'important');
});

test('interaction → info with drug names', () => {
  const sig = run(patient({ meds: [{ name: 'Сертралин 50 мг' }] }), dosesFor(14));
  const s = sig.find((x) => x.ruleId === 'interaction');
  assert.equal(s.level, 'info');
  assert.match(s.text, /Сертралин/);
});

test('psychotic/bipolar history → required', () => {
  const sig = run(patient({ history: { bipolar: true } }), dosesFor(14));
  assert.equal(sig.find((s) => s.ruleId === 'psychiatric_history').routing, 'required');
});

test('C-SSRS moderate/high → critical required', () => {
  const ev = [...dosesFor(14), scale('cssrs', [1, 1, 1, 0, 0, 0], 0)];
  assert.equal(run(patient(), ev).find((s) => s.ruleId === 'cssrs_risk').routing, 'required');
});

test('no response after 8 weeks → required', () => {
  const p = patient({ plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: at(60), timesPerDay: 2 } });
  const ev = [...dosesFor(14), scale('gad7', [2, 2, 2, 2, 2, 2, 2], 58), scale('gad7', [2, 2, 2, 2, 2, 1, 2], 0)];
  assert.equal(run(p, ev).find((s) => s.ruleId === 'no_response').routing, 'required');
});

test('routing aggregate: none → null', () => {
  assert.equal(KK.rules.routing([]), null);
});
