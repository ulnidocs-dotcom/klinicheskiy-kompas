(function () {
  const { ui, patientApp: app, data } = KK;
  const ctx = app.start({ tab: null, back: 'materials.html' });
  if (!ctx) return;
  const m = data.materials.find((x) => x.id === ui.param('id'));
  if (!m) { location.replace('materials.html'); return; }
  const block = (b) => typeof b === 'string' ? `<p>${ui.esc(b)}</p>`
    : b.type === 'steps' ? `<ol class="steps">${b.items.map((i) => `<li>${ui.esc(i)}</li>`).join('')}</ol>`
    : `${b.title ? `<p class="q-title">${ui.esc(b.title)}</p>` : ''}<ul class="stack" style="margin:0;padding-left:18px">${b.items.map((i) => `<li>${ui.esc(i)}</li>`).join('')}</ul>`;
  ui.mount('#app', `
    <a class="p-back" href="materials.html">${ui.icon('back', 18)}Материалы</a>
    <article class="stack-l"><header class="stack"><span class="hint">${m.minutes} мин</span><h1>${ui.esc(m.title)}</h1></header>
      ${m.breath ? `<section class="card breath-wrap"><div class="breath" id="b"><span class="label" id="bp" role="status">Вдох</span><span class="num" id="bs" aria-hidden="true">${m.breath.inhale}</span></div><button class="btn btn--pill" data-breath>Начать</button></section>` : ''}
      ${m.body.map(block).join('')}
      <p class="hint">Источник: ${ui.esc(m.source)}</p></article>`);
  let timer = null; let tick = null;
  // Фаза — словом (role=status), секунды фазы — точечными цифрами; сфера растёт на вдохе и сжимается на выдохе.
  const show = (phase, sec) => { document.getElementById('bp').textContent = phase; document.getElementById('bs').textContent = sec; };
  const stopTick = () => { clearInterval(tick); tick = null; };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-breath]');
    if (!b) return;
    const el = document.getElementById('b');
    if (timer) { clearTimeout(timer); timer = null; stopTick(); el.classList.remove('in'); show('Вдох', m.breath.inhale); b.textContent = 'Начать'; return; }
    b.textContent = 'Остановить';
    const end = Date.now() + m.breath.minutes * 60000;
    const cycle = (inhale) => {
      stopTick();
      if (Date.now() > end) { show('Готово', ''); el.classList.remove('in'); b.textContent = 'Начать'; timer = null; return; }
      const len = inhale ? m.breath.inhale : m.breath.exhale;
      el.style.transitionDuration = `${len}s`;
      el.classList.toggle('in', inhale);
      let left = len; show(inhale ? 'Вдох' : 'Выдох', left);
      tick = setInterval(() => { left -= 1; if (left > 0) document.getElementById('bs').textContent = left; }, 1000);
      timer = setTimeout(() => cycle(!inhale), len * 1000);
    };
    cycle(true);
  });
})();
