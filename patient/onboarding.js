(function () {
  const { ui, store, patientApp } = KK;
  const ctx = patientApp.start({ tab: null, requireLink: false, help: false });
  if (!ctx) return;
  const p = ctx.patient();
  let step = 0;
  const state = { code: '', consents: { pd: false, doctor: false, notEmergency: false } };

  function view() {
    if (step === 0) return `
      <section class="stack-l" style="padding-top:12vh">
        <div style="color:var(--accent)">${ui.icon('leaf', 40)}</div>
        <h1>Здравствуйте</h1>
        <p class="muted">Здесь вы и ваш врач видите, как меняется самочувствие. Отметки занимают меньше минуты в день.</p>
        <button class="btn btn--primary btn--block" data-next>Начать</button>
      </section>`;
    if (step === 1) return `
      <section class="stack-l" style="padding-top:8vh">
        <h1>Код от врача</h1>
        <p class="muted">Врач выдал вам код приглашения. Он связывает ваш дневник с вашей медицинской картой.</p>
        <label class="field"><span class="hint">Код приглашения</span>
          <input id="code" autocomplete="one-time-code" inputmode="text" placeholder="KMP-0000" value="${ui.esc(state.code)}"></label>
        <p class="hint">Для демо: ${ui.esc(p.inviteCode)}</p>
        <p class="hint" id="err" role="alert"></p>
        <button class="btn btn--primary btn--block" data-check>Продолжить</button>
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
        <button class="btn btn--primary btn--block" data-done ${Object.values(c).every(Boolean) ? '' : 'aria-disabled="true"'}>Готово</button>
        <p class="hint" id="err" role="alert"></p>
      </section>`;
  }
  function render() { ui.mount('#app', view()); }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) { step = 1; render(); }
    if (e.target.closest('[data-check]')) {
      state.code = document.getElementById('code').value.trim().toUpperCase();
      if (state.code !== p.inviteCode) { document.getElementById('err').textContent = 'Код не подошёл. Проверьте буквы и цифры или спросите у врача.'; return; }
      step = 2; render();
    }
    if (e.target.closest('[data-done]')) {
      if (!Object.values(state.consents).every(Boolean)) { document.getElementById('err').textContent = 'Отметьте все пункты, чтобы продолжить.'; return; }
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
