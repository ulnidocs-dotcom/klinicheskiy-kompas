// Приглашение пациента в дневник (спек 2026-10-22, раздел A): новый пациент, одноразовая ссылка, защита по телефону.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./load');
const KK = globalThis.KK;

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const T0 = new Date('2026-10-22T09:00:00.000Z');
function mk() {
  let now = T0;
  const s = KK.createStore({ storage: memStorage(), clock: () => now });
  s.reset();
  return { s, at: (ms) => { now = new Date(+T0 + ms); } };
}
const H = 3600000;
const ALL = ['data_processing', 'doctor_access', 'not_emergency'];
const NEW = { name: 'Пётр Васильев', age: 52, sex: 'm', phone: '8 (912) 345-67-89' };
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('addPatient: phone is required and normalized; card has no events and no consents', () => {
  const { s } = mk();
  assert.throws(() => s.addPatient(Object.assign({}, NEW, { phone: '' })), /телефон/i);
  assert.throws(() => s.addPatient(Object.assign({}, NEW, { phone: '12345' })), /телефон|номер/i);
  const id = s.addPatient(Object.assign({}, NEW, { dxCode: 'f32.1', dxText: 'Депрессивный эпизод средней степени' }));
  const p = s.patient(id);
  assert.equal(p.phone, '+79123456789');
  assert.equal(p.name, 'Пётр Васильев');
  assert.equal(p.initials, 'ПВ');
  assert.equal(p.sex, 'm');
  assert.equal(p.age, 52);
  assert.deepEqual(p.diagnoses, [{ code: 'F32.1', text: 'Депрессивный эпизод средней степени' }]);
  assert.deepEqual(p.consents, []);
  assert.equal(s.events(id).length, 0);
  assert.ok(s.patients().some((x) => x.id === id));
  assert.ok(s.audit(id).some((a) => a.action === 'patient_added'));
});

test('addPatient: validates name, age, sex, ICD-10 code and phone uniqueness', () => {
  const { s } = mk();
  assert.throws(() => s.addPatient(Object.assign({}, NEW, { name: 'Я' })), /ФИО|имя/i);
  assert.throws(() => s.addPatient(Object.assign({}, NEW, { age: 0 })), /возраст/i);
  assert.throws(() => s.addPatient(Object.assign({}, NEW, { age: 'abc' })), /возраст/i);
  assert.throws(() => s.addPatient(Object.assign({}, NEW, { sex: 'x' })), /пол/i);
  assert.throws(() => s.addPatient(Object.assign({}, NEW, { dxCode: 'депрессия' })), /МКБ/);
  assert.throws(() => s.addPatient(Object.assign({}, NEW, { phone: '+79000002648' })), /другого пациента/); // Ольга
  const id = s.addPatient(NEW); // диагноз необязателен
  assert.deepEqual(s.patient(id).diagnoses, []);
});

test('patient invite: 24-char token, lives 72 hours, no personal data in the token', () => {
  const { s, at } = mk();
  const id = s.addPatient(NEW);
  const inv = s.createPatientInvite(id);
  assert.match(inv.token, /^[A-Za-z0-9]{24}$/);
  assert.equal(+new Date(inv.expiresAt) - +T0, 72 * H);
  assert.equal(inv.state, 'pending');
  assert.equal(s.patientInviteInfo(inv.token).state, 'pending');
  assert.equal(s.patientInviteInfo(inv.token).patientId, id);
  at(72 * H - 1000);
  assert.equal(s.patientInviteInfo(inv.token).state, 'pending');
  at(72 * H);
  assert.equal(s.patientInviteInfo(inv.token).state, 'expired');
  assert.equal(s.patientInviteInfo(inv.token).patientId, undefined);
  assert.equal(s.patientInvite(id).state, 'expired');
  assert.throws(() => s.redeemPatientInvite(inv.token, { phone: '+79123456789', consents: ALL }), (e) => e.reason === 'expired');
  assert.equal(s.patientInviteInfo('nope').state, 'unknown');
  assert.equal(s.patientInviteInfo('').state, 'unknown');
  for (const st of ['expired', 'used', 'revoked', 'unknown']) assert.match(s.patientInviteText(st), /Попросите врача прислать новое приглашение/);
});

