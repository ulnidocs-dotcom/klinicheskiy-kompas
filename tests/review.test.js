// Регрессии по ревью роли психолога (feat/psychologist).
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
const NOW = new Date('2026-10-19T12:00:00.000Z');
const mk = (storage = memStorage()) => { const s = KK.createStore({ storage, clock: () => NOW }); s.reset(); return s; };
const FORM = { complaint: 'Тревожно', reason: 'Совет врача', priorPsychiatrist: false, meds: false, psychotic: false, mania: false };
const CS_NONE = [0, 0, null, null, null, 0];
const fill = (s, pid, { form = FORM, cssrs = CS_NONE, dass = new Array(21).fill(0) } = {}) => {
  s.addEvent(pid, 'intake_form', form);
  s.addEvent(pid, 'scale', { scaleId: 'cssrs', answers: cssrs, context: 'intake' });
  s.addEvent(pid, 'scale', { scaleId: 'tipi10', answers: new Array(10).fill(4), context: 'intake' });
  s.addEvent(pid, 'scale', { scaleId: 'dass21', answers: dass, context: 'intake' });
};
const cs = (answers) => KK.scales.score('cssrs', answers);

// ——— CRITICAL 1: подтверждение психологом не «съедает» алерт врача ———
test('psych ack is per role: doctor still gets the modal and keeps the alert open', () => {
  const s = mk();
  s.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: [1, 1, 1, 0, 0, 0], context: 'intake' });
  const a = s.alerts({ patientId: 'p_anna', open: true }).find((x) => x.ruleId === 'cssrs_risk');
  assert.ok(a);
  s.markSeen(a.id, 'psy');
  s.ackAlert(a.id, 'Связалась с пациентом', 'psy1');
  const after = s.alerts({ patientId: 'p_anna' }).find((x) => x.id === a.id);
  assert.equal(after.ackAt, null);
  assert.equal(after.deliveredAt, null);
  assert.equal(after.ackBy.psy.action, 'Связалась с пациентом');
  assert.ok(after.ackBy.psy.at);
  assert.equal(KK.doctorApp.nextCriticalToShow(s.alerts({ open: true }).filter((x) => x.patientId === 'p_anna'), null).id, a.id);
  assert.ok(s.patient('p_anna').openAlerts.some((x) => x.id === a.id));
  // Врач подтверждает — закрыто для врача, с отметкой в ackBy.doctor.
  s.ackAlert(a.id, 'Позвонил');
  const done = s.alerts({ patientId: 'p_anna' }).find((x) => x.id === a.id);
  assert.ok(done.ackAt && done.ackBy.doctor && done.ackBy.psy);
  assert.ok(!s.patient('p_anna').openAlerts.some((x) => x.id === a.id));
});

test('psych pickCritical: only intake C-SSRS alerts, not si_phq9 or doctor-rated C-SSRS', () => {
  const s = mk();
  const prev = KK.store; KK.store = s;
  try {
    // У Дмитрия si_phq9 — не для психолога, даже если ему назначат приём.
    const all = s.alerts({ open: true });
    assert.equal(KK.psychApp.pickCritical(all.filter((a) => a.patientId === 'p_dmitry'), null), null);
    s.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: [1, 1, 1, 0, 0, 0] }); // оценка врача
    assert.equal(KK.psychApp.pickCritical(s.alerts({ open: true }).filter((a) => a.patientId === 'p_anna'), null), null);
    s.addEvent('p_ilya', 'scale', { scaleId: 'cssrs', answers: [1, 1, 1, 0, 0, 0], context: 'intake' });
    const pick = KK.psychApp.pickCritical(s.alerts({ open: true }), null);
    assert.equal(pick.patientId, 'p_ilya');
    assert.equal(pick.origin, 'intake');
    s.ackAlert(pick.id, 'ok', 'psy1');
    assert.equal(KK.psychApp.pickCritical(s.alerts({ open: true }).filter((a) => a.patientId === 'p_ilya'), null), null);
  } finally { KK.store = prev; }
});

