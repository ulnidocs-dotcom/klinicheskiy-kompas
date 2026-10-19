(function (g) {
  const KK = g.KK;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function negated(text, idx) {
    const before = text.slice(Math.max(0, idx - 25), idx);
    const after = text.slice(idx, idx + 40);
    return /(?:^|[^а-яё])(не|нет|без)\s*$/i.test(before) || /^\S*\s+(отрицает|исключен|не выявлен)/i.test(after);
  }
  function extract(text) {
    const src = String(text || '');
    const spans = [];
    const mark = (start, end, kind) => spans.push({ start, end, kind });
    const out = { diagnoses: [], meds: [], labs: {}, conditions: [], spans };

    const dx = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
    let m;
    while ((m = dx.exec(src))) {
      if (!out.diagnoses.some((d) => d.code === m[1])) {
        const tail = src.slice(m.index + m[1].length, m.index + m[1].length + 80).split(/[.\n;(]/)[0].trim();
        out.diagnoses.push({ code: m[1], text: tail });
      }
      mark(m.index, m.index + m[1].length, 'diagnosis');
    }

    const lower = src.toLowerCase();
    for (const key of Object.keys(KK.data.drugClasses)) {
      const i = lower.indexOf(key);
      if (i >= 0 && !out.meds.some((x) => x.name.toLowerCase() === key)) {
        out.meds.push({ name: cap(key), classes: KK.data.drugClasses[key] });
        mark(i, i + key.length, 'med');
      }
    }

    const egfr = /(?:р?скф|egfr|gfr)[^\d\n]{0,25}(\d{2,3})/i.exec(src);
    if (egfr) { out.labs.egfr = Number(egfr[1]); mark(egfr.index, egfr.index + egfr[0].length, 'lab'); }

    const cp = /(?:child[-\s]?pugh|чайлд[-\s]?пью)[^ABCАВС\n]{0,15}([ABCАВС])\b/i.exec(src);
    if (cp) {
      out.labs.childPugh = { 'А': 'A', 'В': 'B', 'С': 'C' }[cp[1].toUpperCase()] || cp[1].toUpperCase();
      mark(cp.index, cp.index + cp[0].length, 'lab');
    }

    const preg = /беременн[а-яё]*/i.exec(src);
    if (preg) { out.pregnant = !negated(src, preg.index) && !/беременност[а-яё]*\s+отрицает/i.test(src); mark(preg.index, preg.index + preg[0].length, 'condition'); }
    const lact = /лактаци[а-яё]*|грудн[а-яё]+\s+вскармливани[а-яё]*/i.exec(src);
    if (lact) out.lactating = !negated(src, lact.index);

    const epi = /эпилепси[а-яё]*/i.exec(src);
    if (epi) {
      mark(epi.index, epi.index + epi[0].length, 'condition');
      if (!negated(src, epi.index)) out.conditions.push('epilepsy');
    }
    if (/органическ[а-яё]+\s+(поражени|заболевани|расстройств)[а-яё]*/i.test(src)) out.conditions.push('organic_brain');
    if (/(?:^|[^а-яё])(ибс|гипертони[а-яё]*|аг|инфаркт[а-яё]*|хсн|аритми[а-яё]*)(?![а-яё])/i.test(src)) out.conditions.push('cvd');

    const age = /(\d{1,2})\s*(?:лет|года|год)(?![а-яё])/i.exec(src) || /возраст\D{0,5}(\d{1,2})/i.exec(src);
    if (age) out.age = Number(age[1]);

    if (/(пациентка|женщина|пол:\s*жен)/i.test(src)) out.sex = 'f';
    else if (/(пациент(?![а-яё])|мужчина|пол:\s*муж)/i.test(src)) out.sex = 'm';

    out.postCovid = /covid|ковид|u09\.9|u07\.1/i.test(src);
    if (/психотическ|галлюцинац|бредов|(?:^|[^а-яё])бред(?![а-яё])/i.test(src)) out.history = Object.assign(out.history || {}, { psychotic: true });
    if (/биполярн|f31/i.test(src)) out.history = Object.assign(out.history || {}, { bipolar: true });

    spans.sort((a, b) => a.start - b.start);
    return out;
  }
  KK.parser = { extract };
})(typeof window !== 'undefined' ? window : globalThis);
