// Анкета до приёма (спек 2026-10-22 §B): описание, подсчёт PHQ-2/GAD-2, условия показа, правила, предложения в карту, FHIR.
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
const Q = () => KK.questionnaire;
const DEF = () => KK.data.questionnaires.previsit;
const ANSWERS = {
  complaint: 'Тревога, плохо сплю', duration: '1m6m', sleep: 'worse', appetite: 'less',
  phq2_1: 1, phq2_2: 1, gad2_1: 2, gad2_2: 2, selfHarm: false,
  meds: [{ name: 'Сертралин', dose: '50 мг утром' }, { name: 'Какие-то капли', dose: '' }],
  allergy: true, allergyText: 'пенициллин, аспирин', chronic: ['epilepsy', 'diabetes', 'other'], chronicOther: 'гипертония',
  pregnancy: 'no', alcohol: 'rare', priorCare: false,
};
const payload = (over = {}, extra = {}) => Object.assign({ questionnaireId: 'previsit', version: 1, status: 'completed', answers: Object.assign({}, ANSWERS, over) }, extra);
const F = { sex: 'f', id: 'p1' }, M = { sex: 'm', id: 'p1' };

test('definition v1: required items, PHQ-2/GAD-2 sources, unique ids, known types', () => {
  const d = DEF();
  assert.equal(d.version, 1);
  assert.match(d.sources.phq2, /Kroenke.*2003/);
  assert.match(d.sources.gad2, /Kroenke.*2007/);
  const ids = d.items.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['complaint', 'duration', 'sleep', 'appetite', 'phq2_1', 'phq2_2', 'gad2_1', 'gad2_2', 'selfHarm', 'meds', 'allergy', 'chronic', 'pregnancy', 'alcohol', 'priorCare']) assert.ok(ids.includes(id), id);
  for (const q of d.items) assert.ok(['text', 'single', 'multi', 'yesno', 'scale', 'list'].includes(q.type), q.id);
  // формулировки PHQ-2/GAD-2 — первые вопросы PHQ-9/GAD-7
  assert.equal(d.items.find((q) => q.id === 'phq2_1').title, KK.data.scales.phq9.items[0]);
  assert.equal(d.items.find((q) => q.id === 'gad2_2').title, KK.data.scales.gad7.items[1]);
  // пациенту — без «!»
  for (const q of d.items) assert.doesNotMatch(`${q.title} ${q.hint || ''}`, /!/, q.id);
  assert.doesNotMatch(`${d.intro} ${d.done}`, /!/);
});

test('visibility: pregnancy only for women, follow-ups only when they apply', () => {
  const d = DEF();
  const ids = (a, p) => Q().visible(d, a, p).map((q) => q.id);
  assert.ok(ids({}, F).includes('pregnancy'));
  assert.ok(!ids({}, M).includes('pregnancy'));
  assert.ok(!ids({}, null).includes('pregnancy'));
  assert.ok(!ids({ allergy: false }, F).includes('allergyText'));
  assert.ok(ids({ allergy: true }, F).includes('allergyText'));
  assert.ok(!ids({ chronic: ['none'] }, F).includes('chronicOther'));
  assert.ok(ids({ chronic: ['other'] }, F).includes('chronicOther'));
});

test('clean drops hidden answers and unknown keys', () => {
  const a = Q().clean(DEF(), Object.assign({}, ANSWERS, { allergy: false, junk: 1 }), M);
  assert.equal(a.allergyText, undefined);
  assert.equal(a.pregnancy, undefined);
  assert.equal(a.junk, undefined);
  assert.equal(a.complaint, ANSWERS.complaint);
});

test('missing: required visible items without an answer; optional ones are not required', () => {
  const d = DEF();
  assert.deepEqual(Q().missing(d, ANSWERS, F), []);
  const m = Q().missing(d, { complaint: '  ' }, M);
  assert.ok(m.includes('complaint') && m.includes('phq2_1') && m.includes('chronic'));
  assert.ok(!m.includes('meds') && !m.includes('pregnancy') && !m.includes('allergyText'));
});

