(function (g) {
  const KK = g.KK;
  const KEY = 'kk:v1';
  const LEVEL_RANK = { critical: 0, important: 1, task: 2, info: 3 };
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
  const CHANNELS = ['max', 'telegram', 'web'];
  const LINK_CODE_TTL = 10 * 60000; // код переезда на сайт: 10 минут, одно гашение
  const CONSENT_VERSION = '1';
  const PLAN_LOCKED = ['status', 'confirmedAt', 'cancelledAt', 'offLabel'];
  const VERSION = 3;
  const PSYCHOLOGIST = { id: 'psy1', name: 'Мария Белова', specialty: 'клинический психолог' };
  // Первичный приём психолога: части батареи (C-SSRS, TIPI-10, DASS-21 — события scale с context 'intake').
  const INTAKE_SCALES = { cssrs: 'cssrs', tipi: 'tipi10', dass: 'dass21' };
  const INTAKE_REQUIRED = ['form', 'cssrs', 'tipi', 'dass'];
  const INTAKE_LEVELS = ['psychiatrist_required', 'psychotherapy_desirable', 'consultation', 'observation'];
  const DRAFT_PREFIX = 'kk:intake-draft:';
  // Клиника: сотрудники, приглашения, одноразовые коды, ссылки восстановления (спек регистрации §4).
  const STAFF_ROLES = ['doctor', 'psychologist', 'admin'];
  const INVITE_TTL = 72 * 3600000;
  const OTP_TTL = 5 * 60000;
  const OTP_ATTEMPTS = 5;
  const RESET_TTL = 30 * 60000;
  const TOKEN_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const INVITE_TEXT = {
    expired: 'Срок приглашения истёк. Попросите администратора клиники отправить приглашение ещё раз',
    used: 'Это приглашение уже использовано. Войдите с рабочей почтой',
    revoked: 'Приглашение отозвано. Попросите администратора клиники отправить новое',
    unknown: 'Приглашение не найдено. Проверьте ссылку или попросите администратора клиники отправить новое',
  };
  const DENIED = 'Не получилось войти. Проверьте почту или обратитесь к администратору клиники';
  // Коды и токены — из криптостойкого генератора, если он есть.
  function rnd(n, abc) {
    const c = g.crypto && g.crypto.getRandomValues ? g.crypto.getRandomValues(new Uint32Array(n))
      : Array.from({ length: n }, () => Math.floor(Math.random() * 4294967296));
    return Array.from(c, (x) => abc[x % abc.length]).join('');
  }
  const seedClinic = (now) => ({
    name: 'Клиника «Демо»',
    staff: [
      { id: 'adm1', email: 'admin@clinic.demo', role: 'admin', name: 'Анна Смирнова', specialty: 'администратор клиники', phone: '+79000000001', status: 'active', frmrChecked: false, createdAt: now, activatedAt: now },
      { id: 'd1', email: 'elena.ivanova@clinic.demo', role: 'doctor', name: 'Елена Иванова', specialty: 'терапевт', phone: '+79000000002', status: 'active', frmrChecked: true, createdAt: now, activatedAt: now },
      { id: 'psy1', email: 'maria.belova@clinic.demo', role: 'psychologist', name: 'Мария Белова', specialty: 'клинический психолог', phone: '+79000000003', status: 'active', frmrChecked: true, createdAt: now, activatedAt: now },
    ],
    invites: [], otps: [], resets: [],
  });
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
        patients: {}, events: {}, alerts: [], audit: [], messages: {}, inbox: [], clinic: seedClinic(now) };
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
        // v3: телефоны сценарных пациентов (вход по номеру); ненормализованный номер заменяем.
        if (s.patient.phone && !/^\+7\d{10}$/.test(p.phone || '')) p.phone = s.patient.phone;
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
        // Плановые задачи и информационные сигналы не поднимают алерт: они видны в карте и очереди, без уведомления.
        if (s.level === 'info' || s.level === 'task') continue;
        const fingerprint = `${s.ruleId}|${s.error ? 'error|' : ''}${s.basis || 'profile:' + profileHash(p)}`;
        const exists = db.alerts.some((a) => a.patientId === id && a.ruleId === s.ruleId &&
          (a.fingerprint ? a.fingerprint === fingerprint : !a.ackAt));
        if (exists) continue;
        db.alerts.push({ id: KK.util.uid('al'), patientId: id, ruleId: s.ruleId, level: s.level, routing: s.routing,
          title: s.title, text: s.text, source: s.source, origin: s.origin || null, ruleVersion: s.version || null, fingerprint, error: !!s.error, dataAt,
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

    // Очередь по спеку: критический алерт → «обязательно к психиатру» → важные алерты → «желательно» и плановые задачи → остальные.
    function urgency(v) {
      const lvl = Math.min(3, ...v.openAlerts.map((a) => LEVEL_RANK[a.level]));
      const task = v.signals.some((s) => s.level === 'task');
      const tier = lvl === 0 ? 0 : v.routing === 'required' ? 1 : lvl === 1 ? 2 : v.routing === 'desirable' || task ? 3 : 4;
      return [tier, -(v.missedStreak || 0)];
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
    // Данные клиники появляются лениво: у сохранённых раньше демо их нет.
    const clinic = () => { if (!db.clinic) db.clinic = seedClinic(nowIso()); return db.clinic; };
    const expired = (iso) => +new Date(iso) <= +clock();
    const inviteState = (i) => (i.usedAt ? 'used' : i.revokedAt ? 'revoked' : expired(i.expiresAt) ? 'expired' : 'pending');
    const copy = (x) => (x ? Object.assign({}, x) : null);
    const failWith = (reason, text) => { const e = new Error(text); e.reason = reason; throw e; };
    const findInvite = (token) => clinic().invites.find((i) => i.token === String(token || '')) || null;
    function newInvite(email, role, by) {
      const inv = { token: rnd(24, TOKEN_ABC), email, role, by, createdAt: nowIso(), expiresAt: new Date(+clock() + INVITE_TTL).toISOString(), usedAt: null, revokedAt: null };
      clinic().invites.push(inv);
      return inv;
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
        // Повтор из очереди синхронизации с тем же clientId не создаёт второе событие.
        if (opts && opts.clientId) {
          const dup = (db.events[patientId] || []).find((x) => x.clientId === String(opts.clientId));
          if (dup) return dup;
        }
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
        if (opts && opts.clientId) e.clientId = String(opts.clientId);
        if (opts && opts.channel) e.channel = String(opts.channel);
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
        audit(a.patientId, 'ack_alert', { alertId, ruleId: a.ruleId, action: act, role, ruleVersion: a.ruleVersion || null }, actor);
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
      // opts.clientId — ключ идемпотентности из очереди отправки: повтор не создаёт второе сообщение.
      sendMessage(patientId, from, text, opts = {}) {
        need();
        if (!has(patientId)) throw new Error(`Unknown patient ${patientId}`);
        if (opts && opts.clientId) {
          const dup = (db.messages[patientId] || []).find((x) => x.clientId === String(opts.clientId));
          if (dup) return dup;
        }
        const m = { id: KK.util.uid('msg'), at: nowIso(), from, text: String(text).slice(0, 2000) };
        if (opts && opts.clientId) m.clientId = String(opts.clientId);
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
      // Каналы, через которые пациент ведёт дневник. История хранится по пациенту, а не по каналу.
      channels: (id) => (need(), has(id) ? (db.patients[id].channels || []).filter((c) => !c.revokedAt).map((c) => Object.assign({}, c)) : []),
      linkChannel(id, channel) {
        need();
        if (!has(id)) throw new Error(`Unknown patient ${id}`);
        if (!CHANNELS.includes(channel)) throw new Error(`Неизвестный канал ${channel}`);
        const p = db.patients[id];
        p.channels = p.channels || [];
        const cur = p.channels.find((c) => c.channel === channel && !c.revokedAt);
        if (cur) return Object.assign({}, cur);
        const c = { channel, linkedAt: nowIso(), revokedAt: null };
        p.channels.push(c);
        audit(id, 'channel_linked', { channel }, 'patient');
        write();
        return Object.assign({}, c);
      },
      unlinkChannel(id, channel) {
        need();
        const cur = has(id) && (db.patients[id].channels || []).find((c) => c.channel === channel && !c.revokedAt);
        if (!cur) return false;
        cur.revokedAt = nowIso();
        audit(id, 'channel_unlinked', { channel }, 'patient');
        write();
        return true;
      },
      createLinkCode(id) {
        need();
        if (!has(id)) throw new Error(`Unknown patient ${id}`);
        const now = +clock();
        db.linkCodes = (db.linkCodes || []).filter((c) => !c.usedAt && +new Date(c.expiresAt) > now);
        let code;
        do { code = String(Math.floor(100000 + Math.random() * 900000)); } while (db.linkCodes.some((c) => c.code === code));
        const rec = { code, patientId: id, createdAt: nowIso(), expiresAt: new Date(now + LINK_CODE_TTL).toISOString(), usedAt: null };
        db.linkCodes.push(rec);
        write();
        return { code, expiresAt: rec.expiresAt };
      },
      redeemLinkCode(code, channel = 'web') {
        need();
        const fail = (reason, text) => { const e = new Error(text); e.reason = reason; throw e; };
        const rec = (db.linkCodes || []).find((c) => c.code === String(code).trim());
        if (!rec) fail('unknown', 'Код не найден. Проверьте цифры или получите новый код');
        if (rec.usedAt) fail('used', 'Этот код уже использован. Получите новый код в приложении');
        if (+new Date(rec.expiresAt) <= +clock()) fail('expired', 'Срок действия кода истёк. Получите новый код в приложении');
        // Сначала проверки, потом гашение: ошибка канала не должна сжигать код.
        if (!CHANNELS.includes(channel)) throw new Error(`Неизвестный канал ${channel}`);
        if (!has(rec.patientId)) fail('unknown', 'Пациент для этого кода не найден');
        api.linkChannel(rec.patientId, channel); // need() внутри перечитывает db, поэтому код гасим после
        const fresh = (db.linkCodes || []).find((c) => c.code === rec.code);
        if (fresh) { fresh.usedAt = nowIso(); write(); }
        return rec.patientId;
      },
      recordConsents(id, kinds) {
        need();
        if (!has(id)) throw new Error(`Unknown patient ${id}`);
        const at = nowIso();
        db.patients[id].consents = kinds.map((kind) => ({ kind, at, version: CONSENT_VERSION }));
        audit(id, 'consents_recorded', { kinds }, 'patient');
        write();
      },
      // Снимок пациента для пакета переноса (assets/bundle.js): копия, без общих алертов и кодов.
      snapshot(id) {
        need();
        if (!has(id)) throw new Error(`Unknown patient ${id}`);
        const copy = (x) => JSON.parse(JSON.stringify(x));
        return { patient: copy(db.patients[id]), events: copy(db.events[id] || []), messages: copy(db.messages[id] || []),
          audit: copy(db.audit.filter((a) => a.patientId === id)) };
      },
      // Восстановить пациента из снимка: новый пациент создаётся, у существующего добавляются только новые записи.
      restore({ patient, events = [], messages = [], audit: au = [] } = {}) {
        need();
        const id = patient && patient.id;
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || id in Object.prototype) throw new Error('Пакет без пациента');
        // Форма проверяется целиком до первой записи: битый пакет не должен менять хранилище.
        const bad = () => { throw new Error('Пакет повреждён'); };
        if (!Array.isArray(events) || !Array.isArray(messages) || !Array.isArray(au)) bad();
        for (const e of events) {
          if (!e || typeof e.id !== 'string' || !e.id || typeof e.type !== 'string' || typeof e.at !== 'string' || Number.isNaN(+new Date(e.at)) ||
            !e.payload || typeof e.payload !== 'object') bad();
        }
        for (const m of messages) if (!m || typeof m.id !== 'string' || !m.id) bad();
        for (const a of au) if (!a || typeof a.id !== 'string' || !a.id) bad();
        if (has(id) && db.patients[id].name !== patient.name) throw new Error('Пакет принадлежит другому пациенту');
        if (!has(id)) { db.patients[id] = Object.assign({}, patient); db.events[id] = []; }
        if (!Object.hasOwn(db.events, id)) db.events[id] = [];
        if (!Object.hasOwn(db.messages, id)) db.messages[id] = [];
        const list = db.events[id];
        // clientId уникален в пределах пациента; принятые id и clientId сразу попадают в seen (дубли внутри пакета).
        const seen = new Set(list.flatMap((e) => [e.id, e.clientId].filter(Boolean)));
        for (const e of events) {
          if (seen.has(e.id) || (e.clientId && seen.has(e.clientId))) continue;
          seen.add(e.id); if (e.clientId) seen.add(e.clientId);
          list.push(Object.assign({}, e));
        }
        list.sort((a, b) => new Date(a.at) - new Date(b.at));
        const msgIds = new Set(db.messages[id].map((m) => m.id));
        for (const m of messages) if (!msgIds.has(m.id)) { msgIds.add(m.id); db.messages[id].push(Object.assign({}, m)); }
        const auIds = new Set(db.audit.map((a) => a.id));
        for (const a of au) if (!auIds.has(a.id)) { auIds.add(a.id); db.audit.push(Object.assign({}, a, { patientId: id })); }
        syncAlerts(id, nowIso());
        write();
        return id;
      },
      clinicInfo: () => ({ name: (need(), clinic()).name }),
      staff: () => (need(), clinic().staff.map(copy)),
      staffById: (id) => (need(), copy(clinic().staff.find((x) => x.id === id))),
      staffByEmail: (email) => { need(); const e = String(email || '').trim().toLowerCase(); return copy(clinic().staff.find((x) => x.email === e)); },
      invites: () => (need(), clinic().invites.map((i) => Object.assign({}, i, { state: inviteState(i) }))),
      inviteText: (state) => INVITE_TEXT[state] || INVITE_TEXT.unknown,
      inviteStaff(email, role, by = 'adm1') {
        need();
        const e = String(email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new Error('Проверьте адрес почты');
        if (!STAFF_ROLES.includes(role)) throw new Error(`Неизвестная роль ${role}`);
        if (clinic().staff.some((x) => x.email === e)) throw new Error('Сотрудник с этой почтой уже есть в клинике');
        // Новое приглашение на ту же почту отменяет прежнее, ещё не принятое.
        clinic().invites.filter((i) => i.email === e && inviteState(i) === 'pending').forEach((i) => { i.revokedAt = nowIso(); });
        const inv = newInvite(e, role, by);
        write();
        return Object.assign({}, inv, { state: 'pending' });
      },
      inviteInfo(token) {
        need();
        const inv = findInvite(token);
        if (!inv) return { state: 'unknown' };
        return { state: inviteState(inv), email: inv.email, role: inv.role, clinic: clinic().name, expiresAt: inv.expiresAt };
      },
      resendInvite(token) {
        need();
        const inv = findInvite(token);
        const st = inv ? inviteState(inv) : 'unknown';
        if (st !== 'pending' && st !== 'expired') failWith(st, INVITE_TEXT[st] || INVITE_TEXT.unknown);
        if (clinic().staff.some((x) => x.email === inv.email)) throw new Error('Сотрудник с этой почтой уже есть в клинике');
        clinic().invites.filter((i) => i.email === inv.email && inviteState(i) === 'pending').forEach((i) => { i.revokedAt = nowIso(); });
        inv.revokedAt = nowIso();
        const next = newInvite(inv.email, inv.role, inv.by);
        write();
        return Object.assign({}, next, { state: 'pending' });
      },
      revokeInvite(token) {
        need();
        const inv = findInvite(token);
        if (!inv || inviteState(inv) !== 'pending') return false;
        inv.revokedAt = nowIso();
        write();
        return true;
      },
      acceptInvite(token, { name, specialty, phone } = {}) {
        need();
        const inv = findInvite(token);
        const st = inv ? inviteState(inv) : 'unknown';
        if (st !== 'pending') failWith(st, INVITE_TEXT[st]);
        if (clinic().staff.some((x) => x.email === inv.email)) throw new Error('Сотрудник с этой почтой уже есть в клинике');
        const nm = String(name || '').trim();
        if (nm.length < 3) throw new Error('Укажите фамилию и имя');
        if (!phone) throw new Error('Укажите телефон для подтверждения входа');
        const spec = inv.role === 'psychologist' ? 'клинический психолог' : inv.role === 'admin' ? 'администратор клиники' : String(specialty || '').trim();
        if (!spec) throw new Error('Выберите специальность');
        const prefix = inv.role === 'doctor' ? 'd' : inv.role === 'psychologist' ? 'psy' : 'adm';
        const s = { id: KK.util.uid(prefix), email: inv.email, role: inv.role, name: nm, specialty: spec, phone, status: 'active', frmrChecked: false, createdAt: inv.createdAt, activatedAt: nowIso() };
        clinic().staff.push(s);
        inv.usedAt = nowIso();
        write();
        return copy(s);
      },
      // Администратор меняет только статус и отметку ФРМР.
      setStaff(id, patch = {}) {
        need();
        const s = clinic().staff.find((x) => x.id === id);
        if (!s) throw new Error(`Нет сотрудника ${id}`);
        const keys = Object.keys(patch);
        if (keys.some((k) => k !== 'status' && k !== 'frmrChecked')) throw new Error('Нельзя изменить это поле');
        if ('status' in patch && !['active', 'blocked'].includes(patch.status)) throw new Error('Неизвестный статус');
        if (patch.status === 'blocked' && s.role === 'admin' && s.status === 'active'
          && !clinic().staff.some((x) => x.id !== id && x.role === 'admin' && x.status === 'active')) throw new Error('Нельзя заблокировать последнего администратора клиники');
        if ('status' in patch) s.status = patch.status;
        if ('frmrChecked' in patch) s.frmrChecked = !!patch.frmrChecked;
        write();
        return copy(s);
      },
      // Вход специалиста: пароль в демо не хранится, проверяем только, что сотрудник активен.
      staffLoginCheck(email) {
        const s = api.staffByEmail(email);
        if (!s || s.status !== 'active') failWith('denied', DENIED);
        return s;
      },
      requestOtp(target, purpose) {
        need();
        const c = clinic();
        c.otps = (c.otps || []).filter((o) => !o.usedAt && !expired(o.expiresAt) && !(o.target === target && o.purpose === purpose));
        const o = { target, purpose, code: rnd(6, '0123456789'), expiresAt: new Date(+clock() + OTP_TTL).toISOString(), attempts: 0, usedAt: null };
        c.otps.push(o);
        write();
        return { code: o.code, expiresAt: o.expiresAt };
      },
      verifyOtp(target, purpose, code) {
        need();
        const o = (clinic().otps || []).find((x) => x.target === target && x.purpose === purpose && !x.usedAt);
        if (!o) failWith('missing', 'Запросите код ещё раз');
        if (expired(o.expiresAt)) failWith('expired', 'Срок действия кода истёк. Запросите новый');
        if (o.attempts >= OTP_ATTEMPTS) failWith('attempts', 'Слишком много попыток. Запросите новый код');
        if (String(code || '').replace(/\D/g, '') !== o.code) {
          o.attempts += 1;
          write();
          const left = OTP_ATTEMPTS - o.attempts;
          if (left <= 0) failWith('attempts', 'Слишком много попыток. Запросите новый код');
          failWith('wrong', `Код не подошёл. Осталось попыток: ${left}`);
        }
        o.usedAt = nowIso();
        write();
        return true;
      },
      findPatientByPhone: (phone) => (need(), phone ? Object.keys(db.patients).find((id) => db.patients[id].phone === phone) || null : null),
      setPatientPhone(id, phone) {
        need();
        if (!phone) throw new Error('Укажите телефон');
        if (!has(id)) throw new Error(`Unknown patient ${id}`);
        if (Object.keys(db.patients).some((k) => k !== id && db.patients[k].phone === phone)) failWith('taken', 'Этот номер уже привязан к дневнику. Войдите по номеру телефона');
        db.patients[id].phone = phone;
        audit(id, 'phone_verified', {}, 'patient');
        write();
      },
      // Ссылка восстановления специалиста. null — почты нет или сотрудник не активен (страница об этом не говорит).
      createReset(email) {
        need();
        const e = String(email || '').trim().toLowerCase();
        const s = clinic().staff.find((x) => x.email === e && x.status === 'active');
        if (!s) return null;
        const c = clinic();
        // Прежние неиспользованные ссылки этого сотрудника гасим.
        (c.resets || []).forEach((r) => { if (r.staffId === s.id && !r.usedAt) r.usedAt = nowIso(); });
        c.resets = (c.resets || []).filter((r) => !r.usedAt && !expired(r.expiresAt));
        const r = { token: rnd(24, TOKEN_ABC), staffId: s.id, expiresAt: new Date(+clock() + RESET_TTL).toISOString(), usedAt: null };
        c.resets.push(r);
        write();
        return { token: r.token };
      },
      resetInfo(token) {
        need();
        const r = (clinic().resets || []).find((x) => x.token === String(token || ''));
        if (!r || r.usedAt || expired(r.expiresAt)) return null;
        const s = clinic().staff.find((x) => x.id === r.staffId && x.status === 'active');
        return s ? { staffId: s.id, email: s.email, phone: s.phone } : null;
      },
      completeReset(token) {
        need();
        const r = (clinic().resets || []).find((x) => x.token === String(token || ''));
        if (!r || r.usedAt || expired(r.expiresAt)) throw new Error('Ссылка недействительна. Запросите восстановление ещё раз');
        const s = clinic().staff.find((x) => x.id === r.staffId && x.status === 'active');
        if (!s) throw new Error('Ссылка недействительна. Запросите восстановление ещё раз');
        r.usedAt = nowIso();
        write();
        return api.staffById(r.staffId);
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
