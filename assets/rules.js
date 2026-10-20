(function (g) {
  const KK = g.KK;
  const ORDER = { critical: 0, important: 1, info: 2 };
  const CSSRS_RANK = { none: 0, low: 1, moderate: 2, high: 3 };
  const INTAKE_CSSRS_DAYS = 30;
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
      // C-SSRS: оценка врача (последняя) и самоотчёт пациента на первичном приёме (последний, не старше 30 дней).
      // Риск — максимальный из двух: самоотчёт никогда не понижает оценку врача. При равенстве — оценка врача.
      cssrsRisk: () => {
        const all = scales.cssrs || [];
        const clin = all.filter((r) => r.context !== 'intake').at(-1) || null;
        const intake = all.filter((r) => r.context === 'intake' && new Date(nowIso) - new Date(r.at) <= INTAKE_CSSRS_DAYS * KK.util.DAY).at(-1) || null;
        const rank = (r) => (r && r.band ? CSSRS_RANK[r.band.code] ?? -1 : -1);
        const best = rank(intake) > rank(clin) ? intake : clin || intake;
        if (!best || !best.band) return null;
        return { band: best.band, at: best.at, origin: best === intake ? 'intake' : 'clinician', clinician: clin, intake };
      },
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
      try {
        if (r.when(ctx)) {
          out.push({ ruleId: r.id, level: r.level, routing: r.routing, title: r.title, text: r.text(ctx), source: r.source, teamRule: r.teamRule,
            basis: typeof r.basis === 'function' ? r.basis(ctx) || null : null,
            origin: typeof r.origin === 'function' ? r.origin(ctx) || null : null });
        }
      } catch (e) {
        // Сбой правила не должен превращаться в «всё спокойно»: показываем врачу, что проверка не выполнена.
        if (typeof console !== 'undefined' && typeof console.error === 'function') console.error(`[KK.rules] ${r.id}:`, e);
        out.push({ ruleId: r.id, level: r.level === 'critical' ? 'critical' : 'important', routing: r.routing,
          title: 'Правило не вычислено: ' + r.title, text: 'Ошибка данных — проверьте вручную', source: r.source,
          teamRule: r.teamRule, error: true, basis: null });
      }
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
