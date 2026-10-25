// Наблюдение между визитами к психиатру: кто из пациентов психиатра требует внимания психолога сейчас.
// Порядок: критические сигналы → настроение хуже → ближайший приём. Подробности — psych/watch.html.
(function () {
  const { ui, store, psychApp: P } = KK;
  P.start({ nav: 'observe' });
  const RANK = { worse: 0, few: 1, same: 2, better: 3 };

  function rowData(p) {
    const checkins = KK.util.latestPerDay(store.events(p.id, 'checkin'));
    return { p, v: store.visits(p.id), trend: P.moodTrend(checkins), moods: checkins.slice(-14).map((c) => c.payload.mood) };
  }
  function signalsCell(p) {
    if (P.critical(p)) return `<span class="badge badge--critical">${ui.icon('alert', 14)}Критично</span>`;
    const n = p.signals.filter((s) => s.level === 'important' || s.level === 'task').length;
    return n ? `<span class="badge badge--warn">${n} ${ui.plural(n, ['сигнал', 'сигнала', 'сигналов'])}</span>` : '<span class="hint">нет</span>';
  }
  function render() {
    const rows = P.observed(store.patients()).map(rowData).sort((a, b) => (P.critical(b.p) - P.critical(a.p)) || (RANK[a.trend.code] - RANK[b.trend.code])
      || ((a.v.next ? +new Date(a.v.next.scheduledAt) : Infinity) - (b.v.next ? +new Date(b.v.next.scheduledAt) : Infinity)));
    const scale = (p, id, name) => (p.latest[id] && p.latest[id].total != null ? `${name} ${p.latest[id].total}` : '');
    const trendBadge = (t) => `<span class="badge ${t.code === 'worse' ? 'badge--warn' : t.code === 'better' ? 'badge--ok' : 'badge--info'}">${ui.esc(t.label)}</span>`;
    ui.mount('#app', `
      <div class="page-head"><div><h1>Наблюдение</h1>
        <p class="muted">Пациенты психиатра между приёмами: дневник, шкалы и сигналы. Ухудшение — повод связаться с пациентом или записать его к психиатру раньше.</p></div></div>
      <table class="table"><thead><tr><th>Пациент</th><th>Последние 14 дней</th><th>Шкалы</th><th>Сигналы</th><th>Приём у психиатра</th></tr></thead>
      <tbody>${rows.map(({ p, v, trend, moods }) => `<tr data-href="watch.html?id=${ui.esc(p.id)}" tabindex="0" style="cursor:pointer">
          <td><a href="watch.html?id=${ui.esc(p.id)}"><b>${ui.esc(p.name)}</b></a><br><span class="hint">${ui.age(p.age)}</span></td>
          <td><div class="stack" style="gap:6px">${trendBadge(trend)}${moods.length ? KK.tiles.dotRow(moods, { max: 5 }) : ''}</div></td>
          <td class="hint">${[scale(p, 'phq9', 'PHQ-9'), scale(p, 'gad7', 'GAD-7')].filter(Boolean).join('<br>') || 'нет данных'}</td>
          <td>${signalsCell(p)}</td>
          <td class="hint">${ui.esc(P.visitLine(v))}</td></tr>`).join('')
        || '<tr><td colspan="5" class="hint">Пациентов под наблюдением нет</td></tr>'}</tbody></table>
      <p class="legal" style="margin-top:16px">Психолог видит дневник пациента как участник команды лечения, по согласию пациента на доступ врачей клиники. Решения о лечении принимает психиатр.</p>`);
  }
  document.addEventListener('click', (e) => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });
  document.addEventListener('keydown', (e) => { const tr = e.target.closest?.('tr[data-href]'); if (tr && e.key === 'Enter') location.href = tr.dataset.href; });
  store.subscribe(render);
  render();
})();
