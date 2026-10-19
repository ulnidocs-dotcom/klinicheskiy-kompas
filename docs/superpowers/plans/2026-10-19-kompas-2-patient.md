# Клинический компас — План 2: интерфейс пациента (Telegram Mini App / mobile web)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9 экранов пациента поверх ядра из Плана 1: вход и связь с врачом, «Сегодня» (чек-ин, приём препарата), опросники, «Мой путь», лечение и самочувствие, связь с врачом, материалы, «Мне сейчас очень плохо», профиль.

**Architecture:** Каждая страница — `patient/<name>.html` + `patient/<name>.js`. Общая оболочка `assets/patient.js` (выбор пациента, проверка привязки, таб-бар, кнопка помощи, тема/Telegram). Контент материалов — `data/materials.js`. Все данные — через `KK.store` (План 1). Никаких баллов и красных сигналов на стороне пациента.

**Tech Stack:** HTML, CSS (токены `data-role="patient"`), ванильный JS, Telegram WebApp SDK (опционально).

**Зависимость:** План 1 выполнен (ядро, `assets/ui.js`, `assets/tokens.css`, `assets/ui.css`). Контракт — конец Плана 1.

**Принципы (из спека, раздел 2), проверять на каждом экране:**
1. Одно действие на экран, фразы ≤ 2 строк, кнопки ≥ 44px.
2. Нет чисел баллов, красного цвета, «!», слов «тяжёлая/критическая/выраженная».
3. Нет давящей геймификации и «сгоревших» серий; пропуски описываются нейтрально.
4. Кнопка помощи доступна с любого экрана, кроме самого экрана помощи.

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `assets/patient.css` | стили, специфичные для пациента |
| `assets/patient.js` | `KK.patientApp`: оболочка, привязка, таб-бар, кнопка помощи, настройки |
| `data/materials.js` | `KK.data.materials`: психообразование, о лечении, практики |
| `patient/_template.html` | эталон подключения скриптов (копируется в каждую страницу) |
| `patient/onboarding.html/.js` | код приглашения и согласия |
| `patient/index.html` + `today.js` | «Сегодня» |
| `patient/scale.html/.js` | пошаговый опросник |
| `patient/path.html/.js` | «Мой путь» |
| `patient/therapy.html/.js` | лечение: приём, памятка, самочувствие на терапии (НЯ) |
| `patient/chat.html/.js` | связь с врачом |
| `patient/materials.html/.js`, `material.html/.js` | список и статья |
| `patient/help.html/.js` | «Мне сейчас очень плохо» |
| `patient/profile.html/.js` | профиль и настройки |
| `tests/patient.test.js` | тесты логики оболочки и материалов |

**Шаблон страницы** (каждая `patient/*.html` повторяет его, меняя `<title>`, `data-tab` и последний скрипт):
```html
<!doctype html>
<html lang="ru" data-role="patient">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Сегодня · Компас</title>
<link rel="stylesheet" href="../assets/tokens.css">
<link rel="stylesheet" href="../assets/ui.css">
<link rel="stylesheet" href="../assets/patient.css">
</head>
<body data-tab="today">
<main class="p-app" id="app" aria-live="polite"></main>
<div id="shell"></div>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script src="../assets/kk.js"></script>
<script src="../data/scales.js"></script><script src="../data/drugs/classes.js"></script><script src="../data/drugs/aviandr.js"></script>
<script src="../data/rules/core.js"></script><script src="../data/scenarios.js"></script><script src="../data/materials.js"></script>
<script src="../assets/scales.js"></script><script src="../assets/therapy.js"></script><script src="../assets/adherence.js"></script>
<script src="../assets/rules.js"></script><script src="../assets/parser.js"></script><script src="../assets/store.js"></script>
<script src="../assets/ui.js"></script><script src="../assets/tg.js"></script><script src="../assets/patient.js"></script>
<script src="today.js"></script>
</body>
</html>
```

---

### Task 1: Оболочка пациента и материалы

**Files:**
- Create: `assets/patient.css`, `assets/patient.js`, `data/materials.js`, `patient/_template.html`
- Modify: `tests/load.js` — добавить `'data/materials.js'` после `'data/scenarios.js'` и `'assets/patient.js'` в конец
- Test: `tests/patient.test.js`

- [ ] **Step 1: Падающие тесты**

`tests/patient.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

test('materials: unique ids, known categories, each has source', () => {
  const ids = new Set();
  for (const m of KK.data.materials) {
    assert.ok(!ids.has(m.id), m.id); ids.add(m.id);
    assert.ok(['about', 'treatment', 'practice'].includes(m.cat), m.id);
    assert.ok(m.source && m.title && m.summary && m.body.length, m.id);
  }
  assert.ok(KK.data.materials.filter((m) => m.cat === 'practice').length >= 4);
});

test('patient copy has no alarming words or digits-as-scores', () => {
  const bad = /тяж[её]л|критич|выраженн|!|балл/i;
  for (const m of KK.data.materials) {
    const text = [m.title, m.summary, ...m.body.map((b) => (typeof b === 'string' ? b : (b.items || []).join(' ')))].join(' ');
    assert.doesNotMatch(text, bad, m.id);
  }
});

test('practiceOfDay is deterministic per date', () => {
  const a = KK.patientApp.practiceOfDay('2026-10-19T08:00:00Z');
  const b = KK.patientApp.practiceOfDay('2026-10-19T20:00:00Z');
  assert.equal(a.id, b.id);
  assert.equal(a.cat, 'practice');
});

test('dueScales returns scales older than period', () => {
  const now = '2026-10-19T12:00:00.000Z';
  const latest = { phq9: { at: '2026-10-01T10:00:00Z' }, gad7: { at: '2026-10-15T10:00:00Z' }, cssrs: null };
  assert.deepEqual(KK.patientApp.dueScales(latest, now, 14), ['phq9']);
  assert.deepEqual(KK.patientApp.dueScales({ phq9: null, gad7: null }, now, 14), ['gad7', 'phq9']);
});

test('checkinSummary is gentle text', () => {
  const t = KK.patientApp.checkinSummary([{ payload: { mood: 2 } }, { payload: { mood: 2 } }, { payload: { mood: 4 } }, { payload: { mood: 4 } }]);
  assert.match(t, /настроение/i);
  assert.doesNotMatch(t, /\d/);
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test` → FAIL (`KK.data.materials` undefined).

- [ ] **Step 3: `data/materials.js`**

Тексты психообразования основаны на КР РОП 2024 (ГТР — ID 457; депрессия — ID 301) и материалах NHS/NICE для пациентов. При выполнении — показать тексты врачу-психиатру команды (отметка в README «контент требует клинического ревью»).

