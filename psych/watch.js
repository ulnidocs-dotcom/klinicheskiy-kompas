// Наблюдение за пациентом между визитами к психиатру: приёмы, сводка дневника, шкалы, сигналы и лента с прошлого приёма.
// Действие психолога — «Записать к психиатру раньше»: срочная заявка администратору клиники с причиной.
(function () {
  const { ui, store, psychApp: P, doctorApp: D } = KK;
  P.start({ nav: 'observe' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('observe.html'); return; }
  const st = { asking: false, note: '', error: '', saved: '' };

  function earlyBlock(p, v) {
    const open = store.bookings({ patientId: id, status: 'new' }).find((b) => b.to === 'psychiatrist');
    if (open) return `<p class="hint" role="status">${ui.icon('check', 14)} Заявка на запись к психиатру у администратора с ${ui.fmtDateTime(open.createdAt)}${open.urgent ? ' · раньше срока' : ''}.</p>`;
    if (!st.asking) return `<div class="row wrap"><button class="btn btn--primary" data-early>Записать к психиатру раньше</button></div>`;
    return `<div class="stack">
      <label class="field"><span class="hint">Почему раньше срока — увидит администратор и психиатр</span><textarea id="early-note" rows="3" placeholder="Например: настроение снижается вторую неделю, хуже сон">${ui.esc(st.note)}</textarea></label>
      ${st.error ? `<p class="err" role="alert">${ui.esc(st.error)}</p>` : ''}
      <div class="row wrap"><button class="btn btn--primary" data-early-send>Отправить заявку администратору</button><button class="btn btn--ghost" data-early-cancel>Отмена</button></div></div>`;
  }

  function render() {
    const p = store.patient(id);
    const v = store.visits(id);
    const checkins = KK.util.latestPerDay(store.events(id, 'checkin'));
    const trend = P.moodTrend(checkins);
    const since = v.last ? v.last.scheduledAt : KK.util.shiftDays(new Date().toISOString(), -30);
    const feed = store.events(id).filter((e) => e.at >= since && ['checkin', 'scale', 'ae', 'change', 'sos', 'previsit'].includes(e.type)
      && (e.type !== 'scale' || (e.payload && e.payload.context !== 'intake'))).reverse().slice(0, 20);
    const series = (sid, color) => ({ label: sid === 'phq9' ? 'PHQ-9' : 'GAD-7', color, points: store.events(id, 'scale').filter((e) => e.payload.scaleId === sid).map((e) => ({ at: e.at, v: e.payload.total })) });
    const bands = [{ from: 10, to: 14, color: 'var(--band-warn)' }, { from: 15, to: 27, color: 'var(--band-crit)' }];
    ui.preserveFocus(() => ui.mount('#app', `
      ${P.criticalBanner(p)}
      <a class="hint" href="observe.html">← Наблюдение</a>
      <header class="p-header"><div class="avatar">${ui.esc(p.initials)}</div>
        <div class="grow"><h1>${ui.esc(p.name)}</h1>
          <p class="muted">${ui.age(p.age)} · ${p.sex === 'f' ? 'жен.' : 'муж.'}${p.intake ? ` · <a href="patient.html?id=${ui.esc(id)}">первичный приём психолога</a>` : ''}</p></div></header>
      <div class="grid2" style="margin-top:12px">
        <div class="stack">
          <section class="card stack"><h2>Между визитами к психиатру</h2>
            <p>${ui.esc(P.visitLine(v))}${v.next ? ` <span class="hint">· ${ui.esc(v.next.specialist)}</span>` : ''}</p>
            <p><span class="badge ${trend.code === 'worse' ? 'badge--warn' : trend.code === 'better' ? 'badge--ok' : 'badge--info'}">${ui.esc(trend.label)}</span>
              <span class="hint">последние 7 дней против предыдущих 7</span></p>
            ${earlyBlock(p, v)}
            ${st.saved ? `<p class="hint" role="status">${ui.esc(st.saved)}</p>` : ''}</section>
          <section class="card stack"><h2>Сигналы</h2>
            ${p.signals.length ? p.signals.map((s) => D.signalHtml(s, null)).join('') : '<p class="muted">Сигналов нет.</p>'}</section>
          <section class="card stack"><h2>${v.last ? `С прошлого приёма (${ui.fmtDate(v.last.scheduledAt)})` : 'За 30 дней'}</h2>
            ${feed.map((e) => `<p><span class="hint">${ui.fmtDateTime(e.at)}</span><br>${ui.esc(P.feedText(e))}</p>`).join('') || '<p class="hint">Пациент ничего не отмечал.</p>'}</section>
        </div>
        <div class="stack">
          ${KK.tiles.tileGrid(D.summaryTiles(p, { checkins, aes: store.events(id, 'ae') }), { label: 'Сводка' })}
          <section class="card stack"><h2>PHQ-9 и GAD-7</h2>
            ${ui.scaleChart([series('phq9', 'var(--chart)'), series('gad7', 'var(--chart-2)')], { max: 27, bands, ariaLabel: 'Динамика PHQ-9 и GAD-7' })}</section>
        </div>
      </div>`));
  }

  document.addEventListener('input', (e) => { if (e.target.id === 'early-note') st.note = e.target.value; });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-early]')) { Object.assign(st, { asking: true, error: '', saved: '' }); render(); document.getElementById('early-note').focus(); return; }
    if (e.target.closest('[data-early-cancel]')) { Object.assign(st, { asking: false, error: '' }); render(); return; }
    if (e.target.closest('[data-early-send]')) {
      const note = document.getElementById('early-note').value.trim();
      if (note.length < 5) { st.error = 'Коротко опишите причину — её увидят администратор и психиатр'; render(); document.getElementById('early-note').focus(); return; }
      try {
        store.requestBooking(id, { to: 'psychiatrist', when: 'soon', note, source: 'psychologist', urgent: true, by: store.psychologist().id });
        Object.assign(st, { asking: false, note: '', error: '', saved: 'Заявка отправлена администратору клиники. Пациент получит подтверждение записи в чат-боте.' });
      } catch (err) { st.error = err.message; }
      render();
    }
  });
  store.subscribe(render);
  render();
})();
