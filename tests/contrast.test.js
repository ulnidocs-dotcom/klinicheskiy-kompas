// WCAG AA (≥ 4.5:1) для текстовых токенов во всех четырёх наборах роль × тема из assets/tokens.css,
// включая текст на плитках с аурами (пик ауры, смешанный с --surface).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'tokens.css'), 'utf8');
const SETS = ['patient-light', 'patient-dark', 'doctor-light', 'doctor-dark'];

// Блок после маркера «@tokens <имя>»: первое тело правила { ... }.
function tokens(name) {
  const at = css.indexOf(`@tokens ${name} `) >= 0 ? css.indexOf(`@tokens ${name} `) : css.indexOf(`@tokens ${name}*`);
  assert.ok(at >= 0, `нет набора ${name}`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  const out = {};
  for (const m of css.slice(open + 1, close).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const rgb = (v) => {
  const s = String(v).trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^(\d+)\s+(\d+)\s+(\d+)$/.exec(s);
  if (m) return m.slice(1, 4).map(Number);
  throw new Error(`не цвет: ${v}`);
};
const lum = (c) => {
  const [r, g, b] = c.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (top, alpha, base) => top.map((t, i) => Math.round(t * alpha + base[i] * (1 - alpha)));

const AURA_HUES = ['rose', 'sage', 'blue', 'amber', 'lilac', 'mood', 'anx', 'sleep'];
const PAIRS = [
  ['text', 'bg'], ['text-2', 'surface'], ['text-3', 'surface'], ['text-3', 'bg'], ['text-2', 'surface-2'],
  ['on-accent', 'accent'], ['on-crit', 'crit'], ['on-route', 'route'],
  ['accent-strong', 'accent-tint'], ['help', 'help-tint'], ['help', 'surface'],
  ['crit-ink', 'crit-tint'], ['crit-ink', 'surface'], ['route-ink', 'surface'], ['route-ink', 'route-tint'],
  ['warn', 'warn-tint'], ['ok', 'ok-tint'],
];

for (const name of SETS) {
  const t = tokens(name);
  test(`contrast ${name}: text tokens on their surfaces ≥ 4.5`, () => {
    for (const [fg, bg] of PAIRS) {
      assert.ok(t[fg] && t[bg], `${name}: нет --${fg} или --${bg}`);
      const r = ratio(rgb(t[fg]), rgb(t[bg]));
      assert.ok(r >= 4.5, `${name}: --${fg} на --${bg} = ${r.toFixed(2)}`);
    }
  });

  test(`contrast ${name}: text on aura tiles at peak alpha ≥ 4.5`, () => {
    const alpha = Number(t['aura-alpha']);
    assert.ok(alpha > 0 && alpha <= 1);
    for (const hue of AURA_HUES) {
      for (const key of [`aura-${hue}`, `aura-${hue}-2`]) {
        const bg = mix(rgb(t[key]), alpha, rgb(t.surface));
        // Внутри .aura вторичный/третичный текст переопределён на --on-aura-2 (ui.css).
        for (const fg of ['text', 'on-aura-2']) {
          const r = ratio(rgb(t[fg]), bg);
          assert.ok(r >= 4.5, `${name}: --${fg} на --${key} (α ${alpha}) = ${r.toFixed(2)}`);
        }
      }
    }
  });
}

test('dark sets under prefers-color-scheme are exact copies of the explicit dark sets', () => {
  assert.deepEqual(tokens('patient-dark-auto'), tokens('patient-dark'));
  assert.deepEqual(tokens('doctor-dark-auto'), tokens('doctor-dark'));
  assert.match(css, /@media \(prefers-color-scheme: dark\)\s*\{[\s\S]*:root\[data-role="patient"\]:not\(\[data-theme="light"\]\)/);
});

test('every set defines the same token names', () => {
  const names = SETS.map((n) => Object.keys(tokens(n)).filter((k) => !['fs', 'band-warn', 'band-crit'].includes(k)).sort());
  for (const n of names.slice(1)) assert.deepEqual(n, names[0]);
});

test('theme.resolve: saved choice wins, otherwise system preference', () => {
  require('./load');
  require('../assets/theme.js');
  const th = globalThis.KK.theme;
  assert.equal(th.resolve('dark', false), 'dark');
  assert.equal(th.resolve('light', true), 'light');
  assert.equal(th.resolve(null, true), 'dark');
  assert.equal(th.resolve('auto', false), 'light');
});

test('ui.css maps secondary text to --on-aura-2 inside .aura', () => {
  const ui = fs.readFileSync(path.join(__dirname, '..', 'assets', 'ui.css'), 'utf8');
  assert.match(ui, /\.aura\{--text-2:var\(--on-aura-2\);--text-3:var\(--on-aura-2\)\}/);
});

test('pill buttons: --pill-text readable on --pill-bg over the page and over every aura peak', () => {
  for (const name of SETS) {
    const t = tokens(name);
    const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(t['pill-bg']);
    const over = (base) => (m ? mix(m.slice(1, 4).map(Number), Number(m[4]), base) : rgb(t['pill-bg']));
    const bases = [rgb(t.bg), rgb(t.surface)];
    for (const hue of AURA_HUES) for (const k of [`aura-${hue}`, `aura-${hue}-2`]) bases.push(mix(rgb(t[k]), Number(t['aura-alpha']), rgb(t.surface)));
    for (const b of bases) {
      const r = ratio(rgb(t['pill-text']), over(b));
      assert.ok(r >= 4.5, `${name}: пилюля ${r.toFixed(2)}`);
    }
    assert.ok(ratio(rgb(t['pill-ink']), rgb(t['pill-dot'])) >= 4.5, `${name}: «+» в круге`);
  }
});

// Шкалы чек-ина: у каждой своя гамма. Линии графика, заливка линейки и точки «Моего пути» (--*-ink) — графические объекты:
// ≥ 3:1 к фону и поверхности (WCAG 1.4.11). Настроение и сон заметно различаются в обеих темах; настроение — коралл, не красный
// и не янтарь «Помощи».
test('check-in scale colors: ink ≥ 3:1 on bg/surface, ramps ordered, mood ≠ sleep, mood is coral (not red, not help amber)', () => {
  const hueOf = ([r, g, b]) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const dist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 360 - d); };
  for (const name of SETS) {
    const t = tokens(name);
    for (const sc of ['mood', 'anx', 'sleep']) {
      for (const bg of ['bg', 'surface']) {
        const r = ratio(rgb(t[`${sc}-ink`]), rgb(t[bg]));
        assert.ok(r >= 3, `${name}: --${sc}-ink на --${bg} = ${r.toFixed(2)}`);
      }
      const L = [1, 2, 3, 4, 5].map((k) => lum(rgb(t[`${sc}-${k}`])));
      const dark = name.includes('dark');
      for (let k = 1; k < 5; k++) assert.ok(dark ? L[k] > L[k - 1] : L[k] < L[k - 1], `${name}: --${sc}-1..5 не по порядку`);
    }
    assert.ok(dist(hueOf(rgb(t['mood-ink'])), hueOf(rgb(t['sleep-ink']))) >= 90, `${name}: настроение и сон слишком похожи`);
    assert.ok(dist(hueOf(rgb(t['anx-ink'])), hueOf(rgb(t['sleep-ink']))) >= 25, `${name}: беспокойство и сон слишком похожи`);
    const mh = hueOf(rgb(t['mood-ink']));
    assert.ok(mh >= 6 && mh <= 30, `${name}: настроение уходит в красный (${mh.toFixed(0)}°)`);
    assert.ok(dist(hueOf(rgb(t['aura-mood'])), hueOf(rgb(t['aura-amber']))) >= 12, `${name}: аура настроения похожа на «Помощь»`);
  }
});
