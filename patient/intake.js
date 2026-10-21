// Первичная беседа с психологом: анкета → безопасность (C-SSRS) → TIPI-RU → DASS-21 → ЦТО (по желанию).
// Один вопрос на экран, «Назад», «Сделать перерыв» (черновик в localStorage, ключ kk:intake-draft:<id>). Пациенту — только слова, без баллов.
(function () {
  const { ui, store, patientApp: app, data } = KK;
  const ctx = app.start({ tab: null, back: 'index.html' });
  if (!ctx) return;
  const D = data.intake, C = data.cto, S = data.scales;
  const COPY = app.INTAKE_COPY;
  const DRAFT = app.intakeDraftKey(ctx.pid);
  const STEP_N = { form: 1, cssrs: 2, tipi10: 3, dass21: 4, cto_intro: 5, cto: 5 };
  if (!store.intakeOf(ctx.pid)) { location.replace('index.html'); return; }

  let st = { step: null, i: 0, form: {}, cssrs: [], tipi10: [], dass21: [], cto: { k: 0, concepts: {}, preference: [], cur: [] } };
  try { const d = JSON.parse(localStorage.getItem(DRAFT)); if (d && typeof d === 'object') st = Object.assign(st, d); } catch (e) { /* */ }
  const save = () => { try { localStorage.setItem(DRAFT, JSON.stringify(st)); } catch (e) { /* приватный режим */ } };
  const drop = () => { try { localStorage.removeItem(DRAFT); } catch (e) { /* */ } };
  let busy = false, focusQ = true;

  // Шаг из сохранённых частей важнее черновика: часть, уже отправленная психологу, не проходится заново.
  function sync() {
    const next = app.intakeNextStep(store.intakeOf(ctx.pid));
    // Допустимые шаги черновика для каждого состояния хранилища.
    const allowed = next === 'intro' ? ['intro', 'form'] : next === 'cto' ? ['cto_intro', 'cto'] : [next];
    if (!allowed.includes(st.step)) { st.step = allowed[0]; st.i = 0; }
  }
  const formQs = () => D.form.filter((q) => !q.when || q.when(st.form));

  const backLink = `<a class="p-back" href="index.html">${ui.icon('back', 18)}Сделать перерыв</a>`;
  function head(label, count, i) {
    return `${backLink}
      <p class="hint">Шаг ${STEP_N[st.step]} из ${D.steps.length} · ${ui.esc(label)}${count ? ` · ${i + 1} из ${count}` : ''}</p>
      ${count ? `<div class="progress" aria-hidden="true">${Array.from({ length: count }, (_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>` : ''}`;
  }
  const prevBtn = () => (st.i > 0 ? '<button class="btn btn--ghost" data-prev>Назад</button>' : '');
  const choices = (opts, cur) => `<div class="stack" role="group" aria-labelledby="q">${opts.map((o) =>
    `<button class="choice" data-v="${ui.esc(String(o.v))}" aria-pressed="${cur === o.v}">${ui.esc(o.label)}</button>`).join('')}</div>`;

  function intro() {
    return `${backLink}
      <section class="stack-l" style="padding-top:4vh">
        <div class="hello-orb" aria-hidden="true"></div>
        <h1 id="q" tabindex="-1">${ui.esc(COPY[0])}</h1>
        <p>${ui.esc(COPY[1])}</p>
        <ol class="intake-steps">${D.steps.map((s) => `<li>${ui.esc(s.label)}${s.optional ? ' <span class="hint">· по желанию</span>' : ''}</li>`).join('')}</ol>
        <p class="hint">${ui.esc(COPY[2])}</p>
        <button class="btn btn--pill btn--block" data-start>Начать</button>
      </section>`;
  }
  function formStep() {
    const qs = formQs();
    const q = qs[st.i];
    const v = st.form[q.id];
    const body = q.type === 'yesno'
      ? choices([{ v: true, label: 'Да' }, { v: false, label: 'Нет' }], v)
      : `<label class="field"><span class="sr-only">${ui.esc(q.title)}</span><textarea id="ta" rows="4" maxlength="600">${ui.esc(v || '')}</textarea></label>
         <div class="q-nav">${prevBtn()}<button class="btn btn--pill btn--step" data-next>Дальше</button></div>`;
    return `${head(D.steps[0].label, qs.length, st.i)}
      <section class="stack-l" style="margin-top:20px">
        <h2 id="q" class="tile-title" tabindex="-1" style="font-size:1.45em">${ui.esc(q.title)}</h2>
        ${q.hint ? `<p class="hint">${ui.esc(q.hint)}</p>` : ''}
        ${body}
        ${q.type === 'yesno' ? prevBtn() : ''}
      </section>`;
  }
  function cssrsStep() {
    const shown = app.cssrsShown(st.cssrs);
    const idx = shown[st.i];
    return `${head(D.steps[1].label, shown.length, st.i)}
      <section class="stack-l" style="margin-top:20px">
        <p class="hint">${ui.esc(D.cssrsPatient.instruction)}</p>
        <h2 id="q" class="tile-title" tabindex="-1" style="font-size:1.45em">${ui.esc(D.cssrsPatient.items[idx])}</h2>
        ${choices(S.cssrs.options.map((o) => ({ v: o.v, label: o.label })), st.cssrs[idx])}
        ${prevBtn()}
      </section>`;
  }
  function scaleStep(sid, label) {
    const def = S[sid];
    return `${head(label, def.items.length, st.i)}
      <section class="stack-l" style="margin-top:20px">
        <p class="hint">${ui.esc(def.instruction)}</p>
        ${def.stem ? `<p class="muted">${ui.esc(def.stem)}</p>` : ''}
        <h2 id="q" class="tile-title" tabindex="-1" style="font-size:1.45em">${ui.esc(def.items[st.i])}</h2>
        ${choices(def.options, st[sid][st.i])}
        ${prevBtn()}
      </section>`;
  }
  function ctoIntro() {
    return `${head(D.steps[4].label)}
      <section class="stack-l" style="margin-top:20px">
        <h2 id="q" class="tile-title" tabindex="-1" style="font-size:1.45em">${ui.esc(COPY[3])}</h2>
        <p>${ui.esc(COPY[4])}</p>
        <button class="btn btn--pill btn--block" data-cto-start>Пройти</button>
        <button class="btn btn--block" data-cto-skip>Пропустить и завершить</button>
      </section>`;
  }
  function ctoStep() {
    const c = st.cto;
    const pref = c.k >= C.concepts.length;
    const title = pref ? COPY[5] : `«${C.concepts[c.k].label}»`;
    const order = c.cur;
    const total = C.concepts.length + 1;
    return `${head(D.steps[4].label, total, c.k)}
      <section class="stack-l" style="margin-top:20px">
        <p class="hint">${pref ? '' : 'Выберите цвета по порядку: сначала тот, что подходит больше всего.'}</p>
        <h2 id="q" class="tile-title" tabindex="-1" style="font-size:1.45em">${ui.esc(title)}</h2>
        <div class="cto-grid" role="group" aria-labelledby="q">${C.colors.map((col) => {
          const pos = order.indexOf(col.id);
          return `<button class="cchip" data-color="${col.id}" style="--c:${col.hex}" aria-pressed="${pos >= 0}"
            aria-label="${ui.esc(col.name)}${pos >= 0 ? `, выбран ${pos + 1}-м` : ''}"><span class="cchip__s" aria-hidden="true"></span>${pos >= 0 ? `<span class="ord" aria-hidden="true">${pos + 1}</span>` : ''}<span aria-hidden="true">${ui.esc(col.name)}</span></button>`;
        }).join('')}</div>
        <p class="hint" aria-live="polite">Выбрано ${order.length} из ${C.colors.length}</p>
        <div class="q-nav">${order.length ? '<button class="btn" data-undo aria-label="Отменить последний выбор">Отменить</button>' : c.k > 0 ? '<button class="btn btn--ghost" data-prev>Назад</button>' : ''}
          <button class="btn btn--pill btn--step${c.k === total - 1 ? ' is-last' : ''}" data-cto-next${order.length === C.colors.length ? '' : ' aria-disabled="true"'}>${c.k === total - 1 ? 'Готово' : 'Дальше'}</button></div>
      </section>`;
  }
  function done() {
    return `<section class="stack-l" style="padding-top:8vh">
        <div class="hello-orb" aria-hidden="true"></div>
        <h1 id="q" tabindex="-1">${ui.esc(COPY[6])}</h1>
        <p>${ui.esc(COPY[7])}</p>
        <a class="btn btn--pill btn--block" href="index.html">На главную</a>
      </section>`;
  }

  function render() {
    KK.host.guardClose(!['intro', 'done'].includes(st.step));
    const html = st.step === 'intro' ? intro() : st.step === 'form' ? formStep() : st.step === 'cssrs' ? cssrsStep()
      : st.step === 'tipi10' ? scaleStep('tipi10', D.steps[2].label) : st.step === 'dass21' ? scaleStep('dass21', D.steps[3].label)
        : st.step === 'cto_intro' ? ctoIntro() : st.step === 'cto' ? ctoStep() : done();
    ui.mount('#app', html);
    if (focusQ) { const q = document.getElementById('q'); if (q) q.focus({ preventScroll: false }); }
    focusQ = true;
  }
  function go(step) { st.step = step; st.i = 0; save(); render(); }

  function finish(cto) {
    try {
      store.completeIntake(ctx.pid, { cto }); // проверка частей — до записи ЦТО: повтор не создаст дубль
    } catch (err) { app.toast('Не получилось сохранить. Попробуйте ещё раз'); return; }
    drop();
    st.step = 'done';
    render();
  }

  function answered(v) {
    if (st.step === 'form') {
      const q = formQs()[st.i];
      st.form[q.id] = v;
      if (q.id === 'meds' && v === false) delete st.form.medsText;
      if (st.i < formQs().length - 1) { st.i++; save(); return render(); }
      KK.sync.submit(ctx.pid, 'intake_form', Object.assign({ complaint: '', reason: '' }, st.form));
      return go('cssrs');
    }
    if (st.step === 'cssrs') {
      const shown = app.cssrsShown(st.cssrs);
      st.cssrs[shown[st.i]] = v;
      const now = app.cssrsShown(st.cssrs);
      if (st.i < now.length - 1) { st.i++; save(); return render(); }
      const full = [0, 1, 2, 3, 4, 5].map((k) => (now.includes(k) && st.cssrs[k] != null ? st.cssrs[k] : null));
      let e;
      try { e = KK.sync.submit(ctx.pid, 'scale', { scaleId: 'cssrs', answers: full, context: 'intake' }); } catch (err) {
        if (!err.offline) throw err;
        KK.host.guardClose(false);
        location.replace('help.html?from=offline');
        return;
      }
      st.step = 'tipi10'; st.i = 0; save();
      // Риск: сразу экран помощи; беседу можно продолжить позже с TIPI-RU.
      if (e.payload.band && (e.payload.band.code === 'moderate' || e.payload.band.code === 'high')) { KK.host.guardClose(false); location.replace('help.html?from=intake'); return; }
      return render();
    }
    const sid = st.step;
    st[sid][st.i] = v;
    if (st.i < S[sid].items.length - 1) { st.i++; save(); return render(); }
    KK.sync.submit(ctx.pid, 'scale', { scaleId: sid, answers: st[sid], context: 'intake' });
    return go(sid === 'tipi10' ? 'dass21' : 'cto_intro');
  }

  document.addEventListener('input', (e) => {
    if (e.target.id === 'ta' && st.step === 'form') { st.form[formQs()[st.i].id] = e.target.value.slice(0, 600); save(); }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-start]')) return go('form');
    const c = e.target.closest('.choice');
    if (c) {
      if (busy) return;
      busy = true;
      const raw = c.dataset.v;
      const v = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
      document.querySelectorAll('.choice').forEach((b) => b.setAttribute('aria-pressed', String(b === c)));
      KK.host.haptic();
      // busy снимается только после перерисовки, иначе быстрый второй тап ответит на следующий вопрос дважды.
      setTimeout(() => { try { answered(v); } finally { busy = false; } }, 220);
      return;
    }
    if (e.target.closest('[data-next]') && st.step === 'form') {
      const ta = document.getElementById('ta');
      return answered(ta ? ta.value.trim().slice(0, 600) : '');
    }
    if (e.target.closest('[data-prev]')) {
      if (st.step === 'cto') {
        if (st.cto.k > 0) { st.cto.k--; st.cto.cur = (st.cto.concepts[C.concepts[st.cto.k].id] || []).slice(); }
        save(); return render();
      }
      if (st.i > 0) { st.i--; save(); render(); }
      return;
    }
    if (e.target.closest('[data-cto-skip]')) return finish({ skipped: true });
    if (e.target.closest('[data-cto-start]')) { st.cto = { k: 0, concepts: {}, preference: [], cur: [] }; return go('cto'); }
    const chip = e.target.closest('.cchip');
    if (chip) {
      if (st.cto.cur.includes(chip.dataset.color)) return;
      st.cto.cur.push(chip.dataset.color);
      KK.host.haptic();
      save(); focusQ = false; render();
      const next = document.querySelector(st.cto.cur.length === C.colors.length ? '[data-cto-next]' : '.cchip[aria-pressed="false"]');
      if (next) next.focus();
      return;
    }
    if (e.target.closest('[data-undo]')) {
      st.cto.cur.pop(); save(); focusQ = false; render();
      (document.querySelector('[data-undo]') || document.querySelector('.cchip'))?.focus();
      return;
    }
    if (e.target.closest('[data-cto-next]')) {
      if (st.cto.cur.length !== C.colors.length) { app.toast('Выберите все цвета по порядку'); return; }
      const c2 = st.cto;
      if (c2.k < C.concepts.length) c2.concepts[C.concepts[c2.k].id] = c2.cur.slice();
      else c2.preference = c2.cur.slice();
      c2.cur = [];
      if (c2.k < C.concepts.length) { c2.k++; save(); return render(); }
      return finish({ concepts: c2.concepts, preference: c2.preference });
    }
  });

  sync();
  save();
  render();
})();
