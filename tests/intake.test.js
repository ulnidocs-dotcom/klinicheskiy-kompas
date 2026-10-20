const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
const NOW = new Date('2026-10-19T12:00:00.000Z');
const mk = (storage = memStorage()) => { const s = KK.createStore({ storage, clock: () => NOW }); s.reset(); return s; };
const FORM = { complaint: 'Тревожно, плохо сплю', reason: 'Посоветовал терапевт', priorPsychiatrist: false, meds: false, psychotic: false, mania: false };
const fillBattery = (s, pid, { cssrs = [0, 0, null, null, null, 0] } = {}) => {
  s.addEvent(pid, 'intake_form', FORM);
  s.addEvent(pid, 'scale', { scaleId: 'cssrs', answers: cssrs, context: 'intake' });
  s.addEvent(pid, 'scale', { scaleId: 'tipi10', answers: [5, 3, 6, 4, 5, 3, 6, 2, 4, 3], context: 'intake' });
  s.addEvent(pid, 'scale', { scaleId: 'dass21', answers: new Array(21).fill(1), context: 'intake' });
};

test('reset: psychologist profile and sixth scenario patient', () => {
  const s = mk();
  assert.deepEqual(s.psychologist(), { id: 'psy1', name: 'Мария Белова', specialty: 'клинический психолог' });
  assert.equal(s.patients().length, 6);
  assert.ok(s.patient('p_ilya'));
});

test('scenario Ilya: battery completed, DASS Д 18 Т 12 С 24 → психотерапия желательно', () => {
  const s = mk();
  const it = s.intakeOf('p_ilya');
  assert.equal(it.status, 'completed');
  assert.ok(it.form && it.cssrs && it.tipi && it.dass && it.cto);
  const r = KK.battery.routeIntake(it);
  assert.equal(r.dass.subscales.depression.score, 18);
  assert.equal(r.dass.subscales.anxiety.score, 12);
  assert.equal(r.dass.subscales.stress.score, 24);
  assert.equal(r.level, 'psychotherapy_desirable');
  assert.ok(r.discrepancies.length >= 1);
  assert.equal(KK.battery.scoreTipi(it.tipi).complete, true);
  assert.ok(KK.battery.ctoSimilarity(it.cto).pairs.length > 0);
  assert.deepEqual(s.signals('p_ilya'), []);
  assert.equal(s.alerts({ patientId: 'p_ilya', open: true }).length, 0);
});

test('scenario Anna: intake assigned, not started; others have no intake', () => {
  const s = mk();
  const it = s.intakeOf('p_anna');
  assert.equal(it.status, 'assigned');
  assert.equal(it.form, null);
  assert.equal(s.patient('p_anna').intakeStatus, 'assigned');
  assert.equal(s.intakeOf('p_sergey'), null);
  assert.equal(s.patient('p_sergey').intakeStatus, null);
  assert.equal(s.intakeOf('nope'), null);
});

test('intake events: form/cto stored as is, scale keeps context, status goes in_progress → completed', () => {
  const s = mk();
  s.addEvent('p_anna', 'intake_form', FORM);
  assert.equal(s.intakeOf('p_anna').status, 'in_progress');
  assert.deepEqual(s.intakeOf('p_anna').form, FORM);
  const e = s.addEvent('p_anna', 'scale', { scaleId: 'dass21', answers: new Array(21).fill(0), context: 'intake' });
  assert.equal(e.payload.context, 'intake');
  assert.equal(e.payload.complete, true);
  assert.throws(() => s.completeIntake('p_anna'), /не заполнены/);
  s.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: [0, 0, null, null, null, 0], context: 'intake' });
  s.addEvent('p_anna', 'scale', { scaleId: 'tipi10', answers: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4], context: 'intake' });
  s.addEvent('p_anna', 'cto', { skipped: true });
  s.completeIntake('p_anna');
  const it = s.intakeOf('p_anna');
  assert.equal(it.status, 'completed');
  assert.ok(it.intake.completedAt);
  assert.ok(s.audit('p_anna').some((a) => a.action === 'intake_completed' && a.actor === 'p_anna'));
});

test('CTO is optional: completion without cto', () => {
  const s = mk();
  fillBattery(s, 'p_anna');
  assert.doesNotThrow(() => s.completeIntake('p_anna'));
  assert.equal(s.intakeOf('p_anna').cto, null);
});

test('intake C-SSRS moderate fires the existing critical cssrs_risk alert; DASS/TIPI do not fire PHQ/GAD rules', () => {
  const s = mk();
  s.addEvent('p_anna', 'scale', { scaleId: 'dass21', answers: new Array(21).fill(3), context: 'intake' });
  s.addEvent('p_anna', 'scale', { scaleId: 'tipi10', answers: new Array(10).fill(7), context: 'intake' });
  assert.deepEqual(s.signals('p_anna').map((x) => x.ruleId), []);
  s.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: [1, 1, 1, 0, 0, 0], context: 'intake' });
  const a = s.alerts({ patientId: 'p_anna', open: true });
  assert.ok(a.some((x) => x.ruleId === 'cssrs_risk' && x.level === 'critical'));
  assert.equal(s.patient('p_anna').routing, 'required');
});

