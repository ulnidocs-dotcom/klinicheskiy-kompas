(function () {
  const { ui, store, patientApp: app, data } = KK;
  const ctx = app.start();
  if (!ctx) return;
  const Q = [
    { key: 'mood', title: 'Какое сегодня настроение?', labels: ['Очень тяжело', 'Тяжело', 'Так себе', 'Неплохо', 'Хорошо'], ends: ['тяжело', 'хорошо'] },
    { key: 'anxiety', title: 'Сколько сегодня беспокойства?', labels: ['Почти нет', 'Немного', 'Заметно', 'Много', 'Очень много'], ends: ['почти нет', 'очень много'] },
    { key: 'sleep', title: 'Как вы спали?', labels: ['Очень плохо', 'Плохо', 'Средне', 'Неплохо', 'Хорошо'], ends: ['плохо', 'хорошо'] },
  ];
  let qi = 0; const answer = {};

  function checkinToday(p) {
    const today = KK.util.dayKey(new Date().toISOString());
    return store.events(p.id, 'checkin').filter((e) => KK.util.dayKey(e.at) === today).at(-1) || null;
  }

  function checkinCard(p) {
    const done = checkinToday(p);
    if (done && qi === 0) return `
      <section class="tile aura aura--sage stack">
        <span class="label">Самочувствие</span>
        <div class="row-between"><p class="tile-title">Отмечено. Спасибо</p><span aria-hidden="true">${ui.icon('check', 26)}</span></div>
        <p class="hint">Врач видит ваши отметки.</p>
      </section>`;
    const q = Q[qi];
    return `
      <section class="tile aura aura--sage stack" aria-labelledby="q">
        <div class="row-between"><span class="label">Самочувствие</span><span class="label">${qi + 1} из 3</span></div>
        <p class="tile-title" id="q">${q.title}</p>
        <div class="dots" role="group" aria-labelledby="q">
          ${q.labels.map((l, i) => `<button class="dot" data-v="${i + 1}" aria-label="${l}" aria-pressed="${answer[q.key] === i + 1}"></button>`).join('')}
        </div>
        <div class="dot-labels"><span>${q.ends[0]}</span><span>${q.ends[1]}</span></div>
        <div class="ticks" aria-hidden="true" style="--pos:${((qi + 0.5) / Q.length) * 100}%"><i></i></div>
      </section>`;
  }

  function medsCard(p) {
    if (!p.plan || p.plan.status !== 'confirmed') return `
      <a class="tile aura aura--rose" href="therapy.html"><span class="label">Лечение</span>
        <div class="tile-row"><p class="tile-title">Врач обсуждает с вами план лечения</p><span class="chev">${ui.icon('pill', 22)}</span></div></a>`;
    const drug = data.drugs[p.plan.drugId];
    const slots = app.doseSlots(store.events(p.id, 'dose'), new Date().toISOString());
    return `
      <section class="tile aura aura--rose stack">
        <div class="row-between"><span class="label">Приём лекарства</span><a class="tile-link" href="therapy.html">Подробнее</a></div>
        <p class="tile-title">${ui.esc(drug.name)} · ${ui.esc(drug.dosing.dose)}</p>
        <div class="slots">${slots.map(app.slotHtml).join('')}</div>
      </section>`;
  }

  function scalesCard(p) {
    const due = app.dueScales(p.latest, new Date().toISOString(), app.prefs(p.id).scaleEveryDays);
    if (!due.length) return '';
    const [first, ...rest] = due;
    return `
      <a class="tile aura aura--lilac" href="scale.html?id=${first}${rest.length ? `&next=${rest.join(',')}` : ''}">
        <span class="label">${due.length === 2 ? 'Около 4 минут' : 'Около 2 минут'}</span>
        <p class="tile-title">Короткий опросник</p>
        <span class="btn btn--pill" aria-hidden="true">Начать</span></a>`;
  }

  function practiceCard() {
    const m = app.practiceOfDay();
    return `
      <a class="tile aura aura--blue" href="material.html?id=${m.id}">
        <span class="label">Практика дня · ${m.minutes} мин</span>
        <div class="tile-row"><p class="tile-title">${ui.esc(m.title)}</p><span class="chev">${ui.icon('leaf', 22)}</span></div></a>`;
  }

  function helpCard() {
    return `
      <a class="tile aura aura--amber" href="help.html">
        <span class="label">Помощь рядом</span>
        <div class="tile-row"><p class="tile-title">Если сейчас тяжело</p><span class="chev">${ui.icon('heart', 22)}</span></div></a>`;
  }

  function header(p, now) {
    const d = new Date(now);
    const marked = new Set(store.events(p.id, 'checkin').map((e) => KK.util.dayKey(e.at)));
    const week = app.week(now, marked);
    return `
      <header class="p-head">
        <div class="day" aria-hidden="true"><span class="num">${d.getDate()}</span>
          <span class="label"><span>${ui.fmtWeekday(now)}</span><span>${ui.fmtDate(now).split(' ')[1]}</span></span></div>
        <span class="sr-only">${ui.fmtWeekday(now)}, ${ui.fmtDate(now)}</span>
        <h1>${ui.greeting()}, ${ui.esc(app.firstName(p))}</h1>
        <ul class="week" aria-label="Эта неделя: дни с отметкой самочувствия">${week.map((w) =>
          `<li class="${w.today ? 'today' : ''} ${w.mark ? 'mark' : ''}"><span aria-hidden="true">${w.label}</span><span class="sr-only">${ui.fmtWeekday(w.iso)}${w.mark ? ', отмечено' : ''}${w.today ? ', сегодня' : ''}</span></li>`).join('')}</ul>
      </header>`;
  }

  function render() {
    const p = ctx.patient();
    const now = new Date().toISOString();
    ui.mount('#app', `
      ${header(p, now)}
      <div class="stack">${checkinCard(p)}${medsCard(p)}
        <div class="tile-grid">${scalesCard(p)}${practiceCard()}${helpCard()}</div></div>`);
  }

  document.addEventListener('click', (e) => {
    const dot = e.target.closest('.dot');
    if (dot) {
      answer[Q[qi].key] = Number(dot.dataset.v);
      KK.tg.haptic();
      if (qi < Q.length - 1) { qi++; render(); }
      else {
        store.addEvent(ctx.pid, 'checkin', Object.assign({}, answer));
        qi = 0; Object.keys(answer).forEach((k) => delete answer[k]);
        app.toast('Отмечено. Спасибо');
        render();
      }
      return;
    }
    const slot = e.target.closest('[data-dose]');
    if (slot && slot.getAttribute('aria-pressed') !== 'true') {
      store.addEvent(ctx.pid, 'dose', { slot: slot.dataset.dose, taken: true });
      app.toast('Приём отмечен');
      render();
    }
  });
  store.subscribe(render);
  render();
})();
