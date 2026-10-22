(function () {
  const { ui, store, doctorApp: D, data } = KK;
  D.start({ nav: 'patients' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('index.html'); return; }
  const TYPE = { checkin: 'Самочувствие', dose: 'Приём', scale: 'Шкала', ae: 'Нежелательные явления', sos: 'Кнопка «Мне тяжело»',
    intake_form: 'Первичный приём психолога', cto: 'Первичный приём психолога', intake_decision: 'Первичный приём психолога' };
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
      if (data.scales[e.payload.scaleId].audience === 'intake') return `${head}: заполнена (батарея первичного приёма психолога)`;
      const lbl = e.payload.band?.doctorLabel || 'форма заполнена не полностью';
      return e.payload.scaleId === 'cssrs' ? `${head}: ${lbl}` : `${head}: ${e.payload.total} — ${lbl}`;
    }
    if (e.type === 'ae') return e.payload.items.map((i) => `${i.label} (${i.severity === 'severe' ? 'сильно' : i.severity === 'mild' ? 'немного' : i.severity})`).join(', ') + (e.payload.note ? ` · «${e.payload.note}»` : '');
    if (e.type === 'sos') return 'пациент сообщил, что ему очень плохо';
    if (e.type === 'intake_form') return 'пациент заполнил анкету';
    if (e.type === 'cto') return e.payload.skipped ? 'цветовой тест пропущен (по желанию)' : 'цветовой тест отношений выполнен';
    if (e.type === 'intake_decision') return `решение психолога: ${KK.battery ? KK.battery.levelLabel(e.payload.level) : e.payload.level}`;
    return '';
  };
  // Приглашение в дневник (спек 2026-10-22 §A). ?invite=1 — сразу после «Добавить пациента»: панель открыта.
  let inviteOpen = ui.param('invite') === '1';
  let inviteMsg = '';
  const connected = (p) => (p.consents || []).length > 0;
  function ensureInvite(force) {
    const cur = store.patientInvite(id);
    if (!force && cur && cur.state === 'pending') return;
    try { store.createPatientInvite(id, D.me().id); inviteMsg = ''; } catch (err) { inviteMsg = err.message; }
  }
  if (inviteOpen) {
    if (store.patient(id) && !connected(store.patient(id))) ensureInvite(false);
    try { history.replaceState(null, '', `patient.html?id=${encodeURIComponent(id)}`); } catch (e) { /* песочница */ }
  }
  function invitePanel(p) {
    if (!inviteOpen || connected(p)) return '';
    const inv = store.patientInvite(id);
    const pending = inv && inv.state === 'pending';
    const L = pending ? D.inviteLinks(inv.token, location.href) : null;
    const qr = pending ? D.qrSvg(L.site) : '';
    return `<section class="card stack invite-panel" id="invite" aria-label="Приглашение в дневник">
      <div class="row-between"><h2>Приглашение в дневник</h2><button class="btn btn--ghost no-print" data-invite-close>Скрыть</button></div>
      <p class="print-only">Пациент: <b>${ui.esc(p.name)}</b>. Отсканируйте QR-код камерой телефона или откройте ссылку. На сайте или в MAX подтвердите номер телефона кодом из SMS и дайте согласия — после этого отметки самочувствия будет видеть ваш врач.</p>
      <p role="status"><span class="${inv && inv.state !== 'pending' ? 'badge badge--warn' : 'hint'}">${ui.esc(D.inviteStatus(inv) || 'Приглашение ещё не отправлено')}</span></p>
      ${pending ? `<div class="invite-grid">
        <div class="invite-qr">${qr || '<p class="hint">QR-код недоступен: не загрузилась библиотека.</p>'}<span class="hint">QR-код ссылки на сайт</span></div>
        <div class="stack">
          <label class="field"><span class="hint">Ссылка на сайт</span>
            <span class="row"><input class="input grow" id="inv-site" readonly value="${ui.esc(L.site)}"><button class="btn no-print" data-copy="inv-site">Скопировать ссылку</button></span></label>
          <label class="field"><span class="hint">Ссылка для MAX</span>
            <span class="row"><input class="input grow" id="inv-max" readonly value="${ui.esc(L.max)}"><button class="btn no-print" data-copy="inv-max">Скопировать ссылку</button></span></label>
          <label class="field no-print"><span class="hint">Текст SMS</span><textarea id="inv-sms" readonly rows="3">${ui.esc(L.sms)}</textarea></label>
          <p class="demo-note no-print" role="note"><b>Демо: SMS не отправляется.</b> Скопируйте текст или покажите QR-код пациенту.</p>
          <p class="hint">Ссылка одноразовая, действует 3 дня и не содержит персональных данных. Новое приглашение отменяет прежнее.</p>
        </div></div>` : ''}
      <p class="hint no-print" id="inv-msg" role="alert">${ui.esc(inviteMsg)}</p>
      <div class="row wrap no-print">
        ${pending ? '<button class="btn" data-invite-print>Распечатать памятку</button>' : ''}
        <button class="btn ${pending ? 'btn--ghost' : 'btn--primary'}" data-invite-new>Новое приглашение</button>
      </div></section>`;
  }
  function render() {
    const p = store.patient(id);
    const phoneConfirms = store.inbox({ to: store.doctor().id, patientId: id }).filter((m) => m.kind === 'phone_confirm' && store.phoneConfirmState(m.confirmId) === 'pending');
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
    const signalsHtml = `<section class="card stack"><h2>Сигналы</h2>${D.prelimHtml()}
            ${p.signals.length ? p.signals.map((s) => D.signalHtml(s, mode)).join('') : '<p class="muted">Сигналов нет. Состояние стабильно.</p>'}</section>`;
    ui.mount('#app', `
      ${D.patientHeader(p)}
      ${D.patientTabs(id, 'patient')}
      <div class="row wrap" style="margin-bottom:16px">
        ${plan?.status === 'proposed' ? `<a class="btn btn--primary" href="therapy.html?id=${ui.esc(id)}">Рассмотреть назначение ${ui.esc(drug?.name || '')}</a>` : ''}
        ${p.routing && !p.routingConfirmed ? `<a class="btn ${p.routing === 'required' ? 'btn--primary' : ''}" href="routing.html?id=${id}">Оформить направление к психиатру</a>` : ''}
        ${connected(p) ? '' : '<button class="btn btn--primary" data-invite-open>Пригласить в дневник</button>'}
        <a class="btn" href="assess.html?id=${id}">Оценка на приёме</a>
        <a class="btn btn--ghost" href="messages.html?id=${id}">Написать пациенту</a>
        <button class="btn btn--ghost" data-export>Экспорт данных</button>
      </div>
      ${D.inboxHtml(phoneConfirms, { title: 'Подтвердите номер пациента' })}
      ${invitePanel(p)}
      <div class="grid2">
        <div class="stack">
          ${urgent ? signalsHtml : ''}
          ${KK.tiles.tileGrid(D.summaryTiles(p, { checkins, aes: store.events(id, 'ae') }), { label: 'Сводка' })}
          <section class="card stack" id="dynamics"><div class="row-between"><h2>Динамика по шкалам</h2><span class="hint">фон: умеренная (10–14) и выше (≥ 15)</span></div>
            <div class="row wrap">${[['PHQ-9', 'var(--chart)'], ['GAD-7', 'var(--chart-2)']].map(([l, c]) => `<span class="hint"><i class="legend-dot" style="background:${c}"></i>${l}</span>`).join('')}</div>
            ${ui.scaleChart([series('phq9', 'var(--chart)'), series('gad7', 'var(--chart-2)')], { max: 27, bands, ariaLabel: 'Динамика PHQ-9 и GAD-7' })}</section>
          ${urgent ? '' : signalsHtml}
          <section class="card stack"><h2>Лента событий</h2>
            <ul class="feed">${feed.map((e) => `<li><time>${ui.fmtDateTime(e.at)}${ui.esc(D.channelLabel(e))}</time><span><b>${ui.esc(TYPE[e.type] || e.type)}:</b> ${ui.esc(describe(e))}</span></li>`).join('') || '<li><span class="hint">Нет событий</span></li>'}</ul></section>
        </div>
        <div class="stack">
          ${D.inboxHtml(store.inbox({ to: store.doctor().id, patientId: id, unread: true }).filter((m) => m.kind !== 'phone_confirm'), { title: "Новое от психолога" })}
          ${D.intakeCard(p, store.intakeOf(id))}
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
            ${store.audit(id).slice(-5).reverse().map((a) => `<p class="hint">${ui.fmtDateTime(a.at)} · ${ui.esc(D.auditLabel(a))}</p>`).join('') || '<p class="hint">Пока пусто</p>'}</section>
        </div>
      </div>`);
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-inbox-read]'); if (b) store.markInboxRead(b.dataset.inboxRead); });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-invite-open]')) {
      inviteOpen = true; ensureInvite(false); render();
      const el = document.getElementById('invite'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    if (e.target.closest('[data-invite-close]')) { inviteOpen = false; render(); return; }
    if (e.target.closest('[data-invite-new]')) { ensureInvite(true); render(); return; }
    const c = e.target.closest('[data-copy]');
    if (c) {
      const input = document.getElementById(c.dataset.copy);
      const msg = (t) => { const m = document.getElementById('inv-msg'); if (m) m.textContent = t; };
      const manual = () => { input.select(); msg('Ссылка выделена: скопируйте её вручную (Ctrl+C)'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(input.value).then(() => msg('Ссылка скопирована'), manual);
      else manual();
      return;
    }
    if (e.target.closest('[data-invite-print]')) {
      // Печатается только панель приглашения (doctor.css, @media print).
      document.body.classList.add('print-invite');
      const done = () => { document.body.classList.remove('print-invite'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      try { window.print(); } catch (err) { done(); document.getElementById('inv-msg').textContent = 'Печать недоступна в этом окне'; }
    }
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-export]');
    if (!b) return;
    const text = JSON.stringify(KK.bundle.exportBundle(store, id), null, 2);
    // Диалоги в песочнице ссылки-демо заблокированы — сообщаем на самой кнопке.
    if (!KK.host.download(KK.bundle.fileName(id), text)) b.textContent = 'Скачивание недоступно в этом окне';
  });
  store.subscribe(render);
  render();
})();
