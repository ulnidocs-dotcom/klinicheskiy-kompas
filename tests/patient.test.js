const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

test('materials: unique ids, known categories, each has source', () => {
  const ids = new Set();
  for (const m of KK.data.materials) {
    assert.ok(!ids.has(m.id), m.id); ids.add(m.id);
    assert.ok(['about', 'treatment', 'practice'].includes(m.cat), m.id);
    assert.ok(m.source && m.title && m.summary && m.body.length, m.id);
  }
  assert.ok(KK.data.materials.filter((m) => m.cat === 'practice').length >= 4);
});

test('patient copy has no alarming words or digits-as-scores', () => {
  const bad = /тяж[её]л|критич|выраженн|!|балл/i;
  for (const m of KK.data.materials) {
    const text = [m.title, m.summary, ...m.body.map((b) => (typeof b === 'string' ? b : (b.items || []).join(' ')))].join(' ');
    assert.doesNotMatch(text, bad, m.id);
  }
});

test('practiceOfDay is deterministic per date', () => {
  const a = KK.patientApp.practiceOfDay(new Date(2026, 9, 19, 8, 0).toISOString());
  const b = KK.patientApp.practiceOfDay(new Date(2026, 9, 19, 20, 0).toISOString());
  assert.equal(a.id, b.id);
  assert.equal(a.cat, 'practice');
});

test('dueScales returns scales older than period', () => {
  const now = '2026-10-19T12:00:00.000Z';
  const latest = { phq9: { at: '2026-10-01T10:00:00Z' }, gad7: { at: '2026-10-15T10:00:00Z' }, cssrs: null };
  assert.deepEqual(KK.patientApp.dueScales(latest, now, 14), ['phq9']);
  assert.deepEqual(KK.patientApp.dueScales({ phq9: null, gad7: null }, now, 14), ['gad7', 'phq9']);
});

test('checkinSummary is gentle text', () => {
  const t = KK.patientApp.checkinSummary([{ payload: { mood: 2 } }, { payload: { mood: 2 } }, { payload: { mood: 4 } }, { payload: { mood: 4 } }]);
  assert.match(t, /настроение/i);
  assert.doesNotMatch(t, /\d/);
});

test('patientScale/nextScales whitelist own, patient-facing scales only', () => {
  const app = KK.patientApp;
  assert.ok(app.patientScale('phq9'));
  for (const k of ['__proto__', 'constructor', 'toString', '', null, undefined]) assert.equal(app.patientScale(k), null, String(k));
  if (KK.data.scales.cssrs.audience === 'doctor') assert.equal(app.patientScale('cssrs'), null);
  assert.deepEqual(app.nextScales('gad7,__proto__,constructor,phq9,nope'), ['gad7', 'phq9']);
  assert.deepEqual(app.nextScales(null), []);
});

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('phqAlertOpen: «врач уведомлён» only with an open si_phq9 alert', () => {
  const s = KK.createStore({ storage: memStorage(), clock: () => new Date('2026-10-19T12:00:00Z') });
  s.reset();
  const app = KK.patientApp;
  assert.equal(app.phqAlertOpen(s.alerts({ patientId: 'p_anna', open: true })), false);
  const dm = s.alerts({ patientId: 'p_dmitry', open: true });
  assert.equal(app.phqAlertOpen(dm), true);
  dm.filter((a) => a.ruleId === 'si_phq9').forEach((a) => s.ackAlert(a.id, 'Просмотрено'));
  assert.equal(app.phqAlertOpen(s.alerts({ patientId: 'p_dmitry', open: true })), false);
});

