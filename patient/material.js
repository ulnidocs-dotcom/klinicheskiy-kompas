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
      ${m.breath ? `<section class="card breath-wrap" id="bw">
        <p class="breath-cap">Вдох ${m.breath.inhale} · выдох ${m.breath.exhale}</p>
        <div class="breath-stage"><div class="breath-deco" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div><div class="breath" id="b"></div></div>
        <div class="breath-read"><span class="label" id="bp" role="status">Вдох</span><span class="num" id="bs" aria-hidden="true">${m.breath.inhale}</span></div>
        <div class="breath-meta" aria-hidden="true"><div><span class="hint">Вдох</span><b>${m.breath.inhale} ${ui.plural(m.breath.inhale, ['счёт', 'счёта', 'счётов'])}</b></div><div><span class="hint">Выдох</span><b>${m.breath.exhale} ${ui.plural(m.breath.exhale, ['счёт', 'счёта', 'счётов'])}</b></div></div>
        <div class="breath-bar" aria-hidden="true"><span></span></div>
        <button class="btn btn--pill" data-breath>Начать</button></section>` : ''}
      ${m.body.map(block).join('')}
      <p class="hint">Источник: ${ui.esc(m.source)}</p></article>`);
  let timer = null; let tick = null;
  // Фаза — словом (role=status), секунды фазы — точечными цифрами; сфера растёт на вдохе и сжимается на выдохе.
  const show = (phase, sec) => { document.getElementById('bp').textContent = phase; document.getElementById('bs').textContent = sec; };
  const stopTick = () => { clearInterval(tick); tick = null; };
  // Полоса цикла (видна в стиле «Закат»): за вдох доходит до доли вдоха, за выдох — до конца, на новом вдохе сбрасывается.
  const fill = (pct, sec) => { const s = document.querySelector('.breath-bar span'); s.style.transition = sec ? `width ${sec}s linear` : 'none'; if (!sec) void s.offsetWidth; s.style.width = pct; };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-breath]');
    if (!b) return;
    const el = document.getElementById('b');
    const wrap = document.getElementById('bw');
    if (timer) { clearTimeout(timer); timer = null; stopTick(); el.classList.remove('in'); wrap.classList.remove('running'); fill('0%', 0); show('Вдох', m.breath.inhale); b.textContent = 'Начать'; return; }
    b.textContent = 'Остановить';
    wrap.classList.add('running');
    const end = Date.now() + m.breath.minutes * 60000;
    const cycle = (inhale) => {
      stopTick();
      if (Date.now() > end) { show('Готово', ''); el.classList.remove('in'); wrap.classList.remove('running'); b.textContent = 'Начать'; timer = null; return; }
      const len = inhale ? m.breath.inhale : m.breath.exhale;
      el.style.transitionDuration = `${len}s`;
      el.classList.toggle('in', inhale);
      if (inhale) fill('0%', 0);
      fill(inhale ? `${Math.round(m.breath.inhale / (m.breath.inhale + m.breath.exhale) * 100)}%` : '100%', len);
      let left = len; show(inhale ? 'Вдох' : 'Выдох', left);
      tick = setInterval(() => { left -= 1; if (left > 0) document.getElementById('bs').textContent = left; }, 1000);
      timer = setTimeout(() => cycle(!inhale), len * 1000);
    };
    cycle(true);
  });
})();
