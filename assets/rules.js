(function (g) {
  const KK = g.KK;
  const ORDER = { critical: 0, important: 1, info: 2 };
  function buildContext(patient, events, nowIso) {
    const sorted = [...events].sort(KK.util.byDateAsc);
    const scales = { phq9: [], gad7: [], cssrs: [] };
    sorted.filter((e) => e.type === 'scale').forEach((e) => {
      (scales[e.payload.scaleId] = scales[e.payload.scaleId] || []).push(Object.assign({ at: e.at }, e.payload));
    });
    const plan = patient.plan || null;
    const drug = plan && KK.data.drugs[plan.drugId];
    const startIso = plan?.status === 'confirmed' ? plan.confirmedAt : null;
    return {
      patient, now: nowIso, events: sorted, scales,
      latest: (id) => scales[id]?.at(-1) || null,
      previous: (id) => scales[id]?.at(-2) || null,
      firstAfterStart: (id) => (scales[id] || []).find((r) => !startIso || new Date(r.at) >= new Date(KK.util.shiftDays(startIso, -3))) || null,
      therapy: drug ? KK.therapy.check(drug, patient) : null,
      pdc14: KK.adherence.pdc(sorted, plan, nowIso, 14),
      missedStreak: KK.adherence.missedStreak(sorted, plan, nowIso),
      daysOnTherapy: startIso ? KK.util.daysBetween(startIso, nowIso) : 0,
    };
  }
  function evaluate(ctx, rules = KK.data.rules) {
    const out = [];
    for (const r of rules) {
      let hit = false;
      try { hit = !!r.when(ctx); } catch (e) { hit = false; }
      if (hit) out.push({ ruleId: r.id, level: r.level, routing: r.routing, title: r.title, text: r.text(ctx), source: r.source, teamRule: r.teamRule });
    }
    return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  }
  function routing(signals) {
    if (signals.some((s) => s.routing === 'required')) return 'required';
    if (signals.some((s) => s.routing === 'desirable')) return 'desirable';
    return null;
  }
  KK.rules = { buildContext, evaluate, routing };
})(typeof window !== 'undefined' ? window : globalThis);