```js
(function (g) {
  g.KK.data.materials = [
    { id: 'anxiety', cat: 'about', minutes: 3, title: 'Что такое тревога',
      summary: 'Почему тело и мысли реагируют так, будто опасность рядом.',
      body: [
        'Тревога — естественная реакция организма на возможную угрозу. Она помогает собраться, когда нужно действовать.',
        'Иногда эта система срабатывает слишком часто или слишком сильно — даже когда опасности нет. Тогда беспокойство становится постоянным спутником и мешает жить.',
        { type: 'list', title: 'Как это может проявляться', items: [
          'мысли крутятся вокруг «а вдруг…» и их трудно остановить',
          'напряжение в мышцах, учащённое сердцебиение',
          'трудно заснуть или сон поверхностный',
          'раздражительность и усталость к концу дня',
        ] },
        'Это не слабость характера. Генерализованная тревога хорошо изучена, и с ней можно справиться: помогают лечение, психотерапия и простые ежедневные практики.',
      ],
      source: 'КР «Генерализованное тревожное расстройство», РОП, 2024' },
    { id: 'depression', cat: 'about', minutes: 3, title: 'Как устроена депрессия',
      summary: 'Почему сил становится меньше и что с этим делать.',
      body: [
        'Депрессия — это не просто грусть. Это состояние, при котором меняется работа мозга: становится меньше энергии, интереса и удовольствия от привычных дел.',
        'Из-за этого даже простые задачи кажутся трудными. Мысли о себе становятся строже, а будущее — темнее, чем оно есть на самом деле.',
        { type: 'list', title: 'Что важно помнить', items: [
          'депрессия лечится, и большинство людей замечают улучшение',
          'улучшение обычно приходит постепенно, а не сразу',
          'маленькие шаги каждый день имеют значение',
        ] },
        'Если появляются мысли о том, что жить не хочется, — скажите об этом врачу или воспользуйтесь кнопкой «Мне тяжело». Об этом можно и нужно говорить.',
      ],
      source: 'КР «Депрессивный эпизод, рекуррентное депрессивное расстройство», РОП, 2024' },
    { id: 'treatment_time', cat: 'treatment', minutes: 2, title: 'Почему лечению нужно время',
      summary: 'Чего ждать в первые недели.',
      body: [
        'Лекарства от тревоги действуют постепенно. Первые изменения часто заметны через одну–две недели, а устойчивый эффект — позже.',
        'В начале могут появиться непривычные ощущения. Отмечайте их в разделе «Лечение» — врач увидит и подскажет, что делать.',
        'Не меняйте дозу и не прекращайте приём самостоятельно, даже если стало лучше. Решение об изменении лечения принимаете вы вместе с врачом.',
      ],
      source: 'КР «Генерализованное тревожное расстройство», РОП, 2024' },
    { id: 'aviandr', cat: 'treatment', minutes: 2, title: 'Авиандр простыми словами',
      summary: 'Как принимать и на что обратить внимание.',
      body: [
        'Авиандр (маритупирдин) — препарат для лечения тревожных состояний. Его назначает врач.',
        { type: 'list', title: 'Как принимать', items: [
          'по 1 таблетке 2 раза в день — утром и вечером',
          'длительность лечения определяет врач',
        ] },
        { type: 'list', title: 'Во время лечения', items: [
          'откажитесь от алкоголя',
          'если появились сонливость или головокружение — не садитесь за руль',
          'перед приёмом других лекарств, в том числе безрецептурных и травяных, посоветуйтесь с врачом',
          'если вы планируете беременность или узнали о ней — сразу сообщите врачу',
        ] },
      ],
      source: 'Инструкция по медицинскому применению «Авиандр», ЛП-№(002445)-(РГ-RU)' },
    { id: 'breathing', cat: 'practice', minutes: 3, title: 'Медленное дыхание',
      summary: 'Три минуты, чтобы тело немного успокоилось.',
      body: [
        'Сядьте удобно. Можно закрыть глаза или смотреть в одну точку.',
        { type: 'steps', items: [
          'Вдох через нос на 4 счёта',
          'Плавный выдох через рот на 6 счетов',
          'Повторяйте около трёх минут, не торопясь',
        ] },
        'Выдох длиннее вдоха — так телу легче переключиться в спокойный режим. Если закружилась голова, просто вернитесь к обычному дыханию.',
      ],
      breath: { inhale: 4, exhale: 6, minutes: 3 },
      source: 'Zaccaro A. et al. Front Hum Neurosci, 2018 (обзор медленного дыхания)' },
    { id: 'grounding', cat: 'practice', minutes: 2, title: 'Заземление 5-4-3-2-1',
      summary: 'Вернуться в «здесь и сейчас», когда накрывает.',
      body: [
        'Назовите про себя или вслух:',
        { type: 'steps', items: [
          'пять вещей, которые вы видите',
          'четыре вещи, которых можете коснуться',
          'три звука, которые слышите',
          'два запаха вокруг',
          'одну вещь, которую чувствуете на вкус',
        ] },
        'Внимание переключается на то, что происходит вокруг, и тревожные мысли становятся тише.',
      ],
      source: 'Техника из когнитивно-поведенческой терапии тревоги' },
    { id: 'activation', cat: 'practice', minutes: 3, title: 'Маленькие шаги',
      summary: 'Поведенческая активация: действие раньше настроения.',
      body: [
        'При депрессии часто ждёшь, когда появятся силы. Но работает наоборот: небольшое действие постепенно возвращает энергию.',
        { type: 'steps', items: [
          'выберите одно простое дело на сегодня — прогулка 10 минут, звонок другу, душ',
          'сделайте его, даже если не хочется',
          'отметьте, как вы себя чувствовали до и после',
        ] },
        'Не нужно делать много. Один маленький шаг — уже движение.',
      ],
      source: 'КР «Депрессивный эпизод, рекуррентное депрессивное расстройство», РОП, 2024 (психотерапия: поведенческая активация)' },
    { id: 'sleep', cat: 'practice', minutes: 3, title: 'Что помогает спать',
      summary: 'Несколько привычек для более спокойного сна.',
      body: [
        { type: 'list', items: [
          'ложитесь и вставайте примерно в одно и то же время',
          'за час до сна приглушите свет и отложите телефон',
          'если не уснули за 20 минут, встаньте и займитесь чем-то спокойным, а потом вернитесь в постель',
          'кофе и крепкий чай — лучше до обеда',
        ] },
        'Если сон нарушен больше недели — расскажите врачу, это важно для подбора лечения.',
      ],
      source: 'Рекомендации по гигиене сна (КПТ-И), NICE CKS: Insomnia' },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: `assets/patient.js`**

```js
(function (g) {
  const KK = g.KK;
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
  };
  const TABS = [
    { id: 'today', href: 'index.html', label: 'Сегодня', icon: 'home' },
    { id: 'path', href: 'path.html', label: 'Мой путь', icon: 'path' },
    { id: 'materials', href: 'materials.html', label: 'Материалы', icon: 'book' },
    { id: 'chat', href: 'chat.html', label: 'Врач', icon: 'chat' },
    { id: 'profile', href: 'profile.html', label: 'Профиль', icon: 'user' },
  ];
  const DEFAULT_PREFS = { scaleEveryDays: 14, reminders: true };

  const app = {
    pid() {
      const fromUrl = KK.ui.param('p');
      if (fromUrl) { try { sessionStorage.setItem('kk:pid', fromUrl); } catch (e) { /* */ } return fromUrl; }
      try { const s = sessionStorage.getItem('kk:pid'); if (s) return s; } catch (e) { /* */ }
      return KK.store.activePatientId();
    },
    linked: (pid) => LS.get(`kk:linked:${pid}`, false) === true,
    link(pid) { LS.set(`kk:linked:${pid}`, true); },
    prefs: (pid) => Object.assign({}, DEFAULT_PREFS, LS.get(`kk:prefs:${pid}`, {})),
    setPrefs(pid, patch) { LS.set(`kk:prefs:${pid}`, Object.assign(app.prefs(pid), patch)); },

    start({ tab = document.body.dataset.tab, requireLink = true, help = true, back = null } = {}) {
      KK.tg.init();
      const pid = app.pid();
      if (!KK.store.patient(pid)) { location.href = '../index.html'; return null; }
      if (requireLink && !app.linked(pid)) { location.replace(`onboarding.html?p=${pid}`); return null; }
      const shell = document.getElementById('shell');
      const nav = tab ? `<div class="tabbar"><nav aria-label="Разделы">${TABS.map((t) =>
        `<a href="${t.href}" ${t.id === tab ? 'aria-current="page"' : ''}>${KK.ui.icon(t.icon)}<span>${t.label}</span></a>`).join('')}</nav></div>` : '';
      const fab = help ? `<a class="help-fab" href="help.html">${KK.ui.icon('heart', 18)}<span>Мне тяжело</span></a>` : '';
      if (shell) shell.innerHTML = nav + fab;
      if (back) KK.tg.backButton(() => { location.href = back; });
      return { pid, patient: () => KK.store.patient(pid) };
    },

    firstName: (p) => p.name.split(' ')[0],
    practiceOfDay(iso = new Date().toISOString()) {
      const list = KK.data.materials.filter((m) => m.cat === 'practice');
      const key = KK.util.dayKey(iso).replace(/-/g, '');
      return list[Number(key) % list.length];
    },
    dueScales(latest, nowIso, everyDays) {
      return ['gad7', 'phq9'].filter((id) => !latest[id] || KK.util.daysBetween(latest[id].at, nowIso) >= everyDays);
    },
    checkinSummary(checkins) {
      if (checkins.length < 4) return 'Отмечайте самочувствие — через несколько дней здесь появится картина.';
      const half = Math.floor(checkins.length / 2);
      const avg = (a) => a.reduce((s, c) => s + c.payload.mood, 0) / a.length;
      const d = avg(checkins.slice(half)) - avg(checkins.slice(0, half));
      if (d >= 0.5) return 'За последние дни настроение стало заметно ровнее.';
      if (d <= -0.5) return 'Последние дни даются труднее. Врач видит ваши отметки — можно написать ему.';
      return 'Настроение в последние дни примерно одинаковое.';
    },
    doseSlots(events, nowIso) {
      const today = KK.util.dayKey(nowIso);
      const taken = new Set(events.filter((e) => e.type === 'dose' && e.payload.taken && KK.util.dayKey(e.at) === today).map((e) => e.payload.slot));
      return ['утро', 'вечер'].map((slot) => ({ slot, taken: taken.has(slot) }));
    },
    toast(text) {
      let t = document.querySelector('.toast');
      if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
      t.textContent = text; t.classList.add('on');
      clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2400);
    },
  };
  KK.patientApp = app;
})(typeof window !== 'undefined' ? window : globalThis);
```

Примечание для Node-тестов: `KK.tg`/`localStorage` не используются в тестируемых функциях (`practiceOfDay`, `dueScales`, `checkinSummary`, `doseSlots`).

- [ ] **Step 5: `assets/patient.css`**

```css
.p-head{display:flex;flex-direction:column;gap:4px;margin:4px 0 20px}
.p-head .date{color:var(--text-3);font-size:.85em}
.p-back{display:inline-flex;align-items:center;gap:6px;color:var(--text-2);text-decoration:none;min-height:var(--tap);margin:-8px 0 4px}
.q-title{font-size:1em;font-family:var(--font-body);font-weight:500}
.dot-labels{display:flex;justify-content:space-between;font-size:.75em;color:var(--text-3);margin-top:6px}
.slots{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.slot{display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;border-radius:14px;border:1px solid var(--line);background:var(--surface);font:inherit;color:var(--text);cursor:pointer}
.slot[aria-pressed="true"]{background:var(--accent-tint);border-color:var(--accent);color:var(--accent-strong)}
.link-card{display:flex;align-items:center;justify-content:space-between;gap:12px;text-decoration:none;color:inherit}
.link-card .chev{color:var(--text-3)}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.cal i{aspect-ratio:1;border-radius:8px;background:var(--surface-2)}
.cal i.on{background:var(--scale-4)}
.cal i.today{outline:2px solid var(--accent);outline-offset:1px}
.seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.seg button{min-height:40px;border-radius:10px;border:1px solid var(--line);background:var(--surface);font:inherit;font-size:.85em;color:var(--text-2);cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--accent-tint);border-color:var(--accent);color:var(--accent-strong)}
.ae-row{padding:12px 0;border-bottom:1px solid var(--line)}
.ae-row:last-child{border-bottom:0}
.bubble{max-width:82%;padding:10px 14px;border-radius:16px;background:var(--surface)}
.bubble.me{margin-left:auto;background:var(--accent-tint)}
.bubble .t{font-size:.75em;color:var(--text-3);margin-top:4px}
.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.chip{flex:none;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);font:inherit;font-size:.85em;color:var(--text-2);cursor:pointer}
.compose{position:sticky;bottom:72px;display:flex;gap:8px;background:var(--bg);padding:8px 0}
.compose textarea{flex:1;min-height:var(--tap);max-height:140px;font:inherit;border-radius:14px;border:1px solid var(--line);padding:10px 14px;background:var(--surface);color:var(--text);resize:none}
.steps{counter-reset:s;list-style:none;padding:0;margin:0}
.steps li{counter-increment:s;display:flex;gap:12px;padding:10px 0}
.steps li::before{content:counter(s);flex:none;width:28px;height:28px;border-radius:50%;background:var(--accent-tint);color:var(--accent-strong);display:flex;align-items:center;justify-content:center;font-size:.85em}
.breath{width:160px;height:160px;margin:12px auto;border-radius:50%;background:var(--accent-tint);display:flex;align-items:center;justify-content:center;color:var(--accent-strong);transition:transform 4s ease-in-out}
.breath.in{transform:scale(1.25)}
.toast{position:fixed;left:50%;bottom:140px;transform:translate(-50%,20px);opacity:0;background:var(--text);color:var(--bg);padding:10px 16px;border-radius:12px;transition:all var(--dur);pointer-events:none;z-index:40}
.toast.on{opacity:1;transform:translate(-50%,0)}
.help-hero{padding:8px 0 4px}
.help-call{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:var(--radius-m);background:var(--surface);text-decoration:none;color:var(--text);min-height:60px}
.help-call b{display:block}
.check{display:flex;gap:12px;align-items:flex-start;padding:10px 0}
.check input{width:22px;height:22px;margin-top:2px;accent-color:var(--accent)}
```

- [ ] **Step 6: `patient/_template.html`** — содержимое из раздела «Шаблон страницы» выше, без изменений.

- [ ] **Step 7: Тесты зелёные** — Run: `npm test` → PASS.

- [ ] **Step 8: Commit**

```bash
git add assets/patient.css assets/patient.js data/materials.js patient/_template.html tests/patient.test.js tests/load.js
git commit -m "feat(patient): shell, prefs, materials content"
```

---

### Task 2: Вход и связь с врачом

**Files:**
- Create: `patient/onboarding.html` (шаблон: `<title>Вход · Компас</title>`, `<body data-tab="">`, последний скрипт `onboarding.js`), `patient/onboarding.js`

- [ ] **Step 1: `patient/onboarding.js`**

```js
(function () {
  const { ui, store, patientApp } = KK;
  const ctx = patientApp.start({ tab: null, requireLink: false, help: false });
  if (!ctx) return;
  const p = ctx.patient();
  let step = 0;
  const state = { code: '', consents: { pd: false, doctor: false, notEmergency: false } };

  function view() {
    if (step === 0) return `
      <section class="stack-l" style="padding-top:12vh">
        <div style="color:var(--accent)">${ui.icon('leaf', 40)}</div>
        <h1>Здравствуйте</h1>
        <p class="muted">Здесь вы и ваш врач видите, как меняется самочувствие. Отметки занимают меньше минуты в день.</p>
        <button class="btn btn--primary btn--block" data-next>Начать</button>
      </section>`;
    if (step === 1) return `
      <section class="stack-l" style="padding-top:8vh">
        <h1>Код от врача</h1>
        <p class="muted">Врач выдал вам код приглашения. Он связывает ваш дневник с вашей медицинской картой.</p>
        <label class="field"><span class="hint">Код приглашения</span>
          <input id="code" autocomplete="one-time-code" inputmode="text" placeholder="KMP-0000" value="${ui.esc(state.code)}"></label>
        <p class="hint">Для демо: ${ui.esc(p.inviteCode)}</p>
        <p class="hint" id="err" role="alert"></p>
        <button class="btn btn--primary btn--block" data-check>Продолжить</button>
      </section>`;
    const c = state.consents;
    return `
      <section class="stack-l" style="padding-top:6vh">
        <h1>Перед началом</h1>
        <div class="card">
          <label class="check"><input type="checkbox" data-c="pd" ${c.pd ? 'checked' : ''}><span>Согласен(на) на обработку персональных данных, включая данные о здоровье, в соответствии с 152-ФЗ</span></label>
          <label class="check"><input type="checkbox" data-c="doctor" ${c.doctor ? 'checked' : ''}><span>Мои отметки будут видны только моему лечащему врачу</span></label>
          <label class="check"><input type="checkbox" data-c="notEmergency" ${c.notEmergency ? 'checked' : ''}><span>Понимаю, что приложение не заменяет экстренную помощь. В опасной ситуации звоню 112</span></label>
        </div>
        <button class="btn btn--primary btn--block" data-done ${Object.values(c).every(Boolean) ? '' : 'aria-disabled="true"'}>Готово</button>
        <p class="hint" id="err" role="alert"></p>
      </section>`;
  }
  function render() { ui.mount('#app', view()); }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) { step = 1; render(); }
    if (e.target.closest('[data-check]')) {
      state.code = document.getElementById('code').value.trim().toUpperCase();
      if (state.code !== p.inviteCode) { document.getElementById('err').textContent = 'Код не подошёл. Проверьте буквы и цифры или спросите у врача.'; return; }
      step = 2; render();
    }
    if (e.target.closest('[data-done]')) {
      if (!Object.values(state.consents).every(Boolean)) { document.getElementById('err').textContent = 'Отметьте все пункты, чтобы продолжить.'; return; }
      patientApp.link(ctx.pid);
      store.sendMessage(ctx.pid, 'system', 'Пациент подключился к дневнику');
      location.href = `index.html?p=${ctx.pid}`;
    }
  });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset.c;
    if (k) { state.consents[k] = e.target.checked; render(); }
  });
  render();
})();
```

- [ ] **Step 2: Проверка в браузере**

Превью `kompas` → `http://localhost:5180/patient/index.html?p=p_anna` → редирект на onboarding. Неверный код → спокойное сообщение; верный `KMP-4821` → согласия → «Готово» неактивна до трёх галочек → переход на «Сегодня» (пока 404 — ок до Task 3). Консоль без ошибок.

