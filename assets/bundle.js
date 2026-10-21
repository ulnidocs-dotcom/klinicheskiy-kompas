// Пакет переноса kompas-bundle v1: переезд пациента между платформами и выдача данных пациенту (152-ФЗ).
// В пакете нет кода приглашения, внешних id каналов, кодов переезда и алертов (алерты пересчитываются из событий).
(function (g) {
  const KK = g.KK = g.KK || {};
  const FORMAT = 'kompas-bundle';
  const VERSION = 1;
  const PRIVATE_KEYS = ['inviteCode', 'channels', 'consents'];

  // queued — ещё не отправленные события из очереди (KK.sync.queued): уходят в файл с пометкой pending.
  function exportBundle(store, patientId, now = new Date(), queued = []) {
    const s = store.snapshot(patientId);
    const mine = (queued || []).filter((q) => q && q.patientId === patientId);
    const pendingEvents = mine.filter((q) => q.type !== 'message').map((q) => ({ id: q.clientId, type: q.type, at: (q.opts && q.opts.at) || q.queuedAt, payload: q.payload, clientId: q.clientId, channel: q.channel, pending: true }));
    const pendingMessages = mine.filter((q) => q.type === 'message').map((q) => ({ id: q.clientId, at: q.queuedAt, from: 'patient', text: q.payload.text, clientId: q.clientId, pending: true }));
    const patient = Object.fromEntries(Object.entries(s.patient).filter(([k]) => !PRIVATE_KEYS.includes(k)));
    return {
      format: FORMAT,
      version: VERSION,
      exportedAt: now.toISOString(),
      rulesVersion: KK.data && KK.data.rulesVersion ? KK.data.rulesVersion.id : null,
      patient,
      channels: (s.patient.channels || []).filter((c) => !c.revokedAt).map((c) => ({ channel: c.channel, linkedAt: c.linkedAt })),
      consents: (s.patient.consents || []).map((c) => ({ kind: c.kind, at: c.at, version: c.version })),
      events: s.events.concat(pendingEvents),
      messages: s.messages.concat(pendingMessages),
      decisions: s.audit.map((a) => Object.assign({ id: a.id, kind: a.action, at: a.at, by: a.actor, details: a.details || {} },
        a.details && a.details.ruleVersion ? { ruleVersion: a.details.ruleVersion } : {})),
    };
  }

  function importBundle(store, data) {
    let b = data;
    if (typeof data === 'string') {
      try { b = JSON.parse(data); } catch (e) { throw new Error('Не удалось прочитать пакет: файл повреждён'); }
    }
    if (!b || b.format !== FORMAT) throw new Error('Это не пакет «Клинического компаса»');
    if (b.version !== VERSION) throw new Error(`Версия пакета ${b.version} не поддерживается`);
    if (!b.patient || !Array.isArray(b.events)) throw new Error('Пакет повреждён');
    const patient = Object.assign({}, b.patient, { consents: Array.isArray(b.consents) ? b.consents : [] });
    const audit = (b.decisions || []).map((d) => ({ id: d.id, at: d.at, actor: d.by, action: d.kind, details: d.details || {} }));
    // неотправленное (pending) не восстанавливаем: оно ещё не записано у врача
    const events = b.events.filter((e) => !(e && e.pending));
    const messages = (b.messages || []).filter((m) => !(m && m.pending));
    return store.restore({ patient, events, messages, audit });
  }

  KK.bundle = {
    FORMAT,
    VERSION,
    exportBundle,
    importBundle,
    fileName: (pid, now = new Date()) => `kompas-${String(pid).replace(/[^A-Za-z0-9_-]/g, '')}-${now.toISOString().slice(0, 10)}.json`,
  };
})(typeof window !== 'undefined' ? window : globalThis);
