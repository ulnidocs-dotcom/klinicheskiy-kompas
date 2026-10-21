(function () {
  const { ui, store, patientApp } = KK;
  const ctx = patientApp.start({ tab: null, requireLink: false, help: false });
  if (!ctx) return;
  const p = ctx.patient();
  let step = 0;
  // Экран помощи открывается и до подключения (help.js: requireLink: false).
  const helpLink = `<a class="hint" href="help.html?p=${encodeURIComponent(ctx.pid)}">${ui.icon('heart', 16)} Нужна помощь сейчас</a>`;
  const state = { code: '', consents: { pd: false, doctor: false, notEmergency: false } };
  const fromLink = patientApp.inviteFromStart(KK.host.startParam());
  if (fromLink) state.code = fromLink;
  const C = patientApp.MOVE_COPY;
  if (ui.param('site') === '1') step = 'site';

  function view() {
    if (step === 'site') return `
      <section class="stack-l" style="padding-top:8vh">
        <h1>${ui.esc(C[3])}</h1>
        <p class="muted">${ui.esc(C[4])}</p>
        <label class="field"><span class="hint">Код</span>
          <input id="site-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label>
        <p class="hint" id="err" role="alert"></p>
        <button class="btn btn--pill btn--block" data-redeem>Продолжить</button>
        ${helpLink}
      </section>`;
    if (step === 0) return `
      <section class="stack-l" style="padding-top:12vh">
        <div class="hello-orb" aria-hidden="true"></div>
        <h1>Здравствуйте</h1>
        <p class="muted">Здесь вы и ваш врач видите, как меняется самочувствие. Отметки занимают меньше минуты в день.</p>
        <button class="btn btn--pill btn--block" data-next>Начать</button>
        ${helpLink}
      </section>`;
    if (step === 1) return `
      <section class="stack-l" style="padding-top:8vh">
        <h1>Код от врача</h1>
        <p class="muted">Врач выдал вам код приглашения. Он связывает ваш дневник с вашей медицинской картой.</p>
        <label class="field"><span class="hint">Код приглашения</span>
          <input id="code" autocomplete="one-time-code" inputmode="text" placeholder="KMP-0000" value="${ui.esc(state.code)}"></label>
        <p class="hint">Для демо: ${ui.esc(p.inviteCode)}</p>
        <p class="hint" id="err" role="alert"></p>
        <button class="btn btn--pill btn--block" data-check>Продолжить</button>
        <button class="btn btn--ghost btn--block" data-site>${ui.esc(C[3])}</button>
        ${helpLink}
      </section>`;
    const c = state.consents;
    return `
      <section class="stack-l" style="padding-top:6vh">
        <h1>Перед началом</h1>
        <div class="card">
          <label class="check"><input type="checkbox" data-c="pd" ${c.pd ? 'checked' : ''}><span>Согласен(на) на обработку персональных данных, включая данные о здоровье, в соответствии с 152-ФЗ</span></label>
          <label class="check"><input type="checkbox" data-c="doctor" ${c.doctor ? 'checked' : ''}><span>Мои отметки будут видны только моему лечащему врачу</span></label>
          <label class="check"><input type="checkbox" data-c="notEmergency" ${c.notEmergency ? 'checked' : ''}><span>Понимаю, что приложение не заменяет экстренную помощь. В опасной ситуации звоню 112</span></label>
        </div>
        <button class="btn btn--pill btn--block" data-done ${Object.values(c).every(Boolean) ? '' : 'aria-disabled="true"'}>Готово</button>
        <p class="hint" id="err" role="alert"></p>
        ${helpLink}
      </section>`;
  }
  function render() { ui.mount('#app', view()); }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-site]')) { step = 'site'; render(); return; }
    if (e.target.closest('[data-redeem]')) {
      const code = document.getElementById('site-code').value.replace(/D/g, '');
      try {
        const pid = store.redeemLinkCode(code, 'web');
        try { localStorage.setItem(`kk:linked:${pid}`, 'true'); } catch (err) { /* приватный режим */ }
        location.href = `index.html?p=${encodeURIComponent(pid)}`;
      } catch (err) { document.getElementById('err').textContent = err.message; }
      return;
    }
    if (e.target.closest('[data-next]')) { step = 1; render(); }
    if (e.target.closest('[data-check]')) {
      state.code = document.getElementById('code').value.trim().toUpperCase();
      if (state.code !== p.inviteCode) { document.getElementById('err').textContent = 'Код не подошёл. Проверьте буквы и цифры или спросите у врача.'; return; }
      step = 2; render();
    }
    if (e.target.closest('[data-done]')) {
      if (!Object.values(state.consents).every(Boolean)) { document.getElementById('err').textContent = 'Отметьте все пункты, чтобы продолжить.'; return; }
      store.recordConsents(ctx.pid, ['data_processing', 'doctor_access', 'not_emergency']);
      patientApp.link(ctx.pid);
      store.sendMessage(ctx.pid, 'system', 'Пациент подключился к дневнику');
      location.href = `index.html?p=${ctx.pid}`;
    }
  });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset.c;
    if (k) { state.consents[k] = e.target.checked; render(); }
  });
  render();
})();
