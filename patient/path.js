(function () {
  const { ui, store, patientApp: app, data } = KK;
  const ctx = app.start();
  if (!ctx) return;
  let period = 14;
  const PERIOD_LABEL = { 14: 'за 2 недели', 30: 'за месяц', 365: 'за всё время' };

  function render() {
    const p = ctx.patient();
    const now = new Date().toISOString();
    const from = KK.util.shiftDays(now, -period);
    const inP = (e) => new Date(e.at) >= new Date(from);
    const checkins = store.events(p.id, 'checkin').filter(inP);
    const series = [
      { label: 'Настроение', color: 'var(--chart)', points: checkins.map((c) => ({ at: c.at, v: c.payload.mood })) },
      { label: 'Сон', color: 'var(--chart-2)', points: checkins.map((c) => ({ at: c.at, v: c.payload.sleep })) },
    ];
    const doseDays = new Set(store.events(p.id, 'dose').map((d) => KK.util.dayKey(d.at)));
    const cal = Array.from({ length: 14 }, (_, k) => {
      const iso = KK.util.shiftDays(now, k - 13);
      return `<i class="${doseDays.has(KK.util.dayKey(iso)) ? 'on' : ''} ${k === 13 ? 'today' : ''}" title="${ui.fmtDate(iso)}"></i>`;
    }).join('');
    const confirmed = p.plan?.status === 'confirmed';
    const takenDays = Array.from({ length: 14 }, (_, k) => KK.util.dayKey(KK.util.shiftDays(now, k - 13))).filter((k) => doseDays.has(k)).length;
    const scales = app.scaleHistory(store.events(p.id, 'scale'));

    ui.mount('#app', `
      <header class="p-head"><h1>Мой путь</h1></header>
      <div class="seg" role="group" aria-label="Период" style="margin-bottom:16px">
        ${[[14, '2 недели'], [30, 'Месяц'], [365, 'Всё время']].map(([d, l]) => `<button data-period="${d}" aria-pressed="${period === d}">${l}</button>`).join('')}
      </div>
      <div class="stack">
        ${KK.tiles.tileGrid(app.pathTiles({ confirmed, takenDays, checkins, practice: app.practiceOfDay(), periodLabel: PERIOD_LABEL[period] }), { label: 'Коротко' })}
        <section class="card stack"><p class="q-title">Настроение и сон</p>
          ${ui.lineChart(series, { max: 5, ticks: false, pointValues: false, w: 320, h: 140, ariaLabel: 'Настроение и сон по дням' })}
          <div class="ticks" aria-hidden="true" style="--pos:96%"><i></i></div>
          <div class="legend"><span><i style="background:var(--chart)"></i>Настроение</span><span><i style="background:var(--chart-2)"></i>Сон</span></div>
          <p>${ui.esc(app.checkinSummary(checkins))}</p></section>
        ${confirmed ? `<section class="card stack"><p class="q-title">Приём лекарства по дням</p>
          <span class="sr-only">Отмечено ${takenDays} ${ui.plural(takenDays, ['день', 'дня', 'дней'])} из 14.</span>
          <div class="cal" aria-hidden="true">${cal}</div>
          <p class="hint">Если что-то мешает принимать лекарство — расскажите врачу.</p></section>` : ''}
        <section class="card stack"><p class="q-title">Опросники</p>
          ${scales.length ? scales.map((e) => `<div class="stack" style="padding:8px 0;border-bottom:1px solid var(--line)">
            <span class="hint">${ui.fmtDate(e.at)} · ${ui.esc(data.scales[e.scaleId].patientTitle)}</span>
            <span>${ui.esc(e.label)}</span></div>`).join('') : '<p class="hint">Пока нет пройденных опросников.</p>'}
        </section>
      </div>`);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-period]');
    if (b) { period = Number(b.dataset.period); render(); }
  });
  store.subscribe(render);
  render();
})();