test('confirmIntake: same as proposed — note optional; override — reason required; audit by psychologist', () => {
  const s = mk();
  assert.throws(() => s.confirmIntake('p_anna', { level: 'observation', proposed: 'observation' }), /не завершена/);
  s.confirmIntake('p_ilya', { level: 'psychotherapy_desirable', proposed: 'psychotherapy_desirable' });
  let it = s.intakeOf('p_ilya');
  assert.equal(it.status, 'decided');
  assert.equal(it.intake.decision.level, 'psychotherapy_desirable');
  assert.equal(it.intake.decision.by, 'psy1');
  assert.throws(() => s.confirmIntake('p_ilya', { level: 'consultation', proposed: 'psychotherapy_desirable', note: '  ' }), /причин/);
  assert.throws(() => s.confirmIntake('p_ilya', { level: 'bogus', proposed: 'consultation', note: 'x' }), /уровень/);
  s.confirmIntake('p_ilya', { level: 'consultation', proposed: 'psychotherapy_desirable', note: 'Пациент отказался от терапии, договорились о консультации' });
  it = s.intakeOf('p_ilya');
  assert.equal(it.intake.decision.level, 'consultation');
  assert.equal(it.intake.decision.overridden, true);
  const au = s.audit('p_ilya').filter((a) => a.action === 'intake_decision');
  assert.equal(au.length, 2);
  assert.ok(au.every((a) => a.actor === 'psy1'));
  assert.equal(s.events('p_ilya', 'intake_decision').length, 2);
  assert.equal(s.patient('p_ilya').intakeStatus, 'decided');
});

test('handoffIntake: message to the treating doctor, visible via inbox and intake, audited', () => {
  const s = mk();
  assert.throws(() => s.handoffIntake('p_ilya', 'текст'), /решени/);
  s.confirmIntake('p_ilya', { level: 'psychotherapy_desirable', proposed: 'psychotherapy_desirable' });
  s.handoffIntake('p_ilya', 'Первичный приём: психотерапия желательно.');
  const inbox = s.inbox({ to: 'd1' });
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].patientId, 'p_ilya');
  assert.equal(inbox[0].from, 'psy1');
  assert.equal(s.intakeOf('p_ilya').intake.handoff.text, 'Первичный приём: психотерапия желательно.');
  assert.ok(s.audit('p_ilya').some((a) => a.action === 'intake_handoff' && a.actor === 'psy1'));
});

test('psychologist alert visibility is separate from doctor delivery; ack by psychologist is audited as psychologist', () => {
  const s = mk();
  const [a] = s.alerts({ patientId: 'p_dmitry', open: true }).filter((x) => x.level === 'critical');
  s.markSeen(a.id, 'psy');
  const after = s.alerts({ patientId: 'p_dmitry' }).find((x) => x.id === a.id);
  assert.ok(after.seenBy.psy);
  assert.equal(after.deliveredAt, null);
  s.ackAlert(a.id, 'Связался с пациентом', 'psy1');
  assert.ok(s.audit('p_dmitry').some((x) => x.action === 'ack_alert' && x.actor === 'psy1'));
});

test('migration v1 → v2: keeps data, adds psychologist, Ilya and intake for scenario patients', () => {
  const storage = memStorage();
  const s1 = mk(storage);
  const raw = JSON.parse(storage.getItem('kk:v1'));
  // Имитируем данные первой версии: без психолога, без Ильи, без первичного приёма.
  raw.version = 1; delete raw.psychologist; delete raw.inbox; delete raw.patients.p_ilya; delete raw.events.p_ilya; delete raw.messages.p_ilya;
  delete raw.patients.p_anna.intake;
  raw.messages.p_anna.push({ id: 'm1', at: NOW.toISOString(), from: 'doctor', text: 'старое сообщение' });
  storage.setItem('kk:v1', JSON.stringify(raw));
  const s2 = KK.createStore({ storage, clock: () => NOW });
  assert.equal(s2.psychologist().name, 'Мария Белова');
  assert.ok(s2.patient('p_ilya'));
  assert.equal(s2.intakeOf('p_anna').status, 'assigned');
  assert.equal(s2.messages('p_anna').at(-1).text, 'старое сообщение');
  assert.equal(JSON.parse(storage.getItem('kk:v1')).version, 2);
  assert.ok(s1);
});

test('patient side: intake tile only while assigned/in progress; history never shows intake scales', () => {
  const s = mk();
  const app = KK.patientApp;
  assert.equal(app.intakeDue(s.patient('p_anna')), true);
  assert.equal(app.intakeDue(s.patient('p_ilya')), false);
  assert.equal(app.intakeDue(s.patient('p_sergey')), false);
  assert.equal(app.patientScale('dass21'), null);
  assert.equal(app.patientScale('tipi10'), null);
  const h = app.scaleHistory(s.events('p_ilya', 'scale'));
  assert.deepEqual(h, []);
});

