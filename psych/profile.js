(function () {
  const { ui, store, psychApp: P } = KK;
  P.start({ nav: 'profile' });
  function render() {
    const d = store.psychologist();
    ui.preserveFocus(() => ui.mount('#app', `
      <div class="page-head"><h1>Профиль</h1></div>
      <section class="card stack" style="max-width:560px">
        <label class="field"><span class="hint">ФИО</span><input id="name" value="${ui.esc(d.name)}"></label>
        <p class="hint">Специальность: <b>${ui.esc(d.specialty)}</b>. Кабинет показывает предварительную оценку и предложение маршрута; диагноз психического расстройства устанавливает врач-психиатр.</p>
        <div class="row"><button class="btn btn--primary" data-save>Сохранить</button><span class="hint" id="msg" role="status"></span></div>
      </section>
      <section class="card stack" style="max-width:560px;margin-top:16px"><h2>Оформление</h2>
        <div class="seg" role="group" aria-label="Тема">${[['light', 'Дневная'], ['dark', 'Ночная'], ['auto', 'Как в системе']].map(([v, l]) =>
          `<button id="th-${v}" data-theme-set="${v}" aria-pressed="${KK.theme.pref() === v}">${l}</button>`).join('')}</div>
        <p class="hint">Выбор общий для всех кабинетов на этом устройстве.</p></section>`));
  }
  document.addEventListener('kk:themechange', () => document.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(KK.theme.pref() === b.dataset.themeSet))));
  document.addEventListener('click', (e) => {
    const th = e.target.closest('[data-theme-set]');
    if (th) { KK.theme.set(th.dataset.themeSet); return; }
    if (e.target.closest('[data-save]')) {
      store.setPsychologist({ name: document.getElementById('name').value.trim() || 'Психолог' });
      render(); document.getElementById('msg').textContent = 'Сохранено';
    }
  });
  render();
})();
