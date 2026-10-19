(function () {
  const { ui, store, doctorApp: D, parser } = KK;
  D.start({ nav: 'import' });
  const SAMPLES = {
    'Выписка (терапевт)': 'Пациентка К., 34 года. Диагноз: F41.1 Генерализованное тревожное расстройство.\nСопутствующие: ХБП С3а, СКФ (CKD-EPI) 52 мл/мин/1,73м2. Принимает: сертралин 50 мг утром, феназепам по требованию.\nЭпилепсию отрицает. Беременность отрицает.',
    'Эпикриз (стационар)': 'ЖАЛОБЫ: тревога, нарушение сна.\nDS осн.: Расстройство адаптации (F43.2) после перенесённой COVID-19 (U09.9).\nТерапия — Трамадол 50 мг при болях; лоразепам.\nЛаб.: рСКФ — 88; цирроз печени, класс Child-Pugh B.\nВозраст: 58 лет. Пол: муж.',
    'Короткая запись': 'Мужчина 17 лет, эпилепсия в анамнезе, получает вальпроевую кислоту.',
  };
  let pid = ui.param('id') || store.patients()[0].id;
  if (!store.patient(pid)) pid = store.patients()[0].id;
  let src = ''; let parsed = null; let done = false;
  const KIND = { diagnosis: 'Диагноз', med: 'Препарат', lab: 'Анализ', condition: 'Состояние' };

  function render() {
    const p = store.patient(pid);
    ui.mount('#app', `
      ${ui.param('id') ? D.patientHeader(p) + D.patientTabs(pid, 'import') : `<div class="page-head"><h1>Импорт истории болезни</h1>
        <label class="field"><span class="hint">Пациент</span><select id="pid">${store.patients().map((x) => `<option value="${ui.esc(x.id)}" ${x.id === pid ? 'selected' : ''}>${ui.esc(x.name)}</option>`).join('')}</select></label></div>`}
      <div class="grid2">
        <section class="card stack"><h2>Текст выписки</h2>
          <div class="row wrap">${Object.keys(SAMPLES).map((k) => `<button class="btn btn--ghost" data-sample="${ui.esc(k)}">${ui.esc(k)}</button>`).join('')}</div>
          <label class="field"><span class="sr-only">Текст</span><textarea id="src" style="min-height:220px" placeholder="Вставьте текст выписки, эпикриза или записи осмотра">${ui.esc(src)}</textarea></label>
          <button class="btn btn--primary" data-parse>Разобрать</button>
          ${parsed ? `<h3>Найдено в тексте</h3><div class="import-preview">${D.highlight(src, parsed.spans)}</div>
            <p class="hint">${Object.entries(KIND).map(([k, l]) => `<mark class="hl hl--${k}">${l}</mark>`).join(' ')}</p>` : ''}</section>
        <section class="card stack"><h2>Будет добавлено в карту</h2>
          ${parsed ? `<dl class="kv">
            <dt>Диагнозы</dt><dd>${parsed.diagnoses.map((d) => `${ui.esc(d.code)} ${ui.esc(d.text)}`).join('<br>') || '—'}</dd>
            <dt>Препараты</dt><dd>${parsed.meds.map((m) => ui.esc(m.name)).join(', ') || '—'}</dd>
            <dt>СКФ</dt><dd>${parsed.labs.egfr ?? '—'}</dd><dt>Child-Pugh</dt><dd>${parsed.labs.childPugh ?? '—'}</dd>
            <dt>Возраст / пол</dt><dd>${parsed.age ?? '—'} / ${parsed.sex === 'f' ? 'жен.' : parsed.sex === 'm' ? 'муж.' : '—'}</dd>
            <dt>Состояния</dt><dd>${ui.esc(parsed.conditions.join(', ')) || '—'}${parsed.pregnant ? ', беременность' : ''}${parsed.postCovid ? ', после COVID-19' : ''}</dd></dl>
            <p class="hint">Проверьте данные перед добавлением: разбор выполняется по правилам и может ошибаться.</p>
            <button class="btn btn--primary" data-apply>Добавить в карту ${ui.esc(p.name)}</button>` : '<p class="muted">Вставьте текст и нажмите «Разобрать».</p>'}
          ${done ? `<div class="signal"><span class="badge badge--ok">Добавлено</span><span>Проверка терапии пересчитана. <a href="therapy.html?id=${pid}">Открыть терапию</a></span></div>` : ''}</section>
      </div>`);
  }
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sample]');
    if (s) { src = SAMPLES[s.dataset.sample]; parsed = null; done = false; render(); }
    if (e.target.closest('[data-parse]')) {
      src = document.getElementById('src').value;
      const t0 = performance.now(); parsed = parser.extract(src); parsed.ms = Math.round(performance.now() - t0);
      done = false; render();
    }
    if (e.target.closest('[data-apply]') && parsed) { store.importParsed(pid, parsed); done = true; render(); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'src') src = e.target.value; });
  document.addEventListener('change', (e) => { if (e.target.id === 'pid') { pid = e.target.value; parsed = null; done = false; render(); } });
  render();
})();
