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
    const max = Math.max(...d.options.map((o) => o.v));
    answers.forEach((v) => {
      if (v != null && (v < 0 || v > max || !Number.isInteger(v))) throw new Error(`Answer out of range: ${v}`);
    });
    const answered = answers.filter((v) => v != null);
    const total = answered.reduce((s, v) => s + v, 0);
    const complete = answered.length === d.items.length;
    const flags = {};
    for (const [name, idx] of Object.entries(d.flagItems || {})) flags[name] = answers[idx] ?? null;
    const band = id === 'cssrs' ? cssrsBand(answers) : bandFor(id, total);
    return { scaleId: id, answers: answers.slice(), total, complete, band, flags };
  }
  function interpret(id, total, audience) {
    const d = def(id);
    const band = bandFor(id, total);
    return {
      label: audience === 'patient' ? band.patientText : band.doctorLabel,
      code: band.code,
      source: d.source,
    };
  }
  KK.scales = { score, bandFor, interpret };
})(typeof window !== 'undefined' ? window : globalThis);
