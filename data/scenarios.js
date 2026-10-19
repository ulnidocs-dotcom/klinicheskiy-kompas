(function (g) {
  const KK = g.KK;
  const base = (over) => Object.assign({
    pregnant: false, lactating: false, allergies: [], conditions: [], meds: [], history: {},
    labs: { egfr: 92, childPugh: 'none' },
  }, over);
  const checkins = (fromDay, toDay, f) => {
    const out = [];
    for (let d = fromDay; d <= toDay; d++) out.push({ type: 'checkin', day: d, payload: f(d) });
    return out;
  };

  KK.data.scenarios = [
    {
      id: 's1', title: 'ГТР у терапевта', summary: 'Первичное назначение, противопоказаний нет',
      patient: base({ id: 'p_anna', name: 'Анна Соколова', initials: 'АС', age: 34, sex: 'f',
        phone: '+7 900 000-00-01', inviteCode: 'KMP-4821',
        diagnoses: [{ code: 'F41.1', text: 'Генерализованное тревожное расстройство' }],
        plan: { drugId: 'aviandr', status: 'proposed', timesPerDay: 2 } }),
      seed: [
        { type: 'scale', day: -1, payload: { scaleId: 'gad7', answers: [2, 2, 3, 2, 1, 2, 2] } },
        { type: 'scale', day: -1, payload: { scaleId: 'phq9', answers: [1, 1, 1, 1, 0, 1, 1, 0, 0] } },
        ...checkins(-6, -1, (d) => ({ mood: 3, anxiety: 2, sleep: 2 })),
      ],
    },
    {
      id: 's2', title: 'Пациент на СИОЗС', summary: 'Сертралин: риск серотонинового синдрома, CYP2D6',
      patient: base({ id: 'p_sergey', name: 'Сергей Морозов', initials: 'СМ', age: 46, sex: 'm', inviteCode: 'KMP-1937',
        diagnoses: [{ code: 'F41.1', text: 'Генерализованное тревожное расстройство' }],
        meds: [{ name: 'Сертралин 50 мг', classes: ['ssri', 'serotonergic', 'cyp2d6_inhibitor'] }],
        plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: null, confirmedDay: -20, timesPerDay: 2 } }),
      seed: [
        { type: 'doses', fromDay: -20, toDay: -1, skip: [] },
        { type: 'scale', day: -20, payload: { scaleId: 'gad7', answers: [2, 2, 2, 2, 1, 1, 2] } },
        { type: 'scale', day: -2, payload: { scaleId: 'gad7', answers: [1, 1, 2, 1, 1, 1, 1] } },
        { type: 'scale', day: -2, payload: { scaleId: 'phq9', answers: [1, 1, 1, 1, 0, 0, 1, 0, 0] } },
        ...checkins(-6, -1, () => ({ mood: 3, anxiety: 3, sleep: 3 })),
      ],
    },
    {
      id: 's3', title: 'ХБП, СКФ 52', summary: 'Противопоказание по функции почек',
      patient: base({ id: 'p_galina', name: 'Галина Петрова', initials: 'ГП', age: 63, sex: 'f', inviteCode: 'KMP-5560',
        diagnoses: [{ code: 'F41.1', text: 'Генерализованное тревожное расстройство' }, { code: 'N18.3', text: 'ХБП С3а' }],
        conditions: ['cvd'], labs: { egfr: 52, childPugh: 'none' },
        plan: { drugId: 'aviandr', status: 'proposed', timesPerDay: 2 } }),
      seed: [
        { type: 'scale', day: -3, payload: { scaleId: 'gad7', answers: [2, 2, 2, 1, 1, 1, 2] } },
        { type: 'scale', day: -3, payload: { scaleId: 'phq9', answers: [1, 1, 1, 1, 0, 0, 1, 0, 0] } },
      ],
    },
    {
      id: 's4', title: 'Тревожно-депрессивное, суицидальные мысли', summary: 'PHQ-9 = 21, вопрос 9 положительный',
      patient: base({ id: 'p_dmitry', name: 'Дмитрий Ковалёв', initials: 'ДК', age: 29, sex: 'm', inviteCode: 'KMP-7302',
        diagnoses: [{ code: 'F41.1', text: 'Генерализованное тревожное расстройство' }],
        plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: null, confirmedDay: -14, timesPerDay: 2 } }),
      seed: [
        { type: 'doses', fromDay: -14, toDay: -1, skip: [-6] },
        { type: 'scale', day: -14, payload: { scaleId: 'phq9', answers: [2, 2, 2, 2, 1, 2, 2, 1, 0] } },
        { type: 'scale', day: -14, payload: { scaleId: 'gad7', answers: [2, 2, 2, 2, 1, 2, 2] } },
        { type: 'scale', day: 0, payload: { scaleId: 'phq9', answers: [3, 3, 2, 2, 2, 3, 2, 2, 2] } },
        ...checkins(-6, -1, (d) => ({ mood: d > -3 ? 1 : 2, anxiety: 4, sleep: 1 })),
      ],
    },
    {
      id: 's5', title: 'Тревога после COVID-19', summary: 'Расстройство адаптации, положительная динамика',
      patient: base({ id: 'p_olga', name: 'Ольга Лебедева', initials: 'ОЛ', age: 41, sex: 'f', inviteCode: 'KMP-2648', postCovid: true,
        diagnoses: [{ code: 'F43.2', text: 'Расстройство адаптации' }, { code: 'U09.9', text: 'Состояние после COVID-19' }],
        plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: null, confirmedDay: -21, timesPerDay: 2 } }),
      seed: [
        { type: 'doses', fromDay: -21, toDay: -1, skip: [] },
        { type: 'scale', day: -21, payload: { scaleId: 'gad7', answers: [2, 2, 2, 2, 1, 2, 2] } },
        { type: 'scale', day: -7, payload: { scaleId: 'gad7', answers: [2, 1, 2, 1, 1, 1, 1] } },
        { type: 'scale', day: -1, payload: { scaleId: 'gad7', answers: [1, 1, 2, 1, 1, 1, 1] } },
        { type: 'scale', day: -1, payload: { scaleId: 'phq9', answers: [1, 1, 1, 1, 0, 0, 0, 0, 0] } },
        { type: 'ae', day: -15, payload: { items: [{ id: 'somnolence', label: 'Сонливость', severity: 'mild' }] } },
        ...checkins(-13, -1, (d) => ({ mood: d > -7 ? 4 : 3, anxiety: d > -7 ? 2 : 3, sleep: 3 })),
      ],
    },
  ];

  // Превращает seed сценария в события с ISO-датами; шкалы — в результаты подсчёта.
  KK.data.expandSeed = function (seed, nowIso) {
    const out = [];
    const atDay = (day, hour) => {
      const d = new Date(KK.util.shiftDays(nowIso, day));
      if (hour != null) d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    for (const s of seed) {
      if (s.type === 'doses') {
        for (let d = s.fromDay; d <= s.toDay; d++) {
          if (s.skip.includes(d)) continue;
          out.push({ type: 'dose', at: atDay(d, 9), payload: { slot: 'утро', taken: true } });
          out.push({ type: 'dose', at: atDay(d, 21), payload: { slot: 'вечер', taken: true } });
        }
      } else if (s.type === 'scale') {
        out.push({ type: 'scale', at: atDay(s.day, s.day === 0 ? null : 10), payload: KK.scales.score(s.payload.scaleId, s.payload.answers) });
      } else {
        out.push({ type: s.type, at: atDay(s.day, s.day === 0 ? null : 20), payload: s.payload });
      }
    }
    return out.sort(KK.util.byDateAsc);
  };

  // Подставляет confirmedAt из confirmedDay относительно now (вызывает хранилище при сбросе и тесты).
  KK.data.materializePatient = function (patient, nowIso) {
    const p = JSON.parse(JSON.stringify(patient));
    if (p.plan && p.plan.confirmedDay != null) {
      p.plan.confirmedAt = KK.util.shiftDays(nowIso, p.plan.confirmedDay);
      delete p.plan.confirmedDay;
    }
    return p;
  };
})(typeof window !== 'undefined' ? window : globalThis);
