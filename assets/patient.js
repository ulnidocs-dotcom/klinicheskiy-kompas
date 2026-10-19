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
        `<a href="${t.href}" ${t.id === tab ? 'aria-current="page"' : ''}>${KK.ui.icon(t.icon)}<span>${t.label}</span></a>`).join('')}${help ? `<a class="tab-help" href="help.html">${KK.ui.icon('heart')}<span>Помощь</span></a>` : ''}</nav></div>` : '';
      // Верхняя панель (липкая, в потоке — не перекрывает текст): справа переключатель темы;
      // на экранах без таб-бара рядом с ним — кнопка помощи.
      const fab = help && !tab ? `<a class="help-fab" href="help.html">${KK.ui.icon('heart', 16)}<span>Мне тяжело</span></a>` : '';
      const top = document.createElement('div');
      top.className = 'p-top';
      top.innerHTML = `<span class="brand" aria-hidden="true">Компас</span><div class="tools">${fab}${KK.theme ? KK.theme.toggleHtml() : ''}</div>`;
      const main = document.getElementById('app');
      if (main && main.parentNode) main.parentNode.insertBefore(top, main);
      if (shell) shell.innerHTML = nav;
      if (back) KK.tg.backButton(() => { location.href = back; });
      return { pid, patient: () => KK.store.patient(pid) };
    },

    // Опросник, доступный пациенту: только собственные ключи KK.data.scales (без __proto__ и т.п.) и не «врачебные».
    patientScale(id) {
      if (typeof id !== 'string' || !Object.hasOwn(KK.data.scales, id)) return null;
      const d = KK.data.scales[id];
      return d.audience === 'doctor' ? null : d;
    },
    nextScales: (param) => String(param || '').split(',').filter((x) => !!app.patientScale(x)),
    // «Врач уведомлён» после PHQ-9 — только если по п. 9 действительно открыт алерт врачу.
    phqAlertOpen: (alerts) => alerts.some((a) => a.ruleId === 'si_phq9' && !a.ackAt),
    // История опросников для пациента: без C-SSRS и без неполных форм; текст — из сохранённой интерпретации.
    scaleHistory(events, n = 6) {
      return events.filter((e) => e.type === 'scale' && e.payload.scaleId !== 'cssrs' && e.payload.complete)
        .slice(-n).reverse()
        .map((e) => ({ at: e.at, scaleId: e.payload.scaleId, label: e.payload.band?.patientText || 'Ответы получены врачом.' }));
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
    // Ориентировочное время приёма для подписи слота (данные не меняются: слоты по-прежнему «утро»/«вечер»).
    SLOT_TIME: { 'утро': '09:00', 'вечер': '21:00' },
    slotHtml(s) {
      return `<button class="slot" data-dose="${s.slot}" aria-pressed="${s.taken}"><span class="num num--m">${app.SLOT_TIME[s.slot] || ''}</span>`
        + `<span class="slot__l">${s.taken ? KK.ui.icon('check', 16) : ''}${s.slot === 'утро' ? 'Утро' : 'Вечер'}${s.taken ? ' · принято' : ''}</span></button>`;
    },
    // Неделя Пн–Вс вокруг даты: [{ iso, label, today, mark }] — для круглых чипов дней.
    week(nowIso, markedKeys = new Set()) {
      const d = new Date(nowIso);
      const shift = (d.getDay() + 6) % 7;
      const L = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      return L.map((label, k) => {
        const iso = KK.util.shiftDays(nowIso, k - shift);
        const key = KK.util.dayKey(iso);
        return { iso, label, today: k === shift, mark: markedKeys.has(key) };
      });
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