test('PHQ-2 / GAD-2 totals and threshold ≥ 3', () => {
  const s = Q().scores(ANSWERS);
  assert.deepEqual([s.phq2.total, s.phq2.positive, s.phq2.complete], [2, false, true]);
  assert.deepEqual([s.gad2.total, s.gad2.positive], [4, true]);
  const edge = Q().scores({ phq2_1: 3, phq2_2: 0, gad2_1: 1 });
  assert.equal(edge.phq2.positive, true);
  assert.equal(edge.gad2.complete, false);
  // мусор из payload не считается баллами
  assert.equal(Q().scores({ phq2_1: 7, phq2_2: '3' }).phq2.total, 0);
});

test('selfHarm and status of an assignment', () => {
  assert.equal(Q().selfHarm({ selfHarm: true }), true);
  assert.equal(Q().selfHarm({ selfHarm: 'true' }), false);
  const a = { questionnaireId: 'previsit', version: 1, sentAt: '2026-10-18T10:00:00.000Z' };
  assert.equal(Q().status(null, []).state, 'none');
  assert.equal(Q().status(a, []).state, 'sent');
  const old = { type: 'previsit', at: '2026-10-17T10:00:00.000Z', payload: payload() };
  assert.equal(Q().status(a, [old]).state, 'sent', 'answer to the previous assignment does not count');
  const part = { type: 'previsit', at: '2026-10-18T11:00:00.000Z', payload: payload({ selfHarm: true }, { status: 'in-progress' }) };
  assert.equal(Q().status(a, [old, part]).state, 'in_progress');
  const fin = { type: 'previsit', at: '2026-10-18T12:00:00.000Z', payload: payload() };
  const st = Q().status(a, [old, part, fin]);
  assert.equal(st.state, 'completed');
  assert.equal(st.response, fin);
});

test('summary: complaint, duration label, scores with hint, flags', () => {
  const s = Q().summary(DEF(), payload({ selfHarm: true, alcohol: 'daily', pregnancy: 'pregnant' }), F);
  assert.equal(s.complaint, ANSWERS.complaint);
  assert.equal(s.duration, 'От 1 до 6 месяцев');
  assert.equal(s.gad2.positive, true);
  assert.ok(s.flags.some((f) => /самоповрежд/.test(f.text) && f.level === 'critical'));
  assert.ok(s.flags.some((f) => /GAD-2.*полной шкалой/.test(f.text)));
  assert.ok(!s.flags.some((f) => /PHQ-2/.test(f.text)));
  assert.ok(s.flags.some((f) => /беременн/i.test(f.text)));
  assert.ok(s.flags.some((f) => /алкоголь/i.test(f.text)));
});

test('answer rows: every visible item in order, readable text', () => {
  const rows = Q().answerRows(DEF(), payload(), F);
  assert.equal(rows[0].id, 'complaint');
  const by = Object.fromEntries(rows.map((r) => [r.id, r.text]));
  assert.equal(by.phq2_1, 'Несколько дней');
  assert.equal(by.selfHarm, 'Нет');
  assert.match(by.meds, /Сертралин — 50 мг утром/);
  assert.match(by.chronic, /Эпилепсия или судороги, Сахарный диабет, Другое/);
  assert.equal(Q().answerRows(DEF(), payload({ complaint: '' }), F)[0].text, 'нет ответа');
});

test('proposals: meds via parser, allergies, conditions, pregnancy; already in card are skipped', () => {
  const p = { id: 'p1', sex: 'f', meds: [], allergies: ['Аспирин'], conditions: [], pregnant: false, lactating: false };
  const r = Q().proposals(DEF(), payload({ pregnancy: 'pregnant' }), p, KK.parser);
  const keys = r.items.map((x) => x.key);
  assert.ok(keys.includes('med:Сертралин'));
  assert.ok(keys.includes('allergy:пенициллин'));
  assert.ok(!keys.some((k) => /аспирин/i.test(k)), 'allergy already in card');
  assert.ok(keys.includes('condition:epilepsy'));
  assert.ok(keys.includes('condition:cvd'), 'гипертония из «Другое» распознана парсером');
  assert.ok(keys.includes('pregnant'));
  assert.deepEqual(r.unrecognized, ['Какие-то капли']);
  const p2 = Object.assign({}, p, { meds: [{ name: 'Сертралин', classes: [] }], conditions: ['epilepsy', 'cvd'], pregnant: true });
  const keys2 = Q().proposals(DEF(), payload({ pregnancy: 'pregnant' }), p2, KK.parser).items.map((x) => x.key);
  assert.ok(!keys2.includes('med:Сертралин') && !keys2.includes('condition:epilepsy') && !keys2.includes('pregnant'));
});

