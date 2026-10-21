(function () {
  const { ui, store, patientApp: app } = KK;
  const ctx = app.start({ tab: null, back: 'index.html' });
  if (!ctx) return;
  const id = ui.param('id');
  const def = app.patientScale(id);
  if (!def) { location.replace('index.html'); return; }
  KK.host.guardClose(true);
  const next = app.nextScales(ui.param('next'));
  const DRAFT = `kk:draft:${ctx.pid}:${id}`;
  let answers = []; let i = 0; let busy = false;
  try { const d = JSON.parse(sessionStorage.getItem(DRAFT)); if (d) { answers = d.answers; i = d.i; } } catch (e) { /* */ }
  const save = () => { try { sessionStorage.setItem(DRAFT, JSON.stringify({ answers, i })); } catch (e) { /* */ } };

  function question() {
    return `
      <a class="p-back" href="index.html">${ui.icon('back', 18)}Сделать перерыв</a>
      <div class="progress" aria-hidden="true">${def.items.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="ticks" aria-hidden="true" style="--pos:${((i + 0.5) / def.items.length) * 100}%;margin-top:10px"><i></i></div>
      <section class="stack-l" style="margin-top:20px">
        <p class="hint">${ui.esc(def.patientTitle)} · ${i + 1} из ${def.items.length}</p>
        <p class="hint">${ui.esc(def.instruction)}</p>
        <h2 id="q" class="tile-title" style="font-size:1.45em">${ui.esc(def.items[i])}</h2>
        <div class="stack" role="group" aria-labelledby="q">
          ${def.options.map((o) => `<button class="choice" data-v="${o.v}" aria-pressed="${answers[i] === o.v}">${ui.esc(o.label)}</button>`).join('')}
        </div>
        ${i > 0 ? '<button class="btn btn--ghost" data-prev>Назад</button>' : ''}
      </section>`;
  }

  function result(r) {
    const text = (KK.scales.interpret(id, r.total, 'patient') || {}).label || 'Ответы отправлены вашему врачу.';
    const nextHref = next.length ? `scale.html?id=${next[0]}${next.length > 1 ? `&next=${next.slice(1).join(',')}` : ''}` : null;
    return `
      <section class="stack-l" style="padding-top:8vh">
        <div class="hello-orb" aria-hidden="true"></div>
        <h1>Спасибо</h1>
        <p>${ui.esc(text)}</p>
        <p class="hint">Ответы отправлены вашему врачу.</p>
        ${nextHref ? `<a class="btn btn--pill btn--block" href="${nextHref}">Ещё один короткий опросник</a><a class="btn btn--ghost btn--block" href="index.html">Позже</a>`
          : '<a class="btn btn--pill btn--block" href="index.html">На главную</a>'}
      </section>`;
  }

  function finish() {
    KK.host.guardClose(false);
    let e;
    try { e = KK.sync.submit(ctx.pid, 'scale', { scaleId: id, answers }); } catch (err) {
      if (!err.offline) throw err;
      location.replace('help.html'); // экран помощи с 112 — без обещания, что ответы дошли
      return;
    }
    try { sessionStorage.removeItem(DRAFT); } catch (err) { /* */ }
    if (e.payload.flags && e.payload.flags.item9 > 0) { location.replace('help.html?from=phq9'); return; }
    ui.mount('#app', result(e.payload));
  }

  document.addEventListener('click', (e) => {
    const c = e.target.closest('.choice');
    if (c) {
      if (busy) return;
      busy = true;
      answers[i] = Number(c.dataset.v);
      KK.host.haptic();
      ui.mount('#app', question());
      setTimeout(() => {
        busy = false;
        if (i < def.items.length - 1) { i++; save(); ui.mount('#app', question()); }
        else finish();
      }, 220);
    }
    if (e.target.closest('[data-prev]') && !busy && i > 0) { i--; save(); ui.mount('#app', question()); }
  });
  ui.mount('#app', question());
})();
