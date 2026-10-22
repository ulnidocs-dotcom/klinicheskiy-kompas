// Анкета до приёма (спек 2026-10-22 §B): чистые функции над описанием из data/questionnaires.js.
// Видимые вопросы, проверка ответов, PHQ-2/GAD-2, сводка и флаги для врача, предложения в карту, экспорт FHIR R4.
// Ответы приходят от пациента — каждое значение проверяется по типу вопроса, остальное отбрасывается.
(function (g) {
  const KK = g.KK = g.KK || {};
  const DRAFT_PREFIX = 'kk:previsit-draft:';
  const COND_LABEL = { epilepsy: 'Эпилепсия', cvd: 'Сердечно-сосудистые заболевания', organic_brain: 'Органическое поражение головного мозга' };
  const MAX_TEXT = 600;

  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const optOf = (q, v) => (q.options || []).find((o) => o.v === v) || null;

  // Проверенное значение ответа или undefined (нет ответа / неверный тип).
  function valueOf(q, v) {
    if (v == null) return undefined;
    switch (q.type) {
      case 'text': { if (typeof v !== 'string') return undefined; const t = v.trim().slice(0, MAX_TEXT); return t || undefined; }
      case 'single': return optOf(q, v) ? v : undefined;
      case 'scale': return Number.isInteger(v) && optOf(q, v) ? v : undefined;
      case 'yesno': return typeof v === 'boolean' ? v : undefined;
      case 'multi': {
        if (!Array.isArray(v)) return undefined;
        const out = [...new Set(v.filter((x) => optOf(q, x)))];
        return out.length ? out : undefined;
      }
      case 'list': {
        if (!Array.isArray(v)) return undefined;
        const out = v.filter(isObj).map((r) => ({ name: String(r.name || '').trim().slice(0, 120), dose: String(r.dose || '').trim().slice(0, 120) }))
          .filter((r) => r.name).slice(0, q.max || 10);
        return out.length ? out : undefined;
      }
      default: return undefined;
    }
  }

  const visible = (def, answers, patient) => def.items.filter((q) => !q.when || q.when(answers || {}, patient || null));

  // Только видимые вопросы с правильными по типу ответами — так ответы сохраняются и экспортируются.
  function clean(def, answers, patient) {
    const a = isObj(answers) ? answers : {};
    const out = {};
    for (const q of visible(def, a, patient)) { const v = valueOf(q, a[q.id]); if (v !== undefined) out[q.id] = v; }
    return out;
  }
  const missing = (def, answers, patient) => {
    const a = isObj(answers) ? answers : {};
    return visible(def, a, patient).filter((q) => !q.optional && valueOf(q, a[q.id]) === undefined).map((q) => q.id);
  };

  const n03 = (v) => (Number.isInteger(v) && v >= 0 && v <= 3 ? v : null);
  function pair(a, ids, threshold) {
    const vals = ids.map((id) => n03(a[id]));
    const total = vals.reduce((s, v) => s + (v || 0), 0);
    return { total, max: 6, complete: vals.every((v) => v !== null), positive: total >= threshold };
  }
  // PHQ-2 (Kroenke 2003) и GAD-2 (Kroenke 2007): сумма двух ответов 0–3, порог ≥ 3.
  function scores(answers, threshold = 3) {
    const a = isObj(answers) ? answers : {};
    return { phq2: pair(a, ['phq2_1', 'phq2_2'], threshold), gad2: pair(a, ['gad2_1', 'gad2_2'], threshold) };
  }
  const selfHarm = (answers) => !!(isObj(answers) && answers.selfHarm === true);
  const answersOf = (payload) => (isObj(payload) && isObj(payload.answers) ? payload.answers : {});

  // Состояние назначенной анкеты по событиям previsit после отправки: none / sent / in_progress / completed.
  function status(assignment, events) {
    if (!assignment) return { state: 'none', response: null, partial: null, selfHarmEver: false };
    const from = +new Date(assignment.sentAt);
    // Ответ к прежней отправке (assignedAt раньше текущей), пришедший из очереди позже, к этой анкете не относится.
    const mine = (events || []).filter((e) => e && e.type === 'previsit' && +new Date(e.at) >= from && isObj(e.payload)
      && (!e.payload.questionnaireId || e.payload.questionnaireId === assignment.questionnaireId)
      && !(e.payload.assignedAt && +new Date(e.payload.assignedAt) < from));
    const response = mine.filter((e) => e.payload.status === 'completed').at(-1) || null;
    const partial = mine.at(-1) || null;
    // «Да» на вопрос о самоповреждении хоть в одной отправке этой анкеты — врач видит его, даже если позже ответ изменён.
    const selfHarmEver = mine.some((e) => selfHarm(e.payload.answers));
    return { state: response ? 'completed' : partial ? 'in_progress' : 'sent', response, partial, selfHarmEver };
  }

  function display(q, v) {
    if (v === undefined) return 'нет ответа';
    switch (q.type) {
      case 'yesno': return v ? 'Да' : 'Нет';
      case 'single': case 'scale': return optOf(q, v).label;
      case 'multi': return v.map((x) => optOf(q, x).label).join(', ');
      case 'list': return v.map((r) => (r.dose ? `${r.name} — ${r.dose}` : r.name)).join('; ');
      default: return v;
    }
  }
  function answerRows(def, payload, patient) {
    const a = answersOf(payload);
    return visible(def, a, patient).map((q) => ({ id: q.id, title: q.short || q.title, text: display(q, valueOf(q, a[q.id])) }));
  }

  // Сводка для врача: жалоба, длительность, PHQ-2/GAD-2 и флаги (critical — самоповреждение, warn — остальное).
  // selfHarmEver — из status(): в одной из отправок этой анкеты был ответ «да» (флаг не исчезает, если пациент его изменил).
  function summary(def, payload, patient, { selfHarmEver = false } = {}) {
    const a = clean(def, answersOf(payload), patient);
    const item = (id) => def.items.find((q) => q.id === id);
    const s = scores(a, def.threshold);
    const flags = [];
    if (a.selfHarm === true) flags.push({ level: 'critical', text: 'Мысли о смерти или самоповреждении за 2 недели — «да»' });
    else if (selfHarmEver) flags.push({ level: 'critical', text: 'В анкете был ответ «да» на вопрос о самоповреждении (позже изменён)' });
    if (s.phq2.positive) flags.push({ level: 'warn', text: `PHQ-2 = ${s.phq2.total} (≥ ${def.threshold}) — желательно оценить полной шкалой PHQ-9` });
    if (s.gad2.positive) flags.push({ level: 'warn', text: `GAD-2 = ${s.gad2.total} (≥ ${def.threshold}) — желательно оценить полной шкалой GAD-7` });
    if (['pregnant', 'maybe', 'lactating'].includes(a.pregnancy)) flags.push({ level: 'warn', text: `Со слов пациентки: ${optOf(item('pregnancy'), a.pregnancy).label.toLowerCase()}` });
    if (a.alcohol === 'daily') flags.push({ level: 'warn', text: 'Алкоголь почти каждый день' });
    if (a.allergy === true) flags.push({ level: 'warn', text: `Аллергия на лекарства${a.allergyText ? `: ${a.allergyText}` : ''}` });
    return {
      complaint: a.complaint || '',
      duration: a.duration ? optOf(item('duration'), a.duration).label : '',
      phq2: s.phq2, gad2: s.gad2, flags,
      complete: missing(def, a, patient).length === 0,
    };
  }

  // Что можно добавить в карту со слов пациента. Ничего не применяется само: врач отмечает пункты, затем toParsed → store.importParsed.
  function proposals(def, payload, patient, parser) {
    const a = clean(def, answersOf(payload), patient);
    const p = patient || {};
    const items = [];
    const unrecognized = [];
    const seen = new Set();
    const push = (x) => { if (!seen.has(x.key)) { seen.add(x.key); items.push(x); } };
    const hasMed = (name) => (p.meds || []).some((x) => String(x.name).toLowerCase().startsWith(name.toLowerCase()));
    for (const r of a.meds || []) {
      const found = parser ? parser.extract(`${r.name} ${r.dose}`).meds : [];
      if (!found.length) { unrecognized.push(r.name); continue; }
      for (const m of found) {
        if (hasMed(m.name)) continue;
        push({ key: `med:${m.name}`, kind: 'med', label: `${m.name}${r.dose ? ` — ${r.dose}` : ''}`, value: { name: m.name, classes: m.classes } });
      }
    }
    const allergies = (p.allergies || []).map((x) => String(x).toLowerCase());
    if (a.allergy === true && a.allergyText) {
      for (const t of a.allergyText.split(/[,;\n]+/).map((x) => x.trim().slice(0, 80)).filter(Boolean)) {
        if (allergies.includes(t.toLowerCase())) continue;
        push({ key: `allergy:${t}`, kind: 'allergy', label: `Аллергия: ${t}`, value: t });
      }
    }
    const conds = [];
    const chronic = def.items.find((q) => q.id === 'chronic');
    for (const v of a.chronic || []) { const o = optOf(chronic, v); if (o && o.condition) conds.push(o.condition); }
    if (a.chronicOther && parser) conds.push(...parser.extract(a.chronicOther).conditions);
    for (const c of conds) {
      if ((p.conditions || []).includes(c)) continue;
      push({ key: `condition:${c}`, kind: 'condition', label: COND_LABEL[c] || c, value: c });
    }
    if (a.pregnancy === 'pregnant' && !p.pregnant) push({ key: 'pregnant', kind: 'pregnant', label: 'Беременность', value: true });
    if (a.pregnancy === 'lactating' && !p.lactating) push({ key: 'lactating', kind: 'lactating', label: 'Грудное вскармливание', value: true });
    return { items, unrecognized };
  }

  // Выбранные врачом предложения → формат KK.parser.extract для store.importParsed (source — для журнала).
  function toParsed(items, keys) {
    const pick = new Set(keys || []);
    const out = { meds: [], diagnoses: [], conditions: [], labs: {}, allergies: [], source: 'previsit' };
    for (const x of items || []) {
      if (!pick.has(x.key)) continue;
      if (x.kind === 'med') out.meds.push(Object.assign({}, x.value));
      else if (x.kind === 'allergy') out.allergies.push(x.value);
      else if (x.kind === 'condition') out.conditions.push(x.value);
      else if (x.kind === 'pregnant') out.pregnant = true;
      else if (x.kind === 'lactating') out.lactating = true;
    }
    return out;
  }

  // HL7 FHIR R4 QuestionnaireResponse: только видимые вопросы с ответом; без ФИО — ссылка на пациента.
  function toFhir(def, event, patient) {
    const payload = event && event.payload;
    const a = clean(def, answersOf(payload), patient);
    const coding = (q, v) => ({ valueCoding: { system: `${def.canonical}/answers/${q.id}`, code: String(v), display: optOf(q, v).label } });
    const answer = (q, v) => {
      switch (q.type) {
        case 'text': return [{ valueString: v }];
        case 'yesno': return [{ valueBoolean: v }];
        case 'scale': return [{ valueInteger: v }];
        case 'single': return [coding(q, v)];
        case 'multi': return v.map((x) => coding(q, x));
        case 'list': return v.map((r) => ({ valueString: r.dose ? `${r.name} — ${r.dose}` : r.name }));
        default: return [];
      }
    };
    const res = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: `${def.canonical}|${def.version}`,
      status: isObj(payload) && payload.status === 'in-progress' ? 'in-progress' : 'completed',
      authored: event.at,
      item: visible(def, a, patient).filter((q) => a[q.id] !== undefined).map((q) => ({ linkId: q.id, text: q.title, answer: answer(q, a[q.id]) })),
    };
    // FHIR id: [A-Za-z0-9\-.]{1,64} — прочие символы (например «_») заменяем на «-». Без id пациента subject не пишем.
    const fid = (x) => String(x == null ? '' : x).replace(/[^A-Za-z0-9.-]/g, '-').slice(0, 64);
    if (patient && fid(patient.id)) res.subject = { reference: `Patient/${fid(patient.id)}` };
    if (event.id && fid(event.id)) res.id = fid(event.id);
    return res;
  }

  KK.questionnaire = {
    DRAFT_PREFIX,
    COND_LABEL,
    draftKey: (pid) => `${DRAFT_PREFIX}${pid}`,
    fhirFileName: (pid, iso) => `previsit-${String(pid).replace(/[^A-Za-z0-9_-]/g, '')}-${String(iso || '').slice(0, 10)}.json`,
    valueOf, visible, clean, missing, scores, selfHarm, status, answerRows, summary, proposals, toParsed, toFhir,
  };
})(typeof window !== 'undefined' ? window : globalThis);