test('proposals are not applied without confirmation; only selected ones go to the card', () => {
  const s = mk();
  const before = JSON.stringify(s.patient('p_anna').meds);
  s.addEvent('p_anna', 'previsit', payload());
  assert.equal(JSON.stringify(s.patient('p_anna').meds), before, 'storing the response does not touch the card');
  const p = s.patient('p_anna');
  const r = Q().proposals(DEF(), s.events('p_anna', 'previsit').at(-1).payload, p, KK.parser);
  const parsed = Q().toParsed(r.items, ['allergy:пенициллин', 'condition:epilepsy']);
  assert.deepEqual(parsed.meds, []);
  s.importParsed('p_anna', parsed);
  const after = s.patient('p_anna');
  assert.ok(after.allergies.includes('пенициллин'));
  assert.ok(!after.allergies.includes('аспирин'));
  assert.ok(after.conditions.includes('epilepsy'));
  assert.equal(JSON.stringify(after.meds), before);
  const au = s.audit('p_anna').at(-1);
  assert.equal(au.action, 'import_history');
  assert.equal(au.details.source, 'previsit');
  assert.match(KK.doctorApp.auditLabel(au), /анкет/);
});

test('store: sendPrevisit creates the assignment lazily, validates the visit date, re-send replaces', () => {
  const s = mk();
  assert.equal(s.patient('p_anna').previsit, undefined);
  const a = s.sendPrevisit('p_anna', { visitDate: '2026-10-25', by: 'd1' });
  assert.deepEqual([a.questionnaireId, a.version, a.visitDate], ['previsit', 1, '2026-10-25']);
  assert.equal(s.patient('p_anna').previsit.sentAt, NOW.toISOString());
  assert.equal(s.audit('p_anna').at(-1).action, 'previsit_sent');
  assert.throws(() => s.sendPrevisit('p_anna', { visitDate: '25.10' }), /дат/i);
  for (const bad of ['2026-02-30', '2026-13-01', '2026-04-31', '2026-00-10']) assert.throws(() => s.sendPrevisit('p_anna', { visitDate: bad }), /дат/i, bad);
  assert.equal(s.sendPrevisit('p_anna', { visitDate: '2028-02-29' }).visitDate, '2028-02-29');
  assert.equal(s.sendPrevisit('p_anna', {}).visitDate, null);
  assert.throws(() => s.sendPrevisit('nope', {}), /Unknown patient/);
});

test('sync: a pre-visit response with self-harm «yes» is urgent, otherwise not', () => {
  assert.equal(KK.syncIsUrgent('previsit', payload({ selfHarm: true })), true);
  assert.equal(KK.syncIsUrgent('previsit', payload()), false);
  assert.equal(KK.syncIsUrgent('previsit', null), false);
  const sync = KK.createSync({ storage: memStorage(), transport: { send() { const e = new Error('net'); e.retryable = true; throw e; } }, schedule: () => 1 });
  assert.throws(() => sync.submit('p1', 'previsit', payload({ selfHarm: true })), (e) => e.offline === true);
  assert.equal(sync.submit('p1', 'previsit', payload()).pending, true);
});

// ——— Правила ———
const patient = (over = {}) => Object.assign({ id: 'p1', age: 40, sex: 'f', pregnant: false, lactating: false, diagnoses: [], meds: [], allergies: [], conditions: [],
  labs: {}, history: {}, plan: null, previsit: { questionnaireId: 'previsit', version: 1, sentAt: '2026-10-18T10:00:00.000Z' } }, over);
const run = (p, events) => KK.rules.evaluate(KK.rules.buildContext(p, events, NOW.toISOString()));
const pv = (over, at = '2026-10-18T12:00:00.000Z', extra) => ({ type: 'previsit', at, payload: payload(over, extra) });

test('rule previsit_selfharm: critical, routing required, team rule; earliest «yes» is the basis', () => {
  const r = KK.data.rules.find((x) => x.id === 'previsit_selfharm');
  assert.deepEqual([r.level, r.routing, r.teamRule], ['critical', 'required', true]);
  assert.match(r.source, /Правило команды/);
  const part = pv({ selfHarm: true }, '2026-10-18T11:00:00.000Z', { status: 'in-progress' });
  const sig = run(patient(), [part, pv({ selfHarm: true })]).find((s) => s.ruleId === 'previsit_selfharm');
  assert.ok(sig);
  assert.equal(sig.basis, '2026-10-18T11:00:00.000Z');
  assert.ok(sig.missing.some((m) => /C-SSRS/.test(m)));
  assert.equal(KK.rules.routing([sig]), 'required');
  assert.ok(!run(patient(), [pv({})]).some((s) => s.ruleId === 'previsit_selfharm'));
  // ответ на прежнюю анкету не поднимает сигнал по новой
  assert.ok(!run(patient(), [pv({ selfHarm: true }, '2026-10-17T12:00:00.000Z')]).some((s) => s.ruleId === 'previsit_selfharm'));
});

