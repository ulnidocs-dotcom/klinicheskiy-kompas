(function (g) {
  const KK = g.KK;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const W = 'а-яёa-z';
  // «X не исключён(а)» / «не исключено X» — это НЕ отрицание: врач допускает X.
  const POSSIBLE = /не\s+исключ/i;
  const NEG_BEFORE = new RegExp(`(?:^|[^${W}])(?:не|нет|без|отрицает|отрицала?|отрицают)\\s+(?:[${W}]+\\s+){0,2}$`, 'i');
  const NEG_AFTER = new RegExp(`^[${W}]*(?:\\s+[${W}]+){0,2}?\\s*[—–:-]?\\s*(?:нет|не\\s+выявлен|не\\s+обнаружен|исключен|отрицает|отрицала?|отсутству)`, 'i');
  const POSSIBLE_AFTER = new RegExp(`^[${W}]*(?:\\s+[${W}]+){0,2}?\\s*не\\s+исключ`, 'i');

  // Отрицание ищется только внутри своей фразы (до знака препинания).
  function negated(text, start, end) {
    let before = text.slice(Math.max(0, start - 40), start);
    const cut = Math.max(...['.', ';', ',', '!', '?', '\n'].map((c) => before.lastIndexOf(c)));
    if (cut >= 0) before = before.slice(cut + 1);
    const after = text.slice(end, end + 50).split(/[.;,!?\n]/)[0];
    if (POSSIBLE.test(before) || POSSIBLE_AFTER.test(after)) return false;
    return NEG_BEFORE.test(before) || NEG_AFTER.test(after);
  }
  // Все упоминания по регулярному выражению: { index, end, neg }.
  function mentions(src, re) {
    const g2 = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    const out = [];
    let m;
    while ((m = g2.exec(src))) {
      if (!m[0]) { g2.lastIndex++; continue; }
      out.push({ index: m.index, end: m.index + m[0].length, text: m[0], neg: negated(src, m.index, m.index + m[0].length) });
    }
    return out;
  }
  // true — есть утвердительное упоминание; false — только отрицаемые; undefined — не упоминается.
  const affirmed = (ms) => (ms.length ? ms.some((x) => !x.neg) : undefined);

  const ICD_CHAPTERS = 'FGIENKUZJ';
  const AGE_ANCHOR = /(?:пациент(?:ка)?|мужчин[а-яё]*|женщин[а-яё]*|возраст)[^\n\d]{0,20}$/i;
  const AGE_EXCLUDE_BEFORE = /(?:^|[^а-яё])(?:с|в\s+течение|в|около|на\s+протяжении|более|менее|уже)\s+$/i;

  function extractAge(src) {
    const cands = [];
    const re = /(?<!\d)(\d{1,3})\s*(?:лет|года|год)(?![а-яё])/gi;
    let m;
    while ((m = re.exec(src))) {
      const n = Number(m[1]);
      const before = src.slice(Math.max(0, m.index - 40), m.index);
      const after = src.slice(m.index + m[0].length, m.index + m[0].length + 12);
      if (n > 120 || AGE_EXCLUDE_BEFORE.test(before) || /^\s*назад/i.test(after)) continue;
      cands.push({ n, anchored: AGE_ANCHOR.test(before) });
    }
    const anchoredNum = /возраст[^\d\n]{0,5}(?<!\d)(\d{1,3})(?!\d)/i.exec(src);
    if (anchoredNum && Number(anchoredNum[1]) <= 120) cands.push({ n: Number(anchoredNum[1]), anchored: true });
    const pick = cands.find((c) => c.anchored) || cands[0];
    return pick ? pick.n : undefined;
  }

  function extractEgfr(src) {
    const re = /(?:р?скф|egfr|gfr)/gi;
    let m;
    while ((m = re.exec(src))) {
      const tail = src.slice(m.index + m[0].length, m.index + m[0].length + 40).split('\n')[0];
      const num = /(?<![\d.,])(\d{1,4})(?![\d]|[.,]\d)/g;
      let n;
      while ((n = num.exec(tail))) {
        if (n[1].length > 3) continue; // год формулы (CKD-EPI 2021) и т. п.
        const v = Number(n[1]);
        if (v >= 5 && v <= 150) return { value: v, start: m.index, end: m.index + m[0].length + n.index + n[1].length };
        break; // первое правдоподобное по форме число вне диапазона — не угадываем дальше
      }
    }
    return null;
  }

  function extract(text) {
    const src = String(text || '');
    const spans = [];
    const mark = (start, end, kind) => spans.push({ start, end, kind });
    const out = { diagnoses: [], meds: [], labs: {}, conditions: [], spans };

    const dx = /(?<![A-Za-z0-9])([A-Z]\d{2}(?:\.\d{1,2})?)(?![\d])/g;
    let m;
    while ((m = dx.exec(src))) {
      const code = m[1];
      if (!code.includes('.') && !ICD_CHAPTERS.includes(code[0])) continue;
      if (!out.diagnoses.some((d) => d.code === code)) {
        const tail = src.slice(m.index + code.length, m.index + code.length + 80).split(/[.\n;(]/)[0].trim();
        out.diagnoses.push({ code, text: tail });
      }
      mark(m.index, m.index + code.length, 'diagnosis');
    }

    const lower = src.toLowerCase();
    const medSpans = [];
    const keys = Object.keys(KK.data.drugClasses).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      for (let i = lower.indexOf(key); i >= 0; i = lower.indexOf(key, i + 1)) {
        const end = i + key.length;
        if (medSpans.some((s) => i >= s.start && end <= s.end)) continue;
        if (/отмен/i.test(lower.slice(end, end + 20))) continue;
        if (!out.meds.some((x) => x.name.toLowerCase() === key)) {
          out.meds.push({ name: cap(key), classes: KK.data.drugClasses[key] });
          medSpans.push({ start: i, end });
          mark(i, end, 'med');
        }
        break;
      }
    }

    const egfr = extractEgfr(src);
    if (egfr) { out.labs.egfr = egfr.value; mark(egfr.start, egfr.end, 'lab'); }

    const cp = /(?:child[-\s]?pugh|чайлд[-\s]?пью)[\s:,–-]*(?:(?:класс|class|кл\.?)[\s:]*)?([A-Ca-cАВСавс])(?![A-Za-zА-Яа-яЁё])/i.exec(src);
    if (cp) {
      const L = cp[1].toUpperCase();
      out.labs.childPugh = { 'А': 'A', 'В': 'B', 'С': 'C' }[L] || L;
      mark(cp.index, cp.index + cp[0].length, 'lab');
    }

    const preg = mentions(src, /беременн[а-яё]*/i);
    if (preg.length) { out.pregnant = affirmed(preg); preg.forEach((x) => mark(x.index, x.end, 'condition')); }
    const lact = mentions(src, /лактаци[а-яё]*|грудн[а-яё]+\s+вскармливани[а-яё]*/i);
    if (lact.length) out.lactating = affirmed(lact);

    const epi = mentions(src, /эпилепси[а-яё]*/i);
    epi.forEach((x) => mark(x.index, x.end, 'condition'));
    if (affirmed(epi)) out.conditions.push('epilepsy');
    const organic = mentions(src, /органическ[а-яё]*\s+(?:поражени|заболевани|расстройств)[а-яё]*(?:\s+(?:цнс|головного\s+мозга))?/i);
    if (affirmed(organic)) out.conditions.push('organic_brain');
    const cvd = mentions(src, /(?<![а-яё])(?:ибс|гипертони[а-яё]*|аг|инфаркт[а-яё]*|хсн|аритми[а-яё]*)(?![а-яё])/i);
    if (affirmed(cvd)) out.conditions.push('cvd');

    const age = extractAge(src);
    if (age != null) out.age = age;

    // «пациент» используется и для женщин — пол по нему не определяем.
    if (/(?<![а-яё])(?:пациентка|женщина|пол:\s*жен)/i.test(src)) out.sex = 'f';
    else if (/(?<![а-яё])(?:мужчина|пол:\s*муж)/i.test(src)) out.sex = 'm';

    if (/covid|ковид|u09\.9|u07\.1/i.test(src)) out.postCovid = true;
    if (affirmed(mentions(src, /психотическ[а-яё]*|галлюцинац[а-яё]*|бредов[а-яё]*|(?<![а-яё])бред(?![а-яё])/i))) {
      out.history = Object.assign(out.history || {}, { psychotic: true });
    }
    if (affirmed(mentions(src, /биполярн[а-яё]*|(?<![A-Za-z])F31/i))) {
      out.history = Object.assign(out.history || {}, { bipolar: true });
    }

    spans.sort((a, b) => a.start - b.start);
    return out;
  }
  KK.parser = { extract };
})(typeof window !== 'undefined' ? window : globalThis);
