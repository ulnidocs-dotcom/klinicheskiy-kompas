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

test('3 full days without doses → task (planned, no alert)', () => {
  const ev = [{ type: 'dose', at: at(5), payload: { slot: 'утро', taken: true } }];
  const s = run(patient(), ev).find((x) => x.ruleId === 'missed_doses');
  assert.equal(s.level, 'task');
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

// --- review fixes ---
test('I5: throwing rule yields an error signal instead of silence', () => {
  const orig = console.error; const logged = []; console.error = (...a) => logged.push(a);
  try {
    const boom = { id: 'x', level: 'critical', routing: 'required', title: 'Тест', source: 'S', when: () => { throw new Error('boom'); }, text: () => '' };
    const boomText = { id: 'y', level: 'info', routing: null, title: 'Т2', source: 'S', when: () => true, text: () => { throw new Error('t'); } };
    const sig = KK.rules.evaluate(KK.rules.buildContext(patient(), [], NOW), [boomText, boom]);
    assert.equal(sig.length, 2);
    assert.deepEqual({ ruleId: sig[0].ruleId, level: sig[0].level, error: sig[0].error, routing: sig[0].routing }, { ruleId: 'x', level: 'critical', error: true, routing: 'required' });
    assert.equal(sig[0].title, 'Правило не вычислено: Тест');
    assert.equal(sig[0].text, 'Ошибка данных — проверьте вручную');
    assert.equal(sig[1].level, 'important');
    assert.equal(logged.length, 2);
  } finally { console.error = orig; }
});

test('I5: si_phq9 uses answers[8] when flags are missing', () => {
  const ev = [...dosesFor(14), { type: 'scale', at: at(0), payload: { scaleId: 'phq9', answers: [0, 0, 0, 0, 0, 0, 0, 0, 1], total: 1 } }];
  const s = run(patient(), ev).find((x) => x.ruleId === 'si_phq9');
  assert.ok(s && !s.error);
  assert.match(s.text, /1 из 3/);
});

test('C-SSRS without band does not crash the rule', () => {
  const ev = [...dosesFor(14), { type: 'scale', at: at(0), payload: { scaleId: 'cssrs', answers: [0, 0, 0, 0, 0, 0], band: null } }];
  assert.ok(!run(patient(), ev).some((s) => s.error));
});

test('I7: gad7_persistent — GAD-7 ≥ 15 not improving after ≥ 28 days', () => {
  const p = patient({ plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: at(30), timesPerDay: 2 } });
  const ev = [...dosesFor(14), scale('gad7', [2, 2, 2, 2, 2, 2, 3], 29), scale('gad7', [3, 2, 2, 2, 2, 2, 3], 0)];
  const s = run(p, ev).find((x) => x.ruleId === 'gad7_persistent');
  assert.equal(s.level, 'task');
  assert.equal(s.routing, 'desirable');
  assert.equal(s.teamRule, true);
  assert.match(s.source, /Генерализованное тревожное/);
  const improving = [...dosesFor(14), scale('gad7', [3, 3, 3, 3, 3, 3, 3], 29), scale('gad7', [3, 2, 2, 2, 2, 2, 3], 0)];
  assert.ok(!run(p, improving).some((x) => x.ruleId === 'gad7_persistent'));
  const early = patient({ plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: at(20), timesPerDay: 2 } });
  assert.ok(!run(early, ev).some((x) => x.ruleId === 'gad7_persistent'));
});