// ——— CRITICAL 2: самоотчёт не понижает риск по оценке врача ———
test('cssrs risk = max(clinician latest, intake latest ≤ 30 days): patient «none» never lowers doctor «high»', () => {
  const s = mk();
  s.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: [1, 1, 1, 1, 0, 0] }); // врач: высокий
  s.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: CS_NONE, context: 'intake' }); // пациент: нет
  const v = s.patient('p_anna');
  assert.ok(v.signals.some((x) => x.ruleId === 'cssrs_risk'));
  assert.equal(v.routing, 'required');
  assert.equal(v.latest.cssrs.band.code, 'high');
  assert.equal(v.latest.cssrs.context, undefined);
  assert.equal(v.latest.cssrsIntake.band.code, 'none');
});

test('cssrs risk: intake risk counts when clinician is lower; stale intake (> 30 days) is ignored', () => {
  const p = KK.data.materializePatient(KK.data.scenarios.find((x) => x.id === 's1').patient, NOW.toISOString());
  const ev = (at, answers, context) => ({ type: 'scale', at, payload: Object.assign(cs(answers), context ? { context } : {}) });
  const run = (events) => KK.rules.evaluate(KK.rules.buildContext(p, events, NOW.toISOString())).map((x) => x.ruleId);
  assert.ok(run([ev('2026-10-10T10:00:00Z', CS_NONE), ev('2026-10-15T10:00:00Z', [1, 1, 1, 0, 0, 0], 'intake')]).includes('cssrs_risk'));
  assert.ok(!run([ev('2026-08-01T10:00:00Z', [1, 1, 1, 0, 0, 0], 'intake')]).includes('cssrs_risk'));
  const ctx = KK.rules.buildContext(p, [ev('2026-10-15T10:00:00Z', [1, 1, 1, 0, 0, 0], 'intake')], NOW.toISOString());
  assert.equal(ctx.cssrsRisk().origin, 'intake');
});

// ——— IMPORTANT 3, 4: маршрут ———
const intake = (over = {}) => Object.assign({ form: FORM, cssrs: cs(CS_NONE), dass: new Array(21).fill(0) }, over);
test('routeIntake: observation only when form, C-SSRS and DASS are all present', () => {
  assert.equal(KK.battery.routeIntake(intake()).level, 'observation');
  assert.equal(KK.battery.routeIntake(intake({ form: null })).level, null);
  assert.equal(KK.battery.routeIntake(intake({ cssrs: null })).level, null);
  assert.ok(KK.battery.routeIntake(intake({ cssrs: null })).missing.includes('cssrs'));
});

test('routeIntake: C-SSRS low with normal DASS → consultation floor with a team-rule reason', () => {
  const r = KK.battery.routeIntake(intake({ cssrs: cs([1, 0, null, null, null, 0]) }));
  assert.equal(r.level, 'consultation');
  const reason = r.reasons.find((x) => x.kind === 'cssrs' && x.level === 'consultation');
  assert.equal(reason.text, 'Пассивные мысли о смерти (C-SSRS) — обсудить на встрече');
  assert.equal(reason.teamRule, true);
  assert.match(reason.note, /до экспертной проверки/);
  // Не понижает более высокий уровень.
  assert.equal(KK.battery.routeIntake(intake({ cssrs: cs([1, 0, null, null, null, 0]), dass: new Array(21).fill(2) })).level, 'psychiatrist_required');
});

// ——— IMPORTANT 5: передача устаревает при смене маршрута ———
test('handoff becomes outdated when the level changes; can be handed off again; history kept', () => {
  const s = mk();
  s.confirmIntake('p_ilya', { level: 'psychotherapy_desirable', proposed: 'psychotherapy_desirable' });
  s.handoffIntake('p_ilya', 'первая');
  assert.equal(s.intakeOf('p_ilya').intake.handoff.outdated, undefined);
  s.confirmIntake('p_ilya', { level: 'consultation', proposed: 'psychotherapy_desirable', note: 'Пациент выбрал консультирование' });
  let it = s.intakeOf('p_ilya');
  assert.equal(it.intake.handoff.outdated, true);
  assert.equal(it.intake.decision.revision, 2);
  s.handoffIntake('p_ilya', 'вторая');
  it = s.intakeOf('p_ilya');
  assert.equal(it.intake.handoff.text, 'вторая');
  assert.ok(!it.intake.handoff.outdated);
  assert.equal(it.intake.handoffHistory.length, 1);
  assert.equal(it.intake.handoffHistory[0].text, 'первая');
  const html = KK.doctorApp.intakeCard(s.patient('p_ilya'), it);
  assert.match(html, /обновлено/);
  assert.match(html, /Психологическое консультирование/);
  assert.doesNotMatch(html, /Психотерапия — желательно/);
  assert.doesNotMatch(html, /первая/);
});

