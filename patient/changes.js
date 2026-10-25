// «Изменения на лечении»: вопрос о побочных эффектах в свободной форме. «Да» открывает поле для рассказа;
// ответ уходит врачу событием change { changed, note } и при «да» поднимает плановый сигнал patient_change.
(function () {
  const { ui, patientApp: app } = KK;
  const ctx = app.start({ tab: null, back: 'index.html' });
  if (!ctx) return;
  let answer = null; // 'yes' | 'no'
  let note = '';
  let sent = null; // null | 'ok' | 'pending'

  function render() {
    const noteEl = document.getElementById('change-note');
    if (noteEl) note = noteEl.value;
    ui.mount('#app', `
      <a class="p-back" href="index.html">${ui.icon('back', 18)}Назад</a>
      <section class="stack-l">
        <header class="stack"><h1>Изменения на лечении</h1>
          <p class="muted">Ответ увидит ваш лечащий врач. Это поможет ему понять, как на вас действует лечение.</p></header>
        ${sent ? `
        <section class="card stack" role="status">
          <p class="q-title">Спасибо, ответ отправлен</p>
          <p class="hint">${sent === 'pending' ? ui.esc(app.SYNC_PENDING) : 'Врач увидит его в вашей карточке.'}</p>
          <p class="hint">Если состояние резко ухудшилось — звоните 112, не ждите ответа врача.</p>
          <a class="btn btn--pill btn--block" href="index.html">На главную</a>
        </section>` : `
        <section class="card stack" aria-labelledby="change-q">
          <p class="q-title" id="change-q">Замечали ли вы какие-либо улучшения или ухудшения состояния?</p>
          <div class="seg seg--2" role="group" aria-labelledby="change-q">
            <button data-change="yes" aria-pressed="${answer === 'yes'}">Да</button>
            <button data-change="no" aria-pressed="${answer === 'no'}">Нет</button>
          </div>
          ${answer === 'yes' ? `
          <label class="field"><span class="q-title">Расскажите подробнее о том, что вы чувствуете?</span>
            <textarea id="change-note" rows="5" placeholder="Например: стало легче засыпать, но днём клонит в сон">${ui.esc(note)}</textarea></label>
          <p class="hint">Если состояние резко ухудшилось или опасно сейчас — звоните 112.</p>` : ''}
          ${answer ? '<button class="btn btn--pill btn--block" data-change-send>Отправить врачу</button>' : ''}
        </section>`}
      </section>`);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-change]');
    if (b) {
      answer = b.dataset.change;
      render();
      if (answer === 'yes') document.getElementById('change-note').focus();
      return;
    }
    if (e.target.closest('[data-change-send]')) {
      note = answer === 'yes' ? document.getElementById('change-note').value.trim() : '';
      if (answer === 'yes' && !note) { app.toast('Напишите пару слов о том, что изменилось'); return; }
      let r;
      try { r = KK.sync.submit(ctx.pid, 'change', { changed: answer === 'yes', note }); } catch (err) {
        app.toast('Не получилось сохранить. Попробуйте ещё раз');
        return;
      }
      sent = r && r.pending ? 'pending' : 'ok';
      render();
    }
  });
  render();
})();