test('rule previsit_screen: info when PHQ-2 or GAD-2 ≥ 3 until the full scale is done', () => {
  const r = KK.data.rules.find((x) => x.id === 'previsit_screen');
  assert.equal(r.level, 'info');
  assert.match(r.source, /2003/);
  assert.match(r.source, /2007/);
  const sig = run(patient(), [pv({ phq2_1: 2, phq2_2: 1, gad2_1: 0, gad2_2: 1 })]).find((s) => s.ruleId === 'previsit_screen');
  assert.ok(sig);
  assert.match(sig.text, /PHQ-2 = 3.*PHQ-9/);
  assert.doesNotMatch(sig.text, /GAD-2/);
  assert.ok(!run(patient(), [pv({ phq2_1: 1, phq2_2: 1, gad2_1: 1, gad2_2: 1 })]).some((s) => s.ruleId === 'previsit_screen'));
  const phq9 = { type: 'scale', at: '2026-10-19T09:00:00.000Z', payload: KK.scales.score('phq9', [1, 1, 1, 1, 0, 0, 0, 0, 0]) };
  assert.ok(!run(patient(), [pv({ phq2_1: 2, phq2_2: 1, gad2_1: 0, gad2_2: 0 }), phq9]).some((s) => s.ruleId === 'previsit_screen'), 'PHQ-9 done after the questionnaire');
});

test('store: self-harm «yes» raises one critical alert even after the final submission', () => {
  const s = mk();
  s.sendPrevisit('p_anna', {});
  s.addEvent('p_anna', 'previsit', payload({ selfHarm: true }, { status: 'in-progress' }));
  s.addEvent('p_anna', 'previsit', payload({ selfHarm: true }));
  const al = s.alerts({ patientId: 'p_anna' }).filter((a) => a.ruleId === 'previsit_selfharm');
  assert.equal(al.length, 1);
  assert.equal(al[0].level, 'critical');
});

test('FHIR QuestionnaireResponse R4 shape', () => {
  const ev = { id: 'ev_1', type: 'previsit', at: '2026-10-18T12:00:00.000Z', payload: payload({ selfHarm: false }) };
  const r = Q().toFhir(DEF(), ev, { id: 'p_anna', sex: 'f' });
  assert.equal(r.resourceType, 'QuestionnaireResponse');
  assert.equal(r.questionnaire, `${DEF().canonical}|1`);
  assert.equal(r.status, 'completed');
  assert.equal(r.authored, ev.at);
  // FHIR id: [A-Za-z0-9\-.]{1,64} — «_» заменён на «-»
  assert.deepEqual(r.subject, { reference: 'Patient/p-anna' });
  assert.equal(r.id, 'ev-1');
  assert.match(r.id, /^[A-Za-z0-9\-.]{1,64}$/);
  const anon = Q().toFhir(DEF(), { at: ev.at, payload: payload() }, null);
  assert.equal(anon.subject, undefined, 'no Patient/undefined');
  assert.equal(anon.id, undefined);
  const by = Object.fromEntries(r.item.map((i) => [i.linkId, i]));
  assert.deepEqual(by.complaint.answer, [{ valueString: ANSWERS.complaint }]);
  assert.deepEqual(by.selfHarm.answer, [{ valueBoolean: false }]);
  assert.deepEqual(by.phq2_1.answer, [{ valueInteger: 1 }]);
  assert.equal(by.duration.answer[0].valueCoding.code, '1m6m');
  assert.equal(by.duration.answer[0].valueCoding.display, 'От 1 до 6 месяцев');
  assert.equal(by.chronic.answer.length, 3);
  assert.deepEqual(by.meds.answer.map((a) => a.valueString), ['Сертралин — 50 мг утром', 'Какие-то капли']);
  assert.ok(by.complaint.text);
  for (const it of r.item) assert.ok(it.answer.length > 0, it.linkId);
  // скрытые и пустые вопросы в экспорт не попадают
  const m = Q().toFhir(DEF(), { at: ev.at, payload: payload({ complaint: '' }) }, { id: 'p1', sex: 'm' });
  assert.ok(!m.item.some((i) => i.linkId === 'pregnancy' || i.linkId === 'complaint'));
  assert.equal(Q().toFhir(DEF(), { at: ev.at, payload: payload({}, { status: 'in-progress' }) }, { id: 'p1' }).status, 'in-progress');
  assert.doesNotThrow(() => JSON.stringify(r));
});

