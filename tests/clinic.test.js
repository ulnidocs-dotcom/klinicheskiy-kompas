const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const NOW = new Date('2026-10-21T12:00:00.000Z');
function mk() {
  const t = { now: NOW };
  const s = KK.createStore({ storage: memStorage(), clock: () => t.now });
  s.reset();
  return { s, t, later: (ms) => { t.now = new Date(t.now.getTime() + ms); } };
}

test('demo clinic has an admin, a doctor and a psychologist, all active', () => {
  const { s } = mk();
  assert.deepEqual(s.staff().map((x) => [x.email, x.role, x.status]), [
    ['admin@clinic.demo', 'admin', 'active'], ['elena.ivanova@clinic.demo', 'doctor', 'active'], ['maria.belova@clinic.demo', 'psychologist', 'active']]);
  assert.equal(s.staffByEmail(' Elena.Ivanova@clinic.demo ').id, 'd1');
});

test('invite: 72 hours, single use, creates an active staff member', () => {
  const { s, later } = mk();
  const inv = s.inviteStaff('New.Doc@Clinic.Demo', 'doctor');
  assert.match(inv.token, /^[A-Za-z0-9]{24}$/);
  assert.deepEqual(s.inviteInfo(inv.token), { state: 'pending', email: 'new.doc@clinic.demo', role: 'doctor', clinic: 'Клиника «Демо»', expiresAt: inv.expiresAt });
  const st = s.acceptInvite(inv.token, { name: 'Пётр Орлов', specialty: 'психиатр', phone: '+79123456789' });
  assert.equal(st.status, 'active');
  assert.equal(st.specialty, 'психиатр');
  assert.equal(s.inviteInfo(inv.token).state, 'used');
  assert.throws(() => s.acceptInvite(inv.token, { name: 'Пётр Орлов', specialty: 'психиатр', phone: '+79123456789' }), (e) => e.reason === 'used');
  const late = s.inviteStaff('late@clinic.demo', 'psychologist');
  later(72 * 3600000 + 1);
  assert.equal(s.inviteInfo(late.token).state, 'expired');
  assert.throws(() => s.acceptInvite(late.token, { name: 'Ира Котова', phone: '+79123450000' }), (e) => e.reason === 'expired');
});

test('invite: resend replaces the token, revoke blocks it, active email is refused', () => {
  const { s } = mk();
  const a = s.inviteStaff('x@clinic.demo', 'psychologist');
  const b = s.resendInvite(a.token);
  assert.notEqual(a.token, b.token);
  assert.equal(s.inviteInfo(a.token).state, 'revoked');
  s.revokeInvite(b.token);
  assert.equal(s.inviteInfo(b.token).state, 'revoked');
  assert.throws(() => s.inviteStaff('elena.ivanova@clinic.demo', 'doctor'), /уже есть/);
  assert.throws(() => s.inviteStaff('not-an-email', 'doctor'), /почты/);
  assert.equal(s.inviteInfo('nope').state, 'unknown');
});

test('psychologist and admin invites get a fixed specialty', () => {
  const { s } = mk();
  const p = s.acceptInvite(s.inviteStaff('p@clinic.demo', 'psychologist').token, { name: 'Ира Котова', specialty: 'психиатр', phone: '+79123450000' });
  assert.equal(p.specialty, 'клинический психолог');
});

test('one-time code: 6 digits, 5 minutes, 5 attempts, burns after success', () => {
  const { s, later } = mk();
  const { code } = s.requestOtp('+79123456789', 'patient_login');
  assert.match(code, /^\d{6}$/);
  const wrong = code === '000000' ? '111111' : '000000';
  assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', wrong), /Осталось попыток: 4/);
  assert.equal(s.verifyOtp('+79123456789', 'patient_login', code), true);
  assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', code), (e) => e.reason === 'missing');
  const second = s.requestOtp('+79123456789', 'patient_login').code;
  for (let i = 0; i < 4; i++) assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', second === '000000' ? '111111' : '000000'));
  assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', second === '000000' ? '111111' : '000000'), (e) => e.reason === 'attempts');
  assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', second), (e) => e.reason === 'attempts');
  const third = s.requestOtp('+79123456789', 'patient_login').code;
  later(5 * 60000 + 1);
  assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', third), (e) => e.reason === 'expired');
});

test('patient phone: one number per patient; demo Olga has a phone', () => {
  const { s } = mk();
  assert.equal(s.findPatientByPhone('+79000002648'), 'p_olga');
  s.setPatientPhone('p_anna', '+79123456789');
  assert.equal(s.findPatientByPhone('+79123456789'), 'p_anna');
  assert.throws(() => s.setPatientPhone('p_dmitry', '+79123456789'), (e) => e.reason === 'taken');
});

