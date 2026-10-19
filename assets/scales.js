(function (g) {
  const KK = g.KK;
  function def(id) {
    const d = KK.data.scales[id];
    if (!d) throw new Error(`Unknown scale: ${id}`);
    return d;
  }
  function bandFor(id, total) {
    const d = def(id);
    return d.bands.find((b) => total >= b.min && total <= b.max) || null;
  }
  function cssrsBand(a) {
    const yes = (i) => a[i] === 1;
    const code = yes(3) || yes(4) || yes(5) ? 'high' : yes(2) ? 'moderate' : yes(0) || yes(1) ? 'low' : 'none';
    return def('cssrs').bands.find((b) => b.code === code);
  }
  function score(id, answers) {
    const d = def(id);
    const src = Array.isArray(answers) ? answers : [];
    if (src.length > d.items.length) throw new Error(`Too many answers for ${id}: ${src.length} > ${d.items.length}`);
    const a = d.items.map((_, i) => (src[i] === undefined ? null : src[i]));
    const max = Math.max(...d.options.map((o) => o.v));
    a.forEach((v) => {
      if (v != null && (v < 0 || v > max || !Number.isInteger(v))) throw new Error(`Answer out of range: ${v}`);
    });
    const answered = a.filter((v) => v != null);
    const total = answered.reduce((s, v) => s + v, 0);
    const complete = answered.length === d.items.length;
    const flags = {};
    for (const [name, idx] of Object.entries(d.flagItems || {})) flags[name] = a[idx] ?? null;
    // Неполная PHQ/GAD не интерпретируется: сумма по части ответов занижает тяжесть.
    // C-SSRS допускает пропуски по логике скрининга (вопросы 3–5 только при «да» на 2).
    const band = id === 'cssrs' ? cssrsBand(a) : complete ? bandFor(id, total) : null;
    return { scaleId: id, answers: a, total, complete, band, flags };
  }
  // value: сумма баллов (PHQ-9, GAD-7); для C-SSRS — массив ответов или код уровня риска.
  function interpret(id, value, audience) {
    const d = def(id);
    let band;
    if (id === 'cssrs') {
      if (Array.isArray(value)) band = cssrsBand(value);
      else if (typeof value === 'string') band = d.bands.find((b) => b.code === value) || null;
      else throw new Error('C-SSRS интерпретируется по ответам или коду уровня, а не по сумме');
    } else {
      band = bandFor(id, value);
    }
    if (!band) return null;
    return {
      label: audience === 'patient' ? band.patientText ?? null : band.doctorLabel,
      code: band.code,
      source: d.source,
    };
  }
  KK.scales = { score, bandFor, interpret };
})(typeof window !== 'undefined' ? window : globalThis);
