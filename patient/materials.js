(function () {
  const { ui, patientApp: app, data } = KK;
  const ctx = app.start();
  if (!ctx) return;
  const CATS = [['practice', 'Практики'], ['about', 'Понять, что происходит'], ['treatment', 'О лечении']];
  ui.mount('#app', `
    <header class="p-head"><h1>Материалы</h1><p class="muted">Короткие тексты и упражнения. Читайте в своём темпе.</p></header>
    <div class="stack-l">${CATS.map(([cat, title]) => `
      <section class="stack"><h2>${title}</h2>
        ${data.materials.filter((m) => m.cat === cat).map((m) => `
          <a class="card link-card" href="material.html?id=${m.id}"><div><p class="q-title">${ui.esc(m.title)}</p><p class="hint">${ui.esc(m.summary)} · ${m.minutes} мин</p></div>
          <span class="chev">${ui.icon(cat === 'practice' ? 'leaf' : 'book', 20)}</span></a>`).join('')}
      </section>`).join('')}</div>`);
})();
