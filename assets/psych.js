// Кабинет клинического психолога: оболочка (боковая панель, критическое окно — общее с врачом через KK.doctorApp.start)
// и чистые построители HTML для сводки первичного приёма. Формулировки: «предварительная оценка», «направление на консультацию».
(function (g) {
  const KK = g.KK;
  const ui = () => KK.ui;
  const esc = (t) => KK.ui.esc(t);
  const NAV = [
    { id: 'queue', href: 'index.html', label: 'Очередь', icon: 'users' },
    { id: 'materials', href: 'materials.html', label: 'Материалы', icon: 'book' },
    { id: 'profile', href: 'profile.html', label: 'Профиль', icon: 'settings' },
  ];
  const STATUS = { assigned: 'назначен', in_progress: 'в процессе', completed: 'заполнено', decided: 'решение принято' };
  // Порядок очереди: ждёт решения → в процессе → назначен → решение принято (критические — всегда выше).
  const STATUS_ORDER = { completed: 0, in_progress: 1, assigned: 2, decided: 3 };
  const LEVEL_BADGE = {
    psychiatrist_required: 'badge--required', psychotherapy_desirable: 'badge--desirable', consultation: 'badge--info', observation: 'badge--ok',
  };
  const fmtNum = (v) => String(v).replace('.', ',');

  const app = {
    NAV, STATUS,
    statusLabel: (s) => STATUS[s] || '—',
    // Открытые для психолога критические сигналы: не подтверждены врачом (openAlerts) и не подтверждены психологом.
    openCritical: (p) => ((p && p.openAlerts) || []).filter((a) => a.level === 'critical' && !(a.ackBy && a.ackBy.psy)),
    critical: (p) => app.openCritical(p).length > 0,
    queue(patients) {
      return (patients || []).filter((p) => p.intake && p.intakeStatus)
        .sort((a, b) => (app.critical(b) - app.critical(a)) || (STATUS_ORDER[a.intakeStatus] - STATUS_ORDER[b.intakeStatus])
          || a.name.localeCompare(b.name, 'ru'));
    },
    levelBadge(level, { short = false } = {}) {
      if (!level) return '<span class="badge badge--warn">Нет данных для предложения</span>';
      const L = KK.data.intake.levels[level];
      return `<span class="badge ${LEVEL_BADGE[level]}">${esc(short ? L.short : L.label)}</span>`;
    },
    // Предупреждение при понижении обязательного маршрута к психиатру (основание — C-SSRS или анкета).
    downgradeWarning(route, level) {
      if (!route || route.level !== 'psychiatrist_required' || level === 'psychiatrist_required' || !KK.battery.mandatoryHard(route)) return '';
      return `<div class="psy-banner" role="alert"><p><b>Понижение обязательного маршрута к психиатру.</b> Основание — ${esc(route.reasons.filter((r) => r.level === 'psychiatrist_required' && r.kind !== 'dass').map((r) => r.text).join('; '))}.
        Опишите причину не короче 20 символов; решение будет отмечено в журнале, лечащий врач получит уведомление.</p></div>`;
    },
    statusBadge(p) {
      const cls = p.intakeStatus === 'completed' ? 'badge--warn' : p.intakeStatus === 'decided' ? 'badge--ok' : 'badge--info';
      return `<span class="badge ${cls}">${esc(app.statusLabel(p.intakeStatus))}</span>`;
    },
    // Текст для лечащего врача: предварительная оценка, маршрут, DASS-21 по подшкалам, C-SSRS, без диагнозов.
    handoffText(p, it, psy) {
      const B = KK.battery;
      const dec = it && it.intake && it.intake.decision;
      const dass = it && it.dass ? B.scoreDass(it.dass) : null;
      const route = B.routeIntake(it || {});
      const dassLine = dass ? Object.values(dass.subscales).map((s) => `${s.title} ${s.score == null ? 'нет данных' : `${s.score} (${s.label})`}`).join(', ') : 'нет данных';
      return [
        `Первичный приём клинического психолога: ${p.name}, ${ui().age(p.age)}`,
        'Предварительная оценка психолога, не диагноз.',
        `Маршрут: ${dec ? B.levelLabel(dec.level) : 'решение не принято'}${dec && dec.overridden ? ` (изменено: ${dec.note})` : ''}`,
        `C-SSRS (скрининг): ${it && it.cssrs && it.cssrs.band ? it.cssrs.band.doctorLabel : 'нет данных'}`,
        `DASS-21: ${dassLine}`,
        route.discrepancies.length ? `Вопросы для беседы: ${route.discrepancies.map((d) => d.text).join(' ')}` : '',
        dec && dec.note && !dec.overridden ? `Комментарий: ${dec.note}` : '',
        `Психолог: ${psy.name}, ${psy.specialty}`,
      ].filter(Boolean).join('\n');
    },

    // ——— Построители сводки ———
    dassTiles(dassAnswers) {
      const T = KK.tiles;
      const d = KK.data.scales.dass21;
      const r = KK.battery.scoreDass(dassAnswers || null);
      return T.tileGrid(['depression', 'anxiety', 'stress'].map((k, i) => {
        const s = r.subscales[k];
        const cuts = d.severity[k];
        const bands = cuts.map((c, j) => ({ from: c, to: (cuts[j + 1] ?? 43) - 1 }));
        return { aura: ['blue', 'lavender', 'sand'][i], label: `DASS-21 · ${s.title}`, value: s.score, unit: 'из 42',
          note: s.score == null ? 'нет данных' : s.label, visual: T.rangeBar({ value: s.score, max: 42, bands }) };
      }), { label: 'DASS-21' });
    },
    tipiBars(tipiAnswers) {
      const r = KK.battery.scoreTipi(tipiAnswers || null);
      return `<ul class="tipi" aria-label="Профиль TIPI-RU, шкала 1–7">${Object.values(r.traits).map((t) => {
        const f = t.score == null ? 0 : ((t.score - 1) / 6) * 100;
        return `<li><span class="tipi__l">${esc(t.title)}</span><span class="tipi__bar" aria-hidden="true"><i style="width:${f.toFixed(1)}%"></i></span>`
          + `<b class="tipi__v">${t.score == null ? 'нет данных' : esc(fmtNum(t.score))}</b></li>`;
      }).join('')}</ul>`;
    },
    colorStrip(ids) {
      const by = Object.fromEntries(KK.data.cto.colors.map((c) => [c.id, c]));
      if (!Array.isArray(ids) || !ids.length) return '<span class="hint">нет данных</span>';
      return `<ol class="cstrip">${ids.map((id) => by[id]).filter(Boolean).map((c) => `<li style="--c:${c.hex}" title="${esc(c.name)}"><span class="sr-only">${esc(c.name)}</span></li>`).join('')}</ol>`;
    },
    ctoHtml(cto) {
      if (!cto) return '<p class="hint">Пациент ещё не выполнял задание.</p>';
      if (cto.skipped) return '<p class="hint">Пациент пропустил это задание (оно по желанию).</p>';
      const C = KK.data.cto;
      const sim = KK.battery.ctoSimilarity(cto);
      const rows = C.concepts.map((c) => `<tr><th scope="row">${esc(c.label)}</th><td>${app.colorStrip(cto.concepts && cto.concepts[c.id])}</td></tr>`).join('')
        + `<tr class="cto-pref"><th scope="row">${esc(C.preferenceLabel)}</th><td>${app.colorStrip(cto.preference)}</td></tr>`;
      const close = (sim.close.length ? sim.close : sim.pairs).slice(0, 5);
      return `<table class="cto"><caption class="sr-only">Раскладки цветов по понятиям, слева — подходит больше всего</caption><tbody>${rows}</tbody></table>
        <p class="hint">Слева — цвет, который подходит больше всего. ${C.colors.map((c) => `<span class="cdot" style="--c:${c.hex}"></span>${esc(c.name)}`).join(' · ')}</p>
        <div class="stack"><p class="note-label">${esc(sim.note)}</p>
          ${close.length ? `<ul class="plist">${close.map((p) => `<li>${esc(p.text)}</li>`).join('')}</ul>` : '<p class="hint">Недостаточно полных раскладок для сравнения.</p>'}
          ${sim.pairs.length > close.length ? `<p class="hint">Показаны ${close.length} наиболее совпадающих пар из ${sim.pairs.length}.</p>` : ''}</div>`;
    },
    formHtml(form) {
      if (!form) return '<p class="hint">Анкета не заполнена.</p>';
      const yn = (v) => (v === true ? 'да' : v === false ? 'нет' : 'нет ответа');
      return `<dl class="kv kv--stack">${KK.data.intake.form.map((q) => {
        const v = form[q.id];
        if (q.when && !q.when(form)) return '';
        const shown = q.type === 'yesno' ? yn(v) : v ? `«${v}»` : 'нет ответа';
        const flag = (q.id === 'psychotic' || q.id === 'mania') && v === true ? ' <span class="badge badge--required">к психиатру</span>' : '';
        return `<dt>${esc(q.title)}</dt><dd>${esc(shown)}${flag}</dd>`;
      }).join('')}</dl>`;
    },
    routeHtml(route) {
      const reasons = route.reasons.length ? `<ul class="plist">${route.reasons.map((r) => `<li>${app.levelBadge(r.level, { short: true })}${esc(r.text)}<br>`
        + `<span class="hint">${esc(r.source)} · ${esc(r.note)}</span></li>`).join('')}</ul>` : '<p class="hint">Правила не сработали.</p>';
      const missing = route.missing.length ? `<p class="hint">Нет данных: ${esc(route.missing.map((m) => ({ form: 'анкета', cssrs: 'C-SSRS', dass21: 'DASS-21' })[m] || m).join(', '))}</p>` : '';
      return `${app.levelBadge(route.level)}${reasons}${missing}`;
    },

    renderSide() {
      const psy = KK.store.psychologist();
      const nav = document.body.dataset.nav;
      const waiting = app.queue(KK.store.patients()).filter((p) => p.intakeStatus === 'completed').length;
      ui().mount('#side', `
        <div class="d-brand">${ui().icon('route', 20)}<b>Компас</b><span class="dotrow" aria-hidden="true">· · ·· ····</span></div>
        ${NAV.map((n) => `<a href="${n.href}" ${n.id === nav ? 'aria-current="page"' : ''}>${ui().icon(n.icon, 18)}<span>${n.label}</span>${n.id === 'queue' && waiting ? `<span class="count">${waiting}</span>` : ''}</a>`).join('')}
        <div class="d-me"><div class="d-me__who"><b>${esc(psy.name)}</b><span class="hint">${esc(psy.specialty)}</span></div>
          ${KK.theme ? KK.theme.toggleHtml() : ''}</div>`);
    },
    // Критическое окно психолога: только C-SSRS из самоотчёта первичного приёма (origin 'intake'), не si_phq9
    // и не оценка врача. Показ и подтверждение отмечаются для психолога отдельно (seenBy.psy, ackBy.psy) —
    // доставка и подтверждение врача не затрагиваются.
    pickCritical(alerts, openId) {
      if (openId) return null;
      return alerts.find((a) => a.level === 'critical' && a.ruleId === 'cssrs_risk' && a.origin === 'intake' && !a.ackAt
        && !(a.ackBy && a.ackBy.psy) && !(a.seenBy && a.seenBy.psy)) || null;
    },
    start({ nav } = {}) {
      return KK.doctorApp.start({ nav, renderSide: app.renderSide, pick: app.pickCritical, mark: (id) => KK.store.markSeen(id, 'psy'),
        actor: KK.store.psychologist().id, hints: false });
    },
  };
  KK.psychApp = app;
})(typeof window !== 'undefined' ? window : globalThis);
