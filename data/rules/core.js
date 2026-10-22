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
  // Дата для блока «Почему»: правила работают и в Node-тестах, поэтому без KK.ui.
  const d = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '—');
  const sc = (r, name) => `${name} от ${d(r.at)}: ${r.total}`;
  const STALE_DAYS = 30;
  // Чего не хватает для уверенного вывода по шкале: давний замер — повод переоценить, а не опираться на него.
  const staleScale = (c, id, name) => {
    const r = c.latest(id);
    return r && new Date(c.now) - new Date(r.at) > STALE_DAYS * 864e5 ? [`${name} старше ${STALE_DAYS} дней — нужна переоценка`] : [];
  };
  // Анкета до приёма: ответы на текущую отправку (события previsit после sentAt). Правила не зависят от assets/questionnaire.js —
  // они считаются на каждой странице, где есть стор; подсчёт PHQ-2/GAD-2 тот же (сверяется в tests/previsit.test.js).
  const PREVISIT_SRC = 'Kroenke et al., 2003 (PHQ-2); Kroenke et al., 2007 (GAD-2)';
  const previsits = (c) => {
    const from = c.patient.previsit?.sentAt;
    return c.events.filter((e) => e.type === 'previsit' && e.payload && typeof e.payload.answers === 'object' && e.payload.answers && (!from || e.at >= from));
  };
  const selfHarmYes = (c) => previsits(c).filter((e) => e.payload.answers.selfHarm === true);
  const n03 = (v) => (Number.isInteger(v) && v >= 0 && v <= 3 ? v : 0);
  // { at, phq2, gad2, needPhq9, needGad7 } по последнему ответу; полная шкала после анкеты снимает напоминание.
  const previsitScreen = (c) => {
    const e = previsits(c).at(-1);
    if (!e) return null;
    const a = e.payload.answers;
    const phq2 = n03(a.phq2_1) + n03(a.phq2_2), gad2 = n03(a.gad2_1) + n03(a.gad2_2);
    const after = (id) => (c.scales[id] || []).some((r) => r.context !== 'intake' && r.at >= e.at);
    return { at: e.at, phq2, gad2, needPhq9: phq2 >= 3 && !after('phq9'), needGad7: gad2 >= 3 && !after('gad7') };
  };
  const unknownCi = (c) => (c.therapy ? c.therapy.contraindications.filter((x) => x.status === 'unknown').map((x) => `нет данных: ${x.label}`) : []);

  // Версия набора правил: попадает в каждый сигнал и алерт, чтобы решение можно было восстановить по журналу.
  g.KK.data.rulesVersion = { id: '2026.10.1', date: '2026-10-19' };

  g.KK.data.rules = [
    { id: 'si_phq9', level: 'critical', routing: 'required', teamRule: false, source: `${KR_DEP}; ${PHQ}`,
      title: 'Суицидальные мысли (PHQ-9, вопрос 9)',
      when: (c) => (item9(c.latest('phq9')) ?? 0) > 0,
      basis: (c) => c.latest('phq9')?.at,
      inputs: (c) => [`${sc(c.latest('phq9'), 'PHQ-9')}, вопрос 9 = ${item9(c.latest('phq9'))} из 3`],
      missing: (c) => (c.scales.cssrs.some((r) => r.context !== 'intake' && r.at >= c.latest('phq9').at) ? [] : ['C-SSRS после этого PHQ-9 не проведена']),
      text: (c) => `Ответ на вопрос 9 — ${item9(c.latest('phq9'))} из 3. Требуется оценка суицидального риска (C-SSRS) и консультация психиатра.` },
    { id: 'cssrs_risk', level: 'critical', routing: 'required', teamRule: false, source: 'Posner et al., 2011 (C-SSRS)',
      title: 'Суицидальный риск по C-SSRS',
      // Максимум из оценки врача и самоотчёта первичного приёма (≤ 30 дней): самоотчёт не понижает риск.
      when: (c) => ['moderate', 'high'].includes(c.cssrsRisk()?.band?.code),
      basis: (c) => c.cssrsRisk()?.at,
      origin: (c) => c.cssrsRisk()?.origin,
      inputs: (c) => [`C-SSRS от ${d(c.cssrsRisk().at)}: ${c.cssrsRisk().band.doctorLabel}`, c.cssrsRisk().origin === 'intake' ? 'источник: самоотчёт пациента (первичный приём)' : 'источник: оценка врача'],
      missing: (c) => (c.cssrsRisk().origin === 'intake' && !c.cssrsRisk().clinician ? ['оценка C-SSRS врачом не проводилась'] : []),
      text: (c) => `${c.cssrsRisk().band.doctorLabel}${c.cssrsRisk().origin === 'intake' ? ' (самоотчёт пациента, первичный приём психолога)' : ''}. Экстренная консультация психиатра.` },
    { id: 'sos', level: 'critical', routing: null, teamRule: true, source: 'Правило команды',
      title: 'Пациент нажал «Мне сейчас очень плохо»',
      when: (c) => c.events.some((e) => e.type === 'sos' && within(c, e.at, 24)),
      basis: (c) => c.events.filter((e) => e.type === 'sos' && within(c, e.at, 24)).at(-1)?.at,
      inputs: (c) => [`нажатие кнопки — ${d(c.events.filter((e) => e.type === 'sos').at(-1).at)}`],
      text: () => 'Пациенту показаны контакты экстренной помощи. Свяжитесь с пациентом.' },
    // Основание — первый ответ «да» по текущей анкете: черновой ответ и итоговая отправка не поднимают алерт дважды.
    { id: 'previsit_selfharm', level: 'critical', routing: 'required', teamRule: true, source: 'Правило команды',
      title: 'Мысли о самоповреждении (анкета до приёма)',
      when: (c) => selfHarmYes(c).length > 0,
      basis: (c) => selfHarmYes(c)[0]?.at,
      inputs: (c) => [`анкета до приёма от ${d(selfHarmYes(c)[0].at)}: мысли о смерти или самоповреждении за 2 недели — «да»`],
      missing: (c) => (c.scales.cssrs.some((r) => r.context !== 'intake' && r.at >= selfHarmYes(c)[0].at) ? [] : ['C-SSRS после анкеты не проведена']),
      text: () => 'Пациент ответил «да» на вопрос о мыслях о смерти или самоповреждении за последние 2 недели. Пациенту показаны контакты экстренной помощи. Свяжитесь с пациентом, оцените суицидальный риск (C-SSRS).' },
    { id: 'ae_severe', level: 'critical', routing: null, teamRule: true, source: `${LABEL}; правило команды`,
      title: 'Выраженное нежелательное явление',
      when: (c) => c.events.some((e) => e.type === 'ae' && within(c, e.at, 72) && e.payload.items.some((i) => i.severity === 'severe')),
      basis: (c) => c.events.filter((e) => e.type === 'ae' && within(c, e.at, 72) && e.payload.items.some((i) => i.severity === 'severe')).at(-1)?.at,
      inputs: (c) => [`отметка пациента от ${d(c.events.filter((e) => e.type === 'ae' && e.payload.items.some((i) => i.severity === 'severe')).at(-1).at)}`],
      text: (c) => {
        const e = [...c.events].reverse().find((x) => x.type === 'ae' && x.payload.items.some((i) => i.severity === 'severe'));
        const names = e.payload.items.filter((i) => i.severity === 'severe').map((i) => i.label || i.id).join(', ');
        return `Пациент отметил «сильно»: ${names}. Препарат под дополнительным мониторингом — оцените и при необходимости оформите извещение о НР.`;
      } },
    { id: 'phq9_severe', level: 'important', routing: 'required', teamRule: true, source: `${KR_DEP}; ${PHQ}`,
      title: 'Тяжёлая депрессивная симптоматика',
      when: (c) => (c.latest('phq9')?.total ?? 0) >= 20,
      basis: (c) => c.latest('phq9')?.at,
      inputs: (c) => [sc(c.latest('phq9'), 'PHQ-9'), 'порог правила: ≥ 20'],
      missing: (c) => staleScale(c, 'phq9', 'PHQ-9'),
      text: (c) => `PHQ-9 = ${c.latest('phq9').total} (≥ 20).` },
    { id: 'psychiatric_history', level: 'important', routing: 'required', teamRule: true, source: KR_DEP,
      title: 'Психотические симптомы или подозрение на биполярное расстройство',
      when: (c) => !!(c.patient.history?.psychotic || c.patient.history?.bipolar),
      inputs: (c) => [c.patient.history?.bipolar ? 'анамнез: признаки биполярного расстройства' : 'анамнез: психотические симптомы'],
      text: (c) => (c.patient.history?.bipolar ? 'В анамнезе признаки биполярного расстройства.' : 'В анамнезе психотические симптомы.') },
    { id: 'no_response', level: 'important', routing: 'required', teamRule: true, source: KR_GAD,
      title: 'Нет ответа на терапию',
      when: (c) => {
        const first = c.firstAfterStart('gad7'); const last = c.latest('gad7');
        return c.daysOnTherapy >= 56 && first && last && first !== last && last.total > first.total * 0.75;
      },
      basis: (c) => c.latest('gad7')?.at,
      inputs: (c) => [`${sc(c.firstAfterStart('gad7'), 'GAD-7')} (первый замер на терапии)`, sc(c.latest('gad7'), 'GAD-7'), `дней терапии: ${c.daysOnTherapy}`, 'порог правила: ≥ 56 дней и снижение < 25%'],
      text: (c) => `GAD-7: ${c.firstAfterStart('gad7').total} → ${c.latest('gad7').total} за ${c.daysOnTherapy} дн. терапии (снижение < 25%).` },
    { id: 'worsening', level: 'important', routing: null, teamRule: true, source: `${PHQ}; ${GAD7}`,
      title: 'Ухудшение по шкалам',
      when: (c) => ['phq9', 'gad7'].some((id) => c.latest(id) && c.previous(id) && c.latest(id).total - c.previous(id).total >= 5),
      basis: (c) => ['phq9', 'gad7'].map((id) => c.latest(id)?.at).filter(Boolean).sort().at(-1),
      inputs: (c) => ['phq9', 'gad7'].filter((id) => c.latest(id) && c.previous(id)).flatMap((id) => [sc(c.previous(id), id === 'phq9' ? 'PHQ-9' : 'GAD-7'), sc(c.latest(id), id === 'phq9' ? 'PHQ-9' : 'GAD-7')]).concat('порог правила: рост ≥ 5 баллов'),
      text: (c) => ['phq9', 'gad7'].filter((id) => c.latest(id) && c.previous(id) && c.latest(id).total - c.previous(id).total >= 5)
        .map((id) => `${id === 'phq9' ? 'PHQ-9' : 'GAD-7'}: ${c.previous(id).total} → ${c.latest(id).total}`).join('; ') },
    { id: 'missed_doses', level: 'task', routing: null, teamRule: true, source: 'Правило команды',
      title: 'Пропуск приёма препарата',
      when: (c) => c.missedStreak >= 3,
      // Серия пропусков идентифицируется последним принятым приёмом перед ней.
      basis: (c) => c.events.filter((e) => e.type === 'dose' && e.payload?.taken).at(-1)?.at || c.patient.plan?.confirmedAt,
      inputs: (c) => [`последняя отметка о приёме: ${d(c.events.filter((e) => e.type === 'dose' && e.payload?.taken).at(-1)?.at)}`, `дней без отметок: ${c.missedStreak}`, 'порог правила: ≥ 3 дней'],
      missing: () => ['причина пропусков неизвестна: пациент мог принимать препарат, но не отмечать'],
      text: (c) => `Нет отметок о приёме ${c.missedStreak} дн. подряд.` },
    { id: 'contraindication', level: 'important', routing: null, teamRule: false, source: LABEL,
      title: 'Противопоказание к назначенному препарату',
      when: (c) => c.therapy?.eligible === false,
      inputs: (c) => c.therapy.contraindications.filter((x) => x.status === 'present').map((x) => `есть: ${x.label}`),
      missing: unknownCi,
      text: (c) => c.therapy.contraindications.filter((x) => x.status === 'present').map((x) => x.label).join('; ') },
    { id: 'gad7_persistent', level: 'task', routing: 'desirable', teamRule: true, source: KR_GAD,
      title: 'Выраженная тревога сохраняется на фоне терапии',
      when: (c) => {
        const first = c.firstAfterStart('gad7'); const last = c.latest('gad7');
        return c.daysOnTherapy >= 28 && !!first && !!last && last.total >= 15 && last.total >= first.total;
      },
      basis: (c) => c.latest('gad7')?.at,
      inputs: (c) => [`${sc(c.firstAfterStart('gad7'), 'GAD-7')} (первый замер на терапии)`, sc(c.latest('gad7'), 'GAD-7'), `дней терапии: ${c.daysOnTherapy}`, 'порог правила: ≥ 15 и без снижения через ≥ 28 дней'],
      text: (c) => `GAD-7 = ${c.latest('gad7').total} (≥ 15) через ${c.daysOnTherapy} дн. терапии, без снижения (исходно ${c.firstAfterStart('gad7').total}).` },
    { id: 'phq9_modsevere', level: 'info', routing: 'desirable', teamRule: true, source: `${KR_DEP}; ${PHQ}`,
      title: 'Умеренно тяжёлая депрессивная симптоматика',
      when: (c) => { const t = c.latest('phq9')?.total ?? 0; return t >= 15 && t <= 19; },
      inputs: (c) => [sc(c.latest('phq9'), 'PHQ-9'), 'порог правила: 15–19'],
      missing: (c) => staleScale(c, 'phq9', 'PHQ-9'),
      text: (c) => `PHQ-9 = ${c.latest('phq9').total} (15–19).` },
    { id: 'comorbid', level: 'info', routing: 'desirable', teamRule: true, source: `${KR_GAD}; ${KR_DEP}`,
      title: 'Сочетание тревожной и депрессивной симптоматики',
      when: (c) => (c.latest('phq9')?.total ?? 0) >= 10 && (c.latest('gad7')?.total ?? 0) >= 10,
      inputs: (c) => [sc(c.latest('phq9'), 'PHQ-9'), sc(c.latest('gad7'), 'GAD-7'), 'порог правила: оба ≥ 10'],
      missing: (c) => [...staleScale(c, 'phq9', 'PHQ-9'), ...staleScale(c, 'gad7', 'GAD-7')],
      text: (c) => `PHQ-9 = ${c.latest('phq9').total}, GAD-7 = ${c.latest('gad7').total}.` },
    { id: 'previsit_screen', level: 'info', routing: null, teamRule: false, source: PREVISIT_SRC,
      title: 'PHQ-2 или GAD-2 ≥ 3 — оцените полной шкалой',
      when: (c) => { const s = previsitScreen(c); return !!s && (s.needPhq9 || s.needGad7); },
      basis: (c) => previsitScreen(c)?.at,
      inputs: (c) => { const s = previsitScreen(c); return [`анкета до приёма от ${d(s.at)}: PHQ-2 = ${s.phq2}, GAD-2 = ${s.gad2}`, 'порог правила: ≥ 3 из 6']; },
      text: (c) => {
        const s = previsitScreen(c);
        return [s.needPhq9 ? `PHQ-2 = ${s.phq2} (≥ 3) — оцените полной шкалой PHQ-9` : '', s.needGad7 ? `GAD-2 = ${s.gad2} (≥ 3) — оцените полной шкалой GAD-7` : '']
          .filter(Boolean).join('; ') + '.';
      } },
    { id: 'recurrent', level: 'info', routing: 'desirable', teamRule: true, source: KR_DEP,
      title: 'Рекуррентное депрессивное расстройство',
      when: (c) => (c.patient.diagnoses || []).some((d) => d.code.startsWith('F33')),
      inputs: (c) => c.patient.diagnoses.filter((x) => x.code.startsWith('F33')).map((x) => `диагноз в карте: ${x.code}`),
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
      inputs: (c) => c.therapy.interactions.map((i) => `текущие препараты: ${i.drugs.join(', ')}`),
      text: (c) => c.therapy.interactions.map((i) => `${i.drugs.join(', ')} — ${i.text}`).join('; ') },
    { id: 'unknown_data', level: 'info', routing: null, teamRule: true, source: LABEL,
      title: 'Недостаточно данных для проверки противопоказаний',
      when: (c) => c.therapy?.eligible === null,
      missing: unknownCi,
      text: (c) => `Нет данных: ${c.therapy.contraindications.filter((x) => x.status === 'unknown').map((x) => x.label).join('; ')}.` },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
