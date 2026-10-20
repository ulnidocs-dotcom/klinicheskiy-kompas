// Батарея первичного приёма клинического психолога: подсчёт DASS-21 и TIPI-10, сходство раскладок ЦТО,
// предложение маршрута. Чистые функции, без DOM. Пустые и неполные данные — «нет данных», никогда не NaN.
// Маршрут — правила команды (teamRule) до экспертной проверки; решение принимает психолог.
(function (g) {
  const KK = g.KK;
  const NO_DATA = 'нет данных';
  const DASS_KEYS = ['depression', 'anxiety', 'stress'];
  const BAND_CODES = ['normal', 'mild', 'moderate', 'severe', 'extreme'];
  const BAND_LABELS = { normal: 'норма', mild: 'лёгкая', moderate: 'умеренная', severe: 'выраженная', extreme: 'крайне выраженная' };
  const LEVEL_ORDER = ['psychiatrist_required', 'psychotherapy_desirable', 'consultation', 'observation'];

  const answersOf = (x) => (Array.isArray(x) ? x : x && Array.isArray(x.answers) ? x.answers : []);
  function checked(answers, n, min, max, name) {
    return Array.from({ length: n }, (_, i) => {
      const v = answers[i];
      if (v == null) return null;
      if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${name}: ответ вне диапазона ${min}–${max}: ${v}`);
      return v;
    });
  }

  function dassBand(key, score) {
    const cuts = KK.data.scales.dass21.severity[key];
    if (!cuts || typeof score !== 'number' || !Number.isFinite(score)) return null;
    let k = 0;
    cuts.forEach((c, i) => { if (score >= c) k = i; });
    const code = BAND_CODES[k];
    return { code, label: BAND_LABELS[code], rank: k };
  }

  function scoreDass(input) {
    const d = KK.data.scales.dass21;
    const a = checked(answersOf(input), d.items.length, 0, 3, 'DASS-21');
    const subscales = {};
    for (const key of DASS_KEYS) {
      const vals = d.subscales[key].items.map((n) => a[n - 1]);
      const full = vals.every((v) => v != null);
      const raw = full ? vals.reduce((s, v) => s + v, 0) : null;
      const score = full ? raw * d.multiplier : null;
      const band = full ? dassBand(key, score) : null;
      subscales[key] = { key, title: d.subscales[key].label, raw, score, band, label: band ? band.label : NO_DATA };
    }
    return { complete: DASS_KEYS.every((k) => subscales[k].score != null), subscales };
  }

  function scoreTipi(input) {
    const d = KK.data.scales.tipi10;
    const a = checked(answersOf(input), d.items.length, 1, 7, 'TIPI-10');
    const val = (n) => (a[n - 1] == null ? null : d.reverse.includes(n) ? 8 - a[n - 1] : a[n - 1]);
    const traits = {};
    for (const [key, t] of Object.entries(d.traits)) {
      const vs = t.items.map(val);
      const score = vs.every((v) => v != null) ? vs.reduce((s, v) => s + v, 0) / vs.length : null;
      traits[key] = { key, title: t.label, score, label: score == null ? NO_DATA : String(score).replace('.', ',') };
    }
    return { complete: Object.values(traits).every((t) => t.score != null), traits };
  }

  // Ранговая корреляция Спирмена для двух полных раскладок одного набора (без повторов). Иначе — null.
  function spearman(x, y) {
    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < 2) return null;
    if (new Set(x).size !== x.length || new Set(y).size !== y.length) return null;
    const pos = new Map(y.map((id, i) => [id, i]));
    if (!x.every((id) => pos.has(id))) return null;
    const n = x.length;
    const d2 = x.reduce((s, id, i) => s + (i - pos.get(id)) ** 2, 0);
    return 1 - (6 * d2) / (n * (n * n - 1));
  }

  // Сходство раскладок ЦТО: пары понятий (и с порядком предпочтения цветов), по убыванию rho.
  // Нейтральные формулировки — материал для беседы, не интерпретация.
  function ctoSimilarity(cto) {
    const note = 'Совпадения раскладок — материал для беседы, не интерпретация';
    if (!cto || cto.skipped) return { pairs: [], close: [], note };
    const label = (id) => (id === 'preference' ? KK.data.cto.preferenceLabel : (KK.data.cto.concepts.find((c) => c.id === id) || {}).label || id);
    const full = (r) => Array.isArray(r) && r.length === KK.data.cto.colors.length;
    const lists = KK.data.cto.concepts.filter((c) => full(cto.concepts && cto.concepts[c.id])).map((c) => [c.id, cto.concepts[c.id]]);
    if (full(cto.preference)) lists.push(['preference', cto.preference]);
    const pairs = [];
    for (let i = 0; i < lists.length; i++) {
      for (let j = i + 1; j < lists.length; j++) {
        const rho = spearman(lists[i][1], lists[j][1]);
        if (rho == null) continue;
        const r = Math.round(rho * 100) / 100;
        const word = rho >= 0.6 ? 'раскладки близки' : rho <= -0.6 ? 'раскладки почти противоположны' : 'раскладки различаются';
        pairs.push({ a: lists[i][0], b: lists[j][0], rho: r, text: `«${label(lists[i][0])}» и «${label(lists[j][0])}»: ${word} (ρ = ${String(r).replace('.', ',')})` });
      }
    }
    pairs.sort((p, q) => q.rho - p.rho);
    return { pairs, close: pairs.filter((p) => p.rho >= 0.6), note };
  }

  // Обязательный маршрут к психиатру по C-SSRS или анкете (психотические/маниакальные признаки):
  // понижение допустимо, но с развёрнутой причиной, флагом в аудите и уведомлением врача.
  const mandatoryHard = (route) => !!(route && route.reasons.some((r) => r.level === 'psychiatrist_required' && (r.kind === 'cssrs' || r.kind === 'form')));
  const levelLabel = (l) => (l && KK.data.intake.levels[l] ? KK.data.intake.levels[l].label : NO_DATA);

  // intake: { form: ответы анкеты, cssrs: результат KK.scales.score('cssrs') или массив ответов, dass: ответы/результат DASS-21 }
  // → { level, reasons: [{ level, text, source, teamRule, note }], discrepancies: [{ id, text }], missing, critical, dass }
  function routeIntake(intake) {
    const src = KK.data.intake.sources;
    const note = KK.data.intake.teamNote;
    const it = intake || {};
    const form = it.form || null;
    const cssrsBand = Array.isArray(it.cssrs) ? KK.scales.score('cssrs', it.cssrs).band
      : it.cssrs && it.cssrs.band ? it.cssrs.band : null;
    const cssrsCode = cssrsBand ? cssrsBand.code : null;
    let dass = null;
    if (it.dass) dass = scoreDass(it.dass);
    const sub = (k) => (dass ? dass.subscales[k] : null);
    const sc = (k) => (sub(k) ? sub(k).score : null);
    const missing = [];
    if (!form) missing.push('form');
    if (!cssrsCode) missing.push('cssrs');
    if (!dass || !dass.complete) missing.push('dass21');

    const reasons = [];
    // kind — основание: 'cssrs' | 'dass' | 'form' (для правила «понижение обязательного маршрута»).
    const add = (level, text, source, kind = 'dass') => reasons.push({ level, text, source, teamRule: true, note, kind });
    // Обязательно к психиатру
    if (cssrsCode === 'moderate' || cssrsCode === 'high') add('psychiatrist_required', `C-SSRS: ${cssrsBand.doctorLabel}`, `${src.cssrs}; правило команды`, 'cssrs');
    if (sc('depression') != null && sc('depression') >= 21) add('psychiatrist_required', `DASS-21 Депрессия = ${sc('depression')} (≥ 21, ${sub('depression').label})`, src.dass);
    if (sc('anxiety') != null && sc('anxiety') >= 15) add('psychiatrist_required', `DASS-21 Тревога = ${sc('anxiety')} (≥ 15, ${sub('anxiety').label})`, src.dass);
    if (form && form.psychotic === true) add('psychiatrist_required', 'Анкета: пациент отмечает, что видел(а) или слышал(а) то, чего не видят другие', `${src.history}; правило команды`, 'form');
    if (form && form.mania === true) add('psychiatrist_required', 'Анкета: периоды очень приподнятого настроения с малой потребностью во сне', `${src.history}; правило команды`, 'form');
    // Психотерапия — желательно
    const MOD = { depression: [14, 20], anxiety: [10, 14], stress: [19, 25] };
    for (const k of DASS_KEYS) {
      const v = sc(k);
      if (v != null && v >= MOD[k][0] && v <= MOD[k][1]) add('psychotherapy_desirable', `DASS-21 ${sub(k).title} = ${v} (${sub(k).label})`, src.dass);
    }
    if (sc('stress') != null && sc('stress') >= 26) add('psychotherapy_desirable', `DASS-21 Стресс = ${sc('stress')} (≥ 26, ${sub('stress').label})`, src.dass);
    // Консультирование
    const MILD = { depression: [10, 13], anxiety: [8, 9], stress: [15, 18] };
    for (const k of DASS_KEYS) {
      const v = sc(k);
      if (v != null && v >= MILD[k][0] && v <= MILD[k][1]) add('consultation', `DASS-21 ${sub(k).title} = ${v} (${sub(k).label})`, src.dass);
    }
    // Пассивные мысли о смерти (C-SSRS «низкий») — не ниже консультирования.
    if (cssrsCode === 'low') add('consultation', 'Пассивные мысли о смерти (C-SSRS) — обсудить на встрече', `${src.cssrs}; правило команды`, 'cssrs');
    let level = LEVEL_ORDER.find((l) => reasons.some((r) => r.level === l)) || null;
    // «Наблюдение» — только когда все обязательные части есть (анкета, C-SSRS, DASS-21).
    if (!level && !missing.length) {
      level = 'observation';
      add('observation', 'DASS-21: все три подшкалы в пределах нормы', src.dass);
    }

    // Расхождения — вопросы для беседы, не выводы.
    const discrepancies = [];
    const anyRank = (min, keys = DASS_KEYS) => keys.some((k) => sub(k) && sub(k).band && sub(k).band.rank >= min);
    const allNormal = (keys) => keys.every((k) => sub(k) && sub(k).band && sub(k).band.rank === 0);
    const fine = form && typeof form.complaint === 'string' && /(вс[её]|в целом)\s+(в порядке|нормально|хорошо)|ничего не беспокоит|нет жалоб/i.test(form.complaint);
    if (fine && anyRank(2)) discrepancies.push({ id: 'dass_high_form_fine', text: 'По DASS-21 есть умеренные или более выраженные значения, а в анкете — «всё в порядке». Как пациент сам описывает своё состояние?' });
    if (cssrsCode && cssrsCode !== 'none' && allNormal(['depression', 'anxiety'])) discrepancies.push({ id: 'dass_low_cssrs_positive', text: 'Депрессия и тревога по DASS-21 в пределах нормы, но в скрининге безопасности есть положительные ответы. Что стоит за этими ответами?' });
    if (anyRank(2, ['stress']) && allNormal(['depression', 'anxiety'])) discrepancies.push({ id: 'stress_only', text: 'Стресс по DASS-21 повышен, а депрессия и тревога — в норме. Что сейчас создаёт нагрузку?' });

    return { level, reasons, discrepancies, missing, critical: cssrsCode === 'moderate' || cssrsCode === 'high', dass };
  }

  KK.battery = { mandatoryHard, NO_DATA, LEVEL_ORDER, BAND_LABELS, dassBand, scoreDass, scoreTipi, spearman, ctoSimilarity, routeIntake, levelLabel };
})(typeof window !== 'undefined' ? window : globalThis);