- [ ] **Step 3: Commit**

```bash
git add patient/onboarding.html patient/onboarding.js
git commit -m "feat(patient): onboarding with invite code and consents"
```

---

### Task 3: «Сегодня»

**Files:**
- Create: `patient/index.html` (шаблон, `data-tab="today"`, скрипт `today.js`), `patient/today.js`

- [ ] **Step 1: `patient/today.js`**

```js
(function () {
  const { ui, store, patientApp: app, data } = KK;
  const ctx = app.start();
  if (!ctx) return;
  const Q = [
    { key: 'mood', title: 'Какое сегодня настроение?', labels: ['Очень тяжело', 'Тяжело', 'Так себе', 'Неплохо', 'Хорошо'], ends: ['тяжело', 'хорошо'] },
    { key: 'anxiety', title: 'Сколько сегодня беспокойства?', labels: ['Почти нет', 'Немного', 'Заметно', 'Много', 'Очень много'], ends: ['почти нет', 'очень много'] },
    { key: 'sleep', title: 'Как вы спали?', labels: ['Очень плохо', 'Плохо', 'Средне', 'Неплохо', 'Хорошо'], ends: ['плохо', 'хорошо'] },
  ];
  let qi = 0; const answer = {};

  function checkinToday(p) {
    const today = KK.util.dayKey(new Date().toISOString());
    return store.events(p.id, 'checkin').filter((e) => KK.util.dayKey(e.at) === today).at(-1) || null;
  }

  function checkinCard(p) {
    const done = checkinToday(p);
    if (done && qi === 0) return `
      <section class="card row-between">
        <div><p class="q-title">Самочувствие отмечено</p><p class="hint">Спасибо. Врач видит ваши отметки.</p></div>
        <span style="color:var(--accent)">${ui.icon('check')}</span>
      </section>`;
    const q = Q[qi];
    return `
      <section class="card stack" aria-labelledby="q">
        <div class="row-between"><p class="q-title" id="q">${q.title}</p><span class="hint">${qi + 1} из 3</span></div>
        <div class="dots" role="group" aria-labelledby="q">
          ${q.labels.map((l, i) => `<button class="dot" data-v="${i + 1}" aria-label="${l}" aria-pressed="${answer[q.key] === i + 1}"></button>`).join('')}
        </div>
        <div class="dot-labels"><span>${q.ends[0]}</span><span>${q.ends[1]}</span></div>
      </section>`;
  }

  function medsCard(p) {
    if (!p.plan || p.plan.status !== 'confirmed') return `
      <a class="card link-card" href="therapy.html"><div><p class="q-title">Лечение</p><p class="hint">Врач обсуждает с вами план лечения</p></div><span class="chev">${ui.icon('pill', 20)}</span></a>`;
    const drug = data.drugs[p.plan.drugId];
    const slots = app.doseSlots(store.events(p.id, 'dose'), new Date().toISOString());
    return `
      <section class="card card--tint stack">
        <div class="row-between"><p class="q-title">${ui.esc(drug.name)} · ${ui.esc(drug.dosing.dose)}</p><a class="hint" href="therapy.html">Подробнее</a></div>
        <div class="slots">${slots.map((s) => `<button class="slot" data-dose="${s.slot}" aria-pressed="${s.taken}">${s.taken ? ui.icon('check', 18) : ''}${s.slot === 'утро' ? 'Утро' : 'Вечер'}</button>`).join('')}</div>
      </section>`;
  }

  function scalesCard(p) {
    const due = app.dueScales(p.latest, new Date().toISOString(), app.prefs(p.id).scaleEveryDays);
    if (!due.length) return '';
    const [first, ...rest] = due;
    return `
      <a class="card link-card" href="scale.html?id=${first}${rest.length ? `&next=${rest.join(',')}` : ''}">
        <div><p class="q-title">Короткий опросник</p><p class="hint">${due.length === 2 ? 'Около 4 минут' : 'Около 2 минут'} · можно сделать перерыв</p></div>
        <span class="chev">${ui.icon('clipboard', 20)}</span></a>`;
  }

  function practiceCard() {
    const m = app.practiceOfDay();
    return `
      <a class="card link-card" href="material.html?id=${m.id}">
        <div><p class="hint">Практика дня · ${m.minutes} мин</p><p class="q-title">${ui.esc(m.title)}</p></div>
        <span class="chev">${ui.icon('leaf', 20)}</span></a>`;
  }

  function render() {
    const p = ctx.patient();
    const now = new Date().toISOString();
    ui.mount('#app', `
      <header class="p-head"><span class="date">${ui.fmtWeekday(now)}, ${ui.fmtDate(now)}</span>
        <h1>${ui.greeting()}, ${ui.esc(app.firstName(p))}</h1></header>
      <div class="stack">${checkinCard(p)}${medsCard(p)}${scalesCard(p)}${practiceCard()}</div>`);
  }

  document.addEventListener('click', (e) => {
    const dot = e.target.closest('.dot');
    if (dot) {
      answer[Q[qi].key] = Number(dot.dataset.v);
      KK.tg.haptic();
      if (qi < Q.length - 1) { qi++; render(); }
      else {
        store.addEvent(ctx.pid, 'checkin', Object.assign({}, answer));
        qi = 0; Object.keys(answer).forEach((k) => delete answer[k]);
        app.toast('Отмечено. Спасибо');
        render();
      }
      return;
    }
    const slot = e.target.closest('[data-dose]');
    if (slot && slot.getAttribute('aria-pressed') !== 'true') {
      store.addEvent(ctx.pid, 'dose', { slot: slot.dataset.dose, taken: true });
      app.toast('Приём отмечен');
      render();
    }
  });
  store.subscribe(render);
  render();
})();
```

