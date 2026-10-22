(function () {
  const { ui, store, patientApp } = KK;
  // Одноразовое приглашение врача (?invite=<токен> или startapp=inv_<токен>): пациента определяет токен,
  // шаг «Код от врача» пропускается. Ссылка с параметром invite, но без верного токена — «не найдена».
  const rawInvite = ui.param('invite');
  const token = patientApp.inviteToken(rawInvite, KK.host.startParam());
  const invite = token ? store.patientInviteInfo(token) : rawInvite != null ? { state: 'unknown' } : null;
  // Номер отличался от карты и ждёт врача: запрос помним во вкладке, чтобы повторное открытие ссылки показало ожидание
  // (и завершило подключение, если врач уже подтвердил — тогда ссылка уже погашена).
  const WAIT_KEY = token ? `kk:phone-confirm:${token}` : null;
  const waitGet = () => { try { return WAIT_KEY ? sessionStorage.getItem(WAIT_KEY) : null; } catch (e) { return null; } };
  const waitSet = (v) => { try { if (WAIT_KEY) { if (v) sessionStorage.setItem(WAIT_KEY, v); else sessionStorage.removeItem(WAIT_KEY); } } catch (e) { /* приватный режим */ } };
  const waitRec = waitGet() ? store.phoneConfirms({}).find((c) => c.id === waitGet() && c.token === token) || null : null;
  const ctx = patientApp.start({ tab: null, requireLink: false, help: false,
    pid: invite && invite.state === 'pending' ? invite.patientId : waitRec ? waitRec.patientId : null });
  if (!ctx) return;
  const p = ctx.patient();
  let step = waitRec ? 'wait' : invite && invite.state !== 'pending' ? 'invite_bad' : 0;
  // Экран помощи открывается и до подключения (help.js: requireLink: false).
  const helpLink = `<a class="hint" href="help.html?p=${encodeURIComponent(ctx.pid)}">${ui.icon('heart', 16)} Нужна помощь сейчас</a>`;
  // По приглашению номер из карты не подставляем: ссылку могли переслать, номер в карте — не для чужих глаз.
  const state = { phone: invite ? '' : (p.phone || ''), phoneSent: false, demo: '', code: '', consents: { pd: false, doctor: false, notEmergency: false },
    inviteText: invite && invite.state !== 'pending' ? store.patientInviteText(invite.state) : '', confirmId: waitRec ? waitRec.id : null, waitNote: '' };
  const fromLink = patientApp.inviteFromStart(KK.host.startParam());
  if (fromLink) state.code = fromLink;
  const C = patientApp.MOVE_COPY;
  if (ui.param('site') === '1') step = 'site';
  const NO_CODE_TEXT = 'Откройте ссылку-приглашение от врача из SMS или QR-кода. Если ссылки нет — попросите врача прислать новое приглашение.';
  const WAIT_TEXT ='Номер отличается от указанного в карте. Врач подтвердит подключение';
  function finishLinked(pid) {
    step = 'done'; // до записей в хранилище: подписка checkWait не должна сработать повторно
    waitSet(null);
    patientApp.link(pid);
    store.sendMessage(pid, 'system', 'Пациент подключился к дневнику по приглашению');
    location.href = `index.html?p=${encodeURIComponent(pid)}`;
  }
  // Проверка решения врача: по кнопке и при записи из другой вкладки (кабинет врача в том же браузере демо).
  function checkWait(manual) {
    if (step !== 'wait' || !state.confirmId) return;
    const st = store.phoneConfirmState(state.confirmId);
    if (st === 'approved') { finishLinked(ctx.pid); return; }
    if (st === 'rejected' || st === 'cancelled' || !st) {
      waitSet(null);
      state.inviteText = st === 'rejected' ? 'Врач не подтвердил подключение с этим номером. Попросите врача прислать новое приглашение' : store.patientInviteText('revoked');
      step = 'invite_bad'; render(); return;
    }
    if (manual) { state.waitNote = 'Врач пока не подтвердил подключение. Загляните сюда позже.'; render(); }
  }

  function view() {
    if (step === 'invite_bad') return `
      <section class="stack-l" style="padding-top:8vh">
        <h1>Ссылка не подходит</h1>
        <p class="muted">${ui.esc(state.inviteText)}</p>
        <p class="hint">Если дневник уже подключён, войдите по номеру телефона.</p>
        ${helpLink}
      </section>`;
    if (step === 'wait') return `
      <section class="stack-l" style="padding-top:8vh">
        <h1>Почти готово</h1>
        <p class="muted">${ui.esc(WAIT_TEXT)}.</p>
        <p class="hint">Так мы защищаем дневник, если ссылку переслали другому человеку. Когда врач подтвердит, дневник откроется на этом устройстве.</p>
        <p class="hint" role="status">${ui.esc(state.waitNote)}</p>
        <button class="btn btn--pill btn--block" data-wait-check>Проверить ещё раз</button>
        ${helpLink}
      </section>`;
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
    // Пациент, добавленный врачом, кода KMP не получал: войти можно только по ссылке-приглашению.
    if (step === 1 && !p.inviteCode) return `
      <section class="stack-l" style="padding-top:8vh">
        <h1>Приглашение от врача</h1>
        <p class="muted">${ui.esc(NO_CODE_TEXT)}</p>
        <button class="btn btn--ghost btn--block" data-site>${ui.esc(C[3])}</button>
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
    if (e.target.closest('[data-wait-check]')) { checkWait(true); return; }
    if (e.target.closest('[data-next]')) { step = invite ? 'phone' : 1; render(); }
    if (e.target.closest('[data-check]')) {
      state.code = document.getElementById('code').value.trim().toUpperCase();
      if (state.code !== p.inviteCode) { document.getElementById('err').textContent = 'Код не подошёл. Проверьте буквы и цифры или спросите у врача.'; return; }
      step = 'phone'; render();
    }
    if (e.target.closest('[data-contact]')) {
      KK.host.requestPhone().then((raw) => {
        const n = KK.auth.normalizePhone(raw);
        if (n) { state.phone = n; state.phoneSent = false; render(); } else document.getElementById('err').textContent = 'Номер не получен. Введите его вручную.';
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
        // По приглашению номер записывается только при завершении регистрации (redeemPatientInvite):
        // другой номер не должен заменить номер в карте до решения врача.
        if (!invite) store.setPatientPhone(ctx.pid, state.phone);
      } catch (err) { document.getElementById('err').textContent = err.message; return; }
      step = 2; render();
      return;
    }
    if (e.target.closest('[data-done]')) {
      if (!Object.values(state.consents).every(Boolean)) { document.getElementById('err').textContent = 'Отметьте все пункты, чтобы продолжить.'; return; }
      if (invite) {
        let r;
        try { r = store.redeemPatientInvite(token, { phone: state.phone, consents: ['data_processing', 'doctor_access', 'not_emergency'] }); } catch (err) {
          if (['expired', 'used', 'revoked', 'unknown'].includes(err.reason)) { state.inviteText = err.message; step = 'invite_bad'; render(); return; }
          document.getElementById('err').textContent = err.message; return;
        }
        if (r.status === 'linked') { finishLinked(r.patientId); return; }
        state.confirmId = r.confirmId; waitSet(r.confirmId); step = 'wait'; render();
        return;
      }
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
  store.subscribe(() => checkWait(false));
  render();
  checkWait(false); // ожидание из прошлого открытия: врач мог уже решить
})();