test('staff login check: blocked or unknown is refused with one neutral message', () => {
  const { s } = mk();
  assert.equal(s.staffLoginCheck('elena.ivanova@clinic.demo').id, 'd1');
  s.setStaff('d1', { status: 'blocked' });
  assert.throws(() => s.staffLoginCheck('elena.ivanova@clinic.demo'), /Не получилось войти/);
  assert.throws(() => s.staffLoginCheck('nobody@clinic.demo'), /Не получилось войти/);
  s.setStaff('psy1', { frmrChecked: false });
  assert.equal(s.staffById('psy1').frmrChecked, false);
  assert.throws(() => s.setStaff('psy1', { role: 'admin' }), /Нельзя изменить/);
});

test('password reset link: 30 minutes, single use, silent for unknown email', () => {
  const { s, later } = mk();
  assert.equal(s.createReset('nobody@clinic.demo'), null);
  const r = s.createReset('maria.belova@clinic.demo');
  assert.equal(s.resetInfo(r.token).staffId, 'psy1');
  assert.equal(s.completeReset(r.token).id, 'psy1');
  assert.equal(s.resetInfo(r.token), null);
  assert.throws(() => s.completeReset(r.token), /недействительна/);
  const r2 = s.createReset('maria.belova@clinic.demo');
  later(30 * 60000 + 1);
  assert.equal(s.resetInfo(r2.token), null);
});

test('an old store without clinic data gets the demo clinic lazily', () => {
  const storage = memStorage();
  const s1 = KK.createStore({ storage, clock: () => NOW });
  s1.reset();
  const raw = JSON.parse(storage.getItem('kk:v1'));
  delete raw.clinic;
  storage.setItem('kk:v1', JSON.stringify(raw));
  const s2 = KK.createStore({ storage, clock: () => NOW });
  assert.equal(s2.staff().length, 3);
});

test('regression: no duplicate staff via stale invites', () => {
  const { s, later } = mk();
  const a = s.inviteStaff('dup@clinic.demo', 'doctor');
  later(72 * 3600000 + 1);
  const b = s.inviteStaff('dup@clinic.demo', 'doctor');
  s.acceptInvite(b.token, { name: 'Пётр Орлов', specialty: 'психиатр', phone: '+79123456789' });
  assert.throws(() => s.resendInvite(a.token), /уже есть/);
  assert.equal(s.staff().filter((x) => x.email === 'dup@clinic.demo').length, 1);
  // resend revokes other pending invites for the same email
  const c = s.inviteStaff('two@clinic.demo', 'psychologist');
  const d = s.resendInvite(c.token);
  assert.equal(s.invites().filter((i) => i.email === 'two@clinic.demo' && i.state === 'pending').length, 1);
  assert.equal(s.inviteInfo(d.token).state, 'pending');
});

test('regression: the last active admin cannot be blocked', () => {
  const { s } = mk();
  assert.throws(() => s.setStaff('adm1', { status: 'blocked' }), /последнего администратора/);
  assert.equal(s.staffById('adm1').status, 'active');
});

test('regression: completeReset refuses a blocked staff member and keeps the token unused', () => {
  const { s } = mk();
  const r = s.createReset('maria.belova@clinic.demo');
  s.setStaff('psy1', { status: 'blocked' });
  assert.throws(() => s.completeReset(r.token), /недействительна/);
  s.setStaff('psy1', { status: 'active' });
  assert.equal(s.completeReset(r.token).id, 'psy1');
});

test('regression: falsy phone never matches or saves', () => {
  const { s } = mk();
  assert.equal(s.findPatientByPhone(null), null);
  assert.equal(s.findPatientByPhone(''), null);
  assert.equal(s.findPatientByPhone(undefined), null);
  assert.throws(() => s.setPatientPhone('p_anna', ''), /Укажите телефон/);
});

test('regression: a new reset link voids the earlier one of the same person', () => {
  const { s } = mk();
  const r1 = s.createReset('maria.belova@clinic.demo');
  const r2 = s.createReset('maria.belova@clinic.demo');
  assert.equal(s.resetInfo(r1.token), null);
  assert.equal(s.resetInfo(r2.token).staffId, 'psy1');
});

test('demo patients are already registered except Anna, whose onboarding is the demo', () => {
  const { s } = mk();
  assert.equal(s.patient('p_olga').consents.length, 3);
  assert.equal((s.patient('p_anna').consents || []).length, 0);
});

test('demo: a registered patient can be returned to the start of registration', () => {
  const { s } = mk();
  s.recordConsents('p_anna', ['data_processing']);
  s.linkChannel('p_anna', 'web');
  s.demoResetRegistration('p_anna');
  assert.equal(s.patient('p_anna').consents.length, 0);
  assert.equal(s.channels('p_anna').length, 0);
});