- [ ] **Step 2: Проверка в браузере**

`patient/index.html?p=p_anna` (после онбординга): заголовок с днём недели и именем; чек-ин из 3 шагов, после третьего — «Самочувствие отмечено» и тост; у Анны план «предложен» → карточка «Врач обсуждает с вами план лечения»; опросник не показан (шкалы вчера). `?p=p_olga` → карточка Авиандра, «Утро»/«Вечер» отмечаются, повторно не нажимаются. Ширина 375px (`resize_window` preset `mobile`). Тёмная тема (`resize_window colorScheme: dark`) — читаемо. Скриншоты.

- [ ] **Step 3: Проверка связи с врачом**

`javascript_tool`: `KK.store.events('p_olga','dose').length` растёт после нажатия; `KK.store.events('p_anna','checkin').at(-1).payload` = отмеченные значения.

- [ ] **Step 4: Commit**

```bash
git add patient/index.html patient/today.js
git commit -m "feat(patient): Today screen — check-in, doses, due scales, practice"
```

---

### Task 4: Пошаговый опросник

**Files:**
- Create: `patient/scale.html` (шаблон, `data-tab=""`, скрипт `scale.js`), `patient/scale.js`

- [ ] **Step 1: `patient/scale.js`**

```js
(function () {
  const { ui, store, patientApp: app, data } = KK;
  const ctx = app.start({ tab: null, back: 'index.html' });
  if (!ctx) return;
  const id = ui.param('id');
  const def = data.scales[id];
  if (!def || def.audience === 'doctor') { location.replace('index.html'); return; }
  const next = (ui.param('next') || '').split(',').filter(Boolean);
  const DRAFT = `kk:draft:${ctx.pid}:${id}`;
  let answers = []; let i = 0;
  try { const d = JSON.parse(sessionStorage.getItem(DRAFT)); if (d) { answers = d.answers; i = d.i; } } catch (e) { /* */ }
  const save = () => { try { sessionStorage.setItem(DRAFT, JSON.stringify({ answers, i })); } catch (e) { /* */ } };

  function question() {
    return `
      <a class="p-back" href="index.html">${ui.icon('back', 18)}Сделать перерыв</a>
      <div class="progress" aria-hidden="true">${def.items.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <section class="stack-l" style="margin-top:20px">
        <p class="hint">${ui.esc(def.patientTitle)} · ${i + 1} из ${def.items.length}</p>
        <p class="hint">${ui.esc(def.instruction)}</p>
        <h2 id="q">${ui.esc(def.items[i])}</h2>
        <div class="stack" role="group" aria-labelledby="q">
          ${def.options.map((o) => `<button class="choice" data-v="${o.v}" aria-pressed="${answers[i] === o.v}">${ui.esc(o.label)}</button>`).join('')}
        </div>
        ${i > 0 ? '<button class="btn btn--ghost" data-prev>Назад</button>' : ''}
      </section>`;
  }

  function result(r) {
    const text = KK.scales.interpret(id, r.total, 'patient').label;
    const nextHref = next.length ? `scale.html?id=${next[0]}${next.length > 1 ? `&next=${next.slice(1).join(',')}` : ''}` : null;
    return `
      <section class="stack-l" style="padding-top:8vh">
        <div style="color:var(--accent)">${ui.icon('check', 40)}</div>
        <h1>Спасибо</h1>
        <p>${ui.esc(text)}</p>
        <p class="hint">Ответы отправлены вашему врачу.</p>
        ${nextHref ? `<a class="btn btn--primary btn--block" href="${nextHref}">Ещё один короткий опросник</a><a class="btn btn--ghost btn--block" href="index.html">Позже</a>`
          : '<a class="btn btn--primary btn--block" href="index.html">На главную</a>'}
      </section>`;
  }

  function finish() {
    const e = store.addEvent(ctx.pid, 'scale', { scaleId: id, answers });
    try { sessionStorage.removeItem(DRAFT); } catch (err) { /* */ }
    if (e.payload.flags && e.payload.flags.item9 > 0) { location.replace('help.html?from=phq9'); return; }
    ui.mount('#app', result(e.payload));
  }

  document.addEventListener('click', (e) => {
    const c = e.target.closest('.choice');
    if (c) {
      answers[i] = Number(c.dataset.v);
      KK.tg.haptic();
      ui.mount('#app', question());
      setTimeout(() => {
        if (i < def.items.length - 1) { i++; save(); ui.mount('#app', question()); document.getElementById('q').focus?.(); }
        else finish();
      }, 220);
    }
    if (e.target.closest('[data-prev]')) { i--; save(); ui.mount('#app', question()); }
  });
  ui.mount('#app', question());
})();
```

- [ ] **Step 2: Проверка в браузере**

`patient/scale.html?id=gad7&next=phq9&p=p_anna`: 7 вопросов по одному, прогресс, «Назад» работает, «Сделать перерыв» → главная, повторный вход продолжает с того же вопроса. По завершении — текст без цифр, кнопка «Ещё один короткий опросник» ведёт в PHQ-9. В PHQ-9 ответить на вопрос 9 «Несколько дней» → сразу `help.html?from=phq9`. `KK.store.alerts({patientId:'p_anna',open:true})` содержит `si_phq9`. `scale.html?id=cssrs` → редирект на главную (шкала врачебная).

- [ ] **Step 3: Commit**

```bash
git add patient/scale.html patient/scale.js
git commit -m "feat(patient): step-by-step PHQ-9/GAD-7 with drafts and gentle results"
```

---

### Task 5: «Мне сейчас очень плохо»

**Files:**
- Create: `patient/help.html` (шаблон, `data-tab=""`, скрипт `help.js`), `patient/help.js`

Номера помощи (сверить актуальность перед демо — шаг 2):
- 112 — единый номер экстренных служб;
- 8-495-989-50-50 — телефон доверия экстренной психологической помощи МЧС России;
- 8-800-2000-122 — общероссийский детский телефон доверия (для подростков и родителей).

- [ ] **Step 1: `patient/help.js`**

```js
(function () {
  const { ui, store, patientApp: app } = KK;
  const ctx = app.start({ tab: null, help: false, back: 'index.html' });
  if (!ctx) return;
  const fromPhq = ui.param('from') === 'phq9';
  let sent = fromPhq;
  let g = -1;
  const GROUND = ['5 вещей, которые вы видите', '4 вещи, которых можете коснуться', '3 звука, которые слышите', '2 запаха вокруг', '1 вкус, который чувствуете'];

  function render() {
    ui.mount('#app', `
      <a class="p-back" href="index.html">${ui.icon('back', 18)}Назад</a>
      <section class="stack-l help-hero">
        <h1>Вы не одни</h1>
        <p class="muted">${fromPhq ? 'Спасибо, что ответили честно. Ваш врач уже получил ответы и свяжется с вами.' : 'Сейчас главное — ваша безопасность. Выберите, что подходит.'}</p>
        <div class="stack">
          <a class="help-call" href="tel:112">${ui.icon('phone')}<span><b>112</b><span class="hint">Если есть опасность для жизни</span></span></a>
          <a class="help-call" href="tel:+74959895050">${ui.icon('phone')}<span><b>8 495 989-50-50</b><span class="hint">Психологическая помощь МЧС, круглосуточно</span></span></a>
          <a class="help-call" href="tel:88002000122">${ui.icon('phone')}<span><b>8 800 2000-122</b><span class="hint">Телефон доверия для подростков</span></span></a>
        </div>
        <section class="card card--help stack">
          ${sent ? `<p class="row">${ui.icon('check', 20)}<span>Врач уведомлён</span></p><a class="btn btn--block" href="chat.html">Написать врачу</a>`
            : `<p>Можно сообщить врачу, что вам сейчас плохо. Он увидит это сразу.</p><button class="btn btn--primary btn--block" data-sos>Сообщить врачу</button>`}
        </section>
        <section class="card stack">
          <h3>Вернуться в «здесь и сейчас»</h3>
          ${g < 0 ? '<p class="muted">Упражнение на две минуты. Назовите про себя по очереди:</p><button class="btn btn--block" data-g>Начать</button>'
            : g < GROUND.length ? `<p style="font-size:1.25em" aria-live="polite">${GROUND[g]}</p><button class="btn btn--block" data-g>Дальше</button>`
            : '<p>Хорошо. Сделайте медленный вдох и длинный выдох.</p><a class="btn btn--block" href="material.html?id=breathing">Медленное дыхание</a>'}
        </section>
      </section>`);
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-sos]')) { store.addEvent(ctx.pid, 'sos', { source: 'patient_button' }); sent = true; render(); }
    if (e.target.closest('[data-g]')) { g++; render(); }
  });
  render();
})();
```

- [ ] **Step 2: Проверить номера**

Открыть сайт МЧС (mchs.gov.ru, раздел психологической помощи) и fond-detyam.ru (детский телефон доверия); если номер изменился — обновить `help.js` и этот план.

- [ ] **Step 3: Проверка в браузере**

С главной кнопка «Мне тяжело» → help; нажать «Сообщить врачу» → «Врач уведомлён»; `KK.store.alerts({patientId: KK.patientApp.pid(), open:true})[0].ruleId === 'sos'`. На help-странице нет плавающей кнопки помощи. Цвета — терракотовые, не красные.

- [ ] **Step 4: Commit**

```bash
git add patient/help.html patient/help.js
git commit -m "feat(patient): help screen — crisis lines, notify doctor, grounding"
```

---

### Task 6: Лечение и самочувствие на терапии

**Files:**
- Create: `patient/therapy.html` (шаблон, `data-tab=""`, скрипт `therapy.js`), `patient/therapy.js`

- [ ] **Step 1: `patient/therapy.js`**

```js
(function () {
  const { ui, store, patientApp: app, data } = KK;
  const ctx = app.start({ tab: null, back: 'index.html' });
  if (!ctx) return;
  const SEV = [{ v: 'none', l: 'Нет' }, { v: 'mild', l: 'Немного' }, { v: 'severe', l: 'Сильно' }];
  const marks = {};
  let note = '';
  let sentSevere = null;

  function render() {
    const p = ctx.patient();
    const drug = data.drugs[p.plan?.drugId];
    if (!drug || p.plan.status !== 'confirmed') {
      ui.mount('#app', `<a class="p-back" href="index.html">${ui.icon('back', 18)}Назад</a>
        <section class="stack-l"><h1>Лечение</h1><p class="muted">Врач обсуждает с вами план лечения. Когда он его подтвердит, здесь появятся напоминания о приёме.</p>
        <a class="btn btn--block" href="chat.html">Задать вопрос врачу</a></section>`);
      return;
    }
    const slots = app.doseSlots(store.events(p.id, 'dose'), new Date().toISOString());
    ui.mount('#app', `
      <a class="p-back" href="index.html">${ui.icon('back', 18)}Назад</a>
      <section class="stack-l">
        <header class="stack"><h1>${ui.esc(drug.name)}</h1><p class="muted">${ui.esc(drug.dosing.dose)} · ${drug.dosing.timesPerDay} раза в день</p></header>
        <section class="card card--tint stack"><p class="q-title">Сегодня</p>
          <div class="slots">${slots.map((s) => `<button class="slot" data-dose="${s.slot}" aria-pressed="${s.taken}">${s.taken ? ui.icon('check', 18) : ''}${s.slot === 'утро' ? 'Утро' : 'Вечер'}</button>`).join('')}</div></section>
        <section class="card stack"><p class="q-title">Важно помнить</p>
          <ul class="stack" style="margin:0;padding-left:18px">${drug.patientNotes.map((n) => `<li>${ui.esc(n)}</li>`).join('')}</ul></section>
        <section class="card stack" aria-labelledby="ae">
          <p class="q-title" id="ae">Как вы себя чувствуете на лечении?</p>
          <p class="hint">Отметьте, если что-то из этого появилось за последние дни.</p>
          ${drug.adverseEvents.map((a) => `
            <div class="ae-row stack"><span>${ui.esc(a.label)}</span>
              <div class="seg" role="group" aria-label="${ui.esc(a.label)}">${SEV.map((s) => `<button data-ae="${a.id}" data-sev="${s.v}" aria-pressed="${(marks[a.id] || 'none') === s.v}">${s.l}</button>`).join('')}</div></div>`).join('')}
          <label class="field"><span class="hint">Что-то ещё?</span><textarea id="note" placeholder="Например: тяжело засыпать после вечернего приёма">${ui.esc(note)}</textarea></label>
          <button class="btn btn--primary btn--block" data-send>Отправить врачу</button>
          ${sentSevere === true ? '<div class="card card--help"><p>Врач получил сигнал и свяжется с вами. Если состояние резко ухудшилось — звоните 112.</p></div>' : ''}
          ${sentSevere === false ? '<p class="hint" role="status">Отправлено. Врач увидит ваши отметки.</p>' : ''}
        </section>
      </section>`);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ae]');
    if (b) { note = document.getElementById('note').value; marks[b.dataset.ae] = b.dataset.sev; render(); return; }
    const d = e.target.closest('[data-dose]');
    if (d && d.getAttribute('aria-pressed') !== 'true') { store.addEvent(ctx.pid, 'dose', { slot: d.dataset.dose, taken: true }); app.toast('Приём отмечен'); render(); return; }
    if (e.target.closest('[data-send]')) {
      note = document.getElementById('note').value.trim();
      const drug = data.drugs[ctx.patient().plan.drugId];
      const items = Object.entries(marks).filter(([, s]) => s !== 'none')
        .map(([id, severity]) => ({ id, severity, label: drug.adverseEvents.find((a) => a.id === id).label }));
      if (!items.length && !note) { app.toast('Отметьте хотя бы один пункт или напишите пару слов'); return; }
      store.addEvent(ctx.pid, 'ae', { items, note });
      sentSevere = items.some((i) => i.severity === 'severe');
      Object.keys(marks).forEach((k) => delete marks[k]); note = '';
      render();
    }
  });
  render();
})();
```

- [ ] **Step 2: Проверка в браузере**

`therapy.html?p=p_olga`: 13 НЯ из инструкции, переключатель «Нет/Немного/Сильно»; отправка с «Сильно: Головокружение» → терракотовая карточка; у врача (`KK.store.alerts({patientId:'p_olga',open:true})`) появился `ae_severe`. `therapy.html?p=p_anna` → текст «Врач обсуждает с вами план лечения». Пустая отправка → тост, событие не создаётся.

- [ ] **Step 3: Commit**

```bash
git add patient/therapy.html patient/therapy.js
git commit -m "feat(patient): therapy screen — doses, label notes, adverse-event self-report"
```

---

### Task 7: «Мой путь»

**Files:**
- Create: `patient/path.html` (шаблон, `data-tab="path"`, скрипт `path.js`), `patient/path.js`

- [ ] **Step 1: `patient/path.js`**

```js
(function () {
  const { ui, store, patientApp: app, data } = KK;
  const ctx = app.start();
  if (!ctx) return;
  let period = 14;

  function render() {
    const p = ctx.patient();
    const now = new Date().toISOString();
    const from = KK.util.shiftDays(now, -period);
    const inP = (e) => new Date(e.at) >= new Date(from);
    const checkins = store.events(p.id, 'checkin').filter(inP);
    const series = [
      { label: 'Настроение', color: 'var(--chart)', points: checkins.map((c) => ({ at: c.at, v: c.payload.mood })) },
      { label: 'Сон', color: 'var(--chart-2)', points: checkins.map((c) => ({ at: c.at, v: c.payload.sleep })) },
    ];
    const doseDays = new Set(store.events(p.id, 'dose').map((d) => KK.util.dayKey(d.at)));
    const cal = Array.from({ length: 14 }, (_, k) => {
      const iso = KK.util.shiftDays(now, k - 13);
      return `<i class="${doseDays.has(KK.util.dayKey(iso)) ? 'on' : ''} ${k === 13 ? 'today' : ''}" title="${ui.fmtDate(iso)}"></i>`;
    }).join('');
    const confirmed = p.plan?.status === 'confirmed';
    const takenDays = Array.from({ length: 14 }, (_, k) => KK.util.dayKey(KK.util.shiftDays(now, k - 13))).filter((k) => doseDays.has(k)).length;
    const scales = store.events(p.id, 'scale').filter((e) => e.payload.scaleId !== 'cssrs').slice(-6).reverse();

    ui.mount('#app', `
      <header class="p-head"><h1>Мой путь</h1></header>
      <div class="seg" role="group" aria-label="Период" style="margin-bottom:16px">
        ${[[14, '2 недели'], [30, 'Месяц'], [365, 'Всё время']].map(([d, l]) => `<button data-period="${d}" aria-pressed="${period === d}">${l}</button>`).join('')}
      </div>
      <div class="stack">
        <section class="card stack"><p class="q-title">Настроение и сон</p>
          ${ui.lineChart(series, { max: 5, ticks: false, h: 150, ariaLabel: 'Настроение и сон по дням' })}
          <div class="row hint"><span style="color:var(--chart)">●</span>Настроение<span style="color:var(--chart-2)">●</span>Сон</div>
          <p>${ui.esc(app.checkinSummary(checkins))}</p></section>
        ${confirmed ? `<section class="card stack"><p class="q-title">Приём лекарства</p><div class="cal" aria-label="Дни с отметкой приёма за 2 недели">${cal}</div>
          <p class="hint">Отмечено ${takenDays} ${ui.plural(takenDays, ['день', 'дня', 'дней'])} из 14. Если что-то мешает принимать лекарство — расскажите врачу.</p></section>` : ''}
        <section class="card stack"><p class="q-title">Опросники</p>
          ${scales.length ? scales.map((e) => `<div class="stack" style="padding:8px 0;border-bottom:1px solid var(--line)">
            <span class="hint">${ui.fmtDate(e.at)} · ${ui.esc(data.scales[e.payload.scaleId].patientTitle)}</span>
            <span>${ui.esc(KK.scales.interpret(e.payload.scaleId, e.payload.total, 'patient').label)}</span></div>`).join('') : '<p class="hint">Пока нет пройденных опросников.</p>'}
        </section>
      </div>`);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-period]');
    if (b) { period = Number(b.dataset.period); render(); }
  });
  store.subscribe(render);
  render();
})();
```

- [ ] **Step 2: Проверка в браузере**

`path.html?p=p_olga`: график без числовой оси, текст «настроение стало заметно ровнее», календарь 14 клеток, список опросников словами без цифр. `p_anna` — календаря нет (план не подтверждён). Переключение периода перерисовывает график.

- [ ] **Step 3: Commit**

```bash
git add patient/path.html patient/path.js
git commit -m "feat(patient): My path — gentle trends, dose calendar, scale history in words"
```

---

### Task 8: Связь с врачом

**Files:**
- Create: `patient/chat.html` (шаблон, `data-tab="chat"`, скрипт `chat.js`), `patient/chat.js`

- [ ] **Step 1: `patient/chat.js`**

```js
(function () {
  const { ui, store, patientApp: app } = KK;
  const ctx = app.start();
  if (!ctx) return;
  const CHIPS = ['Вопрос о лекарстве', 'Хочу перенести визит', 'Появились побочные эффекты'];
  function render() {
    const doc = store.doctor();
    const msgs = store.messages(ctx.pid).filter((m) => m.from !== 'system');
    ui.mount('#app', `
      <header class="p-head"><h1>Ваш врач</h1><p class="muted">${ui.esc(doc.name)} · ${ui.esc(doc.specialty)}</p>
        <p class="hint">Врач отвечает в рабочее время. В экстренной ситуации звоните 112.</p></header>
      <section class="stack" id="msgs" aria-live="polite">
        ${msgs.length ? msgs.map((m) => `<div class="bubble ${m.from === 'patient' ? 'me' : ''}"><div>${ui.esc(m.text)}</div><div class="t">${ui.fmtDateTime(m.at)}</div></div>`).join('')
          : '<p class="hint">Здесь будет ваша переписка с врачом.</p>'}
      </section>
      <div class="chips" style="margin-top:16px">${CHIPS.map((c) => `<button class="chip" data-chip="${ui.esc(c)}">${ui.esc(c)}</button>`).join('')}</div>
      <form class="compose" id="f"><label class="sr-only" for="t">Сообщение</label>
        <textarea id="t" rows="1" placeholder="Напишите сообщение"></textarea>
        <button class="btn btn--primary" aria-label="Отправить">${ui.icon('chat', 18)}</button></form>`);
  }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-chip]');
    if (c) { const t = document.getElementById('t'); t.value = c.dataset.chip + ': '; t.focus(); }
  });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = document.getElementById('t');
    const text = t.value.trim();
    if (!text) return;
    store.sendMessage(ctx.pid, 'patient', text);
    render();
  });
  store.subscribe(render);
  render();
})();
```

- [ ] **Step 2: Проверка** — отправка сообщения появляется пузырём справа; пустое не отправляется; `KK.store.messages(pid)` содержит текст; системные сообщения скрыты.

- [ ] **Step 3: Commit**

```bash
git add patient/chat.html patient/chat.js
git commit -m "feat(patient): messages with doctor"
```

---

### Task 9: Материалы и статья

**Files:**
- Create: `patient/materials.html` (`data-tab="materials"`, `materials.js`), `patient/materials.js`, `patient/material.html` (`data-tab=""`, `material.js`), `patient/material.js`

- [ ] **Step 1: `patient/materials.js`**

```js
(function () {
  const { ui, patientApp: app, data } = KK;
  const ctx = app.start();
  if (!ctx) return;
  const CATS = [['practice', 'Практики'], ['about', 'Понять, что происходит'], ['treatment', 'О лечении']];
  ui.mount('#app', `
    <header class="p-head"><h1>Материалы</h1><p class="muted">Короткие тексты и упражнения. Читайте в своём темпе.</p></header>
    <div class="stack-l">${CATS.map(([cat, title]) => `
      <section class="stack"><h2>${title}</h2>
        ${data.materials.filter((m) => m.cat === cat).map((m) => `
          <a class="card link-card" href="material.html?id=${m.id}"><div><p class="q-title">${ui.esc(m.title)}</p><p class="hint">${ui.esc(m.summary)} · ${m.minutes} мин</p></div>
          <span class="chev">${ui.icon(cat === 'practice' ? 'leaf' : 'book', 20)}</span></a>`).join('')}
      </section>`).join('')}</div>`);
})();
```

- [ ] **Step 2: `patient/material.js`**

```js
(function () {
  const { ui, patientApp: app, data } = KK;
  const ctx = app.start({ tab: null, back: 'materials.html' });
  if (!ctx) return;
  const m = data.materials.find((x) => x.id === ui.param('id'));
  if (!m) { location.replace('materials.html'); return; }
  const block = (b) => typeof b === 'string' ? `<p>${ui.esc(b)}</p>`
    : b.type === 'steps' ? `<ol class="steps">${b.items.map((i) => `<li>${ui.esc(i)}</li>`).join('')}</ol>`
    : `${b.title ? `<p class="q-title">${ui.esc(b.title)}</p>` : ''}<ul class="stack" style="margin:0;padding-left:18px">${b.items.map((i) => `<li>${ui.esc(i)}</li>`).join('')}</ul>`;
  ui.mount('#app', `
    <a class="p-back" href="materials.html">${ui.icon('back', 18)}Материалы</a>
    <article class="stack-l"><header class="stack"><span class="hint">${m.minutes} мин</span><h1>${ui.esc(m.title)}</h1></header>
      ${m.breath ? `<section class="card stack" style="text-align:center"><div class="breath" id="b">Вдох</div><button class="btn btn--primary" data-breath>Начать</button></section>` : ''}
      ${m.body.map(block).join('')}
      <p class="hint">Источник: ${ui.esc(m.source)}</p></article>`);
  let timer = null;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-breath]');
    if (!b) return;
    const el = document.getElementById('b');
    if (timer) { clearTimeout(timer); timer = null; el.classList.remove('in'); el.textContent = 'Вдох'; b.textContent = 'Начать'; return; }
    b.textContent = 'Остановить';
    const end = Date.now() + m.breath.minutes * 60000;
    const cycle = (inhale) => {
      if (Date.now() > end) { el.textContent = 'Готово'; el.classList.remove('in'); b.textContent = 'Начать'; timer = null; return; }
      el.style.transitionDuration = `${inhale ? m.breath.inhale : m.breath.exhale}s`;
      el.classList.toggle('in', inhale); el.textContent = inhale ? 'Вдох' : 'Выдох';
      timer = setTimeout(() => cycle(!inhale), (inhale ? m.breath.inhale : m.breath.exhale) * 1000);
    };
    cycle(true);
  });
})();
```

- [ ] **Step 3: Проверка** — 8 материалов в трёх группах, статья с шагами и источником; «Медленное дыхание» — круг расширяется 4 с и сжимается 6 с, «Остановить» работает; при `prefers-reduced-motion` круг не анимируется, но подписи «Вдох/Выдох» меняются.

- [ ] **Step 4: Commit**

```bash
git add patient/materials.html patient/materials.js patient/material.html patient/material.js
git commit -m "feat(patient): materials library and article view with breathing pacer"
```

---

### Task 10: Профиль

**Files:**
- Create: `patient/profile.html` (`data-tab="profile"`, `profile.js`), `patient/profile.js`

- [ ] **Step 1: `patient/profile.js`**

```js
(function () {
  const { ui, store, patientApp: app } = KK;
  const ctx = app.start();
  if (!ctx) return;
  function render() {
    const p = ctx.patient();
    const prefs = app.prefs(p.id);
    const theme = (() => { try { return localStorage.getItem('kk:theme') || 'auto'; } catch (e) { return 'auto'; } })();
    ui.mount('#app', `
      <header class="p-head"><h1>${ui.esc(p.name)}</h1><p class="muted">Ваш врач: ${ui.esc(store.doctor().name)}</p></header>
      <div class="stack">
        <section class="card stack"><p class="q-title">Оформление</p>
          <div class="seg" role="group" aria-label="Тема">${[['light', 'Светлая'], ['dark', 'Тёмная'], ['auto', 'Как в системе']].map(([v, l]) =>
            `<button data-theme-set="${v}" aria-pressed="${theme === v}">${l}</button>`).join('')}</div></section>
        <section class="card stack"><p class="q-title">Опросники</p><p class="hint">Как часто предлагать короткие опросники</p>
          <div class="seg" role="group" aria-label="Частота">${[[7, 'Раз в неделю'], [14, 'Раз в 2 недели'], [28, 'Раз в месяц']].map(([v, l]) =>
            `<button data-every="${v}" aria-pressed="${prefs.scaleEveryDays === v}">${l}</button>`).join('')}</div></section>
        <section class="card"><label class="check"><input type="checkbox" data-rem ${prefs.reminders ? 'checked' : ''}><span>Напоминать о приёме лекарства</span></label></section>
        <section class="card stack"><p class="q-title">Данные</p>
          <p class="hint">Ваши отметки видит только ваш лечащий врач. Вы можете отозвать согласие, написав врачу.</p></section>
        <a class="btn btn--ghost btn--block" href="../index.html">Демо: выбрать другого пациента</a>
      </div>`);
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme-set]');
    if (t) {
      const v = t.dataset.themeSet;
      if (v === 'auto') { try { localStorage.removeItem('kk:theme'); } catch (err) { /* */ } delete document.documentElement.dataset.theme; }
      else KK.tg.setTheme(v);
      render();
    }
    const ev = e.target.closest('[data-every]');
    if (ev) { app.setPrefs(ctx.pid, { scaleEveryDays: Number(ev.dataset.every) }); render(); }
  });
  document.addEventListener('change', (e) => { if (e.target.matches('[data-rem]')) app.setPrefs(ctx.pid, { reminders: e.target.checked }); });
  render();
})();
```

- [ ] **Step 2: Проверка** — переключение темы мгновенно меняет оформление и сохраняется между страницами; частота 7 дней → на «Сегодня» у Ольги появляется карточка опросника (шкалы были 1 день назад — нет; у Сергея GAD-7 2 дня назад — нет; проверить на Галине: 3 дня → нет; поставить и проверить логику через `KK.patientApp.dueScales`).

- [ ] **Step 3: Commit**

```bash
git add patient/profile.html patient/profile.js
git commit -m "feat(patient): profile — theme, scale frequency, reminders"
```

---

### Task 11: Сквозная проверка пациента

- [ ] **Step 1:** `npm test` — все тесты зелёные.
- [ ] **Step 2:** В превью пройти путь Анны: лаунчер → «Как пациент» → онбординг → чек-ин → опросник GAD-7 + PHQ-9 → материалы → помощь → профиль (тёмная тема). Ошибок в консоли нет (`read_console_messages onlyErrors`).
- [ ] **Step 3:** Mobile 375×812 — нет горизонтального скролла ни на одной странице (`javascript_tool`: `document.documentElement.scrollWidth <= innerWidth`).
- [ ] **Step 4:** Поиск запрещённого на стороне пациента: `grep -rnE "badge--critical|--crit|балл|тяж[её]л(ая|ой|ую|ые)|критическ|выраженн" patient/ assets/patient.*` — пусто (самоотчёт «Тяжело» в чек-ине допустим — это слова пациента, а не оценка системы).
- [ ] **Step 5:** Эргономика: чек-ин = 3 тапа, отметка приёма = 1 тап, вызов помощи с любого экрана = 1 тап.
- [ ] **Step 6:** Скриншоты «Сегодня» (светлая/тёмная), опросник, помощь — `docs/screens/patient-*.png`.
- [ ] **Step 7:** `graphify update .` (если доступен). Commit:

```bash
git add docs/screens
git commit -m "docs: patient UI screenshots"
```
