// Заявки на запись к психологу или психиатру: чат-бот → психолог или врач; психолог — «записать раньше».
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
const inDays = (d) => new Date(+NOW + d * 864e5).toISOString();

test('demo seed: Olga has past and next psychiatrist visits, Sergey has a new bot request', () => {
  const s = mk();
  const v = s.visits('p_olga');
  assert.ok(v.last && new Date(v.last.scheduledAt) < NOW);
  assert.ok(v.next && new Date(v.next.scheduledAt) > NOW);
  const fresh = s.bookings({ status: 'new' });
  assert.deepEqual(fresh.map((b) => b.patientId), ['p_sergey']);
  assert.equal(fresh[0].source, 'bot');
});

test('request → schedule: status, visit, audit; handled request cannot be scheduled twice', () => {
  const s = mk();
  const b = s.requestBooking('p_anna', { to: 'psychologist', when: 'morning', source: 'bot' });
  assert.equal(b.status, 'new');
  const done = s.scheduleBooking(b.id, { at: inDays(3), specialist: 'Мария Белова' });
  assert.equal(done.status, 'scheduled');
  assert.equal(s.visits('p_anna', 'psychologist').next.id, b.id);
  assert.ok(s.audit('p_anna').some((a) => a.action === 'booking_requested'));
  assert.ok(s.audit('p_anna').some((a) => a.action === 'booking_scheduled'));
  assert.throws(() => s.scheduleBooking(b.id, { at: inDays(4), specialist: 'x' }), /уже обработана/);
});

test('schedule validates future time and specialist; decline needs a reason', () => {
  const s = mk();
  const b = s.requestBooking('p_anna', { to: 'psychiatrist' });
  assert.throws(() => s.scheduleBooking(b.id, { at: inDays(-1), specialist: 'Павел Ершов' }), /в будущем/);
  assert.throws(() => s.scheduleBooking(b.id, { at: inDays(2), specialist: ' ' }), /специалиста/);
  assert.throws(() => s.declineBooking(b.id, ''), /причину/);
  const d = s.declineBooking(b.id, 'Нет свободных мест, перезвоним');
  assert.equal(d.status, 'declined');
});

test('repeat request to the same specialist updates the open one; same clientId is idempotent', () => {
  const s = mk();
  const a = s.requestBooking('p_anna', { to: 'psychologist', note: 'первое' });
  const b = s.requestBooking('p_anna', { to: 'psychologist', note: 'второе', urgent: true, source: 'psychologist', by: 'psy1' });
  assert.equal(b.id, a.id);
  assert.equal(b.duplicate, true);
  assert.equal(b.urgent, true);
  assert.match(b.note, /первое\nвторое/);
  const c1 = s.requestBooking('p_anna', { to: 'psychiatrist', clientId: 'cl_1' });
  const c2 = s.requestBooking('p_anna', { to: 'psychiatrist', clientId: 'cl_1' });
  assert.equal(c1.id, c2.id);
  assert.equal(s.bookings({ patientId: 'p_anna' }).length, 2);
});

test('request validation: unknown patient, specialist, time and source are rejected', () => {
  const s = mk();
  assert.throws(() => s.requestBooking('nobody', { to: 'psychologist' }));
  assert.throws(() => s.requestBooking('p_anna', { to: 'surgeon' }), /специалисту/);
  assert.throws(() => s.requestBooking('p_anna', { to: 'psychologist', when: 'midnight' }));
  assert.throws(() => s.requestBooking('p_anna', { to: 'psychologist', source: 'email' }));
});

test('sync transport turns a queued booking into a request (channel max-chat)', () => {
  const s = mk();
  const sync = KK.createSync({ storage: memStorage(), transport: KK.syncLocalTransport(s), uid: () => 'cl_x', schedule: () => null });
  const r = sync.submit('p_anna', 'booking', { to: 'psychiatrist', when: 'soon', source: 'bot' }, { channel: 'max-chat' });
  assert.equal(r.status, 'new');
  assert.equal(s.bookings({ patientId: 'p_anna' })[0].clientId, 'cl_x');
});
