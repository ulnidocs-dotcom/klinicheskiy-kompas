(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'patients' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('index.html'); return; }
  let text = null;
  const AUTO_MSG = D.ROUTING_PATIENT_MSG;
  function render() {
    const p = store.patient(id);
    const mode = D.mode();
    const sig = p.signals.filter((s) => s.routing);
    if (text == null) text = D.referralText(p, store.doctor());
    ui.preserveFocus(() => ui.mount('#app', `
      ${D.patientHeader(p)}${D.patientTabs(id, 'routing')}
      <div class="grid2">
        <div class="stack">
          <section class="card stack"><h2>Основания</h2>
            ${sig.length ? sig.map((s) => D.signalHtml(s, mode)).join('') : '<p class="muted">Правила маршрутизации не сработали. Направление возможно по клиническому решению.</p>'}
            <p class="hint">«Обязательно» — сплошная плашка, «Желательно» — пунктирная. Пороги и источники — в разделе «Материалы → Правила».</p></section>
        </div>
        <div class="stack">
          <section class="card stack"><h2>Направление</h2>
            ${p.routingConfirmed ? `<div class="signal"><span class="badge badge--ok">Оформлено</span><span>${ui.fmtDateTime(p.routingConfirmed.at)} · ${p.routingConfirmed.level === 'required' ? 'обязательно' : 'желательно'}</span></div>` : ''}
            <label class="field"><span class="hint">Текст направления (можно отредактировать)</span><textarea id="ref" style="min-height:280px;font-family:var(--font-body)">${ui.esc(text)}</textarea></label>
            <div class="row wrap">
              ${p.routingConfirmed ? '' : `<button class="btn btn--primary" data-confirm aria-describedby="auto-msg">Подтвердить направление</button>`}
              <button class="btn" data-copy>Скопировать</button></div>
            ${p.routingConfirmed ? '' : `<p class="hint" id="auto-msg">После подтверждения пациенту автоматически уйдёт сообщение: «${ui.esc(AUTO_MSG)}»</p>`}
            <p class="hint" id="msg" role="status"></p></section>
        </div>
      </div>`));
  }
  document.addEventListener('input', (e) => { if (e.target.id === 'ref') text = e.target.value; });
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-confirm]')) {
      const p = store.patient(id);
      store.confirm(id, 'confirm_routing', { level: p.routing || 'desirable', note: text });
      store.sendMessage(id, 'doctor', AUTO_MSG);
      render();
    }
    if (e.target.closest('[data-copy]')) {
      try { await navigator.clipboard.writeText(text); document.getElementById('msg').textContent = 'Скопировано'; }
      catch (err) { document.getElementById('ref').select(); document.getElementById('msg').textContent = 'Выделено — нажмите Ctrl+C'; }
    }
  });
  store.subscribe(render);
  render();
})();
