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

test('decisions carry the rule version when the audit entry has it', () => {
  const s = mk();
  const a = s.alerts({ patientId: 'p_dmitry' })[0] || s.alerts()[0];
  assert.ok(a && a.ruleVersion, 'seed alert has a rule version');
  s.ackAlert(a.id, 'Просмотрено');
  const b = KK.bundle.exportBundle(s, a.patientId, NOW);
  const d = b.decisions.find((x) => x.kind === 'ack_alert');
  assert.equal(d.ruleVersion, a.ruleVersion);
  const other = b.decisions.find((x) => x.kind !== 'ack_alert');
  if (other) assert.equal('ruleVersion' in other, false);
});

test('export includes still-queued events and messages marked pending; import skips them', () => {
  const s = mk();
  const queued = [
    { clientId: 'cl_1', patientId: 'p_olga', type: 'dose', payload: { slot: 'утро', taken: true }, opts: {}, channel: 'max', queuedAt: '2026-10-19T08:00:00.000Z' },
    { clientId: 'cl_2', patientId: 'p_olga', type: 'message', payload: { text: 'Добрый день' }, opts: {}, channel: 'max', queuedAt: '2026-10-19T09:00:00.000Z' },
  ];
  const b = KK.bundle.exportBundle(s, 'p_olga', NOW, queued);
  const pe = b.events.filter((e) => e.pending);
  assert.deepEqual(pe.map((e) => [e.clientId, e.type, e.payload.slot]), [['cl_1', 'dose', 'утро']]);
  assert.deepEqual(b.messages.filter((m) => m.pending).map((m) => m.text), ['Добрый день']);
  assert.equal(KK.bundle.exportBundle(s, 'p_olga', NOW).events.some((e) => e.pending), false);
  const t = mk();
  t.reset();
  KK.bundle.importBundle(t, JSON.stringify(b));
  assert.equal(t.events('p_olga').some((e) => e.clientId === 'cl_1'), false);
  assert.equal(t.messages('p_olga').some((m) => m.text === 'Добрый день'), false);
});