test('patient invite: a new invite revokes the previous one', () => {
  const { s } = mk();
  const id = s.addPatient(NEW);
  const a = s.createPatientInvite(id);
  const b = s.createPatientInvite(id);
  assert.notEqual(a.token, b.token);
  assert.equal(s.patientInviteInfo(a.token).state, 'revoked');
  assert.equal(s.patientInviteInfo(b.token).state, 'pending');
  assert.equal(s.patientInvite(id).token, b.token);
  assert.throws(() => s.redeemPatientInvite(a.token, { phone: '+79123456789', consents: ALL }), (e) => e.reason === 'revoked');
});

test('patient invite: only for a patient not yet connected; unknown patient fails', () => {
  const { s } = mk();
  assert.throws(() => s.createPatientInvite('p_olga'), /уже подключ/);
  assert.throws(() => s.createPatientInvite('__proto__'), /Unknown patient/);
  assert.equal(s.patientInvite('p_olga'), null);
  assert.ok(s.createPatientInvite('p_anna').token); // Анна — сценарий без согласий
});

test('redeem with the card phone links the patient once; the second use fails', () => {
  const { s, at } = mk();
  const id = s.addPatient(NEW);
  const inv = s.createPatientInvite(id);
  at(10 * H);
  assert.equal(s.invitePhoneMatches(inv.token, '+79123456789'), true);
  const r = s.redeemPatientInvite(inv.token, { phone: '+79123456789', consents: ALL });
  assert.deepEqual(r, { status: 'linked', patientId: id });
  const p = s.patient(id);
  assert.deepEqual(p.consents.map((c) => c.kind), ALL);
  assert.equal(s.patientInviteInfo(inv.token).state, 'used');
  assert.equal(s.patientInvite(id).state, 'used');
  assert.throws(() => s.redeemPatientInvite(inv.token, { phone: '+79123456789', consents: ALL }), (e) => e.reason === 'used');
  assert.ok(s.audit(id).some((a) => a.action === 'invite_redeemed'));
});

test('redeem requires all consents and a phone; failure does not burn the invite', () => {
  const { s } = mk();
  const id = s.addPatient(NEW);
  const inv = s.createPatientInvite(id);
  assert.throws(() => s.redeemPatientInvite(inv.token, { phone: '+79123456789', consents: ALL.slice(0, 2) }), /соглас/);
  assert.throws(() => s.redeemPatientInvite(inv.token, { phone: '', consents: ALL }), /телефон/i);
  assert.equal(s.patientInviteInfo(inv.token).state, 'pending');
});

test('card without a phone takes the confirmed phone on redeem', () => {
  const { s } = mk();
  // Карта без телефона и без согласий (как перенесённая из пакета): берём снимок Ильи без этих полей.
  const snap = s.snapshot('p_ilya');
  const patient = Object.assign({}, snap.patient, { id: 'p_nophone', name: 'Без Телефона', consents: [] });
  delete patient.phone;
  s.restore({ patient });
  const inv = s.createPatientInvite('p_nophone');
  assert.equal(s.patient('p_nophone').phone, undefined);
  assert.equal(s.invitePhoneMatches(inv.token, '+79876543210'), true);
  assert.equal(s.redeemPatientInvite(inv.token, { phone: '+79876543210', consents: ALL }).status, 'linked');
  assert.equal(s.patient('p_nophone').phone, '+79876543210');
});

