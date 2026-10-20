(function () {
  const { ui, store, psychApp: P, battery: B } = KK;
  P.start({ nav: 'queue' });
  function proposal(p) {
    if (p.intake.decision) return `${P.levelBadge(p.intake.decision.level, { short: true })}<br><span class="hint">решение ${ui.fmtDate(p.intake.decision.at)}</span>`;
    if (p.intakeStatus !== 'completed') return '<span class="hint">—</span>';
    return `${P.levelBadge(B.routeIntake(store.intakeOf(p.id)).level, { short: true })}<br><span class="hint">предложение системы</span>`;
  }
  function render() {
    const q = P.queue(store.patients());
    const n = (s) => q.filter((p) => p.intakeStatus === s).length;
    const crit = q.filter(P.critical).length;
    const now = new Date().toISOString();
    ui.mount('#app', `
      <div class="page-head"><div><h1>Первичные приёмы</h1><p class="muted">${ui.fmtWeekday(now)}, ${ui.fmtDate(now)} · сначала критические и ожидающие решения</p></div></div>
      <div class="tiles">
        <div class="tile ${crit ? 'tile--crit' : 'aura aura--subtle aura--sage'}"><div class="n">${crit}</div><div class="hint">${crit ? ui.icon('alert', 14) + ' ' : ''}Критические сигналы</div></div>
        <div class="tile aura aura--subtle aura--lavender"><div class="n">${n('completed')}</div><div class="hint">Ждут решения</div></div>
        <div class="tile aura aura--subtle aura--sand"><div class="n">${n('in_progress') + n('assigned')}</div><div class="hint">Назначены и в процессе</div></div>
        <div class="tile aura aura--subtle aura--teal"><div class="n">${n('decided')}</div><div class="hint">Решение принято</div></div>
      </div>
      <table class="table"><thead><tr><th>Пациент</th><th>Статус</th><th>Маршрут</th><th>Назначен</th></tr></thead>
      <tbody>${q.map((p) => `<tr data-href="patient.html?id=${ui.esc(p.id)}" tabindex="0" style="cursor:pointer">
          <td><a href="patient.html?id=${ui.esc(p.id)}"><b>${ui.esc(p.name)}</b></a><br><span class="hint">${ui.age(p.age)}</span></td>
          <td><div class="row wrap">${P.critical(p) ? '<span class="badge badge--critical">' + ui.icon('alert', 14) + 'Критично</span>' : ''}${P.statusBadge(p)}</div></td>
          <td>${proposal(p)}</td>
          <td class="hint">${p.intake.assignedAt ? ui.fmtDate(p.intake.assignedAt) : '—'}</td></tr>`).join('')
        || '<tr><td colspan="4" class="hint">Первичных приёмов нет</td></tr>'}</tbody></table>
      <p class="legal" style="margin-top:16px">${ui.esc(KK.data.intake.legal)}</p>`);
  }
  document.addEventListener('click', (e) => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });
  document.addEventListener('keydown', (e) => { const tr = e.target.closest?.('tr[data-href]'); if (tr && e.key === 'Enter') location.href = tr.dataset.href; });
  store.subscribe(render);
  render();
})();