test('I7: ae_mild — mild/moderate AE within 7 days → info listing items', () => {
  const ae = (d, items) => ({ type: 'ae', at: at(d), payload: { items } });
  const sig = run(patient(), [...dosesFor(14), ae(2, [{ id: 'headache', label: 'Головная боль', severity: 'mild' }, { id: 'nausea', label: 'Тошнота', severity: 'moderate' }])]);
  const s = sig.find((x) => x.ruleId === 'ae_mild');
  assert.equal(s.level, 'info');
  assert.equal(s.routing, null);
  assert.match(s.text, /Головная боль/);
  assert.match(s.text, /Тошнота/);
  assert.ok(!run(patient(), [...dosesFor(14), ae(10, [{ id: 'headache', severity: 'mild' }])]).some((x) => x.ruleId === 'ae_mild'));
  assert.ok(!run(patient(), [...dosesFor(14), ae(1, [{ id: 'headache', severity: 'severe' }])]).some((x) => x.ruleId === 'ae_mild'));
});

test('every signal explains itself: rule version, inputs and missing data', () => {
  const ev = [...dosesFor(14), scale('phq9', [3, 3, 2, 2, 2, 3, 2, 2, 2], 0)];
  const si = run(patient(), ev).find((s) => s.ruleId === 'si_phq9');
  assert.match(si.version, /^si_phq9@1 · набор 2026\.10\.1$/);
  assert.ok(si.inputs.some((x) => /PHQ-9 от 19\.10\.2026: \d+, вопрос 9 = 2 из 3/.test(x)), si.inputs.join('|'));
  assert.deepEqual(si.missing, ['C-SSRS после этого PHQ-9 не проведена']);
  const withCssrs = [...ev, { type: 'scale', at: NOW, payload: Object.assign(KK.scales.score('cssrs', [0, 0, null, null, null, 0]), { context: 'clinic' }) }];
  assert.deepEqual(run(patient(), withCssrs).find((s) => s.ruleId === 'si_phq9').missing, []);
});

test('stale PHQ-9 (> 30 days) is reported as missing data, not hidden', () => {
  const ev = [...dosesFor(14), scale('phq9', [2, 2, 2, 2, 2, 2, 2, 2, 0], 40)];
  const s = run(patient(), ev).find((x) => x.ruleId === 'phq9_modsevere');
  assert.ok(s.missing.some((m) => /старше 30 дней/.test(m)));
});

test('a failing explanation never hides the signal', () => {
  const rule = { id: 'x', level: 'important', routing: null, source: 's', title: 't', when: () => true, text: () => 'ok', inputs: () => { throw new Error('boom'); } };
  const [s] = KK.rules.evaluate(KK.rules.buildContext(patient(), [], NOW), [rule]);
  assert.equal(s.text, 'ok');
  assert.deepEqual(s.inputs, []);
});

test('planned tasks sort after important and before info', () => {
  const lv = (l) => ({ id: l, level: l, routing: null, source: 's', title: l, when: () => true, text: () => '' });
  const out = KK.rules.evaluate(KK.rules.buildContext(patient(), [], NOW), [lv('info'), lv('task'), lv('important')]);
  assert.deepEqual(out.map((s) => s.level), ['important', 'task', 'info']);
});

test('patient_change: «да» об изменениях за 7 дней → плановый сигнал с текстом пациента; поздний «нет» и старый ответ — без сигнала', () => {
  const yes = { type: 'change', at: at(1), payload: { changed: true, note: 'Стало легче засыпать, днём клонит в сон' } };
  const s = run(patient(), [...dosesFor(14), yes]).find((x) => x.ruleId === 'patient_change');
  assert.equal(s.level, 'task');
  assert.equal(s.routing, null);
  assert.match(s.text, /легче засыпать/);
  assert.ok(!run(patient(), [...dosesFor(14), yes, { type: 'change', at: at(0), payload: { changed: false, note: '' } }]).some((x) => x.ruleId === 'patient_change'));
  assert.ok(!run(patient(), [...dosesFor(14), { type: 'change', at: at(8), payload: { changed: true, note: 'x' } }]).some((x) => x.ruleId === 'patient_change'));
  assert.ok(!run(patient(), [...dosesFor(14), { type: 'change', at: at(1), payload: { changed: false, note: '' } }]).some((x) => x.ruleId === 'patient_change'));
});
