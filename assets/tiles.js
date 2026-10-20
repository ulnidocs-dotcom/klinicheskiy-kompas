// Плитки данных по референсу veri (docs/reference-veri-tiles.jpg): широкая плитка с кольцом + сетка 2×2/3×N.
// Чистые функции, возвращают HTML-строки; весь текст — через KK.ui.esc. Цвет ауры задаётся типом плитки, а не тяжестью:
// срочность остаётся за бейджами и сигналами.
(function (g) {
  const KK = g.KK;
  const esc = (t) => KK.ui.esc(t);
  const DASH = '—';
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const isEmpty = (v) => v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v));
  const r1 = (x) => Math.round(x * 10) / 10;
  const AURAS = ['sage', 'blue', 'lavender', 'sand', 'teal', 'mood', 'anx', 'sleep'];

  const tiles = {
    DASH,
    // Доля value/max, ограниченная 0..1; null — если значения нет.
    frac(value, max) {
      const v = num(value), m = num(max);
      if (v == null || m == null || m <= 0) return null;
      return Math.min(1, Math.max(0, v / m));
    },
    // Длина дуги кольца радиуса r для value/max (0, если значения нет).
    ringArc(value, max, r = 40) {
      return (tiles.frac(value, max) ?? 0) * 2 * Math.PI * r;
    },
    // Стандартное отклонение (генеральное); null, если чисел меньше двух.
    sd(values) {
      const xs = (values || []).map(num).filter((x) => x != null);
      if (xs.length < 2) return null;
      const m = xs.reduce((s, x) => s + x, 0) / xs.length;
      return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
    },

    ringGauge({ value, max, label = '' } = {}) {
      const r = 40, c = 2 * Math.PI * r;
      const arc = tiles.ringArc(value, max, r);
      const has = !isEmpty(value);
      const aria = has ? `${label ? label + ': ' : ''}${value} из ${max}` : `${label ? label + ': ' : ''}нет данных`;
      return `<div class="ring" role="img" aria-label="${esc(aria)}">`
        + `<svg viewBox="0 0 96 96" aria-hidden="true"><circle class="ring__track" cx="48" cy="48" r="${r}"/>`
        + (arc > 0 ? `<circle class="ring__arc" cx="48" cy="48" r="${r}" stroke-dasharray="${arc.toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 48 48)"/>` : '')
        + `</svg><span class="num ring__n" aria-hidden="true">${has ? esc(value) : DASH}</span></div>`;
    },

    // Тонкая полоса с жёлтым треугольником-маркером. bands: [{ from, to }] — деления (монохромные, без «светофора»).
    rangeBar({ value, max, bands = [] } = {}) {
      const f = tiles.frac(value, max);
      const segs = bands.length ? bands.map((b, i) => {
        const w = tiles.frac(Math.min(b.to + 1, max) - b.from, max) ?? 0;
        return `<i style="flex:${(w * 100).toFixed(2)};--k:${((i + 1) / bands.length).toFixed(2)}"></i>`;
      }).join('') : '<i style="flex:1;--k:.6"></i>';
      return `<div class="rbar" aria-hidden="true"><div class="rbar__track">${segs}</div>`
        + (f == null ? '' : `<b class="rbar__m" style="left:${(f * 100).toFixed(1)}%"></b>`) + '</div>';
    },

    // Ряд точек: расстояние между соседними — больше при большей разнице значений, прозрачность — от значения.
    // Позиции точек в процентах ширины (0..100): [{ left, opacity }].
    dotLayout(values, { max = 5 } = {}) {
      const xs = (values || []).map(num).filter((x) => x != null);
      if (!xs.length) return [];
      if (xs.length === 1) return [{ left: 50, opacity: 0.35 + 0.65 * (tiles.frac(xs[0], max) ?? 0) }];
      const gaps = xs.slice(1).map((x, i) => 1 + 2 * Math.abs(x - xs[i]));
      const total = gaps.reduce((s, x) => s + x, 0);
      let x = 0;
      return xs.map((v, i) => {
        if (i > 0) x += (gaps[i - 1] / total) * 100;
        return { left: r1(Math.min(100, x)), opacity: 0.35 + 0.65 * (tiles.frac(v, max) ?? 0) };
      });
    },
    dotRow(values, opts = {}) {
      const dots = tiles.dotLayout(values, opts);
      if (!dots.length) return `<div class="drow drow--empty" aria-hidden="true">${DASH}</div>`;
      return `<div class="drow" aria-hidden="true">${dots.map((d) => `<i style="left:${d.left}%;opacity:${d.opacity.toFixed(2)}"></i>`).join('')}</div>`;
    },

    miniSpark(values, { max = 5, w = 120, h = 28 } = {}) {
      const xs = (values || []).map(num).filter((x) => x != null);
      if (xs.length < 2) return '';
      const step = (w - 4) / (xs.length - 1);
      const pts = xs.map((v, i) => `${r1(2 + i * step)},${r1(h - 2 - (tiles.frac(v, max) ?? 0) * (h - 4))}`).join(' ');
      return `<svg class="mspark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
    },

    // { aura, label, value, unit, note, side, visual (HTML от функций выше), wide, href, sr }
    tile({ aura = 'sage', label = '', value, unit = '', note = '', side = '', visual = '', wide = false, href = '', sr = '' } = {}) {
      const a = AURAS.includes(aura) ? aura : 'sage';
      const empty = isEmpty(value);
      const tag = href ? 'a' : 'article';
      const word = !empty && typeof value === 'string' && !/^[\d\s.,%−-]+$/.test(value);
      const v = `<span class="dtile__v${word ? ' dtile__v--word' : ''}">${empty ? DASH : esc(value)}${!empty && unit ? `<small>${esc(unit)}</small>` : ''}</span>`;
      const foot = `<div class="dtile__foot">${v}${side ? `<span class="dtile__side">${esc(side)}</span>` : ''}</div>`;
      const body = wide
        ? `<div class="dtile__main"><span class="dtile__l">${esc(label)}</span>${foot}${note ? `<span class="dtile__note">${esc(note)}</span>` : ''}</div>${visual ? `<div class="dtile__vis">${visual}</div>` : ''}`
        : `<span class="dtile__l">${esc(label)}</span>${visual ? `<div class="dtile__vis">${visual}</div>` : ''}${foot}${note ? `<span class="dtile__note">${esc(note)}</span>` : ''}`;
      return `<${tag} class="dtile aura aura--${a}${wide ? ' dtile--wide' : ''}"${href ? ` href="${esc(href)}"` : ''}>${body}${sr ? `<span class="sr-only">${esc(sr)}</span>` : ''}</${tag}>`;
    },

    tileGrid(list, { label = 'Сводка' } = {}) {
      const items = (list || []).filter(Boolean);
      if (!items.length) return '';
      return `<section class="dtiles" aria-label="${esc(label)}"><div class="dtiles__g">${items.map((t) => tiles.tile(t)).join('')}</div></section>`;
    },
  };
  KK.tiles = tiles;
})(typeof window !== 'undefined' ? window : globalThis);
