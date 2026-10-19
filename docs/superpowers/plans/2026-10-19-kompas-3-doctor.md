# Клинический компас — План 3: интерфейс врача (desktop / планшет)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 10 экранов врача поверх ядра Плана 1: очередь пациентов по срочности, карточка пациента, оценка на приёме, терапия с проверкой противопоказаний и подтверждением, маршрутизация к психиатру, журнал алертов, импорт истории болезни, сообщения, материалы (источники), профиль с режимом «не-психиатр / психиатр».

**Architecture:** `doctor/<name>.html` + `doctor/<name>.js`; оболочка `assets/doctor.js` (боковое меню, подменю пациента, глобальный модальный критический алерт со звуком, подсказки по режиму, чистые хелперы отрисовки). Стили — `assets/doctor.css`. Все клинические действия — только через `KK.store.confirm` (План 1), каждое пишет аудит.

**Tech Stack:** HTML, CSS (токены `data-role="doctor"`), ванильный JS.

**Зависимость:** План 1 выполнен. План 2 не требуется (независим), но сквозная проверка (Task 12) использует обе роли.

**Принципы врача (спек, разделы 2, 3, 7):**
1. Прерывает работу (модальное окно + звук) только критический алерт; важные — подъём в очереди и плашка; инфо — пассивно.
2. «Обязательно» — сплошная заливка + слово, «Желательно» — пунктирный контур + слово; различимы без цвета.
3. Каждый вывод показывает, по какому правилу и источнику он сделан.
4. Система ничего не назначает: кнопки действий открывают подтверждение, итог пишется в аудит.
5. Эргономика: от очереди до подтверждения направления — ≤ 2 клика.

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `assets/doctor.css` | стили врача |
| `assets/doctor.js` | `KK.doctorApp`: оболочка, модальный алерт, хелперы, подсказки |
| `doctor/index.html/.js` | очередь пациентов |
| `doctor/patient.html/.js` | карточка пациента |
| `doctor/assess.html/.js` | шкалы на приёме |
| `doctor/therapy.html/.js` | терапия и подтверждение назначения |
| `doctor/routing.html/.js` | маршрутизация и направление |
| `doctor/alerts.html/.js` | журнал алертов и времена реакции |
| `doctor/import.html/.js` | разбор истории болезни |
| `doctor/messages.html/.js` | переписка |
| `doctor/materials.html/.js` | КР, инструкция, шкалы, правила |
| `doctor/profile.html/.js` | профиль, специальность, звук, сброс демо |
| `tests/doctor.test.js` | тесты хелперов |

**Шаблон страницы врача** (каждая `doctor/*.html`, меняются `<title>`, `data-nav` и последний скрипт):
```html
<!doctype html>
<html lang="ru" data-role="doctor">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Пациенты · Компас</title>
<link rel="stylesheet" href="../assets/tokens.css"><link rel="stylesheet" href="../assets/ui.css"><link rel="stylesheet" href="../assets/doctor.css">
</head>
<body data-nav="patients">
<div class="d-app"><aside class="d-side" id="side"></aside><main class="d-main" id="app"></main></div>
<div id="modal-root"></div>
<script src="../assets/kk.js"></script>
<script src="../data/scales.js"></script><script src="../data/drugs/classes.js"></script><script src="../data/drugs/aviandr.js"></script>
<script src="../data/rules/core.js"></script><script src="../data/scenarios.js"></script>
<script src="../assets/scales.js"></script><script src="../assets/therapy.js"></script><script src="../assets/adherence.js"></script>
<script src="../assets/rules.js"></script><script src="../assets/parser.js"></script><script src="../assets/store.js"></script>
<script src="../assets/ui.js"></script><script src="../assets/doctor.js"></script>
<script src="index.js"></script>
</body>
</html>
```

---

### Task 1: Оболочка врача и хелперы

**Files:**
- Create: `assets/doctor.css`, `assets/doctor.js`, `doctor/_template.html`
- Modify: `tests/load.js` — добавить `'assets/doctor.js'` в конец `FILES`
- Test: `tests/doctor.test.js`

- [ ] **Step 1: Падающие тесты**

`tests/doctor.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const D = () => KK.doctorApp;

test('modeFor specialty', () => {
  assert.equal(D().modeFor('психиатр'), 'psychiatrist');
  assert.equal(D().modeFor('Врач-психотерапевт'), 'psychiatrist');
  assert.equal(D().modeFor('терапевт'), 'nonPsychiatrist');
});

test('signal badge distinguishes required vs desirable by class and text', () => {
  const r = D().signalBadge({ level: 'important', routing: 'required' });
  const d = D().signalBadge({ level: 'info', routing: 'desirable' });
  assert.match(r, /badge--required/); assert.match(r, /Обязательно/);
  assert.match(d, /badge--desirable/); assert.match(d, /Желательно/);
  assert.match(D().signalBadge({ level: 'critical', routing: 'required' }), /badge--critical/);
});

test('hint shown only in nonPsychiatrist mode', () => {
  const s = { ruleId: 'si_phq9', level: 'critical', routing: 'required', title: 't', text: 'x', source: 's' };
  assert.match(D().signalHtml(s, 'nonPsychiatrist'), /class="hint-box"/);
  assert.doesNotMatch(D().signalHtml(s, 'psychiatrist'), /class="hint-box"/);
});

test('signalHtml escapes text', () => {
  const s = { ruleId: 'x', level: 'info', routing: null, title: '<b>', text: '<i>', source: 's' };
  const html = D().signalHtml(s, 'psychiatrist');
  assert.match(html, /&lt;b&gt;/);
  assert.match(html, /&lt;i&gt;/);
  assert.doesNotMatch(html, /<i>/);
});

test('referral text contains patient, reasons, scales and urgency', () => {
  const store = KK.createStore({ storage: memStorage(), clock: () => new Date('2026-10-19T12:00:00Z') });
  store.reset();
  const p = store.patient('p_dmitry');
  const t = D().referralText(p, store.doctor());
  assert.match(t, /Дмитрий Ковалёв/);
  assert.match(t, /PHQ-9: 21/);
  assert.match(t, /Срочность: обязательно/);
  assert.match(t, /Суицидальные мысли/);
});

test('alert timing stats (minutes, median)', () => {
  const a = [
    { dataAt: '2026-10-19T10:00:00Z', deliveredAt: '2026-10-19T10:00:30Z', ackAt: '2026-10-19T10:10:00Z' },
    { dataAt: '2026-10-19T11:00:00Z', deliveredAt: '2026-10-19T11:01:30Z', ackAt: '2026-10-19T11:30:00Z' },
    { dataAt: '2026-10-19T12:00:00Z', deliveredAt: null, ackAt: null },
  ];
  const s = D().alertStats(a);
  assert.equal(s.deliveredMedianSec, 60);
  assert.equal(s.ackMedianMin, 20);
  assert.equal(s.open, 1);
});

test('highlight wraps spans and escapes the rest', () => {
  const html = D().highlight('<x> F41.1 сертралин', [{ start: 4, end: 9, kind: 'diagnosis' }, { start: 10, end: 19, kind: 'med' }]);
  assert.match(html, /^&lt;x&gt; <mark class="hl hl--diagnosis">F41\.1<\/mark> <mark class="hl hl--med">сертралин<\/mark>$/);
});

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test` → FAIL (`KK.doctorApp` undefined).

- [ ] **Step 3: `assets/doctor.js`**