test('draft key is reset with the demo data', () => {
  assert.equal(Q().draftKey('p_anna'), 'kk:previsit-draft:p_anna');
  assert.deepEqual(KK.doctorApp.demoDeviceKeys(['kk:previsit-draft:p_anna', 'kk:v1']), ['kk:previsit-draft:p_anna']);
});

test('patient app: previsitState counts a queued (offline) answer as sent', () => {
  const app = KK.patientApp;
  const p = { id: 'p1', previsit: { questionnaireId: 'previsit', version: 1, sentAt: '2026-10-18T10:00:00.000Z' } };
  assert.equal(app.previsitState({ id: 'p1' }, [], []), 'none');
  assert.equal(app.previsitState(p, [], []), 'sent');
  const queued = [{ type: 'previsit', queuedAt: '2026-10-18T12:00:00.000Z', payload: payload() }];
  assert.equal(app.previsitState(p, [], queued), 'completed');
});

test('pages: patient questionnaire and today load the questionnaire modules; scripts parse', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  for (const page of ['patient/previsit.html', 'patient/index.html', 'doctor/patient.html']) {
    const h = read(page);
    assert.match(h, /data\/questionnaires\.js/, page);
    assert.match(h, /assets\/questionnaire\.js/, page);
    assert.ok(h.indexOf('data/questionnaires.js') < h.indexOf('assets/questionnaire.js'), page);
  }
  for (const js of ['patient/previsit.js', 'patient/today.js', 'patient/help.js', 'doctor/patient.js']) assert.doesNotThrow(() => new Function(read(js)), js);
  assert.match(read('patient/today.js'), /previsit\.html/);
  assert.match(read('patient/previsit.js'), /help\.html\?from=\$\{from\}|help\.html\?from=/);
  assert.match(read('patient/help.js'), /previsit_selfharm/);
});

test('doctor card: send button, waiting state, summary with escaped answers, unchecked proposals, FHIR export', () => {
  const D = KK.doctorApp;
  const base = { id: 'p1', sex: 'f', meds: [], allergies: [], conditions: [], pregnant: false, lactating: false };
  const none = D.previsitCard(base, []);
  assert.match(none, /data-previsit-open/);
  assert.match(D.previsitCard(base, [], { open: true }), /id="pv-date"[\s\S]*data-previsit-send/);
  const p = Object.assign({}, base, { previsit: { questionnaireId: 'previsit', version: 1, sentAt: '2026-10-18T10:00:00.000Z', visitDate: '2026-10-25' } });
  assert.match(D.previsitCard(p, []), /ещё не заполнил/);
  const ev = { id: 'ev1', type: 'previsit', at: '2026-10-18T12:00:00.000Z', payload: payload({ complaint: '<img src=x onerror=alert(1)>' }) };
  const html = D.previsitCard(p, [ev], { msg: '<b>x</b>' });
  assert.doesNotMatch(html, /<img|<b>x/);
  assert.match(html, /&lt;img/);
  assert.match(html, /приём 25\.10\.2026/);
  assert.match(html, /GAD-2[\s\S]*желательно оценить полной шкалой/);
  assert.match(html, /Предлагается добавить в карту — со слов пациента/);
  assert.match(html, /data-pv-key="med:Сертралин"(?! checked)/);
  assert.doesNotMatch(html, /data-pv-key="[^"]*" checked/);
  assert.match(html, /data-previsit-apply/);
  assert.match(html, /Экспорт \(FHIR QuestionnaireResponse\)/);
  assert.match(html, /Не распознано автоматически[\s\S]*Какие-то капли/);
  assert.match(D.previsitCard(p, [ev], { checked: ['med:Сертралин'] }), /data-pv-key="med:Сертралин" checked/);
  // незавершённая анкета с «да»: критический флаг, без предложений и экспорта
  const part = { type: 'previsit', at: '2026-10-18T11:00:00.000Z', payload: payload({ selfHarm: true }, { status: 'in-progress' }) };
  const ph = D.previsitCard(p, [part]);
  assert.match(ph, /Не завершена/);
  assert.match(ph, /badge--critical/);
  assert.doesNotMatch(ph, /data-previsit-apply|data-previsit-fhir/);
});

