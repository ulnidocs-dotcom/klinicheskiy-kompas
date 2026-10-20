(function (g) {
  const KK = g.KK;
  const KEY = 'kk:v1';
  const LEVEL_RANK = { critical: 0, important: 1, info: 2 };
  const ROUTING_RANK = { required: 0, desirable: 1 };
  const PROFILE_KEYS = ['age', 'sex', 'pregnant', 'lactating', 'postCovid', 'labs', 'meds', 'allergies', 'conditions', 'diagnoses', 'history', 'plan', 'maoiStoppedDaysAgo'];
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  // Сигнал без события-основания (противопоказание, анамнез, взаимодействие) идентифицируется профилем пациента.
  const profileHash = (p) => hash(JSON.stringify(PROFILE_KEYS.map((k) => p[k] ?? null)));
  const BACKDATE_TYPES = ['checkin'];
  const BACKDATE_DAYS = 7;
  const PLAN_LOCKED = ['status', 'confirmedAt', 'cancelledAt', 'offLabel'];
  const VERSION = 2;
  const PSYCHOLOGIST = { id: 'psy1', name: 'Мария Белова', specialty: 'клинический психолог' };
  // Первичный приём психолога: части батареи (C-SSRS, TIPI-10, DASS-21 — события scale с context 'intake').
  const INTAKE_SCALES = { cssrs: 'cssrs', tipi: 'tipi10', dass: 'dass21' };
  const INTAKE_REQUIRED = ['form', 'cssrs', 'tipi', 'dass'];
  const INTAKE_LEVELS = ['psychiatrist_required', 'psychotherapy_desirable', 'consultation', 'observation'];
  const DRAFT_PREFIX = 'kk:intake-draft:';
  const levelText = (l) => (KK.data.intake && KK.data.intake.levels[l] ? KK.data.intake.levels[l].label : l);

  function createStore({ storage, clock }) {
    const listeners = new Set();
    const nowIso = () => clock().toISOString();
    const read = () => { try { return JSON.parse(storage.getItem(KEY)) || null; } catch (e) { return null; } };
    let db = read();
    const write = () => { storage.setItem(KEY, JSON.stringify(db)); listeners.forEach((fn) => fn()); };
    // Перед каждой операцией перечитываем хранилище: другая вкладка могла записать свежие данные.
    const need = () => { db = read() || db; if (!db) reset(); else if (!(db.version >= VERSION)) migrate(); return db; };
    if (typeof g.addEventListener === 'function') {
      g.addEventListener('storage', (e) => {
        if (e.key !== KEY) return;
        db = read() || db;
        listeners.forEach((fn) => fn());
      });
    }

    function addScenario(s, now) {
      const p = KK.data.materializePatient(s.patient, now);
      p.scenarioId = s.id; p.doctorId = 'd1';
      db.patients[p.id] = p;
      db.events[p.id] = KK.data.expandSeed(s.seed, now).map((e) => Object.assign({ id: KK.util.uid('ev') }, e));
      db.messages[p.id] = [];
      syncAlerts(p.id, db.events[p.id].at(-1)?.at || now);
    }

    // Черновики первичной беседы на этом устройстве (kk:intake-draft:*) — сбрасываются вместе с демо.
    function clearDrafts() {
      try {
        if (typeof storage.key !== 'function') return;
        const ks = [];
        for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith(DRAFT_PREFIX)) ks.push(k); }
        ks.forEach((k) => storage.removeItem(k));
      } catch (e) { /* приватный режим */ }
    }

    function reset() {
      clearDrafts();
      const now = nowIso();
      db = { version: VERSION, createdAt: now, activePatientId: 'p_anna',
        doctor: { id: 'd1', name: 'Елена Иванова', specialty: 'терапевт', mode: 'nonPsychiatrist' },
        psychologist: Object.assign({}, PSYCHOLOGIST),
        patients: {}, events: {}, alerts: [], audit: [], messages: {}, inbox: [] };
      for (const s of KK.data.scenarios) addScenario(s, now);
      write();
    }

    // Данные первой версии (без психолога): сохраняем всё, добавляем профиль психолога, новые сценарии
    // и назначенный первичный приём сценарным пациентам, у которых его ещё нет.
    function migrate() {
      const now = nowIso();
      db.psychologist = db.psychologist || Object.assign({}, PSYCHOLOGIST);
      db.inbox = db.inbox || [];
      for (const s of KK.data.scenarios) {
        if (!Object.hasOwn(db.patients, s.patient.id)) { addScenario(s, now); continue; }
        const p = db.patients[s.patient.id];
        if (s.patient.intake && !p.intake) p.intake = KK.data.materializePatient(s.patient, now).intake;
      }
      db.version = VERSION;
      // Без уведомления подписчиков: миграция идёт внутри need(), часто посреди отрисовки.
      storage.setItem(KEY, JSON.stringify(db));
    }

    // Только собственные ключи: id из URL вида "__proto__" не должен находить Object.prototype.
    const has = (id) => typeof id === 'string' && Object.hasOwn(db.patients, id);

    function signalsFor(id) {
      const p = db.patients[id];
      return KK.rules.evaluate(KK.rules.buildContext(p, db.events[id] || [], nowIso()));
    }

    // Отпечаток = правило + основание (время события-триггера или профиль пациента).
    // Подтверждённый алерт не поднимается заново, пока не появится новое основание.
    function syncAlerts(id, dataAt) {
      const p = db.patients[id];
      for (const s of signalsFor(id)) {
        if (s.level === 'info') continue;
        const fingerprint = `${s.ruleId}|${s.error ? 'error|' : ''}${s.basis || 'profile:' + profileHash(p)}`;
        const exists = db.alerts.some((a) => a.patientId === id && a.ruleId === s.ruleId &&
          (a.fingerprint ? a.fingerprint === fingerprint : !a.ackAt));
        if (exists) continue;
        db.alerts.push({ id: KK.util.uid('al'), patientId: id, ruleId: s.ruleId, level: s.level, routing: s.routing,
          title: s.title, text: s.text, source: s.source, origin: s.origin || null, fingerprint, error: !!s.error, dataAt,
          createdAt: nowIso(), deliveredAt: null, ackAt: null, ackAction: null });
      }
    }

    function view(id) {
      if (!has(id)) return null;
      const p = db.patients[id];
      const signals = signalsFor(id);
      const ev = db.events[id] || [];
      const ctx = KK.rules.buildContext(p, ev, nowIso());
      return Object.assign(JSON.parse(JSON.stringify(p)), {
        // Решение психолога «психиатр — обязательно» поднимает маршрутизацию и срочность в очереди врача.
        signals, routing: p.intake?.decision?.level === 'psychiatrist_required' ? 'required' : KK.rules.routing(signals),
        openAlerts: db.alerts.filter((a) => a.patientId === id && !a.ackAt),
        therapy: ctx.therapy, pdc14: ctx.pdc14, missedStreak: ctx.missedStreak, intakeStatus: intakeStatus(id),
        // C-SSRS врача и самоотчёт первичного приёма — раздельно; риск в правилах — максимум из двух.
        latest: { phq9: ctx.latest('phq9'), gad7: ctx.latest('gad7'), cssrs: cssrsOf(ev, false), cssrsIntake: cssrsOf(ev, true) },
        intakeRoute: p.intake?.decision?.level || null,
        lastActivityAt: ev.at(-1)?.at || null,
      });
    }

    function cssrsOf(ev, intake) {
      const e = ev.filter((x) => x.type === 'scale' && x.payload.scaleId === 'cssrs' && (x.payload.context === 'intake') === intake).at(-1);
      return e ? Object.assign({ at: e.at }, e.payload) : null;
    }

    function urgency(v) {
      const lvl = Math.min(3, ...v.openAlerts.map((a) => LEVEL_RANK[a.level]));
      const r = v.routing ? ROUTING_RANK[v.routing] : 2;
      return [lvl, r, -(v.missedStreak || 0)];
    }

    function audit(patientId, action, details, actor) {
      db.audit.push({ id: KK.util.uid('au'), at: nowIso(), patientId, actor: actor || db.doctor.id, action, details: details || {} });
    }

    // Последние части батареи после назначения приёма: { form, cssrs, tipi, dass, cto } (payload или null).
    function intakeParts(id) {
      const p = db.patients[id];
      if (!p || !p.intake) return null;
      const from = p.intake.assignedAt ? +new Date(p.intake.assignedAt) : -Infinity;
      const ev = (db.events[id] || []).filter((e) => +new Date(e.at) >= from);
      const last = (pred) => { const e = ev.filter(pred).at(-1); return e ? e : null; };
      const parts = { form: last((e) => e.type === 'intake_form'), cto: last((e) => e.type === 'cto') };
      for (const [k, sid] of Object.entries(INTAKE_SCALES)) {
        parts[k] = last((e) => e.type === 'scale' && e.payload.scaleId === sid && (sid !== 'cssrs' || e.payload.context === 'intake'));
      }
      return parts;
    }
    function intakeStatus(id) {
      const p = db.patients[id];
      if (!p || !p.intake) return null;
      if (p.intake.decision) return 'decided';
      if (p.intake.completedAt) return 'completed';
      const parts = intakeParts(id);
      return Object.values(parts).some(Boolean) ? 'in_progress' : 'assigned';
    }
    function pushEvent(patientId, type, payload) {
      const e = { id: KK.util.uid('ev'), type, at: nowIso(), recordedAt: nowIso(), payload };
      db.events[patientId].push(e);
      return e;
    }

    const api = {
      reset,
      doctor: () => need().doctor,
      psychologist: () => need().psychologist || Object.assign({}, PSYCHOLOGIST),
      setPsychologist(patch) { need(); db.psychologist = Object.assign({}, PSYCHOLOGIST, db.psychologist, patch); write(); },
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
      signals: (id) => (need(), has(id) ? signalsFor(id) : []),
      events(id, type) { need(); const ev = has(id) ? db.events[id] || [] : []; return type ? ev.filter((e) => e.type === type) : ev.slice(); },
      // opts.at — отметка задним числом: только самочувствие (checkin), не в будущем и не раньше 7 календарных дней назад.
      // Событие встаёт в ленту по времени; recordedAt — момент записи (по нему «последняя отметка дня» побеждает).
      addEvent(patientId, type, payload, opts = {}) {
        need();
        if (!has(patientId)) throw new Error(`Unknown patient ${patientId}`);
        const now = nowIso();
        let at = now;
        if (opts && opts.at != null) {
          if (!BACKDATE_TYPES.includes(type)) throw new Error(`Задним числом можно отметить только самочувствие, не ${type}`);
          const t = new Date(opts.at);
          if (Number.isNaN(+t)) throw new Error(`Некорректная дата ${opts.at}`);
          if (+t > +new Date(now)) throw new Error(`Нельзя отметить будущее время ${opts.at}`);
          const floor = new Date(now); floor.setHours(0, 0, 0, 0);
          if (+t < +floor - BACKDATE_DAYS * KK.util.DAY) throw new Error(`Отметка старше ${BACKDATE_DAYS} дней: ${opts.at}`);
          at = t.toISOString();
        }
        const p = type === 'scale' ? KK.scales.score(payload.scaleId, payload.answers) : payload;
        if (type === 'scale' && payload.context) p.context = String(payload.context);
        const e = { id: KK.util.uid('ev'), type, at, recordedAt: now, payload: p };
        const list = db.events[patientId];
        let k = list.length;
        while (k > 0 && new Date(list[k - 1].at) > new Date(at)) k--;
        list.splice(k, 0, e);
        syncAlerts(patientId, e.at);
        write();
        return e;
      },
      // Снять ошибочную отметку приёма: только своё событие dose за сегодня, иначе — исключение.
      removeEvent(patientId, eventId) {
        need();
        if (!has(patientId)) throw new Error(`Unknown patient ${patientId}`);
        const list = db.events[patientId] || [];
        const k = list.findIndex((e) => e.id === eventId);
        if (k < 0) throw new Error(`Нет события ${eventId} у пациента ${patientId}`);
        const e = list[k];
        if (e.type !== 'dose') throw new Error(`Снять можно только отметку приёма, не ${e.type}`);
        if (KK.util.dayKey(e.at) !== KK.util.dayKey(nowIso())) throw new Error('Снять можно только сегодняшнюю отметку приёма');
        list.splice(k, 1);
        syncAlerts(patientId, nowIso());
        write();
        return e;
      },
      alerts({ patientId, open } = {}) {
        need();
        return db.alerts
          .filter((a) => (!patientId || a.patientId === patientId) && (!open || !a.ackAt))
          .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || new Date(b.createdAt) - new Date(a.createdAt));
      },
      // Отметка «показано» для отдельной роли (психолог): не трогает доставку врачу.
      markSeen(alertId, role) {
        need(); const a = db.alerts.find((x) => x.id === alertId);
        if (a && !(a.seenBy && a.seenBy[role])) { a.seenBy = Object.assign({}, a.seenBy, { [role]: nowIso() }); write(); }
      },
      markDelivered(alertId) {
        need(); const a = db.alerts.find((x) => x.id === alertId);
        if (a && !a.deliveredAt) { a.deliveredAt = nowIso(); write(); }
      },
      // Подтверждение — по ролям (ackBy.doctor / ackBy.psy). ackAt/deliveredAt — только врач:
      // подтверждение психологом не закрывает алерт для врача и не отменяет его окно.
      ackAlert(alertId, action, actor) {
        need(); const a = db.alerts.find((x) => x.id === alertId);
        if (!a) return;
        const role = actor && actor === (db.psychologist || PSYCHOLOGIST).id ? 'psy' : 'doctor';
        const at = nowIso(), act = action || 'Просмотрено';
        a.ackBy = Object.assign({}, a.ackBy, { [role]: { at, action: act } });
        if (role === 'doctor') {
          a.ackAt = at; a.ackAction = act;
          if (!a.deliveredAt) a.deliveredAt = at;
        }
        audit(a.patientId, 'ack_alert', { alertId, ruleId: a.ruleId, action: act, role }, actor);
        write();
      },
      confirm(patientId, action, details = {}) {
        need();
        if (!has(patientId)) throw new Error(`Unknown patient ${patientId}`);
        const p = db.patients[patientId];
        if (['confirm_plan', 'off_label', 'cancel_plan', 'change_plan'].includes(action) && !p.plan) {
          throw new Error(`У пациента нет плана терапии (no plan): действие ${action} невозможно`);
        }
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
          delete p.plan.offLabel;
        } else if (action === 'change_plan') {
          // Статус и решения врача меняются только своими действиями (confirm_plan / off_label / cancel_plan).
          const patch = Object.assign({}, details.patch || {});
          PLAN_LOCKED.forEach((k) => delete patch[k]);
          Object.assign(p.plan, patch);
        } else if (action === 'confirm_routing') {
          p.routingConfirmed = { at: nowIso(), level: details.level, to: details.to || 'психиатр', note: details.note || '' };
        } else {
          throw new Error(`Unknown action ${action}`);
        }
        audit(patientId, action, details);
        write();
      },
      // ——— Первичный приём психолога ———
      // { intake, status, form, cssrs, tipi, dass, cto, events } — последние части после назначения; null, если приём не назначен.
      intakeOf(id) {
        need();
        if (!has(id) || !db.patients[id].intake) return null;
        const parts = intakeParts(id);
        const pl = (k) => (parts[k] ? JSON.parse(JSON.stringify(parts[k].payload)) : null);
        return { intake: JSON.parse(JSON.stringify(db.patients[id].intake)), status: intakeStatus(id),
          form: pl('form'), cssrs: pl('cssrs'), tipi: pl('tipi'), dass: pl('dass'), cto: pl('cto'),
          at: Object.fromEntries(Object.entries(parts).map(([k, e]) => [k, e ? e.at : null])) };
      },
      // Пациент завершил батарею: нужны анкета, C-SSRS, TIPI-10 и DASS-21 (ЦТО — по желанию).
      // opts.cto — результат ЦТО (или { skipped: true }): записывается только после проверки, чтобы повтор не дублировал.
      completeIntake(id, { cto } = {}) {
        need();
        if (!has(id) || !db.patients[id].intake) throw new Error(`У пациента ${id} нет назначенного первичного приёма`);
        let parts = intakeParts(id);
        const lack = INTAKE_REQUIRED.filter((k) => !parts[k]);
        if (lack.length) throw new Error(`Части батареи не заполнены: ${lack.join(', ')}`);
        const p = db.patients[id];
        if (cto && !p.intake.completedAt) { pushEvent(id, 'cto', cto); parts = intakeParts(id); }
        if (!p.intake.completedAt) p.intake.completedAt = nowIso();
        audit(id, 'intake_completed', { cto: !!parts.cto && !parts.cto.payload.skipped }, id);
        write();
      },
      // Решение психолога по маршруту. Отличие от предложенного уровня — только с причиной. Всё — в аудит.
      confirmIntake(id, { level, note = '', proposed = null } = {}) {
        need();
        if (!has(id) || !db.patients[id].intake) throw new Error(`У пациента ${id} нет назначенного первичного приёма`);
        const p = db.patients[id];
        if (!p.intake.completedAt) throw new Error('Батарея не завершена пациентом: решение пока невозможно');
        if (!INTAKE_LEVELS.includes(level)) throw new Error(`Неизвестный уровень маршрута: ${level}`);
        const text = String(note || '').trim().slice(0, 2000);
        // Предложение пересчитывается по данным (если движок батареи загружен), а не берётся на веру у вызывающего.
        const parts = intakeParts(id);
        const route = KK.battery ? KK.battery.routeIntake({ form: parts.form?.payload || null, cssrs: parts.cssrs?.payload || null, dass: parts.dass?.payload || null }) : null;
        if (route) proposed = route.level;
        // Нет предложения или решение отличается от него — нужна причина.
        const overridden = level !== proposed;
        if (overridden && !text) throw new Error(proposed ? 'Изменение предложенного маршрута требует причины' : 'Маршрут не предложен системой: укажите причину решения');
        const downgrade = !!route && proposed === 'psychiatrist_required' && level !== 'psychiatrist_required' && KK.battery.mandatoryHard(route);
        if (downgrade && text.length < 20) throw new Error('Понижение обязательного маршрута к психиатру (C-SSRS или анкета): причина не короче 20 символов');
        const psy = db.psychologist || PSYCHOLOGIST; // не api.psychologist(): need() перечитал бы db и p устарел бы
        const prev = p.intake.decision;
        p.intake.decision = { at: nowIso(), level, proposed, overridden, note: text, by: psy.id, revision: prev ? (prev.revision || 1) + 1 : 1 };
        if (downgrade) p.intake.decision.downgradeMandatory = true;
        // Сменился маршрут после передачи врачу — передача устарела (история сохраняется), можно передать снова.
        if (p.intake.handoff && p.intake.handoff.level !== level) p.intake.handoff.outdated = true;
        pushEvent(id, 'intake_decision', { level, proposed, overridden, note: text, downgrade_mandatory: downgrade });
        audit(id, 'intake_decision', { level, proposed, overridden, note: text, downgrade_mandatory: downgrade }, psy.id);
        if (downgrade) {
          const why = route.reasons.filter((r) => r.level === 'psychiatrist_required').map((r) => r.text).join('; ');
          (db.inbox = db.inbox || []).push({ id: KK.util.uid('in'), at: nowIso(), from: psy.id, fromName: psy.name, to: p.doctorId || db.doctor.id, patientId: id, kind: 'downgrade',
            text: `Психолог изменил обязательный маршрут к психиатру на «${levelText(level)}». Основания предложения: ${why}. Причина: ${text}` });
        }
        write();
      },
      // «Передать лечащему врачу»: сообщение во входящие врача + отметка в первичном приёме.
      handoffIntake(id, text) {
        need();
        if (!has(id)) throw new Error(`Unknown patient ${id}`);
        const p = db.patients[id];
        if (!p.intake || !p.intake.decision) throw new Error('Сначала примите решение по маршруту');
        const psy = db.psychologist || PSYCHOLOGIST; // не api.psychologist(): need() перечитал бы db и p устарел бы
        const body = String(text || '').slice(0, 4000);
        const m = { id: KK.util.uid('in'), at: nowIso(), from: psy.id, fromName: psy.name, to: p.doctorId || db.doctor.id, patientId: id, kind: 'handoff', text: body };
        (db.inbox = db.inbox || []).push(m);
        if (p.intake.handoff) (p.intake.handoffHistory = p.intake.handoffHistory || []).push(p.intake.handoff);
        p.intake.handoff = { at: m.at, text: body, to: m.to, level: p.intake.decision.level };
        audit(id, 'intake_handoff', { to: m.to }, psy.id);
        write();
        return m;
      },
      inbox: ({ to, patientId, unread } = {}) => (need(), (db.inbox || []).filter((m) => (!to || m.to === to) && (!patientId || m.patientId === patientId) && (!unread || !m.readAt))),
      markInboxRead(msgId) {
        need(); const m = (db.inbox || []).find((x) => x.id === msgId);
        if (m && !m.readAt) { m.readAt = nowIso(); write(); }
      },
      audit: (patientId) => (need(), db.audit.filter((a) => !patientId || a.patientId === patientId)),
      messages: (id) => (need(), has(id) ? (db.messages[id] || []).slice() : []),
      sendMessage(patientId, from, text) {
        need();
        if (!has(patientId)) throw new Error(`Unknown patient ${patientId}`);
        const m = { id: KK.util.uid('msg'), at: nowIso(), from, text: String(text).slice(0, 2000) };
        (db.messages[patientId] = db.messages[patientId] || []).push(m);
        write();
        return m;
      },
      importParsed(patientId, parsed) {
        need();
        if (!has(patientId)) throw new Error(`Unknown patient ${patientId}`);
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
        return () => { listeners.delete(fn); };
      },
    };
    return api;
  }

  KK.createStore = createStore;
  if (typeof window !== 'undefined' && window.localStorage) {
    KK.store = createStore({ storage: window.localStorage, clock: () => new Date() });
  }
})(typeof window !== 'undefined' ? window : globalThis);
