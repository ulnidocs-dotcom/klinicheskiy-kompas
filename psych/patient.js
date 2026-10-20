// Сводка первичного приёма: безопасность, маршрут (подтвердить / изменить с причиной), вопросы для беседы,
// DASS-21, профиль TIPI-RU, ЦТО без интерпретации, анкета, журнал. Всё — «предварительная оценка».
(function () {
  const { ui, store, psychApp: P, battery: B, data } = KK;
  P.start({ nav: 'queue' });
  const id = ui.param('id');
  if (!store.patient(id) || !store.intakeOf(id)) { location.replace('index.html'); return; }
  const LV = B.LEVEL_ORDER;
  const st = { editing: false, level: null, note: '', error: '', saved: '' };

  function safety(it, p) {
    const band = it.cssrs && it.cssrs.band;
    const crit = band && (band.code === 'moderate' || band.code === 'high');
    const open = p.openAlerts.filter((a) => a.level === 'critical');
    const banner = open.length ? `<div class="psy-banner" role="alert">${ui.icon('alert', 20)}<p><b>${ui.esc(open[0].title)}.</b> ${ui.esc(open[0].text)}</p>
        <button class="btn" data-ack="${ui.esc(open[0].id)}" data-action="Связался с пациентом">Связался с пациентом</button></div>` : '';
    return { banner, html: `<section class="card stack"><div class="row-between"><h2>Безопасность · C-SSRS</h2>${it.at.cssrs ? `<span class="hint">${ui.fmtDateTime(it.at.cssrs)}</span>` : ''}</div>
      ${band ? `<p>${crit ? '<span class="badge badge--critical">Критично</span> ' : band.code === 'none' ? '<span class="badge badge--ok">Риск не выявлен</span> ' : '<span class="badge badge--warn">Есть положительные ответы</span> '}${ui.esc(band.doctorLabel)}</p>`
        : '<p class="hint">Скрининг ещё не пройден.</p>'}
      <p class="hint">${ui.esc(data.scales.cssrs.source)} · формулировки самоотчёта: ${ui.esc(data.intake.cssrsPatient.verify)}</p></section>` };
  }

  function decisionBlock(p, it, route) {
    const dec = it.intake.decision;
    if (it.status !== 'completed' && it.status !== 'decided') {
      return '<p class="hint">Пациент ещё не завершил батарею — решение по маршруту пока недоступно.</p>';
    }
    const form = st.editing ? `<div class="decision" role="group" aria-labelledby="dlabel">
        <p id="dlabel"><b>Изменить маршрут</b></p>
        <label class="field"><span class="hint">Маршрут</span><select id="lvl">${LV.map((l) => `<option value="${l}" ${l === (st.level || dec?.level || route.level) ? 'selected' : ''}>${ui.esc(B.levelLabel(l))}</option>`).join('')}</select></label>
        <label class="field"><span class="hint">Причина (обязательно, если маршрут отличается от предложенного)</span><textarea id="note" rows="3">${ui.esc(st.note)}</textarea></label>
        ${st.error ? `<p class="err" role="alert">${ui.esc(st.error)}</p>` : ''}
        <div class="row wrap"><button class="btn btn--primary" data-save>Сохранить решение</button><button class="btn btn--ghost" data-cancel>Отмена</button></div></div>` : '';
    const decided = dec ? `<p>Решение ${ui.fmtDateTime(dec.at)}: ${P.levelBadge(dec.level)}${dec.overridden ? ' <span class="hint">· изменено относительно предложения</span>' : ''}</p>
        ${dec.note ? `<p class="hint">Причина / комментарий: «${ui.esc(dec.note)}»</p>` : ''}` : '';
    const handoff = dec ? (it.intake.handoff
      ? `<p class="hint">${ui.icon('check', 14)} Передано лечащему врачу ${ui.fmtDateTime(it.intake.handoff.at)}</p>`
      : '<button class="btn" data-handoff>Передать лечащему врачу</button>') : '';
    const buttons = st.editing ? '' : `<div class="row wrap">
        ${!dec && route.level ? '<button class="btn btn--primary" data-confirm>Подтвердить маршрут</button>' : ''}
        <button class="btn" data-edit>${dec ? 'Изменить решение' : 'Изменить'}</button>${handoff}</div>`;
    return `${decided}${buttons}${form}${st.saved ? `<p class="hint" role="status">${ui.esc(st.saved)}</p>` : ''}`;
  }

  function render() {
    const p = store.patient(id);
    const it = store.intakeOf(id);
    const route = B.routeIntake(it);
    const sf = safety(it, p);
    const au = store.audit(id).filter((a) => /^intake|ack_alert/.test(a.action)).slice(-6).reverse();
    const ACT = { intake_completed: 'пациент завершил батарею', intake_decision: 'решение по маршруту', intake_handoff: 'передано лечащему врачу', ack_alert: 'алерт подтверждён' };
    ui.preserveFocus(() => ui.mount('#app', `
      ${sf.banner}
      <header class="p-header"><div class="avatar">${ui.esc(p.initials)}</div>
        <div class="grow"><h1>${ui.esc(p.name)}</h1>
          <p class="muted">${ui.age(p.age)} · ${p.sex === 'f' ? 'жен.' : 'муж.'} · первичный приём назначен ${it.intake.assignedAt ? ui.fmtDate(it.intake.assignedAt) : '—'}</p>
          <div class="row wrap">${P.statusBadge(p)}${it.intake.completedAt ? `<span class="hint">заполнено ${ui.fmtDateTime(it.intake.completedAt)}</span>` : ''}</div></div></header>
      <p class="legal">${ui.esc(data.intake.legal)}</p>
      <div class="grid2" style="margin-top:12px">
        <div class="stack">
          ${sf.html}
          <section class="card stack"><h2>Предварительная оценка: маршрут</h2>
            <p class="hint">Предложение по правилам команды (${ui.esc(data.intake.teamNote)}). Решение принимает психолог.</p>
            ${P.routeHtml(route)}
            ${decisionBlock(p, it, route)}</section>
          <section class="card stack"><h2>Вопросы для беседы</h2>
            ${route.discrepancies.length ? `<ol class="q-list">${route.discrepancies.map((d) => `<li>${ui.esc(d.text)}</li>`).join('')}</ol>` : '<p class="hint">Расхождений между частями батареи не найдено.</p>'}
            <p class="hint">Это вопросы для уточнения на встрече, не выводы.</p></section>
          <section class="card stack"><h2>DASS-21</h2>${P.dassTiles(it.dass && it.dass.answers)}
            <p class="hint">Сумма подшкалы × 2, пороги — Lovibond & Lovibond, 1995. Деления полосы — норма / лёгкая / умеренная / выраженная / крайне выраженная.</p></section>
        </div>
        <div class="stack">
          <section class="card stack"><div class="row-between"><h2>Профиль TIPI-RU</h2><span class="hint">1–7</span></div>${P.tipiBars(it.tipi && it.tipi.answers)}
            <p class="hint">Описательный профиль; в маршрутизации не используется.</p></section>
          <section class="card stack"><h2>Цветовой тест отношений</h2>${P.ctoHtml(it.cto)}</section>
          <section class="card stack"><h2>Анкета</h2>${P.formHtml(it.form)}</section>
          <section class="card stack"><h2>Журнал</h2>
            ${au.map((a) => `<p class="hint">${ui.fmtDateTime(a.at)} · ${ui.esc(ACT[a.action] || a.action)}${a.details && a.details.level ? `: ${ui.esc(B.levelLabel(a.details.level))}` : ''}</p>`).join('') || '<p class="hint">Пока пусто</p>'}</section>
        </div>
      </div>`));
  }

  document.addEventListener('input', (e) => { if (e.target.id === 'note') st.note = e.target.value; });
  document.addEventListener('change', (e) => { if (e.target.id === 'lvl') st.level = e.target.value; });
  document.addEventListener('click', (e) => {
    const it = store.intakeOf(id);
    const route = B.routeIntake(it);
    if (e.target.closest('[data-confirm]')) {
      try { store.confirmIntake(id, { level: route.level, proposed: route.level }); st.saved = 'Маршрут подтверждён и записан в журнал'; } catch (err) { st.saved = err.message; }
      return render();
    }
    if (e.target.closest('[data-edit]')) { st.editing = true; st.error = ''; st.saved = ''; render(); document.getElementById('lvl')?.focus(); return; }
    if (e.target.closest('[data-cancel]')) { st.editing = false; st.error = ''; return render(); }
    if (e.target.closest('[data-save]')) {
      const level = document.getElementById('lvl').value;
      const note = document.getElementById('note').value;
      try {
        store.confirmIntake(id, { level, note, proposed: route.level });
        Object.assign(st, { editing: false, error: '', note: '', level: null, saved: 'Решение сохранено и записано в журнал' });
      } catch (err) { st.error = err.message; }
      render();
      if (st.error) document.getElementById('note')?.focus();
      return;
    }
    if (e.target.closest('[data-handoff]')) {
      try {
        store.handoffIntake(id, P.handoffText(store.patient(id), store.intakeOf(id), store.psychologist()));
        st.saved = 'Сводка передана лечащему врачу';
      } catch (err) { st.saved = err.message; }
      render();
    }
  });
  store.subscribe(render);
  render();
})();
