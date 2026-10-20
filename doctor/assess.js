(function () {
  const { ui, store, doctorApp: D, data } = KK;
  D.start({ nav: 'patients' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('index.html'); return; }
  const sid = D.assessScale(ui.param('scale'), store.patient(id).signals.some((s) => s.ruleId === 'si_phq9'));
  let answers = [];
  let saved = null; // итог сохранённой формы — показываем на месте, без автоперехода (может всплыть критический алерт)

  function formHtml(def, f) {
    return `<section class="card stack"><h2>${ui.esc(def.title)}</h2><p class="muted">${ui.esc(def.instruction)}</p>
        <table class="table scale-table"><tbody>${f.shown.map((i) => `<tr><td style="width:32px" class="hint">${i + 1}</td><td>${ui.esc(def.items[i])}</td>
          <td><div class="opts" role="radiogroup" aria-label="Вопрос ${i + 1}">${def.options.map((o) => `<label title="${ui.esc(o.label)}"><input type="radio" name="q${i}" value="${o.v}" ${answers[i] === o.v ? 'checked' : ''}><span>${sid === 'cssrs' ? ui.esc(o.label) : o.v}</span></label>`).join('')}</div></td></tr>`).join('')}</tbody></table>
        ${sid !== 'cssrs' ? `<p class="hint">${def.options.map((o) => `${o.v} — ${ui.esc(o.label)}`).join(' · ')}</p>` : ''}
        <div class="total row-between"><div><b>${ui.esc(f.summary)}</b>${D.mode() === 'nonPsychiatrist' && f.filled ? ' <span class="badge badge--info">предварительно</span>' : ''}
          <div class="hint">${ui.esc(def.source)} · ${ui.esc(def.license)}</div></div>
          <button class="btn btn--primary" data-save ${f.filled ? '' : 'aria-disabled="true"'}>Сохранить в карту</button></div>
        <p class="hint" id="msg" role="status"></p></section>`;
  }
  function savedHtml(def) {
    return `<section class="card stack" role="status"><h2>${ui.esc(def.title)}</h2>
        <p>${ui.icon('check', 18)} Сохранено в карту: <b>${ui.esc(saved)}</b></p>
        <div class="row wrap"><a class="btn btn--primary" href="patient.html?id=${ui.esc(id)}">Открыть карточку</a>
          <button class="btn btn--ghost" data-again>Заполнить ещё раз</button></div></section>`;
  }
  function render() {
    const p = store.patient(id);
    const def = data.scales[sid];
    ui.preserveFocus(() => ui.mount('#app', `
      ${D.patientHeader(p)}${D.patientTabs(id, 'assess')}
      <nav class="row wrap" aria-label="Шкала" style="margin-bottom:12px">${D.ASSESS_SCALES.map((x) => `<a class="btn ${x === sid ? 'btn--primary' : ''}" href="?id=${ui.esc(id)}&scale=${x}" ${x === sid ? 'aria-current="page"' : ''}>${ui.esc(data.scales[x].title.split(' —')[0])}</a>`).join('')}</nav>
      ${saved ? savedHtml(def) : formHtml(def, D.assessForm(sid, answers))}`));
  }
  document.addEventListener('change', (e) => {
    const m = /^q(\d+)$/.exec(e.target.name || '');
    if (m) { answers[Number(m[1])] = Number(e.target.value); render(); }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-again]')) { saved = null; render(); return; }
    if (!e.target.closest('[data-save]')) return;
    const f = D.assessForm(sid, answers);
    if (!f.filled) { document.getElementById('msg').textContent = 'Ответьте на все вопросы.'; return; }
    saved = f.summary;
    answers = [];
    // addEvent синхронно поднимает алерты; критический покажет модальное окно D.start — страницу не покидаем.
    store.addEvent(id, 'scale', { scaleId: sid, answers: f.full });
    render();
  });
  store.subscribe(render);
  render();
})();
