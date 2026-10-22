// Анкета до приёма (спек 2026-10-22 §B): по одному вопросу, «Назад» / «Дальше», черновик на устройстве (kk:previsit-draft:<pid>).
// Отправка через KK.sync (тип previsit). «Да» на вопрос о самоповреждении — сразу экран помощи и критический сигнал врачу
// (ответы до этого места уходят как незавершённая анкета); без связи — help.html?from=offline. Пациенту — без баллов.
(function () {
  const { ui, store, patientApp: app, questionnaire: Q } = KK;
  const ctx = app.start({ tab: null, back: 'index.html' });
  if (!ctx) return;
  const def = KK.data.questionnaires.previsit;
  const DRAFT = Q.draftKey(ctx.pid);
  const assignment = ctx.patient().previsit || null;
  if (!assignment) { location.replace('index.html'); return; }

  let st = { sentAt: assignment.sentAt, step: 'intro', i: 0, answers: {}, urgentSent: false };
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT));
    // Черновик к прежней отправке анкеты не подходит: врач отправил новую.
    if (d && typeof d === 'object' && d.sentAt === assignment.sentAt && d.answers && typeof d.answers === 'object') st = Object.assign(st, d);
  } catch (e) { /* */ }
  const save = () => { try { localStorage.setItem(DRAFT, JSON.stringify(st)); } catch (e) { /* приватный режим */ } };
  const drop = () => { try { localStorage.removeItem(DRAFT); } catch (e) { /* */ } };
  let pending = false, busy = false;
  const state = app.previsitState(ctx.patient(), store.events(ctx.pid, 'previsit'), KK.sync.queued(ctx.pid));
  if (state === 'completed') { drop(); st.step = 'already'; }

  const qs = () => Q.visible(def, st.answers, ctx.patient());
  const cur = () => { const list = qs(); if (st.i >= list.length) st.i = list.length - 1; if (st.i < 0) st.i = 0; return list[st.i]; };
  const backLink = `<a class="p-back" href="index.html">${ui.icon('back', 18)}Сделать перерыв</a>`;
  const prevBtn = () => (st.i > 0 ? '<button class="btn btn--ghost" data-prev>Назад</button>' : '');
  const nav = (last) => `<div class="q-nav">${prevBtn()}<button class="btn btn--pill btn--step${last ? ' is-last' : ''}" data-next>${last ? 'Отправить' : 'Дальше'}</button></div>`;
  const choiceOpts = (q) => (q.type === 'yesno' ? [{ v: true, label: 'Да' }, { v: false, label: 'Нет' }] : q.options);

  function intro() {
    const vd = assignment.visitDate ? ui.fmtDate(`${assignment.visitDate}T12:00:00`) : '';
    return `${backLink}
      <section class="stack-l" style="padding-top:4vh">
        <div class="hello-orb" aria-hidden="true"></div>
        <h1 id="q" tabindex="-1">${ui.esc(def.title)}</h1>
        <p>${ui.esc(def.intro)}</p>
        <p class="hint">Около ${def.minutes} минут${vd ? ` · приём ${ui.esc(vd)}` : ''}. Можно сделать перерыв: ответы сохранятся на этом устройстве.</p>
        <button class="btn btn--pill btn--block" data-start>${Object.keys(st.answers).length ? 'Продолжить' : 'Начать'}</button>
      </section>`;
  }

  function body(q, last) {
    const v = st.answers[q.id];
    if (q.type === 'text') {
      return `<label class="field"><span class="sr-only">${ui.esc(q.title)}</span><textarea id="ta" rows="4" maxlength="600">${ui.esc(typeof v === 'string' ? v : '')}</textarea></label>${nav(last)}`;
    }
    if (q.type === 'multi') {
      const on = Array.isArray(v) ? v : [];
      return `<fieldset class="stack" style="border:0;padding:0;margin:0"><legend class="sr-only">${ui.esc(q.title)}</legend>
        ${q.options.map((o) => `<label class="check"><input type="checkbox" data-multi="${ui.esc(o.v)}" ${on.includes(o.v) ? 'checked' : ''}><span>${ui.esc(o.label)}</span></label>`).join('')}
        </fieldset>${nav(last)}`;
    }
    if (q.type === 'list') {
      const rows = Array.isArray(v) && v.length ? v : [{ name: '', dose: '' }];
      return `<div class="stack">${rows.map((r, k) => `
        <div class="stack" role="group" aria-label="Лекарство ${k + 1}" style="border-top:1px solid var(--line);padding-top:10px">
          ${q.fields.map((f) => `<label class="field"><span class="hint">${ui.esc(f.label)}</span>
            <input class="input" data-row="${k}" data-f="${ui.esc(f.id)}" maxlength="120" value="${ui.esc((r && r[f.id]) || '')}" autocomplete="off"></label>`).join('')}
          ${rows.length > 1 ? `<button class="btn btn--ghost" data-del="${k}" aria-label="Убрать лекарство ${k + 1}">Убрать</button>` : ''}
        </div>`).join('')}
        ${rows.length < (q.max || 10) ? '<button class="btn" data-add>Добавить ещё лекарство</button>' : ''}</div>${nav(last)}`;
    }
    const opts = choiceOpts(q);
    return `<div class="stack" role="group" aria-labelledby="q">${opts.map((o, k) =>
      `<button class="choice" data-k="${k}" aria-pressed="${v === o.v}">${ui.esc(o.label)}</button>`).join('')}</div>
      ${last && v !== undefined ? nav(true) : prevBtn()}`;
  }

  function question() {
    const list = qs();
    const q = cur();
    const last = st.i === list.length - 1;
    return `${backLink}
      <p class="hint">${ui.esc(def.title)} · ${st.i + 1} из ${list.length}</p>
      <div class="progress" aria-hidden="true">${list.map((_, k) => `<i class="${k <= st.i ? 'on' : ''}"></i>`).join('')}</div>
      <section class="stack-l" style="margin-top:20px">
        ${q.stem ? `<p class="hint">${ui.esc(q.stem)}</p>` : ''}
        <h2 id="q" class="tile-title" tabindex="-1" style="font-size:1.45em">${ui.esc(q.title)}</h2>
        ${q.hint ? `<p class="hint">${ui.esc(q.hint)}</p>` : ''}
        ${body(q, last)}
      </section>`;
  }

  function done() {
    const sh = Q.selfHarm(st.answers);
    return `<section class="stack-l" style="padding-top:8vh">
        <div class="hello-orb" aria-hidden="true"></div>
        <h1 id="q" tabindex="-1">${st.step === 'already' ? 'Анкета уже отправлена' : 'Спасибо'}</h1>
        <p>${ui.esc(def.done)}</p>
        ${pending ? `<p class="hint">${ui.esc(app.SYNC_PENDING)}</p>` : ''}
        ${sh ? '<p class="hint">Если сейчас тяжело, контакты помощи всегда под рукой.</p><a class="btn btn--block" href="help.html">Помощь рядом</a>' : ''}
        <a class="btn btn--pill btn--block" href="index.html">На главную</a>
      </section>`;
  }

  function render(focus = true) {
    KK.host.guardClose(st.step === 'q');
    ui.mount('#app', st.step === 'intro' ? intro() : st.step === 'q' ? question() : done());
    if (focus) { const h = document.getElementById('q'); if (h) h.focus({ preventScroll: false }); }
  }

  const payload = (status) => ({ questionnaireId: def.id, version: def.version, assignedAt: st.sentAt, status, answers: Q.clean(def, st.answers, ctx.patient()) });
  const toHelp = (from) => { KK.host.guardClose(false); location.replace(`help.html?from=${from}`); };

  // «Да» на вопрос о самоповреждении: отправить то, что уже заполнено, и сразу показать помощь. Анкету можно продолжить позже.
  function urgentNow() {
    st.i++;
    try { KK.sync.submit(ctx.pid, 'previsit', payload('in-progress')); } catch (err) {
      if (!err.offline) { st.i--; app.toast('Не получилось сохранить. Попробуйте ещё раз'); return; }
      save(); toHelp('offline'); return;
    }
    st.urgentSent = true;
    save();
    toHelp('previsit');
  }

  function finish() {
    const p = ctx.patient();
    const miss = Q.missing(def, st.answers, p);
    if (miss.length) {
      st.i = Math.max(0, qs().findIndex((q) => q.id === miss[0]));
      save(); render();
      app.toast('Остался вопрос без ответа');
      return;
    }
    let e;
    try { e = KK.sync.submit(ctx.pid, 'previsit', payload('completed')); } catch (err) {
      if (!err.offline) { app.toast('Не получилось сохранить. Попробуйте ещё раз'); return; }
      save(); toHelp('offline'); return;
    }
    pending = !!(e && e.pending);
    drop();
    st.step = 'done';
    render();
  }

  function next() {
    if (st.i < qs().length - 1) { st.i++; save(); render(); } else finish();
  }

  function answered(q, v) {
    st.answers[q.id] = v;
    if (q.urgent && v === true && !st.urgentSent) { urgentNow(); return; }
    next();
  }

  document.addEventListener('input', (e) => {
    if (st.step !== 'q') return;
    const q = cur();
    if (e.target.id === 'ta' && q.type === 'text') { st.answers[q.id] = e.target.value.slice(0, 600); save(); return; }
    if (e.target.dataset && e.target.dataset.row != null && q.type === 'list') {
      const rows = Array.isArray(st.answers[q.id]) && st.answers[q.id].length ? st.answers[q.id] : [{ name: '', dose: '' }];
      const k = Number(e.target.dataset.row);
      if (rows[k]) rows[k][e.target.dataset.f] = e.target.value.slice(0, 120);
      st.answers[q.id] = rows; save();
    }
  });
  document.addEventListener('change', (e) => {
    const box = e.target.closest && e.target.closest('[data-multi]');
    if (!box || st.step !== 'q') return;
    const q = cur();
    const v = box.dataset.multi;
    let on = Array.isArray(st.answers[q.id]) ? st.answers[q.id].slice() : [];
    if (box.checked) {
      // «Нет хронических заболеваний» снимает остальные отметки, и наоборот.
      on = q.exclusive && v === q.exclusive ? [v] : on.filter((x) => x !== q.exclusive).concat(v);
    } else on = on.filter((x) => x !== v);
    st.answers[q.id] = on; save();
    render(false);
    const again = document.querySelector(`[data-multi="${CSS.escape(v)}"]`);
    if (again) again.focus();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-start]')) { st.step = 'q'; save(); render(); return; }
    if (st.step !== 'q') return;
    const q = cur();
    const c = e.target.closest('.choice');
    if (c) {
      if (busy) return;
      busy = true;
      const v = choiceOpts(q)[Number(c.dataset.k)].v;
      document.querySelectorAll('.choice').forEach((b) => b.setAttribute('aria-pressed', String(b === c)));
      KK.host.haptic();
      // busy снимается после перерисовки: быстрый второй тап не ответит на следующий вопрос.
      setTimeout(() => { try { answered(q, v); } finally { busy = false; } }, 220);
      return;
    }
    if (e.target.closest('[data-prev]')) { if (st.i > 0) { st.i--; save(); render(); } return; }
    if (e.target.closest('[data-add]')) {
      const rows = Array.isArray(st.answers[q.id]) && st.answers[q.id].length ? st.answers[q.id] : [{ name: '', dose: '' }];
      rows.push({ name: '', dose: '' }); st.answers[q.id] = rows; save(); render(false);
      const inputs = document.querySelectorAll(`[data-row="${rows.length - 1}"]`);
      if (inputs[0]) inputs[0].focus();
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const rows = (st.answers[q.id] || []).slice();
      rows.splice(Number(del.dataset.del), 1);
      st.answers[q.id] = rows; save(); render(false);
      return;
    }
    if (e.target.closest('[data-next]')) {
      if (q.type === 'text') {
        const ta = document.getElementById('ta');
        const t = ta ? ta.value.trim().slice(0, 600) : '';
        if (!t && !q.optional) { app.toast('Напишите несколько слов, чтобы продолжить'); return; }
        st.answers[q.id] = t;
      }
      if (q.type === 'multi' && !q.optional && !(st.answers[q.id] || []).length) { app.toast('Отметьте хотя бы один вариант'); return; }
      next();
    }
  });

  if (st.step !== 'already') save();
  render();
})();
