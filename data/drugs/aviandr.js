(function (g) {
  const SRC = 'Инструкция по медицинскому применению «Авиандр», ЛП-№(002445)-(РГ-RU) от 31.05.2023';
  g.KK.data.drugs.aviandr = {
    id: 'aviandr',
    name: 'Авиандр',
    inn: 'маритупирдин',
    form: 'таблетки, покрытые плёночной оболочкой, 20 мг',
    regNumber: 'ЛП-№(002445)-(РГ-RU)',
    rx: true,
    additionalMonitoring: true,
    dosing: { dose: '20 мг', timesPerDay: 2, daily: '40 мг', duration: 'определяется врачом', schedule: ['утро', 'вечер'] },
    indications: [
      { codes: ['F41.1'], text: 'Генерализованное тревожное расстройство' },
      { codes: ['F43.0', 'F43.2'], requires: 'postCovid',
        text: 'Тревожные состояния после перенесённой COVID-19 у пациентов со стрессовой реакцией и нарушением адаптации лёгкой и средней степени' },
    ],
    // check(p) → true (есть), false (нет), null (нет данных)
    contraindications: [
      { id: 'hypersensitivity', label: 'Гиперчувствительность к маритупирдину',
        check: (p) => (p.allergies || []).some((a) => /маритупирдин|авиандр/i.test(a)) },
      { id: 'cns', label: 'Эпилепсия, органические заболевания головного мозга',
        check: (p) => (p.conditions || []).some((c) => c === 'epilepsy' || c === 'organic_brain') },
      { id: 'maoi', label: 'Приём ингибиторов МАО или менее 2 недель после их отмены',
        check: (p, has) => has('maoi') || (p.maoiStoppedDaysAgo != null && p.maoiStoppedDaysAgo < 14) },
      { id: 'renal', label: 'Почечная недостаточность средней и тяжёлой степени (СКФ < 60 мл/мин)',
        check: (p) => (p.labs?.egfr == null ? null : p.labs.egfr < 60) },
      { id: 'hepatic', label: 'Печёночная недостаточность (Child-Pugh A, B, C)',
        check: (p) => (p.labs?.childPugh == null ? null : ['A', 'B', 'C'].includes(p.labs.childPugh)) },
      { id: 'age', label: 'Возраст до 18 лет',
        check: (p) => (p.age == null ? null : p.age < 18) },
      { id: 'pregnancy', label: 'Беременность и период грудного вскармливания',
        check: (p) => {
          if (p.pregnant === true || p.lactating === true) return true;
          if (p.sex === 'm') return false;
          if (p.pregnant == null || p.lactating == null) return null;
          return false;
        } },
    ],
    cautions: [
      { id: 'cvd', label: 'Сердечно-сосудистые заболевания — с осторожностью', check: (p) => (p.conditions || []).includes('cvd') },
      { id: 'elderly', label: 'Пожилой возраст — выше чувствительность к нежелательным реакциям', check: (p) => p.age >= 65 },
    ],
    interactions: [
      { id: 'serotonin', classes: ['serotonergic'], level: 'warning',
        text: 'Серотонинергические препараты (СИОЗС, триптаны, трамадол, литий, фентанил, зверобой): риск серотонинового синдрома, применять с осторожностью' },
      { id: 'cyp2d6', classes: ['cyp2d6_inhibitor'], level: 'warning',
        text: 'Ингибиторы CYP2D6 могут повышать концентрацию маритупирдина, применять с осторожностью' },
      { id: 'sedation', classes: ['benzodiazepine', 'antipsychotic', 'barbiturate', 'h1_blocker'], level: 'warning',
        text: 'Усиление седативного действия (бензодиазепины, нейролептики, барбитураты, H1-блокаторы)' },
    ],
    adverseEvents: [
      { id: 'headache', label: 'Головная боль', freq: 'часто' },
      { id: 'dizziness', label: 'Головокружение', freq: 'часто' },
      { id: 'somnolence', label: 'Сонливость', freq: 'часто' },
      { id: 'paresthesia', label: 'Покалывание, онемение (парестезии)', freq: 'часто' },
      { id: 'asthenia', label: 'Слабость, быстрая утомляемость', freq: 'часто' },
      { id: 'appetite', label: 'Снижение аппетита', freq: 'нечасто' },
      { id: 'insomnia', label: 'Бессонница', freq: 'нечасто' },
      { id: 'anxiety_up', label: 'Усиление тревоги', freq: 'нечасто' },
      { id: 'nausea', label: 'Тошнота', freq: 'нечасто' },
      { id: 'constipation', label: 'Запор', freq: 'нечасто' },
      { id: 'sweating', label: 'Повышенная потливость', freq: 'нечасто' },
      { id: 'stiffness', label: 'Скованность в мышцах', freq: 'нечасто' },
      { id: 'backpain', label: 'Боль в спине', freq: 'нечасто' },
    ],
    patientNotes: [
      'Принимайте по 1 таблетке 2 раза в день, как назначил врач.',
      'Во время лечения откажитесь от алкоголя.',
      'Если появились сонливость или головокружение, не садитесь за руль.',
      'Не меняйте дозу и не прекращайте приём самостоятельно — обсудите это с врачом.',
    ],
    source: SRC,
  };
})(typeof window !== 'undefined' ? window : globalThis);
