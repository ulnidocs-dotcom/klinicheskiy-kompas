(function () {
  const { ui, store, patientApp: app, data } = KK;
  const ctx = app.start({ tab: null, back: 'index.html' });
  if (!ctx) return;
  const SEV = [{ v: 'none', l: 'Нет' }, { v: 'mild', l: 'Немного' }, { v: 'severe', l: 'Сильно' }];
  const marks = {};
  let note = '';
  let sentSevere = null;

  function render() {
    const noteEl = document.getElementById('note');
    if (noteEl) note = noteEl.value;
    const p = ctx.patient();
    const drug = data.drugs[p.plan?.drugId];
    if (!drug || p.plan.status !== 'confirmed') {
      ui.mount('#app', `<a class="p-back" href="index.html">${ui.icon('back', 18)}Назад</a>
        <section class="stack-l"><h1>Лечение</h1><p class="muted">Врач обсуждает с вами план лечения. Когда он его подтвердит, здесь появятся напоминания о приёме.</p>
        <a class="btn btn--pill btn--block" href="chat.html">Задать вопрос врачу</a></section>`);
      return;
    }
    const slots = app.doseSlots(store.events(p.id, 'dose'), new Date().toISOString());
    ui.mount('#app', `
      <a class="p-back" href="index.html">${ui.icon('back', 18)}Назад</a>
      <section class="stack-l">
        <header class="stack"><h1>${ui.esc(drug.name)}</h1><p class="muted">${ui.esc(drug.dosing.dose)} · ${drug.dosing.timesPerDay} раза в день</p></header>
        <section class="tile aura aura--rose stack"><span class="label">Сегодня</span>
          <div class="slots">${slots.map(app.slotHtml).join('')}</div></section>
        <section class="card stack"><p class="q-title">Важно помнить</p>
          <ul class="stack" style="margin:0;padding-left:18px">${drug.patientNotes.map((n) => `<li>${ui.esc(n)}</li>`).join('')}</ul></section>
        <section class="card stack" aria-labelledby="ae">
          <p class="q-title" id="ae">Как вы себя чувствуете на лечении?</p>
          <p class="hint">Отметьте, если что-то из этого появилось за последние дни.</p>
          ${drug.adverseEvents.map((a) => `
            <div class="ae-row stack"><span>${ui.esc(a.label)}</span>
              <div class="seg" role="group" aria-label="${ui.esc(a.label)}">${SEV.map((s) => `<button data-ae="${a.id}" data-sev="${s.v}" aria-pressed="${(marks[a.id] || 'none') === s.v}">${s.l}</button>`).join('')}</div></div>`).join('')}
          <label class="field"><span class="hint">Что-то ещё?</span><textarea id="note" placeholder="Например: тяжело засыпать после вечернего приёма">${ui.esc(note)}</textarea></label>
          <button class="btn btn--pill btn--block" data-send>Отправить врачу</button>
          ${sentSevere === true ? '<div class="card card--help"><p>Врач получил сигнал и свяжется с вами. Если состояние резко ухудшилось — звоните 112.</p></div>' : ''}
          ${sentSevere === false ? '<p class="hint" role="status">Отправлено. Врач увидит ваши отметки.</p>' : ''}
        </section>
      </section>`);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ae]');
    if (b) { note = document.getElementById('note').value; marks[b.dataset.ae] = b.dataset.sev; render(); return; }
    const d = e.target.closest('[data-dose]');
    if (d && d.getAttribute('aria-pressed') !== 'true') { store.addEvent(ctx.pid, 'dose', { slot: d.dataset.dose, taken: true }); app.toast('Приём отмечен'); render(); return; }
    if (e.target.closest('[data-send]')) {
      note = document.getElementById('note').value.trim();
      const drug = data.drugs[ctx.patient().plan.drugId];
      const items = Object.entries(marks).filter(([, s]) => s !== 'none')
        .map(([id, severity]) => ({ id, severity, label: drug.adverseEvents.find((a) => a.id === id).label }));
      if (!items.length && !note) { app.toast('Отметьте хотя бы один пункт или напишите пару слов'); return; }
      store.addEvent(ctx.pid, 'ae', { items, note });
      sentSevere = items.some((i) => i.severity === 'severe');
      Object.keys(marks).forEach((k) => delete marks[k]); note = '';
      render();
    }
  });
  render();
})();
