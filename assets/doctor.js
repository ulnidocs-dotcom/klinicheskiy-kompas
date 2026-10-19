(function (g) {
  const KK = g.KK;
  const ui = () => KK.ui;
  const NAV = [
    { id: 'patients', href: 'index.html', label: 'Пациенты', icon: 'users' },
    { id: 'alerts', href: 'alerts.html', label: 'Алерты', icon: 'bell' },
    { id: 'messages', href: 'messages.html', label: 'Сообщения', icon: 'chat' },
    { id: 'import', href: 'import.html', label: 'Импорт истории', icon: 'upload' },
    { id: 'materials', href: 'materials.html', label: 'Материалы', icon: 'book' },
    { id: 'profile', href: 'profile.html', label: 'Профиль', icon: 'settings' },
  ];
  const PTABS = [
    ['patient', 'Обзор'], ['assess', 'Оценка'], ['therapy', 'Терапия'], ['routing', 'Маршрутизация'], ['messages', 'Сообщения'], ['import', 'Импорт'],
  ];
  // Пояснения для врача-не-психиатра: что сделать по сигналу.
  const HINTS = {
    si_phq9: 'Проведите скрининг по C-SSRS (вкладка «Оценка»). При умеренном или высоком риске — консультация психиатра в тот же день; при непосредственной угрозе — вызов СМП (112).',
    cssrs_risk: 'Не оставляйте пациента одного при высоком риске. Организуйте экстренную консультацию психиатра или госпитализацию через СМП.',
    sos: 'Свяжитесь с пациентом по телефону. Уточните наличие суицидальных мыслей; при угрозе — 112.',
    ae_severe: 'Оцените связь с препаратом и тяжесть. Рассмотрите коррекцию терапии; оформите извещение о нежелательной реакции в Росздравнадзор (АИС «Фармаконадзор»).',
    phq9_severe: 'Тяжёлая депрессия — показание к ведению психиатром. Оформите направление (вкладка «Маршрутизация»).',
    psychiatric_history: 'Психотические симптомы и биполярное расстройство ведёт психиатр. Не начинайте анксиолитики/антидепрессанты без консультации.',
    no_response: 'Нет ответа на адекватный курс — показание к консультации психиатра для пересмотра терапии.',
    worsening: 'Уточните причины ухудшения: приём препарата, НЯ, жизненные события. Рассмотрите внеплановый визит.',
    missed_doses: 'Уточните у пациента причины пропусков: побочные эффекты, забывчивость, сомнения в лечении.',
    contraindication: 'Назначение по инструкции невозможно. Рассмотрите альтернативу или консультацию психиатра.',
    phq9_modsevere: 'Желательна консультация психиатра для уточнения диагноза и тактики.',
    comorbid: 'Сочетание тревоги и депрессии: оцените динамику через 2–4 недели; при отсутствии улучшения — консультация психиатра.',
    recurrent: 'Рекуррентное течение — желательна консультация психиатра для поддерживающей терапии.',
    interaction: 'Оцените пользу и риск сочетания; информируйте пациента о симптомах серотонинового синдрома (тремор, потливость, тахикардия, возбуждение).',
    gad7_persistent: 'Выраженная тревога сохраняется на фоне терапии ≥ 4 недель — желательна консультация психиатра для пересмотра тактики.',
    ae_mild: 'Лёгкие нежелательные явления: обсудите с пациентом, оцените динамику; при нарастании — коррекция терапии.',
    unknown_data: 'Запросите недостающие анализы или загрузите выписку (вкладка «Импорт»).',
  };
  let showing = false; // повторный вход в showCriticalModal (подписчики стора вызываются синхронно)
  let lastFocus = null;
  let audioCtx = null;
  function audio() {
    try {
      if (!audioCtx) { const C = g.AudioContext || g.webkitAudioContext; if (!C) return null; audioCtx = new C(); }
      if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(() => {});
      return audioCtx;
    } catch (e) { return null; }
  }
  const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  const app = {
    HINTS,
    modeFor: (spec) => (/психиатр|психотерап/i.test(spec || '') ? 'psychiatrist' : 'nonPsychiatrist'),
    mode: () => KK.store.doctor().mode,

    signalBadge(s) {
      if (s.level === 'critical') return `<span class="badge badge--critical">${ui().icon('alert', 14)}Критично</span>`;
      if (s.routing === 'required') return '<span class="badge badge--required">Обязательно к психиатру</span>';
      if (s.routing === 'desirable') return '<span class="badge badge--desirable">Желательно к психиатру</span>';
      if (s.ruleId === 'contraindication') return '<span class="badge badge--contra">Противопоказание</span>';
      if (s.level === 'important') return '<span class="badge badge--warn">Важно</span>';
      return '<span class="badge badge--info">Инфо</span>';
    },
    signalHtml(s, mode) {
      const e = ui().esc;
      const cls = s.level === 'critical' ? 'signal--critical' : s.routing === 'required' ? 'signal--required'
        : s.routing === 'desirable' ? 'signal--desirable' : s.level === 'important' ? 'signal--warn' : '';
      const hint = mode === 'nonPsychiatrist' && HINTS[s.ruleId] ? `<p class="hint-box">${e(HINTS[s.ruleId])}</p>` : '';
      return `<div class="signal ${cls}">${app.signalBadge(s)}<b>${e(s.title)}</b><span></span><span>${e(s.text)}</span><span></span>${hint ? `<div>${hint}</div>` : '<span></span>'}<span class="src">${e(s.source)}${s.teamRule ? ' · правило команды' : ''}</span></div>`;
    },
    statusBadge(p) {
      if (p.openAlerts.some((a) => a.level === 'critical')) return app.signalBadge({ level: 'critical' });
      if (p.routing) return app.signalBadge({ routing: p.routing });
      if (p.therapy?.eligible === false) return app.signalBadge({ ruleId: 'contraindication' });
      if (p.openAlerts.length) return app.signalBadge({ level: 'important' });
      return '<span class="badge badge--ok">Стабильно</span>';
    },
    referralText(p, doctor) {
      const req = p.signals.filter((s) => s.routing);
      const level = p.routing === 'required' ? 'обязательно' : p.routing === 'desirable' ? 'желательно' : 'не определена';
      const dx = p.diagnoses.map((d) => `${d.code} ${d.text}`).join('; ');
      const sc = ['phq9', 'gad7', 'cssrs'].filter((id) => p.latest[id]).map((id) => {
        const r = p.latest[id];
        const label = r.band?.doctorLabel;
        if (id === 'cssrs') return `C-SSRS: ${label || 'нет интерпретации'}`;
        return `${id === 'phq9' ? 'PHQ-9' : 'GAD-7'}: ${r.total} (${label ? label.toLowerCase() : 'форма заполнена не полностью'}), ${ui().fmtDate(r.at)}`;
      }).join('\n');
      const meds = p.meds.map((m) => m.name).join(', ') || 'нет';
      const plan = p.plan ? `${KK.data.drugs[p.plan.drugId]?.name || p.plan.drugId} — ${p.plan.status === 'confirmed' ? `назначен ${ui().fmtDate(p.plan.confirmedAt)}` : 'не назначен'}` : 'нет';
      return [
        'НАПРАВЛЕНИЕ на консультацию врача-психиатра',
        `Пациент: ${p.name}, ${ui().age(p.age)}`,
        `Диагноз: ${dx}`,
        `Срочность: ${level}`,
        `Основания: ${req.map((s) => `${s.title} — ${s.text}`).join('; ') || 'по клинической оценке'}`,
        `Шкалы:\n${sc || 'нет данных'}`,
        `Текущая терапия: ${meds}; план: ${plan}`,
        `Приверженность (14 дн.): ${p.pdc14 == null ? 'нет данных' : Math.round(p.pdc14 * 100) + '%'}`,
        `Врач: ${doctor.name}, ${doctor.specialty}`,
      ].join('\n');
    },
    ASSESS_SCALES: ['phq9', 'gad7', 'cssrs'],
    // ?scale= из URL — только из белого списка; иначе C-SSRS при сигнале PHQ-9 п.9, иначе PHQ-9.
    assessScale: (param, siSignal) => (app.ASSESS_SCALES.includes(param) ? param : siSignal ? 'cssrs' : 'phq9'),
    // C-SSRS: вопросы 3–5 задаются только при «да» на вопрос 2; вопросы 1, 2 и 6 — всегда.
    cssrsVisible: (answers, i) => i < 2 || i === 5 || answers[1] === 1,
    // Состояние формы шкалы у врача: какие вопросы видны, всё ли заполнено, что сохранять и что писать в итоге.
    // Интерпретация показывается только при полностью заполненной форме; скрытые вопросы C-SSRS сохраняются как null.
    assessForm(sid, answers) {
      const def = KK.data.scales[sid];
      const shown = def.items.map((_, i) => i).filter((i) => sid !== 'cssrs' || app.cssrsVisible(answers, i));
      const filled = shown.every((i) => answers[i] != null);
      const full = def.items.map((_, i) => (shown.includes(i) && answers[i] != null ? answers[i] : null));
      const result = KK.scales.score(sid, full);
      const label = result.band ? result.band.doctorLabel : '';
      const summary = sid === 'cssrs' ? (filled && label ? label : 'Ответьте на вопросы')
        : filled && label ? `Сумма: ${result.total} — ${label}` : `Сумма: ${result.total} (ответьте на все вопросы)`;
      return { shown, filled, full, result, summary };
    },
    // Какое решение по назначению доступно врачу: нет плана / отменить / только вне инструкции / обычное назначение.
    // Диагноз вне показаний, как и противопоказание, требует пути off-label с обоснованием.
    therapyDecision(p, t) {
      if (!p.plan) return 'noPlan';
      if (p.plan.status === 'confirmed') return 'cancel';
      if (t && (t.eligible === false || t.indicated === false) && !p.plan.offLabel) return 'offlabel';
      return 'confirm';
    },
    ROUTING_PATIENT_MSG: 'Я оформил(а) направление на консультацию к врачу-психиатру. Подробности обсудим по телефону.',
    // Ключи пациентского приложения на этом устройстве, которые сбрасываются вместе с демо-данными (как на index.html).
    demoDeviceKeys: (keys) => keys.filter((k) => k.startsWith('kk:linked:') || k.startsWith('kk:prefs:')),
    alertStats(alerts) {
      const delivered = alerts.filter((a) => a.deliveredAt).map((a) => (new Date(a.deliveredAt) - new Date(a.dataAt)) / 1000);
      const acked = alerts.filter((a) => a.ackAt).map((a) => (new Date(a.ackAt) - new Date(a.dataAt)) / 60000);
      return { deliveredMedianSec: median(delivered), ackMedianMin: median(acked), open: alerts.filter((a) => !a.ackAt).length, total: alerts.length };
    },
    highlight(text, spans) {
      const e = ui().esc; let out = ''; let pos = 0;
      for (const s of spans) {
        if (s.start < pos) continue;
        out += e(text.slice(pos, s.start)) + `<mark class="hl hl--${s.kind}">${e(text.slice(s.start, s.end))}</mark>`;
        pos = s.end;
      }
      return out + e(text.slice(pos));
    },
    beep() {
      if (KK.store.doctor().sound === false) return;
      try {
        const ctx = audio();
        if (!ctx) return;
        [0, 0.28].forEach((t) => {
          const o = ctx.createOscillator(), gn = ctx.createGain();
          o.frequency.value = 740; gn.gain.setValueAtTime(0.0001, ctx.currentTime + t);
          gn.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
          gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
          o.connect(gn).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.24);
        });
      } catch (e) { /* звук недоступен */ }
    },

    renderSide() {
      const open = KK.store.alerts({ open: true });
      const crit = open.filter((a) => a.level === 'critical').length;
      const doc = KK.store.doctor();
      const nav = document.body.dataset.nav;
      ui().mount('#side', `
        <div class="d-brand">${ui().icon('route', 20)}<b>Компас</b></div>
        ${NAV.map((n) => `<a href="${n.href}" ${n.id === nav ? 'aria-current="page"' : ''}>${ui().icon(n.icon, 18)}<span>${n.label}</span>${n.id === 'alerts' && open.length ? `<span class="count ${crit ? 'count--crit' : ''}">${open.length}</span>` : ''}</a>`).join('')}
        <div class="d-me"><div class="d-me__who"><b>${ui().esc(doc.name)}</b><span class="hint">${ui().esc(doc.specialty)} · ${doc.mode === 'psychiatrist' ? 'режим специалиста' : 'режим с подсказками'}</span></div>
          ${KK.theme ? KK.theme.toggleHtml() : ''}</div>`);
    },
    patientTabs(id, active) {
      return `<nav class="ptabs" aria-label="Разделы карточки">${PTABS.map(([page, label]) =>
        `<a href="${page}.html?id=${id}" ${page === active ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
    },
    patientHeader(p) {
      const e = ui().esc;
      const contra = p.therapy?.contraindications.filter((c) => c.status === 'present') || [];
      const unknown = p.therapy?.contraindications.filter((c) => c.status === 'unknown') || [];
      return `<header class="p-header">
        <div class="avatar">${e(p.initials)}</div>
        <div class="grow"><h1>${e(p.name)}</h1>
          <p class="muted">${ui().age(p.age)} · ${p.sex === 'f' ? 'жен.' : 'муж.'} · ${p.diagnoses.map((d) => `<span title="${e(d.text)}">${e(d.code)}</span>`).join(', ')}${p.meds.length ? ` · принимает: ${e(p.meds.map((m) => m.name).join(', '))}` : ''}</p>
          <div class="row wrap">${app.statusBadge(p)}${contra.map((c) => `<span class="badge badge--contra">${e(c.label)}</span>`).join('')}${unknown.length ? `<span class="badge badge--warn">Нет данных: ${unknown.length}</span>` : ''}${p.routingConfirmed ? `<span class="badge badge--ok">Направлен ${ui().fmtDate(p.routingConfirmed.at)}</span>` : ''}</div></div>
      </header>`;
    },
    // Какой критический алерт показать следующим: только если окно свободно; каждый — ровно один раз (до доставки).
    nextCriticalToShow(alerts, openId) {
      if (openId) return null;
      return alerts.find((a) => a.level === 'critical' && !a.ackAt && !a.deliveredAt) || null;
    },
    showCriticalModal() {
      if (showing) return;
      const root = document.getElementById('modal-root');
      if (!root) return;
      const pending = app.nextCriticalToShow(KK.store.alerts({ open: true }), root.dataset.open);
      if (!pending) return;
      showing = true;
      try {
        const p = KK.store.patient(pending.patientId);
        const e = ui().esc;
        if (!root.dataset.open && document.activeElement && !root.contains(document.activeElement)) lastFocus = document.activeElement;
        // Сначала занимаем окно и рисуем, потом отмечаем доставку: markDelivered синхронно зовёт подписчиков,
        // и повторный вход не должен «доставить» следующий алерт, не показав его.
        root.dataset.open = pending.id;
        root.innerHTML = `<div class="modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="mt">
        <div class="modal stack"><span class="badge badge--critical">${ui().icon('alert', 14)}Критический сигнал</span>
          <h2 id="mt">${e(p ? p.name : pending.patientId)}: ${e(pending.title)}</h2><p>${e(pending.text)}</p>
          ${app.mode() === 'nonPsychiatrist' && HINTS[pending.ruleId] ? `<p class="hint-box">${e(HINTS[pending.ruleId])}</p>` : ''}
          <p class="hint">Данные поступили ${ui().fmtDateTime(pending.dataAt)} · ${e(pending.source)}</p>
          <div class="row wrap"><a class="btn btn--danger" href="patient.html?id=${e(pending.patientId)}" data-ack-open="${e(pending.id)}">Открыть карточку</a>
            <button class="btn" data-ack="${e(pending.id)}" data-action="Связался с пациентом">Связался с пациентом</button>
            <button class="btn btn--ghost" data-close>Позже</button></div></div></div>`;
        KK.store.markDelivered(pending.id);
        app.beep();
        root.querySelector('.btn')?.focus();
      } finally {
        showing = false;
      }
    },
    // Закрыть окно; при ackId — подтвердить алерт. Затем показать следующий ожидающий критический.
    closeCriticalModal(ackId, action) {
      const root = document.getElementById('modal-root');
      if (root) { root.innerHTML = ''; delete root.dataset.open; }
      if (ackId) KK.store.ackAlert(ackId, action);
      app.showCriticalModal();
      if (root && !root.dataset.open) {
        if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus === 'function') lastFocus.focus();
        lastFocus = null;
      }
    },
    start({ nav } = {}) {
      if (nav) document.body.dataset.nav = nav;
      app.renderSide();
      app.showCriticalModal();
      KK.store.subscribe(() => { app.renderSide(); app.showCriticalModal(); });
      // Браузер разрешает звук только после жеста пользователя — разблокируем AudioContext заранее.
      const unlock = () => { audio(); document.removeEventListener('click', unlock, true); document.removeEventListener('keydown', unlock, true); };
      document.addEventListener('click', unlock, true);
      document.addEventListener('keydown', unlock, true);
      document.addEventListener('click', (ev) => {
        const root = document.getElementById('modal-root');
        const ack = ev.target.closest('[data-ack]');
        if (ack) {
          const id = ack.dataset.ack;
          if (root && (root.contains(ack) || root.dataset.open === id)) app.closeCriticalModal(id, ack.dataset.action);
          else KK.store.ackAlert(id, ack.dataset.action);
        }
        if (root && ev.target.closest('[data-close]') && root.contains(ev.target)) app.closeCriticalModal();
      });
      document.addEventListener('keydown', (ev) => {
        const root = document.getElementById('modal-root');
        if (!root?.dataset.open) return;
        if (ev.key === 'Escape') { ev.preventDefault(); app.closeCriticalModal(); return; }
        if (ev.key === 'Tab') {
          const items = [...root.querySelectorAll('a[href], button:not([disabled]), textarea, input, select')];
          if (!items.length) return;
          const first = items[0], last = items[items.length - 1];
          const inside = root.contains(document.activeElement);
          if (ev.shiftKey && (document.activeElement === first || !inside)) { ev.preventDefault(); last.focus(); }
          else if (!ev.shiftKey && (document.activeElement === last || !inside)) { ev.preventDefault(); first.focus(); }
        }
      });
      return { doctor: KK.store.doctor(), mode: app.mode() };
    },
  };
  KK.doctorApp = app;
})(typeof window !== 'undefined' ? window : globalThis);
