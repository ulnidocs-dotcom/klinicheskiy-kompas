// Боковая панель кабинета администратора клиники: «Сотрудники» и «Заявки на запись» (счётчик новых).
(function (g) {
  const KK = g.KK;
  KK.adminApp = {
    me: () => KK.auth.staff('admin') || KK.store.staff().find((s) => s.role === 'admin' && s.status === 'active'),
    side(nav) {
      const { ui, store, auth } = KK;
      const m = KK.adminApp.me();
      const fresh = store.bookings({ status: 'new' }).length;
      const link = (id, href, icon, label, count) => `<a href="${href}" ${id === nav ? 'aria-current="page"' : ''}>${ui.icon(icon, 18)}<span>${label}</span>${count ? `<span class="count">${count}</span>` : ''}</a>`;
      ui.mount('#side', `
        <div class="d-brand">${ui.icon('route', 20)}<b>Компас</b><span class="dotrow" aria-hidden="true">· · ·· ····</span></div>
        ${link('staff', 'index.html', 'users', 'Сотрудники')}
        ${link('requests', 'requests.html', 'bell', 'Заявки на запись', fresh)}
        <div class="d-me"><div class="d-me__who"><b>${ui.esc(m.name)}</b><span class="hint">администратор · ${ui.esc(store.clinicInfo().name)}</span>
          ${auth.session && auth.session.get() ? '<a class="hint" href="../auth/login.html?as=staff" data-logout>Выйти</a>' : ''}</div>
          ${KK.theme ? KK.theme.toggleHtml() : ''}</div>`);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