test('patient-facing intake copy: no scores, severity words or alarm marks', () => {
  const d = KK.data.intake;
  const bad = /балл|тяж[её]л|критич|выраженн|депресс|!/i;
  const text = [d.title, ...d.steps.map((x) => x.label), ...d.form.flatMap((q) => [q.title, q.hint || '']), d.cssrsPatient.title, d.cssrsPatient.instruction,
    ...KK.patientApp.INTAKE_COPY].join(' ').replace(/«Мне тяжело»/g, ''); // название кнопки помощи — не оценка
  assert.ok(!/\d+\s*(из|балл)/.test(text));
  assert.doesNotMatch(text, bad);
});

test('psychApp.queue: only intake patients, critical first, then awaiting decision, in progress, assigned, decided', () => {
  const s = mk();
  const P = KK.psychApp;
  let q = P.queue(s.patients());
  assert.deepEqual(q.map((p) => p.id), ['p_ilya', 'p_anna']);
  s.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: [1, 1, 1, 0, 0, 0], context: 'intake' });
  q = P.queue(s.patients());
  assert.equal(q[0].id, 'p_anna');
  assert.equal(P.critical(q[0]), true);
  assert.equal(P.statusLabel('assigned'), 'назначен');
  assert.equal(P.statusLabel('in_progress'), 'в процессе');
  assert.equal(P.statusLabel('completed'), 'заполнено');
  assert.equal(P.statusLabel('decided'), 'решение принято');
});

test('psychApp.handoffText: preliminary wording, route, DASS bands, no diagnosis claims', () => {
  const s = mk();
  s.confirmIntake('p_ilya', { level: 'psychotherapy_desirable', proposed: 'psychotherapy_desirable' });
  const t = KK.psychApp.handoffText(s.patient('p_ilya'), s.intakeOf('p_ilya'), s.psychologist());
  assert.match(t, /Предварительная оценка/);
  assert.match(t, /Психотерапия — желательно/);
  assert.match(t, /Депрессия 18 \(умеренная\)/);
  assert.match(t, /Мария Белова/);
  assert.doesNotMatch(t, /диагноз:/i);
});

test('doctorApp.intakeCard: compact card only with a decision, link to psychologist view', () => {
  const s = mk();
  const D = KK.doctorApp;
  assert.equal(D.intakeCard(s.patient('p_ilya'), s.intakeOf('p_ilya')), '');
  assert.equal(D.intakeCard(s.patient('p_sergey'), null), '');
  s.confirmIntake('p_ilya', { level: 'psychotherapy_desirable', proposed: 'psychotherapy_desirable' });
  const html = D.intakeCard(s.patient('p_ilya'), s.intakeOf('p_ilya'));
  assert.match(html, /Первичный приём психолога/);
  assert.match(html, /Психотерапия — желательно/);
  assert.match(html, /\.\.\/psych\/patient\.html\?id=p_ilya/);
  assert.match(html, /умеренная/);
});

test('patientApp.intakeNextStep follows saved parts; cssrsShown asks 3–5 only after «да» on 2', () => {
  const app = KK.patientApp;
  const s = mk();
  assert.equal(app.intakeNextStep(s.intakeOf('p_anna')), 'intro');
  s.addEvent('p_anna', 'intake_form', FORM);
  assert.equal(app.intakeNextStep(s.intakeOf('p_anna')), 'cssrs');
  s.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: [0, 0, null, null, null, 0], context: 'intake' });
  assert.equal(app.intakeNextStep(s.intakeOf('p_anna')), 'tipi10');
  s.addEvent('p_anna', 'scale', { scaleId: 'tipi10', answers: new Array(10).fill(4), context: 'intake' });
  assert.equal(app.intakeNextStep(s.intakeOf('p_anna')), 'dass21');
  s.addEvent('p_anna', 'scale', { scaleId: 'dass21', answers: new Array(21).fill(0), context: 'intake' });
  assert.equal(app.intakeNextStep(s.intakeOf('p_anna')), 'cto');
  s.completeIntake('p_anna');
  assert.equal(app.intakeNextStep(s.intakeOf('p_anna')), 'done');
  assert.equal(app.intakeNextStep(null), null);
  assert.deepEqual(app.cssrsShown([0, 0]), [0, 1, 5]);
  assert.deepEqual(app.cssrsShown([1, 1]), [0, 1, 2, 3, 4, 5]);
  // C-SSRS из анкеты врача (без context) не засчитывается как часть батареи
  const s2 = mk();
  s2.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: [0, 0, null, null, null, 0] });
  assert.equal(s2.intakeOf('p_anna').cssrs, null);
});
