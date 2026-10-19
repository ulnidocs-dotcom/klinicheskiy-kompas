(function (g) {
  const KK = g.KK;
  const KEY = 'kk:v1';
  const LEVEL_RANK = { critical: 0, important: 1, info: 2 };
  const ROUTING_RANK = { required: 0, desirable: 1 };

  function createStore({ storage, clock }) {
    const listeners = new Set();
    const nowIso = () => clock().toISOString();
    const read = () => { try { return JSON.parse(storage.getItem(KEY)) || null; } catch (e) { return null; } };
    let db = read();
    const write = () => { storage.setItem(KEY, JSON.stringify(db)); listeners.forEach((fn) => fn()); };
    const need = () => { if (!db) reset(); return db; };

    function reset() {
      const now = nowIso();
      db = { version: 1, createdAt: now, activePatientId: 'p_anna',
        doctor: { id: 'd1', name: 'Елена Иванова', specialty: 'терапевт', mode: 'nonPsychiatrist' },
        patients: {}, events: {}, alerts: [], audit: [], messages: {} };
      for (const s of KK.data.scenarios) {
        const p = KK.data.materializePatient(s.patient, now);
        p.scenarioId = s.id; p.doctorId = 'd1';
        db.patients[p.id] = p;
        db.events[p.id] = KK.data.expandSeed(s.seed, now).map((e) => Object.assign({ id: KK.util.uid('ev') }, e));
        db.messages[p.id] = [];
        syncAlerts(p.id, db.events[p.id].at(-1)?.at || now);
      }
      write();
    }

    function signalsFor(id) {
      const p = db.patients[id];
      return KK.rules.evaluate(KK.rules.buildContext(p, db.events[id] || [], nowIso()));
    }

    function syncAlerts(id, dataAt) {
      for (const s of signalsFor(id)) {
        if (s.level === 'info') continue;
        const open = db.alerts.find((a) => a.patientId === id && a.ruleId === s.ruleId && !a.ackAt);
        if (open) continue;
        db.alerts.push({ id: KK.util.uid('al'), patientId: id, ruleId: s.ruleId, level: s.level, routing: s.routing,
          title: s.title, text: s.text, source: s.source, dataAt, createdAt: nowIso(), deliveredAt: null, ackAt: null, ackAction: null });
      }
    }

    function view(id) {
      const p = db.patients[id];
      if (!p) return null;
      const signals = signalsFor(id);
      const ev = db.events[id] || [];
      const ctx = KK.rules.buildContext(p, ev, nowIso());
      return Object.assign(JSON.parse(JSON.stringify(p)), {
        signals, routing: KK.rules.routing(signals),
        openAlerts: db.alerts.filter((a) => a.patientId === id && !a.ackAt),
        therapy: ctx.therapy, pdc14: ctx.pdc14, missedStreak: ctx.missedStreak,
        latest: { phq9: ctx.latest('phq9'), gad7: ctx.latest('gad7'), cssrs: ctx.latest('cssrs') },
        lastActivityAt: ev.at(-1)?.at || null,
      });
    }

    function urgency(v) {
      const lvl = Math.min(3, ...v.openAlerts.map((a) => LEVEL_RANK[a.level]));
      const r = v.routing ? ROUTING_RANK[v.routing] : 2;
      return [lvl, r, -(v.missedStreak || 0)];
    }

    function audit(patientId, action, details) {
      db.audit.push({ id: KK.util.uid('au'), at: nowIso(), patientId, actor: db.doctor.id, action, details: details || {} });
    }

    const api = {
      reset,
      doctor: () => need().doctor,
      setDoctor(patch) { need(); Object.assign(db.doctor, patch); write(); },
      activePatientId: () => need().activePatientId,
      setActivePatient(id) { need(); db.activePatientId = id; write(); },
      patients() {
        need();
        return Object.keys(db.patients).map(view).sort((a, b) => {
          const ua = urgency(a), ub = urgency(b);
          for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) return ua[i] - ub[i];
          return a.name.localeCompare(b.name, 'ru');
        });
      },
      patient: (id) => (need(), view(id)),
      signals: (id) => (need(), signalsFor(id)),
      events(id, type) { need(); const ev = db.events[id] || []; return type ? ev.filter((e) => e.type === type) : ev.slice(); },
      addEvent(patientId, type, payload) {
        need();
        if (!db.patients[patientId]) throw new Error(`Unknown patient ${patientId}`);
        const p = type === 'scale' ? KK.scales.score(payload.scaleId, payload.answers) : payload;
        const e = { id: KK.util.uid('ev'), type, at: nowIso(), payload: p };
        db.events[patientId].push(e);
        syncAlerts(patientId, e.at);
        write();
        return e;
      },
      alerts({ patientId, open } = {}) {
        need();
        return db.alerts
          .filter((a) => (!patientId || a.patientId === patientId) && (!open || !a.ackAt))
          .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || new Date(b.createdAt) - new Date(a.createdAt));
      },
      markDelivered(alertId) {
        need(); const a = db.alerts.find((x) => x.id === alertId);
        if (a && !a.deliveredAt) { a.deliveredAt = nowIso(); write(); }
      },
      ackAlert(alertId, action) {
        need(); const a = db.alerts.find((x) => x.id === alertId);
        if (!a) return;
        a.ackAt = nowIso(); a.ackAction = action || 'Просмотрено';
        if (!a.deliveredAt) a.deliveredAt = a.ackAt;
        audit(a.patientId, 'ack_alert', { alertId, ruleId: a.ruleId, action: a.ackAction });
        write();
      },
      confirm(patientId, action, details = {}) {
        need();
        const p = db.patients[patientId];
        if (!p) throw new Error(`Unknown patient ${patientId}`);
        if (action === 'confirm_plan') {
          const v = view(patientId);
          if (v.therapy?.eligible === false && !p.plan.offLabel) {
            throw new Error('Есть противопоказание: назначение возможно только как решение врача вне инструкции (off_label)');
          }
          p.plan.status = 'confirmed'; p.plan.confirmedAt = nowIso();
        } else if (action === 'off_label') {
          p.plan.offLabel = { at: nowIso(), reason: details.reason || '' };
        } else if (action === 'cancel_plan') {
          p.plan.status = 'cancelled'; p.plan.cancelledAt = nowIso();
        } else if (action === 'change_plan') {
          Object.assign(p.plan, details.patch || {});
        } else if (action === 'confirm_routing') {
          p.routingConfirmed = { at: nowIso(), level: details.level, to: details.to || 'психиатр', note: details.note || '' };
        } else {
          throw new Error(`Unknown action ${action}`);
        }
        audit(patientId, action, details);
        write();
      },
      audit: (patientId) => (need(), db.audit.filter((a) => !patientId || a.patientId === patientId)),
      messages: (id) => (need(), (db.messages[id] || []).slice()),
      sendMessage(patientId, from, text) {
        need();
        const m = { id: KK.util.uid('msg'), at: nowIso(), from, text: String(text).slice(0, 2000) };
        (db.messages[patientId] = db.messages[patientId] || []).push(m);
        write();
        return m;
      },
      importParsed(patientId, parsed) {
        need();
        const p = db.patients[patientId];
        p.labs = Object.assign({}, p.labs, parsed.labs);
        for (const m of parsed.meds) if (!p.meds.some((x) => x.name.toLowerCase().startsWith(m.name.toLowerCase()))) p.meds.push(m);
        for (const d of parsed.diagnoses) if (!p.diagnoses.some((x) => x.code === d.code)) p.diagnoses.push(d);
        for (const c of parsed.conditions) if (!p.conditions.includes(c)) p.conditions.push(c);
        ['age', 'sex', 'pregnant', 'lactating', 'postCovid'].forEach((k) => { if (parsed[k] != null) p[k] = parsed[k]; });
        if (parsed.history) p.history = Object.assign({}, p.history, parsed.history);
        audit(patientId, 'import_history', { fields: Object.keys(parsed).filter((k) => k !== 'spans') });
        syncAlerts(patientId, nowIso());
        write();
      },
      subscribe(fn) {
        listeners.add(fn);
        const onStorage = (e) => { if (e.key === KEY) { db = read(); fn(); } };
        if (typeof g.addEventListener === 'function') g.addEventListener('storage', onStorage);
        return () => { listeners.delete(fn); if (typeof g.removeEventListener === 'function') g.removeEventListener('storage', onStorage); };
      },
    };
    return api;
  }

  KK.createStore = createStore;
  if (typeof window !== 'undefined' && window.localStorage) {
    KK.store = createStore({ storage: window.localStorage, clock: () => new Date() });
  }
})(typeof window !== 'undefined' ? window : globalThis);