```js
(function (g) {
  const KK = g.KK;
  const ui = () => KK.ui;
  const NAV = [
    { id: 'patients', href: 'index.html', label: 'Пациенты', icon: 'users' },
    { id: 'alerts', href: 'alerts.html', label: 'Алерты', icon: 'bell' },
    { id: 'messages', href: 'messages.html', label: 'Сообщения', icon: 'chat' },
    { id: 'import', href: 'import.html', label: 'Импорт истории', icon: 'upload' },
    { id: 'materials', href: 'materials.html', label: 'Материалы', icon: 'book' },
    { id: 'profile', href: 'profile.html', label: 'Профиль', icon: 'settings' },
  ];
  const PTABS = [
    ['patient', 'Обзор'], ['assess', 'Оценка'], ['therapy', 'Терапия'], ['routing', 'Маршрутизация'], ['messages', 'Сообщения'], ['import', 'Импорт'],
  ];
  // Пояснения для врача-не-психиатра: что сделать по сигналу.
  const HINTS = {
    si_phq9: 'Проведите скрининг по C-SSRS (вкладка «Оценка»). При умеренном или высоком риске — консультация психиатра в тот же день; при непосредственной угрозе — вызов СМП (112).',
    cssrs_risk: 'Не оставляйте пациента одного при высоком риске. Организуйте экстренную консультацию психиатра или госпитализацию через СМП.',
    sos: 'Свяжитесь с пациентом по телефону. Уточните наличие суицидальных мыслей; при угрозе — 112.',
    ae_severe: 'Оцените связь с препаратом и тяжесть. Рассмотрите коррекцию терапии; оформите извещение о нежелательной реакции в Росздравнадзор (АИС «Фармаконадзор»).',
    phq9_severe: 'Тяжёлая депрессия — показание к ведению психиатром. Оформите направление (вкладка «Маршрутизация»).',
    psychiatric_history: 'Психотические симптомы и биполярное расстройство ведёт психиатр. Не начинайте анксиолитики/антидепрессанты без консультации.',
    no_response: 'Нет ответа на адекватный курс — показание к консультации психиатра для пересмотра терапии.',
    worsening: 'Уточните причины ухудшения: приём препарата, НЯ, жизненные события. Рассмотрите внеплановый визит.',
    missed_doses: 'Уточните у пациента причины пропусков: побочные эффекты, забывчивость, сомнения в лечении.',
    contraindication: 'Назначение по инструкции невозможно. Рассмотрите альтернативу или консультацию психиатра.',
    phq9_modsevere: 'Желательна консультация психиатра для уточнения диагноза и тактики.',
    comorbid: 'Сочетание тревоги и депрессии: оцените динамику через 2–4 недели; при отсутствии улучшения — консультация психиатра.',
    recurrent: 'Рекуррентное течение — желательна консультация психиатра для поддерживающей терапии.',
    interaction: 'Оцените пользу и риск сочетания; информируйте пациента о симптомах серотонинового синдрома (тремор, потливость, тахикардия, возбуждение).',
    unknown_data: 'Запросите недостающие анализы или загрузите выписку (вкладка «Импорт»).',
  };
  const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  const app = {
    HINTS,
    modeFor: (spec) => (/психиатр|психотерап/i.test(spec || '') ? 'psychiatrist' : 'nonPsychiatrist'),
    mode: () => KK.store.doctor().mode,

    signalBadge(s) {
      if (s.level === 'critical') return `<span class="badge badge--critical">${ui().icon('alert', 14)}Критично</span>`;
      if (s.routing === 'required') return '<span class="badge badge--required">Обязательно к психиатру</span>';
      if (s.routing === 'desirable') return '<span class="badge badge--desirable">Желательно к психиатру</span>';
      if (s.ruleId === 'contraindication') return '<span class="badge badge--contra">Противопоказание</span>';
      if (s.level === 'important') return '<span class="badge badge--warn">Важно</span>';
      return '<span class="badge badge--info">Инфо</span>';
    },
    signalHtml(s, mode) {
      const e = ui().esc;
      const cls = s.level === 'critical' ? 'signal--critical' : s.routing === 'required' ? 'signal--required'
        : s.routing === 'desirable' ? 'signal--desirable' : s.level === 'important' ? 'signal--warn' : '';
      const hint = mode === 'nonPsychiatrist' && HINTS[s.ruleId] ? `<p class="hint-box">${e(HINTS[s.ruleId])}</p>` : '';
      return `<div class="signal ${cls}">${app.signalBadge(s)}<b>${e(s.title)}</b><span></span><span>${e(s.text)}</span><span></span>${hint ? `<div>${hint}</div>` : '<span></span>'}<span class="src">${e(s.source)}${s.teamRule ? ' · правило команды' : ''}</span></div>`;
    },
    statusBadge(p) {
      if (p.openAlerts.some((a) => a.level === 'critical')) return app.signalBadge({ level: 'critical' });
      if (p.routing) return app.signalBadge({ routing: p.routing });
      if (p.therapy?.eligible === false) return app.signalBadge({ ruleId: 'contraindication' });
      if (p.openAlerts.length) return app.signalBadge({ level: 'important' });
      return '<span class="badge badge--ok">Стабильно</span>';
    },
    referralText(p, doctor) {
      const req = p.signals.filter((s) => s.routing);
      const level = p.routing === 'required' ? 'обязательно' : p.routing === 'desirable' ? 'желательно' : 'не определена';
      const dx = p.diagnoses.map((d) => `${d.code} ${d.text}`).join('; ');
      const sc = ['phq9', 'gad7', 'cssrs'].filter((id) => p.latest[id]).map((id) => {
        const r = p.latest[id];
        return id === 'cssrs' ? `C-SSRS: ${r.band.doctorLabel}` : `${id === 'phq9' ? 'PHQ-9' : 'GAD-7'}: ${r.total} (${r.band.doctorLabel.toLowerCase()}), ${ui().fmtDate(r.at)}`;
      }).join('\n');
      const meds = p.meds.map((m) => m.name).join(', ') || 'нет';
      const plan = p.plan ? `${KK.data.drugs[p.plan.drugId]?.name || p.plan.drugId} — ${p.plan.status === 'confirmed' ? `назначен ${ui().fmtDate(p.plan.confirmedAt)}` : 'не назначен'}` : 'нет';
      return [
        'НАПРАВЛЕНИЕ на консультацию врача-психиатра',
        `Пациент: ${p.name}, ${p.age} лет`,
        `Диагноз: ${dx}`,
        `Срочность: ${level}`,
        `Основания: ${req.map((s) => `${s.title} — ${s.text}`).join('; ') || 'по клинической оценке'}`,
        `Шкалы:\n${sc || 'нет данных'}`,
        `Текущая терапия: ${meds}; план: ${plan}`,
        `Приверженность (14 дн.): ${p.pdc14 == null ? 'нет данных' : Math.round(p.pdc14 * 100) + '%'}`,
        `Врач: ${doctor.name}, ${doctor.specialty}`,
      ].join('\n');
    },
    alertStats(alerts) {
      const delivered = alerts.filter((a) => a.deliveredAt).map((a) => (new Date(a.deliveredAt) - new Date(a.dataAt)) / 1000);
      const acked = alerts.filter((a) => a.ackAt).map((a) => (new Date(a.ackAt) - new Date(a.dataAt)) / 60000);
      return { deliveredMedianSec: median(delivered), ackMedianMin: median(acked), open: alerts.filter((a) => !a.ackAt).length, total: alerts.length };
    },
    highlight(text, spans) {
      const e = ui().esc; let out = ''; let pos = 0;
      for (const s of spans) {
        if (s.start < pos) continue;
        out += e(text.slice(pos, s.start)) + `<mark class="hl hl--${s.kind}">${e(text.slice(s.start, s.end))}</mark>`;
        pos = s.end;
      }
      return out + e(text.slice(pos));
    },
    beep() {
      if (KK.store.doctor().sound === false) return;
      try {
        const ctx = new (g.AudioContext || g.webkitAudioContext)();
        [0, 0.28].forEach((t) => {
          const o = ctx.createOscillator(), gn = ctx.createGain();
          o.frequency.value = 740; gn.gain.setValueAtTime(0.0001, ctx.currentTime + t);
          gn.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
          gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
          o.connect(gn).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.24);
        });
      } catch (e) { /* звук недоступен */ }
    },

    renderSide() {
      const open = KK.store.alerts({ open: true });
      const crit = open.filter((a) => a.level === 'critical').length;
      const doc = KK.store.doctor();
      const nav = document.body.dataset.nav;
      ui().mount('#side', `
        <div class="d-brand">${ui().icon('route', 20)}<b>Компас</b></div>
        ${NAV.map((n) => `<a href="${n.href}" ${n.id === nav ? 'aria-current="page"' : ''}>${ui().icon(n.icon, 18)}<span>${n.label}</span>${n.id === 'alerts' && open.length ? `<span class="count ${crit ? 'count--crit' : ''}">${open.length}</span>` : ''}</a>`).join('')}
        <div class="d-me"><b>${ui().esc(doc.name)}</b><span class="hint">${ui().esc(doc.specialty)} · ${doc.mode === 'psychiatrist' ? 'режим специалиста' : 'режим с подсказками'}</span></div>`);
    },
    patientTabs(id, active) {
      return `<nav class="ptabs" aria-label="Разделы карточки">${PTABS.map(([page, label]) =>
        `<a href="${page}.html?id=${id}" ${page === active ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
    },
    patientHeader(p) {
      const e = ui().esc;
      const contra = p.therapy?.contraindications.filter((c) => c.status === 'present') || [];
      const unknown = p.therapy?.contraindications.filter((c) => c.status === 'unknown') || [];
      return `<header class="p-header">
        <div class="avatar">${e(p.initials)}</div>
        <div class="grow"><h1>${e(p.name)}</h1>
          <p class="muted">${p.age} лет · ${p.sex === 'f' ? 'жен.' : 'муж.'} · ${p.diagnoses.map((d) => `<span title="${e(d.text)}">${e(d.code)}</span>`).join(', ')}${p.meds.length ? ` · принимает: ${e(p.meds.map((m) => m.name).join(', '))}` : ''}</p>
          <div class="row wrap">${app.statusBadge(p)}${contra.map((c) => `<span class="badge badge--contra">${e(c.label)}</span>`).join('')}${unknown.length ? `<span class="badge badge--warn">Нет данных: ${unknown.length}</span>` : ''}${p.routingConfirmed ? `<span class="badge badge--ok">Направлен ${ui().fmtDate(p.routingConfirmed.at)}</span>` : ''}</div></div>
      </header>`;
    },
    showCriticalModal() {
      const pending = KK.store.alerts({ open: true }).find((a) => a.level === 'critical' && !a.deliveredAt);
      const root = document.getElementById('modal-root');
      if (!pending || !root || root.dataset.open === pending.id) return;
      const p = KK.store.patient(pending.patientId);
      KK.store.markDelivered(pending.id);
      app.beep();
      root.dataset.open = pending.id;
      const e = ui().esc;
      root.innerHTML = `<div class="modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="mt">
        <div class="modal stack"><span class="badge badge--critical">${ui().icon('alert', 14)}Критический сигнал</span>
          <h2 id="mt">${e(p.name)}: ${e(pending.title)}</h2><p>${e(pending.text)}</p>
          ${app.mode() === 'nonPsychiatrist' && HINTS[pending.ruleId] ? `<p class="hint-box">${e(HINTS[pending.ruleId])}</p>` : ''}
          <p class="hint">Данные поступили ${ui().fmtDateTime(pending.dataAt)} · ${e(pending.source)}</p>
          <div class="row wrap"><a class="btn btn--danger" href="patient.html?id=${p.id}" data-ack-open="${pending.id}">Открыть карточку</a>
            <button class="btn" data-ack="${pending.id}" data-action="Связался с пациентом">Связался с пациентом</button>
            <button class="btn btn--ghost" data-close>Позже</button></div></div></div>`;
      root.querySelector('.btn').focus();
    },
    start({ nav } = {}) {
      if (nav) document.body.dataset.nav = nav;
      app.renderSide();
      app.showCriticalModal();
      KK.store.subscribe(() => { app.renderSide(); app.showCriticalModal(); });
      document.addEventListener('click', (ev) => {
        const root = document.getElementById('modal-root');
        const ack = ev.target.closest('[data-ack]');
        if (ack) { KK.store.ackAlert(ack.dataset.ack, ack.dataset.action); root.innerHTML = ''; delete root.dataset.open; }
        if (ev.target.closest('[data-close]')) { root.innerHTML = ''; delete root.dataset.open; app.showCriticalModal(); }
      });
      document.addEventListener('keydown', (ev) => {
        const root = document.getElementById('modal-root');
        if (ev.key === 'Escape' && root?.dataset.open) { root.innerHTML = ''; delete root.dataset.open; }
      });
      return { doctor: KK.store.doctor(), mode: app.mode() };
    },
  };
  KK.doctorApp = app;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: `assets/doctor.css`**

```css
.d-brand{display:flex;align-items:center;gap:8px;padding:6px 10px 16px;color:var(--accent-strong);font-size:16px}
.d-side .count{margin-left:auto;min-width:20px;padding:0 6px;border-radius:10px;background:var(--surface-2);font-size:12px;text-align:center}
.d-side .count--crit{background:var(--crit);color:var(--on-crit)}
.d-me{margin-top:auto;padding:12px 10px 0;border-top:1px solid var(--line);display:flex;flex-direction:column}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.tile .n{font-size:24px;font-weight:600}
.tile--crit{border-color:var(--crit)}.tile--crit .n{color:var(--crit)}
.tile--route .n{color:var(--route)}
.grid2{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px}
@media (max-width:1100px){.grid2{grid-template-columns:1fr}}
.p-header{display:flex;gap:16px;align-items:flex-start;margin-bottom:12px}
.p-header .grow{flex:1;display:flex;flex-direction:column;gap:6px}
.avatar{width:48px;height:48px;border-radius:50%;background:var(--accent-tint);color:var(--accent-strong);display:flex;align-items:center;justify-content:center;font-weight:600}
.row.wrap{flex-wrap:wrap;gap:6px}
.ptabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin:0 0 16px;overflow-x:auto}
.ptabs a{padding:10px 14px;color:var(--text-2);text-decoration:none;border-bottom:2px solid transparent;white-space:nowrap}
.ptabs a[aria-current="page"]{color:var(--accent-strong);border-bottom-color:var(--accent);font-weight:600}
.hint-box{margin:6px 0 0;padding:8px 10px;border-radius:8px;background:var(--accent-tint);color:var(--accent-strong);font-size:13px}
.feed{list-style:none;margin:0;padding:0}
.feed li{display:grid;grid-template-columns:110px 1fr;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
.feed time{color:var(--text-3);font-size:12px}
.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 16px}
.kv dt{color:var(--text-3)}.kv dd{margin:0}
.check-list{list-style:none;margin:0;padding:0}
.check-list li{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--line)}
.st{flex:none;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.st--absent{background:var(--ok-tint);color:var(--ok)}.st--present{background:var(--crit);color:var(--on-crit)}.st--unknown{background:var(--warn-tint);color:var(--warn)}
.scale-table td{vertical-align:middle}
.scale-table .opts{display:flex;gap:4px}
.scale-table .opts label{display:flex;align-items:center;justify-content:center;min-width:34px;height:32px;border:1px solid var(--line);border-radius:6px;cursor:pointer}
.scale-table .opts input{position:absolute;opacity:0}
.scale-table .opts input:checked+span{font-weight:700;color:var(--accent-strong)}
.scale-table .opts label:has(input:checked){background:var(--accent-tint);border-color:var(--accent)}
.scale-table .opts label:has(input:focus-visible){outline:2px solid var(--accent)}
.total{position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--line);padding:12px 0}
mark.hl{border-radius:4px;padding:0 2px}
.hl--diagnosis{background:#E4EFF4}.hl--med{background:#FEF0C7}.hl--lab{background:#E3F4EA}.hl--condition{background:#F1EAFA}
.import-preview{white-space:pre-wrap;line-height:1.8;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.thread{display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px;min-height:60vh}
.thread .list a{display:block;padding:10px;border-radius:8px;text-decoration:none;color:inherit}
.thread .list a[aria-current="page"]{background:var(--accent-tint)}
.msg{max-width:70%;padding:8px 12px;border-radius:10px;background:var(--surface-2)}
.msg.me{margin-left:auto;background:var(--accent-tint)}
.msg.sys{max-width:none;background:transparent;color:var(--text-3);font-size:12px;text-align:center}
@media (max-width:900px){.thread{grid-template-columns:1fr}}
```

- [ ] **Step 5: `doctor/_template.html`** — содержимое раздела «Шаблон страницы врача».

- [ ] **Step 6: Тесты зелёные** — Run: `npm test` → PASS. Хелперы `signalHtml/referralText/highlight` не зависят от DOM.

- [ ] **Step 7: Commit**

```bash
git add assets/doctor.css assets/doctor.js doctor/_template.html tests/doctor.test.js tests/load.js
git commit -m "feat(doctor): shell, critical alert modal, signal/referral/highlight helpers"
```

---

### Task 2: Очередь пациентов

**Files:**
- Create: `doctor/index.html` (шаблон, `data-nav="patients"`, скрипт `index.js`), `doctor/index.js`

- [ ] **Step 1: `doctor/index.js`**

```js
(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'patients' });
  let q = '';
  function render() {
    const all = store.patients();
    const list = all.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    const crit = all.filter((p) => p.openAlerts.some((a) => a.level === 'critical')).length;
    const req = all.filter((p) => p.routing === 'required' && !p.routingConfirmed).length;
    const missed = all.filter((p) => p.missedStreak >= 3).length;
    const now = new Date().toISOString();
    ui.mount('#app', `
      <div class="page-head"><div><h1>Пациенты</h1><p class="muted">${ui.fmtWeekday(now)}, ${ui.fmtDate(now)} · сначала срочные</p></div>
        <label class="field" style="min-width:260px"><span class="sr-only">Поиск</span><input id="q" placeholder="Поиск по фамилии" value="${ui.esc(q)}"></label></div>
      <div class="tiles">
        <div class="tile ${crit ? 'tile--crit' : ''}"><div class="n">${crit}</div><div class="hint">Критические сигналы</div></div>
        <div class="tile tile--route"><div class="n">${req}</div><div class="hint">Обязательно к психиатру</div></div>
        <div class="tile"><div class="n">${missed}</div><div class="hint">Пропускают приём</div></div>
        <div class="tile"><div class="n">${all.length}</div><div class="hint">Всего под наблюдением</div></div>
      </div>
      <table class="table"><thead><tr><th>Пациент</th><th>Статус</th><th>PHQ-9</th><th>GAD-7</th><th>Приверженность</th><th>Активность</th></tr></thead>
      <tbody>${list.map((p) => {
        const sp = (id, max) => {
          const vals = store.events(p.id, 'scale').filter((e) => e.payload.scaleId === id).map((e) => e.payload.total);
          return vals.length ? `<div class="row"><b>${vals.at(-1)}</b>${ui.sparkline(vals.slice(-6), { w: 70, h: 24, max })}</div>` : '<span class="hint">—</span>';
        };
        return `<tr data-href="patient.html?id=${p.id}" tabindex="0" style="cursor:pointer">
          <td><b>${ui.esc(p.name)}</b><br><span class="hint">${p.age} лет · ${ui.esc(p.diagnoses.map((d) => d.code).join(', '))}</span></td>
          <td><div class="row wrap">${D.statusBadge(p)}</div><span class="hint">${ui.esc(p.signals[0]?.title || '')}</span></td>
          <td>${sp('phq9', 27)}</td><td>${sp('gad7', 21)}</td>
          <td>${p.pdc14 == null ? '<span class="hint">не назначено</span>' : `${Math.round(p.pdc14 * 100)}%${p.missedStreak >= 3 ? ` <span class="badge badge--warn">${p.missedStreak} дн. без приёма</span>` : ''}`}</td>
          <td class="hint">${p.lastActivityAt ? ui.fmtDateTime(p.lastActivityAt) : '—'}</td></tr>`;
      }).join('')}</tbody></table>`);
    const input = document.getElementById('q');
    input.oninput = () => { q = input.value; const pos = input.selectionStart; render(); const i = document.getElementById('q'); i.focus(); i.setSelectionRange(pos, pos); };
  }
  document.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });
  document.addEventListener('keydown', (e) => { const tr = e.target.closest?.('tr[data-href]'); if (tr && e.key === 'Enter') location.href = tr.dataset.href; });
  store.subscribe(render);
  render();
})();
```

- [ ] **Step 2: Проверка в браузере**

`http://localhost:5180/doctor/index.html`: при первом открытии — модальное окно «Дмитрий Ковалёв: Суицидальные мысли» со звуком; «Позже» закрывает, повторно для того же алерта не появляется (deliveredAt проставлен). Порядок строк: Дмитрий (Критично) → Галина (Противопоказание, важный алерт) → остальные. Счётчик у «Алерты» в меню. Поиск «пет» оставляет Галину. Enter на строке открывает карточку.

