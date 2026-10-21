(function () {
  const { ui, store, auth, authPage: A } = KK;
  const resetToken = ui.param('reset');
  const st = { as: ui.param('as') === 'patient' ? 'patient' : 'staff', step: resetToken ? 'mfa' : 'start', link: '', demo: '', info: null };
  if (resetToken) { st.as = 'staff'; st.info = store.resetInfo(resetToken); if (!st.info) st.step = 'bad'; }
  A.setRole(st.as === 'patient' ? 'patient' : 'doctor');

  function view() {
    if (st.as === 'patient') return `<h1>Не получается войти</h1>
      <p class="muted">У пациента нет пароля: вход — по коду из SMS на ваш номер.</p>
      <a class="btn btn--primary btn--block" href="login.html">Войти по номеру телефона</a>
      <p class="hint">Если номер сменился, попросите лечащего врача выдать новое приглашение — история дневника сохранится.</p>`;
    if (st.step === 'bad') return `<h1>Ссылка недействительна</h1>
      <p class="muted">Она уже использована или прошло больше 30 минут.</p><a class="btn btn--block" href="recover.html">Запросить ещё раз</a>`;
    if (st.step === 'start') return `<h1>Восстановление доступа</h1>
      <p class="muted">Укажите рабочую почту — пришлём ссылку для смены пароля.</p>
      <label class="field"><span class="hint">Рабочая почта</span><input id="email" type="email" autocomplete="username"></label>
      ${A.err()}<button class="btn btn--primary btn--block" data-send>Отправить ссылку</button>
      <p class="hint">Почту сменили или аккаунт заблокирован — обратитесь к администратору клиники.</p>`;
    if (st.step === 'sent') return `<h1>Проверьте почту</h1>
      <p class="muted">Если такая почта есть в клинике, на неё отправлена ссылка. Она действует 30 минут.</p>
      ${st.link ? `<p class="demo-note" role="status"><b>Демо:</b> письмо не отправляется. Ссылка: <a href="${ui.esc(st.link)}">${ui.esc(st.link)}</a></p>` : ''}`;
    if (st.step === 'mfa') return `<h1>Подтверждение</h1>
      <p class="muted">Код отправлен на ${ui.esc(auth.maskPhone(st.info.phone))}.</p>
      ${A.demoNote(`код ${st.demo}. В настоящей версии он придёт по SMS`)}
      <label class="field"><span class="hint">Код</span><input id="code" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>
      ${A.err()}<button class="btn btn--primary btn--block" data-mfa>Подтвердить</button>`;
    if (st.step === 'password') return `<h1>Новый пароль</h1>
      <label class="field"><span class="hint">Пароль</span><input id="pw" type="password" autocomplete="new-password"></label>
      <p class="pw-hint" id="pwh" aria-live="polite"></p>
      <label class="field"><span class="hint">Ещё раз</span><input id="pw2" type="password" autocomplete="new-password"></label>
      ${A.demoNote('пароль нигде не сохраняется, проверяется только его надёжность')}
      ${A.err()}<button class="btn btn--primary btn--block" data-save>Сохранить</button>`;
    return `<h1>Пароль обновлён</h1><p class="muted">Войдите с новым паролем.</p>
      <a class="btn btn--primary btn--block" href="login.html?as=staff">Ко входу</a>`;
  }
  function render() { A.mount(view()); const f = document.querySelector('#app input'); if (f) f.focus(); }
  if (st.step === 'mfa') st.demo = store.requestOtp(`reset:${st.info.staffId}`, 'reset_mfa').code;

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'pw') return;
    document.getElementById('pwh').textContent = e.target.value ? auth.passwordCheck(e.target.value, st.info.email).hint : '';
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-send]')) {
      const email = auth.normalizeEmail(document.getElementById('email').value);
      if (!auth.validEmail(email)) { A.showErr('Проверьте адрес почты'); return; }
      const r = store.createReset(email);
      st.link = r ? new URL(`recover.html?reset=${encodeURIComponent(r.token)}`, location.href).href : '';
      st.step = 'sent'; render();
      return;
    }
    if (e.target.closest('[data-mfa]')) {
      try { store.verifyOtp(`reset:${st.info.staffId}`, 'reset_mfa', document.getElementById('code').value); } catch (err) { A.showErr(err.message); return; }
      st.step = 'password'; render();
      return;
    }
    if (e.target.closest('[data-save]')) {
      const pw = document.getElementById('pw').value;
      const r = auth.passwordCheck(pw, st.info.email);
      if (!r.ok) { A.showErr(r.hint); return; }
      if (pw !== document.getElementById('pw2').value) { A.showErr('Пароли не совпадают'); return; }
      try { store.completeReset(resetToken); } catch (err) { A.showErr(err.message); return; }
      st.step = 'done'; render();
    }
  });
  A.enterSubmits('[data-send],[data-mfa],[data-save]');
  render();
})();
