// «Изменения на лечении»: вопросы о действии лечения и побочных эффектах в свободной форме.
// 1) Улучшения или ухудшения: «да» — рассказ; «нет» — уточнение, что изменений совсем нет или пока рано судить.
// 2) Что-то необычное (новые ощущения, реакции, сны, мысли): «да» — рассказ.
// Ответ уходит врачу событием change { changed, note, noChange, unusual, unusualNote };
// «да» в любом вопросе поднимает плановый сигнал patient_change, «изменений нет» на терапии — patient_no_change.
(function () {
  const { ui, patientApp: app } = KK;
  const ctx = app.start({ tab: null, back: 'index.html' });
  if (!ctx) return;
  const NO_CHANGE = [['none', 'Изменений совсем нет'], ['early', 'Пока рано судить']];
  let answer = null; // 'yes' | 'no'
  let noChange = null; // 'none' | 'early' — уточнение к «нет»
  let unusual = null; // 'yes' | 'no'
  let note = '';
  let unusualNote = '';
  let sent = null; // null | 'ok' | 'pending'

  const keepText = () => {
    const a = document.getElementById('change-note'); if (a) note = a.value;
    const b = document.getElementById('unusual-note'); if (b) unusualNote = b.value;
  };
  const ready = () => answer && unusual && (answer === 'yes' || noChange);

  function render() {
    keepText();
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
            <textarea id="change-note" rows="5" placeholder="Например: стало легче засыпать, но днём клонит в сон">${ui.esc(note)}</textarea></label>` : ''}
          ${answer === 'no' ? `
          <p class="q-title" id="nochange-q">Как бы вы это описали?</p>
          <div class="seg seg--2" role="group" aria-labelledby="nochange-q">
            ${NO_CHANGE.map(([v, l]) => `<button data-nochange="${v}" aria-pressed="${noChange === v}">${l}</button>`).join('')}
          </div>
          <p class="hint">Отсутствие изменений — тоже важный ответ: врач учтёт его, когда будет оценивать лечение.</p>` : ''}
        </section>
        ${answer ? `
        <section class="card stack" aria-labelledby="unusual-q">
          <p class="q-title" id="unusual-q">Замечали ли вы что-то необычное — новые или странные ощущения, реакции, сны, мысли?</p>
          <div class="seg seg--2" role="group" aria-labelledby="unusual-q">
            <button data-unusual="yes" aria-pressed="${unusual === 'yes'}">Да</button>
            <button data-unusual="no" aria-pressed="${unusual === 'no'}">Нет</button>
          </div>
          ${unusual === 'yes' ? `
          <label class="field"><span class="q-title">Опишите, что необычного вы заметили</span>
            <textarea id="unusual-note" rows="4" placeholder="Например: яркие сны, покалывание в руках, непривычная раздражительность">${ui.esc(unusualNote)}</textarea></label>` : ''}
        </section>` : ''}
        ${answer && !sent ? '<p class="hint">Если состояние резко ухудшилось или опасно сейчас — звоните 112.</p>' : ''}
        ${ready() && !sent ? '<button class="btn btn--pill btn--block" data-change-send>Отправить врачу</button>' : ''}`}
      </section>`);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-change]');
    if (b) {
      keepText();
      answer = b.dataset.change;
      if (answer === 'yes') noChange = null;
      render();
      if (answer === 'yes') document.getElementById('change-note').focus();
      return;
    }
    const n = e.target.closest('[data-nochange]');
    if (n) { keepText(); noChange = n.dataset.nochange; render(); return; }
    const u = e.target.closest('[data-unusual]');
    if (u) {
      keepText();
      unusual = u.dataset.unusual;
      render();
      if (unusual === 'yes') document.getElementById('unusual-note').focus();
      return;
    }
    if (e.target.closest('[data-change-send]')) {
      keepText();
      const text = answer === 'yes' ? note.trim() : '';
      const odd = unusual === 'yes' ? unusualNote.trim() : '';
      if (answer === 'yes' && !text) { app.toast('Напишите пару слов о том, что изменилось'); return; }
      if (unusual === 'yes' && !odd) { app.toast('Опишите, что необычного вы заметили'); return; }
      let r;
      try {
        r = KK.sync.submit(ctx.pid, 'change', { changed: answer === 'yes', note: text, noChange: answer === 'no' ? noChange : null, unusual: unusual === 'yes', unusualNote: odd });
      } catch (err) {
        app.toast('Не получилось сохранить. Попробуйте ещё раз');
        return;
      }
      sent = r && r.pending ? 'pending' : 'ok';
      render();
    }
  });
  render();
})();
