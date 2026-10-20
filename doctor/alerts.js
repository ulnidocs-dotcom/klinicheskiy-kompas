(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'alerts' });
  let onlyOpen = true;
  function render() {
    const all = store.alerts();
    const list = onlyOpen ? all.filter((a) => !a.ackAt) : all;
    const st = D.alertStats(all);
    const name = (pid) => store.patient(pid)?.name || pid;
    ui.mount('#app', `
      <div class="page-head"><h1>Алерты</h1>
        <div class="seg row" role="group" aria-label="Фильтр алертов"><button class="btn ${onlyOpen ? 'btn--primary' : ''}" data-f="open" aria-pressed="${onlyOpen}">Открытые</button><button class="btn ${!onlyOpen ? 'btn--primary' : ''}" data-f="all" aria-pressed="${!onlyOpen}">Все</button></div></div>
      <div class="tiles">
        <div class="tile ${st.open ? 'tile--crit' : 'aura aura--subtle aura--sage'}"><div class="n">${st.open}</div><div class="hint">${st.open ? ui.icon('alert', 14) + ' ' : ''}Требуют реакции</div></div>
        <div class="tile aura aura--subtle aura--blue"><div class="n">${st.deliveredMedianSec == null ? '—' : `${Math.round(st.deliveredMedianSec)}<small>с</small>`}</div><div class="hint">Медиана доставки врачу</div></div>
        <div class="tile aura aura--subtle aura--lavender"><div class="n">${st.ackMedianMin == null ? '—' : `${Math.round(st.ackMedianMin)}<small>мин</small>`}</div><div class="hint">Медиана реакции врача</div></div>
        <div class="tile aura aura--subtle aura--sand"><div class="n">${st.total}</div><div class="hint">Всего</div></div></div>
      <table class="table"><thead><tr><th>Уровень</th><th>Пациент</th><th>Сигнал</th><th>Данные</th><th>Доставлено</th><th>Реакция</th></tr></thead>
      <tbody>${list.map((a) => `<tr>
        <td>${D.signalBadge(a)}</td><td><a href="patient.html?id=${a.patientId}">${ui.esc(name(a.patientId))}</a></td>
        <td><b>${ui.esc(a.title)}</b><br><span class="hint">${ui.esc(a.text)}</span></td>
        <td class="hint">${ui.fmtDateTime(a.dataAt)}</td><td class="hint">${a.deliveredAt ? ui.fmtDateTime(a.deliveredAt) : '—'}</td>
        <td>${a.ackAt ? `<span class="hint">${ui.fmtDateTime(a.ackAt)} · ${ui.esc(a.ackAction)}</span>`
          : `<div class="row wrap"><button class="btn" data-ack="${a.id}" data-action="Связался с пациентом">Связался</button><button class="btn btn--ghost" data-ack="${a.id}" data-action="Просмотрено">Просмотрено</button></div>`}</td></tr>`).join('') || '<tr><td colspan="6" class="hint">Открытых алертов нет</td></tr>'}</tbody></table>`);
  }
  document.addEventListener('click', (e) => { const f = e.target.closest('[data-f]'); if (f) { onlyOpen = f.dataset.f === 'open'; render(); } });
  store.subscribe(render);
  render();
})();