// ——— Ревью: «да» на самоповреждение не скрывается и всегда ведёт к помощи ———
test('a self-harm «yes» changed later to «no» stays visible as a critical flag', () => {
  const a = { questionnaireId: 'previsit', version: 1, sentAt: '2026-10-18T10:00:00.000Z' };
  const part = { type: 'previsit', at: '2026-10-18T11:00:00.000Z', payload: payload({ selfHarm: true }, { status: 'in-progress' }) };
  const fin = { type: 'previsit', at: '2026-10-18T12:00:00.000Z', payload: payload({ selfHarm: false }) };
  const st = Q().status(a, [part, fin]);
  assert.equal(st.state, 'completed');
  assert.equal(st.selfHarmEver, true);
  assert.equal(Q().status(a, [fin]).selfHarmEver, false);
  const s = Q().summary(DEF(), st.response.payload, F, { selfHarmEver: st.selfHarmEver });
  const f = s.flags.find((x) => x.level === 'critical');
  assert.ok(f);
  assert.equal(f.text, 'В анкете был ответ «да» на вопрос о самоповреждении (позже изменён)');
  assert.ok(!Q().summary(DEF(), fin.payload, F).flags.some((x) => x.level === 'critical'));
  // и в карточке врача
  const p = { id: 'p1', sex: 'f', meds: [], allergies: [], conditions: [], previsit: a };
  const html = KK.doctorApp.previsitCard(p, [part, fin]);
  assert.match(html, /badge--critical[\s\S]*позже изменён/);
  // правило тоже остаётся
  const sig = KK.rules.evaluate(KK.rules.buildContext(Object.assign({ diagnoses: [], meds: [], allergies: [], conditions: [], labs: {}, history: {}, plan: null, age: 40 }, p), [part, fin], NOW.toISOString()));
  assert.ok(sig.some((x) => x.ruleId === 'previsit_selfharm'));
});

test('answers to an older assignment (assignedAt before sentAt) are ignored by status and rules', () => {
  const a = { questionnaireId: 'previsit', version: 1, sentAt: '2026-10-18T10:00:00.000Z' };
  // пришло из очереди после новой отправки, но относится к прежней
  const stale = { type: 'previsit', at: '2026-10-18T12:00:00.000Z', payload: payload({ selfHarm: true, phq2_1: 3, phq2_2: 3 }, { assignedAt: '2026-10-10T10:00:00.000Z' }) };
  const st = Q().status(a, [stale]);
  assert.equal(st.state, 'sent');
  assert.equal(st.selfHarmEver, false);
  const p = { id: 'p1', sex: 'f', diagnoses: [], meds: [], allergies: [], conditions: [], labs: {}, history: {}, plan: null, age: 40, previsit: a };
  const sig = KK.rules.evaluate(KK.rules.buildContext(p, [stale], NOW.toISOString()));
  assert.ok(!sig.some((x) => x.ruleId === 'previsit_selfharm' || x.ruleId === 'previsit_screen'));
  const ok = { type: 'previsit', at: stale.at, payload: payload({ selfHarm: true }, { assignedAt: a.sentAt }) };
  assert.equal(Q().status(a, [ok]).state, 'completed');
  assert.ok(KK.rules.evaluate(KK.rules.buildContext(p, [ok], NOW.toISOString())).some((x) => x.ruleId === 'previsit_selfharm'));
});

test('patient page: «yes» always opens help; only the resend is gated; an unsent «yes» in a draft is retried on load', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'patient', 'previsit.js'), 'utf8');
  assert.match(src, /if \(q\.urgent && v === true\) \{ urgentNow\(\); return; \}/);
  assert.match(src, /if \(st\.urgentSent\) \{ save\(\); toHelp\('previsit'\); return; \}/);
  assert.match(src, /Q\.selfHarm\(st\.answers\) && !st\.urgentSent\) \{ urgentNow\(false\); return; \}/);
  assert.doesNotThrow(() => new Function(src));
});
