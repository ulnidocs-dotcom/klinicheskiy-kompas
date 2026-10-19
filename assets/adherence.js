(function (g) {
  const KK = g.KK;
  const { DAY, dayKey } = KK.util;
  function confirmed(plan) { return plan && plan.status === 'confirmed' && plan.confirmedAt; }
  function pdc(doses, plan, nowIso, windowDays) {
    if (!confirmed(plan)) return null;
    const now = new Date(nowIso).getTime();
    const todayStart = new Date(dayKey(nowIso) + 'T00:00:00').getTime();
    const from = Math.max(todayStart - windowDays * DAY, new Date(dayKey(plan.confirmedAt) + 'T00:00:00').getTime());
    const days = Math.max(1, Math.round((todayStart - from) / DAY));
    const expected = days * (plan.timesPerDay || 1);
    const taken = doses.filter((d) => {
      const t = new Date(d.at).getTime();
      return d.type === 'dose' && d.payload?.taken && t >= from && t < todayStart && t <= now;
    }).length;
    return Math.min(1, Math.round((taken / expected) * 100) / 100);
  }
  function missedStreak(doses, plan, nowIso) {
    if (!confirmed(plan)) return 0;
    const takenDays = new Set(doses.filter((d) => d.type === 'dose' && d.payload?.taken).map((d) => dayKey(d.at)));
    const startKey = dayKey(plan.confirmedAt);
    let streak = 0;
    for (let i = 1; i < 60; i++) {
      const key = dayKey(new Date(new Date(nowIso).getTime() - i * DAY).toISOString());
      if (key < startKey || takenDays.has(key)) break;
      streak++;
    }
    return streak;
  }
  KK.adherence = { pdc, missedStreak };
})(typeof window !== 'undefined' ? window : globalThis);
