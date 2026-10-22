(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'patients' });
  let q = '';
  // «Добавить пациента»: форма над списком. Значения держим здесь — список перерисовывается при любой записи в хранилище.
  let adding = false, addErr = '';
  const form = { name: '', age: '', sex: '', phone: '', dxCode: '', dxText: '' };
  const fv = (k) => ui.esc(form[k]);
  function addForm() {
    if (!adding) return '';
    return `<form class="card stack add-patient" id="add-form" aria-label="Новый пациент" novalidate>
      <h2>Новый пациент</h2>
      <div class="grid-form">
        <label class="field"><span class="hint">ФИО</span><input id="ap-name" data-f="name" autocomplete="off" required value="${fv('name')}"></label>
        <label class="field"><span class="hint">Возраст, полных лет</span><input id="ap-age" data-f="age" type="number" inputmode="numeric" min="1" max="120" required value="${fv('age')}"></label>
        <label class="field"><span class="hint">Пол</span><select id="ap-sex" data-f="sex" required>
          <option value="" ${form.sex ? '' : 'selected'}>Выберите</option><option value="f" ${form.sex === 'f' ? 'selected' : ''}>женский</option><option value="m" ${form.sex === 'm' ? 'selected' : ''}>мужской</option></select></label>
        <label class="field"><span class="hint">Мобильный телефон</span><input id="ap-phone" data-f="phone" type="tel" inputmode="tel" autocomplete="off" placeholder="+7 900 000-00-00" required value="${fv('phone')}"></label>
        <label class="field"><span class="hint">Диагноз, код МКБ-10 (необязательно)</span><input id="ap-dx" data-f="dxCode" autocomplete="off" placeholder="F41.1" value="${fv('dxCode')}"></label>
        <label class="field"><span class="hint">Диагноз, формулировка (необязательно)</span><input id="ap-dxt" data-f="dxText" autocomplete="off" value="${fv('dxText')}"></label>
      </div>
      <p class="hint">По номеру телефона пациент подтвердит регистрацию кодом из SMS. Карточка создаётся без событий, затем откроется приглашение в дневник.</p>
      <p class="hint" id="ap-err" role="alert">${ui.esc(addErr)}</p>
      <div class="row wrap"><button class="btn btn--primary" type="submit">Добавить и пригласить</button><button class="btn btn--ghost" type="button" data-add-cancel>Отмена</button></div>
    </form>`;
  }
  function render() {
    const all = store.patients();
    const confirmPending = new Set(store.phoneConfirms({ state: 'pending' }).map((c) => c.patientId));
    const list = all.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    const crit = all.filter((p) => p.openAlerts.some((a) => a.level === 'critical')).length;
    const req = all.filter((p) => p.routing === 'required' && !p.routingConfirmed).length;
    const missed = all.filter((p) => p.missedStreak >= 3).length;
    const now = new Date().toISOString();
    ui.preserveFocus(() => ui.mount('#app', `
      <div class="page-head"><div><h1>Пациенты</h1><p class="muted">${ui.fmtWeekday(now)}, ${ui.fmtDate(now)} · сначала срочные</p></div>
        <div class="row wrap"><label class="field" style="min-width:260px"><span class="sr-only">Поиск</span><input id="q" placeholder="Поиск по фамилии" value="${ui.esc(q)}"></label>
          ${adding ? '' : '<button class="btn btn--primary" data-add-open>Добавить пациента</button>'}</div></div>
      ${addForm()}
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
          <td><div class="row wrap">${D.statusBadge(p)}${D.intakeBadge(p)}${confirmPending.has(p.id) ? '<span class="badge badge--warn" title="Номер при регистрации отличается от карты">Подтвердите номер</span>' : ''}${p.routing === 'required' && !p.routingConfirmed ? `<a class="btn" href="routing.html?id=${ui.esc(p.id)}" onclick="event.stopPropagation()">Направить</a>` : ''}</div><span class="hint">${ui.esc(p.signals[0]?.title || (p.intakeRoute === 'psychiatrist_required' ? 'Решение психолога по первичному приёму' : ''))}</span></td>
          <td>${sp('phq9', 27)}</td><td>${sp('gad7', 21)}</td>
          <td>${p.pdc14 == null ? '<span class="hint">не назначено</span>' : `${Math.round(p.pdc14 * 100)}%${p.missedStreak >= 3 ? ` <span class="badge badge--warn">${p.missedStreak} дн. без приёма</span>` : ''}`}</td>
          <td class="hint">${p.lastActivityAt ? ui.fmtDateTime(p.lastActivityAt) : '—'}</td></tr>`;
      }).join('')}</tbody></table>`));
  }
  document.addEventListener('input', (e) => { if (e.target.id === 'q') { q = e.target.value; render(); } });
  const keep = (e) => { const k = e.target.dataset && e.target.dataset.f; if (k && Object.hasOwn(form, k)) form[k] = e.target.value; };
  document.addEventListener('input', keep);
  document.addEventListener('change', keep);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-open]')) { adding = true; addErr = ''; render(); const f = document.getElementById('ap-name'); if (f) f.focus(); }
    if (e.target.closest('[data-add-cancel]')) { adding = false; addErr = ''; Object.keys(form).forEach((k) => { form[k] = ''; }); render(); }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'add-form') return;
    e.preventDefault();
    try {
      const pid = store.addPatient(form, D.me().id);
      location.href = `patient.html?id=${encodeURIComponent(pid)}&invite=1`;
    } catch (err) {
      addErr = err.message;
      const el = document.getElementById('ap-err');
      if (el) el.textContent = addErr;
    }
  });
  document.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });
  document.addEventListener('keydown', (e) => { const tr = e.target.closest?.('tr[data-href]'); if (tr && e.key === 'Enter') location.href = tr.dataset.href; });
  store.subscribe(render);
  render();
})();
