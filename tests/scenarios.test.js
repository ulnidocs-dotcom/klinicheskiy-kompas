const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const NOW = '2026-10-19T12:00:00.000Z';

function eventsOf(s) { return KK.data.expandSeed(s.seed, NOW); }
function signals(s) {
  const p = KK.data.materializePatient(s.patient, NOW);
  return KK.rules.evaluate(KK.rules.buildContext(p, eventsOf(s), NOW));
}
const S = (id) => KK.data.scenarios.find((x) => x.id === id);

test('six scenarios with unique ids', () => {
  assert.equal(KK.data.scenarios.length, 6);
  assert.equal(new Set(KK.data.scenarios.map((s) => s.id)).size, 6);
});

test('S1 GAD at GP: eligible, no signals', () => {
  assert.equal(KK.therapy.check(KK.data.drugs.aviandr, KK.data.materializePatient(S('s1').patient, NOW)).eligible, true);
  assert.deepEqual(signals(S('s1')).map((x) => x.ruleId), []);
});

test('S2 on sertraline: interaction info only', () => {
  assert.deepEqual(signals(S('s2')).map((x) => x.ruleId), ['interaction']);
});

test('S3 eGFR 52: contraindication', () => {
  const ids = signals(S('s3')).map((x) => x.ruleId);
  assert.ok(ids.includes('contraindication'));
  assert.equal(KK.rules.routing(signals(S('s3'))), null);
});

test('S4 PHQ-9 21 item9>0: critical + required', () => {
  const sig = signals(S('s4'));
  assert.equal(sig[0].ruleId, 'si_phq9');
  assert.equal(KK.rules.routing(sig), 'required');
});

test('S5 post-COVID: indicated, improving, no signals', () => {
  const s = S('s5');
  assert.equal(KK.therapy.check(KK.data.drugs.aviandr, KK.data.materializePatient(s.patient, NOW)).indicated, true);
  assert.deepEqual(signals(s).map((x) => x.ruleId), []);
  const gad = eventsOf(s).filter((e) => e.type === 'scale' && e.payload.scaleId === 'gad7').map((e) => e.payload.total);
  assert.ok(gad[0] > gad.at(-1));
});

test('S6 psychologist intake: no doctor signals, no plan, intake completed in seed', () => {
  const s = S('s6');
  const p = KK.data.materializePatient(s.patient, NOW);
  assert.deepEqual(signals(s).map((x) => x.ruleId), []);
  assert.ok(p.intake.assignedAt && p.intake.completedAt);
  const ev = eventsOf(s);
  assert.ok(ev.filter((e) => e.type === 'scale').every((e) => e.payload.context === 'intake'));
  assert.deepEqual(ev.map((e) => e.type).filter((t) => t !== 'scale'), ['intake_form', 'cto']);
});

test('S1 Anna: intake assigned, not completed', () => {
  const p = KK.data.materializePatient(S('s1').patient, NOW);
  assert.ok(p.intake.assignedAt);
  assert.equal(p.intake.completedAt, undefined);
});
