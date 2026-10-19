(function (g) {
  const KK = g.KK;
  const { DAY, dayKey } = KK.util;
  function confirmed(plan) { return plan && plan.status === 'confirmed' && plan.confirmedAt; }
  function pdc(doses, plan, nowIso, windowDays) {
    if (!confirmed(plan)) return null;
    const now = new Date(nowIso).getTime();
    const todayStart = new Date(dayKey(nowIso) + 'T00:00:00').getTime();
    const from = Math.max(todayStart - windowDays * DAY, new Date(dayKey(plan.confirmedAt) + 'T00:00:00').getTime());
    const days = Math.round((todayStart - from) / DAY);
    if (days < 1) return null; // назначение подтверждено сегодня — полного дня ещё нет
    const expected = days * (plan.timesPerDay || 1);
    const slots = new Set();
    doses.forEach((d) => {
      const t = new Date(d.at).getTime();
      if (d.type === 'dose' && d.payload?.taken && t >= from && t < todayStart && t <= now) {
        slots.add(`${dayKey(d.at)}|${d.payload.slot ?? d.at}`);
      }
    });
    const taken = slots.size;
    return Math.min(1, Math.round((taken / expected) * 100) / 100);
  }
  function missedStreak(doses, plan, nowIso) {
    if (!confirmed(plan)) return 0;
    const takenDays = new Set(doses.filter((d) => d.type === 'dose' && d.payload?.taken).map((d) => dayKey(d.at)));
    const startKey = dayKey(plan.confirmedAt);
    let streak = 0;
    const day = new Date(nowIso);
    for (let i = 1; i < 60; i++) {
      day.setDate(day.getDate() - 1); // календарный шаг: корректно при переходе на летнее/зимнее время
      const key = dayKey(day.toISOString());
      if (key < startKey || takenDays.has(key)) break;
      streak++;
    }
    return streak;
  }
  KK.adherence = { pdc, missedStreak };
})(typeof window !== 'undefined' ? window : globalThis);
