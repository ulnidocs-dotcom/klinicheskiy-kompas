(function (g) {
  const KK = g.KK = g.KK || {};
  KK.data = KK.data || {};
  KK.data.drugs = KK.data.drugs || {};
  const DAY = 86400000;
  KK.util = {
    DAY,
    daysBetween(fromIso, toIso) {
      return Math.floor((new Date(toIso) - new Date(fromIso)) / DAY);
    },
    shiftDays(iso, n) {
      return new Date(new Date(iso).getTime() + n * DAY).toISOString();
    },
    dayKey(iso) {
      const d = new Date(iso);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${m}-${day}`;
    },
    uid(prefix) {
      return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    },
    byDateAsc(a, b) { return new Date(a.at) - new Date(b.at); },
    // Одна отметка на день: побеждает записанная последней (recordedAt, иначе at; при равенстве — позже в массиве).
    // Результат — по возрастанию времени. Нужен, потому что пациент может изменить отметку за сегодня или прошлый день.
    latestPerDay(events) {
      const best = new Map();
      (events || []).forEach((e) => {
        const k = KK.util.dayKey(e.at), t = +new Date(e.recordedAt || e.at);
        const cur = best.get(k);
        if (!cur || t >= cur.t) best.set(k, { e, t });
      });
      return [...best.values()].map((x) => x.e).sort(KK.util.byDateAsc);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