- [ ] **Step 3: Проверка связи в двух вкладках**

Вкладка 1 — `doctor/index.html`; вкладка 2 — `patient/help.html?p=p_anna` (после онбординга) → «Сообщить врачу». Во вкладке 1 без перезагрузки: модальное окно по Анне, Анна поднимается наверх. Замерить через `javascript_tool` во вкладке врача: `KK.store.alerts({patientId:'p_anna'})[0]` → `deliveredAt - dataAt` < 2 с.

- [ ] **Step 4: Commit**

```bash
git add doctor/index.html doctor/index.js
git commit -m "feat(doctor): urgency-sorted patient queue with tiles and sparklines"
```

---

### Task 3: Карточка пациента

**Files:**
- Create: `doctor/patient.html` (шаблон, `data-nav="patients"`, `patient.js`), `doctor/patient.js`

- [ ] **Step 1: `doctor/patient.js`**

```js
(function () {
  const { ui, store, doctorApp: D, data } = KK;
  D.start({ nav: 'patients' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('index.html'); return; }
  const TYPE = { checkin: 'Самочувствие', dose: 'Приём', scale: 'Шкала', ae: 'Нежелательные явления', sos: 'Кнопка «Мне тяжело»' };
  const describe = (e) => {
    if (e.type === 'checkin') return `настроение ${e.payload.mood}/5, беспокойство ${e.payload.anxiety}/5, сон ${e.payload.sleep}/5`;
    if (e.type === 'dose') return `${data.drugs.aviandr.name}, ${e.payload.slot}`;
    if (e.type === 'scale') return `${data.scales[e.payload.scaleId].title.split(' —')[0]}: ${e.payload.scaleId === 'cssrs' ? '' : e.payload.total} — ${e.payload.band.doctorLabel}`;
    if (e.type === 'ae') return e.payload.items.map((i) => `${i.label} (${i.severity === 'severe' ? 'сильно' : i.severity === 'mild' ? 'немного' : i.severity})`).join(', ') + (e.payload.note ? ` · «${e.payload.note}»` : '');
    if (e.type === 'sos') return 'пациент сообщил, что ему очень плохо';
    return '';
  };
  function render() {
    const p = store.patient(id);
    const mode = D.mode();
    const series = (sid, color) => ({ label: sid === 'phq9' ? 'PHQ-9' : 'GAD-7', color, points: store.events(id, 'scale').filter((e) => e.payload.scaleId === sid).map((e) => ({ at: e.at, v: e.payload.total })) });
    const bands = [{ from: 10, to: 14, color: 'rgba(181,71,8,.06)' }, { from: 15, to: 27, color: 'rgba(180,35,24,.06)' }];
    const feed = [...store.events(id)].filter((e) => e.type !== 'dose').reverse().slice(0, 12);
    const aes = store.events(id, 'ae').slice(-5).reverse();
    const plan = p.plan;
    const drug = data.drugs[plan?.drugId];
    ui.mount('#app', `
      ${D.patientHeader(p)}
      ${D.patientTabs(id, 'patient')}
      <div class="row wrap" style="margin-bottom:16px">
        ${plan?.status === 'proposed' ? `<a class="btn btn--primary" href="therapy.html?id=${id}">Рассмотреть назначение ${ui.esc(drug?.name || '')}</a>` : ''}
        ${p.routing && !p.routingConfirmed ? `<a class="btn ${p.routing === 'required' ? 'btn--primary' : ''}" href="routing.html?id=${id}">Оформить направление к психиатру</a>` : ''}
        <a class="btn" href="assess.html?id=${id}">Оценка на приёме</a>
        <a class="btn btn--ghost" href="messages.html?id=${id}">Написать пациенту</a>
      </div>
      <div class="grid2">
        <div class="stack">
          <section class="card stack"><h2>Сигналы</h2>
            ${p.signals.length ? p.signals.map((s) => D.signalHtml(s, mode)).join('') : '<p class="muted">Сигналов нет. Состояние стабильно.</p>'}</section>
          <section class="card stack"><div class="row-between"><h2>Динамика по шкалам</h2><span class="hint">PHQ-9 — синий, GAD-7 — оранжевый; фон: умеренная (10–14) и выше (≥ 15)</span></div>
            ${ui.lineChart([series('phq9', 'var(--chart)'), series('gad7', 'var(--chart-2)')], { max: 27, bands, ariaLabel: 'Динамика PHQ-9 и GAD-7' })}</section>
          <section class="card stack"><h2>Лента событий</h2>
            <ul class="feed">${feed.map((e) => `<li><time>${ui.fmtDateTime(e.at)}</time><span><b>${TYPE[e.type] || e.type}:</b> ${ui.esc(describe(e))}</span></li>`).join('') || '<li><span class="hint">Нет событий</span></li>'}</ul></section>
        </div>
        <div class="stack">
          <section class="card stack"><h2>Терапия</h2>
            <dl class="kv">
              <dt>План</dt><dd>${drug ? `${ui.esc(drug.name)} ${ui.esc(drug.dosing.dose)} × ${drug.dosing.timesPerDay}/сут` : '—'}</dd>
              <dt>Статус</dt><dd>${plan?.status === 'confirmed' ? `назначен ${ui.fmtDate(plan.confirmedAt)}` : plan?.status === 'proposed' ? 'предложен, ожидает решения врача' : plan?.status === 'cancelled' ? 'отменён' : '—'}${plan?.offLabel ? ' · <span class="badge badge--warn">вне инструкции</span>' : ''}</dd>
              <dt>Приверженность</dt><dd>${p.pdc14 == null ? '—' : `${Math.round(p.pdc14 * 100)}% доз за 14 дн.`}${p.missedStreak ? ` · без приёма ${p.missedStreak} ${ui.plural(p.missedStreak, ['день', 'дня', 'дней'])}` : ''}</dd>
              <dt>Проверка</dt><dd>${p.therapy?.eligible === true ? '<span class="badge badge--ok">Противопоказаний нет</span>' : p.therapy?.eligible === false ? '<span class="badge badge--contra">Есть противопоказание</span>' : '<span class="badge badge--warn">Недостаточно данных</span>'}</dd>
            </dl><a href="therapy.html?id=${id}">Подробнее о терапии</a></section>
          <section class="card stack"><h2>Нежелательные явления</h2>
            ${aes.length ? `<ul class="feed">${aes.map((e) => `<li><time>${ui.fmtDate(e.at)}</time><span>${ui.esc(describe(e))}</span></li>`).join('')}</ul>` : '<p class="hint">Пациент не сообщал</p>'}</section>
          <section class="card stack"><h2>Журнал действий</h2>
            ${store.audit(id).slice(-5).reverse().map((a) => `<p class="hint">${ui.fmtDateTime(a.at)} · ${ui.esc(a.action)}</p>`).join('') || '<p class="hint">Пока пусто</p>'}</section>
        </div>
      </div>`);
  }
  store.subscribe(render);
  render();
})();
```

