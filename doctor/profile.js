(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'profile' });
  const SPECS = ['терапевт', 'врач общей практики', 'невролог', 'кардиолог', 'эндокринолог', 'психиатр', 'психотерапевт'];
  function render() {
    const d = store.doctor();
    ui.preserveFocus(() => ui.mount('#app', `
      <div class="page-head"><h1>Профиль</h1></div>
      <section class="card stack" style="max-width:560px">
        <label class="field"><span class="hint">ФИО</span><input id="name" value="${ui.esc(d.name)}"></label>
        <label class="field"><span class="hint">Специальность</span><select id="spec">${SPECS.map((s) => `<option ${s === d.specialty ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <p class="hint">Режим: <b>${d.mode === 'psychiatrist' ? 'специалист — компактно, без пояснений' : 'с подсказками — пояснения к шкалам и шагам маршрутизации'}</b>. Определяется специальностью.</p>
        <label class="row"><input type="checkbox" id="sound" ${d.sound === false ? '' : 'checked'}> Звук критических алертов</label>
        <div class="row"><button class="btn btn--primary" data-save>Сохранить</button><span class="hint" id="msg" role="status"></span></div>
      </section>
      <section class="card stack" style="max-width:560px;margin-top:16px"><h2>Оформление</h2>
        <div class="seg" role="group" aria-label="Тема">${[['light', 'Дневная'], ['dark', 'Ночная'], ['auto', 'Как в системе']].map(([v, l]) =>
          `<button id="th-${v}" data-theme-set="${v}" aria-pressed="${KK.theme.pref() === v}">${l}</button>`).join('')}</div>
        <p class="hint">Выбор общий для кабинетов врача и пациента на этом устройстве.</p></section>
      <section class="card stack" style="max-width:560px;margin-top:16px"><h2>Демо</h2>
        <p class="hint">Сброс вернёт 6 сценариев в исходное состояние на этом устройстве.</p>
        <button class="btn" data-reset>Сбросить демо-данные</button></section>`));
  }
  // Тема переключается и из шапки: обновляем только сегмент, не трогая введённые данные.
  document.addEventListener('kk:themechange', () => document.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(KK.theme.pref() === b.dataset.themeSet))));
  document.addEventListener('click', (e) => {
    const th = e.target.closest('[data-theme-set]');
    if (th) { KK.theme.set(th.dataset.themeSet); return; }
    if (e.target.closest('[data-save]')) {
      const spec = document.getElementById('spec').value;
      store.setDoctor({ name: document.getElementById('name').value.trim() || 'Врач', specialty: spec, mode: D.modeFor(spec), sound: document.getElementById('sound').checked });
      render(); document.getElementById('msg').textContent = 'Сохранено';
    }
    if (e.target.closest('[data-reset]') && confirm('Сбросить демо-данные?')) {
      try { D.demoDeviceKeys(Object.keys(localStorage)).forEach((k) => localStorage.removeItem(k)); } catch (err) { /* приватный режим */ }
      store.reset(); location.href = 'index.html';
    }
  });
  render();
})();
