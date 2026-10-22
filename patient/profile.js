(function () {
  const { ui, store, patientApp: app } = KK;
  const ctx = app.start();
  if (!ctx) return;
  const C = app.MOVE_COPY;
  let linkCode = null; let exported = '';
  const siteUrl = () => new URL('onboarding.html?site=1', location.href).href;
  function render() {
    const p = ctx.patient();
    const prefs = app.prefs(p.id);
    const chans = store.channels(p.id);
    const theme = KK.theme.pref();
    ui.preserveFocus(() => ui.mount('#app', `
      <header class="p-head"><h1>${ui.esc(p.name)}</h1><p class="muted">Ваш врач: ${ui.esc(store.doctor().name)}</p></header>
      <div class="stack">
        <section class="card stack"><p class="q-title">Оформление</p>
          <div class="seg" role="group" aria-label="Тема">${[['light', 'Дневная'], ['dark', 'Ночная'], ['auto', 'Системная']].map(([v, l]) =>
            `<button id="th-${v}" data-theme-set="${v}" aria-pressed="${theme === v}">${l}</button>`).join('')}</div>
          <p class="hint">Стиль</p>
          <div class="seg" role="group" aria-label="Стиль оформления">${[['aura', 'Аура'], ['sunset', 'Закат'], ['widgets', 'Виджеты']].map(([v, l]) =>
            `<button data-style-set="${v}" aria-pressed="${KK.theme.style() === v}">${l}</button>`).join('')}</div>
          <a class="hint" href="../variants.html">Посмотреть все вариации дизайна</a></section>
        <section class="card stack"><p class="q-title">Опросники</p><p class="hint">Предлагать короткие опросники раз в</p>
          <div class="seg" role="group" aria-label="Частота">${[[7, 'Неделя'], [14, '2 недели'], [28, 'Месяц']].map(([v, l]) =>
            `<button data-every="${v}" aria-pressed="${prefs.scaleEveryDays === v}">${l}</button>`).join('')}</div></section>
        <section class="card"><label class="check"><input type="checkbox" data-rem ${prefs.reminders ? 'checked' : ''}><span>Напоминать о приёме лекарства</span></label></section>
        <section class="card stack"><p class="q-title">Где открыт дневник</p>
          ${chans.map((c) => `<div class="row-between"><span>${ui.esc(KK.host.LABELS[c.channel] || c.channel)}${c.channel === KK.host.platform ? ' <span class="hint">· здесь</span>' : ''}</span><button class="btn btn--ghost" data-unlink="${ui.esc(c.channel)}">Отключить</button></div>`).join('') || '<p class="hint">Пока нигде</p>'}
          <button class="btn btn--block" data-move>${ui.esc(C[0])}</button>
          ${linkCode ? `<div class="move-code stack" role="status"><p>${ui.esc(C[1])}</p><p class="hint">${ui.esc(siteUrl())}</p>
            <p class="link-code" aria-label="Код ${linkCode.code.split('').join(' ')}">${linkCode.code}</p><p class="hint">${ui.esc(C[2])}</p>
            <button class="btn btn--ghost" data-open-site>Открыть ссылку</button></div>` : ''}</section>
        <section class="card stack"><p class="q-title">Данные</p>
          <p class="hint">Ваши отметки видит только ваш лечащий врач. Вы можете отозвать согласие, написав врачу.</p>
          <button class="btn btn--block" data-export>Скачать мои данные</button>
          ${exported ? `<p class="hint">Здесь файл не скачивается. Скопируйте текст и сохраните его.</p><textarea class="bundle-text" readonly rows="6">${ui.esc(exported)}</textarea><button class="btn btn--ghost" data-copy>Скопировать</button>` : ''}</section>
        <a class="btn btn--ghost btn--block" href="../index.html">Демо: выбрать другого пациента</a>
      </div>`));
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-move]')) { linkCode = store.createLinkCode(ctx.pid); render(); return; }
    if (e.target.closest('[data-open-site]')) { KK.host.openLink(siteUrl()); return; }
    const un = e.target.closest('[data-unlink]');
    if (un) {
      app.unlink(ctx.pid, un.dataset.unlink);
      if (un.dataset.unlink === KK.host.platform) { location.replace(`onboarding.html?p=${ctx.pid}`); return; } // это устройство больше не подключено
      render(); return;
    }
    if (e.target.closest('[data-export]')) {
      const text = JSON.stringify(KK.bundle.exportBundle(store, ctx.pid, new Date(), KK.sync.queued(ctx.pid)), null, 2);
      if (KK.host.download(KK.bundle.fileName(ctx.pid), text)) app.toast('Файл сохранён'); else { exported = text; render(); }
      return;
    }
    if (e.target.closest('[data-copy]')) {
      const ta = document.querySelector('.bundle-text');
      ta.select();
      (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => app.toast('Скопировано'), () => app.toast('Выделите текст и скопируйте вручную'));
      return;
    }
    const sb = e.target.closest('[data-style-set]');
    if (sb) { KK.theme.setStyle(sb.dataset.styleSet); document.querySelectorAll('[data-style-set]').forEach((b) => b.setAttribute('aria-pressed', String(b === sb))); return; }
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
