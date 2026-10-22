// Витрина демо: регистрация и вход в каждый кабинет одной кнопкой. Регистрация специалиста сама создаёт
// приглашение клиники (как это сделал бы администратор) и открывает его первый шаг; вход открывает форму
// с подставленным номером или почтой. Шаги человек проходит сам.
(function () {
  const { ui, store, authPage: A } = KK;
  const CABINETS = [
    { id: 'patient', title: 'Пациент', where: 'Телефон: MAX, Telegram или сайт',
      reg: 'По приглашению врача: код врача → телефон и код из SMS → согласия', login: 'Номер телефона и код из SMS',
      regLabel: 'Регистрация (Анна)', loginLabel: 'Вход (Ольга)' },
    { id: 'doctor', title: 'Врач', where: 'Компьютер: пациенты, сигналы, терапия',
      reg: 'По приглашению клиники: ФИО и специальность → пароль → код на телефон → обязательство', login: 'Рабочая почта и пароль, затем код',
      email: 'elena.ivanova@clinic.demo' },
    { id: 'psychologist', title: 'Психолог', where: 'Компьютер: первичный приём и маршрут',
      reg: 'По приглашению клиники: ФИО → пароль → код на телефон → обязательство', login: 'Рабочая почта и пароль, затем код',
      email: 'maria.belova@clinic.demo' },
    { id: 'admin', title: 'Администратор клиники', where: 'Компьютер: сотрудники и приглашения',
      reg: 'По приглашению другого администратора: ФИО → пароль → код на телефон → обязательство', login: 'Рабочая почта и пароль, затем код',
      email: 'admin@clinic.demo' },
  ];
  const ANNA = 'p_anna';
  const OLGA = 'p_olga';
  const OLGA_PHONE = '+79000002648';

  function card(c) {
    return `<article class="card stack demo-card">
        <div><h2>${ui.esc(c.title)}</h2><p class="hint">${ui.esc(c.where)}</p></div>
        <dl class="kv"><dt>Регистрация</dt><dd>${ui.esc(c.reg)}</dd><dt>Вход</dt><dd>${ui.esc(c.login)}</dd></dl>
        <div class="row wrap">
          <button class="btn btn--primary" data-reg="${c.id}">${ui.esc(c.regLabel || 'Регистрация')}</button>
          <button class="btn" data-login="${c.id}">${ui.esc(c.loginLabel || 'Вход')}</button></div>
        <p class="auth-err" id="err-${c.id}" role="alert"></p>
      </article>`;
  }
  function render() {
    ui.mount('#app', `<div class="demo-hub">
      <header class="stack">
        <a class="auth__brand" href="../index.html">${ui.icon('route', 20)}<b>Компас</b></a>
        <h1>Демо регистрации и входа</h1>
        <p class="muted">Выберите кабинет. «Регистрация» начинает подключение нового пользователя, «Вход» открывает форму с уже подставленными демо-данными.</p>
        ${A.demoNote('SMS и письма не отправляются: код или ссылка появятся на экране. Пароль можно ввести любой надёжный, он нигде не сохраняется.')}
      </header>
      <div class="demo-grid">${CABINETS.map(card).join('')}</div>
      <article class="card stack demo-card">
        <div><h2>Анкета до приёма</h2><p class="hint">Врач отправляет анкету, пациент заполняет её дома, ответы появляются в карточке врача.</p></div>
        <div class="row wrap">
          <button class="btn btn--primary" data-previsit="fill">Заполнить как пациент (Ольга)</button>
          <button class="btn" data-previsit="doctor">Посмотреть у врача</button></div>
      </article>
      <div class="row wrap"><button class="btn btn--ghost" data-reset>Сбросить демо</button>
        <span class="hint">Вернёт пациентов и сотрудников в исходное состояние в этом браузере.</span></div>
    </div>`);
  }
  // Новая почта для каждой демо-регистрации: приглашение на уже существующую почту клиника не выдаёт.
  const demoEmail = (role) => `${role}-${Math.floor(1000 + Math.random() * 9000)}@clinic.demo`;

  document.addEventListener('click', (e) => {
    const reg = e.target.closest('[data-reg]');
    if (reg) {
      const id = reg.dataset.reg;
      if (id === 'patient') {
        // Если Анна уже прошла регистрацию в этом браузере — возвращаем её к началу, чтобы показать регистрацию снова.
        if ((store.patient(ANNA).consents || []).length) {
          store.demoResetRegistration(ANNA);
          try { localStorage.removeItem(`kk:linked:${ANNA}`); } catch (err) { /* приватный режим */ }
        }
        const p = store.patient(ANNA);
        // Ссылка врача с приглашением: в браузере код подставится из ?startapp=, как в MAX.
        location.href = `../patient/onboarding.html?p=${ANNA}&startapp=${encodeURIComponent(`inv_${p.inviteCode}`)}`;
        return;
      }
      try {
        const inv = store.inviteStaff(demoEmail(id), id);
        location.href = `invite.html?token=${encodeURIComponent(inv.token)}`;
      } catch (err) { A.showErr(err.message, `err-${id}`); }
      return;
    }
    const pv = e.target.closest('[data-previsit]');
    if (pv) {
      // Анкету отправляет врач: в демо отправляем её за врача, если она ещё не отправлена.
      if (pv.dataset.previsit === 'fill') {
        if (!store.patient(OLGA).previsit) store.sendPrevisit(OLGA, { by: store.doctor().id });
        location.href = `../patient/previsit.html?p=${OLGA}`;
      } else location.href = `../doctor/patient.html?id=${OLGA}`;
      return;
    }
    const login = e.target.closest('[data-login]');
    if (login) {
      const c = CABINETS.find((x) => x.id === login.dataset.login);
      location.href = c.id === 'patient' ? `login.html?phone=${encodeURIComponent(OLGA_PHONE)}`
        : `login.html?as=staff&email=${encodeURIComponent(c.email)}`;
      return;
    }
    if (e.target.closest('[data-reset]')) {
      try {
        Object.keys(localStorage).filter((k) => /^kk:(linked|prefs|intake-draft):/.test(k) || k === 'kk:outbox').forEach((k) => localStorage.removeItem(k));
        if (KK.auth.session) KK.auth.session.clear();
      } catch (err) { /* приватный режим */ }
      store.reset();
      render();
    }
  });
  render();
})();
