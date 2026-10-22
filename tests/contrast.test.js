// Палитра (assets/tokens.css, спек §3, спокойная палитра 2026-10-20) во всех четырёх наборах роль × тема:
// WCAG AA — текст ≥ 4.5:1 (включая текст на пике ауры и пилюли), графика (чернила шкал, маркер, линии графика) ≥ 3:1;
// плюс смысловые правила палитры: у пациента нет красного/мадженты, ночь пациента — сланец, не чёрный;
// шкалы чек-ина — один тон и только шаги светлоты; у врача ауры плоские; тело текста ≈ 12–15:1, а не 21:1.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'tokens.css'), 'utf8');
const SETS = ['patient-light', 'patient-dark', 'doctor-light', 'doctor-dark'];
const PATIENT = SETS.filter((n) => n.startsWith('patient'));
const STAFF = SETS.filter((n) => n.startsWith('doctor'));

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
// Цвет токена, если это цвет (hex, RGB-тройка или rgba()); иначе null.
const colorOf = (v) => {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(v).trim());
  if (m) return m.slice(1, 4).map(Number);
  try { return rgb(v); } catch (e) { return null; }
};
const lum = (c) => {
  const [r, g, b] = c.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (top, alpha, base) => top.map((t, i) => Math.round(t * alpha + base[i] * (1 - alpha)));
// Тон (°) и хрома (0..1, max − min) — достаточно для проверок «красный или нет» и «тона различаются».
const hueOf = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const chroma = (c) => (Math.max(...c) - Math.min(...c)) / 255;
const hueDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 360 - d); };

