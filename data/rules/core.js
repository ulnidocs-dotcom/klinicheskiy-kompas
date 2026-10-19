(function (g) {
  const KR_GAD = 'КР «Генерализованное тревожное расстройство», РОП, 2024 (ID 457)';
  const KR_DEP = 'КР «Депрессивный эпизод, рекуррентное депрессивное расстройство», РОП, 2024 (ID 301)';
  const PHQ = 'Kroenke et al., 2001 (PHQ-9)';
  const GAD7 = 'Spitzer et al., 2006 (GAD-7)';
  const LABEL = 'Инструкция «Авиандр», ЛП-№(002445)-(РГ-RU)';
  const within = (ctx, iso, hours) => new Date(ctx.now) - new Date(iso) <= hours * 3600000;
  // Ответ на вопрос 9 PHQ-9: из flags, а если их нет (старые/внешние данные) — из answers[8].
  const item9 = (r) => (r ? r.flags?.item9 ?? r.answers?.[8] ?? null : null);
  const recentAe = (c, days) => c.events.filter((e) => e.type === 'ae' && within(c, e.at, days * 24));
  const isMildAe = (e) => (e.payload?.items || []).length > 0 && e.payload.items.every((i) => i.severity === 'mild' || i.severity === 'moderate');
  const SEV = { mild: 'слабо', moderate: 'умеренно' };

  g.KK.data.rules = [
    { id: 'si_phq9', level: 'critical', routing: 'required', teamRule: false, source: `${KR_DEP}; ${PHQ}`,
      title: 'Суицидальные мысли (PHQ-9, вопрос 9)',
      when: (c) => (item9(c.latest('phq9')) ?? 0) > 0,
      basis: (c) => c.latest('phq9')?.at,
      text: (c) => `Ответ на вопрос 9 — ${item9(c.latest('phq9'))} из 3. Требуется оценка суицидального риска (C-SSRS) и консультация психиатра.` },
    { id: 'cssrs_risk', level: 'critical', routing: 'required', teamRule: false, source: 'Posner et al., 2011 (C-SSRS)',
      title: 'Суицидальный риск по C-SSRS',
      when: (c) => ['moderate', 'high'].includes(c.latest('cssrs')?.band?.code),
      basis: (c) => c.latest('cssrs')?.at,
      text: (c) => `${c.latest('cssrs').band.doctorLabel}. Экстренная консультация психиатра.` },
    { id: 'sos', level: 'critical', routing: null, teamRule: true, source: 'Правило команды',
      title: 'Пациент нажал «Мне сейчас очень плохо»',
      when: (c) => c.events.some((e) => e.type === 'sos' && within(c, e.at, 24)),
      basis: (c) => c.events.filter((e) => e.type === 'sos' && within(c, e.at, 24)).at(-1)?.at,
      text: () => 'Пациенту показаны контакты экстренной помощи. Свяжитесь с пациентом.' },
    { id: 'ae_severe', level: 'critical', routing: null, teamRule: true, source: `${LABEL}; правило команды`,
      title: 'Выраженное нежелательное явление',
      when: (c) => c.events.some((e) => e.type === 'ae' && within(c, e.at, 72) && e.payload.items.some((i) => i.severity === 'severe')),
      basis: (c) => c.events.filter((e) => e.type === 'ae' && within(c, e.at, 72) && e.payload.items.some((i) => i.severity === 'severe')).at(-1)?.at,
      text: (c) => {
        const e = [...c.events].reverse().find((x) => x.type === 'ae' && x.payload.items.some((i) => i.severity === 'severe'));
        const names = e.payload.items.filter((i) => i.severity === 'severe').map((i) => i.label || i.id).join(', ');
        return `Пациент отметил «сильно»: ${names}. Препарат под дополнительным мониторингом — оцените и при необходимости оформите извещение о НР.`;
      } },
    { id: 'phq9_severe', level: 'important', routing: 'required', teamRule: true, source: `${KR_DEP}; ${PHQ}`,
      title: 'Тяжёлая депрессивная симптоматика',
      when: (c) => (c.latest('phq9')?.total ?? 0) >= 20,
      basis: (c) => c.latest('phq9')?.at,
      text: (c) => `PHQ-9 = ${c.latest('phq9').total} (≥ 20).` },
    { id: 'psychiatric_history', level: 'important', routing: 'required', teamRule: true, source: KR_DEP,
      title: 'Психотические симптомы или подозрение на биполярное расстройство',
      when: (c) => !!(c.patient.history?.psychotic || c.patient.history?.bipolar),
      text: (c) => (c.patient.history?.bipolar ? 'В анамнезе признаки биполярного расстройства.' : 'В анамнезе психотические симптомы.') },
    { id: 'no_response', level: 'important', routing: 'required', teamRule: true, source: KR_GAD,
      title: 'Нет ответа на терапию',
      when: (c) => {
        const first = c.firstAfterStart('gad7'); const last = c.latest('gad7');
        return c.daysOnTherapy >= 56 && first && last && first !== last && last.total > first.total * 0.75;
      },
      basis: (c) => c.latest('gad7')?.at,
      text: (c) => `GAD-7: ${c.firstAfterStart('gad7').total} → ${c.latest('gad7').total} за ${c.daysOnTherapy} дн. терапии (снижение < 25%).` },
    { id: 'worsening', level: 'important', routing: null, teamRule: true, source: `${PHQ}; ${GAD7}`,
      title: 'Ухудшение по шкалам',
      when: (c) => ['phq9', 'gad7'].some((id) => c.latest(id) && c.previous(id) && c.latest(id).total - c.previous(id).total >= 5),
      basis: (c) => ['phq9', 'gad7'].map((id) => c.latest(id)?.at).filter(Boolean).sort().at(-1),
      text: (c) => ['phq9', 'gad7'].filter((id) => c.latest(id) && c.previous(id) && c.latest(id).total - c.previous(id).total >= 5)
        .map((id) => `${id === 'phq9' ? 'PHQ-9' : 'GAD-7'}: ${c.previous(id).total} → ${c.latest(id).total}`).join('; ') },
    { id: 'missed_doses', level: 'important', routing: null, teamRule: true, source: 'Правило команды',
      title: 'Пропуск приёма препарата',
      when: (c) => c.missedStreak >= 3,
      // Серия пропусков идентифицируется последним принятым приёмом перед ней.
      basis: (c) => c.events.filter((e) => e.type === 'dose' && e.payload?.taken).at(-1)?.at || c.patient.plan?.confirmedAt,
      text: (c) => `Нет отметок о приёме ${c.missedStreak} дн. подряд.` },
    { id: 'contraindication', level: 'important', routing: null, teamRule: false, source: LABEL,
      title: 'Противопоказание к назначенному препарату',
      when: (c) => c.therapy?.eligible === false,
      text: (c) => c.therapy.contraindications.filter((x) => x.status === 'present').map((x) => x.label).join('; ') },
    { id: 'gad7_persistent', level: 'info', routing: 'desirable', teamRule: true, source: KR_GAD,
      title: 'Выраженная тревога сохраняется на фоне терапии',
      when: (c) => {
        const first = c.firstAfterStart('gad7'); const last = c.latest('gad7');
        return c.daysOnTherapy >= 28 && !!first && !!last && last.total >= 15 && last.total >= first.total;
      },
      basis: (c) => c.latest('gad7')?.at,
      text: (c) => `GAD-7 = ${c.latest('gad7').total} (≥ 15) через ${c.daysOnTherapy} дн. терапии, без снижения (исходно ${c.firstAfterStart('gad7').total}).` },
    { id: 'phq9_modsevere', level: 'info', routing: 'desirable', teamRule: true, source: `${KR_DEP}; ${PHQ}`,
      title: 'Умеренно тяжёлая депрессивная симптоматика',
      when: (c) => { const t = c.latest('phq9')?.total ?? 0; return t >= 15 && t <= 19; },
      text: (c) => `PHQ-9 = ${c.latest('phq9').total} (15–19).` },
    { id: 'comorbid', level: 'info', routing: 'desirable', teamRule: true, source: `${KR_GAD}; ${KR_DEP}`,
      title: 'Сочетание тревожной и депрессивной симптоматики',
      when: (c) => (c.latest('phq9')?.total ?? 0) >= 10 && (c.latest('gad7')?.total ?? 0) >= 10,
      text: (c) => `PHQ-9 = ${c.latest('phq9').total}, GAD-7 = ${c.latest('gad7').total}.` },
    { id: 'recurrent', level: 'info', routing: 'desirable', teamRule: true, source: KR_DEP,
      title: 'Рекуррентное депрессивное расстройство',
      when: (c) => (c.patient.diagnoses || []).some((d) => d.code.startsWith('F33')),
      text: () => 'Повторные депрессивные эпизоды в анамнезе.' },
    { id: 'ae_mild', level: 'info', routing: null, teamRule: true, source: LABEL,
      title: 'Нежелательное явление лёгкой или умеренной выраженности',
      when: (c) => recentAe(c, 7).some(isMildAe),
      basis: (c) => recentAe(c, 7).filter(isMildAe).at(-1)?.at,
      text: (c) => {
        const items = recentAe(c, 7).filter(isMildAe).flatMap((e) => e.payload.items);
        return `За 7 дней: ${items.map((i) => `${i.label || i.id} (${SEV[i.severity]})`).join(', ')}. Оцените связь с препаратом.`;
      } },
    { id: 'interaction', level: 'info', routing: null, teamRule: false, source: LABEL,
      title: 'Лекарственное взаимодействие',
      when: (c) => (c.therapy?.interactions.length ?? 0) > 0,
      text: (c) => c.therapy.interactions.map((i) => `${i.drugs.join(', ')} — ${i.text}`).join('; ') },
    { id: 'unknown_data', level: 'info', routing: null, teamRule: true, source: LABEL,
      title: 'Недостаточно данных для проверки противопоказаний',
      when: (c) => c.therapy?.eligible === null,
      text: (c) => `Нет данных: ${c.therapy.contraindications.filter((x) => x.status === 'unknown').map((x) => x.label).join('; ')}.` },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
