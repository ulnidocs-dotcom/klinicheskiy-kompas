// Ассистент с частыми вопросами в чате пациента (спек 2026-10-22 §C). Чистые функции, без DOM и стора.
// Порядок проверок: 1) кризис — без FAQ, экран помощи и SOS; 2) изменение лечения — «Не меняйте схему сами» и вопрос врачу;
// 3) ответ из базы KK.data.faq с источником; 4) не нашёл — вопрос врачу.
(function (g) {
  const KK = g.KK = g.KK || {};

  const TEXT = {
    label: 'Ассистент, не врач. Отвечает на частые вопросы по проверенным материалам.',
    hello: 'Здравствуйте. Выберите тему или напишите вопрос своими словами. Если ответа нет в материалах, я передам вопрос врачу.',
    crisis: 'Вы не одни, и хорошо, что вы об этом написали. Сейчас откроется экран помощи: там телефон 112 и линии поддержки, там же видно, получил ли врач сигнал.',
    treatment: 'Не меняйте схему сами. Передал вопрос врачу, он ответит в рабочее время.',
    unknown: 'Не нашёл ответа в проверенных материалах. Передал вопрос врачу, он ответит в рабочее время.',
    forwarded: 'Передал вопрос врачу, он ответит в рабочее время.',
    pending: 'Вопрос ждёт отправки и уйдёт врачу, когда появится связь.',
    notHelped: 'Не помогло — спросить врача',
  };

  // Короткие слова и служебные слова не участвуют в подборе.
  const STOP = new Set(['как', 'что', 'мне', 'меня', 'мой', 'моя', 'мои', 'можно', 'ли', 'это', 'если', 'или', 'для', 'при', 'у', 'я', 'и', 'в', 'во',
    'на', 'с', 'со', 'не', 'а', 'но', 'по', 'же', 'бы', 'то', 'да', 'так', 'все', 'уже', 'еще', 'очень', 'ли', 'о', 'об', 'от', 'до', 'из', 'за', 'к',
    'ко', 'он', 'она', 'они', 'ним', 'нем', 'его', 'ее', 'вы', 'вас', 'вам', 'ты', 'есть', 'был', 'была', 'было', 'будет', 'нужно', 'надо', 'могу',
    'хочу', 'какие', 'какой', 'какая', 'где', 'чем', 'чего', 'этом', 'этот', 'эта', 'тоже', 'просто', 'сейчас', 'сегодня', 'день', 'делать', 'стоит', 'ли']);

  function normalize(text) {
    return String(text == null ? '' : text).toLowerCase().replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const stem = (w) => (w.length >= 4 ? w.slice(0, 5) : w);
  function stems(text) {
    return normalize(text).split(' ').filter((w) => w && !STOP.has(w)).map(stem);
  }

  // Кризис: фразы о самоповреждении и суициде. Проверяется по нормализованному тексту, в начале и в конце — пробел.
  const CRISIS = [
    /суицид/, /самоубий/, /самоповрежд/, /покончи(ть|т|л|м)? (с собой|с жизнью)/, /покончу/, /свести сч[её]ты/,
    /(не хочу|не хочется|нет сил|незачем|не за чем) жить/, /жить (не хочу|не хочется|незачем|больше не могу)/, /(нет|не вижу) смысла (жить|в жизни)/,
    /смысла жить нет/, /(хочу|хочется|лучше бы|лучше) умереть/, /лучше бы меня не было/, /(уйти|уйду) из жизни/,
    /(убить|убью|убила|убил) себя/, /(режу|резать|порезать|порежу|порезала|порезал) себя/, /(навредить|наврежу|причинить вред|причиню вред) себе/,
    /причинить себе (вред|боль)/, /(выпить|выпью|наглотаться|наглотаюсь|принять|приму) вс[ея] таблетки/, /наглотат|наглотаю/,
    /(спрыгнуть|прыгнуть|выпрыгнуть) (с|из) (крыши|окна|моста|балкона)/, / повеситься | повешусь /,
  ];
  function isCrisis(text) {
    const t = ` ${normalize(text)} `;
    return CRISIS.some((re) => re.test(t));
  }

  // Изменение лечения: действие со схемой рядом со словом о лекарстве; алкоголь — отдельно (совмещение с лечением).
  const CHANGE_ACTION = /удво|двойн|две таблетки|2 таблетки|две сразу|лишнюю|еще одну таблетку|увелич|уменьш|снизить|снижу|повысить|повышу|половин|пол таблетки|друг(ую|ая|ой) доз|смени|поменя|замени|отмен|брос|прекрат|перестать|перестану|перестал|(не буду|не хочу|не стану) (пить|принимать)|пропуст|пропущ|забыл|забыла|реже|чаще/;
  const CHANGE_CONTEXT = /таблет|лекарств|препарат|доз|авиандр|маритупирдин|лечени|схем|курс|(^| )пить( |$)|принимать|принять|выпить/;
  const ALCOHOL = /алкогол|спиртн|спиртосодерж|(^| )(вино|вина|вином|пиво|пива|пивом|водка|водки|водку|коньяк|коньяка|шампанск)/;
  function isTreatmentChange(text) {
    const t = normalize(text);
    if (ALCOHOL.test(t)) return 'alcohol';
    return CHANGE_ACTION.test(t) && CHANGE_CONTEXT.test(t) ? 'change' : null;
  }

  const base = (ctx) => (ctx && ctx.faq) || (KK.data && KK.data.faq ? KK.data.faq.entries : []);
  const entryStems = new WeakMap();
  function keyStems(e) {
    if (!entryStems.has(e)) entryStems.set(e, new Set(e.keywords.flatMap(stems)));
    return entryStems.get(e);
  }
  // Лучшее совпадение: число основ вопроса, найденных среди основ ключевых слов статьи.
  // Порог: две основы, или одна — если в вопросе всего одна-две значимые основы («побочка», «плохо сплю»).
  function match(text, ctx) {
    const q = [...new Set(stems(text))];
    if (!q.length) return null;
    let best = null, score = 0;
    for (const e of base(ctx)) {
      const ks = keyStems(e);
      const s = q.filter((x) => ks.has(x)).length;
      if (s > score) { best = e; score = s; }
    }
    return score >= 2 || (score >= 1 && q.length <= 2) ? best : null;
  }

  function byId(id, ctx) { return base(ctx).find((e) => e.id === id) || null; }
  function topicEntries(topic, ctx) { return base(ctx).filter((e) => e.topic === topic); }
  const sourceText = (e) => (e && e.source ? e.source.title : '');

  function answer(text, ctx) {
    if (isCrisis(text)) return { kind: 'crisis', reply: TEXT.crisis, forward: false };
    const change = isTreatmentChange(text);
    if (change) {
      const entry = change === 'alcohol' ? byId('alcohol', ctx) : null;
      return entry ? { kind: 'treatment_change', entry, reply: `${TEXT.treatment} ${entry.a}`, source: sourceText(entry), forward: true }
        : { kind: 'treatment_change', reply: TEXT.treatment, forward: true };
    }
    const entry = match(text, ctx);
    if (entry) return { kind: 'faq', entry, reply: entry.a, source: sourceText(entry), forward: false };
    return { kind: 'unknown', reply: TEXT.unknown, forward: true };
  }
  // Ответ на выбранный вопрос из списка темы (кнопкой) — без подбора по словам.
  function answerEntry(entry) {
    return { kind: 'faq', entry, reply: entry.a, source: sourceText(entry), forward: false };
  }
  // Полезная нагрузка события 'assistant' (переписка с ассистентом видна врачу в карточке).
  function turn(question, r, extra) {
    return Object.assign({ q: String(question || '').slice(0, 500), kind: r.kind, entryId: r.entry ? r.entry.id : null,
      reply: String(r.reply || '').slice(0, 1000) }, extra || {});
  }

  KK.assistant = { TEXT, normalize, stems, isCrisis, isTreatmentChange, match, answer, answerEntry, byId, topicEntries, sourceText, turn };
})(typeof window !== 'undefined' ? window : globalThis);
