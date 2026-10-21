(function () {
  const { ui, store, patientApp } = KK;
  const ctx = patientApp.start({ tab: null, requireLink: false, help: false });
  if (!ctx) return;
  const p = ctx.patient();
  let step = 0;
  // Экран помощи открывается и до подключения (help.js: requireLink: false).
  const helpLink = `<a class="hint" href="help.html?p=${encodeURIComponent(ctx.pid)}">${ui.icon('heart', 16)} Нужна помощь сейчас</a>`;
  const state = { phone: (p.phone || ''), phoneSent: false, demo: '', code: '', consents: { pd: false, doctor: false, notEmergency: false } };
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
          <input id="site-code" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>
        <p class="hint" id="err" role="alert"></p>
        <button class="btn btn--pill btn--block" data-redeem>Продолжить</button>
        <p class="hint">Нет кода? Откройте приложение → Профиль → «Открыть дневник на сайте» — там появится новый код.</p>
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
    if (step === 'phone') return `
      <section class="stack-l" style="padding-top:6vh">
        <h1>Ваш телефон</h1>
        <p class="muted">По нему вы будете входить в дневник на сайте. Номер увидят только ваши лечащие специалисты.</p>
        ${KK.host.platform === 'max' ? '<button class="btn btn--block" data-contact>Поделиться номером из MAX</button>' : ''}
        <label class="field"><span class="hint">Мобильный телефон</span>
          <input id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${ui.esc(state.phone)}"></label>
        ${state.phoneSent ? `${KK.authPage.demoNote(`код ${state.demo}. В настоящей версии он придёт по SMS`)}
          <label class="field"><span class="hint">Код из SMS</span><input id="otp" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>` : ''}
        <p class="hint" id="err" role="alert"></p>
        <button class="btn btn--pill btn--block" ${state.phoneSent ? 'data-phone-verify>Подтвердить' : 'data-phone-send>Получить код'}</button>
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
  // В браузере онбординг показан в раскладке сайта (о сервисе слева), в мессенджере — полноэкранно.
  function render() {
    if (KK.host.platform === 'web' && KK.authPage) {
      // На сайте онбординг выходит из узкой колонки мини-приложения: раскладка входа на всю ширину.
      document.getElementById('app').classList.add('p-app--site');
      const top = document.querySelector('.p-top');
      if (top) top.classList.add('p-top--site');
      KK.authPage.mount(view());
    } else ui.mount('#app', view());
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-site]')) { step = 'site'; render(); return; }
    if (e.target.closest('[data-redeem]')) {
      const code = document.getElementById('site-code').value.replace(/\D/g, '');
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
      step = 'phone'; render();
    }
    if (e.target.closest('[data-contact]')) {
      KK.host.requestPhone().then((raw) => {
        const n = KK.auth.normalizePhone(raw);
        if (n) { state.phone = n; render(); } else document.getElementById('err').textContent = 'Номер не получен. Введите его вручную.';
      });
      return;
    }
    if (e.target.closest('[data-phone-send]')) {
      const n = KK.auth.normalizePhone(document.getElementById('phone').value);
      if (!n) { document.getElementById('err').textContent = 'Проверьте номер: нужен российский мобильный, например +7 900 000-00-00'; return; }
      const owner = store.findPatientByPhone(n);
      if (owner && owner !== ctx.pid) { document.getElementById('err').textContent = 'Этот номер уже привязан к дневнику. Войдите по номеру телефона'; return; }
      state.phone = n; state.demo = store.requestOtp(n, 'patient_register').code; state.phoneSent = true; render();
      return;
    }
    if (e.target.closest('[data-phone-verify]')) {
      try {
        store.verifyOtp(state.phone, 'patient_register', document.getElementById('otp').value);
        store.setPatientPhone(ctx.pid, state.phone);
      } catch (err) { document.getElementById('err').textContent = err.message; return; }
      step = 2; render();
      return;
    }
    if (e.target.closest('[data-done]')) {
      if (!Object.values(state.consents).every(Boolean)) { document.getElementById('err').textContent = 'Отметьте все пункты, чтобы продолжить.'; return; }
      store.recordConsents(ctx.pid, ['data_processing', 'doctor_access', 'not_emergency']);
      patientApp.link(ctx.pid);
      store.sendMessage(ctx.pid, 'system', 'Пациент подключился к дневнику');
      location.href = `index.html?p=${ctx.pid}`;
    }
  });
  // Номер изменили после отправки кода — код нужен заново. Без перерисовки, чтобы не терять фокус.
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'phone' || !state.phoneSent) return;
    state.phoneSent = false;
    const o = document.getElementById('otp');
    if (o) o.closest('label').remove();
    const note = document.querySelector('.demo-note');
    if (note) note.remove();
    const b = document.querySelector('[data-phone-verify]');
    if (b) { b.removeAttribute('data-phone-verify'); b.setAttribute('data-phone-send', ''); b.textContent = 'Получить код'; }
  });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset.c;
    if (k) { state.consents[k] = e.target.checked; render(); }
  });
  render();
})();