test('phone mismatch: pending confirmation, doctor inbox entry, invite stays unused', () => {
  const { s } = mk();
  const id = s.addPatient(NEW);
  const inv = s.createPatientInvite(id);
  assert.equal(s.invitePhoneMatches(inv.token, '+79990001122'), false);
  const r = s.redeemPatientInvite(inv.token, { phone: '+79990001122', consents: ALL });
  assert.equal(r.status, 'pending');
  assert.equal(r.patientId, id);
  assert.equal(s.phoneConfirmState(r.confirmId), 'pending');
  assert.deepEqual(s.patient(id).consents, []);
  assert.equal(s.patient(id).phone, '+79123456789');
  assert.equal(s.patientInviteInfo(inv.token).state, 'pending');
  const box = s.inbox({ to: 'd1', patientId: id, unread: true });
  assert.equal(box.length, 1);
  assert.equal(box[0].kind, 'phone_confirm');
  assert.equal(box[0].confirmId, r.confirmId);
  assert.match(box[0].text, /Подтвердите номер пациента/);
  assert.equal(s.phoneConfirms({ state: 'pending' }).length, 1);
  assert.equal(s.phoneConfirms({ patientId: id })[0].phone, '+79990001122');
});

test('phone mismatch → doctor approves: patient linked with the confirmed phone, invite used', () => {
  const { s } = mk();
  const id = s.addPatient(NEW);
  const inv = s.createPatientInvite(id);
  const r = s.redeemPatientInvite(inv.token, { phone: '+79990001122', consents: ALL });
  assert.equal(s.resolvePhoneConfirm(r.confirmId, true), 'approved');
  assert.equal(s.phoneConfirmState(r.confirmId), 'approved');
  const p = s.patient(id);
  assert.equal(p.phone, '+79990001122');
  assert.deepEqual(p.consents.map((c) => c.kind), ALL);
  assert.equal(s.patientInviteInfo(inv.token).state, 'used');
  assert.equal(s.inbox({ to: 'd1', patientId: id, unread: true }).length, 0);
  assert.ok(s.audit(id).some((a) => a.action === 'phone_confirm_approved'));
  assert.throws(() => s.resolvePhoneConfirm(r.confirmId, false), /уже/);
});

test('phone mismatch → doctor rejects: patient stays unconnected, the forwarded link stops working', () => {
  const { s } = mk();
  const id = s.addPatient(NEW);
  const inv = s.createPatientInvite(id);
  const r = s.redeemPatientInvite(inv.token, { phone: '+79990001122', consents: ALL });
  assert.equal(s.resolvePhoneConfirm(r.confirmId, false), 'rejected');
  const p = s.patient(id);
  assert.deepEqual(p.consents, []);
  assert.equal(p.phone, '+79123456789');
  assert.equal(s.patientInviteInfo(inv.token).state, 'revoked');
  assert.equal(s.phoneConfirms({ state: 'pending' }).length, 0);
  assert.ok(s.audit(id).some((a) => a.action === 'phone_confirm_rejected'));
  assert.equal(s.resolvePhoneConfirm('nope', true), null);
});

test('phone mismatch: a new invite cancels the pending confirmation; approve then fails', () => {
  const { s } = mk();
  const id = s.addPatient(NEW);
  const inv = s.createPatientInvite(id);
  const r = s.redeemPatientInvite(inv.token, { phone: '+79990001122', consents: ALL });
  s.createPatientInvite(id);
  assert.equal(s.phoneConfirmState(r.confirmId), 'cancelled');
  assert.throws(() => s.resolvePhoneConfirm(r.confirmId, true), /уже/);
  assert.deepEqual(s.patient(id).consents, []);
});

test('phone mismatch: the phone of another patient is refused before a confirmation is created', () => {
  const { s } = mk();
  const id = s.addPatient(NEW);
  const inv = s.createPatientInvite(id);
  assert.throws(() => s.redeemPatientInvite(inv.token, { phone: '+79000002648', consents: ALL }), (e) => e.reason === 'taken');
  assert.equal(s.phoneConfirms({}).length, 0);
});