- [ ] **Step 2: Проверка в браузере**

`patient.html?id=p_dmitry`: шапка с «Критично», кнопка «Оформить направление» основная; сигналы `si_phq9` (красная рамка) и `phq9_severe` (сплошная фиолетовая «Обязательно»), `comorbid` (пунктир «Желательно») с подсказками (режим терапевта); график двух линий с фоновыми зонами; лента. `p_galina` — плашка «Противопоказание: СКФ < 60» в шапке. Ширина 1024 (планшет) — колонки складываются в одну без горизонтального скролла.

- [ ] **Step 3: Commit**

```bash
git add doctor/patient.html doctor/patient.js
git commit -m "feat(doctor): patient card — signals with rationale, charts, therapy, feed, audit"
```

---

### Task 4: Оценка на приёме

**Files:**
- Create: `doctor/assess.html` (`data-nav="patients"`, `assess.js`), `doctor/assess.js`

- [ ] **Step 1: `doctor/assess.js`**

```js
(function () {
  const { ui, store, doctorApp: D, data } = KK;
  D.start({ nav: 'patients' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('index.html'); return; }
  let sid = ui.param('scale') || (store.patient(id).signals.some((s) => s.ruleId === 'si_phq9') ? 'cssrs' : 'phq9');
  let answers = [];
  const cssrsVisible = (i) => i < 2 || i === 5 || answers[1] === 1;

  function render() {
    const p = store.patient(id);
    const def = data.scales[sid];
    const shown = def.items.map((t, i) => ({ t, i })).filter(({ i }) => sid !== 'cssrs' || cssrsVisible(i));
    const filled = shown.every(({ i }) => answers[i] != null);
    const full = sid === 'cssrs' ? def.items.map((_, i) => (cssrsVisible(i) ? answers[i] ?? null : 0)) : answers.concat(Array(def.items.length - answers.length).fill(null)).slice(0, def.items.length);
    const r = KK.scales.score(sid, full);
    ui.mount('#app', `
      ${D.patientHeader(p)}${D.patientTabs(id, 'assess')}
      <div class="row wrap" style="margin-bottom:12px">${['phq9', 'gad7', 'cssrs'].map((x) => `<a class="btn ${x === sid ? 'btn--primary' : ''}" href="?id=${id}&scale=${x}">${data.scales[x].title.split(' —')[0]}</a>`).join('')}</div>
      <section class="card stack"><h2>${ui.esc(def.title)}</h2><p class="muted">${ui.esc(def.instruction)}</p>
        <table class="table scale-table"><tbody>${shown.map(({ t, i }) => `<tr><td style="width:32px" class="hint">${i + 1}</td><td>${ui.esc(t)}</td>
          <td><div class="opts" role="radiogroup" aria-label="Вопрос ${i + 1}">${def.options.map((o) => `<label title="${ui.esc(o.label)}"><input type="radio" name="q${i}" value="${o.v}" ${answers[i] === o.v ? 'checked' : ''}><span>${sid === 'cssrs' ? o.label : o.v}</span></label>`).join('')}</div></td></tr>`).join('')}</tbody></table>
        ${sid !== 'cssrs' ? `<p class="hint">${def.options.map((o) => `${o.v} — ${o.label}`).join(' · ')}</p>` : ''}
        <div class="total row-between"><div><b>${sid === 'cssrs' ? r.band.doctorLabel : `Сумма: ${r.total} — ${r.band ? r.band.doctorLabel : ''}`}</b>
          <div class="hint">${ui.esc(def.source)} · ${ui.esc(def.license)}</div></div>
          <button class="btn btn--primary" data-save ${filled ? '' : 'aria-disabled="true"'}>Сохранить в карту</button></div>
        <p class="hint" id="msg" role="status"></p></section>`);
  }
  document.addEventListener('change', (e) => {
    const m = /^q(\d+)$/.exec(e.target.name || '');
    if (m) { answers[Number(m[1])] = Number(e.target.value); render(); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-save]')) return;
    const def = data.scales[sid];
    const full = def.items.map((_, i) => (sid === 'cssrs' && !cssrsVisible(i) ? 0 : answers[i]));
    if (full.some((v) => v == null)) { document.getElementById('msg').textContent = 'Ответьте на все вопросы.'; return; }
    store.addEvent(id, 'scale', { scaleId: sid, answers: full });
    answers = [];
    location.href = `patient.html?id=${id}`;
  });
  render();
})();
```

