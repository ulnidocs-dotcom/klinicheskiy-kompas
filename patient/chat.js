(function () {
  const { ui, store, patientApp: app, assistant: A } = KK;
  const ctx = app.start();
  if (!ctx) return;
  const CHIPS = ['Вопрос о лекарстве', 'Хочу перенести визит', 'Появились побочные эффекты'];
  const T = A.TEXT;
  const TOPICS = KK.data.faq.topics;
  // Черновики хранятся в переменных: переживают перерисовки по стору и очищаются после отправки.
  let draft = '';
  let aDraft = '';
  let topic = null;
  // Режим «Ассистент / Врач» (спек 2026-10-22 §C). Свежий ответ врача — сразу открываем переписку с врачом.
  const lastMsg = store.messages(ctx.pid).filter((m) => m.from !== 'system').at(-1);
  let mode = ui.param('mode') === 'assistant' || ui.param('mode') === 'doctor' ? ui.param('mode')
    : lastMsg && lastMsg.from === 'doctor' ? 'doctor' : 'assistant';

  // Сообщения врачу: отправленные и ждущие в очереди (с меткой ассистента, если вопрос передал он).
  function doctorMessages() {
    const sent = store.messages(ctx.pid).filter((m) => m.from !== 'system');
    const waiting = KK.sync.queued(ctx.pid).filter((q) => q.type === 'message')
      .map((q) => ({ from: 'patient', text: q.payload.text, via: q.payload.via, at: q.queuedAt, pending: true }));
    return sent.concat(waiting);
  }
  // Переписка с ассистентом — события 'assistant' (видны врачу в карточке) и ещё не отправленные из очереди.
  function turns() {
    const sent = store.events(ctx.pid, 'assistant').map((e) => ({ id: e.id, at: e.at, p: e.payload }));
    const waiting = KK.sync.queued(ctx.pid).filter((q) => q.type === 'assistant').map((q) => ({ id: q.clientId, at: q.queuedAt, p: q.payload, pending: true }));
    return sent.concat(waiting);
  }
  // Передан ли вопрос врачу: 'sent' — сообщение у врача, 'pending' — ждёт связи, '' — нет.
  function forwardState(q) {
    if (store.messages(ctx.pid).some((m) => m.via === 'assistant' && m.text === q)) return 'sent';
    if (KK.sync.queued(ctx.pid).some((x) => x.type === 'message' && x.payload.via === 'assistant' && x.payload.text === q)) return 'pending';
    return '';
  }

  const switchHtml = () => `<div class="seg seg--2" role="group" aria-label="С кем переписка">
      <button data-mode="assistant" aria-pressed="${mode === 'assistant'}">Ассистент</button>
      <button data-mode="doctor" aria-pressed="${mode === 'doctor'}">Врач</button></div>`;

  function doctorHtml() {
    const doc = store.doctor();
    const msgs = doctorMessages();
    return `
      <header class="p-head"><h1>Ваш врач</h1><p class="muted">${ui.esc(doc.name)} · ${ui.esc(doc.specialty)}</p>
        <p class="hint">Врач отвечает в рабочее время. В экстренной ситуации звоните 112.</p></header>
      ${switchHtml()}
      <section class="stack chat-log" id="msgs" aria-live="polite">
        ${msgs.length ? msgs.map((m) => `<div class="bubble ${m.from === 'patient' ? 'me' : ''}"><div>${ui.esc(m.text)}</div><div class="t">${m.via === 'assistant' ? 'Передано ассистентом · ' : ''}${m.pending ? 'Ждёт отправки' : ui.fmtDateTime(m.at)}</div></div>`).join('')
          : '<p class="hint">Здесь будет ваша переписка с врачом.</p>'}
      </section>
      <div class="chips" style="margin-top:16px">${CHIPS.map((c) => `<button class="chip" data-chip="${ui.esc(c)}">${ui.esc(c)}</button>`).join('')}</div>
      <form class="compose" id="f"><label class="sr-only" for="t">Сообщение</label>
        <textarea id="t" rows="1" placeholder="Напишите сообщение">${ui.esc(draft)}</textarea>
        <button class="btn btn--primary btn--icon" aria-label="Отправить">${ui.icon('chat', 18)}</button></form>`;
  }

  function botBubble(inner) {
    return `<div class="bubble bot"><div class="who">Ассистент, не врач</div>${inner}</div>`;
  }
  function turnHtml(t) {
    const p = t.p;
    const entry = p.entryId ? A.byId(p.entryId) : null;
    const fw = forwardState(p.q);
    let tail = '';
    if (p.kind === 'crisis') {
      tail = '<a class="btn btn--block" href="help.html?from=assistant">Открыть экран помощи</a>';
    } else if (p.kind === 'treatment_change' || p.kind === 'unknown') {
      if (fw === 'pending') tail = `<p class="t">${ui.esc(T.pending)}</p>`;
      else if (!fw) tail = `<p class="t">Вопрос пока не передан.</p><button class="btn btn--ghost" data-ask="${ui.esc(t.id)}">Спросить врача</button>`;
    } else if (p.kind === 'faq') {
      tail = fw === 'sent' ? `<p class="t">${ui.esc(T.forwarded)}</p>` : fw === 'pending' ? `<p class="t">${ui.esc(T.pending)}</p>`
        : `<button class="btn btn--ghost" data-ask="${ui.esc(t.id)}">${ui.esc(T.notHelped)}</button>`;
    }
    const src = entry ? `<div class="t">Источник: ${ui.esc(entry.source.title)}</div>`
      + (entry.source.materialId ? `<a class="t" href="material.html?id=${encodeURIComponent(entry.source.materialId)}">Открыть материал</a>` : '') : '';
    // Ответ берём из базы по entryId (тексты могли уточниться), иначе — сохранённый текст.
    const reply = p.kind === 'faq' && entry ? entry.a : p.reply;
    return `${p.q ? `<div class="bubble me"><div>${ui.esc(p.q)}</div><div class="t">${t.pending ? 'Ждёт отправки' : ui.fmtDateTime(t.at)}</div></div>` : ''}
      ${botBubble(`<div>${ui.esc(reply)}</div>${src}${tail}`)}`;
  }

  function assistantHtml() {
    const list = turns();
    const qs = topic ? A.topicEntries(topic) : [];
    return `
      <header class="p-head"><h1>Ассистент</h1><p class="muted">${ui.esc(T.label)}</p>
        <p class="hint">Ассистент не ставит диагноз и не меняет лечение. В экстренной ситуации звоните 112.</p></header>
      ${switchHtml()}
      <section class="stack chat-log" id="msgs" aria-live="polite">
        ${botBubble(`<div>${ui.esc(T.hello)}</div>`)}
        ${list.map(turnHtml).join('')}
      </section>
      <div class="chips" style="margin-top:16px" role="group" aria-label="Темы">${TOPICS.map((x) => `<button class="chip" data-topic="${ui.esc(x.id)}" aria-pressed="${topic === x.id}">${ui.esc(x.label)}</button>`).join('')}</div>
      ${qs.length ? `<div class="stack faq-list" role="group" aria-label="Частые вопросы">${qs.map((e) => `<button class="btn btn--block faq-q" data-faq="${ui.esc(e.id)}">${ui.esc(e.q)}</button>`).join('')}</div>` : ''}
      <form class="compose" id="fa"><label class="sr-only" for="ta">Вопрос ассистенту</label>
        <textarea id="ta" rows="1" placeholder="Напишите вопрос своими словами">${ui.esc(aDraft)}</textarea>
        <button class="btn btn--primary btn--icon" aria-label="Спросить">${ui.icon('chat', 18)}</button></form>`;
  }

  function render() {
    ui.preserveFocus(() => ui.mount('#app', mode === 'doctor' ? doctorHtml() : assistantHtml()));
  }

  // Записать реплику ассистента; без связи она встанет в очередь вместе с остальными отметками.
  function record(question, r, extra) {
    try { KK.sync.submit(ctx.pid, 'assistant', A.turn(question, r, extra)); } catch (err) { /* переписка с ассистентом — не критичные данные */ }
  }
  // Передать вопрос врачу сообщением с меткой «передано ассистентом». false — не получилось.
  function forward(text, reason) {
    try {
      const r = KK.sync.submit(ctx.pid, 'message', { text: String(text).slice(0, 2000), via: 'assistant', reason });
      if (r && r.pending) app.toast(app.SYNC_PENDING);
      return true;
    } catch (err) { app.toast('Не получилось передать вопрос. Попробуйте ещё раз'); return false; }
  }
  function ask(text) {
    const r = A.answer(text);
    if (r.kind === 'crisis') {
      // Кризис: никакого FAQ — короткий текст поддержки, критический сигнал врачу и экран помощи с 112.
      record(text, r);
      try { KK.sync.submit(ctx.pid, 'sos', { source: 'assistant' }); } catch (err) { /* без связи: экран помощи предложит сообщить ещё раз */ }
      location.href = 'help.html?from=assistant';
      return;
    }
    if (r.forward) forward(text, r.kind);
    record(text, r);
    topic = null;
    render();
  }

  document.addEventListener('input', (e) => {
    if (e.target.id === 't') draft = e.target.value;
    if (e.target.id === 'ta') aDraft = e.target.value;
  });
  document.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { mode = m.dataset.mode; render(); return; }
    const c = e.target.closest('[data-chip]');
    if (c) { const t = document.getElementById('t'); draft = c.dataset.chip + ': '; t.value = draft; t.focus(); t.setSelectionRange(draft.length, draft.length); return; }
    const tp = e.target.closest('[data-topic]');
    if (tp) { topic = topic === tp.dataset.topic ? null : tp.dataset.topic; render(); return; }
    const f = e.target.closest('[data-faq]');
    if (f) {
      const entry = A.byId(f.dataset.faq);
      if (entry) { record(entry.q, A.answerEntry(entry)); topic = null; render(); }
      return;
    }
    const a = e.target.closest('[data-ask]');
    if (a) {
      const t = turns().find((x) => x.id === a.dataset.ask);
      if (t && !forwardState(t.p.q)) { forward(t.p.q, t.p.kind === 'faq' ? 'not_helped' : t.p.kind); render(); }
    }
  });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'fa') {
      const ta = document.getElementById('ta');
      const text = ta.value.trim();
      if (!text) return;
      aDraft = ''; ta.value = '';
      ask(text.slice(0, 2000));
      return;
    }
    const t = document.getElementById('t');
    const text = t.value.trim();
    if (!text) return;
    draft = ''; t.value = '';
    let r;
    try { r = KK.sync.submit(ctx.pid, 'message', { text: text.slice(0, 2000) }); } catch (err) { draft = text; t.value = text; app.toast('Не получилось отправить. Попробуйте ещё раз'); return; }
    if (r && r.pending) app.toast(app.SYNC_PENDING);
    render();
  });
  store.subscribe(render);
  KK.sync.subscribe(render);
  render();
})();
