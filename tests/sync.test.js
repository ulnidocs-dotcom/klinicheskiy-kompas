const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const NOW = new Date('2026-10-19T12:00:00.000Z');
function setup({ online = true } = {}) {
  const store = KK.createStore({ storage: memStorage(), clock: () => NOW });
  store.reset();
  const local = KK.syncLocalTransport(store);
  const net = { online };
  const transport = { send(items) { if (!net.online) { const e = new Error('offline'); e.retryable = true; throw e; } return local.send(items); } };
  const timers = [];
  const storage = memStorage();
  const sync = KK.createSync({ storage, transport, channel: 'max', schedule: (fn, ms) => timers.push(ms) });
  return { store, sync, net, timers, storage, transport };
}

test('online submit stores the event with channel and clientId and returns it', () => {
  const { store, sync } = setup();
  const e = sync.submit('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 });
  assert.equal(e.channel, 'max');
  assert.ok(e.clientId);
  assert.ok(store.events('p_olga').some((x) => x.id === e.id));
  assert.equal(sync.pending(), 0);
});

test('offline submit is queued, survives a reload and is sent once on flush', () => {
  const { store, sync, net, timers, storage, transport } = setup({ online: false });
  const r = sync.submit('p_olga', 'dose', { slot: 'утро', taken: true });
  assert.equal(r.pending, true);
  assert.equal(sync.pending('p_olga'), 1);
  assert.deepEqual(timers, [2000]);
  const reloaded = KK.createSync({ storage, transport, channel: 'max', schedule: () => {} });
  assert.equal(reloaded.pending(), 1);
  const before = store.events('p_olga', 'dose').length;
  net.online = true;
  assert.deepEqual(reloaded.flush(), { sent: 1, pending: 0 });
  reloaded.flush();
  assert.equal(store.events('p_olga', 'dose').length, before + 1);
});

test('retry delay doubles up to 60 seconds', () => {
  const fns = []; const delays = [];
  const offline = { send() { const e = new Error('offline'); e.retryable = true; throw e; } };
  const sync = KK.createSync({ storage: memStorage(), transport: offline, schedule: (fn, ms) => { fns.push(fn); delays.push(ms); return fns.length; } });
  sync.submit('p_olga', 'dose', { slot: 'утро', taken: true });
  for (let i = 0; i < 6; i++) fns[i](); // каждый срабатывший таймер снова не может отправить
  assert.deepEqual(delays, [2000, 4000, 8000, 16000, 32000, 60000, 60000]);
});

test('SOS never waits in the queue: offline it throws so the page can say so', () => {
  const { sync } = setup({ online: false });
  assert.throws(() => sync.submit('p_olga', 'sos', { source: 'patient_button' }), (e) => e.offline === true);
  assert.equal(sync.pending(), 0);
});

test('a scale answer that raises a critical signal is urgent', () => {
  assert.equal(KK.syncIsUrgent('scale', { scaleId: 'phq9', answers: [0, 0, 0, 0, 0, 0, 0, 0, 1] }), true);
  assert.equal(KK.syncIsUrgent('scale', { scaleId: 'phq9', answers: [0, 0, 0, 0, 0, 0, 0, 0, 0] }), false);
  assert.equal(KK.syncIsUrgent('checkin', {}), false);
});

test('validation errors from the store reach the caller and are not queued', () => {
  const { sync } = setup();
  assert.throws(() => sync.submit('p_olga', 'dose', { slot: 'утро', taken: true }, { at: '2026-10-18T12:00:00.000Z' }), /Задним числом/);
  assert.equal(sync.pending(), 0);
});

test('a queued item rejected by the store is kept in rejected() and can be cleared', () => {
  const { sync, net } = setup({ online: false });
  sync.submit('p_olga', 'dose', { slot: 'утро', taken: true }, { at: '2026-10-18T12:00:00.000Z' });
  assert.equal(sync.pending(), 1);
  net.online = true;
  sync.flush();
  assert.equal(sync.pending(), 0);
  const r = sync.rejected('p_olga');
  assert.equal(r.length, 1);
  assert.equal(r[0].type, 'dose');
  assert.match(r[0].reason, /Задним числом/);
  sync.clearRejected('p_olga');
  assert.equal(sync.rejected().length, 0);
});

test('a severe adverse event is urgent, a mild one is not', () => {
  assert.equal(KK.syncIsUrgent('ae', { items: [{ id: 'x', severity: 'severe' }] }), true);
  assert.equal(KK.syncIsUrgent('ae', { items: [{ id: 'x', severity: 'mild' }], note: '' }), false);
  const { sync } = setup({ online: false });
  assert.throws(() => sync.submit('p_olga', 'ae', { items: [{ id: 'x', severity: 'severe' }], note: '' }), (e) => e.offline === true);
});

test('queued dose marks the slot as taken today (no duplicate)', () => {
  const { sync } = setup({ online: false });
  sync.submit('p_olga', 'dose', { slot: 'утро', taken: true });
  const slots = KK.patientApp.doseSlots([], new Date().toISOString(), sync.queued('p_olga').map((q) => Object.assign({}, q, { queuedAt: new Date().toISOString() })));
  assert.equal(slots.find((s) => s.slot === 'утро').taken, true);
  assert.equal(slots.find((s) => s.slot === 'вечер').taken, false);
});

test('chat message goes through the outbox: queued offline, delivered once by clientId', () => {
  const { store, sync, net } = setup({ online: false });
  const before = store.messages('p_olga').length;
  const r = sync.submit('p_olga', 'message', { text: 'Можно перенести визит?' });
  assert.equal(r.pending, true);
  assert.equal(store.messages('p_olga').length, before);
  assert.equal(sync.queued('p_olga')[0].type, 'message');
  net.online = true;
  assert.equal(sync.flush().sent, 1);
  sync.flush();
  const mine = store.messages('p_olga').filter((m) => m.text === 'Можно перенести визит?');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].from, 'patient');
});

test('online message is stored at once; a repeat with the same clientId adds nothing', () => {
  const { store } = setup();
  const local = KK.syncLocalTransport(store);
  const item = { clientId: 'cl_fixed', patientId: 'p_olga', type: 'message', payload: { text: 'Привет' }, opts: {}, channel: 'web' };
  const n = store.messages('p_olga').length;
  local.send([item]); local.send([item]);
  assert.equal(store.messages('p_olga').length, n + 1);
});

test('a queued item can be removed from the outbox', () => {
  const { sync } = setup({ online: false });
  sync.submit('p_olga', 'dose', { slot: 'утро', taken: true });
  const id = sync.queued('p_olga')[0].clientId;
  assert.equal(sync.remove(id), true);
  assert.equal(sync.pending('p_olga'), 0);
  assert.equal(sync.remove(id), false);
});

test('queued check-in marks its day in the week strip', () => {
  const { sync } = setup({ online: false });
  sync.submit('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 });
  const days = KK.patientApp.markedDays([], sync.queued('p_olga'));
  assert.ok(days.has(KK.util.dayKey(sync.queued('p_olga')[0].queuedAt)));
});
