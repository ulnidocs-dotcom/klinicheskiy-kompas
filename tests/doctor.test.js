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

test('nextCriticalToShow: only when nothing is open, skips delivered and acked', () => {
  const a = { id: 'a', level: 'critical', ackAt: null, deliveredAt: null };
  const b = { id: 'b', level: 'critical', ackAt: null, deliveredAt: '2026-10-19T12:00:00Z' };
  const c = { id: 'c', level: 'critical', ackAt: '2026-10-19T12:00:00Z', deliveredAt: null };
  const d = { id: 'd', level: 'important', ackAt: null, deliveredAt: null };
  assert.equal(D().nextCriticalToShow([b, c, d, a], undefined).id, 'a');
  assert.equal(D().nextCriticalToShow([a], 'x'), null);
  assert.equal(D().nextCriticalToShow([b, c, d], undefined), null);
});

test('critical modal queue: two undelivered criticals shown one by one, each exactly once', () => {
  const store = KK.createStore({ storage: memStorage(), clock: () => new Date('2026-10-19T12:00:00Z') });
  store.reset();
  store.addEvent('p_anna', 'sos', { source: 'patient_button' });
  const crit = () => store.alerts({ open: true }).filter((a) => a.level === 'critical');
  assert.ok(crit().filter((a) => !a.deliveredAt).length >= 2);
  const shown = [];
  const root = {
    dataset: {}, _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; if (v) shown.push(this.dataset.open); },
    contains: () => false, querySelector: () => ({ focus() {} }),
  };
  const prev = { document: globalThis.document, store: KK.store };
  globalThis.document = { getElementById: (id) => (id === 'modal-root' ? root : null), activeElement: null };
  KK.store = store;
  try {
    // Как в D.start: каждое изменение стора синхронно зовёт showCriticalModal.
    store.subscribe(() => D().showCriticalModal());
    D().showCriticalModal();
    assert.equal(shown.length, 1);
    const first = shown[0];
    assert.equal(root.dataset.open, first);
    // Повторный вход из markDelivered не должен «доставить» второй алерт без показа.
    assert.equal(crit().filter((a) => a.deliveredAt && a.id !== first).length, 0);
    D().closeCriticalModal(first, 'Связался с пациентом');
    assert.equal(shown.length, 2);
    assert.notEqual(shown[1], first);
    while (root.dataset.open) D().closeCriticalModal(root.dataset.open, 'Просмотрено');
    D().showCriticalModal();
    assert.equal(new Set(shown).size, shown.length, 'каждый показан ровно один раз');
    assert.ok(!shown.includes(undefined));
    assert.ok(crit().every((a) => shown.includes(a.id) || a.deliveredAt));
    assert.equal(store.alerts().find((a) => a.id === first).ackAction, 'Связался с пациентом');
  } finally {
    globalThis.document = prev.document; KK.store = prev.store;
  }
});

test('assessScale whitelists ?scale param', () => {
  assert.equal(D().assessScale('gad7', false), 'gad7');
  assert.equal(D().assessScale('cssrs', false), 'cssrs');
  for (const bad of ['__proto__', 'constructor', 'toString', 'x', null]) {
    assert.equal(D().assessScale(bad, false), 'phq9', String(bad));
    assert.equal(D().assessScale(bad, true), 'cssrs', String(bad));
  }
});

test('assessForm: no interpretation until all visible questions are answered', () => {
  const empty = D().assessForm('cssrs', []);
  assert.equal(empty.filled, false);
  assert.equal(empty.summary, 'Ответьте на вопросы');
  assert.doesNotMatch(empty.summary, /не выявлен/);
  const partial = D().assessForm('cssrs', [0, 0]);
  assert.equal(partial.summary, 'Ответьте на вопросы');
  const none = D().assessForm('cssrs', [0, 0, undefined, undefined, undefined, 0]);
  assert.equal(none.filled, true);
  assert.equal(none.result.band.code, 'none');
  assert.equal(none.summary, none.result.band.doctorLabel);
  // При «нет» на вопрос 2 вопросы 3–5 скрыты и сохраняются как null, даже если были отмечены раньше.
  const hidden = D().assessForm('cssrs', [1, 0, 1, 1, 1, 0]);
  assert.deepEqual(hidden.full, [1, 0, null, null, null, 0]);
  assert.equal(hidden.result.band.code, 'low');
  const phqPart = D().assessForm('phq9', [1, 2]);
  assert.equal(phqPart.filled, false);
  assert.equal(phqPart.summary, 'Сумма: 3 (ответьте на все вопросы)');
  const phqFull = D().assessForm('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.match(phqFull.summary, /^Сумма: 0 — /);
});

test('C-SSRS with hidden questions saved as null is accepted and scored', () => {
  const store = KK.createStore({ storage: memStorage(), clock: () => new Date('2026-10-19T12:00:00Z') });
  store.reset();
  const f = D().assessForm('cssrs', [1, 0, undefined, undefined, undefined, 0]);
  const e = store.addEvent('p_anna', 'scale', { scaleId: 'cssrs', answers: f.full });
  assert.deepEqual(e.payload.answers, [1, 0, null, null, null, 0]);
  assert.equal(store.patient('p_anna').latest.cssrs.band.code, 'low');
});
