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
    lineChart(series, { w = 560, h = 180, max = 27, bands = [], ariaLabel = 'График динамики', ticks = true } = {}) {
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
          pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${s.color}"><title>${ui.esc(s.label)}: ${s.points[i].v} · ${ui.fmtDate(s.points[i].at)}</title></circle>`).join('');
      }).join('');
      const xl = [t0, t1].map((t, i) => `<text x="${i ? w - R : L}" y="${h - 4}" text-anchor="${i ? 'end' : 'start'}" font-size="11" fill="var(--text-3)">${ui.fmtDate(new Date(t).toISOString())}</text>`).join('');
      return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${ui.esc(ariaLabel)}">${zones}${tickSvg}${lines}${xl}</svg>`;
    },
    mount(sel, html) { const el = document.querySelector(sel); if (el) el.innerHTML = html; return el; },
  };
  KK.ui = ui;
})(typeof window !== 'undefined' ? window : globalThis);
