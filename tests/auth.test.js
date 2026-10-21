const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const A = () => KK.auth;

test('russian mobile numbers are normalized to +7XXXXXXXXXX', () => {
  for (const raw of ['8 (912) 345-67-89', '+7 912 345 67 89', '79123456789', '9123456789']) assert.equal(A().normalizePhone(raw), '+79123456789', raw);
  for (const bad of ['', '12345', '+1 202 555 0100', '8 800 2000-12']) assert.equal(A().normalizePhone(bad), null, bad);
  assert.equal(A().maskPhone('+79123456789'), '+7 912 •••-••-89');
});

test('emails are trimmed, lowercased and validated', () => {
  assert.equal(A().normalizeEmail('  Elena.Ivanova@Clinic.Demo '), 'elena.ivanova@clinic.demo');
  assert.equal(A().validEmail('a@b.ru'), true);
  for (const bad of ['', 'a@b', 'a b@c.ru', '@c.ru']) assert.equal(A().validEmail(bad), false, bad);
});

test('password check: length, digits only, common, contains email', () => {
  assert.equal(A().passwordCheck('short1').ok, false);
  assert.equal(A().passwordCheck('12345678901').ok, false);
  assert.equal(A().passwordCheck('Qwerty1234!').ok, false);
  assert.equal(A().passwordCheck('elena.ivanova-2026', 'elena.ivanova@clinic.demo').ok, false);
  const good = A().passwordCheck('Тихий-сад-у-реки-7');
  assert.equal(good.ok, true);
  assert.match(good.hint, /Надёжный/);
});

test('session lives in the given storage and survives bad JSON', () => {
  const m = new Map();
  const s = A().createSession({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) });
  assert.equal(s.get(), null);
  s.set({ kind: 'staff', staffId: 'd1', role: 'doctor' });
  assert.deepEqual(s.get(), { kind: 'staff', staffId: 'd1', role: 'doctor' });
  m.set(A().SESSION_KEY, '{oops');
  assert.equal(s.get(), null);
  s.clear();
  assert.equal(m.has(A().SESSION_KEY), false);
});
