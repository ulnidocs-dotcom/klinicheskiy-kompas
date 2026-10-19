(function () {
  const { ui, doctorApp: D, data } = KK;
  D.start({ nav: 'materials' });
  const LV = { critical: 'Критический', important: 'Важный', info: 'Инфо' };
  const RT = { required: 'Обязательно', desirable: 'Желательно' };
  const a = data.drugs.aviandr;
  ui.mount('#app', `
    <div class="page-head"><h1>Материалы и источники</h1></div>
    <div class="stack-l">
      <section class="card stack"><h2>Клинические рекомендации Минздрава России</h2>
        <ul class="feed">
          <li><time>ID 457 · 2024</time><span>Генерализованное тревожное расстройство (РОП). <a href="https://cr.minzdrav.gov.ru/" target="_blank" rel="noopener">Рубрикатор КР</a></span></li>
          <li><time>ID 301 · 2024</time><span>Депрессивный эпизод, рекуррентное депрессивное расстройство (РОП). <a href="https://cr.minzdrav.gov.ru/" target="_blank" rel="noopener">Рубрикатор КР</a></span></li>
        </ul><p class="hint">Международные источники используются только как дополнение и указаны явно у каждого правила.</p></section>
      <section class="card stack"><h2>Инструкция по медицинскому применению</h2>
        <p>${ui.esc(a.name)} (${ui.esc(a.inn)}), ${ui.esc(a.form)}. Рег. № ${ui.esc(a.regNumber)}. <a href="https://grls.rosminzdrav.ru/" target="_blank" rel="noopener">ГРЛС</a></p></section>
      <section class="card stack"><h2>Психометрические шкалы</h2>
        <table class="table"><thead><tr><th>Шкала</th><th>Пунктов</th><th>Источник</th><th>Условия использования</th></tr></thead><tbody>
          ${Object.values(data.scales).map((s) => `<tr><td>${ui.esc(s.title)}</td><td>${s.items.length}</td><td class="hint">${ui.esc(s.source)}</td><td class="hint">${ui.esc(s.license)}</td></tr>`).join('')}
          <tr><td>HADS</td><td>14</td><td class="hint">Zigmond, Snaith, 1983</td><td class="hint">Требует лицензии GL Assessment — в прототипе не используется</td></tr>
        </tbody></table></section>
      <section class="card stack"><h2>Правила алертинга и маршрутизации</h2>
        <p class="hint">Правила хранятся декларативно в <code>data/rules/core.js</code>: новое правило добавляется без изменения ядра.</p>
        <table class="table"><thead><tr><th>Правило</th><th>Уровень</th><th>Маршрутизация</th><th>Источник</th></tr></thead><tbody>
          ${data.rules.map((r) => `<tr><td><b>${ui.esc(r.title)}</b><br><span class="hint">${ui.esc(r.id)}</span></td><td>${LV[r.level]}</td><td>${r.routing ? D.signalBadge({ routing: r.routing }) : '—'}</td><td class="hint">${ui.esc(r.source)}${r.teamRule ? ' · правило команды' : ''}</td></tr>`).join('')}
        </tbody></table></section>
    </div>`);
})();
