(function () {
  const { ui, store, patientApp: app, data } = KK;
  const ctx = app.start();
  if (!ctx) return;
  const Q = app.CHECKIN_Q;
  const todayKey = () => KK.util.dayKey(new Date().toISOString());

  // Состояние чек-ина: выбранный день (сегодня или до 7 дней назад), режим правки, шаг и ответы.
  // Ничего не сохраняется до «Готово»: ошибочное касание можно поправить, вернуться «Назад» или отменить.
  const st = { day: todayKey(), editing: false, qi: 0, answer: {}, undo: null, focus: null };

  const checkinOn = (p, key) => app.checkinOn(store.events(p.id, 'checkin'), key, KK.sync.queued(p.id));

  function openDay(p, key) {
    const prev = checkinOn(p, key);
    st.day = key; st.qi = 0; st.undo = null;
    st.answer = prev ? { mood: prev.payload.mood, anxiety: prev.payload.anxiety, sleep: prev.payload.sleep } : {};
    st.editing = key !== todayKey() || !!prev;
    st.focus = 'q';
  }
  function closeFlow() { st.day = todayKey(); st.editing = false; st.qi = 0; st.answer = {}; }

  function doneCard(c) {
    const sum = Q.map((q) => `${q.name.toLowerCase()}: ${app.checkinWord(q.key, c.payload[q.key]).toLowerCase()}`).join(' · ');
    return `
      <section class="tile aura aura--sage stack">
        <span class="label">Самочувствие</span>
        <div class="row-between"><p class="tile-title">Отмечено. Спасибо</p><span aria-hidden="true">${ui.icon('check', 26)}</span></div>
        <p class="q-sum">${ui.esc(sum.charAt(0).toUpperCase() + sum.slice(1))}</p>
        <div class="row-between"><p class="hint">Врач видит ваши отметки.</p>
          <button class="btn" data-edit aria-label="Изменить отметку самочувствия за сегодня">Изменить</button></div>
      </section>`;
  }

  function checkinCard(p) {
    const isToday = st.day === todayKey();
    const done = checkinOn(p, st.day);
    if (isToday && done && !st.editing) return doneCard(done);
    const q = Q[st.qi];
    const v = st.answer[q.key];
    const has = Number.isInteger(v);
    const last = st.qi === Q.length - 1;
    const head = isToday ? 'Самочувствие' : `Самочувствие за ${app.dayTitle(st.day)}`;
    const title = isToday ? q.title : q.past;
    const left = st.qi > 0
      ? '<button class="btn" data-back>Назад</button>'
      : st.editing ? `<button class="btn btn--ghost" data-cancel>${isToday ? 'Отмена' : 'К сегодня'}</button>` : '';
    return `
      <section class="tile aura aura--${q.tone} stack q q--${q.tone}" aria-labelledby="q">
        <div class="row-between"><span class="label">${ui.esc(head)}</span><span class="label">${st.qi + 1} из ${Q.length}</span></div>
        <p class="tile-title" id="q" tabindex="-1">${ui.esc(title)}</p>
        <div class="dots" role="group" aria-labelledby="q">
          ${q.labels.map((l, i) => `<button class="dot" data-v="${i + 1}" aria-label="${ui.esc(l)}" aria-pressed="${v === i + 1}"></button>`).join('')}
        </div>
        <div class="dot-labels" aria-hidden="true"><span>${q.ends[0]}</span><span>${q.ends[1]}</span></div>
        <div class="ruler${has ? '' : ' ruler--unset'}" style="--f:${has ? (v - 1) / 4 : 0.5}">
          <input type="range" id="rng" min="1" max="5" step="0.01" value="${has ? v : 3}"
            aria-label="${ui.esc(q.name)}: ползунок" aria-valuetext="${ui.esc(app.checkinWord(q.key, v))}">
        </div>
        <div class="q-nav">${left}
          <button class="btn btn--pill btn--step${last ? ' is-last' : ''}" data-next${has ? '' : ' aria-disabled="true"'}>${last ? 'Готово' : 'Дальше'}</button></div>
      </section>`;
  }

  // Выбор значения без перерисовки: сферы, ползунок и кнопка «Дальше» обновляются на месте — перетаскивание не прерывается.
  function setValue(v, { fromSlider = false } = {}) {
    const q = Q[st.qi];
    if (st.answer[q.key] === v) return;
    st.answer[q.key] = v;
    KK.host.haptic();
    const card = document.querySelector('.q');
    if (!card) return;
    card.querySelectorAll('.dot').forEach((d) => d.setAttribute('aria-pressed', String(Number(d.dataset.v) === v)));
    const ruler = card.querySelector('.ruler');
    ruler.classList.remove('ruler--unset');
    const rng = card.querySelector('#rng');
    if (!fromSlider) glide(rng, v);
    rng.setAttribute('aria-valuetext', app.checkinWord(q.key, v));
    card.querySelector('[data-next]').removeAttribute('aria-disabled');
  }

  function save(p) {
    const key = st.day;
    const isToday = key === todayKey();
    const replaced = !!checkinOn(p, key);
    const payload = { mood: st.answer.mood, anxiety: st.answer.anxiety, sleep: st.answer.sleep };
    let r;
    try {
      r = KK.sync.submit(ctx.pid, 'checkin', payload, isToday ? {} : { at: app.noonOf(key) });
    } catch (err) {
      app.toast('Не получилось сохранить. Попробуйте ещё раз'); // ответы остаются на экране
      return;
    }
    closeFlow();
    st.focus = isToday ? '[data-edit]' : `[data-day="${key}"]`;
    render();
    app.toast(r && r.pending ? app.SYNC_PENDING : replaced ? 'Отметка обновлена' : 'Отмечено. Спасибо');
  }

  function medsCard(p) {
    if (!p.plan || p.plan.status !== 'confirmed') return `
      <a class="tile aura aura--teal" href="therapy.html"><span class="label">Лечение</span>
        <div class="tile-row"><p class="tile-title">Врач обсуждает с вами план лечения</p><span class="chev">${ui.icon('pill', 22)}</span></div></a>`;
    const drug = data.drugs[p.plan.drugId];
    const slots = app.doseSlots(store.events(p.id, 'dose'), new Date().toISOString(), KK.sync.queued(p.id));
    const undo = st.undo && slots.find((s) => s.slot === st.undo && s.taken);
    const body = undo
      ? `<div class="undo" role="group" aria-labelledby="undo-q"><p id="undo-q">Отменить отметку «${undo.slot === 'утро' ? 'Утро' : 'Вечер'} · принято»?</p>
          <div class="row"><button class="btn" data-undo-yes>Отменить отметку</button><button class="btn btn--ghost" data-undo-no>Оставить</button></div></div>`
      : `<div class="slots">${slots.map(app.slotHtml).join('')}</div>`;
    return `
      <section class="tile aura aura--teal stack">
        <div class="row-between"><span class="label">Приём лекарства</span><a class="tile-link" href="therapy.html">Подробнее</a></div>
        <p class="tile-title">${ui.esc(drug.name)} · ${ui.esc(drug.dosing.dose)}</p>
        ${body}
      </section>`;
  }

  function scalesCard(p) {
    const due = app.dueScales(p.latest, new Date().toISOString(), app.prefs(p.id).scaleEveryDays);
    if (!due.length) return '';
    const [first, ...rest] = due;
    return `
      <a class="tile aura aura--lavender" href="scale.html?id=${first}${rest.length ? `&next=${rest.join(',')}` : ''}">
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

  // Назначенная первичная беседа с психологом — пока пациент её не завершил.
  function intakeCard(p) {
    if (!app.intakeDue(p)) return '';
    return `
      <a class="tile aura aura--lavender" href="intake.html">
        <span class="label">${p.intakeStatus === 'in_progress' ? 'Можно продолжить' : 'Около 20 минут'}</span>
        <p class="tile-title">Первичная беседа с психологом</p>
        <span class="btn btn--pill" aria-hidden="true">${p.intakeStatus === 'in_progress' ? 'Продолжить' : 'Начать'}</span></a>`;
  }

  function helpCard() {
    return `
      <a class="tile aura aura--sand" href="help.html">
        <span class="label">Помощь рядом</span>
        <div class="tile-row"><p class="tile-title">Если сейчас тяжело</p><span class="chev">${ui.icon('heart', 22)}</span></div></a>`;
  }

  function header(p, now) {
    const d = new Date(now);
    const marked = app.markedDays(store.events(p.id, 'checkin'), KK.sync.queued(p.id));
    const days = app.recentDays(now, marked, app.BACKDATE_DAYS);
    return `
      <header class="p-head">
        <div class="day" aria-hidden="true"><span class="num">${d.getDate()}</span>
          <span class="label"><span>${ui.fmtWeekday(now)}</span><span>${ui.fmtDate(now).split(' ')[1]}</span></span></div>
        <span class="sr-only">${ui.fmtWeekday(now)}, ${ui.fmtDate(now)}</span>
        <h1>${ui.greeting()}, ${ui.esc(app.firstName(p))}</h1>
        <ul class="week" aria-label="Последние дни: выберите день, чтобы отметить самочувствие">${days.map((w) =>
          `<li class="${w.today ? 'today' : ''} ${w.mark ? 'mark' : ''}"><button data-day="${w.key}" aria-pressed="${st.day === w.key}"
            aria-label="${ui.fmtWeekday(w.iso)}, ${ui.fmtDate(w.iso)}${w.today ? ', сегодня' : ''}${w.mark ? ', отмечено' : ''}">${w.label}</button></li>`).join('')}</ul>
      </header>`;
  }

  function render() {
    const p = ctx.patient();
    const now = new Date().toISOString();
    // Дни старше окна (страница открыта долго) — возвращаемся к сегодня.
    if (!app.recentDays(now, new Set(), app.BACKDATE_DAYS).some((w) => w.key === st.day)) closeFlow();
    const active = document.activeElement;
    const keep = active && active.dataset && active.dataset.day ? `[data-day="${active.dataset.day}"]` : null;
    ui.mount('#app', `
      ${header(p, now)}
      <div class="stack">${intakeCard(p)}${checkinCard(p)}${medsCard(p)}
        <div class="tile-grid">${scalesCard(p)}${practiceCard()}${helpCard()}</div></div>`);
    const target = st.focus === 'q' ? document.getElementById('q')
      : st.focus ? document.querySelector(st.focus) : keep ? document.querySelector(keep) : null;
    st.focus = null;
    if (target) target.focus({ preventScroll: true });
  }

  // Плавный ползунок: тянется непрерывно (step 0.01), сферы подсвечиваются по ближайшему делению,
  // после отпускания бегунок мягко доезжает до деления; клавиши стрелок шагают по целым значениям.
  const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paint(rng, x) {
    rng.value = String(x);
    rng.closest('.ruler')?.style.setProperty('--f', String((x - 1) / 4));
  }
  function stopGlide(rng) { cancelAnimationFrame(rng._raf); clearTimeout(rng._fin); }
  function glide(rng, to) {
    stopGlide(rng);
    const from = Number(rng.value);
    if (reduceMotion() || Math.abs(from - to) < 0.005) { paint(rng, to); return; }
    const t0 = performance.now(), dur = 220;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      paint(rng, from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) rng._raf = requestAnimationFrame(step);
    };
    rng._raf = requestAnimationFrame(step);
    // Если кадры не идут (вкладка в фоне), бегунок всё равно встаёт на деление.
    rng._fin = setTimeout(() => { cancelAnimationFrame(rng._raf); paint(rng, to); }, dur + 80);
  }
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'rng') return;
    const rng = e.target;
    stopGlide(rng);
    rng.closest('.ruler')?.classList.add('ruler--drag');
    paint(rng, Number(rng.value));
    setValue(Math.round(Number(rng.value)), { fromSlider: true });
  });
  document.addEventListener('change', (e) => {
    if (e.target.id !== 'rng') return;
    e.target.closest('.ruler')?.classList.remove('ruler--drag');
    glide(e.target, Math.round(Number(e.target.value)));
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.id !== 'rng') return;
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    const edge = { Home: 1, End: 5 }[e.key];
    if (!d && !edge) return;
    e.preventDefault();
    const cur = Math.round(Number(e.target.value));
    const next = edge || Math.min(5, Math.max(1, cur + d));
    setValue(next, { fromSlider: true });
    glide(e.target, next);
  });

  document.addEventListener('click', (e) => {
    const p = ctx.patient();
    const day = e.target.closest('[data-day]');
    if (day) {
      if (day.dataset.day === todayKey()) { closeFlow(); st.focus = `[data-day="${day.dataset.day}"]`; }
      else { openDay(p, day.dataset.day); }
      render(); return;
    }
    const dot = e.target.closest('.q .dot');
    if (dot) { setValue(Number(dot.dataset.v)); return; }
    if (e.target.closest('[data-next]')) {
      const q = Q[st.qi];
      if (!Number.isInteger(st.answer[q.key])) { app.toast('Выберите один из вариантов'); return; }
      if (st.qi < Q.length - 1) { st.qi++; st.focus = 'q'; render(); } else save(p);
      return;
    }
    if (e.target.closest('[data-back]')) { if (st.qi > 0) st.qi--; st.focus = 'q'; render(); return; }
    if (e.target.closest('[data-cancel]')) { closeFlow(); render(); return; }
    if (e.target.closest('[data-edit]')) { openDay(p, todayKey()); render(); return; }

    if (e.target.closest('[data-undo-no]')) { st.focus = `[data-dose="${st.undo}"]`; st.undo = null; render(); return; }
    if (e.target.closest('[data-undo-yes]')) {
      const slot = st.undo; st.undo = null;
      const t = todayKey();
      const mine = store.events(ctx.pid, 'dose').filter((x) => x.payload.slot === slot && x.payload.taken && KK.util.dayKey(x.at) === t);
      // ещё не отправленная отметка — снимаем из очереди
      const waiting = KK.sync.queued(ctx.pid).filter((q) => q.type === 'dose' && q.payload && q.payload.slot === slot && q.payload.taken && KK.util.dayKey(q.queuedAt) === t);
      try { waiting.forEach((q) => KK.sync.remove(q.clientId)); mine.forEach((x) => store.removeEvent(ctx.pid, x.id)); app.toast('Отметка снята'); } catch (err) { app.toast('Не получилось снять отметку'); }
      st.focus = `[data-dose="${slot}"]`;
      render(); return;
    }
    const slot = e.target.closest('[data-dose]');
    if (slot) {
      if (slot.getAttribute('aria-pressed') === 'true') { st.undo = slot.dataset.dose; st.focus = '[data-undo-no]'; render(); return; }
      st.focus = `[data-dose="${slot.dataset.dose}"]`;
      let r;
      try { r = KK.sync.submit(ctx.pid, 'dose', { slot: slot.dataset.dose, taken: true }); } catch (err) { app.toast('Не получилось сохранить. Попробуйте ещё раз'); return; }
      app.toast(r && r.pending ? app.SYNC_PENDING : 'Приём отмечен');
    }
  });
  store.subscribe(render);
  render();
})();
