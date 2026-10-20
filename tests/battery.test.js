const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const B = KK.battery;

// DASS-21: ключ (номера пунктов с 1) — Д 3,5,10,13,16,17,21; Т 2,4,7,9,15,19,20; С 1,6,8,11,12,14,18.
const D_ITEMS = [3, 5, 10, 13, 16, 17, 21], A_ITEMS = [2, 4, 7, 9, 15, 19, 20], S_ITEMS = [1, 6, 8, 11, 12, 14, 18];
// Ответы, дающие заданные сырые суммы по субшкалам (каждая 0..21).
function dass(dRaw, aRaw, sRaw) {
  const a = new Array(21).fill(0);
  const fill = (items, raw) => { let left = raw; for (const n of items) { const v = Math.min(3, left); a[n - 1] = v; left -= v; } };
  fill(D_ITEMS, dRaw); fill(A_ITEMS, aRaw); fill(S_ITEMS, sRaw);
  return a;
}
const band = (r, k) => r.subscales[k].band && r.subscales[k].band.code;

test('DASS-21 data: 21 items, 4 options 0–3, item key covers all items once', () => {
  const d = KK.data.scales.dass21;
  assert.equal(d.items.length, 21);
  assert.deepEqual(d.options.map((o) => o.v), [0, 1, 2, 3]);
  const all = [...d.subscales.depression.items, ...d.subscales.anxiety.items, ...d.subscales.stress.items].sort((x, y) => x - y);
  assert.deepEqual(all, Array.from({ length: 21 }, (_, i) => i + 1));
  assert.deepEqual(d.subscales.depression.items, D_ITEMS);
  assert.deepEqual(d.subscales.anxiety.items, A_ITEMS);
  assert.deepEqual(d.subscales.stress.items, S_ITEMS);
  assert.ok(d.source && d.license && d.audience === 'intake');
});

test('DASS-21 scoring: subscale sum ×2', () => {
  const r = B.scoreDass(dass(9, 6, 12));
  assert.equal(r.complete, true);
  assert.equal(r.subscales.depression.raw, 9);
  assert.equal(r.subscales.depression.score, 18);
  assert.equal(r.subscales.anxiety.score, 12);
  assert.equal(r.subscales.stress.score, 24);
});

test('DASS-21 depression bands 9/10/13/14/20/21/27/28', () => {
  const b = (score) => B.dassBand('depression', score).code;
  assert.equal(b(0), 'normal'); assert.equal(b(9), 'normal'); assert.equal(b(10), 'mild'); assert.equal(b(13), 'mild');
  assert.equal(b(14), 'moderate'); assert.equal(b(20), 'moderate'); assert.equal(b(21), 'severe'); assert.equal(b(27), 'severe');
  assert.equal(b(28), 'extreme'); assert.equal(b(42), 'extreme');
});

test('DASS-21 anxiety bands 7/8/9/10/14/15/19/20', () => {
  const b = (score) => B.dassBand('anxiety', score).code;
  assert.equal(b(7), 'normal'); assert.equal(b(8), 'mild'); assert.equal(b(9), 'mild'); assert.equal(b(10), 'moderate');
  assert.equal(b(14), 'moderate'); assert.equal(b(15), 'severe'); assert.equal(b(19), 'severe'); assert.equal(b(20), 'extreme');
});

test('DASS-21 stress bands 14/15/18/19/25/26/33/34', () => {
  const b = (score) => B.dassBand('stress', score).code;
  assert.equal(b(14), 'normal'); assert.equal(b(15), 'mild'); assert.equal(b(18), 'mild'); assert.equal(b(19), 'moderate');
  assert.equal(b(25), 'moderate'); assert.equal(b(26), 'severe'); assert.equal(b(33), 'severe'); assert.equal(b(34), 'extreme');
});

test('DASS-21 bands via scoring (odd raw → even scores at the edges)', () => {
  const r = B.scoreDass(dass(5, 4, 7));
  assert.equal(band(r, 'depression'), 'mild'); // 10
  assert.equal(band(r, 'anxiety'), 'mild'); // 8
  assert.equal(band(r, 'stress'), 'normal'); // 14
});

