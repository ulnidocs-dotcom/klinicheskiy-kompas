(function (g) {
  const KK = g.KK;
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) { /* приватный режим */ } },
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
    // forced — пациент, которого определила страница (токен приглашения); запоминается для вкладки, как ?p=.
    pid(forced) {
      if (forced && KK.store.patient(forced)) { try { sessionStorage.setItem('kk:pid', forced); } catch (e) { /* */ } return forced; }
      const fromUrl = KK.ui.param('p');
      if (fromUrl) { if (KK.store.patient(fromUrl)) { try { sessionStorage.setItem('kk:pid', fromUrl); } catch (e) { /* */ } } return fromUrl; }
      try { const s = sessionStorage.getItem('kk:pid'); if (s) return s; } catch (e) { /* */ }
      return KK.store.activePatientId();
    },
    linked: (pid) => LS.get(`kk:linked:${pid}`, false) === true,
    link(pid) {
      LS.set(`kk:linked:${pid}`, true);
      try { KK.store.linkChannel(pid, KK.host.platform); } catch (e) { /* канал уже есть или стор недоступен */ }
    },
    // Отключить канал. Если это канал этого устройства — гасим и флаг демо, иначе start() подключит его заново.
    unlink(pid, channel) {
      const done = KK.store.unlinkChannel(pid, channel);
      if (done && channel === KK.host.platform) LS.remove(`kk:linked:${pid}`);
      return done;
    },
    // Дни с отметкой самочувствия: записанные и ещё не отправленные.
    markedDays(events, queued = []) {
      const keys = KK.util.latestPerDay(events.filter((e) => e.type === 'checkin')).map((e) => KK.util.dayKey(e.at));
      queued.filter((q) => q.type === 'checkin').forEach((q) => keys.push(KK.util.dayKey((q.opts && q.opts.at) || q.queuedAt)));
      return new Set(keys);
    },
    // Ссылка врача в MAX: max.ru/<бот>?startapp=inv_KMP-7302 → код приглашения KMP-7302 (в демо код = токен).
    inviteFromStart: (sp) => { const m = /^inv_([A-Za-z]{3}-\d{4})$/.exec(sp || ''); return m ? m[1].toUpperCase() : null; },
    // Одноразовое приглашение врача (спек 2026-10-22 §A): сайт ?invite=<токен> или MAX startapp=inv_<токен>, токен — 24 [A-Za-z0-9].
    inviteToken(param, sp) {
      if (typeof param === 'string' && /^[A-Za-z0-9]{24}$/.test(param)) return param;
      const m = /^inv_([A-Za-z0-9]{24})$/.exec(sp || '');
      return m ? m[1] : null;
    },
    MOVE_COPY: [
      'Открыть дневник на сайте',
      'Откройте на компьютере адрес ниже и введите код. Код действует 10 минут и подходит один раз.',
      'История отметок останется прежней.',
      'У меня есть код из приложения',
      'Введите шесть цифр, которые показаны в приложении в разделе «Профиль».',
    ],
    prefs: (pid) => Object.assign({}, DEFAULT_PREFS, LS.get(`kk:prefs:${pid}`, {})),
    setPrefs(pid, patch) { LS.set(`kk:prefs:${pid}`, Object.assign(app.prefs(pid), patch)); },

    // pid — пациент, заданный страницей (регистрация по приглашению: пациента определяет токен, а не ?p=).
    start({ tab = document.body.dataset.tab, requireLink = true, help = true, back = null, pid: forced = null } = {}) {
      KK.host.init();
      KK.host.guardClose(false); // каждая страница начинает без подтверждения закрытия; анкеты включают его сами
      const pid = app.pid(forced);
      if (!KK.store.patient(pid)) { location.href = '../index.html'; return null; }
      if (requireLink && !app.linked(pid)) { location.replace(`onboarding.html?p=${pid}`); return null; }
      if (app.linked(pid) && KK.store.channels(pid).length === 0) { try { KK.store.linkChannel(pid, KK.host.platform); } catch (e) { /* */ } }
      const shell = document.getElementById('shell');
      const nav = tab ? `<div class="tabbar"><nav aria-label="Разделы">${TABS.map((t) =>
        `<a href="${t.href}" ${t.id === tab ? 'aria-current="page"' : ''}>${KK.ui.icon(t.icon)}<span>${t.label}</span></a>`).join('')}${help ? `<a class="tab-help" href="help.html">${KK.ui.icon('heart')}<span>Помощь</span></a>` : ''}</nav></div>` : '';
      // Верхняя панель (липкая, в потоке — не перекрывает текст): справа переключатель темы;
      // на экранах без таб-бара рядом с ним — кнопка помощи.
      const fab = help && !tab ? `<a class="help-fab" href="help.html">${KK.ui.icon('heart', 16)}<span>Мне тяжело</span></a>` : '';
      const top = document.createElement('div');
      top.className = 'p-top';
      top.innerHTML = `<span class="brand" aria-hidden="true">Компас</span><span class="sync-note" role="status" hidden></span><div class="tools">${fab}${KK.theme ? KK.theme.toggleHtml() : ''}</div>`;
      const main = document.getElementById('app');
      if (main && main.parentNode) main.parentNode.insertBefore(top, main);
      if (shell) shell.innerHTML = nav;
      if (back) KK.host.backButton(() => { location.href = back; });
      if (KK.sync) { KK.sync.subscribe(() => {
          app.syncNote(pid);
          if (KK.sync.rejected(pid).length) { KK.sync.clearRejected(pid); app.toast('Одна из отметок не сохранилась. Попробуйте отметить ещё раз'); }
        }); KK.sync.flush(); app.syncNote(pid); }
      return { pid, patient: () => KK.store.patient(pid) };
    },

    SYNC_PENDING: 'Сохранено на телефоне, отправится при появлении связи',
    syncNote(pid) {
      const el = document.querySelector('.sync-note');
      if (!el || !KK.sync) return;
      const n = KK.sync.pending(pid);
      el.hidden = n === 0;
      el.textContent = n ? app.SYNC_PENDING : '';
    },

    // Опросник, доступный пациенту: только собственные ключи KK.data.scales (без __proto__ и т.п.) и без audience
    // («врачебные» и шкалы первичного приёма психолога проходят только через свои экраны).
    patientScale(id) {
      if (typeof id !== 'string' || !Object.hasOwn(KK.data.scales, id)) return null;
      const d = KK.data.scales[id];
      return d.audience ? null : d;
    },
    // Черновик первичной беседы на устройстве (переживает закрытие вкладки; сбрасывается при завершении и сбросе демо).
    intakeDraftKey: (pid) => `kk:intake-draft:${pid}`,
    // Плитка «Первичная беседа с психологом» — пока приём назначен и пациент его не завершил.
    intakeDue: (p) => !!(p && p.intake && (p.intakeStatus === 'assigned' || p.intakeStatus === 'in_progress')),
    // Следующий шаг батареи по уже сохранённым частям (store.intakeOf): intro → form → cssrs → tipi10 → dass21 → cto → done.
    intakeNextStep(it) {
      if (!it) return null;
      if (it.status === 'completed' || it.status === 'decided') return 'done';
      if (!it.form && !it.cssrs && !it.tipi && !it.dass && !it.cto) return 'intro';
      if (!it.form) return 'form';
      if (!it.cssrs) return 'cssrs';
      if (!it.tipi) return 'tipi10';
      if (!it.dass) return 'dass21';
      return 'cto';
    },
    // Видимые вопросы C-SSRS при самоотчёте: 3–5 — только после «да» на вопрос 2 (как у врача).
    cssrsShown: (answers) => [0, 1, 2, 3, 4, 5].filter((i) => i < 2 || i === 5 || answers[1] === 1),
    // Тексты экранов первичной беседы (проверяются тестом: без баллов, слов тяжести и «!»).
    INTAKE_COPY: [
      'Первичная беседа с психологом',
      'Около 20 минут. Можно сделать перерыв и вернуться — ответы сохранятся.',
      'Ответы увидят ваш психолог и лечащий врач. Это не экстренная служба: если сейчас очень плохо, нажмите «Мне тяжело».',
      'Цвета и отношения',
      'Это задание по желанию. Для каждого слова выберите цвета по порядку: сначала тот, что подходит больше всего.',
      'Теперь расположите цвета по тому, насколько они вам приятны прямо сейчас.',
      'Ответы переданы психологу',
      'Спасибо. Психолог посмотрит ответы перед встречей и обсудит их с вами.',
      'Продолжить беседу',
    ],
    nextScales: (param) => String(param || '').split(',').filter((x) => !!app.patientScale(x)),
    // «Врач уведомлён» после PHQ-9 — только если по п. 9 действительно открыт алерт врачу.
    phqAlertOpen: (alerts) => alerts.some((a) => a.ruleId === 'si_phq9' && !a.ackAt),
    // История опросников для пациента: без C-SSRS и без неполных форм; текст — из сохранённой интерпретации.
    scaleHistory(events, n = 6) {
      return events.filter((e) => e.type === 'scale' && e.payload.complete && !!app.patientScale(e.payload.scaleId))
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
    // Тренд одним словом — тем же способом, что checkinSummary: среднее второй половины минус первой (порог 0,5).
    // key: 'mood' | 'sleep'. Меньше 4 отметок — null (картины ещё нет).
    trendWord(checkins, key = 'mood') {
      const xs = checkins.map((c) => c.payload[key]).filter((v) => typeof v === 'number');
      if (xs.length < 4) return null;
      const half = Math.floor(xs.length / 2);
      const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
      const d = avg(xs.slice(half)) - avg(xs.slice(0, half));
      const words = key === 'sleep' ? ['ровнее', 'как обычно', 'хуже'] : ['ровнее', 'как обычно', 'труднее'];
      return d >= 0.5 ? words[0] : d <= -0.5 ? words[2] : words[1];
    },
    // Плитки «Мой путь» (ауры как на «Сегодня»: настроение и сон — в гамме своих шкал чек-ина, лекарство — роза, практика — кобальт): без клинических баллов и слов тяжести, без красного; только то, что есть в данных.
    pathTiles({ confirmed, takenDays, checkins, practice, periodLabel }) {
      const T = KK.tiles;
      const mood = app.trendWord(checkins, 'mood'), sleep = app.trendWord(checkins, 'sleep');
      const few = 'нужно ещё несколько отметок';
      const n = checkins.length;
      return [
        confirmed
          ? { wide: true, aura: 'teal', label: 'Дни с приёмом', value: takenDays, unit: 'из 14', note: 'последние 2 недели',
            visual: T.ringGauge({ value: takenDays, max: 14, label: 'Дни с приёмом' }) }
          : { wide: true, aura: 'teal', label: 'Лечение', value: 'Врач обсуждает план' },
        { aura: 'mood', label: 'Настроение', value: mood, note: mood ? periodLabel : few,
          visual: T.dotRow(checkins.map((c) => c.payload.mood), { max: 5 }) },
        { aura: 'sleep', label: 'Сон', value: sleep, note: sleep ? periodLabel : few,
          visual: T.dotRow(checkins.map((c) => c.payload.sleep), { max: 5 }) },
        practice && { aura: 'lavender', label: 'Практика дня', value: practice.title, note: `${practice.minutes} мин`, href: `material.html?id=${practice.id}` },
        { aura: 'sage', label: 'Отметок самочувствия', value: n, unit: 'дн.', note: periodLabel },
      ];
    },
    // Время приёма врач не назначал — показываем только часть дня, без точных часов.
    slotHtml(s) {
      return `<button class="slot" data-dose="${s.slot}" aria-pressed="${s.taken}">${KK.ui.icon(s.slot === 'утро' ? 'sun' : 'moon', 22)}`
        + `<span class="slot__l">${s.taken ? KK.ui.icon('check', 16) : ''}${s.slot === 'утро' ? 'Утро' : 'Вечер'}${s.taken ? ' · принято' : ''}</span>`
        + `${s.taken ? '<span class="sr-only">. Нажмите, если отметили по ошибке</span>' : ''}</button>`;
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
    // Вопросы чек-ина. tone — гамма шкалы (токены --mood-*, --anx-*, --sleep-* и аура того же имени).
    CHECKIN_Q: [
      { key: 'mood', tone: 'mood', name: 'Настроение', title: 'Какое сегодня настроение?', past: 'Какое было настроение?',
        labels: ['Очень тяжело', 'Тяжело', 'Так себе', 'Неплохо', 'Хорошо'], ends: ['тяжело', 'хорошо'] },
      { key: 'anxiety', tone: 'anx', name: 'Беспокойство', title: 'Сколько сегодня беспокойства?', past: 'Сколько было беспокойства?',
        labels: ['Почти нет', 'Немного', 'Заметно', 'Много', 'Очень много'], ends: ['почти нет', 'очень много'] },
      { key: 'sleep', tone: 'sleep', name: 'Сон', title: 'Как вы спали?', past: 'Как вы спали в ту ночь?',
        labels: ['Очень плохо', 'Плохо', 'Средне', 'Неплохо', 'Хорошо'], ends: ['плохо', 'хорошо'] },
    ],
    // Значение 1..5 словами (для aria-valuetext и сводки); вне диапазона — «не выбрано».
    checkinWord(key, v) {
      const q = app.CHECKIN_Q.find((x) => x.key === key);
      return q && Number.isInteger(v) && v >= 1 && v <= 5 ? q.labels[v - 1] : 'не выбрано';
    },
    // Сколько дней назад можно отметить самочувствие (тот же предел проверяет store.addEvent).
    BACKDATE_DAYS: 7,
    // Последние n дней (сегодня — справа): [{ key, iso, label, today, mark }] — чипы выбора дня на «Сегодня».
    recentDays(nowIso, markedKeys = new Set(), n = 7) {
      const L = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      return Array.from({ length: n }, (_, k) => {
        const iso = KK.util.shiftDays(nowIso, k - (n - 1));
        const key = KK.util.dayKey(iso);
        return { key, iso, label: L[new Date(iso).getDay()], today: k === n - 1, mark: markedKeys.has(key) };
      });
    },
    // Полдень местного времени дня «ГГГГ-ММ-ДД» — время отметки задним числом.
    noonOf(key) {
      const [y, m, d] = String(key).split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
    },
    // «пн, 19 октября»
    dayTitle(key) {
      const iso = app.noonOf(key);
      return `${['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(iso).getDay()]}, ${KK.ui.fmtDate(iso)}`;
    },
    // Действующая отметка самочувствия за день (последняя записанная) или null.
    checkinOn(events, key, queued = []) {
      // неотправленная отметка за этот день новее записанной — считается действующей
      const q = queued.filter((x) => x.type === 'checkin' && x.payload && KK.util.dayKey((x.opts && x.opts.at) || x.queuedAt) === key).pop();
      if (q) return { type: 'checkin', payload: q.payload, at: (q.opts && q.opts.at) || q.queuedAt, pending: true };
      return KK.util.latestPerDay(events.filter((e) => e.type === 'checkin')).find((e) => KK.util.dayKey(e.at) === key) || null;
    },
    // queued — ещё не отправленные отметки: слот считается отмеченным, чтобы не ставить дубль
    doseSlots(events, nowIso, queued = []) {
      const today = KK.util.dayKey(nowIso);
      const taken = new Set(events.filter((e) => e.type === 'dose' && e.payload.taken && KK.util.dayKey(e.at) === today).map((e) => e.payload.slot));
      queued.filter((q) => q.type === 'dose' && q.payload && q.payload.taken && KK.util.dayKey(q.queuedAt) === today).forEach((q) => taken.add(q.payload.slot));
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
