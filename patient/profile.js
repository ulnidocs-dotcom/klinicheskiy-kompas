(function () {
  const { ui, store, patientApp: app } = KK;
  const ctx = app.start();
  if (!ctx) return;
  function render() {
    const p = ctx.patient();
    const prefs = app.prefs(p.id);
    const theme = KK.theme.pref();
    ui.preserveFocus(() => ui.mount('#app', `
      <header class="p-head"><h1>${ui.esc(p.name)}</h1><p class="muted">Ваш врач: ${ui.esc(store.doctor().name)}</p></header>
      <div class="stack">
        <section class="card stack"><p class="q-title">Оформление</p>
          <div class="seg" role="group" aria-label="Тема">${[['light', 'Дневная'], ['dark', 'Ночная'], ['auto', 'Как в системе']].map(([v, l]) =>
            `<button id="th-${v}" data-theme-set="${v}" aria-pressed="${theme === v}">${l}</button>`).join('')}</div></section>
        <section class="card stack"><p class="q-title">Опросники</p><p class="hint">Как часто предлагать короткие опросники</p>
          <div class="seg" role="group" aria-label="Частота">${[[7, 'Раз в неделю'], [14, 'Раз в 2 недели'], [28, 'Раз в месяц']].map(([v, l]) =>
            `<button data-every="${v}" aria-pressed="${prefs.scaleEveryDays === v}">${l}</button>`).join('')}</div></section>
        <section class="card"><label class="check"><input type="checkbox" data-rem ${prefs.reminders ? 'checked' : ''}><span>Напоминать о приёме лекарства</span></label></section>
        <section class="card stack"><p class="q-title">Данные</p>
          <p class="hint">Ваши отметки видит только ваш лечащий врач. Вы можете отозвать согласие, написав врачу.</p></section>
        <a class="btn btn--ghost btn--block" href="../index.html">Демо: выбрать другого пациента</a>
      </div>`));
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme-set]');
    if (t) { KK.theme.set(t.dataset.themeSet); return; }
    const ev = e.target.closest('[data-every]');
    if (ev) { app.setPrefs(ctx.pid, { scaleEveryDays: Number(ev.dataset.every) }); render(); }
  });
  // Тема переключается и из шапки: обновляем только сегмент, не трогая введённые данные.
  document.addEventListener('kk:themechange', () => document.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(KK.theme.pref() === b.dataset.themeSet))));
  document.addEventListener('change', (e) => { if (e.target.matches('[data-rem]')) app.setPrefs(ctx.pid, { reminders: e.target.checked }); });
  render();
})();
