// Анкеты, которые врач отправляет пациенту (спек 2026-10-22 §B). Описание — данные: версия, вопросы с типами и условиями показа.
// Типы: text — свой текст; single — один вариант (код); multi — несколько вариантов (массив кодов, exclusive снимает остальные);
// yesno — да/нет (boolean); scale — частота 0–3 (целое, PHQ-2/GAD-2); list — список строк { name, dose } (лекарства).
// when(answers, patient) — показывать ли вопрос; скрытые вопросы не сохраняются и не уходят в экспорт.
(function (g) {
  const KK = g.KK;
  const FREQ = [
    { v: 0, label: 'Ни разу' },
    { v: 1, label: 'Несколько дней' },
    { v: 2, label: 'Более половины дней' },
    { v: 3, label: 'Почти каждый день' },
  ];
  const STEM = 'Как часто за последние 2 недели вас беспокоило следующее?';
  const PHQ2 = 'Kroenke et al., 2003 (PHQ-2)';
  const GAD2 = 'Kroenke et al., 2007 (GAD-2)';

  KK.data.questionnaires = {
    previsit: {
      id: 'previsit',
      version: 1,
      // Канонический адрес описания анкеты для FHIR (заглушка до публикации Questionnaire на сервере).
      canonical: 'https://kompas.example/fhir/Questionnaire/previsit',
      title: 'Анкета перед приёмом',
      minutes: 5,
      intro: 'Несколько вопросов о самочувствии, лекарствах и здоровье. Врач посмотрит ответы перед приёмом, и на встрече останется больше времени на разговор.',
      done: 'Ответы получит ваш врач и посмотрит их перед приёмом.',
      threshold: 3, // PHQ-2 и GAD-2: сумма ≥ 3 — желательно оценить полной шкалой
      sources: { phq2: PHQ2, gad2: GAD2 },
      items: [
        { id: 'complaint', type: 'text', title: 'Что вас сейчас беспокоит больше всего?', short: 'Основная жалоба',
          hint: 'Одной-двумя фразами, своими словами.' },
        { id: 'duration', type: 'single', title: 'Как давно это началось?', short: 'Как давно',
          options: [
            { v: 'lt2w', label: 'Меньше 2 недель' },
            { v: '2w1m', label: 'От 2 недель до месяца' },
            { v: '1m6m', label: 'От 1 до 6 месяцев' },
            { v: 'gt6m', label: 'Больше полугода' },
          ] },
        { id: 'sleep', type: 'single', title: 'Как вы спите в последнее время?', short: 'Сон',
          options: [
            { v: 'usual', label: 'Как обычно' },
            { v: 'worse', label: 'Хуже: трудно уснуть или часто просыпаюсь' },
            { v: 'more', label: 'Сплю больше обычного' },
          ] },
        { id: 'appetite', type: 'single', title: 'Как ваш аппетит в последнее время?', short: 'Аппетит',
          options: [
            { v: 'usual', label: 'Как обычно' },
            { v: 'less', label: 'Меньше обычного' },
            { v: 'more', label: 'Больше обычного' },
          ] },
        // PHQ-2 — первые два вопроса PHQ-9, GAD-2 — первые два вопроса GAD-7 (те же формулировки, что в data/scales.js).
        { id: 'phq2_1', type: 'scale', group: 'phq2', stem: STEM, options: FREQ, short: 'PHQ-2: интерес и удовольствие',
          title: 'Вам не хотелось ничего делать, занятия не приносили интереса или удовольствия' },
        { id: 'phq2_2', type: 'scale', group: 'phq2', stem: STEM, options: FREQ, short: 'PHQ-2: настроение',
          title: 'У вас было плохое настроение, вы были подавлены или испытывали чувство безысходности' },
        { id: 'gad2_1', type: 'scale', group: 'gad2', stem: STEM, options: FREQ, short: 'GAD-2: тревога',
          title: 'Вы нервничали, тревожились или были на грани срыва' },
        { id: 'gad2_2', type: 'scale', group: 'gad2', stem: STEM, options: FREQ, short: 'GAD-2: контроль беспокойства',
          title: 'Вы не могли остановить или контролировать беспокойство' },
        // «Да» — сразу экран помощи и критический сигнал врачу (правило previsit_selfharm).
        { id: 'selfHarm', type: 'yesno', urgent: true, short: 'Мысли о смерти или самоповреждении за 2 недели',
          title: 'За последние 2 недели бывали ли у вас мысли, что лучше было бы умереть, или мысли причинить себе вред?',
          hint: 'Этот вопрос мы задаём всем. Отвечайте так, как есть, — это помогает вовремя предложить поддержку.' },
        { id: 'meds', type: 'list', optional: true, max: 10, short: 'Принимаемые лекарства',
          title: 'Какие лекарства вы сейчас принимаете?',
          hint: 'Название и доза, если помните. Если ничего не принимаете, нажмите «Дальше».',
          fields: [{ id: 'name', label: 'Название' }, { id: 'dose', label: 'Доза и как принимаете' }] },
        { id: 'allergy', type: 'yesno', title: 'Была ли у вас аллергия на какие-либо лекарства?', short: 'Аллергия на лекарства' },
        { id: 'allergyText', type: 'text', optional: true, when: (a) => a.allergy === true, short: 'На какие лекарства',
          title: 'На какие лекарства была аллергия?', hint: 'Через запятую. Можно пропустить, если не помните названия.' },
        { id: 'chronic', type: 'multi', exclusive: 'none', title: 'Есть ли у вас хронические заболевания?', short: 'Хронические заболевания',
          hint: 'Отметьте всё, что подходит.',
          options: [
            { v: 'epilepsy', label: 'Эпилепсия или судороги', condition: 'epilepsy' },
            { v: 'cvd', label: 'Болезни сердца или повышенное давление', condition: 'cvd' },
            { v: 'diabetes', label: 'Сахарный диабет' },
            { v: 'kidney', label: 'Болезни почек' },
            { v: 'liver', label: 'Болезни печени' },
            { v: 'thyroid', label: 'Болезни щитовидной железы' },
            { v: 'other', label: 'Другое' },
            { v: 'none', label: 'Нет хронических заболеваний' },
          ] },
        { id: 'chronicOther', type: 'text', optional: true, when: (a) => Array.isArray(a.chronic) && a.chronic.includes('other'),
          title: 'Какие ещё заболевания?', short: 'Другие заболевания', hint: 'Своими словами, можно коротко.' },
        { id: 'pregnancy', type: 'single', when: (a, p) => !!p && p.sex === 'f', short: 'Беременность, кормление',
          title: 'Вы сейчас беременны или кормите грудью?',
          options: [
            { v: 'no', label: 'Нет' },
            { v: 'pregnant', label: 'Беременна' },
            { v: 'maybe', label: 'Возможно, беременна' },
            { v: 'lactating', label: 'Кормлю грудью' },
          ] },
        { id: 'alcohol', type: 'single', title: 'Как часто вы пьёте алкоголь?', short: 'Алкоголь',
          options: [
            { v: 'never', label: 'Не пью' },
            { v: 'rare', label: 'Реже раза в неделю' },
            { v: 'weekly', label: '1–3 раза в неделю' },
            { v: 'daily', label: 'Почти каждый день' },
          ] },
        { id: 'priorCare', type: 'yesno', title: 'Лечились ли вы раньше у психиатра или психотерапевта?', short: 'Лечение у психиатра или психотерапевта раньше' },
      ],
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
