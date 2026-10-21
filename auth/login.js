(function () {
  const { ui, store, auth, authPage: A } = KK;
  const st = { tab: ui.param('as') === 'staff' ? 'staff' : 'patient', step: 'start', phone: '', email: '', staffId: null, staffPhone: '', demo: '' };
  const STAFF_EMAILS = 'elena.ivanova@clinic.demo, maria.belova@clinic.demo, admin@clinic.demo';

  function patientView() {
    if (st.step === 'code') return `
      <h1>Код из SMS</h1><p class="muted">Отправили на ${ui.esc(auth.maskPhone(st.phone))}</p>
      ${A.demoNote(`код ${st.demo}. В настоящей версии он придёт по SMS`)}
      <label class="field"><span class="hint">Код</span><input id="code" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>
      ${A.err()}
      <button class="btn btn--primary btn--block" data-verify>Войти</button>
      <button class="btn btn--ghost btn--block" data-back>Изменить номер</button>`;
    return `
      <h1>Вход для пациента</h1>
      <p class="muted">По номеру телефона, который вы подтвердили при подключении дневника.</p>
      <label class="field"><span class="hint">Телефон</span><input id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${ui.esc(st.phone)}"></label>
      ${A.demoNote('номер Ольги из демо-сценария: +7 900 000-26-48')}
      ${A.err()}
      <button class="btn btn--primary btn--block" data-send>Получить код</button>
      <p class="hint">Нет дневника? Подключение — по приглашению врача: <a href="../patient/onboarding.html?p=p_anna">ввести код приглашения</a>.</p>`;
  }
  function staffView() {
    if (st.step === 'code') return `
      <h1>Подтверждение входа</h1><p class="muted">Код отправлен на ${ui.esc(auth.maskPhone(st.staffPhone))}</p>
      ${A.demoNote(`код ${st.demo}. В настоящей версии он придёт по SMS или в приложение-аутентификатор`)}
      <label class="field"><span class="hint">Код</span><input id="code" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>
      ${A.err()}
      <button class="btn btn--primary btn--block" data-verify>Войти</button>
      <button class="btn btn--ghost btn--block" data-back>Назад</button>`;
    return `
      <h1>Вход для специалиста</h1>
      <p class="muted">Для врачей, психологов и администраторов клиники.</p>
      <label class="field"><span class="hint">Рабочая почта</span><input id="email" type="email" autocomplete="username" value="${ui.esc(st.email)}"></label>
      <label class="field"><span class="hint">Пароль</span><input id="pw" type="password" autocomplete="current-password"></label>
      ${A.demoNote(`пароль не проверяется. Почты для входа: ${STAFF_EMAILS}`)}
      ${A.err()}
      <button class="btn btn--primary btn--block" data-login>Продолжить</button>
      <p class="hint">Нет аккаунта? Специалистов подключает администратор клиники — ссылка-приглашение придёт на рабочую почту.</p>`;
  }
  function render() {
    A.setRole(st.tab === 'staff' ? 'doctor' : 'patient');
    A.mount(`
      <div class="auth-tabs" role="group" aria-label="Кто входит">
        <button type="button" data-tab="patient" aria-pressed="${st.tab === 'patient'}">Я пациент</button>
        <button type="button" data-tab="staff" aria-pressed="${st.tab === 'staff'}">Я специалист</button></div>
      ${st.tab === 'staff' ? staffView() : patientView()}
      <p class="hint"><a href="recover.html?as=${st.tab}">Не могу войти</a></p>`);
    const first = document.querySelector('#app input');
    if (first) first.focus();
  }
  const code = () => document.getElementById('code').value;

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { st.tab = tab.dataset.tab; st.step = 'start'; render(); return; }
    if (e.target.closest('[data-back]')) { st.step = 'start'; render(); return; }
    if (e.target.closest('[data-send]')) {
      const phone = auth.normalizePhone(document.getElementById('phone').value);
      if (!phone) { A.showErr('Проверьте номер: нужен российский мобильный, например +7 900 000-00-00'); return; }
      // Код отправляем на любой номер: есть ли дневник, выясняется только после подтверждения владения номером.
      st.phone = phone; st.demo = store.requestOtp(phone, 'patient_login').code; st.step = 'code'; render();
      return;
    }
    if (e.target.closest('[data-verify]') && st.tab === 'patient') {
      try { store.verifyOtp(st.phone, 'patient_login', code()); } catch (err) { A.showErr(err.message); return; }
      const pid = store.findPatientByPhone(st.phone);
      if (!pid) { A.showErr('Этот номер не привязан к дневнику. Подключитесь по коду приглашения врача'); return; }
      auth.session.set({ kind: 'patient', patientId: pid });
      // Регистрация не завершена (нет согласий): продолжаем её, дневник пока не открываем.
      if (!(store.patient(pid).consents || []).length) { location.href = `../patient/onboarding.html?p=${encodeURIComponent(pid)}`; return; }
      try { localStorage.setItem(`kk:linked:${pid}`, 'true'); } catch (err) { /* приватный режим */ }
      location.href = `../patient/index.html?p=${encodeURIComponent(pid)}`;
      return;
    }
    if (e.target.closest('[data-login]')) {
      st.email = auth.normalizeEmail(document.getElementById('email').value);
      if (!auth.validEmail(st.email) || !document.getElementById('pw').value) { A.showErr('Введите рабочую почту и пароль'); return; }
      let s;
      try { s = store.staffLoginCheck(st.email); } catch (err) { A.showErr(err.message); return; }
      st.staffId = s.id; st.staffPhone = s.phone; st.demo = store.requestOtp(s.id, 'staff_mfa').code; st.step = 'code'; render();
      return;
    }
    if (e.target.closest('[data-verify]') && st.tab === 'staff') {
      try { store.verifyOtp(st.staffId, 'staff_mfa', code()); } catch (err) { A.showErr(err.message); return; }
      const s = store.staffById(st.staffId);
      if (!s || s.status !== 'active') { A.showErr('Не получилось войти. Проверьте почту или обратитесь к администратору клиники'); return; }
      auth.session.set({ kind: 'staff', staffId: s.id, role: s.role });
      location.href = A.staffHome(s);
    }
  });
  A.enterSubmits('[data-send],[data-verify],[data-login]');
  render();
})();
