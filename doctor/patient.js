(function () {
  const { ui, store, doctorApp: D, data } = KK;
  D.start({ nav: 'patients' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('index.html'); return; }
  const TYPE = { checkin: 'Самочувствие', dose: 'Приём', scale: 'Шкала', ae: 'Нежелательные явления', sos: 'Кнопка «Мне тяжело»' };
  const describe = (e) => {
    if (e.type === 'checkin') {
      const sameDay = store.events(id, 'checkin').filter((x) => KK.util.dayKey(x.at) === KK.util.dayKey(e.at)).length;
      const late = e.recordedAt && KK.util.dayKey(e.recordedAt) !== KK.util.dayKey(e.at);
      return `настроение ${e.payload.mood}/5, беспокойство ${e.payload.anxiety}/5, сон ${e.payload.sleep}/5`
        + (sameDay > 1 ? ' · пациент изменил отметку' : '') + (late ? ` · внесено ${ui.fmtDate(e.recordedAt)}` : '');
    }
    if (e.type === 'dose') return `${data.drugs.aviandr.name}, ${e.payload.slot}`;
    if (e.type === 'scale') {
      const head = data.scales[e.payload.scaleId].title.split(' —')[0];
      const lbl = e.payload.band?.doctorLabel || 'форма заполнена не полностью';
      return e.payload.scaleId === 'cssrs' ? `${head}: ${lbl}` : `${head}: ${e.payload.total} — ${lbl}`;
    }
    if (e.type === 'ae') return e.payload.items.map((i) => `${i.label} (${i.severity === 'severe' ? 'сильно' : i.severity === 'mild' ? 'немного' : i.severity})`).join(', ') + (e.payload.note ? ` · «${e.payload.note}»` : '');
    if (e.type === 'sos') return 'пациент сообщил, что ему очень плохо';
    return '';
  };
  function render() {
    const p = store.patient(id);
    const mode = D.mode();
    const series = (sid, color) => ({ label: sid === 'phq9' ? 'PHQ-9' : 'GAD-7', color, points: store.events(id, 'scale').filter((e) => e.payload.scaleId === sid).map((e) => ({ at: e.at, v: e.payload.total })) });
    const bands = [{ from: 10, to: 14, color: 'var(--band-warn)' }, { from: 15, to: 27, color: 'var(--band-crit)' }];
    // Пациент может изменить отметку самочувствия (за сегодня или до 7 дней назад): в ленте и сводке — последняя за день.
    const checkins = KK.util.latestPerDay(store.events(id, 'checkin'));
    const keep = new Set(checkins.map((e) => e.id));
    const feed = [...store.events(id)].filter((e) => e.type !== 'dose' && (e.type !== 'checkin' || keep.has(e.id))).reverse().slice(0, 12);
    const aes = store.events(id, 'ae').slice(-5).reverse();
    const plan = p.plan;
    const drug = data.drugs[plan?.drugId];
    // Срочные сигналы — первыми, до сводки; спокойные — после графика, чтобы динамика оставалась на первом экране.
    const urgent = p.signals.some((s) => s.level === 'critical' || s.level === 'important' || s.routing === 'required');
    const signalsHtml = `<section class="card stack"><h2>Сигналы</h2>
            ${p.signals.length ? p.signals.map((s) => D.signalHtml(s, mode)).join('') : '<p class="muted">Сигналов нет. Состояние стабильно.</p>'}</section>`;
    ui.mount('#app', `
      ${D.patientHeader(p)}
      ${D.patientTabs(id, 'patient')}
      <div class="row wrap" style="margin-bottom:16px">
        ${plan?.status === 'proposed' ? `<a class="btn btn--primary" href="therapy.html?id=${ui.esc(id)}">Рассмотреть назначение ${ui.esc(drug?.name || '')}</a>` : ''}
        ${p.routing && !p.routingConfirmed ? `<a class="btn ${p.routing === 'required' ? 'btn--primary' : ''}" href="routing.html?id=${id}">Оформить направление к психиатру</a>` : ''}
        <a class="btn" href="assess.html?id=${id}">Оценка на приёме</a>
        <a class="btn btn--ghost" href="messages.html?id=${id}">Написать пациенту</a>
      </div>
      <div class="grid2">
        <div class="stack">
          ${urgent ? signalsHtml : ''}
          ${KK.tiles.tileGrid(D.summaryTiles(p, { checkins, aes: store.events(id, 'ae') }), { label: 'Сводка' })}
          <section class="card stack" id="dynamics"><div class="row-between"><h2>Динамика по шкалам</h2><span class="hint">фон: умеренная (10–14) и выше (≥ 15)</span></div>
            <div class="row wrap">${[['PHQ-9', 'var(--chart)'], ['GAD-7', 'var(--chart-2)']].map(([l, c]) => `<span class="hint"><i class="legend-dot" style="background:${c}"></i>${l}</span>`).join('')}</div>
            ${ui.scaleChart([series('phq9', 'var(--chart)'), series('gad7', 'var(--chart-2)')], { max: 27, bands, ariaLabel: 'Динамика PHQ-9 и GAD-7' })}</section>
          ${urgent ? '' : signalsHtml}
          <section class="card stack"><h2>Лента событий</h2>
            <ul class="feed">${feed.map((e) => `<li><time>${ui.fmtDateTime(e.at)}</time><span><b>${ui.esc(TYPE[e.type] || e.type)}:</b> ${ui.esc(describe(e))}</span></li>`).join('') || '<li><span class="hint">Нет событий</span></li>'}</ul></section>
        </div>
        <div class="stack">
          <section class="card stack"><h2>Терапия</h2>
            <dl class="kv">
              <dt>План</dt><dd>${drug ? `${ui.esc(drug.name)} ${ui.esc(drug.dosing.dose)} × ${drug.dosing.timesPerDay}/сут` : '—'}</dd>
              <dt>Статус</dt><dd>${plan?.status === 'confirmed' ? `назначен ${ui.fmtDate(plan.confirmedAt)}` : plan?.status === 'proposed' ? 'предложен, ожидает решения врача' : plan?.status === 'cancelled' ? 'отменён' : '—'}${plan?.offLabel ? ' · <span class="badge badge--warn">вне инструкции</span>' : ''}</dd>
              <dt>Приверженность</dt><dd>${p.pdc14 == null ? '—' : `${Math.round(p.pdc14 * 100)}% доз за 14 дн.`}${p.missedStreak ? ` · без приёма ${p.missedStreak} ${ui.plural(p.missedStreak, ['день', 'дня', 'дней'])}` : ''}</dd>
              <dt>Проверка</dt><dd>${p.therapy?.eligible === true ? '<span class="badge badge--ok">Противопоказаний нет</span>' : p.therapy?.eligible === false ? '<span class="badge badge--contra">Есть противопоказание</span>' : '<span class="badge badge--warn">Недостаточно данных</span>'}</dd>
            </dl><a href="therapy.html?id=${id}">Подробнее о терапии</a></section>
          <section class="card stack"><h2>Нежелательные явления</h2>
            ${aes.length ? `<ul class="feed">${aes.map((e) => `<li><time>${ui.fmtDate(e.at)}</time><span>${ui.esc(describe(e))}</span></li>`).join('')}</ul>` : '<p class="hint">Пациент не сообщал</p>'}</section>
          <section class="card stack"><h2>Журнал действий</h2>
            ${store.audit(id).slice(-5).reverse().map((a) => `<p class="hint">${ui.fmtDateTime(a.at)} · ${ui.esc(a.action)}</p>`).join('') || '<p class="hint">Пока пусто</p>'}</section>
        </div>
      </div>`);
  }
  store.subscribe(render);
  render();
})();
