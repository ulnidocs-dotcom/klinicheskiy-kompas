(function (g) {
  const KK = g.KK;
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
  };
  const TABS = [
    { id: 'today', href: 'index.html', label: 'Сегодня', icon: 'home' },
    { id: 'path', href: 'path.html', label: 'Мой путь', icon: 'path' },
    { id: 'materials', href: 'materials.html', label: 'Материалы', icon: 'book' },
    { id: 'chat', href: 'chat.html', label: 'Врач', icon: 'chat' },
    { id: 'profile', href: 'profile.html', label: 'Профиль', icon: 'user' },
  ];
  const DEFAULT_PREFS = { scaleEveryDays: 14, reminders: true };

  const app = {
    pid() {
      const fromUrl = KK.ui.param('p');
      if (fromUrl) { if (KK.store.patient(fromUrl)) { try { sessionStorage.setItem('kk:pid', fromUrl); } catch (e) { /* */ } } return fromUrl; }
      try { const s = sessionStorage.getItem('kk:pid'); if (s) return s; } catch (e) { /* */ }
      return KK.store.activePatientId();
    },
    linked: (pid) => LS.get(`kk:linked:${pid}`, false) === true,
    link(pid) { LS.set(`kk:linked:${pid}`, true); },
    prefs: (pid) => Object.assign({}, DEFAULT_PREFS, LS.get(`kk:prefs:${pid}`, {})),
    setPrefs(pid, patch) { LS.set(`kk:prefs:${pid}`, Object.assign(app.prefs(pid), patch)); },

    start({ tab = document.body.dataset.tab, requireLink = true, help = true, back = null } = {}) {
      KK.tg.init();
      const pid = app.pid();
      if (!KK.store.patient(pid)) { location.href = '../index.html'; return null; }
      if (requireLink && !app.linked(pid)) { location.replace(`onboarding.html?p=${pid}`); return null; }
      const shell = document.getElementById('shell');
      const nav = tab ? `<div class="tabbar"><nav aria-label="Разделы">${TABS.map((t) =>
        `<a href="${t.href}" ${t.id === tab ? 'aria-current="page"' : ''}>${KK.ui.icon(t.icon)}<span>${t.label}</span></a>`).join('')}</nav></div>` : '';
      const fab = help ? `<a class="help-fab" href="help.html">${KK.ui.icon('heart', 18)}<span>Мне тяжело</span></a>` : '';
      if (shell) shell.innerHTML = nav + fab;
      if (back) KK.tg.backButton(() => { location.href = back; });
      return { pid, patient: () => KK.store.patient(pid) };
    },

    firstName: (p) => p.name.split(' ')[0],
    practiceOfDay(iso = new Date().toISOString()) {
      const list = KK.data.materials.filter((m) => m.cat === 'practice');
      const key = KK.util.dayKey(iso).replace(/-/g, '');
      return list[Number(key) % list.length];
    },
    dueScales(latest, nowIso, everyDays) {
      return ['gad7', 'phq9'].filter((id) => !latest[id] || KK.util.daysBetween(latest[id].at, nowIso) >= everyDays);
    },
    checkinSummary(checkins) {
      if (checkins.length < 4) return 'Отмечайте самочувствие — через несколько дней здесь появится картина.';
      const half = Math.floor(checkins.length / 2);
      const avg = (a) => a.reduce((s, c) => s + c.payload.mood, 0) / a.length;
      const d = avg(checkins.slice(half)) - avg(checkins.slice(0, half));
      if (d >= 0.5) return 'За последние дни настроение стало заметно ровнее.';
      if (d <= -0.5) return 'Последние дни даются труднее. Врач видит ваши отметки — можно написать ему.';
      return 'Настроение в последние дни примерно одинаковое.';
    },
    doseSlots(events, nowIso) {
      const today = KK.util.dayKey(nowIso);
      const taken = new Set(events.filter((e) => e.type === 'dose' && e.payload.taken && KK.util.dayKey(e.at) === today).map((e) => e.payload.slot));
      return ['утро', 'вечер'].map((slot) => ({ slot, taken: taken.has(slot) }));
    },
    toast(text) {
      let t = document.querySelector('.toast');
      if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
      t.textContent = text; t.classList.add('on');
      clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2400);
    },
  };
  KK.patientApp = app;
})(typeof window !== 'undefined' ? window : globalThis);
