(function () {
  const { ui, store, patientApp: app } = KK;
  const ctx = app.start();
  if (!ctx) return;
  const CHIPS = ['Вопрос о лекарстве', 'Хочу перенести визит', 'Появились побочные эффекты'];
  function render() {
    const prev = document.getElementById('t');
    const draft = prev ? prev.value : '';
    const doc = store.doctor();
    const msgs = store.messages(ctx.pid).filter((m) => m.from !== 'system');
    ui.mount('#app', `
      <header class="p-head"><h1>Ваш врач</h1><p class="muted">${ui.esc(doc.name)} · ${ui.esc(doc.specialty)}</p>
        <p class="hint">Врач отвечает в рабочее время. В экстренной ситуации звоните 112.</p></header>
      <section class="stack" id="msgs" aria-live="polite">
        ${msgs.length ? msgs.map((m) => `<div class="bubble ${m.from === 'patient' ? 'me' : ''}"><div>${ui.esc(m.text)}</div><div class="t">${ui.fmtDateTime(m.at)}</div></div>`).join('')
          : '<p class="hint">Здесь будет ваша переписка с врачом.</p>'}
      </section>
      <div class="chips" style="margin-top:16px">${CHIPS.map((c) => `<button class="chip" data-chip="${ui.esc(c)}">${ui.esc(c)}</button>`).join('')}</div>
      <form class="compose" id="f"><label class="sr-only" for="t">Сообщение</label>
        <textarea id="t" rows="1" placeholder="Напишите сообщение">${ui.esc(draft)}</textarea>
        <button class="btn btn--primary" aria-label="Отправить">${ui.icon('chat', 18)}</button></form>`);
  }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-chip]');
    if (c) { const t = document.getElementById('t'); t.value = c.dataset.chip + ': '; t.focus(); }
  });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = document.getElementById('t');
    const text = t.value.trim();
    if (!text) return;
    store.sendMessage(ctx.pid, 'patient', text);
    render();
  });
  store.subscribe(render);
  render();
})();
