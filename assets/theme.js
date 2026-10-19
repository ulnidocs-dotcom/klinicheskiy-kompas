// Тема оформления «Дневная» / «Ночная» для обеих ролей. Подключается в <head> каждой страницы:
// сразу применяет сохранённый выбор (без вспышки), даёт переключатель и общий обработчик кликов.
// Хранение — через KK.tg.setTheme (ключ kk:theme, общий для врача и пациента); без выбора — prefers-color-scheme.
(function (g) {
  const KK = g.KK = g.KK || {};
  const KEY = 'kk:theme';
  const doc = g.document;
  const SVG = (p) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    sun: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>'),
    moon: SVG('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  };
  const valid = (v) => v === 'dark' || v === 'light';
  function read() { try { return g.localStorage ? g.localStorage.getItem(KEY) : null; } catch (e) { return null; } }
  function systemDark() { try { return !!(g.matchMedia && g.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; } }

  const theme = {
    KEY,
    // Итоговая тема: явный выбор, иначе системная.
    resolve: (saved, sysDark) => (valid(saved) ? saved : sysDark ? 'dark' : 'light'),
    // Выбор пользователя: 'light' | 'dark' | 'auto'.
    pref: () => (valid(read()) ? read() : 'auto'),
    current() {
      const a = doc && doc.documentElement.dataset.theme;
      return valid(a) ? a : theme.resolve(null, systemDark());
    },
    set(v) {
      if (!doc) return;
      const root = doc.documentElement;
      if (!valid(v)) {
        try { g.localStorage.removeItem(KEY); } catch (e) { /* приватный режим */ }
        delete root.dataset.theme;
      } else if (KK.tg && typeof KK.tg.setTheme === 'function') {
        KK.tg.setTheme(v);
      } else {
        root.dataset.theme = v;
        try { g.localStorage.setItem(KEY, v); } catch (e) { /* приватный режим */ }
      }
      theme.sync();
    },
    toggle() { theme.set(theme.current() === 'dark' ? 'light' : 'dark'); },
    toggleHtml(extra = '') {
      const dark = theme.current() === 'dark';
      return `<button type="button" class="theme-toggle ${extra}" aria-label="Ночная тема" aria-pressed="${dark}" title="Дневная / Ночная тема">`
        + `<span class="theme-toggle__moon">${ICON.moon}</span><span class="theme-toggle__sun">${ICON.sun}</span></button>`;
    },
    // Обновить все переключатели на странице и сообщить экранам (профиль перерисует сегмент).
    sync() {
      if (!doc) return;
      const dark = theme.current() === 'dark';
      doc.querySelectorAll('.theme-toggle').forEach((b) => b.setAttribute('aria-pressed', String(dark)));
      doc.querySelectorAll('[data-theme-slot]').forEach((s) => { if (!s.querySelector('.theme-toggle')) s.innerHTML = theme.toggleHtml(); });
      try { doc.dispatchEvent(new g.CustomEvent('kk:themechange', { detail: { theme: theme.current(), pref: theme.pref() } })); } catch (e) { /* старый браузер */ }
    },
  };
  KK.theme = theme;

  if (doc) {
    const saved = read();
    if (valid(saved)) doc.documentElement.dataset.theme = saved;
    doc.addEventListener('click', (e) => {
      const b = e.target && e.target.closest && e.target.closest('.theme-toggle');
      if (b) theme.toggle();
    });
    try { g.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => theme.sync()); } catch (e) { /* нет matchMedia */ }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => theme.sync());
    else theme.sync();
  }
})(typeof window !== 'undefined' ? window : globalThis);
