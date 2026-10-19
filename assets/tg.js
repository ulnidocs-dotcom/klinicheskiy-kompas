(function (g) {
  const KK = g.KK;
  const tg = g.Telegram && g.Telegram.WebApp;
  KK.tg = {
    inside: !!(tg && tg.initData !== undefined && tg.platform && tg.platform !== 'unknown'),
    init() {
      const root = document.documentElement;
      let saved = null;
      try { saved = localStorage.getItem('kk:theme'); } catch (e) { saved = null; }
      if (saved) root.dataset.theme = saved;
      else if (this.inside) root.dataset.theme = tg.colorScheme === 'dark' ? 'dark' : 'light';
      if (this.inside) {
        tg.ready(); tg.expand();
        tg.onEvent('themeChanged', () => { if (!saved) root.dataset.theme = tg.colorScheme; });
      }
    },
    setTheme(theme) {
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('kk:theme', theme); } catch (e) { /* приватный режим */ }
    },
    backButton(onBack) {
      if (!this.inside) return;
      tg.BackButton.show(); tg.BackButton.onClick(onBack);
    },
    mainButton(text, onClick) {
      if (!this.inside) return false;
      tg.MainButton.setText(text); tg.MainButton.show(); tg.MainButton.onClick(onClick);
      return true;
    },
    haptic(kind) { if (this.inside && tg.HapticFeedback) tg.HapticFeedback.selectionChanged(kind); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
