(function (g) {
  const KK = g.KK;
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WEEK = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const P = {
    home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
    path: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    book: '<path d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M5 16a4 4 0 0 1 4-4h9"/>',
    chat: '<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c.8-3.5 3.5-5 7-5s6.2 1.5 7 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.4 2.2 4 5"/>',
    pill: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="M9.5 8.5l5 7"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17v.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    leaf: '<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z"/><path d="M5 19l8-8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  };
  const ui = {
    esc: (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    param: (name) => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get(name) : null),
    plural(n, [one, few, many]) {
      const a = Math.abs(n) % 100, b = a % 10;
      if (a > 10 && a < 20) return many;
      if (b > 1 && b < 5) return few;
      if (b === 1) return one;
      return many;
    },
    age: (n) => `${n} ${ui.plural(n, ['год', 'года', 'лет'])}`,
    fmtDate(iso) { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; },
    fmtWeekday(iso) { const d = new Date(iso); const w = WEEK[d.getDay()]; return w.charAt(0).toUpperCase() + w.slice(1); },
    fmtTime(iso) { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; },
    fmtDateTime(iso) { return `${ui.fmtDate(iso)}, ${ui.fmtTime(iso)}`; },
    greeting(date = new Date()) { const h = date.getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; },
    icon(name, size = 22) {
      if (!P[name]) return '';
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
    },
    sparkline(values, { w = 120, h = 36, max = 27, color = 'var(--chart)' } = {}) {
      if (!values.length) return '';
      const step = values.length > 1 ? (w - 8) / (values.length - 1) : 0;
      const pts = values.map((v, i) => [4 + i * step, h - 4 - (v / max) * (h - 8)]);
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2" points="${pts.map((p) => p.join(',')).join(' ')}"/>${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="${color}"/>`).join('')}</svg>`;
    },
    // series: [{ label, color, points: [{ at, v }] }]; bands: [{ from, to, color }] — фоновые зоны (только для врача)
    lineChart(series, { w = 560, h = 180, max = 27, bands = [], ariaLabel = 'График динамики', ticks = true, pointValues = true } = {}) {
      const all = series.flatMap((s) => s.points);
      if (!all.length) return `<p class="hint">Нет данных за период</p>`;
      const t0 = Math.min(...all.map((p) => +new Date(p.at))), t1 = Math.max(...all.map((p) => +new Date(p.at)));
      const L = 28, R = 8, T = 8, B = 22;
      const x = (at) => L + (t1 === t0 ? (w - L - R) / 2 : ((+new Date(at) - t0) / (t1 - t0)) * (w - L - R));
      const y = (v) => T + (1 - v / max) * (h - T - B);
      const zones = bands.map((b) => `<rect x="${L}" y="${y(b.to)}" width="${w - L - R}" height="${y(b.from) - y(b.to)}" fill="${b.color}"/>`).join('');
      const tickSvg = !ticks ? '' : [0, Math.round(max / 2), max].map((v) => `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--text-3)">${v}</text>`).join('');
      const lines = series.map((s) => {
        const pts = s.points.map((p) => [x(p.at), y(p.v)]);
        return `<polyline fill="none" stroke="${s.color}" stroke-width="2.2" points="${pts.map((p) => p.join(',')).join(' ')}"/>` +
          pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${s.color}"><title>${ui.esc(s.label)}${pointValues ? `: ${s.points[i].v}` : ''} · ${ui.fmtDate(s.points[i].at)}</title></circle>`).join('');
      }).join('');
      const xl = [t0, t1].map((t, i) => `<text x="${i ? w - R : L}" y="${h - 4}" text-anchor="${i ? 'end' : 'start'}" font-size="11" fill="var(--text-3)">${ui.fmtDate(new Date(t).toISOString())}</text>`).join('');
      return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${ui.esc(ariaLabel)}">${zones}${tickSvg}${lines}${xl}</svg>`;
    },
    // График шкал для врача: сетка по делениям шкалы, даты замеров по оси X, плавные линии с заливкой,
    // подписи значений у точек, последняя точка выделена. series: [{ label, color, points: [{ at, v }] }].
    scaleChart(series, { w = 680, h = 260, max = 27, ticks = [0, 5, 10, 15, 20, 27], bands = [], ariaLabel = 'Динамика по шкалам' } = {}) {
      const all = series.flatMap((s) => s.points);
      if (!all.length) return '<p class="hint">Шкалы ещё не заполнялись</p>';
      const L = 34, R = 18, T = 22, B = 30;
      const DAY = 86400000;
      let t0 = Math.min(...all.map((p) => +new Date(p.at))), t1 = Math.max(...all.map((p) => +new Date(p.at)));
      if (t1 - t0 < DAY) { t0 -= 3 * DAY; t1 += 3 * DAY; } // один замер — не прижимаем к краю
      const x = (at) => L + ((+new Date(at) - t0) / (t1 - t0)) * (w - L - R);
      const y = (v) => T + (1 - Math.max(0, Math.min(max, v)) / max) * (h - T - B);
      const r1 = (n) => Math.round(n * 10) / 10;
      const zones = bands.map((b) => `<rect x="${L}" y="${r1(y(b.to))}" width="${w - L - R}" height="${r1(y(b.from) - y(b.to))}" fill="${b.color}"/>`).join('');
      const grid = ticks.map((v) => `<line x1="${L}" x2="${w - R}" y1="${r1(y(v))}" y2="${r1(y(v))}" stroke="var(--line)" stroke-width="1"/>`
        + `<text x="${L - 8}" y="${r1(y(v) + 4)}" text-anchor="end" font-size="11" fill="var(--text-3)">${v}</text>`).join('');
      // Вертикальные пунктиры и подписи — по дням замеров; подписи, которые налезают друг на друга, пропускаем.
      const days = [...new Set(all.map((p) => ui.fmtDate(p.at)))].map((label) => ({ label, at: all.find((p) => ui.fmtDate(p.at) === label).at }))
        .sort((a, b) => new Date(a.at) - new Date(b.at));
      let lastX = -Infinity;
      const vgrid = days.map((d) => {
        const xx = r1(x(d.at));
        const line = `<line x1="${xx}" x2="${xx}" y1="${T}" y2="${h - B}" stroke="var(--line)" stroke-dasharray="3 4"/>`;
        if (xx - lastX < 64) return line;
        lastX = xx;
        const anc = xx < L + 44 ? 'start' : xx > w - R - 44 ? 'end' : 'middle';
        return line + `<text x="${xx}" y="${h - 10}" text-anchor="${anc}" font-size="11" fill="var(--text-3)">${ui.esc(d.label)}</text>`;
      }).join('');
      // Плавная кривая (кардинальный сплайн), не выходящая за пределы шкалы по Y.
      const smooth = (pts) => {
        if (pts.length < 2) return '';
        let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
          const k = 0.18;
          const c1 = [p1[0] + (p2[0] - p0[0]) * k, Math.min(h - B, Math.max(T, p1[1] + (p2[1] - p0[1]) * k))];
          const c2 = [p2[0] - (p3[0] - p1[0]) * k, Math.min(h - B, Math.max(T, p2[1] - (p3[1] - p1[1]) * k))];
          d += ` C${r1(c1[0])},${r1(c1[1])} ${r1(c2[0])},${r1(c2[1])} ${r1(p2[0])},${r1(p2[1])}`;
        }
        return d;
      };
      const uid = `sc${Math.random().toString(36).slice(2, 7)}`;
      const defs = series.map((s, i) => `<linearGradient id="${uid}${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${s.color};stop-opacity:.22"/><stop offset="1" style="stop-color:${s.color};stop-opacity:0"/></linearGradient>`).join('');
      const body = series.map((s, i) => {
        const sorted = [...s.points].sort((a, b) => new Date(a.at) - new Date(b.at));
        const pts = sorted.map((p) => [x(p.at), y(p.v)]);
        const path = smooth(pts);
        const area = path ? `<path d="${path} L${r1(pts.at(-1)[0])},${h - B} L${r1(pts[0][0])},${h - B} Z" fill="url(#${uid}${i})"/>` : '';
        const line = path ? `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round"/>` : '';
        const dots = pts.map((p, j) => {
          const last = j === pts.length - 1;
          // Подпись над точкой у верхней линии и под точкой у нижней — значения двух шкал не налезают друг на друга.
          const day = ui.fmtDate(sorted[j].at);
          const others = series.filter((o, k) => k !== i).flatMap((o) => o.points).filter((o) => ui.fmtDate(o.at) === day);
          const isLower = others.some((o) => o.v > sorted[j].v || (o.v === sorted[j].v && i > 0));
          const above = isLower ? 22 : -13;
          return `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${last ? 6 : 4}" fill="${last ? s.color : 'var(--surface)'}" stroke="${s.color}" stroke-width="2.2"><title>${ui.esc(s.label)}: ${sorted[j].v} · ${ui.fmtDate(sorted[j].at)}</title></circle>`
            + `<text x="${r1(p[0] < L + 20 ? p[0] + 8 : p[0] > w - R - 20 ? p[0] - 8 : p[0])}" y="${r1(Math.min(h - B - 4, Math.max(T + 10, p[1] + above)))}" text-anchor="${p[0] < L + 20 ? 'start' : p[0] > w - R - 20 ? 'end' : 'middle'}" font-size="${last ? 13 : 11}" font-weight="${last ? 600 : 400}" fill="${last ? s.color : 'var(--text-2)'}">${sorted[j].v}</text>`;
        }).join('');
        return area + line + dots;
      }).join('');
      return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${ui.esc(ariaLabel)}"><defs>${defs}</defs>${zones}${grid}${vgrid}${body}</svg>`;
    },
    // Перерисовка через innerHTML теряет фокус и каретку: запоминаем активное поле (по id, радио — по name/value) и возвращаем.
    preserveFocus(fn) {
      const doc = typeof document !== 'undefined' ? document : null;
      const a = doc && doc.activeElement;
      let sel = null;
      try { if (a && typeof a.selectionStart === 'number') sel = [a.selectionStart, a.selectionEnd]; } catch (e) { /* поле без каретки */ }
      const key = a && a.id ? { id: a.id } : a && a.type === 'radio' && a.name ? { name: a.name, value: a.value } : null;
      const out = fn();
      if (key && doc) {
        const el = key.id ? doc.getElementById(key.id)
          : [...doc.querySelectorAll('input[type="radio"]')].find((x) => x.name === key.name && x.value === key.value);
        if (el && el !== doc.activeElement && typeof el.focus === 'function') {
          el.focus();
          if (sel && typeof el.setSelectionRange === 'function') { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* */ } }
        }
      }
      return out;
    },
    mount(sel, html) { const el = document.querySelector(sel); if (el) el.innerHTML = html; return el; },
  };
  KK.ui = ui;
})(typeof window !== 'undefined' ? window : globalThis);
