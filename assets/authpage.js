// Оболочка страниц входа, приглашения и восстановления: на компьютере — две колонки (о сервисе и форма),
// на телефоне — одна. Демо-плашка честно показывает код или ссылку, которые в настоящей версии придут по SMS или почте.
(function (g) {
  const KK = g.KK;
  const POINTS = ['Данные хранятся на серверах в России', 'Доступ — только у ваших лечащих специалистов', 'Вход с подтверждением по коду'];
  const ui = () => KK.ui;
  KK.authPage = {
    POINTS,
    layout(html) {
      return `<div class="auth"><aside class="auth__aside">
          <a class="auth__brand" href="../index.html">${ui().icon('route', 20)}<b>Компас</b></a>
          <div class="auth__pitch"><h2>Дневник самочувствия и кабинет специалиста</h2>
            <ul>${POINTS.map((p) => `<li>${ui().icon('check', 16)}<span>${ui().esc(p)}</span></li>`).join('')}</ul></div>
          <span class="hint auth__foot">Демо-прототип. Данные вымышлены</span></aside>
        <section class="auth__main"><div class="stack">${html}</div></section></div>`;
    },
    mount(html) { ui().mount('#app', KK.authPage.layout(html)); },
    demoNote: (text) => `<p class="demo-note" role="status"><b>Демо:</b> ${ui().esc(text)}</p>`,
    err: (id = 'err') => `<p class="auth-err" id="${id}" role="alert"></p>`,
    showErr(text, id = 'err') { const el = document.getElementById(id); if (el) el.textContent = text; },
    // Палитра: пациентская — спокойная, для специалистов — щадящая глаза (data-role управляет токенами).
    setRole(role) { document.documentElement.dataset.role = role; if (KK.theme) KK.theme.apply(); },
    staffHome: (s) => (s.role === 'psychologist' ? '../psych/index.html' : '../doctor/index.html'),
    // Enter в поле нажимает основную кнопку формы.
    enterSubmits(selector) {
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !e.target.matches('input')) return;
        const b = document.querySelector(selector);
        if (b) { e.preventDefault(); b.click(); }
      });
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
