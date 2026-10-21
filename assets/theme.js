// Тема оформления «Дневная» / «Ночная». Подключается в <head> каждой страницы: сразу применяет сохранённый выбор
// (без вспышки), даёт переключатель и общий обработчик кликов.
// Выбор хранится отдельно для двух групп ролей: пациент — kk:theme:patient, врач и психолог (data-role="doctor") —
// kk:theme:staff. Без выбора пациент следует системной теме, а врач и психолог получают «Дневную» (позитивная
// полярность для долгого чтения, спек §3); «Ночная» и «Как в системе» доступны переключателем и в профиле.
// Старый общий ключ kk:theme переносится в оба новых при первом запуске.
(function (g) {
  const KK = g.KK = g.KK || {};
  const LEGACY = 'kk:theme';
  const KEYS = { patient: 'kk:theme:patient', staff: 'kk:theme:staff' };
  const doc = g.document;
  const SVG = (p) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    sun: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>'),
    moon: SVG('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  };
  const valid = (v) => v === 'dark' || v === 'light';
  const store = () => { try { return g.localStorage || null; } catch (e) { return null; } };
  const get = (k) => { try { const s = store(); return s ? s.getItem(k) : null; } catch (e) { return null; } };
  const put = (k, v) => { try { const s = store(); if (s) s.setItem(k, v); } catch (e) { /* приватный режим */ } };
  const del = (k) => { try { const s = store(); if (s) s.removeItem(k); } catch (e) { /* приватный режим */ } };
  // Группа ролей страницы: врач, психолог, лаунчер и витрина помечены data-role="doctor".
  const group = () => (doc && doc.documentElement.dataset.role === 'patient' ? 'patient' : 'staff');
  function systemDark() { try { return !!(g.matchMedia && g.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; } }
  // Перенос общего ключа: значение копируется в оба новых (если там пусто), старый ключ удаляется.
  function migrate() {
    const old = get(LEGACY);
    if (old == null) return;
    if (valid(old)) for (const k of Object.values(KEYS)) if (get(k) == null) put(k, old);
    del(LEGACY);
  }
  const read = () => get(KEYS[group()]);

  const theme = {
    KEYS,
    LEGACY,
    group,
    migrate,
    key: () => KEYS[group()],
    // Итоговая тема. saved: 'light' | 'dark' | 'auto' | null. Пациент без выбора — системная; персонал — «Дневная».
    resolve(saved, sysDark, grp = 'patient') {
      if (valid(saved)) return saved;
      if (saved !== 'auto' && grp === 'staff') return 'light';
      return sysDark ? 'dark' : 'light';
    },
    // Выбор пользователя: 'light' | 'dark' | 'auto'. Без выбора: пациент — 'auto', персонал — 'light'.
    pref() {
      const v = read();
      if (valid(v) || v === 'auto') return v;
      return group() === 'staff' ? 'light' : 'auto';
    },
    current() {
      const a = doc && doc.documentElement.dataset.theme;
      return valid(a) ? a : theme.resolve(read(), systemDark(), group());
    },
    // Сохранённый выбор → <html>: явная тема — data-theme; «как в системе» — без атрибута (CSS @media);
    // персонал без выбора — data-theme="light".
    apply() {
      if (!doc) return;
      const root = doc.documentElement;
      const v = read();
      if (valid(v)) root.dataset.theme = v;
      else if (v !== 'auto' && group() === 'staff') root.dataset.theme = 'light';
      else delete root.dataset.theme;
    },
    set(v) {
      if (!doc) return;
      if (valid(v) && KK.host && typeof KK.host.setTheme === 'function') KK.host.setTheme(v);
      else if (valid(v)) put(theme.key(), v);
      else if (group() === 'staff') put(theme.key(), 'auto'); // у персонала «нет выбора» = «Дневная», поэтому «как в системе» хранится явно
      else del(theme.key());
      theme.apply();
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
    migrate();
    theme.apply();
    doc.addEventListener('click', (e) => {
      const b = e.target && e.target.closest && e.target.closest('.theme-toggle');
      if (b) theme.toggle();
    });
    try { g.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => theme.sync()); } catch (e) { /* нет matchMedia */ }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => theme.sync());
    else theme.sync();
  }

  // Адаптивные таблицы: на узком экране строка таблицы становится карточкой, а у каждой ячейки
  // появляется подпись колонки (data-label из заголовка). Страницы перерисовываются через innerHTML,
  // поэтому подписи проставляются и при каждом изменении DOM.
  function labelTables(root) {
    root.querySelectorAll('table.table').forEach((t) => {
      const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      if (!heads.length) return;
      t.classList.add('table--stack');
      t.querySelectorAll('tbody tr').forEach((tr) => {
        [...tr.children].forEach((td, i) => {
          if (td.tagName === 'TD' && !td.hasAttribute('data-label') && heads[i]) td.setAttribute('data-label', heads[i]);
        });
      });
    });
  }
  KK.labelTables = labelTables;
  if (doc && typeof g.MutationObserver === 'function') {
    const start = () => {
      labelTables(doc.body);
      let queued = false;
      new g.MutationObserver(() => {
        if (queued) return;
        queued = true;
        (g.requestAnimationFrame || setTimeout)(() => { queued = false; labelTables(doc.body); });
      }).observe(doc.body, { childList: true, subtree: true });
    };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
