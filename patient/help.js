(function () {
  const { ui, store, patientApp: app } = KK;
  const ctx = app.start({ tab: null, help: false, requireLink: false, back: 'index.html' });
  if (!ctx) return;
  // Экран кризиса доступен всегда (и до подключения). «Врач уведомлён» — только при реально открытом алерте по PHQ-9 п. 9.
  const fromPhq = ui.param('from') === 'phq9' && app.phqAlertOpen(store.alerts({ patientId: ctx.pid, open: true }));
  let sent = fromPhq;
  let g = -1;
  const GROUND = ['5 вещей, которые вы видите', '4 вещи, которых можете коснуться', '3 звука, которые слышите', '2 запаха вокруг', '1 вкус, который чувствуете'];

  function render() {
    ui.mount('#app', `
      <a class="p-back" href="index.html">${ui.icon('back', 18)}Назад</a>
      <section class="stack-l help-hero">
        <h1>Вы не одни</h1>
        <p class="muted">${fromPhq ? 'Спасибо, что ответили честно. Ваш врач уже получил ответы и свяжется с вами.' : 'Сейчас главное — ваша безопасность. Выберите, что подходит.'}</p>
        <div class="stack">
          <a class="help-call" href="tel:112">${ui.icon('phone')}<span><b>112</b><span class="hint">Если есть опасность для жизни</span></span></a>
          <a class="help-call" href="tel:+74959895050">${ui.icon('phone')}<span><b>8 495 989-50-50</b><span class="hint">Психологическая помощь МЧС, круглосуточно</span></span></a>
          <a class="help-call" href="tel:88002000122">${ui.icon('phone')}<span><b>8 800 2000-122</b><span class="hint">Телефон доверия для подростков</span></span></a>
        </div>
        <section class="card card--help stack">
          ${sent ? `<p class="row">${ui.icon('check', 20)}<span>Врач уведомлён</span></p><a class="btn btn--block" href="chat.html">Написать врачу</a>`
            : `<p>Можно сообщить врачу, что вам сейчас плохо. Он увидит это сразу.</p><button class="btn btn--primary btn--block" data-sos>Сообщить врачу</button>`}
        </section>
        <section class="card stack">
          <h3>Вернуться в «здесь и сейчас»</h3>
          ${g < 0 ? '<p class="muted">Упражнение на две минуты. Назовите про себя по очереди:</p><button class="btn btn--block" data-g>Начать</button>'
            : g < GROUND.length ? `<p style="font-size:1.25em" aria-live="polite">${GROUND[g]}</p><button class="btn btn--block" data-g>Дальше</button>`
            : '<p>Хорошо. Сделайте медленный вдох и длинный выдох.</p><a class="btn btn--block" href="material.html?id=breathing">Медленное дыхание</a>'}
        </section>
      </section>`);
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-sos]')) { store.addEvent(ctx.pid, 'sos', { source: 'patient_button' }); sent = true; render(); }
    if (e.target.closest('[data-g]')) { g++; render(); }
  });
  render();
})();
