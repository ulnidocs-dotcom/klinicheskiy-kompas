(function () {
  const { ui, store, doctorApp: D, data } = KK;
  D.start({ nav: 'patients' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('index.html'); return; }
  let sid = ui.param('scale') || (store.patient(id).signals.some((s) => s.ruleId === 'si_phq9') ? 'cssrs' : 'phq9');
  let answers = [];
  const cssrsVisible = (i) => i < 2 || i === 5 || answers[1] === 1;

  function render() {
    const p = store.patient(id);
    const def = data.scales[sid];
    const shown = def.items.map((t, i) => ({ t, i })).filter(({ i }) => sid !== 'cssrs' || cssrsVisible(i));
    const filled = shown.every(({ i }) => answers[i] != null);
    const full = sid === 'cssrs' ? def.items.map((_, i) => (cssrsVisible(i) ? answers[i] ?? null : 0)) : answers.concat(Array(def.items.length - answers.length).fill(null)).slice(0, def.items.length);
    const r = KK.scales.score(sid, full);
    const bandLabel = r.band ? r.band.doctorLabel : '';
    ui.mount('#app', `
      ${D.patientHeader(p)}${D.patientTabs(id, 'assess')}
      <div class="row wrap" style="margin-bottom:12px">${['phq9', 'gad7', 'cssrs'].map((x) => `<a class="btn ${x === sid ? 'btn--primary' : ''}" href="?id=${id}&scale=${x}">${ui.esc(data.scales[x].title.split(' —')[0])}</a>`).join('')}</div>
      <section class="card stack"><h2>${ui.esc(def.title)}</h2><p class="muted">${ui.esc(def.instruction)}</p>
        <table class="table scale-table"><tbody>${shown.map(({ t, i }) => `<tr><td style="width:32px" class="hint">${i + 1}</td><td>${ui.esc(t)}</td>
          <td><div class="opts" role="radiogroup" aria-label="Вопрос ${i + 1}">${def.options.map((o) => `<label title="${ui.esc(o.label)}"><input type="radio" name="q${i}" value="${o.v}" ${answers[i] === o.v ? 'checked' : ''}><span>${sid === 'cssrs' ? ui.esc(o.label) : o.v}</span></label>`).join('')}</div></td></tr>`).join('')}</tbody></table>
        ${sid !== 'cssrs' ? `<p class="hint">${def.options.map((o) => `${o.v} — ${ui.esc(o.label)}`).join(' · ')}</p>` : ''}
        <div class="total row-between"><div><b>${ui.esc(sid === 'cssrs' ? (bandLabel || 'Ответьте на вопросы') : r.band ? `Сумма: ${r.total} — ${bandLabel}` : `Сумма: ${r.total} (ответьте на все вопросы)`)}</b>
          <div class="hint">${ui.esc(def.source)} · ${ui.esc(def.license)}</div></div>
          <button class="btn btn--primary" data-save ${filled ? '' : 'aria-disabled="true"'}>Сохранить в карту</button></div>
        <p class="hint" id="msg" role="status"></p></section>`);
  }
  document.addEventListener('change', (e) => {
    const m = /^q(\d+)$/.exec(e.target.name || '');
    if (m) { answers[Number(m[1])] = Number(e.target.value); render(); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-save]')) return;
    const def = data.scales[sid];
    const full = def.items.map((_, i) => (sid === 'cssrs' && !cssrsVisible(i) ? 0 : answers[i]));
    if (full.some((v) => v == null)) { document.getElementById('msg').textContent = 'Ответьте на все вопросы.'; return; }
    store.addEvent(id, 'scale', { scaleId: sid, answers: full });
    answers = [];
    location.href = `patient.html?id=${id}`;
  });
  render();
})();
