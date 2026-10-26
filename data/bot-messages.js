// Сообщения бота MAX в чате (сервер вне демо). Уведомление видно на заблокированном экране:
// без названия препарата, диагноза и баллов. Кнопки: callback (событие message_callback на сервер) и open_app (мини-приложение).
(function (g) {
  g.KK.data.botMessages = [
    { id: 'dose_reminder', when: 'по плану приёма: утро и вечер', text: 'Время принять лекарство по назначению врача.',
      buttons: [{ type: 'callback', text: 'Принял', payload: 'dose_taken' }, { type: 'open_app', text: 'Открыть дневник' }] },
    { id: 'checkin_reminder', when: 'раз в день во время, которое выбрал пациент', text: 'Как вы сегодня? Это займёт минуту.',
      buttons: [{ type: 'open_app', text: 'Отметить' }] },
    { id: 'doctor_reply', when: 'новое сообщение врача', text: 'Врач ответил вам.',
      buttons: [{ type: 'open_app', text: 'Открыть переписку' }] },
    // Ассистент с частыми вопросами (спек 2026-10-22 §C): меню тем по команде /help или любому сообщению в чате бота.
    // Ответ на кнопку темы — список вопросов из KK.data.faq; сам бот не врач, подпись — как в мини-приложении.
    { id: 'topics_menu', when: 'команда /help или сообщение в чате бота', text: 'Ассистент, не врач. Выберите тему или откройте дневник, чтобы написать врачу.',
      buttons: [{ type: 'callback', text: 'Лечение', payload: 'faq_topic:treatment' }, { type: 'callback', text: 'Побочные эффекты', payload: 'faq_topic:side' },
        { type: 'callback', text: 'Как пользоваться', payload: 'faq_topic:howto' }, { type: 'callback', text: 'Связь с врачом', payload: 'faq_topic:contact' },
        { type: 'callback', text: 'Записаться на приём', payload: 'booking:start' }, { type: 'open_app', text: 'Открыть дневник' }] },
    // Запись: бот собирает «к кому» и «когда удобно», заявку получает психолог (к психологу, «помогите выбрать») или врач (к психиатру).
    // Ответ специалиста приходит в чат; на заблокированном экране — без специальности, только дата и время.
    { id: 'booking_confirmed', when: 'специалист записал пациента по заявке', text: 'Запись подтверждена: {дата}, {время}. Специалист: {имя}.',
      buttons: [{ type: 'callback', text: 'Не смогу прийти', payload: 'booking:start' }] },
    { id: 'booking_declined', when: 'специалист не смог записать по заявке', text: 'Не получилось записать вас: «{причина}». Можно оставить новую заявку.',
      buttons: [{ type: 'callback', text: 'Записаться на приём', payload: 'booking:start' }] },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
