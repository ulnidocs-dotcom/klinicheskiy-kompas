// Раздел «Запись» в кабинетах врача и психолога: заявки пациентов из чат-бота и заявки психолога «к психиатру раньше».
// Специалист записывает сам (дата, время, специалист) или отказывает с причиной; ответ уходит пациенту в чат-бот.
// Психолог видит заявки к психологу и «помогите выбрать», врач — к психиатру.
(function (g) {
  const KK = g.KK;
  const TO = { psychologist: 'Психолог', psychiatrist: 'Психиатр', unsure: 'Не знает, к кому' };
  const WHEN = { soon: 'как можно скорее', morning: 'утром', evening: 'вечером', any: 'в любое время' };
  const SOURCE = { bot: 'чат-бот', psychologist: 'психолог', app: 'клиника' };
  // Демо: психиатров в штате демо-клиники нет — вымышленные имена.
  const PSYCHIATRISTS = ['Павел Ершов', 'Ирина Котова'];
  const TIMES = Array.from({ length: 21 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
  const dayIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return dayIso(d); };
  const fmtPhone = (p) => (p && /^\+7\d{10}$/.test(p) ? `+7 ${p.slice(2, 5)} ${p.slice(5, 8)}-${p.slice(8, 10)}-${p.slice(10)}` : 'телефон не указан');

  const bookingsUi = {
    // Какие заявки видит роль: психолог — к психологу и «помогите выбрать», врач — к психиатру.
    scope: (role) => (role === 'psychologist' ? ['psychologist', 'unsure'] : ['psychiatrist']),
    newCount: (role) => KK.store.bookings({ status: 'new' }).filter((b) => bookingsUi.scope(role).includes(b.to)).length,
    // role: 'doctor' | 'psychologist'; actor: id специалиста для журнала.
    mount(root, { role, actor }) {
      const { ui, store } = KK;
      const tos = bookingsUi.scope(role);
      const specialists = (to) => (to === 'psychiatrist' ? PSYCHIATRISTS : [store.psychologist().name]);
      const st = { tab: 'new', open: null, mode: null, error: '', flash: '' };

      function form(b) {
        if (st.open !== b.id) return '';
        const err = st.error ? `<p class="err" role="alert">${ui.esc(st.error)}</p>` : '';
        if (st.mode === 'decline') return `<tr class="req-form"><td colspan="5" data-label=""><div class="stack">
            <label class="field"><span class="hint">Причина для пациента — придёт ему в чат</span><textarea id="reason" rows="2" placeholder="Например: нет свободного времени на этой неделе, напишем в понедельник"></textarea></label>
            ${err}<div class="row wrap"><button class="btn btn--primary" data-decline-save="${ui.esc(b.id)}">Отправить ответ</button><button class="btn btn--ghost" data-cancel>Отмена</button></div></div></td></tr>`;
        return `<tr class="req-form"><td colspan="5" data-label=""><div class="row wrap" style="align-items:flex-end;gap:12px">
            <label class="field"><span class="hint">Дата</span><input id="b-date" type="date" min="${tomorrow()}" value="${tomorrow()}"></label>
            <label class="field"><span class="hint">Время</span><select id="b-time">${TIMES.map((t) => `<option ${t === '15:00' ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="field"><span class="hint">Специалист</span><select id="b-who">${specialists(b.to).map((n) => `<option>${ui.esc(n)}</option>`).join('')}</select></label>
            <button class="btn btn--primary" data-schedule-save="${ui.esc(b.id)}">Записать</button><button class="btn btn--ghost" data-cancel>Отмена</button></div>${err}</td></tr>`;
      }
      function row(b) {
        const p = store.patient(b.patientId);
        const status = b.status === 'scheduled' ? `<span class="badge badge--ok">записан</span><br><span class="hint">${ui.esc(ui.fmtDate(b.scheduledAt))}, ${ui.esc(ui.fmtTime(b.scheduledAt))} · ${ui.esc(b.specialist)}</span>`
          : b.status === 'declined' ? `<span class="badge badge--info">отказ</span><br><span class="hint">«${ui.esc(b.declineReason)}»</span>`
            : `<div class="row wrap"><button class="btn btn--primary" data-schedule="${ui.esc(b.id)}">Записать</button><button class="btn btn--ghost" data-decline="${ui.esc(b.id)}">Отказать</button></div>`;
        return `<tr><td><b>${ui.esc(p ? p.name : '—')}</b><br><span class="hint">${ui.esc(fmtPhone(p && p.phone))}</span></td>
          <td>${ui.esc(TO[b.to])}${b.urgent ? '<br><span class="badge badge--warn">раньше срока</span>' : ''}</td>
          <td>${ui.esc(WHEN[b.when])}${b.note ? `<br><span class="hint">«${ui.esc(b.note)}»</span>` : ''}</td>
          <td>${ui.esc(SOURCE[b.source])}<br><span class="hint">${ui.esc(ui.fmtDateTime(b.createdAt))}</span></td>
          <td>${status}</td></tr>${form(b)}`;
      }
      function render() {
        const all = store.bookings().filter((b) => tos.includes(b.to));
        const n = (s) => all.filter((b) => b.status === s).length;
        // Новые: сначала «раньше срока» от психолога, затем по времени поступления.
        const list = all.filter((b) => b.status === st.tab).sort((a, b) => (st.tab === 'new' ? (b.urgent - a.urgent) || a.createdAt.localeCompare(b.createdAt) : 0));
        ui.preserveFocus(() => ui.mount(root, `
          <div class="page-head"><div><h1>Запись</h1>
            <p class="muted">${role === 'psychologist' ? 'Заявки к психологу и «помогите выбрать» из чат-бота пациента.' : 'Заявки к психиатру: из чат-бота пациента и от психолога «раньше срока».'} Ответ придёт пациенту в чат.</p></div></div>
          <div class="seg" role="group" aria-label="Заявки" style="max-width:520px;margin-bottom:16px">
            ${[['new', 'Новые'], ['scheduled', 'Записаны'], ['declined', 'Отказ']].map(([v, l]) => `<button data-tab="${v}" aria-pressed="${st.tab === v}">${l} · ${n(v)}</button>`).join('')}</div>
          ${st.flash ? `<p class="demo-note" role="status">${ui.esc(st.flash)}</p>` : ''}
          <section class="card"><table class="table req-table"><thead><tr><th>Пациент</th><th>К кому</th><th>Когда удобно</th><th>Откуда</th><th></th></tr></thead>
            <tbody>${list.map(row).join('') || `<tr><td colspan="5" class="hint">${st.tab === 'new' ? 'Новых заявок нет' : 'Пока пусто'}</td></tr>`}</tbody></table></section>`));
      }

      document.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]');
        if (t) { Object.assign(st, { tab: t.dataset.tab, open: null, error: '', flash: '' }); render(); return; }
        const s = e.target.closest('[data-schedule]');
        if (s) { Object.assign(st, { open: s.dataset.schedule, mode: 'schedule', error: '', flash: '' }); render(); document.getElementById('b-date').focus(); return; }
        const d = e.target.closest('[data-decline]');
        if (d) { Object.assign(st, { open: d.dataset.decline, mode: 'decline', error: '', flash: '' }); render(); document.getElementById('reason').focus(); return; }
        if (e.target.closest('[data-cancel]')) { Object.assign(st, { open: null, error: '' }); render(); return; }
        const ss = e.target.closest('[data-schedule-save]');
        if (ss) {
          const at = new Date(`${document.getElementById('b-date').value}T${document.getElementById('b-time').value}`);
          try {
            const b = store.scheduleBooking(ss.dataset.scheduleSave, { at: Number.isNaN(+at) ? null : at.toISOString(), specialist: document.getElementById('b-who').value }, actor);
            Object.assign(st, { open: null, error: '', flash: `Записано: ${ui.fmtDate(b.scheduledAt)}, ${ui.fmtTime(b.scheduledAt)}. Пациент получит подтверждение в чат-боте.` });
          } catch (err) { st.error = err.message; }
          render();
          return;
        }
        const ds = e.target.closest('[data-decline-save]');
        if (ds) {
          try {
            store.declineBooking(ds.dataset.declineSave, document.getElementById('reason').value, actor);
            Object.assign(st, { open: null, error: '', flash: 'Ответ отправлен пациенту в чат-бот.' });
          } catch (err) { st.error = err.message; }
          render();
        }
      });
      store.subscribe(render);
      render();
    },
  };
  KK.bookingsUi = bookingsUi;
})(typeof window !== 'undefined' ? window : globalThis);
