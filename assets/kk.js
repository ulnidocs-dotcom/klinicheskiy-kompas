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
  };
})(typeof window !== 'undefined' ? window : globalThis);
