(function (g) {
  const KK = g.KK;
  function classesOf(name) {
    const n = String(name || '').toLowerCase();
    const out = new Set();
    for (const [key, classes] of Object.entries(KK.data.drugClasses)) {
      if (n.includes(key)) classes.forEach((c) => out.add(c));
    }
    return [...out];
  }
  function patientClasses(p) {
    const s = new Set();
    (p.meds || []).forEach((m) => (m.classes || classesOf(m.name)).forEach((c) => s.add(c)));
    return s;
  }
  function isIndicated(drug, p) {
    const codes = (p.diagnoses || []).map((d) => d.code);
    return drug.indications.some((ind) =>
      ind.codes.some((c) => codes.some((pc) => pc.startsWith(c))) && (!ind.requires || p[ind.requires] === true));
  }
  function check(drug, p) {
    const cls = patientClasses(p);
    const has = (c) => cls.has(c);
    const contraindications = drug.contraindications.map((c) => {
      const v = c.check(p, has);
      return { id: c.id, label: c.label, status: v === true ? 'present' : v === false ? 'absent' : 'unknown' };
    });
    const cautions = drug.cautions.filter((c) => c.check(p, has)).map(({ id, label }) => ({ id, label }));
    const interactions = drug.interactions
      .filter((i) => i.classes.some(has))
      .map((i) => ({
        id: i.id, level: i.level, text: i.text,
        drugs: (p.meds || []).filter((m) => (m.classes || classesOf(m.name)).some((c) => i.classes.includes(c))).map((m) => m.name),
      }));
    const present = contraindications.some((c) => c.status === 'present');
    const unknown = contraindications.some((c) => c.status === 'unknown');
    return {
      drugId: drug.id,
      indicated: isIndicated(drug, p),
      eligible: present ? false : unknown ? null : true,
      contraindications, cautions, interactions,
      source: drug.source,
    };
  }
  KK.therapy = { check, classesOf };
})(typeof window !== 'undefined' ? window : globalThis);
