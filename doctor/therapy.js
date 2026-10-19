(function () {
  const { ui, store, doctorApp: D, data } = KK;
  D.start({ nav: 'patients' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('index.html'); return; }
  // reason живёт вне DOM: перерисовки по стору и ошибки валидации не стирают текст обоснования.
  let dialog = null; let err = ''; let reason = ''; let opener = null;
  const ST = { absent: ['st--absent', '✓', 'нет'], present: ['st--present', '✕', 'есть'], unknown: ['st--unknown', '?', 'нет данных'] };

  function decisionHtml(p, t, drug) {
    const st = p.plan?.status;
    const decision = D.therapyDecision(p, t);
    if (decision === 'noPlan') return '<p>Статус: <b>План терапии не задан</b></p>';
    const status = `<p>Статус: <b>${st === 'confirmed' ? `назначен ${ui.fmtDate(p.plan.confirmedAt)}` : st === 'proposed' ? 'предложен системой' : st === 'cancelled' ? 'отменён' : '—'}</b></p>`;
    if (decision === 'cancel') return `${status}<button class="btn" data-open="cancel">Отменить назначение</button>`;
    if (decision === 'offlabel') {
      const why = t.eligible === false ? 'Противопоказание' : 'Вне показаний';
      return `${status}<div class="signal signal--critical"><span class="badge badge--contra">${why}</span><span>Назначение по инструкции невозможно.</span></div>
        <button class="btn" data-open="offlabel">Назначить вне инструкции…</button>`;
    }
    return `${status}${t.eligible === null ? '<div class="signal signal--warn"><span class="badge badge--warn">Нет данных</span><span>Часть противопоказаний не проверена. Решение остаётся за врачом.</span></div>' : ''}
      <button class="btn btn--primary" data-open="confirm">Назначить ${ui.esc(drug.name)}</button>`;
  }

  function render() {
    const p = store.patient(id);
    const drug = data.drugs[p.plan?.drugId || 'aviandr'];
    const t = p.therapy || KK.therapy.check(drug, p);
    ui.preserveFocus(() => ui.mount('#app', `
      ${D.patientHeader(p)}${D.patientTabs(id, 'therapy')}
      <div class="grid2">
        <div class="stack">
          <section class="card stack"><div class="row-between"><h2>${ui.esc(drug.name)} (${ui.esc(drug.inn)})</h2>${drug.additionalMonitoring ? '<span class="badge badge--warn">Дополнительный мониторинг безопасности</span>' : ''}</div>
            <dl class="kv"><dt>Форма</dt><dd>${ui.esc(drug.form)}</dd><dt>Режим</dt><dd>${ui.esc(drug.dosing.dose)} ${drug.dosing.timesPerDay} раза в сутки (${ui.esc(drug.dosing.daily)}/сут), длительность — ${ui.esc(drug.dosing.duration)}</dd>
              <dt>Показания</dt><dd>${drug.indications.map((i) => `${ui.esc(i.codes.join(', '))} — ${ui.esc(i.text)}`).join('<br>')}</dd>
              <dt>Показан пациенту</dt><dd>${t.indicated ? '<span class="badge badge--ok">Да, по диагнозу</span>' : '<span class="badge badge--warn">Диагноз вне показаний инструкции</span>'}</dd></dl></section>
          <section class="card stack"><h2>Противопоказания</h2>
            <ul class="check-list">${t.contraindications.map((c) => `<li><span class="st ${ST[c.status][0]}" aria-label="${ST[c.status][2]}">${ST[c.status][1]}</span><span>${ui.esc(c.label)}${c.status === 'unknown' ? ` — <a href="import.html?id=${ui.esc(id)}">добавить данные</a>` : ''}</span></li>`).join('')}</ul>
            ${t.cautions.length ? `<h3>С осторожностью</h3>${t.cautions.map((c) => `<div class="signal signal--warn"><span class="badge badge--warn">Осторожно</span><span>${ui.esc(c.label)}</span></div>`).join('')}` : ''}</section>
          <section class="card stack"><h2>Взаимодействия с текущими препаратами</h2>
            ${t.interactions.length ? t.interactions.map((i) => `<div class="signal signal--warn"><span class="badge badge--warn">${ui.esc(i.drugs.join(', '))}</span><span>${ui.esc(i.text)}</span></div>`).join('') : `<p class="muted">${p.meds.length ? 'Значимых взаимодействий не найдено' : 'Других препаратов пациент не принимает'}</p>`}</section>
          <p class="hint">Источник: ${ui.esc(drug.source)}. Сверено с Государственным реестром лекарственных средств.</p>
        </div>
        <div class="stack">
          <section class="card stack"><h2>Решение врача</h2>
            ${decisionHtml(p, t, drug)}
            <p class="hint">Система не назначает препараты самостоятельно. Решение фиксируется в журнале действий.</p></section>
          <section class="card stack"><h2>Нежелательные реакции из инструкции</h2>
            <p class="hint">Часто: ${drug.adverseEvents.filter((a) => a.freq === 'часто').map((a) => ui.esc(a.label.toLowerCase())).join(', ')}.</p>
            <p class="hint">Нечасто: ${drug.adverseEvents.filter((a) => a.freq === 'нечасто').map((a) => ui.esc(a.label.toLowerCase())).join(', ')}.</p></section>
        </div>
      </div>
      ${dialog && p.plan ? dialogHtml(dialog, drug, t) : ''}`));
  }
  function dialogHtml(kind, drug, t) {
    const field = (label) => `<label class="field"><span class="hint">${label}</span><textarea id="reason">${ui.esc(reason)}</textarea></label>`;
    const grounds = [...(t?.contraindications || []).filter((c) => c.status === 'present').map((c) => `противопоказание: ${c.label}`),
      ...(t?.indicated === false ? ['диагноз вне показаний инструкции'] : [])];
    const body = kind === 'confirm' ? `<h2 id="dlg-title">Назначить ${ui.esc(drug.name)}?</h2><p>${ui.esc(drug.dosing.dose)} ${drug.dosing.timesPerDay} раза в сутки. Пациент получит напоминания о приёме и памятку.</p>`
      : kind === 'cancel' ? `<h2 id="dlg-title">Отменить назначение?</h2><p>Напоминания пациенту прекратятся.</p>${field('Причина')}`
      : `<h2 id="dlg-title">Назначение вне инструкции</h2><p>Основание: ${ui.esc(grounds.join('; ') || 'не по инструкции')}. Назначение возможно только как самостоятельное решение врача с обоснованием.</p>${field('Обоснование (обязательно)')}`;
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="dlg-title" id="dlg"><div class="modal stack" style="border-top-color:var(--accent)">${body}
      ${err ? `<p class="hint" role="alert" style="color:var(--crit-ink)">${ui.esc(err)}</p>` : ''}
      <div class="row"><button class="btn ${kind === 'offlabel' ? 'btn--danger' : 'btn--primary'}" data-do="${kind}">Подтвердить</button><button class="btn btn--ghost" data-dlg-close>Отмена</button></div></div></div>`;
  }
  function focusDialog() {
    const dlg = document.getElementById('dlg');
    const el = dlg && (dlg.querySelector('#reason') || dlg.querySelector('button'));
    if (el) el.focus();
  }
  function closeDialog() {
    dialog = null; err = ''; render();
    const back = opener && document.querySelector(`[data-open="${opener}"]`);
    opener = null;
    if (back) back.focus();
  }
  document.addEventListener('input', (e) => { if (e.target.id === 'reason') reason = e.target.value; });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !dialog) return;
    if (document.getElementById('modal-root')?.dataset.open) return; // сначала закрывается критический алерт
    closeDialog();
  });
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) { dialog = o.dataset.open; opener = dialog; err = ''; reason = ''; render(); focusDialog(); return; }
    if (e.target.closest('[data-dlg-close]')) { closeDialog(); return; }
    const d = e.target.closest('[data-do]');
    if (!d) return;
    const why = reason.trim();
    try {
      if (d.dataset.do === 'confirm') store.confirm(id, 'confirm_plan', {});
      if (d.dataset.do === 'cancel') store.confirm(id, 'cancel_plan', { reason: why });
      if (d.dataset.do === 'offlabel') {
        if (why.length < 10) { err = 'Опишите обоснование (не меньше 10 символов).'; render(); focusDialog(); return; }
        store.confirm(id, 'off_label', { reason: why });
        store.confirm(id, 'confirm_plan', { offLabel: true });
      }
      dialog = null; reason = ''; opener = null; render();
    } catch (ex) { err = ex.message; render(); focusDialog(); }
  });
  store.subscribe(render);
  render();
})();
