// Адаптер платформы: MAX (window.WebApp), Telegram (window.Telegram.WebApp) или обычный браузер.
// Страницы пациента вызывают только KK.host — различия платформ здесь. Любой сбой API платформы глушится:
// вибрация или системная кнопка «Назад» не должны ломать экран.
(function (g) {
  const KK = g.KK = g.KK || {};
  const LABELS = { max: 'MAX', telegram: 'Telegram', web: 'Сайт', 'max-chat': 'чат MAX' };
  const safe = (fn) => { try { return fn(); } catch (e) { return undefined; } };

  function detect(win) {
    const max = win && win.WebApp;
    if (max && typeof max.initData === 'string' && max.initData) return 'max';
    const tg = win && win.Telegram && win.Telegram.WebApp;
    if (tg && tg.initData !== undefined && tg.platform && tg.platform !== 'unknown') return 'telegram';
    return 'web';
  }

  function createHost(win) {
    const platform = detect(win);
    const api = platform === 'max' ? win.WebApp : platform === 'telegram' ? win.Telegram.WebApp : null;
    const doc = win && win.document;
    const ls = () => safe(() => win.localStorage) || null;
    const themeKey = () => (KK.theme && typeof KK.theme.key === 'function' ? KK.theme.key() : 'kk:theme:patient');
    return {
      platform,
      inside: platform !== 'web',
      label: LABELS[platform],
      LABELS,
      // Тема: явный выбор пациента; в Telegram без выбора — тема клиента. У MAX тема в документации не описана.
      init() {
        if (!doc) return;
        const root = doc.documentElement;
        const saved = safe(() => ls().getItem(themeKey()));
        const explicit = saved === 'light' || saved === 'dark';
        if (explicit) root.dataset.theme = saved;
        if (platform !== 'telegram') return;
        safe(() => { api.ready(); api.expand(); });
        if (!explicit) root.dataset.theme = api.colorScheme === 'dark' ? 'dark' : 'light';
        safe(() => api.onEvent('themeChanged', () => { if (!explicit) root.dataset.theme = api.colorScheme; }));
      },
      setTheme(theme) {
        if (doc) doc.documentElement.dataset.theme = theme;
        safe(() => ls().setItem(themeKey(), theme));
      },
      backButton(onBack) {
        if (!api || !api.BackButton) return;
        safe(() => { api.BackButton.show(); api.BackButton.onClick(onBack); });
      },
      haptic() {
        const h = api && api.HapticFeedback;
        if (!h) return;
        safe(() => (typeof h.selectionChanged === 'function' ? h.selectionChanged() : h.impactOccurred('light')));
      },
      openLink(url) {
        if (api && typeof api.openLink === 'function') { safe(() => api.openLink(url)); return; }
        if (win && typeof win.open === 'function') safe(() => win.open(url, '_blank', 'noopener'));
      },
      startParam() {
        const fromApi = api && safe(() => api.initDataUnsafe && api.initDataUnsafe.start_param);
        if (fromApi) return String(fromApi);
        return safe(() => new URLSearchParams(win.location.search).get('startapp')) || null;
      },
      initData: () => (api && typeof api.initData === 'string' ? api.initData : ''),
      // Подтверждение закрытия мини-приложения на время анкеты. В браузере не включаем: окно «Покинуть сайт?»
      // мешало бы переходу на экран помощи, а ответы и так сохраняются в черновике.
      guardClose(on) {
        if (!api) return;
        safe(() => (on ? api.enableClosingConfirmation() : api.disableClosingConfirmation()));
      },
      // Скачать текстовый файл. false — платформа не умеет (MAX принимает только ссылку с сервера): покажите текст.
      download(name, text) {
        if (platform === 'max' || !doc || typeof win.Blob !== 'function' || !win.URL) return false;
        return safe(() => {
          const url = win.URL.createObjectURL(new win.Blob([text], { type: 'application/json' }));
          const a = doc.createElement('a');
          a.href = url; a.download = name;
          doc.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => win.URL.revokeObjectURL(url), 1000);
          return true;
        }) === true;
      },
    };
  }

  KK.hostDetect = detect;
  KK.createHost = createHost;
  KK.host = createHost(typeof window !== 'undefined' ? window : null);
})(typeof window !== 'undefined' ? window : globalThis);
