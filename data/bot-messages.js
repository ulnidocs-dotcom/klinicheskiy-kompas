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
  ];
})(typeof window !== 'undefined' ? window : globalThis);
