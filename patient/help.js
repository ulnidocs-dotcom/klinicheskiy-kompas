(function () {
  const { ui, store, patientApp: app } = KK;
  const ctx = app.start({ tab: null, help: false, requireLink: false, back: 'index.html' });
  if (!ctx) return;
  // Экран кризиса доступен всегда (и до подключения). «Сообщение отправлено врачу» — только при реально открытом алерте по PHQ-9 п. 9.
  const fromPhq = ui.param('from') === 'phq9' && app.phqAlertOpen(store.alerts({ patientId: ctx.pid, open: true }));
  // После скрининга безопасности в первичной беседе: «уведомлены» — только при открытом алерте C-SSRS.
  const fromIntake = ui.param('from') === 'intake' && store.alerts({ patientId: ctx.pid, open: true }).some((a) => a.ruleId === 'cssrs_risk');
  // После ответа «да» в анкете до приёма: «уведомлены» — только при открытом алерте previsit_selfharm.
  const fromPrevisit = ui.param('from') === 'previsit' && store.alerts({ patientId: ctx.pid, open: true }).some((a) => a.ruleId === 'previsit_selfharm');
  // Из чата с ассистентом (спек 2026-10-22 §C): «уведомлены» — только если есть событие SOS этой реплики (id в адресе);
  // failed=1 — SOS не ушёл (нет связи).
  const sosId = ui.param('sos');
  const fromAssistant = ui.param('from') === 'assistant' && !!sosId
    && store.events(ctx.pid, 'sos').some((e) => e.id === sosId && e.payload && e.payload.source === 'assistant');
  const offline = ui.param('from') === 'offline';
  let sent = fromPhq || fromIntake || fromPrevisit || fromAssistant;
  let failed = ui.param('from') === 'assistant' && ui.param('failed') === '1';
  let g = -1;
  const GROUND = ['5 вещей, которые вы видите', '4 вещи, которых можете коснуться', '3 звука, которые слышите', '2 запаха вокруг', '1 вкус, который чувствуете'];

  function render() {
    ui.mount('#app', `
      <a class="p-back" href="index.html">${ui.icon('back', 18)}Назад</a>
      <section class="stack-l help-hero">
        <h1>Вы не одни</h1>
        <p class="muted">${offline ? 'Ответы не отправлены — нет связи. Когда связь появится, заполните опросник ещё раз. Если вам опасно сейчас, звоните 112 или на линию ниже.' : fromPhq ? 'Спасибо, что ответили честно. Ответы переданы врачу: он увидит их в рабочее время и свяжется с вами. Если вам опасно сейчас — не ждите ответа, звоните 112 или на линию ниже.'
          : fromIntake ? 'Спасибо, что ответили честно. Ответы переданы специалистам: они увидят их в рабочее время и свяжутся с вами. Если вам опасно сейчас — не ждите ответа, звоните 112 или на линию ниже. Беседу с психологом можно продолжить позже.'
            : fromPrevisit ? 'Спасибо, что ответили честно. Ответ передан врачу: он увидит его в рабочее время и свяжется с вами. Если вам опасно сейчас — не ждите ответа, звоните 112 или на линию ниже. Анкету можно продолжить позже.'
            : 'Сейчас главное — ваша безопасность. Выберите, что подходит.'}</p>
        <div class="stack">
          <a class="help-call" href="tel:112"><span class="ic">${ui.icon('phone', 20)}</span><span><b>112</b><span class="hint">Если есть опасность для жизни</span></span></a>
          <a class="help-call" href="tel:+74959895050"><span class="ic">${ui.icon('phone', 20)}</span><span><b>8 495 989-50-50</b><span class="hint">Психологическая помощь МЧС, круглосуточно</span></span></a>
          <a class="help-call" href="tel:88002000122"><span class="ic">${ui.icon('phone', 20)}</span><span><b>8 800 2000-122</b><span class="hint">Телефон доверия для подростков</span></span></a>
        </div>
        <section class="tile aura aura--sand stack">
          ${sent ? `<p class="row">${ui.icon('check', 20)}<span>Сообщение отправлено врачу</span></p><p class="hint">Врач ответит в рабочее время. Это не экстренная служба: если станет хуже — звоните 112.</p><a class="btn btn--block" href="chat.html">Написать врачу</a>`
            : `${failed ? '<p role="alert"><b>Сообщение не отправлено.</b> Нет связи. Если опасно сейчас — звоните 112.</p>' : ''}<p>Можно сообщить врачу, что вам сейчас плохо. Врач увидит сообщение в рабочее время — это не экстренная служба. Если опасно сейчас, звоните 112.</p><button class="btn btn--pill btn--block" data-sos>Сообщить врачу</button>`}
        </section>
        <section class="card stack">
          <h3>Вернуться в «здесь и сейчас»</h3>
          ${g < 0 ? '<p class="muted">Упражнение на две минуты. Назовите про себя по очереди:</p><button class="btn btn--block" data-g>Начать</button>'
            : g < GROUND.length ? `<p style="font-size:1.25em" aria-live="polite">${GROUND[g]}</p><button class="btn btn--block" data-g>Дальше</button>`
            : '<p>Хорошо. Сделайте медленный вдох и длинный выдох.</p><a class="btn btn--block" href="material.html?id=breathing">Медленное дыхание</a>'}
        </section>
        ${fromIntake ? '<a class="btn btn--block" href="intake.html">Вернуться к беседе с психологом</a>' : ''}
        ${ui.param('from') === 'previsit' ? '<a class="btn btn--block" href="previsit.html">Вернуться к анкете</a>' : ''}
        ${ui.param('from') === 'assistant' ? '<a class="btn btn--block" href="chat.html?mode=assistant">Вернуться в чат</a>' : ''}
      </section>`);
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-sos]')) {
      try { KK.sync.submit(ctx.pid, 'sos', { source: 'patient_button' }); sent = true; failed = false; } catch (err) { failed = true; }
      render();
    }
    if (e.target.closest('[data-g]')) { g++; render(); }
  });
  render();
})();
