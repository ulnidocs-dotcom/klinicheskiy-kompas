// «Запись» в кабинете психолога: заявки пациентов к психологу и «помогите выбрать» из чат-бота.
(function () {
  const { psychApp: P } = KK;
  P.start({ nav: 'bookings' });
  KK.bookingsUi.mount('#app', { role: 'psychologist', actor: KK.store.psychologist().id });
})();