test('DASS-21 incomplete subscale → null score and «нет данных», never NaN', () => {
  const a = dass(9, 6, 12);
  a[2] = null; // пункт 3 — депрессия
  const r = B.scoreDass(a);
  assert.equal(r.complete, false);
  assert.equal(r.subscales.depression.score, null);
  assert.equal(r.subscales.depression.band, null);
  assert.equal(r.subscales.depression.label, 'нет данных');
  assert.equal(r.subscales.anxiety.score, 12);
  for (const x of [undefined, null, [], 'x', {}]) {
    const e = B.scoreDass(x);
    assert.equal(e.complete, false);
    for (const k of ['depression', 'anxiety', 'stress']) { assert.equal(e.subscales[k].score, null); assert.ok(!Number.isNaN(e.subscales[k].score)); }
  }
});

test('DASS-21 rejects out-of-range answers', () => {
  const a = dass(0, 0, 0); a[0] = 4;
  assert.throws(() => B.scoreDass(a));
  a[0] = 1.5;
  assert.throws(() => B.scoreDass(a));
});

test('TIPI-10 data: 10 items, 7 options 1–7, reverse items 2,4,6,8,10', () => {
  const d = KK.data.scales.tipi10;
  assert.equal(d.items.length, 10);
  assert.deepEqual(d.options.map((o) => o.v), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(d.reverse, [2, 4, 6, 8, 10]);
  assert.equal(Object.keys(d.traits).length, 5);
});

test('TIPI-10 traits: mean of direct and reversed item (8 − x)', () => {
  // 1 Э, 2 Д(обр), 3 Доб, 4 ЭС(обр), 5 О, 6 Э(обр), 7 Д, 8 Доб(обр), 9 ЭС, 10 О(обр)
  const r = B.scoreTipi([7, 1, 5, 7, 6, 1, 7, 3, 1, 2]);
  assert.equal(r.complete, true);
  assert.equal(r.traits.extraversion.score, 7); // (7 + (8-1)) / 2
  assert.equal(r.traits.agreeableness.score, 7); // ((8-1) + 7) / 2
  assert.equal(r.traits.conscientiousness.score, 5); // (5 + (8-3)) / 2
  assert.equal(r.traits.stability.score, 1); // ((8-7) + 1) / 2
  assert.equal(r.traits.openness.score, 6); // (6 + (8-2)) / 2
  assert.equal(B.scoreTipi([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]).traits.openness.score, 4);
  assert.equal(B.scoreTipi([1, 7, 2, 6, 3, 5, 4, 4, 5, 3]).traits.extraversion.score, 2); // (1 + (8-5))/2
  assert.equal(B.scoreTipi([1, 7, 2, 6, 3, 5, 4, 4, 5, 3]).traits.agreeableness.score, 2.5); // ((8-7)+4)/2
});

test('TIPI-10 missing item → trait «нет данных»; out of range throws', () => {
  const r = B.scoreTipi([7, 1, 5, 7, null, 1, 7, 3, 1, 2]);
  assert.equal(r.complete, false);
  assert.equal(r.traits.openness.score, null);
  assert.equal(r.traits.openness.label, 'нет данных');
  assert.equal(r.traits.extraversion.score, 7);
  assert.equal(B.scoreTipi(undefined).traits.stability.score, null);
  assert.throws(() => B.scoreTipi([0, 1, 1, 1, 1, 1, 1, 1, 1, 1]));
  assert.throws(() => B.scoreTipi([8, 1, 1, 1, 1, 1, 1, 1, 1, 1]));
});

test('CTO data: 8 Lüscher colors with names and hex, 8 concepts', () => {
  const c = KK.data.cto;
  assert.equal(c.colors.length, 8);
  assert.equal(new Set(c.colors.map((x) => x.id)).size, 8);
  c.colors.forEach((x) => { assert.match(x.hex, /^#[0-9A-F]{6}$/i); assert.ok(x.name); });
  assert.deepEqual(c.concepts.map((x) => x.label), ['Я', 'Я в будущем', 'Мама', 'Папа', 'Близкий человек', 'Работа/учёба', 'Моя болезнь/проблема', 'Врач/лечение']);
});

test('spearman: identical = 1, reversed = −1, invalid = null', () => {
  const ids = KK.data.cto.colors.map((c) => c.id);
  assert.equal(B.spearman(ids, ids), 1);
  assert.equal(B.spearman(ids, [...ids].reverse()), -1);
  assert.equal(B.spearman(ids, ids.slice(0, 7)), null);
  assert.equal(B.spearman(ids, [...ids.slice(0, 7), ids[0]]), null);
  assert.equal(B.spearman(null, ids), null);
  // одна перестановка соседей: 1 − 6·2/(8·63) = 1 − 12/504
  const sw = [...ids]; [sw[0], sw[1]] = [sw[1], sw[0]];
  assert.ok(Math.abs(B.spearman(ids, sw) - (1 - 12 / 504)) < 1e-9);
});

test('ctoSimilarity: pairs sorted by rho, includes preference, skips incomplete, neutral wording', () => {
  const ids = KK.data.cto.colors.map((c) => c.id);
  const rev = [...ids].reverse();
  const r = B.ctoSimilarity({ concepts: { self: ids, mother: ids, illness: rev, father: ids.slice(0, 3) }, preference: ids });
  assert.equal(r.pairs[0].rho, 1);
  assert.ok(r.pairs.some((p) => p.a === 'self' && p.b === 'mother' && p.rho === 1));
  assert.ok(r.pairs.some((p) => (p.a === 'preference' || p.b === 'preference')));
  assert.ok(!r.pairs.some((p) => p.a === 'father' || p.b === 'father'));
  assert.equal(r.pairs.at(-1).rho, -1);
  assert.match(r.note, /не интерпретация/);
  r.pairs.forEach((p) => { assert.doesNotMatch(p.text, /депресс|тревож|конфликт|отверж|агресс/i); assert.ok(!Number.isNaN(p.rho)); });
  assert.ok(r.close.every((p) => p.rho >= 0.6));
  assert.deepEqual(B.ctoSimilarity(null).pairs, []);
  assert.deepEqual(B.ctoSimilarity({ skipped: true }).pairs, []);
});

const NO = { complaint: 'Устаю, плохо сплю', reason: 'Посоветовал терапевт', priorPsychiatrist: false, meds: false, psychotic: false, mania: false };
const cs = (answers) => KK.scales.score('cssrs', answers);
const CS_NONE = [0, 0, null, null, null, 0];
const intake = (over = {}) => Object.assign({ form: NO, cssrs: cs(CS_NONE), dass: dass(0, 0, 0) }, over);

test('routeIntake: all normal → observation', () => {
  const r = B.routeIntake(intake());
  assert.equal(r.level, 'observation');
  assert.ok(r.reasons.length >= 1);
  r.reasons.forEach((x) => { assert.equal(x.teamRule, true); assert.ok(x.source); assert.match(x.note, /до экспертной проверки/); });
});

test('routeIntake: mild → consultation (D 10–13, A 8–9, S 15–18)', () => {
  assert.equal(B.routeIntake(intake({ dass: dass(5, 0, 0) })).level, 'consultation');
  assert.equal(B.routeIntake(intake({ dass: dass(0, 4, 0) })).level, 'consultation');
  assert.equal(B.routeIntake(intake({ dass: dass(0, 0, 8) })).level, 'consultation');
  assert.equal(B.routeIntake(intake({ dass: dass(0, 3, 7) })).level, 'observation'); // Т 6, С 14
});

test('routeIntake: moderate or stress ≥ 26 → psychotherapy desirable', () => {
  assert.equal(B.routeIntake(intake({ dass: dass(7, 0, 0) })).level, 'psychotherapy_desirable'); // Д 14
  assert.equal(B.routeIntake(intake({ dass: dass(10, 0, 0) })).level, 'psychotherapy_desirable'); // Д 20
  assert.equal(B.routeIntake(intake({ dass: dass(0, 5, 0) })).level, 'psychotherapy_desirable'); // Т 10
  assert.equal(B.routeIntake(intake({ dass: dass(0, 0, 13) })).level, 'psychotherapy_desirable'); // С 26
  assert.equal(B.routeIntake(intake({ dass: dass(0, 0, 21) })).level, 'psychotherapy_desirable'); // С 42 — стресс не ведёт к психиатру
  assert.equal(B.routeIntake(intake({ dass: dass(9, 6, 12) })).level, 'psychotherapy_desirable'); // Илья
});

test('routeIntake: psychiatrist required — DASS D ≥ 21, A ≥ 15, C-SSRS moderate/high, psychotic/manic signs', () => {
  assert.equal(B.routeIntake(intake({ dass: dass(10, 0, 0) })).level, 'psychotherapy_desirable');
  assert.equal(B.routeIntake(intake({ dass: dass(11, 0, 0) })).level, 'psychiatrist_required'); // Д 22 (≥ 21)
  assert.equal(B.routeIntake(intake({ dass: dass(0, 7, 0) })).level, 'psychotherapy_desirable'); // Т 14
  assert.equal(B.routeIntake(intake({ dass: dass(0, 8, 0) })).level, 'psychiatrist_required'); // Т 16
  assert.equal(B.routeIntake(intake({ cssrs: cs([1, 1, 1, 0, 0, 0]) })).level, 'psychiatrist_required');
  assert.equal(B.routeIntake(intake({ cssrs: cs([1, 1, 1, 1, 0, 0]) })).level, 'psychiatrist_required');
  assert.equal(B.routeIntake(intake({ cssrs: cs([1, 0, null, null, null, 0]) })).level, 'observation'); // низкий риск сам по себе
  assert.equal(B.routeIntake(intake({ form: Object.assign({}, NO, { psychotic: true }) })).level, 'psychiatrist_required');
  assert.equal(B.routeIntake(intake({ form: Object.assign({}, NO, { mania: true }) })).level, 'psychiatrist_required');
});

test('routeIntake: highest level wins and all reasons are listed with sources', () => {
  const r = B.routeIntake(intake({ dass: dass(5, 5, 13), cssrs: cs([1, 1, 1, 0, 0, 0]) }));
  assert.equal(r.level, 'psychiatrist_required');
  const levels = new Set(r.reasons.map((x) => x.level));
  assert.ok(levels.has('psychiatrist_required') && levels.has('psychotherapy_desirable') && levels.has('consultation'));
  assert.ok(r.reasons.some((x) => /C-SSRS/.test(x.text) && /Posner/.test(x.source)));
  assert.ok(r.reasons.some((x) => /Lovibond/.test(x.source)));
  assert.equal(r.critical, true);
  assert.equal(B.routeIntake(intake()).critical, false);
});

test('routeIntake: missing parts → «нет данных», level null when nothing triggers', () => {
  const r = B.routeIntake({ form: null, cssrs: null, dass: null });
  assert.equal(r.level, null);
  assert.ok(r.missing.includes('dass21') && r.missing.includes('cssrs') && r.missing.includes('form'));
  const r2 = B.routeIntake({ form: Object.assign({}, NO, { psychotic: true }), cssrs: null, dass: null });
  assert.equal(r2.level, 'psychiatrist_required');
  const r3 = B.routeIntake({ form: NO, cssrs: cs(CS_NONE), dass: dass(9, 6, 12).map((v, i) => (i === 0 ? null : v)) });
  // стресс неполный, Д и Т умеренные — уровень всё равно определяется
  assert.equal(r3.level, 'psychotherapy_desirable');
  assert.ok(r3.missing.includes('dass21'));
  assert.doesNotThrow(() => B.routeIntake(undefined));
  assert.equal(B.routeIntake(undefined).level, null);
});

test('routeIntake: discrepancies are questions, not conclusions', () => {
  const fine = Object.assign({}, NO, { complaint: 'В целом всё в порядке, просто устаю' });
  const r1 = B.routeIntake(intake({ form: fine, dass: dass(9, 6, 12) }));
  assert.ok(r1.discrepancies.some((d) => d.id === 'dass_high_form_fine'));
  const r2 = B.routeIntake(intake({ cssrs: cs([1, 0, null, null, null, 0]) }));
  assert.ok(r2.discrepancies.some((d) => d.id === 'dass_low_cssrs_positive'));
  const r3 = B.routeIntake(intake({ dass: dass(0, 0, 10) }));
  assert.ok(r3.discrepancies.some((d) => d.id === 'stress_only'));
  assert.deepEqual(B.routeIntake(intake()).discrepancies, []);
  for (const d of [...r1.discrepancies, ...r2.discrepancies, ...r3.discrepancies]) assert.match(d.text, /\?$/);
});

test('levelLabel: legal wording — направление на консультацию, no diagnosis', () => {
  for (const l of ['psychiatrist_required', 'psychotherapy_desirable', 'consultation', 'observation']) {
    assert.ok(B.levelLabel(l));
    assert.doesNotMatch(B.levelLabel(l), /диагноз/i);
  }
  assert.match(B.levelLabel('psychiatrist_required'), /психиатр/i);
  assert.equal(B.levelLabel(null), 'нет данных');
});
