// Очередь отправки событий пациента. Каждое событие получает clientId (ключ идемпотентности) и канал;
// при сбое сети остаётся в очереди (localStorage) и уходит повторно с паузой 2, 4, 8 … 60 с.
// SOS и ответы, поднимающие критический сигнал, не ждут: без связи — исключение, страница говорит «не отправлено».
(function (g) {
  const KK = g.KK = g.KK || {};
  const KEY = 'kk:outbox';
  const FIRST_DELAY = 2000;
  const MAX_DELAY = 60000;

  function isUrgent(type, payload) {
    if (type === 'sos') return true;
    if (type === 'ae') return !!(payload && Array.isArray(payload.items) && payload.items.some((i) => i && i.severity === 'severe'));
    if (type !== 'scale' || !KK.scales || !payload) return false;
    const r = KK.scales.score(payload.scaleId, payload.answers);
    if (r.flags && r.flags.item9 > 0) return true;
    return payload.scaleId === 'cssrs' && !!r.band && ['moderate', 'high'].includes(r.band.code);
  }

  // Демо-транспорт: пишет в KK.store. Ошибки проверки стора — «rejected», их не повторяем.
  function localTransport(store) {
    return {
      send(items) {
        return items.map((it) => {
          try {
            const event = store.addEvent(it.patientId, it.type, it.payload, Object.assign({}, it.opts, { clientId: it.clientId, channel: it.channel }));
            return { clientId: it.clientId, status: 'accepted', event };
          } catch (err) {
            if (err && err.retryable) throw err;
            return { clientId: it.clientId, status: 'rejected', reason: err && err.message };
          }
        });
      },
    };
  }

  function createSync({ storage, transport, channel = 'web', clock = () => new Date(), uid = () => KK.util.uid('cl'), schedule = (fn, ms) => setTimeout(fn, ms) }) {
    const read = () => { try { return JSON.parse(storage.getItem(KEY)) || []; } catch (e) { return []; } };
    const write = (q) => { try { storage.setItem(KEY, JSON.stringify(q)); } catch (e) { /* приватный режим */ } };
    const listeners = new Set();
    const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* подписчик не должен ломать очередь */ } });
    const rejectedList = []; // отклонённые хранилищем отметки: страница скажет пациенту
    let delay = FIRST_DELAY;
    let timer = null;

    function send(items) {
      try { return transport.send(items); } catch (err) { if (err && err.retryable) return null; throw err; }
    }
    function retryLater() {
      if (timer) return;
      timer = schedule(() => { timer = null; flush(); }, delay) || true;
      delay = Math.min(delay * 2, MAX_DELAY);
    }
    function flush() {
      const q = read();
      if (!q.length) { delay = FIRST_DELAY; return { sent: 0, pending: 0 }; }
      const res = send(q);
      if (!res) { retryLater(); notify(); return { sent: 0, pending: q.length }; }
      const done = new Set(res.map((r) => r.clientId));
      const rest = q.filter((it) => !done.has(it.clientId));
      res.filter((r) => r.status === 'rejected').forEach((r) => {
        const it = q.find((x) => x.clientId === r.clientId);
        if (it) rejectedList.push({ clientId: it.clientId, patientId: it.patientId, type: it.type, reason: r.reason });
      });
      write(rest);
      delay = FIRST_DELAY;
      notify();
      return { sent: res.filter((r) => r.status === 'accepted').length, pending: rest.length };
    }
    function submit(patientId, type, payload, opts = {}) {
      const item = { clientId: uid(), patientId, type, payload, opts: opts.at ? { at: opts.at } : {}, channel, queuedAt: clock().toISOString() };
      const urgent = isUrgent(type, payload);
      if (!urgent && read().length) flush(); // сначала старые отметки, чтобы сохранить порядок
      const res = send([item]);
      if (!res) {
        if (urgent) { const e = new Error('Нет связи: сообщение не отправлено'); e.offline = true; throw e; }
        write(read().concat(item));
        retryLater();
        notify();
        const shown = type === 'scale' && KK.scales ? Object.assign(KK.scales.score(payload.scaleId, payload.answers), payload.context ? { context: payload.context } : {}) : payload;
        return { pending: true, clientId: item.clientId, type, payload: shown };
      }
      if (res[0].status === 'rejected') throw new Error(res[0].reason || 'Не удалось сохранить');
      notify();
      return res[0].event;
    }
    return {
      submit,
      flush,
      pending: (patientId) => read().filter((it) => !patientId || it.patientId === patientId).length,
      queued: (patientId) => read().filter((it) => !patientId || it.patientId === patientId),
      rejected: (patientId) => rejectedList.filter((r) => !patientId || r.patientId === patientId).slice(),
      clearRejected(patientId) { for (let i = rejectedList.length - 1; i >= 0; i--) if (!patientId || rejectedList[i].patientId === patientId) rejectedList.splice(i, 1); },
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    };
  }

  KK.syncIsUrgent = isUrgent;
  KK.syncLocalTransport = localTransport;
  KK.createSync = createSync;
  if (KK.store && typeof g.localStorage !== 'undefined') {
    KK.sync = createSync({ storage: g.localStorage, transport: localTransport(KK.store), channel: KK.host ? KK.host.platform : 'web' });
    if (typeof g.addEventListener === 'function') g.addEventListener('online', () => KK.sync.flush());
  }
})(typeof window !== 'undefined' ? window : globalThis);