// ——— IMPORTANT 6: врач видит «психиатр обязательно» и входящие психолога ———
test('doctor queue: psychologist «psychiatrist required» raises routing and urgency; inbox unread count', () => {
  const s = mk();
  fill(s, 'p_anna', { form: Object.assign({}, FORM, { psychotic: true }) });
  s.completeIntake('p_anna');
  s.confirmIntake('p_anna', { level: 'psychiatrist_required', proposed: 'psychiatrist_required' });
  const v = s.patient('p_anna');
  assert.equal(v.routing, 'required');
  assert.equal(v.intakeRoute, 'psychiatrist_required');
  const ids = s.patients().map((p) => p.id);
  assert.ok(ids.indexOf('p_anna') < ids.indexOf('p_sergey'));
  assert.match(KK.doctorApp.intakeBadge(v), /Психиатр · обязательно/);
  assert.equal(KK.doctorApp.intakeBadge(s.patient('p_sergey')), '');
  s.handoffIntake('p_anna', 'Текст');
  assert.equal(s.inbox({ to: 'd1', unread: true }).length, 1);
  s.markInboxRead(s.inbox({ to: 'd1' })[0].id);
  assert.equal(s.inbox({ to: 'd1', unread: true }).length, 0);
  assert.ok(s.inbox({ to: 'd1' })[0].readAt);
});

// ——— IMPORTANT 7: правила формы решения ———
test('confirmIntake: reason required when there is no proposal', () => {
  const s = mk();
  fill(s, 'p_anna', { dass: new Array(21).fill(null) }); s.completeIntake('p_anna'); // DASS не заполнена — маршрут не предлагается
  assert.equal(KK.battery.routeIntake(s.intakeOf('p_anna')).level, null);
  assert.throws(() => s.confirmIntake('p_anna', { level: 'observation', proposed: null }), /причин/);
  assert.doesNotThrow(() => s.confirmIntake('p_anna', { level: 'observation', proposed: null, note: 'по беседе' }));
});

test('downgrading a mandatory psychiatrist route (C-SSRS / anketa): reason ≥ 20 chars, audit flag, doctor notified', () => {
  const s = mk();
  fill(s, 'p_anna', { form: Object.assign({}, FORM, { mania: true }) });
  s.completeIntake('p_anna');
  const proposed = KK.battery.routeIntake(s.intakeOf('p_anna')).level;
  assert.equal(proposed, 'psychiatrist_required');
  assert.equal(KK.battery.mandatoryHard(KK.battery.routeIntake(s.intakeOf('p_anna'))), true);
  assert.throws(() => s.confirmIntake('p_anna', { level: 'consultation', proposed, note: 'коротко' }), /20/);
  s.confirmIntake('p_anna', { level: 'consultation', proposed, note: 'Эпизод был 10 лет назад, наблюдается у психиатра' });
  const au = s.audit('p_anna').filter((a) => a.action === 'intake_decision').at(-1);
  assert.equal(au.details.downgrade_mandatory, true);
  assert.equal(s.intakeOf('p_anna').intake.decision.downgradeMandatory, true);
  const msg = s.inbox({ to: 'd1', patientId: 'p_anna' });
  assert.equal(msg.length, 1);
  assert.match(msg[0].text, /обязательн/i);
  // DASS-основание (не C-SSRS/анкета) — обычное изменение с причиной, без флага.
  assert.equal(KK.battery.mandatoryHard(KK.battery.routeIntake({ form: FORM, cssrs: cs(CS_NONE), dass: new Array(21).fill(3) })), false);
});

