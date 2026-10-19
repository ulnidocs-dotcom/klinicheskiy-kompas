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
      <section class="card row-between">
        <div><p class="q-title">Самочувствие отмечено</p><p class="hint">Спасибо. Врач видит ваши отметки.</p></div>
        <span style="color:var(--accent)">${ui.icon('check')}</span>
      </section>`;
    const q = Q[qi];
    return `
      <section class="card stack" aria-labelledby="q">
        <div class="row-between"><p class="q-title" id="q">${q.title}</p><span class="hint">${qi + 1} из 3</span></div>
        <div class="dots" role="group" aria-labelledby="q">
          ${q.labels.map((l, i) => `<button class="dot" data-v="${i + 1}" aria-label="${l}" aria-pressed="${answer[q.key] === i + 1}"></button>`).join('')}
        </div>
        <div class="dot-labels"><span>${q.ends[0]}</span><span>${q.ends[1]}</span></div>
      </section>`;
  }

  function medsCard(p) {
    if (!p.plan || p.plan.status !== 'confirmed') return `
      <a class="card link-card" href="therapy.html"><div><p class="q-title">Лечение</p><p class="hint">Врач обсуждает с вами план лечения</p></div><span class="chev">${ui.icon('pill', 20)}</span></a>`;
    const drug = data.drugs[p.plan.drugId];
    const slots = app.doseSlots(store.events(p.id, 'dose'), new Date().toISOString());
    return `
      <section class="card card--tint stack">
        <div class="row-between"><p class="q-title">${ui.esc(drug.name)} · ${ui.esc(drug.dosing.dose)}</p><a class="hint" href="therapy.html">Подробнее</a></div>
        <div class="slots">${slots.map((s) => `<button class="slot" data-dose="${s.slot}" aria-pressed="${s.taken}">${s.taken ? ui.icon('check', 18) : ''}${s.slot === 'утро' ? 'Утро' : 'Вечер'}</button>`).join('')}</div>
      </section>`;
  }

  function scalesCard(p) {
    const due = app.dueScales(p.latest, new Date().toISOString(), app.prefs(p.id).scaleEveryDays);
    if (!due.length) return '';
    const [first, ...rest] = due;
    return `
      <a class="card link-card" href="scale.html?id=${first}${rest.length ? `&next=${rest.join(',')}` : ''}">
        <div><p class="q-title">Короткий опросник</p><p class="hint">${due.length === 2 ? 'Около 4 минут' : 'Около 2 минут'} · можно сделать перерыв</p></div>
        <span class="chev">${ui.icon('clipboard', 20)}</span></a>`;
  }

  function practiceCard() {
    const m = app.practiceOfDay();
    return `
      <a class="card link-card" href="material.html?id=${m.id}">
        <div><p class="hint">Практика дня · ${m.minutes} мин</p><p class="q-title">${ui.esc(m.title)}</p></div>
        <span class="chev">${ui.icon('leaf', 20)}</span></a>`;
  }

  function render() {
    const p = ctx.patient();
    const now = new Date().toISOString();
    ui.mount('#app', `
      <header class="p-head"><span class="date">${ui.fmtWeekday(now)}, ${ui.fmtDate(now)}</span>
        <h1>${ui.greeting()}, ${ui.esc(app.firstName(p))}</h1></header>
      <div class="stack">${checkinCard(p)}${medsCard(p)}${scalesCard(p)}${practiceCard()}</div>`);
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
