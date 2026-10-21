(function () {
  const { ui, store, auth, authPage: A } = KK;
  const token = ui.param('token') || '';
  const info = store.inviteInfo(token);
  const ROLE = { doctor: 'врач', psychologist: 'клинический психолог', admin: 'администратор клиники' };
  const SPECS = ['терапевт', 'врач общей практики', 'невролог', 'кардиолог', 'эндокринолог', 'психиатр', 'психотерапевт'];
  const STEPS = ['invite', 'profile', 'password', 'mfa', 'oath'];
  const st = { step: info.state === 'pending' ? 'invite' : 'bad', name: '', specialty: SPECS[0], phone: '', pwOk: false, demo: '', oath: false };
  A.setRole('doctor');

  const stepLine = () => `<p class="auth-step">Шаг ${STEPS.indexOf(st.step) + 1} из ${STEPS.length}</p>`;
  function view() {
    if (st.step === 'bad') return `<h1>Приглашение недоступно</h1><p class="muted">${ui.esc(store.inviteText(info.state))}</p>
      <a class="btn btn--block" href="login.html?as=staff">Ко входу</a>`;
    if (st.step === 'invite') return `${stepLine()}<h1>Приглашение в «Компас»</h1>
      <p class="muted">${ui.esc(info.clinic)} приглашает вас как ${ui.esc(ROLE[info.role])}.</p>
      <dl class="kv"><dt>Рабочая почта</dt><dd>${ui.esc(info.email)}</dd><dt>Действует до</dt><dd>${ui.esc(ui.fmtDateTime(info.expiresAt))}</dd></dl>
      <button class="btn btn--primary btn--block" data-next>Начать</button>`;
    if (st.step === 'profile') return `${stepLine()}<h1>О вас</h1>
      <label class="field"><span class="hint">Фамилия и имя</span><input id="name" autocomplete="name" value="${ui.esc(st.name)}"></label>
      ${info.role === 'doctor' ? `<label class="field"><span class="hint">Специальность</span><select id="spec">${SPECS.map((s) => `<option ${s === st.specialty ? 'selected' : ''}>${ui.esc(s)}</option>`).join('')}</select></label>
        <p class="hint">Для психиатра и психотерапевта кабинет компактный; для остальных специальностей — с подсказками к шкалам и маршрутизации.</p>`
        : `<p class="muted">Специальность: ${ui.esc(ROLE[info.role])}</p>`}
      <label class="field"><span class="hint">Мобильный телефон — для кода при входе</span><input id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${ui.esc(st.phone)}"></label>
      ${A.err()}<button class="btn btn--primary btn--block" data-profile>Дальше</button>`;
    if (st.step === 'password') return `${stepLine()}<h1>Пароль</h1>
      <p class="muted">Не короче 10 символов. Лучше фраза из нескольких слов.</p>
      <label class="field"><span class="hint">Пароль</span><input id="pw" type="password" autocomplete="new-password"></label>
      <p class="pw-hint" id="pwh" aria-live="polite"></p>
      <label class="field"><span class="hint">Ещё раз</span><input id="pw2" type="password" autocomplete="new-password"></label>
      ${A.demoNote('пароль нигде не сохраняется, проверяется только его надёжность')}
      ${A.err()}<button class="btn btn--primary btn--block" data-password>Дальше</button>`;
    if (st.step === 'mfa') return `${stepLine()}<h1>Подтверждение телефона</h1>
      <p class="muted">Код отправлен на ${ui.esc(auth.maskPhone(st.phone))}. Он понадобится при каждом входе.</p>
      ${A.demoNote(`код ${st.demo}. В настоящей версии он придёт по SMS`)}
      <label class="field"><span class="hint">Код</span><input id="code" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>
      ${A.err()}<button class="btn btn--primary btn--block" data-mfa>Подтвердить</button>
      <button class="btn btn--ghost btn--block" data-resend>Отправить код ещё раз</button>`;
    return `${stepLine()}<h1>Обязательство</h1>
      <div class="card"><label class="check"><input type="checkbox" id="oath" ${st.oath ? 'checked' : ''}>
        <span>Обязуюсь соблюдать врачебную тайну (ст. 13 Федерального закона № 323-ФЗ) и правила обработки персональных данных пациентов (152-ФЗ), не передавать доступ к кабинету другим лицам.</span></label></div>
      ${A.err()}<button class="btn btn--primary btn--block" data-finish>Завершить регистрацию</button>`;
  }
  function render() { A.mount(view()); const f = document.querySelector('#app input'); if (f) f.focus(); }
  function sendCode() { st.demo = store.requestOtp(`invite:${token}`, 'invite_mfa').code; }

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'pw') return;
    const r = auth.passwordCheck(e.target.value, info.email);
    document.getElementById('pwh').textContent = e.target.value ? r.hint : '';
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'oath') st.oath = e.target.checked; });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) { st.step = 'profile'; render(); return; }
    if (e.target.closest('[data-profile]')) {
      st.name = document.getElementById('name').value.trim();
      const spec = document.getElementById('spec');
      if (spec) st.specialty = spec.value;
      const phone = auth.normalizePhone(document.getElementById('phone').value);
      if (st.name.length < 3) { A.showErr('Укажите фамилию и имя'); return; }
      if (!phone) { A.showErr('Проверьте номер: нужен российский мобильный, например +7 900 000-00-00'); return; }
      st.phone = phone; st.step = 'password'; render();
      return;
    }
    if (e.target.closest('[data-password]')) {
      const pw = document.getElementById('pw').value;
      const r = auth.passwordCheck(pw, info.email);
      if (!r.ok) { A.showErr(r.hint); return; }
      if (pw !== document.getElementById('pw2').value) { A.showErr('Пароли не совпадают'); return; }
      sendCode(); st.step = 'mfa'; render();
      return;
    }
    if (e.target.closest('[data-resend]')) { sendCode(); render(); return; }
    if (e.target.closest('[data-mfa]')) {
      try { store.verifyOtp(`invite:${token}`, 'invite_mfa', document.getElementById('code').value); } catch (err) { A.showErr(err.message); return; }
      st.step = 'oath'; render();
      return;
    }
    if (e.target.closest('[data-finish]')) {
      if (!st.oath) { A.showErr('Подтвердите обязательство, чтобы завершить регистрацию'); return; }
      let s;
      try { s = store.acceptInvite(token, { name: st.name, specialty: st.specialty, phone: st.phone }); } catch (err) { A.showErr(err.message); return; }
      auth.session.set({ kind: 'staff', staffId: s.id, role: s.role });
      location.href = A.staffHome(s);
    }
  });
  A.enterSubmits('[data-next],[data-profile],[data-password],[data-mfa]');
  render();
})();
