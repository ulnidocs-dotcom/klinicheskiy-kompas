// Демо: как выглядит чат-бот «Компаса» в мессенджере (MAX или Telegram) — меню тем, автоматические ответы
// ассистента по проверенной базе, напоминания с кнопками. Кнопки «callback» обрабатывает бот, «open_app» открывает
// мини-приложение. Отметки и вопросы врачу идут через ту же очередь, что и в мини-приложении, с каналом «max-chat».
(function () {
  const { ui, store } = KK;
  const A = KK.assistant;
  const BOT = Object.fromEntries(KK.data.botMessages.map((m) => [m.id, m]));
  const TOPIC_LABEL = { treatment: 'Лечение', side: 'Побочные эффекты', howto: 'Как пользоваться', contact: 'Связь с врачом' };
  const param = ui.param('p');
  const pid = param && store.patient(param) ? param : store.activePatientId();
  const KEY = `kk:botchat:${pid}`;
  const HELLO = 'Здравствуйте. Это бот дневника «Компас»: напоминаю о приёме лекарства и ежедневной отметке, отвечаю на частые вопросы и передаю вопросы врачу. Я не врач. В экстренной ситуации звоните 112.';
  const now = () => new Date().toISOString();
  const uid = () => KK.util.uid('bm');
  // Запись: «к кому» → «когда удобно» → заявка (KK.sync, тип booking). К психологу и «помогите выбрать» записывает психолог, к психиатру — лечащий врач.
  const TO_TEXT = { psychologist: 'к психологу', psychiatrist: 'к психиатру', unsure: 'к специалисту — поможет выбрать психолог' };
  const WHEN_BTN = [['soon', 'Как можно скорее'], ['morning', 'Утром'], ['evening', 'Вечером'], ['any', 'В любое время']];
  const WHEN_TEXT = { soon: 'как можно скорее', morning: 'утром', evening: 'вечером', any: 'в любое время' };
  // «Записать побочку» и «отметить в дневнике» — не запись на приём.
  const BOOKING_INTENT = /записаться|записать(ся)?\s+(меня\s+)?(к|на)\s|запись\s+(к|на)\s|при[её]м\s+к\s|к\s+психологу|к\s+психиатру|перенести\s+(визит|при[её]м)/i;
  const toButtons = () => [{ type: 'callback', text: 'К психологу', bookTo: 'psychologist' }, { type: 'callback', text: 'К психиатру', bookTo: 'psychiatrist' },
    { type: 'callback', text: 'Не знаю — помогите выбрать', bookTo: 'unsure' }];
  const fill = (text, vals) => text.replace(/\{([^}]+)\}/g, (m, k) => (vals[k] != null ? vals[k] : m));

  // Переписка хранится во вкладке: это показ интерфейса бота, а не данные пациента.
  let chat = [];
  try { chat = JSON.parse(sessionStorage.getItem(KEY)) || []; } catch (e) { chat = []; }
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(chat.slice(-80))); } catch (e) { /* приватный режим */ } };
  const botSay = (text, buttons = [], extra = {}) => { chat.push(Object.assign({ id: uid(), from: 'bot', text, buttons, at: now() }, extra)); save(); };
  const userSay = (text) => { chat.push({ id: uid(), from: 'user', text, at: now() }); save(); };

  const topicsMenu = () => BOT.topics_menu.buttons;
  if (!chat.length) {
    userSay('/start');
    botSay(HELLO);
    botSay(BOT.topics_menu.text, topicsMenu());
  }

  // Кнопки бота: callback — действие в чате, open_app — открыть мини-приложение, tel — позвонить.
  const appHref = (b) => (b.app === 'chat' ? `chat.html?p=${encodeURIComponent(pid)}` : b.app === 'help' ? `help.html?p=${encodeURIComponent(pid)}`
    : `index.html?p=${encodeURIComponent(pid)}`);
  function buttonHtml(msgId, b, i) {
    if (b.type === 'tel') return `<a class="bot-btn" href="tel:112">${ui.esc(b.text)}</a>`;
    if (b.type === 'open_app') return `<a class="bot-btn bot-btn--app" href="${appHref(b)}">${ui.icon('home', 14)}${ui.esc(b.text)}</a>`;
    return `<button type="button" class="bot-btn" data-cb="${ui.esc(msgId)}:${i}" ${b.used ? 'aria-pressed="true"' : ''}>${ui.esc(b.text)}</button>`;
  }
  function msgHtml(m) {
    const time = ui.fmtTime(m.at);
    if (m.from === 'user') return `<div class="bot-msg bot-msg--me"><div class="bot-bubble">${ui.esc(m.text)}<span class="bot-time">${time}</span></div></div>`;
    return `<div class="bot-msg">
      <div class="bot-bubble">${ui.esc(m.text)}${m.source ? `<span class="bot-src">Источник: ${ui.esc(m.source)}</span>` : ''}<span class="bot-time">${time}</span></div>
      ${m.buttons && m.buttons.length ? `<div class="bot-kb">${m.buttons.map((b, i) => buttonHtml(m.id, b, i)).join('')}</div>` : ''}</div>`;
  }
  function render() {
    const p = store.patient(pid);
    ui.mount('#app', `<div class="bot-demo">
      <section class="bot-phone" aria-label="Чат с ботом в мессенджере">
        <header class="bot-head"><a class="bot-back" href="../auth/demo.html" aria-label="Назад к демо">${ui.icon('back', 18)}</a>
          <span class="bot-ava" aria-hidden="true">${ui.icon('route', 18)}</span>
          <div><b>Компас</b><span>бот · ассистент, не врач</span></div></header>
        <div class="bot-feed" id="feed" aria-live="polite">${chat.map(msgHtml).join('')}</div>
        <form class="bot-compose" id="f"><label class="sr-only" for="t">Сообщение боту</label>
          <input id="t" autocomplete="off" placeholder="Напишите вопрос своими словами">
          <button class="bot-send" aria-label="Отправить">${ui.icon('chat', 18)}</button></form>
      </section>
      <aside class="bot-side stack">
        <div><p class="kicker">Демо</p><h1>Чат-бот в мессенджере</h1>
          <p class="muted">Так бот «Компаса» выглядит в чате мессенджера (MAX или Telegram). Пациент: ${ui.esc(p ? p.name : '')}.</p></div>
        <div class="card stack"><h2>Прислать от бота</h2>
          <p class="hint">Сообщения, которые бот отправляет сам. Тексты без названия препарата и диагноза — уведомление видно на заблокированном экране.</p>
          <button class="btn btn--block" data-send="dose_reminder">Напоминание о приёме</button>
          <button class="btn btn--block" data-send="checkin_reminder">Напоминание об отметке</button>
          <button class="btn btn--block" data-send="doctor_reply">Врач ответил</button>
          <button class="btn btn--block" data-send="topics_menu">Меню тем</button></div>
        <div class="card stack"><h2>Попробуйте написать</h2>
          <div class="chips">${['Какие побочные эффекты?', 'Можно ли выпить вина?', 'Пропустил приём, что делать?', 'Хочу записаться к психологу', 'Плохо сплю'].map((t) => `<button class="chip" data-try="${ui.esc(t)}">${ui.esc(t)}</button>`).join('')}</div>
          <p class="hint">Бот отвечает только по проверенной базе. Вопросы об изменении лечения, беременности и всё, чего нет в базе, передаёт врачу. Сообщения о кризисе и опасных симптомах — сразу 112 и сигнал врачу. Просьбу записаться бот передаёт психологу или лечащему врачу.</p></div>
        <div class="stack" style="align-items:flex-start;gap:4px"><button class="btn btn--ghost" data-clear>Начать переписку заново</button>
          <a class="btn btn--ghost" href="../doctor/messages.html?id=${encodeURIComponent(pid)}">Что увидит врач</a>
          <a class="btn btn--ghost" href="../psych/bookings.html">Заявки у психолога</a>
          <a class="btn btn--ghost" href="../doctor/bookings.html">Заявки у врача</a></div>
      </aside></div>`);
    const feed = document.getElementById('feed');
    if (feed) feed.scrollTop = feed.scrollHeight;
  }

  // Записать реплику ассистента для карточки врача (как в мини-приложении) — некритичные данные.
  const record = (q, r) => { try { KK.sync.submit(pid, 'assistant', A.turn(q, r), { channel: 'max-chat' }); } catch (e) { /* */ } };
  function forward(text, reason) {
    try { KK.sync.submit(pid, 'message', { text: String(text).slice(0, 2000), via: 'assistant', reason }, { channel: 'max-chat' }); return true; } catch (e) { return false; }
  }
  // Свободный текст: те же правила, что у ассистента в мини-приложении.
  function ask(text) {
    userSay(text);
    const r = A.answer(text);
    if (r.kind === 'crisis') {
      record(text, r);
      let sent = false;
      try { sent = !!KK.sync.submit(pid, 'sos', { source: 'assistant' }, { channel: 'max-chat' }); } catch (e) { sent = false; }
      // В чате экран помощи сам не открывается, поэтому текст свой: 112 и кнопки ниже.
      botSay(`Вы не одни, и хорошо, что вы об этом написали. Если вам опасно сейчас — звоните 112. ${sent ? 'Я отправил врачу сигнал.' : 'Сигнал врачу не отправлен — нет связи.'} Ниже — экран помощи с линиями поддержки.`,
        [{ type: 'tel', text: 'Позвонить 112' }, { type: 'open_app', text: 'Экран помощи', app: 'help' }]);
      return;
    }
    // Просьба записаться — не вопрос о лечении: предлагаем оставить заявку на запись.
    if (r.kind !== 'emergency' && BOOKING_INTENT.test(text)) {
      botSay('Могу передать заявку на запись — специалист подберёт время и подтвердит запись здесь, в чате. К кому вас записать?', toButtons());
      return;
    }
    const sent = r.forward ? forward(text, r.kind) : true;
    const reply = sent ? r.reply : A.unsent(r.reply);
    record(text, Object.assign({}, r, { reply }));
    const buttons = r.kind === 'emergency' ? [{ type: 'tel', text: 'Позвонить 112' }]
      : r.kind === 'faq' ? [{ type: 'callback', text: 'Не помогло — спросить врача', action: 'ask', q: text }, { type: 'callback', text: 'Все темы', action: 'menu' }]
        : [{ type: 'open_app', text: 'Открыть переписку', app: 'chat' }];
    botSay(reply, buttons, r.source ? { source: r.source } : {});
  }
  function slotNow() { return new Date().getHours() < 15 ? 'утро' : 'вечер'; }
  function callback(msg, b) {
    if (b.payload && b.payload.startsWith('faq_topic:')) {
      const topic = b.payload.slice('faq_topic:'.length);
      userSay(b.text);
      const list = A.topicEntries(topic);
      botSay(`Частые вопросы — «${TOPIC_LABEL[topic] || b.text}»:`, list.map((e) => ({ type: 'callback', text: e.q, faq: e.id })).concat({ type: 'callback', text: 'Все темы', action: 'menu' }));
      return;
    }
    if (b.faq) {
      const entry = A.byId(b.faq);
      if (!entry) return;
      userSay(entry.q);
      const r = A.answerEntry(entry);
      record(entry.q, r);
      botSay(r.reply, [{ type: 'callback', text: 'Не помогло — спросить врача', action: 'ask', q: entry.q }, { type: 'callback', text: 'Все темы', action: 'menu' }], { source: r.source });
      return;
    }
    if (b.action === 'menu') { botSay(BOT.topics_menu.text, topicsMenu()); return; }
    if (b.payload === 'booking:start') {
      userSay(b.text);
      botSay('К кому вас записать? Специалист подберёт время и подтвердит запись здесь, в чате.', toButtons());
      return;
    }
    if (b.bookTo) {
      if (msg.done) return; // выбор в этом сообщении уже сделан
      msg.done = true; b.used = true;
      userSay(b.text);
      if (!b.bookWhen) {
        botSay('Когда вам удобно?', WHEN_BTN.map(([when, text]) => ({ type: 'callback', text, bookTo: b.bookTo, bookWhen: when })));
        return;
      }
      let r;
      try { r = KK.sync.submit(pid, 'booking', { to: b.bookTo, when: b.bookWhen, source: 'bot' }, { channel: 'max-chat' }); } catch (e) {
        botSay('Не получилось передать заявку. Попробуйте ещё раз.', [{ type: 'callback', text: 'Записаться на приём', payload: 'booking:start' }]);
        return;
      }
      if (r && r.pending) { botSay('Заявка сохранена и уйдёт, когда появится связь.'); return; }
      botSay(r && r.duplicate
        ? `Заявка ${TO_TEXT[b.bookTo]} уже передана — я добавил ваше пожелание: ${WHEN_TEXT[b.bookWhen]}. Специалист свяжется с вами.`
        : `Передал заявку на запись ${TO_TEXT[b.bookTo]}, ${WHEN_TEXT[b.bookWhen]}. Специалист подберёт время и подтвердит запись здесь, в чате. Если опасно сейчас — звоните 112.`);
      return;
    }
    if (b.action === 'ask') {
      if (b.used) return;
      b.used = true;
      botSay(forward(b.q, 'not_helped') ? 'Передал вопрос врачу, он ответит в рабочее время. Если опасно сейчас — звоните 112.' : 'Не получилось передать вопрос. Попробуйте ещё раз.');
      return;
    }
    if (b.payload === 'dose_taken') {
      if (b.used) return;
      try {
        const r = KK.sync.submit(pid, 'dose', { slot: slotNow(), taken: true }, { channel: 'max-chat' });
        b.used = true;
        botSay(r && r.pending ? 'Отметка сохранена и уйдёт, когда появится связь.' : `Отметил приём (${slotNow()}). Спасибо.`);
      } catch (e) { botSay('Не получилось отметить. Попробуйте ещё раз или отметьте в дневнике.', [{ type: 'open_app', text: 'Открыть дневник' }]); }
    }
  }

  // Ответ специалиста на заявку приходит в чат один раз (store.markBookingNotified).
  function notifyBookings() {
    const fresh = store.bookings({ patientId: pid }).filter((b) => !b.notifiedAt && (b.status === 'scheduled' || b.status === 'declined')).reverse();
    fresh.forEach((b) => {
      const m = b.status === 'scheduled' ? BOT.booking_confirmed : BOT.booking_declined;
      botSay(fill(m.text, { дата: ui.fmtDate(b.scheduledAt || b.handledAt), время: b.scheduledAt ? ui.fmtTime(b.scheduledAt) : '', имя: b.specialist || '', причина: b.declineReason || '' }),
        m.buttons.map((x) => Object.assign({}, x)));
      store.markBookingNotified(b.id);
    });
    return fresh.length > 0;
  }

  document.addEventListener('click', (e) => {
    const cb = e.target.closest('[data-cb]');
    if (cb) {
      const [id, i] = cb.dataset.cb.split(':');
      const msg = chat.find((m) => m.id === id);
      const b = msg && msg.buttons[Number(i)];
      if (b) { callback(msg, b); save(); render(); }
      return;
    }
    const s = e.target.closest('[data-send]');
    if (s) {
      const m = BOT[s.dataset.send];
      // Кнопки open_app ведут в нужный экран мини-приложения: «Врач ответил» — в переписку.
      const buttons = m.buttons.map((b) => Object.assign({}, b, b.type === 'open_app' && s.dataset.send === 'doctor_reply' ? { app: 'chat' } : {}));
      botSay(m.text, buttons);
      render();
      return;
    }
    const t = e.target.closest('[data-try]');
    if (t) { ask(t.dataset.try); render(); return; }
    if (e.target.closest('[data-clear]')) { chat = []; save(); userSay('/start'); botSay(HELLO); botSay(BOT.topics_menu.text, topicsMenu()); render(); }
  });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = document.getElementById('t');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    ask(text.slice(0, 500));
    render();
    document.getElementById('t').focus();
  });
  notifyBookings();
  store.subscribe(() => { if (notifyBookings()) render(); });
  // Администратор мог ответить в другой вкладке.
  window.addEventListener('focus', () => { if (notifyBookings()) render(); });
  render();
})();
