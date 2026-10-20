const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const T = KK.tiles;

test('frac clamps to 0..1 and returns null without a value', () => {
  assert.equal(T.frac(5, 10), 0.5);
  assert.equal(T.frac(-3, 10), 0);
  assert.equal(T.frac(40, 27), 1);
  for (const v of [null, undefined, NaN, '7', Infinity]) assert.equal(T.frac(v, 10), null, String(v));
  assert.equal(T.frac(5, 0), null);
});

test('ringArc is proportional to value/max and clamped', () => {
  const c = 2 * Math.PI * 40;
  assert.ok(Math.abs(T.ringArc(27, 27) - c) < 1e-9);
  assert.ok(Math.abs(T.ringArc(7, 14) - c / 2) < 1e-9);
  assert.equal(T.ringArc(-1, 14), 0);
  assert.ok(Math.abs(T.ringArc(99, 14) - c) < 1e-9);
  assert.equal(T.ringArc(null, 14), 0);
});

test('ringGauge: arc dasharray matches ringArc; empty value → calm dash, no arc, no NaN', () => {
  const html = T.ringGauge({ value: 7, max: 14, label: 'Дни' });
  assert.match(html, new RegExp(`stroke-dasharray="${T.ringArc(7, 14).toFixed(2)} `));
  assert.match(html, /aria-label="Дни: 7 из 14"/);
  const empty = T.ringGauge({ value: null, max: 27, label: 'PHQ-9' });
  assert.doesNotMatch(empty, /ring__arc|NaN|undefined/);
  assert.match(empty, />—</);
  assert.match(empty, /нет данных/);
});

test('rangeBar: marker at value/max, clamped; no marker without a value', () => {
  assert.match(T.rangeBar({ value: 21, max: 21 }), /left:100\.0%/);
  assert.match(T.rangeBar({ value: 0, max: 21 }), /left:0\.0%/);
  assert.match(T.rangeBar({ value: 50, max: 21 }), /left:100\.0%/);
  assert.match(T.rangeBar({ value: 7, max: 14 }), /left:50\.0%/);
  const none = T.rangeBar({ value: null, max: 21, bands: [{ from: 0, to: 4 }, { from: 5, to: 21 }] });
  assert.doesNotMatch(none, /rbar__m|NaN/);
  assert.equal((none.match(/<i /g) || []).length, 2);
});

test('dotLayout: spacing grows with change between neighbours; stays in 0..100', () => {
  const flat = T.dotLayout([3, 3, 3]);
  assert.deepEqual(flat.map((d) => d.left), [0, 50, 100]);
  const jump = T.dotLayout([3, 3, 5]);
  assert.ok(jump[2].left - jump[1].left > jump[1].left - jump[0].left);
  assert.ok(jump.every((d) => d.left >= 0 && d.left <= 100));
  assert.ok(T.dotLayout([5])[0].opacity > T.dotLayout([1])[0].opacity);
  assert.deepEqual(T.dotLayout([null, undefined, NaN]), []);
  assert.match(T.dotRow([]), /drow--empty[^>]*>—</);
  assert.doesNotMatch(T.dotRow([2, null, 4]), /NaN/);
});

test('sd: population standard deviation; null for fewer than two numbers', () => {
  assert.equal(T.sd([2, 4, 4, 4, 5, 5, 7, 9]), 2);
  assert.equal(T.sd([3]), null);
  assert.equal(T.sd([]), null);
  assert.equal(T.sd([3, 3, 3]), 0);
});

test('tile escapes every text field and shows «—» (without unit) for empty values', () => {
  const html = T.tile({ aura: 'rose', label: '<b>x</b>', value: '<i>', unit: '"u"', note: "a'b", side: '&' });
  assert.doesNotMatch(html, /<b>x|<i>|"u"|a'b/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /&amp;/);
  for (const v of [null, undefined, '', NaN]) {
    const t = T.tile({ label: 'L', value: v, unit: 'из 27' });
    assert.match(t, /dtile__v">—<\/span>/, String(v));
    assert.doesNotMatch(t, /из 27|NaN|undefined/);
  }
  assert.match(T.tile({ value: 0, unit: '%' }), />0<small>%<\/small>/);
});

test('tile: unknown aura falls back to sage; href renders a link; wide modifier', () => {
  assert.match(T.tile({ aura: 'red" onclick="x', value: 1 }), /class="dtile aura aura--sage"/);
  assert.match(T.tile({ value: 'Дыхание', href: 'material.html?id=breathing' }), /^<a class="dtile[^"]*" href="material\.html\?id=breathing">/);
  assert.match(T.tile({ wide: true, value: 1, visual: '<div class="ring"></div>' }), /dtile--wide.*dtile__vis"><div class="ring">/);
  assert.match(T.tile({ value: 'ровнее' }), /dtile__v--word/);
  assert.doesNotMatch(T.tile({ value: '6.8' }), /dtile__v--word/);
});

test('tileGrid drops empty entries and wraps tiles', () => {
  const html = T.tileGrid([{ label: 'A', value: 1 }, null, false, { label: 'B', value: 2 }], { label: 'Сводка' });
  assert.match(html, /^<section class="dtiles" aria-label="Сводка"><div class="dtiles__g">/);
  assert.equal((html.match(/class="dtile /g) || []).length, 2);
  assert.equal(T.tileGrid([]), '');
});
