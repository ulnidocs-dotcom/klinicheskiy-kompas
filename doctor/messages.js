(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'messages' });
  let pid = ui.param('id') || store.patients()[0].id;
  if (!store.patient(pid)) pid = store.patients()[0].id;
  let draft = '';
  const TPL = ['Как вы себя чувствуете на лечении?', 'Пожалуйста, пройдите короткий опросник в приложении.', 'Давайте созвонимся сегодня. Когда вам удобно?'];
  function render() {
    const ps = store.patients();
    const p = store.patient(pid);
    const msgs = store.messages(pid);
    ui.preserveFocus(() => ui.mount('#app', `
      <div class="page-head"><h1>Сообщения</h1></div>
      <div class="thread">
        <nav class="list card" aria-label="Пациенты">${ps.map((x) => { const last = store.messages(x.id).filter((m) => m.from !== 'system').at(-1);
          return `<a href="?id=${ui.esc(x.id)}" ${x.id === pid ? 'aria-current="page"' : ''}><b>${ui.esc(x.name)}</b><br><span class="hint">${last ? ui.esc(last.text.slice(0, 40)) : 'нет сообщений'}</span></a>`; }).join('')}</nav>
        <section class="card stack"><div class="row-between"><h2>${ui.esc(p.name)}</h2><a href="patient.html?id=${ui.esc(pid)}">Карточка</a></div>
          <div class="stack" aria-live="polite">${msgs.map((m) => `<div class="msg ${m.from === 'doctor' ? 'me' : m.from === 'system' ? 'sys' : ''}">${ui.esc(m.text)}<div class="hint">${ui.fmtDateTime(m.at)}</div></div>`).join('') || '<p class="hint">Переписки пока нет</p>'}</div>
          <div class="row wrap">${TPL.map((t) => `<button class="btn btn--ghost" data-tpl="${ui.esc(t)}">${ui.esc(t.slice(0, 32))}…</button>`).join('')}</div>
          <form id="f" class="row"><label class="sr-only" for="t">Сообщение</label><input id="t" class="input grow" style="flex:1" placeholder="Сообщение пациенту" value="${ui.esc(draft)}"><button class="btn btn--primary">Отправить</button></form>
        </section></div>`));
  }
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-tpl]'); if (t) { draft = t.dataset.tpl; document.getElementById('t').value = draft; } });
  document.addEventListener('input', (e) => { if (e.target.id === 't') draft = e.target.value; });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = document.getElementById('t').value.trim();
    if (!v) return;
    draft = ''; store.sendMessage(pid, 'doctor', v); render();
  });
  store.subscribe(render);
  render();
})();
