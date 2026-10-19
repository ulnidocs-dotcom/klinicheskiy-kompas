const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const { ui } = globalThis.KK;

test('esc escapes html', () => {
  assert.equal(ui.esc('<b a="1">&</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&lt;/b&gt;');
});
test('age ru', () => {
  assert.equal(ui.age(63), '63 года'); assert.equal(ui.age(41), '41 год'); assert.equal(ui.age(29), '29 лет'); assert.equal(ui.age(11), '11 лет');
});
test('plural ru', () => {
  const f = ['день', 'дня', 'дней'];
  assert.equal(ui.plural(1, f), 'день'); assert.equal(ui.plural(3, f), 'дня');
  assert.equal(ui.plural(11, f), 'дней'); assert.equal(ui.plural(22, f), 'дня'); assert.equal(ui.plural(25, f), 'дней');
});
test('fmtDate in Russian', () => {
  assert.match(ui.fmtDate('2026-10-19T09:00:00Z'), /19 октября/);
});
test('sparkline svg with one point per value', () => {
  const svg = ui.sparkline([10, 8, 6], { w: 120, h: 40, max: 21 });
  assert.match(svg, /^<svg/);
  assert.equal(svg.match(/<circle/g).length, 3);
});
test('lineChart handles empty series', () => {
  assert.match(ui.lineChart([], { max: 27 }), /Нет данных/);
});
test('lineChart ticks:false hides numeric axis', () => {
  const s = [{ label: 'Настроение', color: '#000', points: [{ at: '2026-10-01T09:00:00Z', v: 2 }, { at: '2026-10-10T09:00:00Z', v: 4 }] }];
  assert.match(ui.lineChart(s, { max: 5 }), /text-anchor="end" font-size="11" fill="var\(--text-3\)">5</);
  assert.doesNotMatch(ui.lineChart(s, { max: 5, ticks: false }), />5<\/text>/);
});
test('icon returns svg or empty for unknown', () => {
  assert.match(ui.icon('home'), /^<svg/);
  assert.equal(ui.icon('nope'), '');
});