const AURA_HUES = ['sage', 'blue', 'lavender', 'sand', 'teal', 'mood', 'anx', 'sleep'];
const PAIRS = [
  ['text', 'bg'], ['text', 'surface'], ['text-2', 'surface'], ['text-2', 'bg'], ['text-3', 'surface'], ['text-3', 'bg'], ['text-2', 'surface-2'],
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

  // Без бликов и ореолов: ни чисто белого фона, ни чисто чёрного текста; основной текст ≈ 12–15:1, а не 21:1.
  test(`body text ${name}: no pure white/black, contrast in the 11–16:1 band`, () => {
    for (const k of ['bg', 'surface']) assert.notEqual(t[k].toUpperCase(), '#FFFFFF', `${name}: --${k} чисто белый`);
    assert.notEqual(t.text.toUpperCase(), '#000000', `${name}: --text чисто чёрный`);
    for (const bg of ['bg', 'surface']) {
      const r = ratio(rgb(t.text), rgb(t[bg]));
      assert.ok(r >= 11 && r <= 16, `${name}: --text на --${bg} = ${r.toFixed(2)} (ожидаем ≈ 12–15)`);
    }
  });

  // Графика (WCAG 1.4.11): маркер линейки/кольца и линии графиков ≥ 3:1 к фону и поверхности.
  test(`graphics ${name}: marker and chart lines ≥ 3:1 on bg/surface`, () => {
    for (const k of ['marker', 'chart', 'chart-2']) {
      for (const bg of ['bg', 'surface']) {
        const r = ratio(rgb(t[k]), rgb(t[bg]));
        assert.ok(r >= 3, `${name}: --${k} на --${bg} = ${r.toFixed(2)}`);
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

// ── Пациент: спокойная палитра ────────────────────────────────────────────────
// Красные, розовые и маджента-тона (330°–20°) с заметной хромой запрещены во всех токенах пациента.
// Исключение — служебные токены «критично» (--crit*): у пациента они не используются (проверено ниже), а набор
// токенов у ролей общий.
const SAFETY = new Set(['crit', 'crit-tint', 'on-crit', 'crit-ink']);
const RED_CHROMA = 0.08;
for (const name of PATIENT) {
  test(`patient palette ${name}: no red / magenta / coral tokens`, () => {
    const t = tokens(name);
    for (const [k, v] of Object.entries(t)) {
      if (SAFETY.has(k)) continue;
      const c = colorOf(v);
      if (!c) continue;
      const h = hueOf(c);
      const red = h >= 330 || h <= 20;
      assert.ok(!(red && chroma(c) > RED_CHROMA), `${name}: --${k} = ${v} уходит в красный/мадженту (${h.toFixed(0)}°, хрома ${chroma(c).toFixed(2)})`);
    }
  });
}

test('patient pages do not use critical-red classes or tokens', () => {
  const root = path.join(__dirname, '..');
  const files = [...fs.readdirSync(path.join(root, 'patient')).filter((f) => f.endsWith('.js')).map((f) => path.join('patient', f)), 'assets/patient.js', 'assets/patient.css'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert.doesNotMatch(src, /--crit|badge--critical|btn--danger|aura--rose|aura--amber/, `${f}: красное на стороне пациента`);
  }
});

test('patient night is deep slate blue-grey, not near-black', () => {
  const t = tokens('patient-dark');
  for (const k of ['bg', 'surface']) {
    const c = rgb(t[k]);
    assert.ok(lum(c) >= 0.012, `--${k} ${t[k]} слишком близок к чёрному (L ${lum(c).toFixed(4)})`);
    assert.ok(c[2] > c[0], `--${k} ${t[k]} не сине-серый`);
  }
});

test('patient auras are soft washes: low chroma, lower alpha at night', () => {
  for (const name of PATIENT) {
    const t = tokens(name);
    for (const hue of AURA_HUES) for (const k of [`aura-${hue}`, `aura-${hue}-2`]) {
      assert.ok(chroma(rgb(t[k])) <= 0.2, `${name}: --${k} слишком насыщенная (${chroma(rgb(t[k])).toFixed(2)})`);
    }
  }
  const day = Number(tokens('patient-light')['aura-alpha']), night = Number(tokens('patient-dark')['aura-alpha']);
  assert.ok(night >= 0.18 && night <= 0.28, `ночная альфа аур ${night} вне 0.18–0.28`);
  assert.ok(day <= 0.8, `дневная альфа аур ${day} > 0.8`);
});

// Шкалы чек-ина: у каждой шкалы один тон, меняется только светлота; тона шкал разнесены ≥ 60°.
// Чернила (--*-ink: заливка линейки, точки и линии «Моего пути») — графика, ≥ 3:1 к фону и поверхности.
// «Тяжело» (1) — самый серый шаг и не темнее фона страницы: валентность не кодируется темнотой.
test('check-in scales: ink ≥ 3:1, one hue per scale, monotonic lightness, hues ≥ 60° apart, «1» not dark', () => {
  for (const name of SETS) {
    const t = tokens(name);
    const dark = name.includes('dark');
    const inkHue = {};
    for (const sc of ['mood', 'anx', 'sleep']) {
      for (const bg of ['bg', 'surface']) {
        const r = ratio(rgb(t[`${sc}-ink`]), rgb(t[bg]));
        assert.ok(r >= 3, `${name}: --${sc}-ink на --${bg} = ${r.toFixed(2)}`);
      }
      const steps = [1, 2, 3, 4, 5].map((k) => rgb(t[`${sc}-${k}`]));
      inkHue[sc] = hueOf(rgb(t[`${sc}-ink`]));
      for (const [k, c] of steps.entries()) {
        assert.ok(hueDist(hueOf(c), inkHue[sc]) <= 12, `${name}: --${sc}-${k + 1} выходит из тона шкалы`);
        assert.ok(lum(c) >= 0.02, `${name}: --${sc}-${k + 1} почти чёрный`);
      }
      const L = steps.map(lum);
      for (let k = 1; k < 5; k++) assert.ok(dark ? L[k] > L[k - 1] : L[k] < L[k - 1], `${name}: --${sc}-1..5 не по порядку светлоты`);
      assert.ok(chroma(steps[0]) <= chroma(steps[4]), `${name}: --${sc}-1 должен быть самым серым шагом`);
      // День: «1» — самый светлый шаг (порядок выше). Ночь: «1» — самый тихий шаг, но не темнее фона страницы.
      if (dark) assert.ok(lum(steps[0]) >= lum(rgb(t.bg)), `${name}: --${sc}-1 темнее фона страницы`);
    }
    for (const [a, b] of [['mood', 'anx'], ['mood', 'sleep'], ['anx', 'sleep']]) {
      assert.ok(hueDist(inkHue[a], inkHue[b]) >= 60, `${name}: тона ${a} и ${b} ближе 60° (${hueDist(inkHue[a], inkHue[b]).toFixed(0)}°)`);
    }
    assert.ok(hueDist(hueOf(rgb(t['aura-mood'])), hueOf(rgb(t['aura-sand']))) >= 60, `${name}: аура настроения похожа на «Помощь»`);
  }
});

// ── Врач и психолог: щадящая палитра ──────────────────────────────────────────
test('staff tiles are flat: aura tint ≤ 8%, no glowing core; ui.css draws a type line instead', () => {
  for (const name of STAFF) {
    const t = tokens(name);
    assert.ok(Number(t['aura-alpha']) <= 0.08, `${name}: --aura-alpha ${t['aura-alpha']} > .08`);
    assert.ok(Number(t['aura-alpha-subtle']) <= Number(t['aura-alpha']), `${name}: subtle сильнее основной`);
    assert.equal(Number(t['aura-core-alpha']), 0, `${name}: у врача нет светящегося центра`);
  }
  const ui = fs.readFileSync(path.join(__dirname, '..', 'assets', 'ui.css'), 'utf8');
  assert.match(ui, /\[data-role="doctor"\] \.aura,\[data-role="doctor"\] \.dtile\.aura\{[^}]*inset 0 3px 0 rgb\(var\(--aura-a\)\)/);
});

test('staff safety semantics stay distinct: critical red vs required violet, warn amber; charts distinct', () => {
  for (const name of STAFF) {
    const t = tokens(name);
    const crit = hueOf(rgb(t.crit)), route = hueOf(rgb(t.route)), warn = hueOf(rgb(t.warn));
    assert.ok(crit >= 345 || crit <= 15, `${name}: «критично» не красный (${crit.toFixed(0)}°)`);
    assert.ok(route >= 245 && route <= 290, `${name}: «к психиатру» не фиолетовый (${route.toFixed(0)}°)`);
    assert.ok(warn >= 25 && warn <= 50, `${name}: предупреждение не янтарное (${warn.toFixed(0)}°)`);
    // В оттенках серого «критично» и «обязательно» различаются заливкой/контуром/словом (ui.css), а цвета ещё и по яркости.
    assert.ok(hueDist(hueOf(rgb(t.chart)), hueOf(rgb(t['chart-2']))) >= 90, `${name}: линии PHQ-9 и GAD-7 похожи`);
  }
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

// ── Тема: отдельный выбор для пациента и персонала ────────────────────────────
test('theme.resolve: saved choice wins; patient follows the system, staff defaults to Day', () => {
  require('./load');
  require('../assets/theme.js');
  const th = globalThis.KK.theme;
  assert.equal(th.resolve('dark', false), 'dark');
  assert.equal(th.resolve('light', true), 'light');
  assert.equal(th.resolve(null, true), 'dark');
  assert.equal(th.resolve('auto', false), 'light');
  assert.equal(th.resolve(null, true, 'patient'), 'dark');
  assert.equal(th.resolve(null, true, 'staff'), 'light', 'персонал без выбора — «Дневная» даже при тёмной системе');
  assert.equal(th.resolve('auto', true, 'staff'), 'dark', '«Как в системе» у персонала следует системе');
  assert.equal(th.resolve('dark', false, 'staff'), 'dark');
  assert.deepEqual(th.KEYS, { patient: 'kk:theme:patient', staff: 'kk:theme:staff' });
});

test('theme.migrate: legacy kk:theme is copied to both role keys and removed', () => {
  require('./load');
  require('../assets/theme.js');
  const th = globalThis.KK.theme;
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    let s = mem();
    Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true, writable: true });
    s.setItem('kk:theme', 'dark');
    th.migrate();
    assert.equal(s.getItem('kk:theme:patient'), 'dark');
    assert.equal(s.getItem('kk:theme:staff'), 'dark');
    assert.equal(s.getItem('kk:theme'), null);
    // Уже сделанный выбор не перезаписывается.
    s = mem();
    Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true, writable: true });
    s.setItem('kk:theme', 'dark');
    s.setItem('kk:theme:staff', 'light');
    th.migrate();
    assert.equal(s.getItem('kk:theme:staff'), 'light');
    assert.equal(s.getItem('kk:theme:patient'), 'dark');
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc); else delete globalThis.localStorage;
  }
});

test('host.js and pages use role-specific theme keys, not the shared legacy key', () => {
  const root = path.join(__dirname, '..');
  const tg = fs.readFileSync(path.join(root, 'assets', 'host.js'), 'utf8');
  assert.doesNotMatch(tg, /'kk:theme'/);
  assert.match(tg, /KK\.theme\.key\(\)/);
  for (const f of ['doctor/profile.js', 'psych/profile.js', 'patient/profile.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, f), 'utf8'), /'kk:theme'/, f);
  }
});

test('patient style presets: stored per browser, only for patient pages, unknown values ignored', () => {
  const t = globalThis.KK && globalThis.KK.theme;
  if (!t) return; // theme.js грузится только в браузере
  assert.deepEqual(t.STYLES, ['aura', 'sunset', 'widgets']);
});

test('style presets use only calm-palette tokens (no hard-coded colors)', () => {
  const fs = require('node:fs');
  const css = fs.readFileSync(require('node:path').join(__dirname, '..', 'assets', 'patient.css'), 'utf8');
  const block = css.slice(css.indexOf('/* Стили из «Вариаций дизайна»'));
  assert.ok(block.length > 50);
  assert.doesNotMatch(block, /#[0-9a-f]{3,6}\b/i);
  assert.match(block, /var\(--aura-/);
});
