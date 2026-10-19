const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const NOW = new Date('2026-10-19T12:00:00.000Z');
const mk = () => { const s = KK.createStore({ storage: memStorage(), clock: () => NOW }); s.reset(); return s; };

test('reset loads 5 patients, sorted by urgency (S4 first)', () => {
  const s = mk();
  const ps = s.patients();
  assert.equal(ps.length, 5);
  assert.equal(ps[0].id, 'p_dmitry');
  assert.equal(ps[0].routing, 'required');
});

test('reset creates open alert for S4 critical signal', () => {
  const s = mk();
  const a = s.alerts({ patientId: 'p_dmitry', open: true });
  assert.ok(a.some((x) => x.ruleId === 'si_phq9' && x.level === 'critical'));
});

test('patient SOS creates critical alert visible to doctor', () => {
  const s = mk();
  s.addEvent('p_anna', 'sos', {});
  const a = s.alerts({ patientId: 'p_anna', open: true });
  assert.equal(a[0].ruleId, 'sos');
  assert.ok(a[0].dataAt);
});

test('same signal does not duplicate alert', () => {
  const s = mk();
  s.addEvent('p_anna', 'sos', {});
  s.addEvent('p_anna', 'checkin', { mood: 2, anxiety: 3, sleep: 2 });
  assert.equal(s.alerts({ patientId: 'p_anna' }).filter((x) => x.ruleId === 'sos').length, 1);
});

test('delivery and acknowledgement timestamps', () => {
  const s = mk();
  s.addEvent('p_anna', 'sos', {});
  const [a] = s.alerts({ patientId: 'p_anna', open: true });
  s.markDelivered(a.id);
  s.ackAlert(a.id, 'Позвонил пациенту');
  const after = s.alerts({ patientId: 'p_anna' }).find((x) => x.id === a.id);
  assert.ok(after.deliveredAt && after.ackAt);
  assert.equal(after.ackAction, 'Позвонил пациенту');
  assert.equal(s.alerts({ patientId: 'p_anna', open: true }).length, 0);
});

test('scale event from patient is scored by store', () => {
  const s = mk();
  const e = s.addEvent('p_anna', 'scale', { scaleId: 'phq9', answers: [3, 3, 3, 3, 3, 3, 3, 3, 1] });
  assert.equal(e.payload.total, 25);
  assert.equal(s.patient('p_anna').routing, 'required');
});

test('confirm_plan only via confirm(), with audit', () => {
  const s = mk();
  assert.equal(s.patient('p_anna').plan.status, 'proposed');
  s.confirm('p_anna', 'confirm_plan', {});
  const p = s.patient('p_anna');
  assert.equal(p.plan.status, 'confirmed');
  assert.ok(p.plan.confirmedAt);
  assert.equal(s.audit('p_anna').at(-1).action, 'confirm_plan');
});

test('confirm_plan refused when contraindicated unless off_label', () => {
  const s = mk();
  assert.throws(() => s.confirm('p_galina', 'confirm_plan', {}), /противопоказ/i);
  s.confirm('p_galina', 'off_label', { reason: 'решение врача' });
  s.confirm('p_galina', 'confirm_plan', {});
  assert.equal(s.patient('p_galina').plan.status, 'confirmed');
});

test('messages', () => {
  const s = mk();
  s.sendMessage('p_anna', 'patient', 'Можно перенести визит?');
  assert.equal(s.messages('p_anna').at(-1).text, 'Можно перенести визит?');
});

test('persistence across store instances on same storage', () => {
  const storage = memStorage();
  const a = KK.createStore({ storage, clock: () => NOW }); a.reset();
  a.addEvent('p_anna', 'sos', {});
  const b = KK.createStore({ storage, clock: () => NOW });
  assert.ok(b.alerts({ patientId: 'p_anna', open: true }).length === 1);
});

test('subscribe fires on change', () => {
  const s = mk();
  let n = 0; const off = s.subscribe(() => n++);
  s.addEvent('p_anna', 'checkin', { mood: 3, anxiety: 2, sleep: 3 });
  off();
  s.addEvent('p_anna', 'checkin', { mood: 3, anxiety: 2, sleep: 3 });
  assert.equal(n, 1);
});

test('importParsed merges labs and meds with audit', () => {
  const s = mk();
  s.importParsed('p_anna', KK.parser.extract('СКФ 48. Принимает трамадол.'));
  const p = s.patient('p_anna');
  assert.equal(p.labs.egfr, 48);
  assert.ok(p.meds.some((m) => m.name === 'Трамадол'));
  assert.equal(s.audit('p_anna').at(-1).action, 'import_history');
});

test('C1: imported "Пациент ... беременность" makes therapy ineligible', () => {
  const s = mk();
  s.importParsed('p_anna', KK.parser.extract('Пациент 34 года, беременность 10 недель.'));
  assert.equal(s.patient('p_anna').therapy.eligible, false);
});

test('I4: importing text without COVID keeps postCovid', () => {
  const s = mk();
  s.importParsed('p_olga', KK.parser.extract('СКФ 90'));
  const p = s.patient('p_olga');
  assert.equal(p.postCovid, true);
  assert.equal(p.therapy.indicated, true);
});
