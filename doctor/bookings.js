// «Запись» в кабинете врача: заявки пациентов к психиатру — из чат-бота и от психолога «раньше срока».
(function () {
  const { doctorApp: D } = KK;
  D.start({ nav: 'bookings' });
  KK.bookingsUi.mount('#app', { role: 'doctor', actor: KK.store.doctor().id });
})();
