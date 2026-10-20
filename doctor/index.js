(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'patients' });
  let q = '';
  function render() {
    const all = store.patients();
    const list = all.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    const crit = all.filter((p) => p.openAlerts.some((a) => a.level === 'critical')).length;
    const req = all.filter((p) => p.routing === 'required' && !p.routingConfirmed).length;
    const missed = all.filter((p) => p.missedStreak >= 3).length;
    const now = new Date().toISOString();
    ui.preserveFocus(() => ui.mount('#app', `
      <div class="page-head"><div><h1>Пациенты</h1><p class="muted">${ui.fmtWeekday(now)}, ${ui.fmtDate(now)} · сначала срочные</p></div>
        <label class="field" style="min-width:260px"><span class="sr-only">Поиск</span><input id="q" placeholder="Поиск по фамилии" value="${ui.esc(q)}"></label></div>
      <div class="tiles">
        <div class="tile ${crit ? 'tile--crit' : 'aura aura--subtle aura--sage'}"><div class="n">${crit}</div><div class="hint">${crit ? ui.icon('alert', 14) + ' ' : ''}Критические сигналы</div></div>
        <div class="tile tile--route aura aura--subtle aura--lavender"><div class="n">${req}</div><div class="hint">Обязательно к психиатру</div></div>
        <div class="tile aura aura--subtle aura--sand"><div class="n">${missed}</div><div class="hint">Пропускают приём</div></div>
        <div class="tile aura aura--subtle aura--blue"><div class="n">${all.length}</div><div class="hint">Всего под наблюдением</div></div>
      </div>
      <table class="table"><thead><tr><th>Пациент</th><th>Статус</th><th>PHQ-9</th><th>GAD-7</th><th>Приверженность</th><th>Активность</th></tr></thead>
      <tbody>${list.map((p) => {
        const sp = (id, max) => {
          const vals = store.events(p.id, 'scale').filter((e) => e.payload.scaleId === id).map((e) => e.payload.total);
          return vals.length ? `<div class="row"><b class="score">${vals.at(-1)}</b>${ui.sparkline(vals.slice(-6), { w: 70, h: 24, max })}</div>` : '<span class="hint">—</span>';
        };
        return `<tr data-href="patient.html?id=${ui.esc(p.id)}" tabindex="0" style="cursor:pointer">
          <td><b>${ui.esc(p.name)}</b><br><span class="hint">${ui.age(p.age)} · ${p.diagnoses.length ? ui.esc(p.diagnoses.map((d) => d.code).join(', ')) : 'первичный приём'}</span></td>
          <td><div class="row wrap">${D.statusBadge(p)}${D.intakeBadge(p)}${p.routing === 'required' && !p.routingConfirmed ? `<a class="btn" href="routing.html?id=${ui.esc(p.id)}" onclick="event.stopPropagation()">Направить</a>` : ''}</div><span class="hint">${ui.esc(p.signals[0]?.title || (p.intakeRoute === 'psychiatrist_required' ? 'Решение психолога по первичному приёму' : ''))}</span></td>
          <td>${sp('phq9', 27)}</td><td>${sp('gad7', 21)}</td>
          <td>${p.pdc14 == null ? '<span class="hint">не назначено</span>' : `${Math.round(p.pdc14 * 100)}%${p.missedStreak >= 3 ? ` <span class="badge badge--warn">${p.missedStreak} дн. без приёма</span>` : ''}`}</td>
          <td class="hint">${p.lastActivityAt ? ui.fmtDateTime(p.lastActivityAt) : '—'}</td></tr>`;
      }).join('')}</tbody></table>`));
  }
  document.addEventListener('input', (e) => { if (e.target.id === 'q') { q = e.target.value; render(); } });
  document.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });
  document.addEventListener('keydown', (e) => { const tr = e.target.closest?.('tr[data-href]'); if (tr && e.key === 'Enter') location.href = tr.dataset.href; });
  store.subscribe(render);
  render();
})();