test('doctor invite links: MAX deep link, site link, SMS text', () => {
  const D = KK.doctorApp;
  const tok = 'AbCdEfGhJkMnPqRsTuVwXyZ2';
  const l = D.inviteLinks(tok, 'https://demo.example/kompas/doctor/patient.html?id=p1');
  assert.equal(l.max, `https://max.ru/kompas_bot?startapp=inv_${tok}`);
  assert.equal(l.site, `https://demo.example/kompas/patient/onboarding.html?invite=${tok}`);
  assert.equal(l.sms, `Ваш врач приглашает вас в дневник самочувствия: ${l.site}. Ссылка действует 3 дня.`);
});

test('doctor QR: inline SVG built locally (vendor qrcode-generator), no external service', () => {
  const D = KK.doctorApp;
  const qr = require('../assets/vendor/qrcode.js');
  const svg = D.qrSvg('https://demo.example/kompas/patient/onboarding.html?invite=AbCdEfGhJkMnPqRsTuVwXyZ2', qr);
  assert.match(svg, /^<svg[^>]*viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /<path d="M/);
  assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/);
  assert.equal(D.qrSvg('x', null), '');
  const vendor = read('assets/vendor/qrcode.js');
  assert.match(vendor, /Kazuhiko Arase/);
  assert.match(vendor, /MIT license/);
});

test('doctor invite status texts and audit labels', () => {
  const D = KK.doctorApp;
  const at = '2026-10-22T09:00:00.000Z', until = '2026-10-25T09:00:00.000Z';
  assert.match(D.inviteStatus({ state: 'pending', createdAt: at, expiresAt: until }), /^Приглашение отправлено .+, действует до /);
  assert.match(D.inviteStatus({ state: 'used', usedAt: at }), /использовано/);
  assert.match(D.inviteStatus({ state: 'expired', expiresAt: until }), /истекло/);
  assert.equal(D.inviteStatus(null), '');
  for (const action of ['patient_added', 'invite_created', 'invite_redeemed', 'phone_confirm_approved', 'phone_confirm_rejected']) {
    assert.notEqual(D.auditLabel({ action }), action, action);
  }
});

test('doctor inbox: phone_confirm entry has approve/reject buttons and escapes text', () => {
  const D = KK.doctorApp;
  const had = KK.store;
  const { s } = mk();
  KK.store = s;
  try {
    const id = s.addPatient(NEW);
    const inv = s.createPatientInvite(id);
    const r = s.redeemPatientInvite(inv.token, { phone: '+79990001122', consents: ALL });
    const items = s.inbox({ to: 'd1', patientId: id });
    let html = D.inboxHtml(items.map((m) => Object.assign({}, m, { text: m.text + ' <b>x</b>' })), { title: 'Подтвердите номер пациента' });
    assert.match(html, new RegExp(`data-phone-confirm="${r.confirmId}" data-approve="1"`));
    assert.match(html, /data-approve="0"/);
    assert.doesNotMatch(html, /data-inbox-read/);
    assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
    s.resolvePhoneConfirm(r.confirmId, false);
    html = D.inboxHtml(s.inbox({ to: 'd1', patientId: id }));
    assert.doesNotMatch(html, /data-phone-confirm/);
    assert.match(html, /Подключение отклонено/);
  } finally { KK.store = had; }
});

test('pages: doctor list and card are wired for invites', () => {
  for (const f of ['doctor/index.js', 'doctor/patient.js']) assert.doesNotThrow(() => new Function(read(f)), f);
  assert.match(read('doctor/patient.html'), /assets\/vendor\/qrcode\.js/);
  const idx = read('doctor/index.js');
  assert.match(idx, /Добавить пациента/);
  assert.match(idx, /store\.addPatient\(/);
  assert.match(idx, /store\.phoneConfirms\(/);
  const card = read('doctor/patient.js');
  assert.match(card, /Пригласить в дневник/);
  assert.match(card, /createPatientInvite\(/);
  assert.match(card, /Распечатать памятку/);
  assert.match(card, /Новое приглашение/);
  assert.match(card, /Демо: SMS не отправляется/);
  assert.match(read('assets/doctor.js'), /resolvePhoneConfirm\(/);
  assert.match(read('assets/doctor.css'), /@media print/);
});
