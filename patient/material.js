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
      ${m.breath ? `<section class="card stack" style="text-align:center"><div class="breath" id="b">Вдох</div><button class="btn btn--primary" data-breath>Начать</button></section>` : ''}
      ${m.body.map(block).join('')}
      <p class="hint">Источник: ${ui.esc(m.source)}</p></article>`);
  let timer = null;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-breath]');
    if (!b) return;
    const el = document.getElementById('b');
    if (timer) { clearTimeout(timer); timer = null; el.classList.remove('in'); el.textContent = 'Вдох'; b.textContent = 'Начать'; return; }
    b.textContent = 'Остановить';
    const end = Date.now() + m.breath.minutes * 60000;
    const cycle = (inhale) => {
      if (Date.now() > end) { el.textContent = 'Готово'; el.classList.remove('in'); b.textContent = 'Начать'; timer = null; return; }
      el.style.transitionDuration = `${inhale ? m.breath.inhale : m.breath.exhale}s`;
      el.classList.toggle('in', inhale); el.textContent = inhale ? 'Вдох' : 'Выдох';
      timer = setTimeout(() => cycle(!inhale), (inhale ? m.breath.inhale : m.breath.exhale) * 1000);
    };
    cycle(true);
  });
})();