// ——— MINOR ———
test('completeIntake with cto: validates first, so a failed attempt adds no cto event', () => {
  const s = mk();
  s.addEvent('p_anna', 'intake_form', FORM);
  assert.throws(() => s.completeIntake('p_anna', { cto: { skipped: true } }), /не заполнены/);
  assert.equal(s.events('p_anna', 'cto').length, 0);
  s.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: CS_NONE, context: 'intake' });
  s.addEvent('p_anna', 'scale', { scaleId: 'tipi10', answers: new Array(10).fill(4), context: 'intake' });
  s.addEvent('p_anna', 'scale', { scaleId: 'dass21', answers: new Array(21).fill(0), context: 'intake' });
  s.completeIntake('p_anna', { cto: { skipped: true } });
  assert.equal(s.events('p_anna', 'cto').length, 1);
  assert.equal(s.intakeOf('p_anna').status, 'completed');
});

test('intake drafts: localStorage key per patient, cleared by demo reset helpers and store.reset', () => {
  assert.equal(KK.patientApp.intakeDraftKey('p_anna'), 'kk:intake-draft:p_anna');
  assert.deepEqual(KK.doctorApp.demoDeviceKeys(['kk:v1', 'kk:intake-draft:p_anna', 'kk:draft:x']), ['kk:intake-draft:p_anna']);
  const storage = memStorage();
  storage.setItem('kk:intake-draft:p_anna', '{}');
  storage.setItem('kk:theme', 'dark');
  mk(storage);
  assert.equal(storage.getItem('kk:intake-draft:p_anna'), null);
  assert.equal(storage.getItem('kk:theme'), 'dark');
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /kk:intake-draft:/);
});

test('doctor audit labels are human-readable for intake and psychologist actions', () => {
  const L = KK.doctorApp.auditLabel;
  assert.equal(L({ action: 'intake_decision', details: { level: 'consultation' } }), 'Психолог: решение по маршруту — Психологическое консультирование');
  assert.equal(L({ action: 'intake_handoff', details: {} }), 'Психолог передал сводку первичного приёма');
  assert.equal(L({ action: 'ack_alert', actor: 'psy1', details: { action: 'Позвонила' } }), 'Психолог подтвердил сигнал: Позвонила');
  assert.equal(L({ action: 'intake_completed', details: {} }), 'Пациент завершил батарею первичного приёма');
  assert.equal(L({ action: 'confirm_plan', details: {} }), 'confirm_plan');
});

test('C-SSRS verify phrase is not duplicated in the psychologist view', () => {
  const v = KK.data.intake.cssrsPatient.verify;
  assert.doesNotMatch(v, /^формулировки самоотч/i);
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'psych', 'patient.js'), 'utf8');
  assert.doesNotMatch(src, /формулировки самоотчёта: \$\{/);
});

test('UI helpers: downgrade warning only for C-SSRS/anketa mandatory routes; doctor inbox list with read state', () => {
  const r = KK.battery.routeIntake({ form: Object.assign({}, FORM, { psychotic: true }), cssrs: cs(CS_NONE), dass: new Array(21).fill(0) });
  assert.match(KK.psychApp.downgradeWarning(r, 'consultation'), /20 символов/);
  assert.equal(KK.psychApp.downgradeWarning(r, 'psychiatrist_required'), '');
  const rd = KK.battery.routeIntake({ form: FORM, cssrs: cs(CS_NONE), dass: new Array(21).fill(3) });
  assert.equal(KK.psychApp.downgradeWarning(rd, 'consultation'), '');
  const html = KK.doctorApp.inboxHtml([{ id: 'in1', at: NOW.toISOString(), fromName: 'Мария Белова', patientId: 'p_anna', kind: 'downgrade', text: '<b>x</b>' }], { names: { p_anna: 'Анна' } });
  assert.match(html, /data-inbox-read="in1"/);
  assert.match(html, /понижен обязательный маршрут/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.equal(KK.doctorApp.inboxHtml([]), '');
});
