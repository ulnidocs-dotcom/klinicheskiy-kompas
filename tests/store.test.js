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

test('reset loads 6 patients, sorted by urgency (S4 first)', () => {
  const s = mk();
  const ps = s.patients();
  assert.equal(ps.length, 6);
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

const mkClock = () => {
  let t = NOW.getTime();
  const clock = () => new Date(t);
  clock.advance = (min) => { t += min * 60000; };
  return clock;
};

test('I2: acknowledged SOS does not re-fire on unrelated events; new SOS does', () => {
  const clock = mkClock();
  const s = KK.createStore({ storage: memStorage(), clock }); s.reset();
  clock.advance(5); s.addEvent('p_anna', 'sos', {});
  const [a] = s.alerts({ patientId: 'p_anna', open: true }).filter((x) => x.ruleId === 'sos');
  s.ackAlert(a.id, 'Позвонил');
  clock.advance(5); s.addEvent('p_anna', 'dose', { slot: 'утро', taken: true });
  assert.equal(s.alerts({ patientId: 'p_anna', open: true }).filter((x) => x.ruleId === 'sos').length, 0);
  clock.advance(5); s.addEvent('p_anna', 'sos', {});
  assert.equal(s.alerts({ patientId: 'p_anna', open: true }).filter((x) => x.ruleId === 'sos').length, 1);
});

test('I2: acknowledged PHQ-9 item 9 alert re-fires only on a new positive PHQ-9', () => {
  const clock = mkClock();
  const s = KK.createStore({ storage: memStorage(), clock }); s.reset();
  const open = () => s.alerts({ patientId: 'p_anna', open: true }).filter((x) => x.ruleId === 'si_phq9');
  clock.advance(5); s.addEvent('p_anna', 'scale', { scaleId: 'phq9', answers: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
  assert.equal(open().length, 1);
  s.ackAlert(open()[0].id, 'Оценил риск');
  clock.advance(5); s.addEvent('p_anna', 'checkin', { mood: 3, anxiety: 2, sleep: 3 });
  assert.equal(open().length, 0);
  clock.advance(5); s.addEvent('p_anna', 'scale', { scaleId: 'phq9', answers: [1, 1, 1, 1, 1, 1, 1, 1, 2] });
  assert.equal(open().length, 1);
});

test('I3: two tabs on one storage — stale writer does not lose the other tab\'s changes', () => {
  const storage = memStorage();
  const A = KK.createStore({ storage, clock: () => NOW }); A.reset();
  const B = KK.createStore({ storage, clock: () => NOW });
  A.addEvent('p_anna', 'sos', {});
  B.sendMessage('p_anna', 'patient', 'Привет');
  const C = KK.createStore({ storage, clock: () => NOW });
  assert.ok(C.events('p_anna', 'sos').length === 1);
  assert.equal(C.messages('p_anna').at(-1).text, 'Привет');
  A.sendMessage('p_anna', 'doctor', 'Ответ');
  assert.equal(B.messages('p_anna').length, 2);
  assert.equal(B.patient('p_anna').openAlerts.filter((x) => x.ruleId === 'sos').length, 1);
});

test('confirm guards: no plan → clear error; change_plan cannot set status; cancel clears offLabel', () => {
  const s = mk();
  s.confirm('p_anna', 'change_plan', { patch: { status: 'confirmed', confirmedAt: '2026-01-01T00:00:00Z', timesPerDay: 1 } });
  const p = s.patient('p_anna');
  assert.equal(p.plan.status, 'proposed');
  assert.equal(p.plan.confirmedAt, undefined);
  assert.equal(p.plan.timesPerDay, 1);
  s.confirm('p_galina', 'off_label', { reason: 'решение врача' });
  s.confirm('p_galina', 'cancel_plan', {});
  assert.equal(s.patient('p_galina').plan.offLabel, undefined);
  const storage = memStorage();
  const t = KK.createStore({ storage, clock: () => NOW }); t.reset();
  const db = JSON.parse(storage.getItem('kk:v1')); delete db.patients.p_anna.plan; storage.setItem('kk:v1', JSON.stringify(db));
  assert.throws(() => t.confirm('p_anna', 'confirm_plan', {}), /нет плана|no plan/i);
});

test('patient lookups ignore prototype keys (__proto__, constructor, toString)', () => {
  const s = mk();
  for (const k of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.equal(s.patient(k), null, k);
    assert.deepEqual(s.events(k), [], k);
    assert.deepEqual(s.messages(k), [], k);
    assert.deepEqual(s.signals(k), [], k);
    assert.throws(() => s.addEvent(k, 'sos', {}), /Unknown patient/, k);
    assert.throws(() => s.sendMessage(k, 'patient', 'x'), /Unknown patient/, k);
    assert.throws(() => s.confirm(k, 'confirm_routing', {}), /Unknown patient/, k);
  }
  assert.ok(s.patient('p_anna'));
});

test('addEvent opts.at: past-day check-in accepted, dated that day, sorted into the feed, alert dataAt = event time', () => {
  const s = mk();
  const at = new Date(NOW); at.setDate(at.getDate() - 3); at.setHours(12, 0, 0, 0);
  const e = s.addEvent('p_anna', 'checkin', { mood: 2, anxiety: 3, sleep: 2 }, { at: at.toISOString() });
  assert.equal(e.at, at.toISOString());
  assert.equal(e.recordedAt, NOW.toISOString());
  const ev = s.events('p_anna');
  const sorted = [...ev].sort(KK.util.byDateAsc);
  assert.deepEqual(ev.map((x) => x.id), sorted.map((x) => x.id));
  const sos = s.addEvent('p_anna', 'sos', {});
  assert.equal(s.alerts({ patientId: 'p_anna' }).find((a) => a.ruleId === 'sos').dataAt, sos.at);
  const seven = new Date(NOW); seven.setDate(seven.getDate() - 7); seven.setHours(0, 0, 1, 0);
  assert.ok(s.addEvent('p_anna', 'checkin', { mood: 3, anxiety: 3, sleep: 3 }, { at: seven.toISOString() }));
});

test('addEvent opts.at: future, older than 7 days, invalid date and non-checkin types are rejected', () => {
  const s = mk();
  const n = s.events('p_anna').length;
  const c = { mood: 3, anxiety: 3, sleep: 3 };
  assert.throws(() => s.addEvent('p_anna', 'checkin', c, { at: new Date(+NOW + 60000).toISOString() }), /будущее/);
  const old = new Date(NOW); old.setDate(old.getDate() - 8); old.setHours(23, 0, 0, 0);
  assert.throws(() => s.addEvent('p_anna', 'checkin', c, { at: old.toISOString() }), /старше 7/);
  assert.throws(() => s.addEvent('p_anna', 'checkin', c, { at: 'вчера' }), /Некорректная/);
  const past = KK.util.shiftDays(NOW.toISOString(), -1);
  for (const type of ['dose', 'sos', 'scale', 'ae']) assert.throws(() => s.addEvent('p_anna', type, { slot: 'утро', taken: true }, { at: past }), /только самочувствие/, type);
  assert.equal(s.events('p_anna').length, n);
  assert.ok(s.addEvent('p_anna', 'checkin', c, {}));
});

test('latestPerDay: edited check-in replaces the earlier one of that day; one per day, chronological', () => {
  const clock = mkClock();
  const s = KK.createStore({ storage: memStorage(), clock }); s.reset();
  const base = KK.util.latestPerDay(s.events('p_anna', 'checkin'));
  const days = new Set(s.events('p_anna', 'checkin').map((e) => KK.util.dayKey(e.at)));
  assert.equal(base.length, days.size);
  const y = new Date(NOW); y.setDate(y.getDate() - 1); y.setHours(12, 0, 0, 0);
  clock.advance(1); s.addEvent('p_anna', 'checkin', { mood: 5, anxiety: 1, sleep: 5 });
  clock.advance(1); s.addEvent('p_anna', 'checkin', { mood: 4, anxiety: 2, sleep: 4 });
  clock.advance(1); s.addEvent('p_anna', 'checkin', { mood: 1, anxiety: 5, sleep: 1 }, { at: y.toISOString() });
  const L = KK.util.latestPerDay(s.events('p_anna', 'checkin'));
  assert.equal(L.length, new Set(L.map((e) => KK.util.dayKey(e.at))).size);
  assert.deepEqual(L.at(-1).payload, { mood: 4, anxiety: 2, sleep: 4 });
  assert.deepEqual(L.find((e) => KK.util.dayKey(e.at) === KK.util.dayKey(y.toISOString())).payload, { mood: 1, anxiety: 5, sleep: 1 });
  assert.deepEqual(L.map((e) => e.at), [...L].sort(KK.util.byDateAsc).map((e) => e.at));
  assert.deepEqual(KK.util.latestPerDay([]), []);
});

test('removeEvent: only today\'s own dose events; others throw and nothing changes', () => {
  const s = mk();
  const d = s.addEvent('p_anna', 'dose', { slot: 'утро', taken: true });
  assert.throws(() => s.removeEvent('p_olga', d.id), /Нет события/);
  assert.throws(() => s.removeEvent('__proto__', d.id), /Unknown patient/);
  const c = s.addEvent('p_anna', 'checkin', { mood: 3, anxiety: 3, sleep: 3 });
  assert.throws(() => s.removeEvent('p_anna', c.id), /только отметку приёма/);
  const oldDose = s.events('p_olga', 'dose').find((e) => KK.util.dayKey(e.at) !== KK.util.dayKey(NOW.toISOString()));
  assert.ok(oldDose);
  assert.throws(() => s.removeEvent('p_olga', oldDose.id), /сегодняшнюю/);
  assert.equal(s.removeEvent('p_anna', d.id).id, d.id);
  assert.equal(s.events('p_anna', 'dose').some((e) => e.id === d.id), false);
  assert.throws(() => s.removeEvent('p_anna', d.id), /Нет события/);
});

test('planned task (missed doses) does not raise an alert but marks the patient in the queue', () => {
  let now = NOW;
  const s = KK.createStore({ storage: memStorage(), clock: () => now });
  s.reset();
  now = new Date(NOW.getTime() + 4 * 86400000); // у Ольги отметки о приёме обрываются: через 4 дня — серия пропусков
  s.addEvent('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 });
  const p = s.patient('p_olga');
  assert.equal(p.signals.find((x) => x.ruleId === 'missed_doses').level, 'task');
  assert.ok(!s.alerts({ patientId: 'p_olga' }).some((x) => x.ruleId === 'missed_doses'));
});

test('alerts store the rule version for the audit trail', () => {
  const s = mk();
  const a = s.alerts({ patientId: 'p_dmitry', open: true }).find((x) => x.ruleId === 'si_phq9');
  assert.match(a.ruleVersion, /^si_phq9@1/);
});

test('addEvent with the same clientId does not duplicate and keeps the channel', () => {
  const s = mk();
  const a = s.addEvent('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 }, { clientId: 'cl_1', channel: 'max' });
  const b = s.addEvent('p_olga', 'checkin', { mood: 1, anxiety: 5, sleep: 1 }, { clientId: 'cl_1', channel: 'max' });
  assert.equal(a.id, b.id);
  assert.equal(s.events('p_olga').filter((e) => e.clientId === 'cl_1').length, 1);
  assert.equal(a.channel, 'max');
});

test('channels: link once, list active, unlink keeps history', () => {
  const s = mk();
  s.linkChannel('p_olga', 'max');
  s.linkChannel('p_olga', 'max');
  s.linkChannel('p_olga', 'web');
  assert.deepEqual(s.channels('p_olga').map((c) => c.channel), ['max', 'web']);
  const before = s.events('p_olga').length;
  assert.equal(s.unlinkChannel('p_olga', 'max'), true);
  assert.deepEqual(s.channels('p_olga').map((c) => c.channel), ['web']);
  assert.equal(s.events('p_olga').length, before);
  assert.throws(() => s.linkChannel('p_olga', 'icq'), /Неизвестный канал/);
});

test('link code: 6 digits, single use, expires in 10 minutes, links the web channel', () => {
  let now = NOW;
  const s = KK.createStore({ storage: memStorage(), clock: () => now });
  s.reset();
  const { code } = s.createLinkCode('p_olga');
  assert.match(code, /^\d{6}$/);
  assert.equal(s.redeemLinkCode(code, 'web'), 'p_olga');
  assert.ok(s.channels('p_olga').some((c) => c.channel === 'web'));
  assert.throws(() => s.redeemLinkCode(code), (e) => e.reason === 'used');
  const late = s.createLinkCode('p_olga').code;
  now = new Date(NOW.getTime() + 10 * 60000 + 1);
  assert.throws(() => s.redeemLinkCode(late), (e) => e.reason === 'expired');
  assert.throws(() => s.redeemLinkCode('000000'), (e) => e.reason === 'unknown');
});

test('consents are recorded with time and version', () => {
  const s = mk();
  s.recordConsents('p_olga', ['data_processing', 'doctor_access', 'not_emergency']);
  assert.deepEqual(s.patient('p_olga').consents.map((c) => c.kind), ['data_processing', 'doctor_access', 'not_emergency']);
  assert.equal(s.patient('p_olga').consents[0].version, '1');
});

test('snapshot and restore round-trip into a clean store without duplicates', () => {
  const s = mk();
  s.addEvent('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 }, { clientId: 'cl_9', channel: 'max' });
  const snap = s.snapshot('p_olga');
  const other = mk();
  const copy = JSON.parse(JSON.stringify(snap));
  copy.patient.id = 'p_moved';
  assert.equal(other.restore(copy), 'p_moved');
  assert.equal(other.events('p_moved').length, snap.events.length);
  other.restore(copy);
  assert.equal(other.events('p_moved').length, snap.events.length);
  assert.equal(other.patient('p_moved').name, 'Ольга Лебедева');
  assert.throws(() => other.restore({ patient: { id: '__proto__' } }), /без пациента/);
});

test('redeem with a bad channel does not burn the code', () => {
  const s = mk();
  const { code } = s.createLinkCode('p_olga');
  assert.throws(() => s.redeemLinkCode(code, 'icq'), /Неизвестный канал/);
  assert.equal(s.redeemLinkCode(code, 'web'), 'p_olga');
});

test('restore rejects inherited-property ids', () => {
  const s = mk();
  for (const id of ['toString', 'hasOwnProperty', '__proto__']) {
    assert.throws(() => s.restore({ patient: { id } }), /Пакет без пациента/);
  }
});

test('restore into an existing patient with a different name is rejected', () => {
  const s = mk();
  const before = s.events('p_olga').length;
  assert.throws(() => s.restore({ patient: { id: 'p_olga', name: 'Другой' }, events: [] }), /другому пациенту/);
  assert.equal(s.events('p_olga').length, before);
});

test('restore adds duplicate event ids from one input once', () => {
  const s = mk();
  const ev = { id: 'ev_dup', type: 'checkin', at: NOW.toISOString(), payload: { mood: 3, anxiety: 3, sleep: 3 } };
  s.restore({ patient: { id: 'p_new', name: 'Новый' }, events: [ev, Object.assign({}, ev)] });
  assert.equal(s.events('p_new').length, 1);
});

test('restore rejects a malformed bundle without writing anything', () => {
  const s = mk();
  const bad = { patient: { id: 'p_bad', name: 'Х' }, events: [{ id: 'e1', type: 'checkin', at: NOW.toISOString() }] };
  assert.throws(() => s.restore(bad), /Пакет повреждён/);
  assert.equal(s.patient('p_bad'), null);
  assert.throws(() => s.restore({ patient: { id: 'p_bad', name: 'Х' }, events: null }), /Пакет повреждён/);
});
