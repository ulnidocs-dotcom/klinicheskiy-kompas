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

test('export has the format, rules version, channels, consents and events but no secrets', () => {
  const s = mk();
  s.linkChannel('p_olga', 'max');
  s.recordConsents('p_olga', ['data_processing']);
  s.createLinkCode('p_olga');
  const b = KK.bundle.exportBundle(s, 'p_olga', NOW);
  assert.equal(b.format, 'kompas-bundle');
  assert.equal(b.version, 1);
  assert.equal(b.rulesVersion, '2026.10.1');
  assert.deepEqual(b.channels.map((c) => Object.keys(c).sort()), [['channel', 'linkedAt']]);
  assert.equal(b.consents[0].kind, 'data_processing');
  assert.ok(b.events.length > 0);
  const text = JSON.stringify(b);
  assert.doesNotMatch(text, /inviteCode|KMP-|linkCodes|fingerprint/);
});

test('import into another store gives the same events and plan; repeat import adds nothing', () => {
  const s = mk();
  s.addEvent('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 }, { clientId: 'cl_7', channel: 'max' });
  const b = KK.bundle.exportBundle(s, 'p_olga', NOW);
  const target = mk();
  const moved = JSON.parse(JSON.stringify(b));
  moved.patient.id = 'p_moved';
  assert.equal(KK.bundle.importBundle(target, JSON.stringify(moved)), 'p_moved');
  assert.equal(target.events('p_moved').length, b.events.length);
  assert.deepEqual(target.patient('p_moved').plan, s.patient('p_olga').plan);
  KK.bundle.importBundle(target, moved);
  assert.equal(target.events('p_moved').length, b.events.length);
});

test('unknown format or version is rejected without changes', () => {
  const s = mk();
  const before = s.patients().length;
  assert.throws(() => KK.bundle.importBundle(s, { format: 'other', version: 1 }), /не пакет/);
  assert.throws(() => KK.bundle.importBundle(s, { format: 'kompas-bundle', version: 2, patient: { id: 'x' }, events: [] }), /Версия пакета 2/);
  assert.throws(() => KK.bundle.importBundle(s, '{oops'), /прочитать/);
  assert.equal(s.patients().length, before);
});

test('file name is stable and safe', () => {
  assert.equal(KK.bundle.fileName('p_olga', NOW), 'kompas-p_olga-2026-10-19.json');
});