- [ ] **Step 2: Проверка** — у Дмитрия по умолчанию открыта C-SSRS; вопросы 3–5 появляются только после «Да» на вопрос 2; «Да» на вопрос 4 → «Высокий риск»; сохранение → карточка, сигнал `cssrs_risk` критический, модальное окно. PHQ-9: сумма пересчитывается на лету, источник и лицензия под суммой. Незаполненные — сообщение, событие не создаётся.

- [ ] **Step 3: Commit**

```bash
git add doctor/assess.html doctor/assess.js
git commit -m "feat(doctor): in-visit assessment — PHQ-9, GAD-7, C-SSRS with branching"
```

---

### Task 5: Терапия и подтверждение назначения

**Files:**
- Create: `doctor/therapy.html` (`data-nav="patients"`, `therapy.js`), `doctor/therapy.js`

- [ ] **Step 1: `doctor/therapy.js`**

```js
(function () {
  const { ui, store, doctorApp: D, data } = KK;
  D.start({ nav: 'patients' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('index.html'); return; }
  let dialog = null; let err = '';
  const ST = { absent: ['st--absent', '✓', 'нет'], present: ['st--present', '✕', 'есть'], unknown: ['st--unknown', '?', 'нет данных'] };

  function render() {
    const p = store.patient(id);
    const drug = data.drugs[p.plan?.drugId || 'aviandr'];
    const t = p.therapy || KK.therapy.check(drug, p);
    const st = p.plan?.status;
    ui.mount('#app', `
      ${D.patientHeader(p)}${D.patientTabs(id, 'therapy')}
      <div class="grid2">
        <div class="stack">
          <section class="card stack"><div class="row-between"><h2>${ui.esc(drug.name)} (${ui.esc(drug.inn)})</h2>${drug.additionalMonitoring ? '<span class="badge badge--warn">Дополнительный мониторинг безопасности</span>' : ''}</div>
            <dl class="kv"><dt>Форма</dt><dd>${ui.esc(drug.form)}</dd><dt>Режим</dt><dd>${ui.esc(drug.dosing.dose)} ${drug.dosing.timesPerDay} раза в сутки (${ui.esc(drug.dosing.daily)}/сут), длительность — ${ui.esc(drug.dosing.duration)}</dd>
              <dt>Показания</dt><dd>${drug.indications.map((i) => `${ui.esc(i.codes.join(', '))} — ${ui.esc(i.text)}`).join('<br>')}</dd>
              <dt>Показан пациенту</dt><dd>${t.indicated ? '<span class="badge badge--ok">Да, по диагнозу</span>' : '<span class="badge badge--warn">Диагноз вне показаний инструкции</span>'}</dd></dl></section>
          <section class="card stack"><h2>Противопоказания</h2>
            <ul class="check-list">${t.contraindications.map((c) => `<li><span class="st ${ST[c.status][0]}" aria-label="${ST[c.status][2]}">${ST[c.status][1]}</span><span>${ui.esc(c.label)}${c.status === 'unknown' ? ` — <a href="import.html?id=${id}">добавить данные</a>` : ''}</span></li>`).join('')}</ul>
            ${t.cautions.length ? `<h3>С осторожностью</h3>${t.cautions.map((c) => `<div class="signal signal--warn"><span class="badge badge--warn">Осторожно</span><span>${ui.esc(c.label)}</span></div>`).join('')}` : ''}</section>
          <section class="card stack"><h2>Взаимодействия с текущими препаратами</h2>
            ${t.interactions.length ? t.interactions.map((i) => `<div class="signal signal--warn"><span class="badge badge--warn">${ui.esc(i.drugs.join(', '))}</span><span>${ui.esc(i.text)}</span></div>`).join('') : `<p class="muted">${p.meds.length ? 'Значимых взаимодействий не найдено' : 'Других препаратов пациент не принимает'}</p>`}</section>
          <p class="hint">Источник: ${ui.esc(drug.source)}. Сверено с Государственным реестром лекарственных средств.</p>
        </div>
        <div class="stack">
          <section class="card stack"><h2>Решение врача</h2>
            <p>Статус: <b>${st === 'confirmed' ? `назначен ${ui.fmtDate(p.plan.confirmedAt)}` : st === 'proposed' ? 'предложен системой' : st === 'cancelled' ? 'отменён' : '—'}</b></p>
            ${st !== 'confirmed' ? (t.eligible === false && !p.plan.offLabel
              ? `<div class="signal signal--critical"><span class="badge badge--contra">Противопоказание</span><span>Назначение по инструкции невозможно.</span></div>
                 <button class="btn" data-open="offlabel">Назначить вне инструкции…</button>`
              : `${t.eligible === null ? '<div class="signal signal--warn"><span class="badge badge--warn">Нет данных</span><span>Часть противопоказаний не проверена. Решение остаётся за врачом.</span></div>' : ''}
                 <button class="btn btn--primary" data-open="confirm">Назначить ${ui.esc(drug.name)}</button>`)
              : `<button class="btn" data-open="cancel">Отменить назначение</button>`}
            <p class="hint">Система не назначает препараты самостоятельно. Решение фиксируется в журнале действий.</p></section>
          <section class="card stack"><h2>Нежелательные реакции из инструкции</h2>
            <p class="hint">Часто: ${drug.adverseEvents.filter((a) => a.freq === 'часто').map((a) => a.label.toLowerCase()).join(', ')}.</p>
            <p class="hint">Нечасто: ${drug.adverseEvents.filter((a) => a.freq === 'нечасто').map((a) => a.label.toLowerCase()).join(', ')}.</p></section>
        </div>
      </div>
      ${dialog ? dialogHtml(dialog, drug, p) : ''}`);
  }
  function dialogHtml(kind, drug, p) {
    const body = kind === 'confirm' ? `<h2>Назначить ${ui.esc(drug.name)}?</h2><p>${ui.esc(drug.dosing.dose)} ${drug.dosing.timesPerDay} раза в сутки. Пациент получит напоминания о приёме и памятку.</p>`
      : kind === 'cancel' ? '<h2>Отменить назначение?</h2><p>Напоминания пациенту прекратятся.</p><label class="field"><span class="hint">Причина</span><textarea id="reason"></textarea></label>'
      : `<h2>Назначение вне инструкции</h2><p>Есть противопоказание: ${ui.esc(p.therapy.contraindications.filter((c) => c.status === 'present').map((c) => c.label).join('; '))}. Назначение возможно только как самостоятельное решение врача с обоснованием.</p><label class="field"><span class="hint">Обоснование (обязательно)</span><textarea id="reason"></textarea></label>`;
    return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal stack" style="border-top-color:var(--accent)">${body}
      ${err ? `<p class="hint" role="alert" style="color:var(--crit)">${ui.esc(err)}</p>` : ''}
      <div class="row"><button class="btn ${kind === 'offlabel' ? 'btn--danger' : 'btn--primary'}" data-do="${kind}">Подтвердить</button><button class="btn btn--ghost" data-dlg-close>Отмена</button></div></div></div>`;
  }
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) { dialog = o.dataset.open; err = ''; render(); return; }
    if (e.target.closest('[data-dlg-close]')) { dialog = null; render(); return; }
    const d = e.target.closest('[data-do]');
    if (!d) return;
    const reason = document.getElementById('reason')?.value.trim() || '';
    try {
      if (d.dataset.do === 'confirm') store.confirm(id, 'confirm_plan', {});
      if (d.dataset.do === 'cancel') store.confirm(id, 'cancel_plan', { reason });
      if (d.dataset.do === 'offlabel') {
        if (reason.length < 10) { err = 'Опишите обоснование (не меньше 10 символов).'; render(); return; }
        store.confirm(id, 'off_label', { reason });
        store.confirm(id, 'confirm_plan', { offLabel: true });
      }
      dialog = null; render();
    } catch (ex) { err = ex.message; render(); }
  });
  store.subscribe(render);
  render();
})();
```

- [ ] **Step 2: Проверка**

- `therapy.html?id=p_anna`: все противопоказания «✓», «Назначить Авиандр» → диалог → «Подтвердить» → статус «назначен», аудит `confirm_plan`. На стороне пациента (`patient/index.html?p=p_anna`) появляется карточка приёма.
- `p_sergey`: две плашки взаимодействий (Сертралин — серотонин, CYP2D6).
- `p_galina`: «✕ СКФ < 60», вместо кнопки назначения — «Назначить вне инструкции…»; пустое обоснование → ошибка; с обоснованием → назначен + бейдж «вне инструкции».
- Эргономика: назначение = 2 клика из карточки.

- [ ] **Step 3: Commit**

```bash
git add doctor/therapy.html doctor/therapy.js
git commit -m "feat(doctor): therapy reference, contraindication checklist, confirm/off-label/cancel"
```

---

### Task 6: Маршрутизация

**Files:**
- Create: `doctor/routing.html` (`data-nav="patients"`, `routing.js`), `doctor/routing.js`

- [ ] **Step 1: `doctor/routing.js`**

```js
(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'patients' });
  const id = ui.param('id');
  if (!store.patient(id)) { location.replace('index.html'); return; }
  let text = null;
  function render() {
    const p = store.patient(id);
    const mode = D.mode();
    const sig = p.signals.filter((s) => s.routing);
    if (text == null) text = D.referralText(p, store.doctor());
    ui.mount('#app', `
      ${D.patientHeader(p)}${D.patientTabs(id, 'routing')}
      <div class="grid2">
        <div class="stack">
          <section class="card stack"><h2>Основания</h2>
            ${sig.length ? sig.map((s) => D.signalHtml(s, mode)).join('') : '<p class="muted">Правила маршрутизации не сработали. Направление возможно по клиническому решению.</p>'}
            <p class="hint">«Обязательно» — сплошная плашка, «Желательно» — пунктирная. Пороги и источники — в разделе «Материалы → Правила».</p></section>
        </div>
        <div class="stack">
          <section class="card stack"><h2>Направление</h2>
            ${p.routingConfirmed ? `<div class="signal"><span class="badge badge--ok">Оформлено</span><span>${ui.fmtDateTime(p.routingConfirmed.at)} · ${p.routingConfirmed.level === 'required' ? 'обязательно' : 'желательно'}</span></div>` : ''}
            <label class="field"><span class="hint">Текст направления (можно отредактировать)</span><textarea id="ref" style="min-height:280px;font-family:var(--font-body)">${ui.esc(text)}</textarea></label>
            <div class="row wrap">
              ${p.routingConfirmed ? '' : `<button class="btn btn--primary" data-confirm>Подтвердить направление</button>`}
              <button class="btn" data-copy>Скопировать</button></div>
            <p class="hint" id="msg" role="status"></p></section>
        </div>
      </div>`);
  }
  document.addEventListener('input', (e) => { if (e.target.id === 'ref') text = e.target.value; });
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-confirm]')) {
      const p = store.patient(id);
      store.confirm(id, 'confirm_routing', { level: p.routing || 'desirable', note: text });
      store.sendMessage(id, 'doctor', 'Я оформил(а) направление на консультацию к врачу-психиатру. Подробности обсудим по телефону.');
      render();
    }
    if (e.target.closest('[data-copy]')) {
      try { await navigator.clipboard.writeText(text); document.getElementById('msg').textContent = 'Скопировано'; }
      catch (err) { document.getElementById('ref').select(); document.getElementById('msg').textContent = 'Выделено — нажмите Ctrl+C'; }
    }
  });
  store.subscribe(render);
  render();
})();
```

- [ ] **Step 2: Проверка** — у Дмитрия из очереди: клик по строке → «Оформить направление» → «Подтвердить направление» = 3 клика из очереди (из карточки — 2). В шапке появляется «Направлен 19 октября»; у пациента в чате — сообщение врача. Текст содержит «PHQ-9: 21», «Срочность: обязательно». Сокращение пути: если нужно ≤ 2 из очереди — добавить в строку очереди кнопку «Направить» при `routing === 'required'` (сделать в этом шаге: в `doctor/index.js` во второй колонке после статуса `${p.routing === 'required' && !p.routingConfirmed ? `<a class="btn" href="routing.html?id=${p.id}" onclick="event.stopPropagation()">Направить</a>` : ''}`).

- [ ] **Step 3: Commit**

```bash
git add doctor/routing.html doctor/routing.js doctor/index.js
git commit -m "feat(doctor): psychiatrist routing with rationale and editable referral"
```

---

### Task 7: Журнал алертов

**Files:**
- Create: `doctor/alerts.html` (`data-nav="alerts"`, `alerts.js`), `doctor/alerts.js`

- [ ] **Step 1: `doctor/alerts.js`**

```js
(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'alerts' });
  let onlyOpen = true;
  function render() {
    const all = store.alerts();
    const list = onlyOpen ? all.filter((a) => !a.ackAt) : all;
    const st = D.alertStats(all);
    const name = (pid) => store.patient(pid)?.name || pid;
    ui.mount('#app', `
      <div class="page-head"><h1>Алерты</h1>
        <div class="seg row"><button class="btn ${onlyOpen ? 'btn--primary' : ''}" data-f="open">Открытые</button><button class="btn ${!onlyOpen ? 'btn--primary' : ''}" data-f="all">Все</button></div></div>
      <div class="tiles">
        <div class="tile ${st.open ? 'tile--crit' : ''}"><div class="n">${st.open}</div><div class="hint">Требуют реакции</div></div>
        <div class="tile"><div class="n">${st.deliveredMedianSec == null ? '—' : Math.round(st.deliveredMedianSec) + ' с'}</div><div class="hint">Медиана доставки врачу</div></div>
        <div class="tile"><div class="n">${st.ackMedianMin == null ? '—' : Math.round(st.ackMedianMin) + ' мин'}</div><div class="hint">Медиана реакции врача</div></div>
        <div class="tile"><div class="n">${st.total}</div><div class="hint">Всего</div></div></div>
      <table class="table"><thead><tr><th>Уровень</th><th>Пациент</th><th>Сигнал</th><th>Данные</th><th>Доставлено</th><th>Реакция</th></tr></thead>
      <tbody>${list.map((a) => `<tr>
        <td>${D.signalBadge(a)}</td><td><a href="patient.html?id=${a.patientId}">${ui.esc(name(a.patientId))}</a></td>
        <td><b>${ui.esc(a.title)}</b><br><span class="hint">${ui.esc(a.text)}</span></td>
        <td class="hint">${ui.fmtDateTime(a.dataAt)}</td><td class="hint">${a.deliveredAt ? ui.fmtDateTime(a.deliveredAt) : '—'}</td>
        <td>${a.ackAt ? `<span class="hint">${ui.fmtDateTime(a.ackAt)} · ${ui.esc(a.ackAction)}</span>`
          : `<div class="row wrap"><button class="btn" data-ack="${a.id}" data-action="Связался с пациентом">Связался</button><button class="btn btn--ghost" data-ack="${a.id}" data-action="Просмотрено">Просмотрено</button></div>`}</td></tr>`).join('') || '<tr><td colspan="6" class="hint">Открытых алертов нет</td></tr>'}</tbody></table>`);
  }
  document.addEventListener('click', (e) => { const f = e.target.closest('[data-f]'); if (f) { onlyOpen = f.dataset.f === 'open'; render(); } });
  store.subscribe(render);
  render();
})();
```

(Кнопки `data-ack` обрабатывает оболочка `KK.doctorApp.start`.)

- [ ] **Step 2: Проверка** — после сброса: алерты Дмитрия (`si_phq9` критический, `phq9_severe`, `worsening` важные) и Галины (`contraindication`). «Связался» проставляет реакцию, плитка медианы реакции заполняется, счётчик в меню уменьшается.

- [ ] **Step 3: Commit**

```bash
git add doctor/alerts.html doctor/alerts.js
git commit -m "feat(doctor): alert log with delivery/response timing metrics"
```

---

### Task 8: Импорт истории болезни

**Files:**
- Create: `doctor/import.html` (`data-nav="import"`, `import.js`), `doctor/import.js`

- [ ] **Step 1: `doctor/import.js`**

```js
(function () {
  const { ui, store, doctorApp: D, parser } = KK;
  D.start({ nav: 'import' });
  const SAMPLES = {
    'Выписка (терапевт)': 'Пациентка К., 34 года. Диагноз: F41.1 Генерализованное тревожное расстройство.\nСопутствующие: ХБП С3а, СКФ (CKD-EPI) 52 мл/мин/1,73м2. Принимает: сертралин 50 мг утром, феназепам по требованию.\nЭпилепсию отрицает. Беременность отрицает.',
    'Эпикриз (стационар)': 'ЖАЛОБЫ: тревога, нарушение сна.\nDS осн.: Расстройство адаптации (F43.2) после перенесённой COVID-19 (U09.9).\nТерапия — Трамадол 50 мг при болях; лоразепам.\nЛаб.: рСКФ — 88; цирроз печени, класс Child-Pugh B.\nВозраст: 58 лет. Пол: муж.',
    'Короткая запись': 'Мужчина 17 лет, эпилепсия в анамнезе, получает вальпроевую кислоту.',
  };
  let pid = ui.param('id') || store.patients()[0].id;
  let src = ''; let parsed = null; let done = false;
  const KIND = { diagnosis: 'Диагноз', med: 'Препарат', lab: 'Анализ', condition: 'Состояние' };

  function render() {
    const p = store.patient(pid);
    ui.mount('#app', `
      ${ui.param('id') ? D.patientHeader(p) + D.patientTabs(pid, 'import') : `<div class="page-head"><h1>Импорт истории болезни</h1>
        <label class="field"><span class="hint">Пациент</span><select id="pid">${store.patients().map((x) => `<option value="${x.id}" ${x.id === pid ? 'selected' : ''}>${ui.esc(x.name)}</option>`).join('')}</select></label></div>`}
      <div class="grid2">
        <section class="card stack"><h2>Текст выписки</h2>
          <div class="row wrap">${Object.keys(SAMPLES).map((k) => `<button class="btn btn--ghost" data-sample="${ui.esc(k)}">${ui.esc(k)}</button>`).join('')}</div>
          <label class="field"><span class="sr-only">Текст</span><textarea id="src" style="min-height:220px" placeholder="Вставьте текст выписки, эпикриза или записи осмотра">${ui.esc(src)}</textarea></label>
          <button class="btn btn--primary" data-parse>Разобрать</button>
          ${parsed ? `<h3>Найдено в тексте</h3><div class="import-preview">${D.highlight(src, parsed.spans)}</div>
            <p class="hint">${Object.entries(KIND).map(([k, l]) => `<mark class="hl hl--${k}">${l}</mark>`).join(' ')}</p>` : ''}</section>
        <section class="card stack"><h2>Будет добавлено в карту</h2>
          ${parsed ? `<dl class="kv">
            <dt>Диагнозы</dt><dd>${parsed.diagnoses.map((d) => `${ui.esc(d.code)} ${ui.esc(d.text)}`).join('<br>') || '—'}</dd>
            <dt>Препараты</dt><dd>${parsed.meds.map((m) => ui.esc(m.name)).join(', ') || '—'}</dd>
            <dt>СКФ</dt><dd>${parsed.labs.egfr ?? '—'}</dd><dt>Child-Pugh</dt><dd>${parsed.labs.childPugh ?? '—'}</dd>
            <dt>Возраст / пол</dt><dd>${parsed.age ?? '—'} / ${parsed.sex === 'f' ? 'жен.' : parsed.sex === 'm' ? 'муж.' : '—'}</dd>
            <dt>Состояния</dt><dd>${parsed.conditions.join(', ') || '—'}${parsed.pregnant ? ', беременность' : ''}${parsed.postCovid ? ', после COVID-19' : ''}</dd></dl>
            <p class="hint">Проверьте данные перед добавлением: разбор выполняется по правилам и может ошибаться.</p>
            <button class="btn btn--primary" data-apply>Добавить в карту ${ui.esc(p.name)}</button>` : '<p class="muted">Вставьте текст и нажмите «Разобрать».</p>'}
          ${done ? `<div class="signal"><span class="badge badge--ok">Добавлено</span><span>Проверка терапии пересчитана. <a href="therapy.html?id=${pid}">Открыть терапию</a></span></div>` : ''}</section>
      </div>`);
  }
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sample]');
    if (s) { src = SAMPLES[s.dataset.sample]; parsed = null; done = false; render(); }
    if (e.target.closest('[data-parse]')) {
      src = document.getElementById('src').value;
      const t0 = performance.now(); parsed = parser.extract(src); parsed.ms = Math.round(performance.now() - t0);
      done = false; render();
    }
    if (e.target.closest('[data-apply]') && parsed) { store.importParsed(pid, parsed); done = true; render(); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'src') src = e.target.value; });
  document.addEventListener('change', (e) => { if (e.target.id === 'pid') { pid = e.target.value; parsed = null; done = false; render(); } });
  render();
})();
```

- [ ] **Step 2: Проверка** — образец «Выписка (терапевт)» → подсветка F41.1, сертралин, феназепам, СКФ 52; «Добавить в карту Анны» → у Анны в терапии появляется противопоказание по СКФ и взаимодействия; в очереди Анна поднимается. Аудит `import_history`. Образец «Эпикриз» → Child-Pugh B, муж., 58.

- [ ] **Step 3: Commit**

```bash
git add doctor/import.html doctor/import.js
git commit -m "feat(doctor): case-history import with highlighted extraction and merge"
```

---

### Task 9: Сообщения

**Files:**
- Create: `doctor/messages.html` (`data-nav="messages"`, `messages.js`), `doctor/messages.js`

- [ ] **Step 1: `doctor/messages.js`**

```js
(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'messages' });
  let pid = ui.param('id') || store.patients()[0].id;
  const TPL = ['Как вы себя чувствуете на лечении?', 'Пожалуйста, пройдите короткий опросник в приложении.', 'Давайте созвонимся сегодня. Когда вам удобно?'];
  function render() {
    const ps = store.patients();
    const p = store.patient(pid);
    const msgs = store.messages(pid);
    ui.mount('#app', `
      <div class="page-head"><h1>Сообщения</h1></div>
      <div class="thread">
        <nav class="list card" aria-label="Пациенты">${ps.map((x) => { const last = store.messages(x.id).filter((m) => m.from !== 'system').at(-1);
          return `<a href="?id=${x.id}" ${x.id === pid ? 'aria-current="page"' : ''}><b>${ui.esc(x.name)}</b><br><span class="hint">${last ? ui.esc(last.text.slice(0, 40)) : 'нет сообщений'}</span></a>`; }).join('')}</nav>
        <section class="card stack"><div class="row-between"><h2>${ui.esc(p.name)}</h2><a href="patient.html?id=${pid}">Карточка</a></div>
          <div class="stack" aria-live="polite">${msgs.map((m) => `<div class="msg ${m.from === 'doctor' ? 'me' : m.from === 'system' ? 'sys' : ''}">${ui.esc(m.text)}<div class="hint">${ui.fmtDateTime(m.at)}</div></div>`).join('') || '<p class="hint">Переписки пока нет</p>'}</div>
          <div class="row wrap">${TPL.map((t) => `<button class="btn btn--ghost" data-tpl="${ui.esc(t)}">${ui.esc(t.slice(0, 32))}…</button>`).join('')}</div>
          <form id="f" class="row"><label class="sr-only" for="t">Сообщение</label><input id="t" class="grow" style="flex:1;min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;font:inherit" placeholder="Сообщение пациенту"><button class="btn btn--primary">Отправить</button></form>
        </section></div>`);
  }
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-tpl]'); if (t) document.getElementById('t').value = t.dataset.tpl; });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = document.getElementById('t').value.trim();
    if (!v) return;
    store.sendMessage(pid, 'doctor', v); render();
  });
  store.subscribe(render);
  render();
})();
```

- [ ] **Step 2: Проверка** — сообщение врача появляется у пациента (`patient/chat.html`) без перезагрузки во второй вкладке; системные сообщения («Пациент подключился») — серым по центру.

- [ ] **Step 3: Commit**

```bash
git add doctor/messages.html doctor/messages.js
git commit -m "feat(doctor): patient messaging with templates"
```

---

### Task 10: Материалы — источники и правила

**Files:**
- Create: `doctor/materials.html` (`data-nav="materials"`, `materials.js`), `doctor/materials.js`

- [ ] **Step 1: `doctor/materials.js`**

```js
(function () {
  const { ui, doctorApp: D, data } = KK;
  D.start({ nav: 'materials' });
  const LV = { critical: 'Критический', important: 'Важный', info: 'Инфо' };
  const RT = { required: 'Обязательно', desirable: 'Желательно' };
  const a = data.drugs.aviandr;
  ui.mount('#app', `
    <div class="page-head"><h1>Материалы и источники</h1></div>
    <div class="stack-l">
      <section class="card stack"><h2>Клинические рекомендации Минздрава России</h2>
        <ul class="feed">
          <li><time>ID 457 · 2024</time><span>Генерализованное тревожное расстройство (РОП). <a href="https://cr.minzdrav.gov.ru/" target="_blank" rel="noopener">Рубрикатор КР</a></span></li>
          <li><time>ID 301 · 2024</time><span>Депрессивный эпизод, рекуррентное депрессивное расстройство (РОП). <a href="https://cr.minzdrav.gov.ru/" target="_blank" rel="noopener">Рубрикатор КР</a></span></li>
        </ul><p class="hint">Международные источники используются только как дополнение и указаны явно у каждого правила.</p></section>
      <section class="card stack"><h2>Инструкция по медицинскому применению</h2>
        <p>${ui.esc(a.name)} (${ui.esc(a.inn)}), ${ui.esc(a.form)}. Рег. № ${ui.esc(a.regNumber)}. <a href="https://grls.rosminzdrav.ru/" target="_blank" rel="noopener">ГРЛС</a></p></section>
      <section class="card stack"><h2>Психометрические шкалы</h2>
        <table class="table"><thead><tr><th>Шкала</th><th>Пунктов</th><th>Источник</th><th>Условия использования</th></tr></thead><tbody>
          ${Object.values(data.scales).map((s) => `<tr><td>${ui.esc(s.title)}</td><td>${s.items.length}</td><td class="hint">${ui.esc(s.source)}</td><td class="hint">${ui.esc(s.license)}</td></tr>`).join('')}
          <tr><td>HADS</td><td>14</td><td class="hint">Zigmond, Snaith, 1983</td><td class="hint">Требует лицензии GL Assessment — в прототипе не используется</td></tr>
        </tbody></table></section>
      <section class="card stack"><h2>Правила алертинга и маршрутизации</h2>
        <p class="hint">Правила хранятся декларативно в <code>data/rules/core.js</code>: новое правило добавляется без изменения ядра.</p>
        <table class="table"><thead><tr><th>Правило</th><th>Уровень</th><th>Маршрутизация</th><th>Источник</th></tr></thead><tbody>
          ${data.rules.map((r) => `<tr><td><b>${ui.esc(r.title)}</b><br><span class="hint">${ui.esc(r.id)}</span></td><td>${LV[r.level]}</td><td>${r.routing ? D.signalBadge({ routing: r.routing }) : '—'}</td><td class="hint">${ui.esc(r.source)}${r.teamRule ? ' · правило команды' : ''}</td></tr>`).join('')}
        </tbody></table></section>
    </div>`);
})();
```

- [ ] **Step 2: Проверка** — 15 правил в таблице, у каждого источник; шкалы с лицензиями; ссылки открываются в новой вкладке.

- [ ] **Step 3: Commit**

```bash
git add doctor/materials.html doctor/materials.js
git commit -m "feat(doctor): sources page — guidelines, label, scales, rule registry"
```

---

### Task 11: Профиль врача

**Files:**
- Create: `doctor/profile.html` (`data-nav="profile"`, `profile.js`), `doctor/profile.js`

- [ ] **Step 1: `doctor/profile.js`**

```js
(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'profile' });
  const SPECS = ['терапевт', 'врач общей практики', 'невролог', 'кардиолог', 'эндокринолог', 'психиатр', 'психотерапевт'];
  function render() {
    const d = store.doctor();
    ui.mount('#app', `
      <div class="page-head"><h1>Профиль</h1></div>
      <section class="card stack" style="max-width:560px">
        <label class="field"><span class="hint">ФИО</span><input id="name" value="${ui.esc(d.name)}"></label>
        <label class="field"><span class="hint">Специальность</span><select id="spec">${SPECS.map((s) => `<option ${s === d.specialty ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <p class="hint">Режим: <b>${d.mode === 'psychiatrist' ? 'специалист — компактно, без пояснений' : 'с подсказками — пояснения к шкалам и шагам маршрутизации'}</b>. Определяется специальностью.</p>
        <label class="row"><input type="checkbox" id="sound" ${d.sound === false ? '' : 'checked'}> Звук критических алертов</label>
        <div class="row"><button class="btn btn--primary" data-save>Сохранить</button><span class="hint" id="msg" role="status"></span></div>
      </section>
      <section class="card stack" style="max-width:560px;margin-top:16px"><h2>Демо</h2>
        <p class="hint">Сброс вернёт 5 сценариев в исходное состояние на этом устройстве.</p>
        <button class="btn" data-reset>Сбросить демо-данные</button></section>`);
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-save]')) {
      const spec = document.getElementById('spec').value;
      store.setDoctor({ name: document.getElementById('name').value.trim() || 'Врач', specialty: spec, mode: D.modeFor(spec), sound: document.getElementById('sound').checked });
      render(); document.getElementById('msg').textContent = 'Сохранено';
    }
    if (e.target.closest('[data-reset]') && confirm('Сбросить демо-данные?')) { store.reset(); location.href = 'index.html'; }
  });
  render();
})();
```

- [ ] **Step 2: Проверка** — сменить специальность на «психиатр» → в карточке Дмитрия пропадают голубые подсказки, плашки остаются; вернуть «терапевт» → подсказки снова видны.

- [ ] **Step 3: Commit**

```bash
git add doctor/profile.html doctor/profile.js
git commit -m "feat(doctor): profile — specialty-driven hint mode, sound, demo reset"
```

---

### Task 12: Сквозная проверка обеих ролей

- [ ] **Step 1:** `npm test` — все тесты зелёные.
- [ ] **Step 2: Сценарий 4 (критический)** — сброс; вкладка врача `doctor/index.html` → модальное окно → «Открыть карточку» → «Оценка» C-SSRS → «Маршрутизация» → «Подтвердить направление». Засечь число кликов и время (`performance.now()` в консоли).
- [ ] **Step 3: Сценарий 1 + связь** — врач назначает Анне Авиандр → вкладка пациента Анны: карточка приёма; пациентка отмечает «Утро», проходит PHQ-9 с вопросом 9 > 0 → у врача без перезагрузки модальное окно; время `deliveredAt - dataAt` < 2 с.
- [ ] **Step 4: Сценарии 2, 3, 5** — взаимодействия у Сергея; противопоказание и off-label у Галины; у Ольги стабильная положительная динамика без сигналов.
- [ ] **Step 5: Доступность** — Tab-навигация по очереди и карточке, видимый фокус; модальное окно получает фокус, Esc закрывает; плашки «Обязательно/Желательно» различимы в режиме ахроматопсии (DevTools → Rendering).
- [ ] **Step 6: Адаптивность** — 1440, 1024, 768: без горизонтального скролла у страницы (таблицы допускают внутренний скролл).
- [ ] **Step 7:** Консоль без ошибок на всех страницах (`read_console_messages onlyErrors`).
- [ ] **Step 8:** Скриншоты очереди, карточки, терапии, маршрутизации → `docs/screens/doctor-*.png`. `graphify update .` (если доступен).
- [ ] **Step 9: Commit**

```bash
git add docs/screens
git commit -m "docs: doctor UI screenshots and end-to-end verification"
```

- [ ] **Step 10: README** — создать `README.md`: как запустить (`npm run serve`, открыть `http://localhost:5180`), структура, сценарии, где добавлять шкалы/препараты/правила, источники, ограничения демо (localStorage, нет бэкенда, контент требует клинического ревью). Commit `docs: README`.