test('scaleHistory skips C-SSRS and incomplete forms, uses saved band text', () => {
  const sc = (scaleId, answers, at) => ({ type: 'scale', at, payload: KK.scales.score(scaleId, answers) });
  const ev = [
    sc('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 0], '2026-10-01T10:00:00Z'),
    sc('gad7', [1, 1], '2026-10-02T10:00:00Z'),
    sc('cssrs', [0, 0, null, null, null, 0], '2026-10-03T10:00:00Z'),
    sc('gad7', [0, 0, 0, 0, 0, 0, 0], '2026-10-04T10:00:00Z'),
  ];
  const h = KK.patientApp.scaleHistory(ev);
  assert.deepEqual(h.map((x) => x.scaleId), ['gad7', 'phq9']);
  assert.equal(h[1].label, ev[0].payload.band.patientText || 'Ответы получены врачом.');
  assert.ok(h.every((x) => !/\d/.test(x.label)));
});

test('trendWord: same split as checkinSummary; words only; null with < 4 check-ins', () => {
  const app = KK.patientApp;
  const c = (mood, sleep) => ({ payload: { mood, sleep } });
  assert.equal(app.trendWord([c(2, 4), c(2, 4), c(4, 2), c(4, 2)], 'mood'), 'ровнее');
  assert.equal(app.trendWord([c(2, 4), c(2, 4), c(4, 2), c(4, 2)], 'sleep'), 'хуже');
  assert.equal(app.trendWord([c(4, 3), c(4, 3), c(2, 3), c(2, 3)], 'mood'), 'труднее');
  assert.equal(app.trendWord([c(3, 3), c(3, 3), c(3, 3), c(3, 3)], 'sleep'), 'как обычно');
  assert.equal(app.trendWord([c(3, 3), c(3, 3), c(3, 3)], 'mood'), null);
  const a = [c(2, 1), c(2, 1), c(4, 1), c(4, 1)];
  assert.equal(app.trendWord(a, 'mood') === 'ровнее', /ровнее/.test(app.checkinSummary(a)));
});

test('patient path tiles: no clinical scores, no severity words, no red, words for trends', () => {
  const app = KK.patientApp;
  const c = (mood, sleep) => ({ at: '2026-10-10T09:00:00Z', payload: { mood, sleep, anxiety: 3 } });
  const practice = KK.data.materials.find((m) => m.cat === 'practice');
  const bad = /тяж[её]л|критич|выраженн|!|балл|PHQ|GAD|из 27|из 21|σ|crit/i;
  for (const confirmed of [true, false]) {
    for (const checkins of [[], [c(1, 1), c(1, 2), c(5, 5), c(5, 4)], [c(5, 5), c(5, 5), c(1, 1), c(1, 1)]]) {
      const list = app.pathTiles({ confirmed, takenDays: 9, checkins, practice, periodLabel: 'за 2 недели' });
      const html = KK.tiles.tileGrid(list);
      assert.doesNotMatch(html, bad);
      assert.doesNotMatch(html, /NaN|undefined|null/);
      const [, mood, sleep] = list;
      for (const t of [mood, sleep]) assert.ok(t.value == null || !/\d/.test(t.value), String(t.value));
    }
  }
  const off = app.pathTiles({ confirmed: false, takenDays: 0, checkins: [], practice, periodLabel: 'за месяц' });
  assert.equal(off[0].label, 'Лечение'); assert.equal(off[0].value, 'Врач обсуждает план');
  const on = app.pathTiles({ confirmed: true, takenDays: 9, checkins: [], practice, periodLabel: 'за месяц' });
  assert.match(KK.tiles.tile(on[0]), /aria-label="Дни с приёмом: 9 из 14"/);
  assert.ok(KK.tiles.tile(on.find((t) => t && t.href)).includes(`href="material.html?id=${practice.id}"`));
});

test('check-in questions: three scales, each with its own tone; words for every value, «не выбрано» otherwise', () => {
  const app = KK.patientApp;
  assert.deepEqual(app.CHECKIN_Q.map((q) => [q.key, q.tone]), [['mood', 'mood'], ['anxiety', 'anx'], ['sleep', 'sleep']]);
  for (const q of app.CHECKIN_Q) {
    assert.equal(q.labels.length, 5);
    assert.ok(q.title && q.past && q.name);
    for (let v = 1; v <= 5; v++) assert.equal(app.checkinWord(q.key, v), q.labels[v - 1]);
    for (const v of [0, 6, 2.5, null, undefined, '3']) assert.equal(app.checkinWord(q.key, v), 'не выбрано');
  }
  assert.equal(app.checkinWord('mood', 3), 'Так себе');
  assert.ok(KK.tiles.tile({ aura: 'mood', value: 1 }).includes('aura--mood'));
  assert.ok(KK.tiles.tile({ aura: 'sleep', value: 1 }).includes('aura--sleep'));
});

test('recentDays: 7 days ending today, no future, marks by day key; noonOf/dayTitle', () => {
  const app = KK.patientApp;
  const now = new Date(2026, 9, 20, 9, 30).toISOString();
  const marked = new Set([KK.util.dayKey(new Date(2026, 9, 19, 20).toISOString())]);
  const d = app.recentDays(now, marked);
  assert.equal(d.length, 7);
  assert.equal(d.at(-1).today, true);
  assert.equal(d.filter((x) => x.today).length, 1);
  assert.equal(d.at(-1).key, KK.util.dayKey(now));
  assert.equal(d[0].key, KK.util.dayKey(new Date(2026, 9, 14, 12).toISOString()));
  assert.ok(d.every((x) => new Date(x.iso) <= new Date(now)));
  assert.deepEqual(d.filter((x) => x.mark).map((x) => x.key), [...marked]);
  assert.equal(d.at(-2).label, 'Пн');
  const noon = new Date(app.noonOf('2026-10-19'));
  assert.deepEqual([noon.getFullYear(), noon.getMonth(), noon.getDate(), noon.getHours()], [2026, 9, 19, 12]);
  assert.equal(app.dayTitle('2026-10-19'), 'пн, 19 октября');
});

test('checkinOn: latest recorded check-in of that day wins; null when none', () => {
  const app = KK.patientApp;
  const ev = [
    { type: 'checkin', at: '2026-10-19T08:00:00Z', payload: { mood: 1 } },
    { type: 'dose', at: '2026-10-19T09:00:00Z', payload: {} },
    { type: 'checkin', at: '2026-10-19T09:00:00Z', recordedAt: '2026-10-20T07:00:00Z', payload: { mood: 4 } },
    { type: 'checkin', at: '2026-10-19T18:00:00Z', payload: { mood: 2 } },
  ];
  assert.equal(app.checkinOn(ev, KK.util.dayKey('2026-10-19T09:00:00Z')).payload.mood, 4);
  assert.equal(app.checkinOn(ev, '2026-10-01'), null);
});

test('dose slot: taken slot tells screen readers it can be undone', () => {
  const app = KK.patientApp;
  assert.match(app.slotHtml({ slot: 'утро', taken: true }), /aria-pressed="true".*по ошибке/);
  assert.doesNotMatch(app.slotHtml({ slot: 'вечер', taken: false }), /по ошибке/);
});

test('today.js check-in: real range slider 1–5 with labels, no auto-advance, back/next, edit, past days', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'patient', 'today.js'), 'utf8');
  assert.match(src, /type="range" id="rng" min="1" max="5" step="0.01"/);
  assert.match(src, /aria-valuetext=/);
  assert.match(src, /aria-label="\$\{ui\.esc\(q\.name\)\}: ползунок"/);
  for (const k of ['data-back', 'data-next', 'data-edit', 'data-day', 'data-undo-yes', 'Готово', 'Дальше', 'Назад', 'Изменить']) assert.ok(src.includes(k), k);
  const dotHandler = src.slice(src.indexOf("closest('.q .dot')"), src.indexOf("closest('[data-next]')"));
  assert.doesNotMatch(dotHandler, /qi\+\+|save\(/, 'касание сферы не переходит дальше');
  const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'patient.css'), 'utf8');
  assert.match(css, /::-webkit-slider-thumb\{[^}]*width:44px;height:44px/);
  assert.match(css, /::-moz-range-thumb\{[^}]*width:44px;height:44px/);
  assert.match(css, /\.ruler input:focus-visible\{outline/);
});
test('patient pages write events only through KK.sync', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '..', 'patient');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(dir, f), 'utf8'), /store\.addEvent\(/, f);
  }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    assert.match(fs.readFileSync(path.join(dir, f), 'utf8'), /assets\/sync\.js/, f);
  }
});

test('sync note text never promises delivery', () => {
  const t = KK.patientApp.SYNC_PENDING;
  assert.match(t, /отправится/);
  assert.doesNotMatch(t, /сразу|мгновенно/);
});
