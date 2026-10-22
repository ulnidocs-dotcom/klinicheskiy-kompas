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
  // Настройки критического окна (задаются в start): выбор алерта, отметка показа, автор подтверждения.
  let modal = { pick: (alerts, openId) => app.nextCriticalToShow(alerts, openId), mark: (id) => KK.store.markDelivered(id), actor: undefined };
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
    // Кто сейчас в кабинете: вошедший через сайт врач (активный) или демо-врач стора.
    me() {
      const d = KK.store.doctor();
      const s = KK.auth && typeof KK.auth.staff === 'function' ? KK.auth.staff('doctor') : null;
      return s ? { id: d.id, name: s.name, specialty: s.specialty, mode: app.modeFor(s.specialty), signedIn: true } : Object.assign({}, d, { signedIn: false });
    },
    mode: () => app.me().mode,

    signalBadge(s) {
      if (s.level === 'critical') return `<span class="badge badge--critical">${ui().icon('alert', 14)}Критично</span>`;
      if (s.routing === 'required') return '<span class="badge badge--required">Обязательно к психиатру</span>';
      if (s.routing === 'desirable') return '<span class="badge badge--desirable">Желательно к психиатру</span>';
      if (s.ruleId === 'contraindication') return '<span class="badge badge--contra">Противопоказание</span>';
      if (s.level === 'important') return '<span class="badge badge--warn">Важно</span>';
      if (s.level === 'task') return '<span class="badge badge--task">Задача</span>';
      return '<span class="badge badge--info">Инфо</span>';
    },
    signalHtml(s, mode) {
      const e = ui().esc;
      const cls = s.level === 'critical' ? 'signal--critical' : s.routing === 'required' ? 'signal--required'
        : s.routing === 'desirable' ? 'signal--desirable' : s.level === 'important' ? 'signal--warn' : '';
      const hint = mode === 'nonPsychiatrist' && HINTS[s.ruleId] ? `<p class="hint-box">${e(HINTS[s.ruleId])}</p>` : '';
      const task = s.level === 'task' ? 'Плановая задача, без срочного уведомления · ' : '';
      return `<div class="signal ${cls}">${app.signalBadge(s)}<b>${e(s.title)}</b><span></span><span>${e(s.text)}</span><span></span>${hint ? `<div>${hint}</div>` : '<span></span>'}<span class="src">${task}${e(s.source)}${s.teamRule ? ' · правило команды' : ''}</span>${app.whyHtml(s)}</div>`;
    },
    // «Почему этот сигнал»: на каких данных сделан вывод, чего не хватает, какое правило и какой версии сработало.
    whyHtml(s) {
      const e = ui().esc;
      if (!s.version) return '';
      const list = (xs) => `<ul>${xs.map((x) => `<li>${e(x)}</li>`).join('')}</ul>`;
      return `<details class="why"><summary>Почему</summary><dl>
        ${(s.inputs || []).length ? `<dt>Данные</dt><dd>${list(s.inputs)}</dd>` : ''}
        <dt>Не хватает</dt><dd>${(s.missing || []).length ? list(s.missing) : 'для этого правила данных достаточно'}</dd>
        <dt>Правило</dt><dd>${e(s.version)}</dd>
        <dt>Источник</dt><dd>${e(s.source)}</dd></dl></details>`;
    },
    statusBadge(p) {
      if (p.openAlerts.some((a) => a.level === 'critical')) return app.signalBadge({ level: 'critical' });
      if (p.routing) return app.signalBadge({ routing: p.routing });
      if (p.therapy?.eligible === false) return app.signalBadge({ ruleId: 'contraindication' });
      if (p.openAlerts.length) return app.signalBadge({ level: 'important' });
      if ((p.signals || []).some((s) => s.level === 'task')) return app.signalBadge({ level: 'task' });
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
        p.intakeRoute ? `Первичный приём психолога: ${KK.data.intake ? KK.data.intake.levels[p.intakeRoute].label : p.intakeRoute} (предварительная оценка)` : '',
        `Текущая терапия: ${meds}; план: ${plan}`,
        `Приверженность (14 дн.): ${p.pdc14 == null ? 'нет данных' : Math.round(p.pdc14 * 100) + '%'}`,
        `Врач: ${doctor.name}, ${doctor.specialty}`,
        app.modeFor(doctor.specialty) === 'nonPsychiatrist' ? app.PRELIM : '',
      ].filter(Boolean).join('\n');
    },
    // Закон РФ № 3185-1, ст. 20: диагноз психического расстройства устанавливает психиатр; заключение другого врача предварительное.
    PRELIM: 'Оценка врача, не являющегося психиатром, носит предварительный характер (ст. 20 Закона РФ № 3185-1). Диагноз психического расстройства устанавливает врач-психиатр.',
    prelimHtml: () => (app.mode() === 'nonPsychiatrist' ? `<p class="prelim">${ui().esc(app.PRELIM)}</p>` : ''),
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
    // Плитки «Сводка» карточки пациента (KK.tiles). Аура закреплена за типом плитки, не за тяжестью.
    // checkins/aes — события пациента по возрастанию времени; nowIso — «сейчас».
    summaryTiles(p, { checkins = [], aes = [], nowIso = new Date().toISOString() } = {}) {
      const T = KK.tiles, ui = KK.ui;
      const full = (sid) => { const r = p.latest?.[sid]; return r && r.complete && r.total != null ? r : null; };
      const phq = full('phq9'), gad = full('gad7');
      const scaleNote = (r) => (r ? `${r.band?.doctorLabel || ''}${r.at ? ` · ${ui.fmtDate(r.at)}` : ''}` : 'нет данных');
      const confirmed = p.plan?.status === 'confirmed';
      const moods = checkins.slice(-14).map((c) => c.payload.mood);
      const sd = moods.length >= 3 ? T.sd(moods) : null;
      const from = KK.util.shiftDays(nowIso, -14);
      const recent = aes.filter((e) => new Date(e.at) >= new Date(from) && new Date(e.at) <= new Date(nowIso));
      const items = recent.flatMap((e) => e.payload.items || []);
      const freq = new Map();
      items.forEach((i) => freq.set(i.label, (freq.get(i.label) || 0) + 1));
      const top = [...freq].sort((a, b) => b[1] - a[1])[0];
      const days = confirmed && p.plan.confirmedAt ? Math.max(0, KK.util.daysBetween(p.plan.confirmedAt, nowIso)) : null;
      const pct = p.pdc14 == null ? null : Math.round(p.pdc14 * 100);
      return [
        { wide: true, aura: 'blue', label: 'PHQ-9 · последнее', value: phq ? phq.total : null, unit: 'из 27', note: scaleNote(phq),
          visual: T.ringGauge({ value: phq ? phq.total : null, max: 27, label: 'PHQ-9' }) },
        { aura: 'sand', label: 'GAD-7 · последнее', value: gad ? gad.total : null, unit: 'из 21', note: scaleNote(gad),
          visual: T.rangeBar({ value: gad ? gad.total : null, max: 21, bands: [{ from: 0, to: 4 }, { from: 5, to: 9 }, { from: 10, to: 14 }, { from: 15, to: 21 }] }) },
        { aura: 'teal', label: 'Приверженность', value: pct, unit: '%', note: pct == null ? 'не назначено' : 'за 14 дн.',
          visual: pct == null ? '' : T.rangeBar({ value: pct, max: 100 }) },
        { aura: 'mood', label: 'Колебания настроения', value: sd == null ? null : (Math.round(sd * 10) / 10).toFixed(1).replace('.', ','), unit: 'σ',
          note: sd == null ? 'мало отметок' : `ст. отклонение, ${moods.length} ${ui.plural(moods.length, ['отметка', 'отметки', 'отметок'])}, шкала 1–5`,
          visual: T.dotRow(moods, { max: 5 }) },
        { aura: 'lavender', label: 'Нежелательные явления', value: items.length, unit: 'за 14 дн.',
          note: top ? `чаще: ${top[0]}` : 'не сообщались' },
        { aura: 'sage', label: 'Дней на терапии', value: days, unit: days == null ? '' : ui.plural(days, ['день', 'дня', 'дней']),
          note: days == null ? 'не назначено' : `с ${ui.fmtDate(p.plan.confirmedAt)}` },
      ];
    },
    // Компактная карточка «Первичный приём психолога» — только после решения психолога (store.intakeOf).
    intakeCard(p, it) {
      if (!p || !it || !it.intake || !it.intake.decision) return '';
      const e = ui().esc, B = KK.battery;
      const dec = it.intake.decision;
      const dass = it.dass ? B.scoreDass(it.dass) : null;
      const chips = dass ? Object.values(dass.subscales).map((s) => `<span class="badge badge--info">${e(s.title)}: ${e(s.label)}</span>`).join('') : '<span class="hint">DASS-21: нет данных</span>';
      const ho = it.intake.handoff;
      // Только текущее решение; прежние решения и устаревшие передачи — в журнале и у психолога.
      const hoHtml = !ho ? '' : ho.outdated
        ? '<p class="hint">Маршрут изменён после передачи — психолог передаст обновлённую сводку.</p>'
        : `<details><summary class="hint">Сообщение психолога · ${ui().fmtDateTime(ho.at)}</summary><p style="white-space:pre-line">${e(ho.text)}</p></details>`;
      return `<section class="card stack intake-card"><div class="row-between"><h2>Первичный приём психолога</h2><span class="hint">${(dec.revision || 1) > 1 ? 'обновлено ' : ''}${ui().fmtDate(dec.at)}</span></div>
        <p><b>${e(B.levelLabel(dec.level))}</b>${dec.overridden ? ' <span class="hint">· изменено психологом</span>' : ''}${dec.downgradeMandatory ? ' <span class="badge badge--warn">понижен обязательный маршрут</span>' : ''}</p>
        <div class="row wrap">${chips}</div>
        ${hoHtml}
        <p class="hint">Предварительная оценка психолога, не диагноз.</p>
        <a href="../psych/patient.html?id=${e(p.id)}">Подробнее</a></section>`;
    },
    // ——— Анкета до приёма (спек 2026-10-22 §B) ———
    // Карточка в карте пациента: отправка, ожидание, сводка (PHQ-2/GAD-2, флаги), все ответы, предложения в карту, экспорт FHIR.
    // events — события previsit пациента; open — показать форму отправки; checked — ключи отмеченных предложений.
    previsitCard(p, events, { open = false, msg = '', checked = [] } = {}) {
      const Q = KK.questionnaire, def = KK.data.questionnaires && KK.data.questionnaires.previsit;
      if (!Q || !def || !p) return '';
      const u = ui(), e = u.esc;
      const a = p.previsit || null;
      const st = Q.status(a, events);
      const day = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
      const visit = a && a.visitDate ? ` · приём ${day(a.visitDate)}` : '';
      const sendForm = `<div class="row wrap previsit-send no-print">
          <label class="field"><span class="hint">Дата приёма (необязательно)</span><input class="input" type="date" id="pv-date" value="${e((a && a.visitDate) || '')}"></label>
          <button class="btn btn--primary" data-previsit-send>${a ? 'Отправить заново' : 'Отправить анкету'}</button>
          ${a ? '<button class="btn btn--ghost" data-previsit-cancel>Отмена</button>' : ''}</div>
        ${a ? '<p class="hint">Новая отправка заменит прежнюю: пациент заполнит анкету ещё раз.</p>' : ''}`;
      const msgHtml = `<p class="hint" id="pv-msg" role="status">${e(msg)}</p>`;
      const head = `<div class="row-between"><h2>Анкета до приёма</h2>${a ? `<span class="hint">отправлена ${u.fmtDate(a.sentAt)}${e(visit)}</span>` : ''}</div>`;
      if (st.state === 'none') {
        return `<section class="card stack previsit" id="previsit">${head}
          <p class="muted">Пациент ответит на вопросы о жалобах, лекарствах и здоровье до приёма; ответы появятся здесь.</p>
          ${open ? sendForm : '<button class="btn" data-previsit-open>Отправить анкету до приёма</button>'}${msgHtml}</section>`;
      }
      const resend = open ? sendForm : '<button class="btn btn--ghost no-print" data-previsit-open>Отправить анкету заново</button>';
      const resp = st.response || st.partial;
      if (!resp) {
        return `<section class="card stack previsit" id="previsit">${head}
          <p class="muted">Пациент ещё не заполнил анкету.</p>${msgHtml}${resend}</section>`;
      }
      const s = Q.summary(def, resp.payload, p);
      const rows = Q.answerRows(def, resp.payload, p);
      const score = (r, full) => `${r.total} из ${r.max}${r.complete ? '' : ' <span class="hint">(не на все вопросы есть ответ)</span>'}${r.positive
        ? ` <span class="badge badge--warn">≥ ${def.threshold} — желательно оценить полной шкалой</span> <a href="assess.html?id=${e(p.id)}">Оценить ${full}</a>` : ''}`;
      const flags = s.flags.filter((f) => !/^(PHQ|GAD)-2/.test(f.text));
      const pr = st.response ? Q.proposals(def, resp.payload, p, KK.parser) : { items: [], unrecognized: [] };
      const proposalsHtml = !st.response ? '' : `<div class="stack previsit-proposals">
          <h3>Предлагается добавить в карту — со слов пациента</h3>
          ${pr.items.length ? `<ul class="check-list">${pr.items.map((x) => `<li><label class="row"><input type="checkbox" data-pv-key="${e(x.key)}" ${checked.includes(x.key) ? 'checked' : ''}><span>${e(x.label)}</span></label></li>`).join('')}</ul>
            <div class="row wrap no-print"><button class="btn btn--primary" data-previsit-apply>Добавить выбранное</button></div>`
            : '<p class="hint">Добавлять нечего: пациент ничего не указал или это уже есть в карте.</p>'}
          ${pr.unrecognized.length ? `<p class="hint">Не распознано автоматически — проверьте на приёме: ${e(pr.unrecognized.join(', '))}</p>` : ''}
          <p class="hint">Ничего не попадает в карту без вашего подтверждения. Это данные со слов пациента — уточните их на приёме.</p></div>`;
      return `<section class="card stack previsit" id="previsit">${head}
        <p>${st.response ? `<span class="badge badge--ok">Заполнена</span> <span class="hint">${u.fmtDateTime(resp.at)}</span>`
          : `<span class="badge badge--task">Не завершена</span> <span class="hint">последний ответ ${u.fmtDateTime(resp.at)}</span>`}</p>
        ${flags.map((f) => `<div class="signal"><span class="badge ${f.level === 'critical' ? 'badge--critical' : 'badge--warn'}">${f.level === 'critical' ? 'Критично' : 'Обратите внимание'}</span><span>${e(f.text)}</span></div>`).join('')}
        <dl class="kv">
          <dt>Жалоба</dt><dd>${e(s.complaint) || '—'}</dd>
          <dt>Как давно</dt><dd>${e(s.duration) || '—'}</dd>
          <dt>PHQ-2</dt><dd>${score(s.phq2, 'PHQ-9')}</dd>
          <dt>GAD-2</dt><dd>${score(s.gad2, 'GAD-7')}</dd>
        </dl>
        <details><summary>Все ответы (${rows.length})</summary><dl class="kv">${rows.map((r) => `<dt>${e(r.title)}</dt><dd>${e(r.text)}</dd>`).join('')}</dl></details>
        ${proposalsHtml}
        ${msgHtml}
        <div class="row wrap no-print">${st.response ? '<button class="btn" data-previsit-fhir>Экспорт (FHIR QuestionnaireResponse)</button>' : ''}</div>
        <p class="hint">Скрининг: PHQ-2 — ${e(def.sources.phq2)}; GAD-2 — ${e(def.sources.gad2)}. Порог ≥ ${def.threshold} из 6. Не диагноз.</p>
        ${resend}</section>`;
    },
    // Бейдж решения психолога для строки очереди врача («Психиатр · обязательно» и др.).
    intakeBadge(p) {
      const l = p && p.intakeRoute;
      if (!l || !KK.data.intake) return '';
      const cls = l === 'psychiatrist_required' ? 'badge--required' : l === 'psychotherapy_desirable' ? 'badge--desirable' : 'badge--info';
      return `<span class="badge ${cls}" title="Решение психолога по первичному приёму">${ui().esc(KK.data.intake.levels[l].short)} · психолог</span>`;
    },
    // Входящие от психолога (передача сводки, понижение обязательного маршрута); непрочитанные — с кнопкой «Прочитано».
    inboxHtml(items, { names = {}, title = 'Сообщения от психолога' } = {}) {
      const e = ui().esc;
      if (!items.length) return '';
      return `<section class="card stack" aria-label="${e(title)}"><h2>${e(title)}</h2>${items.slice().reverse().map((m) => `
        <article class="stack" style="border-top:1px solid var(--line);padding-top:10px">
          <div class="row-between"><span><b>${e(m.kind === 'phone_confirm' ? 'Регистрация по приглашению' : m.fromName || 'Психолог')}</b>${names[m.patientId] ? ` · <a href="patient.html?id=${e(m.patientId)}">${e(names[m.patientId])}</a>` : ''}
            ${m.kind === 'downgrade' ? ' <span class="badge badge--warn">понижен обязательный маршрут</span>' : ''}${m.kind === 'phone_confirm' ? ' <span class="badge badge--warn">номер отличается от карты</span>' : ''}</span>
            <span class="hint">${ui().fmtDateTime(m.at)}</span></div>
          <p style="white-space:pre-line;margin:0">${e(m.text)}</p>
          ${m.kind === 'phone_confirm' ? app.phoneConfirmControls(m) : m.readAt ? `<span class="hint">Прочитано ${ui().fmtDateTime(m.readAt)}</span>` : `<button class="btn" data-inbox-read="${e(m.id)}">Прочитано</button>`}
        </article>`).join('')}</section>`;
    },
    // «Подтвердите номер пациента»: кнопки, пока запрос ждёт решения; потом — итог.
    phoneConfirmControls(m) {
      const e = ui().esc;
      const st = KK.store && KK.store.phoneConfirmState ? KK.store.phoneConfirmState(m.confirmId) : null;
      if (st !== 'pending') return `<span class="hint">${e(app.PHONE_CONFIRM_STATE[st] || 'Запрос не найден')}</span>`;
      return `<div class="row wrap"><button class="btn btn--primary" data-phone-confirm="${e(m.confirmId)}" data-approve="1">Подтвердить</button>
        <button class="btn" data-phone-confirm="${e(m.confirmId)}" data-approve="0">Отклонить</button></div><p class="hint pc-err" role="alert"></p>`;
    },
    // ——— Приглашение пациента в дневник (спек 2026-10-22 §A) ———
    MAX_BOT: 'kompas_bot', // заглушка: имя бота в MAX появится при подключении
    // Ссылки приглашения: MAX (startapp) и сайт прототипа (в настоящей версии — /join/<токен>), текст SMS.
    inviteLinks(token, pageHref) {
      const t = encodeURIComponent(token);
      let site = `../patient/onboarding.html?invite=${t}`;
      try { site = new URL(site, pageHref).href; } catch (e) { /* адрес страницы недоступен — относительная ссылка */ }
      return { max: `https://max.ru/${app.MAX_BOT}?startapp=inv_${t}`, site,
        sms: `Ваш врач приглашает вас в дневник самочувствия. Ссылка действует 3 дня: ${site}` };
    },
    // QR-код как встроенный SVG: генерируется на месте (assets/vendor/qrcode.js), ссылка не уходит сторонним сервисам.
    // Тёмные модули на белом фоне в любой теме — так код читается камерой. Нет библиотеки — пустая строка.
    qrSvg(text, qrcode = g.qrcode) {
      if (typeof qrcode !== 'function') return '';
      const qr = qrcode(0, 'M');
      qr.addData(String(text));
      qr.make();
      const n = qr.getModuleCount(), m = 4, size = n + m * 2;
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="200" height="200" shape-rendering="crispEdges" role="img" aria-label="QR-код ссылки приглашения"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
    },
    inviteStatus(inv) {
      const u = ui();
      if (!inv) return '';
      if (inv.state === 'pending') return `Приглашение отправлено ${u.fmtDateTime(inv.createdAt)}, действует до ${u.fmtDateTime(inv.expiresAt)}`;
      if (inv.state === 'used') return `Приглашение использовано ${u.fmtDateTime(inv.usedAt)}`;
      if (inv.state === 'expired') return `Приглашение истекло ${u.fmtDateTime(inv.expiresAt)}`;
      return 'Приглашение отменено';
    },
    PHONE_CONFIRM_STATE: { approved: 'Подключение подтверждено', rejected: 'Подключение отклонено, ссылка больше не действует', cancelled: 'Запрос отменён: отправлено новое приглашение' },
    // Откуда пришла отметка — для ленты событий; события без канала (демо-история) без подписи.
    channelLabel: (e) => {
      const L = { max: 'MAX', 'max-chat': 'чат MAX', telegram: 'Telegram', web: 'сайт' };
      return e && L[e.channel] ? ` · ${L[e.channel]}` : '';
    },
    // Подписи журнала действий для врача.
    auditLabel(a) {
      const lv = (l) => (KK.battery ? KK.battery.levelLabel(l) : l);
      if (a.action === 'intake_decision') return `Психолог: решение по маршруту — ${lv(a.details && a.details.level)}${a.details && a.details.downgrade_mandatory ? ' (понижен обязательный маршрут)' : ''}`;
      if (a.action === 'intake_handoff') return 'Психолог передал сводку первичного приёма';
      if (a.action === 'intake_completed') return 'Пациент завершил батарею первичного приёма';
      if (a.action === 'ack_alert' && a.actor === 'psy1') return `Психолог подтвердил сигнал: ${(a.details && a.details.action) || ''}`;
      const CH = { max: 'MAX', telegram: 'Telegram', web: 'сайт' };
      if (a.action === 'channel_linked') return `Пациент подключил дневник: ${CH[a.details && a.details.channel] || ''}`;
      if (a.action === 'channel_unlinked') return `Пациент отключил дневник: ${CH[a.details && a.details.channel] || ''}`;
      if (a.action === 'consents_recorded') return 'Пациент дал согласия при подключении';
      const INV = { patient_added: 'Врач добавил пациента', invite_created: 'Врач отправил приглашение в дневник', invite_redeemed: 'Пациент зарегистрировался по приглашению',
        phone_verified: 'Пациент подтвердил номер телефона', phone_confirm_requested: 'Номер при регистрации отличается от карты: ждёт подтверждения врача',
        phone_confirm_approved: 'Врач подтвердил номер пациента', phone_confirm_rejected: 'Врач отклонил подключение по пересланной ссылке' };
      if (INV[a.action]) return INV[a.action];
      if (a.action === 'previsit_sent') return `Врач отправил анкету до приёма${a.details && a.details.visitDate ? ` (приём ${a.details.visitDate.split('-').reverse().join('.')})` : ''}`;
      if (a.action === 'import_history') return a.details && a.details.source === 'previsit' ? 'Врач добавил в карту данные из анкеты до приёма (со слов пациента)' : 'Врач добавил в карту данные из выписки';
      return a.action;
    },
    ROUTING_PATIENT_MSG: 'Я оформил(а) направление на консультацию к врачу-психиатру. Подробности обсудим по телефону.',
    // Ключи пациентского приложения на этом устройстве, которые сбрасываются вместе с демо-данными (как на index.html).
    demoDeviceKeys: (keys) => keys.filter((k) => k.startsWith('kk:linked:') || k.startsWith('kk:prefs:') || k.startsWith('kk:intake-draft:') || k.startsWith('kk:previsit-draft:') || k === 'kk:outbox'),
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
      const doc = app.me();
      const nav = document.body.dataset.nav;
      const inbox = KK.store.inbox ? KK.store.inbox({ to: doc.id, unread: true }).length : 0;
      ui().mount('#side', `
        <div class="d-brand">${ui().icon('route', 20)}<b>Компас</b><span class="dotrow" aria-hidden="true">· · ·· ····</span></div>
        ${NAV.map((n) => `<a href="${n.href}" ${n.id === nav ? 'aria-current="page"' : ''}>${ui().icon(n.icon, 18)}<span>${n.label}</span>${n.id === 'alerts' && open.length ? `<span class="count ${crit ? 'count--crit' : ''}">${open.length}</span>` : ''}${n.id === 'messages' && inbox ? `<span class="count" title="Непрочитанные входящие: от психолога и запросы подтверждения номера">${inbox}</span>` : ''}</a>`).join('')}
        <div class="d-me"><div class="d-me__who"><b>${ui().esc(doc.name)}</b><span class="hint">${ui().esc(doc.specialty)} · ${doc.mode === 'psychiatrist' ? 'режим специалиста' : 'режим с подсказками'}</span>${doc.signedIn ? '<a class="hint" href="../auth/login.html?as=staff" data-logout>Выйти</a>' : ''}</div>
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
          <p class="muted">${ui().age(p.age)} · ${p.sex === 'f' ? 'жен.' : 'муж.'}${p.diagnoses.length ? ' · ' + p.diagnoses.map((d) => `<span title="${e(d.text)}">${e(d.code)}</span>`).join(', ') : ''}${p.meds.length ? ` · принимает: ${e(p.meds.map((m) => m.name).join(', '))}` : ''}</p>
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
      const pending = modal.pick(KK.store.alerts({ open: true }), root.dataset.open);
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
          ${modal.hints !== false && app.mode() === 'nonPsychiatrist' && HINTS[pending.ruleId] ? `<p class="hint-box">${e(HINTS[pending.ruleId])}</p>` : ''}
          <p class="hint">Данные поступили ${ui().fmtDateTime(pending.dataAt)} · ${e(pending.source)}</p>
          <div class="row wrap"><a class="btn btn--danger" href="patient.html?id=${e(pending.patientId)}" data-ack-open="${e(pending.id)}">Открыть карточку</a>
            <button class="btn" data-ack="${e(pending.id)}" data-action="Связался с пациентом">Связался с пациентом</button>
            <button class="btn btn--ghost" data-close>Позже</button></div></div></div>`;
        modal.mark(pending.id);
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
      if (ackId) KK.store.ackAlert(ackId, action, modal.actor);
      app.showCriticalModal();
      if (root && !root.dataset.open) {
        if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus === 'function') lastFocus.focus();
        lastFocus = null;
      }
    },
    // opts (для кабинета психолога): renderSide — своя боковая панель; pick/mark — какие критические алерты
    // показывать и как отмечать показ (по умолчанию — доставка врачу); actor — кто подтверждает алерт.
    start({ nav, renderSide = app.renderSide, pick, mark, actor, hints = true } = {}) {
      if (nav) document.body.dataset.nav = nav;
      modal = { pick: pick || app.nextCriticalToShow, mark: mark || ((id) => KK.store.markDelivered(id)), actor, hints };
      renderSide();
      app.showCriticalModal();
      KK.store.subscribe(() => { renderSide(); app.showCriticalModal(); });
      // Браузер разрешает звук только после жеста пользователя — разблокируем AudioContext заранее.
      const unlock = () => { audio(); document.removeEventListener('click', unlock, true); document.removeEventListener('keydown', unlock, true); };
      document.addEventListener('click', unlock, true);
      document.addEventListener('keydown', unlock, true);
      document.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-logout]') && KK.auth && KK.auth.session) KK.auth.session.clear();
        const root = document.getElementById('modal-root');
        const ack = ev.target.closest('[data-ack]');
        if (ack) {
          const id = ack.dataset.ack;
          if (root && (root.contains(ack) || root.dataset.open === id)) app.closeCriticalModal(id, ack.dataset.action);
          else KK.store.ackAlert(id, ack.dataset.action, modal.actor);
        }
        if (root && ev.target.closest('[data-close]') && root.contains(ev.target)) app.closeCriticalModal();
        // Решение по номеру пациента (карточка и «Сообщения»). Ошибка — рядом с кнопками; успех перерисует страницу.
        const pc = ev.target.closest('[data-phone-confirm]');
        if (pc) {
          try { KK.store.resolvePhoneConfirm(pc.dataset.phoneConfirm, pc.dataset.approve === '1', app.me().id); } catch (err) {
            const box = pc.closest('article') && pc.closest('article').querySelector('.pc-err');
            if (box) box.textContent = err.message;
          }
        }
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
