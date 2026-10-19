const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const D = () => KK.doctorApp;

test('modeFor specialty', () => {
  assert.equal(D().modeFor('психиатр'), 'psychiatrist');
  assert.equal(D().modeFor('Врач-психотерапевт'), 'psychiatrist');
  assert.equal(D().modeFor('терапевт'), 'nonPsychiatrist');
});

test('signal badge distinguishes required vs desirable by class and text', () => {
  const r = D().signalBadge({ level: 'important', routing: 'required' });
  const d = D().signalBadge({ level: 'info', routing: 'desirable' });
  assert.match(r, /badge--required/); assert.match(r, /Обязательно/);
  assert.match(d, /badge--desirable/); assert.match(d, /Желательно/);
  assert.match(D().signalBadge({ level: 'critical', routing: 'required' }), /badge--critical/);
});

test('hint shown only in nonPsychiatrist mode', () => {
  const s = { ruleId: 'si_phq9', level: 'critical', routing: 'required', title: 't', text: 'x', source: 's' };
  assert.match(D().signalHtml(s, 'nonPsychiatrist'), /class="hint-box"/);
  assert.doesNotMatch(D().signalHtml(s, 'psychiatrist'), /class="hint-box"/);
});

test('signalHtml escapes text', () => {
  const s = { ruleId: 'x', level: 'info', routing: null, title: '<b>', text: '<i>', source: 's' };
  const html = D().signalHtml(s, 'psychiatrist');
  assert.match(html, /&lt;b&gt;/);
  assert.match(html, /&lt;i&gt;/);
  assert.doesNotMatch(html, /<i>/);
});

test('referral text contains patient, reasons, scales and urgency', () => {
  const store = KK.createStore({ storage: memStorage(), clock: () => new Date('2026-10-19T12:00:00Z') });
  store.reset();
  const p = store.patient('p_dmitry');
  const t = D().referralText(p, store.doctor());
  assert.match(t, /Дмитрий Ковалёв/);
  assert.match(t, /PHQ-9: 21/);
  assert.match(t, /Срочность: обязательно/);
  assert.match(t, /Суицидальные мысли/);
});

test('alert timing stats (minutes, median)', () => {
  const a = [
    { dataAt: '2026-10-19T10:00:00Z', deliveredAt: '2026-10-19T10:00:30Z', ackAt: '2026-10-19T10:10:00Z' },
    { dataAt: '2026-10-19T11:00:00Z', deliveredAt: '2026-10-19T11:01:30Z', ackAt: '2026-10-19T11:30:00Z' },
    { dataAt: '2026-10-19T12:00:00Z', deliveredAt: null, ackAt: null },
  ];
  const s = D().alertStats(a);
  assert.equal(s.deliveredMedianSec, 60);
  assert.equal(s.ackMedianMin, 20);
  assert.equal(s.open, 1);
});

test('highlight wraps spans and escapes the rest', () => {
  const html = D().highlight('<x> F41.1 сертралин', [{ start: 4, end: 9, kind: 'diagnosis' }, { start: 10, end: 19, kind: 'med' }]);
  assert.match(html, /^&lt;x&gt; <mark class="hl hl--diagnosis">F41\.1<\/mark> <mark class="hl hl--med">сертралин<\/mark>$/);
});

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
