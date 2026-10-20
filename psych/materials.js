(function () {
  const { ui, psychApp: P, data } = KK;
  P.start({ nav: 'materials' });
  const I = data.intake;
  const row = (title, n, src, lic) => `<tr><td>${ui.esc(title)}</td><td>${n}</td><td class="hint">${ui.esc(src)}</td><td class="hint">${ui.esc(lic)}</td></tr>`;
  const RULES = [
    ['psychiatrist_required', 'C-SSRS: умеренный или высокий риск (также критический алерт и экран помощи пациенту)', I.sources.cssrs],
    ['psychiatrist_required', 'DASS-21: Депрессия ≥ 21 или Тревога ≥ 15', I.sources.dass],
    ['psychiatrist_required', 'Анкета: видел(а)/слышал(а) то, чего не видят другие; периоды приподнятого настроения с малой потребностью во сне', I.sources.history],
    ['psychotherapy_desirable', 'DASS-21: любая подшкала в умеренной полосе (Д 14–20, Т 10–14, С 19–25) или Стресс ≥ 26', I.sources.dass],
    ['consultation', 'DASS-21: лёгкие значения (Д 10–13, Т 8–9, С 15–18)', I.sources.dass],
    ['observation', 'DASS-21: все подшкалы в норме', I.sources.dass],
  ];
  ui.mount('#app', `
    <div class="page-head"><h1>Материалы первичного приёма</h1></div>
    <div class="stack-l">
      <section class="card stack"><h2>Батарея и порядок</h2>
        <ol class="q-list">${I.steps.map((s) => `<li>${ui.esc(s.label)}${s.optional ? ' — по желанию пациента' : ''}</li>`).join('')}</ol>
        <p class="hint">Скрининг безопасности стоит сразу после короткой анкеты: при риске пациент видит экран помощи до длинных опросников, а психолог и врач — критический сигнал. Около ${I.minutes} минут.</p></section>
      <section class="card stack"><h2>Методики, источники и условия использования</h2>
        <table class="table"><thead><tr><th>Методика</th><th>Пунктов</th><th>Источник</th><th>Условия использования</th></tr></thead><tbody>
          ${['cssrs', 'tipi10', 'dass21'].map((k) => { const s = data.scales[k]; return row(s.title, s.items.length, s.source, s.license); }).join('')}
          ${row('ЦТО — цветовой тест отношений (Эткинд)', `${data.cto.concepts.length} понятий + предпочтение`, data.cto.source, data.cto.license)}
          ${I.excluded.map((x) => row(x.title, '—', '—', x.reason)).join('')}
        </tbody></table>
        <p class="hint">DASS-21: формулировки — русская версия А.А. Золотаревой; пороги тяжести — Lovibond & Lovibond (1995), сумма подшкалы × 2. Русские нормы адаптации (по сырой сумме) в прототипе не используются.
          TIPI-RU: подписи градаций 2, 3, 5, 6 — перевод оригинала (в адаптации подписаны 1, 4 и 7). C-SSRS: формулировки самоотчёта ${ui.esc(I.cssrsPatient.verify)}.</p></section>
      <section class="card stack"><h2>Правила маршрута</h2>
        <p class="hint">Правила команды, ${ui.esc(I.teamNote)}. Применяется самый высокий сработавший уровень; психолог подтверждает или меняет маршрут с обязательной причиной, всё пишется в журнал.</p>
        <table class="table"><thead><tr><th>Маршрут</th><th>Условие</th><th>Источник</th></tr></thead><tbody>
          ${RULES.map(([l, t, s]) => `<tr><td>${P.levelBadge(l, { short: true })}</td><td>${ui.esc(t)}</td><td class="hint">${ui.esc(s)} · правило команды</td></tr>`).join('')}
        </tbody></table>
        <p class="hint">TIPI-RU и ЦТО в маршрутизации не участвуют. Для ЦТО показываются только раскладки и нейтральные совпадения (ранговая корреляция Спирмена) — материал для беседы, не интерпретация.</p></section>
      <section class="card stack"><h2>Правовые рамки</h2><p>${ui.esc(I.legal)}</p>
        <p class="hint">В интерфейсе: «предварительная оценка», «направление на консультацию». Пациенту не показываются баллы, уровни и интерпретации — только «Ответы переданы психологу».</p></section>
    </div>`);
})();
