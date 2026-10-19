# Клинический компас — План 1: ядро (данные, шкалы, правила, хранилище, дизайн-токены)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать ядро демо-прототипа без UI-экранов: справочники (шкалы, Авиандр, классы препаратов), движки (подсчёт шкал, проверка терапии, приверженность, правила алертинга/маршрутизации, парсер истории болезни), слой хранения со связью «врач–пациент», 5 сценариев, дизайн-токены и лаунчер.

**Architecture:** Классические скрипты без сборки (работают и с `file://`, и в Telegram Mini App). Каждый файл расширяет глобальный неймспейс `globalThis.KK`; порядок подключения: `data/*` → `assets/*`. Тесты — встроенный `node --test`, файлы подключаются через `require` (тот же `globalThis.KK`). Хранилище принимает инъекцию `storage` и `clock` для тестов.

**Tech Stack:** HTML5, CSS custom properties, ванильный JS (ES2020), Node ≥18 (`node --test`), без зависимостей.

**Спек:** `docs/superpowers/specs/2026-10-19-klinicheskiy-kompas-ui-design.md`
**Следующие планы:** `2026-10-19-kompas-2-patient.md` (экраны пациента), `2026-10-19-kompas-3-doctor.md` (экраны врача) — опираются на API, зафиксированный здесь (раздел «Контракт ядра» в конце).

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `package.json` | скрипт `test`, без зависимостей |
| `tools/serve.js` | статический сервер для превью (порт 5180) |
| `.claude/launch.json` | конфиг превью |
| `data/scales.js` | `KK.data.scales`: PHQ-9, GAD-7, C-SSRS (скрининг) — вопросы, ключи, градации, источники |
| `data/drugs/classes.js` | `KK.data.drugClasses`: словарь препаратов → фарм. классы |
| `data/drugs/aviandr.js` | `KK.data.drugs.aviandr`: инструкция Авиандра |
| `data/rules/core.js` | `KK.data.rules`: декларативные правила алертинга/маршрутизации |
| `data/scenarios.js` | `KK.data.scenarios`: 5 сценариев |
| `assets/kk.js` | создание неймспейса, утилиты дат |
| `assets/scales.js` | `KK.scales.score / interpret` |
| `assets/therapy.js` | `KK.therapy.check` |
| `assets/adherence.js` | `KK.adherence.pdc / missedStreak` |
| `assets/rules.js` | `KK.rules.buildContext / evaluate / routing` |
| `assets/parser.js` | `KK.parser.extract` |
| `assets/store.js` | `KK.createStore`, `KK.store` |
| `assets/tg.js` | адаптер Telegram WebApp |
| `assets/tokens.css` | темы: patient-light, patient-dark, doctor |
| `assets/ui.css` | компоненты |
| `index.html` | лаунчер: выбор роли и сценария, сброс демо |
| `ui-kit.html` | витрина компонентов для визуальной проверки |
| `tests/load.js` | загрузчик всех скриптов ядра в Node |
| `tests/*.test.js` | юнит-тесты |

---

### Task 1: Каркас проекта и тест-раннер

**Files:**
- Create: `package.json`, `tools/serve.js`, `.claude/launch.json`, `assets/kk.js`, `tests/load.js`, `tests/kk.test.js`

- [ ] **Step 1: package.json**

```json
{
  "name": "klinicheskiy-kompas",
  "version": "0.1.0",
  "private": true,
  "description": "Демо-прототип «Клинический компас»: интерфейсы врача и пациента",
  "scripts": {
    "test": "node --test tests/",
    "serve": "node tools/serve.js"
  }
}
```

- [ ] **Step 2: Написать падающий тест неймспейса**

`tests/kk.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

test('namespace exists', () => {
  assert.equal(typeof KK, 'object');
  assert.equal(typeof KK.data, 'object');
});

test('daysBetween counts whole days', () => {
  assert.equal(KK.util.daysBetween('2026-10-01T09:00:00Z', '2026-10-19T08:00:00Z'), 17);
  assert.equal(KK.util.daysBetween('2026-10-19T08:00:00Z', '2026-10-19T20:00:00Z'), 0);
});

test('shiftDays returns ISO shifted by n days', () => {
  assert.equal(KK.util.shiftDays('2026-10-19T09:00:00.000Z', -3), '2026-10-16T09:00:00.000Z');
});

test('dayKey returns local YYYY-MM-DD', () => {
  assert.match(KK.util.dayKey('2026-10-19T09:00:00.000Z'), /^\d{4}-\d{2}-\d{2}$/);
});
```

`tests/load.js` (единственное место, где перечислен порядок файлов для Node; HTML-страницы подключают в том же порядке):
```js
const path = require('node:path');
const root = path.join(__dirname, '..');
const FILES = [
  'assets/kk.js',
  'data/scales.js',
  'data/drugs/classes.js',
  'data/drugs/aviandr.js',
  'data/rules/core.js',
  'data/scenarios.js',
  'assets/scales.js',
  'assets/therapy.js',
  'assets/adherence.js',
  'assets/rules.js',
  'assets/parser.js',
  'assets/store.js',
];
const fs = require('node:fs');
for (const f of FILES) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) require(p);
}
module.exports = { FILES };
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `KK` is `undefined`.

- [ ] **Step 4: Реализовать `assets/kk.js`**

```js
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
```

- [ ] **Step 5: Статический сервер `tools/serve.js`**

```js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 5180;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.normalize(path.join(root, url));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`Клинический компас: http://localhost:${PORT}`));
```

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "kompas", "runtimeExecutable": "node", "runtimeArgs": ["tools/serve.js"], "port": 5180 }
  ]
}
```

- [ ] **Step 6: Тесты зелёные**

Run: `npm test`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json tools/serve.js .claude/launch.json assets/kk.js tests/load.js tests/kk.test.js
git commit -m "chore: project scaffold, namespace and test runner"
```

---

### Task 2: Справочник шкал и подсчёт

**Files:**
- Create: `data/scales.js`, `assets/scales.js`
- Test: `tests/scales.test.js`

Источники: PHQ-9 — Kroenke K., Spitzer R.L., Williams J.B. J Gen Intern Med 2001;16(9):606–613; GAD-7 — Spitzer R.L. et al. Arch Intern Med 2006;166(10):1092–1097; обе шкалы — свободное использование без разрешения (Pfizer, phqscreeners.com), русские версии — официальные переводы с phqscreeners.com. C-SSRS (скрининговая версия) — Posner K. et al. Am J Psychiatry 2011;168(12):1266–1277; бесплатна для клинического использования (cssrs.columbia.edu), русская версия — с сайта Columbia Lighthouse Project. Формулировки ниже сверить дословно с официальными русскими PDF при выполнении задачи (Step 1a).

- [ ] **Step 1: Написать падающие тесты**

`tests/scales.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const { scales } = globalThis.KK;

test('PHQ-9 has 9 items, GAD-7 has 7, C-SSRS screener has 6', () => {
  const d = globalThis.KK.data.scales;
  assert.equal(d.phq9.items.length, 9);
  assert.equal(d.gad7.items.length, 7);
  assert.equal(d.cssrs.items.length, 6);
});

test('PHQ-9 total and band', () => {
  const r = scales.score('phq9', [3, 3, 2, 2, 2, 3, 2, 2, 2]);
  assert.equal(r.total, 21);
  assert.equal(r.band.code, 'severe');
  assert.equal(r.complete, true);
  assert.equal(r.flags.item9, 2);
});

test('PHQ-9 band boundaries 4/5/9/10/14/15/19/20', () => {
  const b = (t) => scales.bandFor('phq9', t).code;
  assert.equal(b(4), 'minimal'); assert.equal(b(5), 'mild');
  assert.equal(b(9), 'mild'); assert.equal(b(10), 'moderate');
  assert.equal(b(14), 'moderate'); assert.equal(b(15), 'modsevere');
  assert.equal(b(19), 'modsevere'); assert.equal(b(20), 'severe');
});

test('GAD-7 band boundaries 4/5/9/10/14/15', () => {
  const b = (t) => scales.bandFor('gad7', t).code;
  assert.equal(b(4), 'minimal'); assert.equal(b(5), 'mild');
  assert.equal(b(10), 'moderate'); assert.equal(b(15), 'severe');
});

test('incomplete answers flagged, total over answered only', () => {
  const r = scales.score('gad7', [1, 2, null, 1]);
  assert.equal(r.complete, false);
  assert.equal(r.total, 4);
});

test('out-of-range answer throws', () => {
  assert.throws(() => scales.score('phq9', [4, 0, 0, 0, 0, 0, 0, 0, 0]), /range/);
});

test('C-SSRS risk levels', () => {
  assert.equal(scales.score('cssrs', [0, 0, 0, 0, 0, 0]).band.code, 'none');
  assert.equal(scales.score('cssrs', [1, 0, 0, 0, 0, 0]).band.code, 'low');
  assert.equal(scales.score('cssrs', [1, 1, 1, 0, 0, 0]).band.code, 'moderate');
  assert.equal(scales.score('cssrs', [1, 1, 1, 1, 0, 0]).band.code, 'high');
  assert.equal(scales.score('cssrs', [0, 0, 0, 0, 0, 1]).band.code, 'high');
});

test('patient-facing interpretation never contains numbers or severity words', () => {
  for (const id of ['phq9', 'gad7']) {
    for (const band of globalThis.KK.data.scales[id].bands) {
      assert.doesNotMatch(band.patientText, /\d|тяж|выраж|крит/i, `${id}/${band.code}`);
    }
  }
});

test('interpret returns doctor label with source', () => {
  const i = scales.interpret('phq9', 12, 'doctor');
  assert.match(i.label, /умеренн/i);
  assert.match(i.source, /Kroenke/);
});
```

- [ ] **Step 1a: Сверить формулировки**

Открыть официальные русские версии PHQ-9 и GAD-7 (https://www.phqscreeners.com/select-screener → Russian) и C-SSRS Screener Russian (https://cssrs.columbia.edu/the-columbia-scale-c-ssrs/cssrs-for-communities-and-healthcare/#filter=.general-use.russian). Если формулировки ниже отличаются — использовать официальные дословно.

- [ ] **Step 2: Запустить — падает**

Run: `npm test`
Expected: FAIL — `Cannot read properties of undefined (reading 'phq9')`.

- [ ] **Step 3: `data/scales.js`**

```js
(function (g) {
  const KK = g.KK;
  const FREQ = [
    { v: 0, label: 'Ни разу' },
    { v: 1, label: 'Несколько дней' },
    { v: 2, label: 'Более половины дней' },
    { v: 3, label: 'Почти каждый день' },
  ];
  const YESNO = [{ v: 0, label: 'Нет' }, { v: 1, label: 'Да' }];

  KK.data.scales = {
    phq9: {
      id: 'phq9',
      title: 'PHQ-9 — опросник здоровья пациента',
      patientTitle: 'Как вы себя чувствовали',
      instruction: 'Как часто за последние 2 недели вас беспокоили следующие проблемы?',
      periodDays: 14,
      options: FREQ,
      items: [
        'Вам не хотелось ничего делать, занятия не приносили интереса или удовольствия',
        'У вас было плохое настроение, вы были подавлены или испытывали чувство безысходности',
        'Вам было трудно заснуть, сон был прерывистым, или вы слишком много спали',
        'Вы были утомлены, или у вас было мало сил',
        'У вас был плохой аппетит, или вы переедали',
        'Вы плохо о себе думали: считали себя неудачником, были в себе разочарованы или считали, что подвели свою семью',
        'Вам было трудно сосредоточиться, например, на чтении или просмотре телепередач',
        'Вы двигались или говорили настолько медленно, что окружающие это замечали, или, наоборот, были настолько суетливы, что двигались больше обычного',
        'Вас посещали мысли о том, что вам лучше было бы умереть, или о том, чтобы причинить себе вред',
      ],
      bands: [
        { code: 'minimal', min: 0, max: 4, doctorLabel: 'Минимальные симптомы депрессии',
          patientText: 'Сейчас настроение в целом устойчивое. Продолжайте отмечать самочувствие.' },
        { code: 'mild', min: 5, max: 9, doctorLabel: 'Лёгкая депрессивная симптоматика',
          patientText: 'Есть дни, когда бывает непросто. Это важно знать вашему врачу, ответы уже у него.' },
        { code: 'moderate', min: 10, max: 14, doctorLabel: 'Умеренная депрессивная симптоматика',
          patientText: 'Последние недели даются нелегко. Врач увидит ответы и обсудит с вами, что может помочь.' },
        { code: 'modsevere', min: 15, max: 19, doctorLabel: 'Умеренно тяжёлая депрессивная симптоматика',
          patientText: 'Похоже, сейчас вам по-настоящему трудно. Врач получил ответы и свяжется с вами.' },
        { code: 'severe', min: 20, max: 27, doctorLabel: 'Тяжёлая депрессивная симптоматика',
          patientText: 'Похоже, сейчас вам по-настоящему трудно. Врач получил ответы и свяжется с вами. Вы не одни.' },
      ],
      flagItems: { item9: 8 },
      source: 'Kroenke K., Spitzer R.L., Williams J.B. J Gen Intern Med. 2001;16(9):606–613',
      license: 'Свободное использование без разрешения (Pfizer); официальный русский перевод — phqscreeners.com',
    },
    gad7: {
      id: 'gad7',
      title: 'GAD-7 — шкала генерализованного тревожного расстройства',
      patientTitle: 'Тревога и беспокойство',
      instruction: 'Как часто за последние 2 недели вас беспокоили следующие проблемы?',
      periodDays: 14,
      options: FREQ,
      items: [
        'Вы нервничали, тревожились или были на грани срыва',
        'Вы не могли остановить или контролировать беспокойство',
        'Вы слишком сильно беспокоились по разным поводам',
        'Вам было трудно расслабиться',
        'Вы были настолько беспокойны, что было тяжело усидеть на месте',
        'Вы легко раздражались или злились',
        'Вы боялись, что может случиться что-то ужасное',
      ],
      bands: [
        { code: 'minimal', min: 0, max: 4, doctorLabel: 'Минимальная тревога',
          patientText: 'Сейчас тревога вас почти не беспокоит. Продолжайте отмечать самочувствие.' },
        { code: 'mild', min: 5, max: 9, doctorLabel: 'Лёгкая тревога',
          patientText: 'Беспокойство иногда даёт о себе знать. Ответы уже у вашего врача.' },
        { code: 'moderate', min: 10, max: 14, doctorLabel: 'Умеренная тревога',
          patientText: 'Беспокойство заметно мешает. Врач увидит ответы и обсудит с вами, что может помочь.' },
        { code: 'severe', min: 15, max: 21, doctorLabel: 'Выраженная тревога',
          patientText: 'Похоже, беспокойство сейчас забирает много сил. Врач получил ответы и свяжется с вами.' },
      ],
      flagItems: {},
      source: 'Spitzer R.L., Kroenke K., Williams J.B., Löwe B. Arch Intern Med. 2006;166(10):1092–1097',
      license: 'Свободное использование без разрешения (Pfizer); официальный русский перевод — phqscreeners.com',
    },
    cssrs: {
      id: 'cssrs',
      title: 'C-SSRS — Колумбийская шкала оценки тяжести суицидального риска (скрининг)',
      audience: 'doctor',
      instruction: 'Задайте вопросы 1 и 2. При ответе «да» на вопрос 2 задайте вопросы 3–5. Вопрос 6 задаётся всегда.',
      options: YESNO,
      items: [
        'За последний месяц: желали ли вы себе смерти или хотели уснуть и не проснуться?',
        'За последний месяц: были ли у вас мысли о том, чтобы покончить с собой?',
        'Думали ли вы о том, как могли бы это сделать?',
        'Были ли у вас намерения действовать согласно этим мыслям?',
        'Начали ли вы разрабатывать или разработали детальный план? Намерены ли его осуществить?',
        'За последние 3 месяца: делали ли вы что-либо, начинали или готовились сделать, чтобы покончить с жизнью?',
      ],
      bands: [
        { code: 'none', doctorLabel: 'Суицидальный риск не выявлен' },
        { code: 'low', doctorLabel: 'Низкий риск: пассивные мысли о смерти' },
        { code: 'moderate', doctorLabel: 'Умеренный риск: мысли о способе' },
        { code: 'high', doctorLabel: 'Высокий риск: намерение, план или действия' },
      ],
      source: 'Posner K. et al. Am J Psychiatry. 2011;168(12):1266–1277',
      license: 'Бесплатно для клинического использования (Columbia Lighthouse Project); русская версия — cssrs.columbia.edu',
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: `assets/scales.js`**

```js
(function (g) {
  const KK = g.KK;
  function def(id) {
    const d = KK.data.scales[id];
    if (!d) throw new Error(`Unknown scale: ${id}`);
    return d;
  }
  function bandFor(id, total) {
    const d = def(id);
    return d.bands.find((b) => total >= b.min && total <= b.max) || null;
  }
  function cssrsBand(a) {
    const yes = (i) => a[i] === 1;
    const code = yes(3) || yes(4) || yes(5) ? 'high' : yes(2) ? 'moderate' : yes(0) || yes(1) ? 'low' : 'none';
    return def('cssrs').bands.find((b) => b.code === code);
  }
  function score(id, answers) {
    const d = def(id);
    const max = Math.max(...d.options.map((o) => o.v));
    answers.forEach((v) => {
      if (v != null && (v < 0 || v > max || !Number.isInteger(v))) throw new Error(`Answer out of range: ${v}`);
    });
    const answered = answers.filter((v) => v != null);
    const total = answered.reduce((s, v) => s + v, 0);
    const complete = answered.length === d.items.length;
    const flags = {};
    for (const [name, idx] of Object.entries(d.flagItems || {})) flags[name] = answers[idx] ?? null;
    const band = id === 'cssrs' ? cssrsBand(answers) : bandFor(id, total);
    return { scaleId: id, answers: answers.slice(), total, complete, band, flags };
  }
  function interpret(id, total, audience) {
    const d = def(id);
    const band = bandFor(id, total);
    return {
      label: audience === 'patient' ? band.patientText : band.doctorLabel,
      code: band.code,
      source: d.source,
    };
  }
  KK.scales = { score, bandFor, interpret };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 5: Тесты зелёные**

Run: `npm test`
Expected: PASS (все тесты `scales.test.js` и `kk.test.js`).

- [ ] **Step 6: Commit**

```bash
git add data/scales.js assets/scales.js tests/scales.test.js
git commit -m "feat(core): PHQ-9, GAD-7, C-SSRS scales with scoring and interpretation"
```

---

### Task 3: Классы препаратов, Авиандр и проверка терапии

**Files:**
- Create: `data/drugs/classes.js`, `data/drugs/aviandr.js`, `assets/therapy.js`
- Test: `tests/therapy.test.js`

Источник: инструкция по медицинскому применению «Авиандр», ЛП-№(002445)-(РГ-RU) от 31.05.2023 (Vidal, ред. 23.07.2026). При выполнении сверить с ГРЛС (https://grls.rosminzdrav.ru, поиск «Авиандр»).

- [ ] **Step 1: Написать падающие тесты**

`tests/therapy.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const drug = () => KK.data.drugs.aviandr;

const base = () => ({
  age: 40, sex: 'f', pregnant: false, lactating: false,
  diagnoses: [{ code: 'F41.1', text: 'Генерализованное тревожное расстройство' }],
  meds: [], allergies: [], conditions: [],
  labs: { egfr: 95, childPugh: 'none' },
});

test('classify known drug names', () => {
  assert.deepEqual(KK.therapy.classesOf('Сертралин 50 мг').sort(), ['cyp2d6_inhibitor', 'serotonergic', 'ssri']);
  assert.deepEqual(KK.therapy.classesOf('неизвестный'), []);
});

test('GAD patient without risks is eligible and indicated', () => {
  const r = KK.therapy.check(drug(), base());
  assert.equal(r.eligible, true);
  assert.equal(r.indicated, true);
  assert.equal(r.contraindications.filter((c) => c.status === 'present').length, 0);
});

test('eGFR 52 is a contraindication', () => {
  const p = base(); p.labs.egfr = 52;
  const r = KK.therapy.check(drug(), p);
  assert.equal(r.eligible, false);
  assert.equal(r.contraindications.find((c) => c.id === 'renal').status, 'present');
});

test('missing eGFR yields unknown and eligible null', () => {
  const p = base(); delete p.labs.egfr;
  const r = KK.therapy.check(drug(), p);
  assert.equal(r.contraindications.find((c) => c.id === 'renal').status, 'unknown');
  assert.equal(r.eligible, null);
});

test('age under 18, pregnancy, epilepsy, MAOI, hepatic impairment', () => {
  const cases = [
    ['age', (p) => { p.age = 17; }],
    ['pregnancy', (p) => { p.pregnant = true; }],
    ['cns', (p) => { p.conditions = ['epilepsy']; }],
    ['maoi', (p) => { p.meds = [{ name: 'Моклобемид' }]; }],
    ['maoi', (p) => { p.maoiStoppedDaysAgo = 7; }],
    ['hepatic', (p) => { p.labs.childPugh = 'A'; }],
  ];
  for (const [id, mut] of cases) {
    const p = base(); mut(p);
    const r = KK.therapy.check(drug(), p);
    assert.equal(r.contraindications.find((c) => c.id === id).status, 'present', id);
    assert.equal(r.eligible, false, id);
  }
});

test('sertraline triggers serotonergic and CYP2D6 warnings but stays eligible', () => {
  const p = base(); p.meds = [{ name: 'Сертралин 50 мг' }];
  const r = KK.therapy.check(drug(), p);
  const ids = r.interactions.map((i) => i.id).sort();
  assert.deepEqual(ids, ['cyp2d6', 'serotonin']);
  assert.equal(r.eligible, true);
});

test('benzodiazepine triggers sedation warning', () => {
  const p = base(); p.meds = [{ name: 'Феназепам' }];
  assert.deepEqual(KK.therapy.check(drug(), p).interactions.map((i) => i.id), ['sedation']);
});

test('post-COVID adjustment disorder is indicated only with postCovid flag', () => {
  const p = base(); p.diagnoses = [{ code: 'F43.2', text: 'Расстройство адаптации' }];
  assert.equal(KK.therapy.check(drug(), p).indicated, false);
  p.postCovid = true;
  assert.equal(KK.therapy.check(drug(), p).indicated, true);
});

test('cautions: elderly and cardiovascular', () => {
  const p = base(); p.age = 70; p.conditions = ['cvd'];
  const ids = KK.therapy.check(drug(), p).cautions.map((c) => c.id).sort();
  assert.deepEqual(ids, ['cvd', 'elderly']);
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test`
Expected: FAIL — `KK.therapy` is undefined.

- [ ] **Step 3: `data/drugs/classes.js`**

```js
(function (g) {
  // Ключ — основа МНН/торгового названия в нижнем регистре; значение — классы для проверки взаимодействий.
  g.KK.data.drugClasses = {
    'сертралин': ['ssri', 'serotonergic', 'cyp2d6_inhibitor'],
    'флуоксетин': ['ssri', 'serotonergic', 'cyp2d6_inhibitor'],
    'пароксетин': ['ssri', 'serotonergic', 'cyp2d6_inhibitor'],
    'эсциталопрам': ['ssri', 'serotonergic'],
    'циталопрам': ['ssri', 'serotonergic'],
    'флувоксамин': ['ssri', 'serotonergic'],
    'венлафаксин': ['snri', 'serotonergic'],
    'дулоксетин': ['snri', 'serotonergic', 'cyp2d6_inhibitor'],
    'трамадол': ['serotonergic'],
    'фентанил': ['serotonergic'],
    'суматриптан': ['triptan', 'serotonergic'],
    'золмитриптан': ['triptan', 'serotonergic'],
    'лития карбонат': ['serotonergic'],
    'литий': ['serotonergic'],
    'зверобой': ['serotonergic'],
    'моклобемид': ['maoi'],
    'пирлиндол': ['maoi'],
    'селегилин': ['maoi'],
    'феназепам': ['benzodiazepine'],
    'бромдигидрохлорфенилбензодиазепин': ['benzodiazepine'],
    'алпразолам': ['benzodiazepine'],
    'диазепам': ['benzodiazepine'],
    'лоразепам': ['benzodiazepine'],
    'кветиапин': ['antipsychotic'],
    'оланзапин': ['antipsychotic'],
    'галоперидол': ['antipsychotic'],
    'фенобарбитал': ['barbiturate'],
    'дифенгидрамин': ['h1_blocker', 'cyp2d6_inhibitor'],
    'гидроксизин': ['h1_blocker'],
    'хлоропирамин': ['h1_blocker'],
    'тербинафин': ['cyp2d6_inhibitor'],
    'хинидин': ['cyp2d6_inhibitor'],
    'гидроксихлорохин': ['cyp2d6_inhibitor'],
    'бупропион': ['cyp2d6_inhibitor'],
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: `data/drugs/aviandr.js`**

```js
(function (g) {
  const SRC = 'Инструкция по медицинскому применению «Авиандр», ЛП-№(002445)-(РГ-RU) от 31.05.2023';
  g.KK.data.drugs.aviandr = {
    id: 'aviandr',
    name: 'Авиандр',
    inn: 'маритупирдин',
    form: 'таблетки, покрытые плёночной оболочкой, 20 мг',
    regNumber: 'ЛП-№(002445)-(РГ-RU)',
    rx: true,
    additionalMonitoring: true,
    dosing: { dose: '20 мг', timesPerDay: 2, daily: '40 мг', duration: 'определяется врачом', schedule: ['утро', 'вечер'] },
    indications: [
      { codes: ['F41.1'], text: 'Генерализованное тревожное расстройство' },
      { codes: ['F43.0', 'F43.2'], requires: 'postCovid',
        text: 'Тревожные состояния после перенесённой COVID-19 у пациентов со стрессовой реакцией и нарушением адаптации лёгкой и средней степени' },
    ],
    // check(p) → true (есть), false (нет), null (нет данных)
    contraindications: [
      { id: 'hypersensitivity', label: 'Гиперчувствительность к маритупирдину',
        check: (p) => (p.allergies || []).some((a) => /маритупирдин|авиандр/i.test(a)) },
      { id: 'cns', label: 'Эпилепсия, органические заболевания головного мозга',
        check: (p) => (p.conditions || []).some((c) => c === 'epilepsy' || c === 'organic_brain') },
      { id: 'maoi', label: 'Приём ингибиторов МАО или менее 2 недель после их отмены',
        check: (p, has) => has('maoi') || (p.maoiStoppedDaysAgo != null && p.maoiStoppedDaysAgo < 14) },
      { id: 'renal', label: 'Почечная недостаточность средней и тяжёлой степени (СКФ < 60 мл/мин)',
        check: (p) => (p.labs?.egfr == null ? null : p.labs.egfr < 60) },
      { id: 'hepatic', label: 'Печёночная недостаточность (Child-Pugh A, B, C)',
        check: (p) => (p.labs?.childPugh == null ? null : ['A', 'B', 'C'].includes(p.labs.childPugh)) },
      { id: 'age', label: 'Возраст до 18 лет',
        check: (p) => (p.age == null ? null : p.age < 18) },
      { id: 'pregnancy', label: 'Беременность и период грудного вскармливания',
        check: (p) => (p.sex === 'm' ? false : p.pregnant == null || p.lactating == null ? null : p.pregnant || p.lactating) },
    ],
    cautions: [
      { id: 'cvd', label: 'Сердечно-сосудистые заболевания — с осторожностью', check: (p) => (p.conditions || []).includes('cvd') },
      { id: 'elderly', label: 'Пожилой возраст — выше чувствительность к нежелательным реакциям', check: (p) => p.age >= 65 },
    ],
    interactions: [
      { id: 'serotonin', classes: ['serotonergic'], level: 'warning',
        text: 'Серотонинергические препараты (СИОЗС, триптаны, трамадол, литий, фентанил, зверобой): риск серотонинового синдрома, применять с осторожностью' },
      { id: 'cyp2d6', classes: ['cyp2d6_inhibitor'], level: 'warning',
        text: 'Ингибиторы CYP2D6 могут повышать концентрацию маритупирдина, применять с осторожностью' },
      { id: 'sedation', classes: ['benzodiazepine', 'antipsychotic', 'barbiturate', 'h1_blocker'], level: 'warning',
        text: 'Усиление седативного действия (бензодиазепины, нейролептики, барбитураты, H1-блокаторы)' },
    ],
    adverseEvents: [
      { id: 'headache', label: 'Головная боль', freq: 'часто' },
      { id: 'dizziness', label: 'Головокружение', freq: 'часто' },
      { id: 'somnolence', label: 'Сонливость', freq: 'часто' },
      { id: 'paresthesia', label: 'Покалывание, онемение (парестезии)', freq: 'часто' },
      { id: 'asthenia', label: 'Слабость, быстрая утомляемость', freq: 'часто' },
      { id: 'appetite', label: 'Снижение аппетита', freq: 'нечасто' },
      { id: 'insomnia', label: 'Бессонница', freq: 'нечасто' },
      { id: 'anxiety_up', label: 'Усиление тревоги', freq: 'нечасто' },
      { id: 'nausea', label: 'Тошнота', freq: 'нечасто' },
      { id: 'constipation', label: 'Запор', freq: 'нечасто' },
      { id: 'sweating', label: 'Повышенная потливость', freq: 'нечасто' },
      { id: 'stiffness', label: 'Скованность в мышцах', freq: 'нечасто' },
      { id: 'backpain', label: 'Боль в спине', freq: 'нечасто' },
    ],
    patientNotes: [
      'Принимайте по 1 таблетке 2 раза в день, как назначил врач.',
      'Во время лечения откажитесь от алкоголя.',
      'Если появились сонливость или головокружение, не садитесь за руль.',
      'Не меняйте дозу и не прекращайте приём самостоятельно — обсудите это с врачом.',
    ],
    source: SRC,
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 5: `assets/therapy.js`**

```js
(function (g) {
  const KK = g.KK;
  function classesOf(name) {
    const n = String(name || '').toLowerCase();
    const out = new Set();
    for (const [key, classes] of Object.entries(KK.data.drugClasses)) {
      if (n.includes(key)) classes.forEach((c) => out.add(c));
    }
    return [...out];
  }
  function patientClasses(p) {
    const s = new Set();
    (p.meds || []).forEach((m) => (m.classes || classesOf(m.name)).forEach((c) => s.add(c)));
    return s;
  }
  function isIndicated(drug, p) {
    const codes = (p.diagnoses || []).map((d) => d.code);
    return drug.indications.some((ind) =>
      ind.codes.some((c) => codes.some((pc) => pc.startsWith(c))) && (!ind.requires || p[ind.requires] === true));
  }
  function check(drug, p) {
    const cls = patientClasses(p);
    const has = (c) => cls.has(c);
    const contraindications = drug.contraindications.map((c) => {
      const v = c.check(p, has);
      return { id: c.id, label: c.label, status: v === true ? 'present' : v === false ? 'absent' : 'unknown' };
    });
    const cautions = drug.cautions.filter((c) => c.check(p, has)).map(({ id, label }) => ({ id, label }));
    const interactions = drug.interactions
      .filter((i) => i.classes.some(has))
      .map((i) => ({
        id: i.id, level: i.level, text: i.text,
        drugs: (p.meds || []).filter((m) => (m.classes || classesOf(m.name)).some((c) => i.classes.includes(c))).map((m) => m.name),
      }));
    const present = contraindications.some((c) => c.status === 'present');
    const unknown = contraindications.some((c) => c.status === 'unknown');
    return {
      drugId: drug.id,
      indicated: isIndicated(drug, p),
      eligible: present ? false : unknown ? null : true,
      contraindications, cautions, interactions,
      source: drug.source,
    };
  }
  KK.therapy = { check, classesOf };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 6: Тесты зелёные**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add data/drugs assets/therapy.js tests/therapy.test.js
git commit -m "feat(core): Aviandr label data and therapy contraindication/interaction checks"
```

---

### Task 4: Приверженность

**Files:**
- Create: `assets/adherence.js`
- Test: `tests/adherence.test.js`

Модель: план с `confirmedAt` и `timesPerDay`; журнал доз — события `{type:'dose', at, payload:{slot:'утро'|'вечер', taken:true}}`. PDC за окно = принятые / ожидаемые дозы (окно не раньше `confirmedAt`). `missedStreak` — число последних полных дней подряд без единой принятой дозы (сегодняшний день не считается — он не закончился).

- [ ] **Step 1: Падающие тесты**

`tests/adherence.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const { adherence, util } = globalThis.KK;
const NOW = '2026-10-19T12:00:00.000Z';
const dose = (daysAgo, slot = 'утро') => ({ type: 'dose', at: util.shiftDays(NOW, -daysAgo), payload: { slot, taken: true } });
const plan = (daysAgo) => ({ drugId: 'aviandr', status: 'confirmed', confirmedAt: util.shiftDays(NOW, -daysAgo), timesPerDay: 2 });

test('full adherence over 7 days', () => {
  const doses = [];
  for (let d = 1; d <= 7; d++) doses.push(dose(d, 'утро'), dose(d, 'вечер'));
  assert.equal(adherence.pdc(doses, plan(30), NOW, 7), 1);
});

test('half adherence', () => {
  const doses = [];
  for (let d = 1; d <= 7; d++) doses.push(dose(d, 'утро'));
  assert.equal(adherence.pdc(doses, plan(30), NOW, 7), 0.5);
});

test('window clipped to confirmedAt', () => {
  const doses = [dose(1, 'утро'), dose(1, 'вечер'), dose(2, 'утро'), dose(2, 'вечер')];
  assert.equal(adherence.pdc(doses, plan(2), NOW, 14), 1);
});

test('no confirmed plan → null', () => {
  assert.equal(adherence.pdc([], { status: 'proposed' }, NOW, 7), null);
});

test('missed streak counts full days without doses', () => {
  const doses = [dose(5), dose(4)];
  assert.equal(adherence.missedStreak(doses, plan(30), NOW), 3);
  assert.equal(adherence.missedStreak([dose(1)], plan(30), NOW), 0);
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test`
Expected: FAIL — `KK.adherence` undefined.

- [ ] **Step 3: `assets/adherence.js`**

```js
(function (g) {
  const KK = g.KK;
  const { DAY, dayKey } = KK.util;
  function confirmed(plan) { return plan && plan.status === 'confirmed' && plan.confirmedAt; }
  function pdc(doses, plan, nowIso, windowDays) {
    if (!confirmed(plan)) return null;
    const now = new Date(nowIso).getTime();
    const todayStart = new Date(dayKey(nowIso) + 'T00:00:00').getTime();
    const from = Math.max(todayStart - windowDays * DAY, new Date(dayKey(plan.confirmedAt) + 'T00:00:00').getTime());
    const days = Math.max(1, Math.round((todayStart - from) / DAY));
    const expected = days * (plan.timesPerDay || 1);
    const taken = doses.filter((d) => {
      const t = new Date(d.at).getTime();
      return d.type === 'dose' && d.payload?.taken && t >= from && t < todayStart && t <= now;
    }).length;
    return Math.min(1, Math.round((taken / expected) * 100) / 100);
  }
  function missedStreak(doses, plan, nowIso) {
    if (!confirmed(plan)) return 0;
    const takenDays = new Set(doses.filter((d) => d.type === 'dose' && d.payload?.taken).map((d) => dayKey(d.at)));
    const startKey = dayKey(plan.confirmedAt);
    let streak = 0;
    for (let i = 1; i < 60; i++) {
      const key = dayKey(new Date(new Date(nowIso).getTime() - i * DAY).toISOString());
      if (key < startKey || takenDays.has(key)) break;
      streak++;
    }
    return streak;
  }
  KK.adherence = { pdc, missedStreak };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/adherence.js tests/adherence.test.js
git commit -m "feat(core): adherence PDC and missed-dose streak"
```

---

### Task 5: Правила алертинга и маршрутизации

**Files:**
- Create: `data/rules/core.js`, `assets/rules.js`
- Test: `tests/rules.test.js`

Контекст правила `ctx`: `{ patient, now, scales: {phq9:[...], gad7:[...], cssrs:[...]} (результаты по возрастанию даты), latest(id), previous(id), events, therapy (результат KK.therapy.check или null), pdc14, missedStreak, daysOnTherapy }`.
Результат правила: `{ ruleId, level: 'critical'|'important'|'info', routing: 'required'|'desirable'|null, title, text, source, teamRule: boolean }`.
Источники: КР «Генерализованное тревожное расстройство» (РОП, 2024, ID 457); КР «Депрессивный эпизод, рекуррентное депрессивное расстройство» (РОП, 2024, ID 301); руководства к шкалам. Где порог выбран командой — `teamRule: true` (кейс: «перечень признаков определяет команда»).

- [ ] **Step 1: Падающие тесты**

`tests/rules.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const NOW = '2026-10-19T12:00:00.000Z';
const at = (d) => KK.util.shiftDays(NOW, -d);
const scale = (id, answers, d) => ({ type: 'scale', at: at(d), payload: KK.scales.score(id, answers) });
const patient = (over = {}) => Object.assign({
  id: 'p1', age: 40, sex: 'f', pregnant: false, lactating: false,
  diagnoses: [{ code: 'F41.1', text: 'ГТР' }], meds: [], allergies: [], conditions: [],
  labs: { egfr: 95, childPugh: 'none' }, history: {},
  plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: at(30), timesPerDay: 2 },
}, over);
const dosesFor = (days) => {
  const out = [];
  for (let d = 1; d <= days; d++) out.push({ type: 'dose', at: at(d), payload: { slot: 'утро', taken: true } }, { type: 'dose', at: at(d), payload: { slot: 'вечер', taken: true } });
  return out;
};
const run = (p, events) => KK.rules.evaluate(KK.rules.buildContext(p, events, NOW));
const ids = (sig) => sig.map((s) => s.ruleId).sort();

test('every rule declares id, level, source and functions', () => {
  for (const r of KK.data.rules) {
    assert.ok(r.id && r.level && r.source && typeof r.when === 'function' && typeof r.text === 'function', r.id);
  }
});

test('stable patient → no signals', () => {
  const ev = [...dosesFor(14), scale('phq9', [1, 1, 0, 1, 0, 0, 1, 0, 0], 2), scale('gad7', [1, 1, 1, 0, 0, 1, 0], 2)];
  assert.deepEqual(run(patient(), ev), []);
});

test('PHQ-9 item 9 > 0 → critical + required', () => {
  const ev = [...dosesFor(14), scale('phq9', [3, 3, 2, 2, 2, 3, 2, 2, 2], 0)];
  const sig = run(patient(), ev);
  const si = sig.find((s) => s.ruleId === 'si_phq9');
  assert.equal(si.level, 'critical');
  assert.equal(si.routing, 'required');
  assert.ok(sig.find((s) => s.ruleId === 'phq9_severe'));
  assert.equal(KK.rules.routing(sig), 'required');
});

test('sorted: critical first', () => {
  const ev = [...dosesFor(14), scale('phq9', [3, 3, 2, 2, 2, 3, 2, 2, 2], 0)];
  assert.equal(run(patient(), ev)[0].level, 'critical');
});

test('PHQ-9 15–19 → info + desirable', () => {
  const ev = [...dosesFor(14), scale('phq9', [2, 2, 2, 2, 2, 2, 2, 2, 0], 0)];
  const sig = run(patient(), ev);
  assert.deepEqual(ids(sig), ['phq9_modsevere']);
  assert.equal(KK.rules.routing(sig), 'desirable');
});

test('worsening ≥5 between two last GAD-7', () => {
  const ev = [...dosesFor(14), scale('gad7', [1, 1, 1, 0, 0, 1, 0], 14), scale('gad7', [2, 2, 2, 1, 1, 1, 1], 0)];
  assert.ok(run(patient(), ev).some((s) => s.ruleId === 'worsening'));
});

test('3 full days without doses → important', () => {
  const ev = [{ type: 'dose', at: at(5), payload: { slot: 'утро', taken: true } }];
  const s = run(patient(), ev).find((x) => x.ruleId === 'missed_doses');
  assert.equal(s.level, 'important');
});

test('SOS within 24h → critical', () => {
  const ev = [...dosesFor(14), { type: 'sos', at: at(0), payload: {} }];
  assert.equal(run(patient(), ev).find((s) => s.ruleId === 'sos').level, 'critical');
});

test('severe adverse event → critical', () => {
  const ev = [...dosesFor(14), { type: 'ae', at: at(0), payload: { items: [{ id: 'dizziness', severity: 'severe' }] } }];
  assert.ok(run(patient(), ev).some((s) => s.ruleId === 'ae_severe'));
});

test('contraindication present → important', () => {
  const sig = run(patient({ labs: { egfr: 52, childPugh: 'none' } }), dosesFor(14));
  assert.equal(sig.find((s) => s.ruleId === 'contraindication').level, 'important');
});

test('interaction → info with drug names', () => {
  const sig = run(patient({ meds: [{ name: 'Сертралин 50 мг' }] }), dosesFor(14));
  const s = sig.find((x) => x.ruleId === 'interaction');
  assert.equal(s.level, 'info');
  assert.match(s.text, /Сертралин/);
});

test('psychotic/bipolar history → required', () => {
  const sig = run(patient({ history: { bipolar: true } }), dosesFor(14));
  assert.equal(sig.find((s) => s.ruleId === 'psychiatric_history').routing, 'required');
});

test('C-SSRS moderate/high → critical required', () => {
  const ev = [...dosesFor(14), scale('cssrs', [1, 1, 1, 0, 0, 0], 0)];
  assert.equal(run(patient(), ev).find((s) => s.ruleId === 'cssrs_risk').routing, 'required');
});

test('no response after 8 weeks → required', () => {
  const p = patient({ plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: at(60), timesPerDay: 2 } });
  const ev = [...dosesFor(14), scale('gad7', [2, 2, 2, 2, 2, 2, 2], 58), scale('gad7', [2, 2, 2, 2, 2, 1, 2], 0)];
  assert.equal(run(p, ev).find((s) => s.ruleId === 'no_response').routing, 'required');
});

test('routing aggregate: none → null', () => {
  assert.equal(KK.rules.routing([]), null);
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test`
Expected: FAIL — `KK.data.rules` is not iterable.

- [ ] **Step 3: `data/rules/core.js`**

```js
(function (g) {
  const KR_GAD = 'КР «Генерализованное тревожное расстройство», РОП, 2024 (ID 457)';
  const KR_DEP = 'КР «Депрессивный эпизод, рекуррентное депрессивное расстройство», РОП, 2024 (ID 301)';
  const PHQ = 'Kroenke et al., 2001 (PHQ-9)';
  const GAD7 = 'Spitzer et al., 2006 (GAD-7)';
  const LABEL = 'Инструкция «Авиандр», ЛП-№(002445)-(РГ-RU)';
  const within = (ctx, iso, hours) => new Date(ctx.now) - new Date(iso) <= hours * 3600000;

  g.KK.data.rules = [
    { id: 'si_phq9', level: 'critical', routing: 'required', teamRule: false, source: `${KR_DEP}; ${PHQ}`,
      title: 'Суицидальные мысли (PHQ-9, вопрос 9)',
      when: (c) => (c.latest('phq9')?.flags.item9 ?? 0) > 0,
      text: (c) => `Ответ на вопрос 9 — ${c.latest('phq9').flags.item9} из 3. Требуется оценка суицидального риска (C-SSRS) и консультация психиатра.` },
    { id: 'cssrs_risk', level: 'critical', routing: 'required', teamRule: false, source: 'Posner et al., 2011 (C-SSRS)',
      title: 'Суицидальный риск по C-SSRS',
      when: (c) => ['moderate', 'high'].includes(c.latest('cssrs')?.band.code),
      text: (c) => `${c.latest('cssrs').band.doctorLabel}. Экстренная консультация психиатра.` },
    { id: 'sos', level: 'critical', routing: null, teamRule: true, source: 'Правило команды',
      title: 'Пациент нажал «Мне сейчас очень плохо»',
      when: (c) => c.events.some((e) => e.type === 'sos' && within(c, e.at, 24)),
      text: () => 'Пациенту показаны контакты экстренной помощи. Свяжитесь с пациентом.' },
    { id: 'ae_severe', level: 'critical', routing: null, teamRule: true, source: `${LABEL}; правило команды`,
      title: 'Выраженное нежелательное явление',
      when: (c) => c.events.some((e) => e.type === 'ae' && within(c, e.at, 72) && e.payload.items.some((i) => i.severity === 'severe')),
      text: (c) => {
        const e = [...c.events].reverse().find((x) => x.type === 'ae' && x.payload.items.some((i) => i.severity === 'severe'));
        const names = e.payload.items.filter((i) => i.severity === 'severe').map((i) => i.label || i.id).join(', ');
        return `Пациент отметил «сильно»: ${names}. Препарат под дополнительным мониторингом — оцените и при необходимости оформите извещение о НР.`;
      } },
    { id: 'phq9_severe', level: 'important', routing: 'required', teamRule: true, source: `${KR_DEP}; ${PHQ}`,
      title: 'Тяжёлая депрессивная симптоматика',
      when: (c) => (c.latest('phq9')?.total ?? 0) >= 20,
      text: (c) => `PHQ-9 = ${c.latest('phq9').total} (≥ 20).` },
    { id: 'psychiatric_history', level: 'important', routing: 'required', teamRule: true, source: KR_DEP,
      title: 'Психотические симптомы или подозрение на биполярное расстройство',
      when: (c) => !!(c.patient.history?.psychotic || c.patient.history?.bipolar),
      text: (c) => (c.patient.history?.bipolar ? 'В анамнезе признаки биполярного расстройства.' : 'В анамнезе психотические симптомы.') },
    { id: 'no_response', level: 'important', routing: 'required', teamRule: true, source: KR_GAD,
      title: 'Нет ответа на терапию',
      when: (c) => {
        const first = c.firstAfterStart('gad7'); const last = c.latest('gad7');
        return c.daysOnTherapy >= 56 && first && last && first !== last && last.total > first.total * 0.75;
      },
      text: (c) => `GAD-7: ${c.firstAfterStart('gad7').total} → ${c.latest('gad7').total} за ${c.daysOnTherapy} дн. терапии (снижение < 25%).` },
    { id: 'worsening', level: 'important', routing: null, teamRule: true, source: `${PHQ}; ${GAD7}`,
      title: 'Ухудшение по шкалам',
      when: (c) => ['phq9', 'gad7'].some((id) => c.latest(id) && c.previous(id) && c.latest(id).total - c.previous(id).total >= 5),
      text: (c) => ['phq9', 'gad7'].filter((id) => c.latest(id) && c.previous(id) && c.latest(id).total - c.previous(id).total >= 5)
        .map((id) => `${id === 'phq9' ? 'PHQ-9' : 'GAD-7'}: ${c.previous(id).total} → ${c.latest(id).total}`).join('; ') },
    { id: 'missed_doses', level: 'important', routing: null, teamRule: true, source: 'Правило команды',
      title: 'Пропуск приёма препарата',
      when: (c) => c.missedStreak >= 3,
      text: (c) => `Нет отметок о приёме ${c.missedStreak} дн. подряд.` },
    { id: 'contraindication', level: 'important', routing: null, teamRule: false, source: LABEL,
      title: 'Противопоказание к назначенному препарату',
      when: (c) => c.therapy?.eligible === false,
      text: (c) => c.therapy.contraindications.filter((x) => x.status === 'present').map((x) => x.label).join('; ') },
    { id: 'phq9_modsevere', level: 'info', routing: 'desirable', teamRule: true, source: `${KR_DEP}; ${PHQ}`,
      title: 'Умеренно тяжёлая депрессивная симптоматика',
      when: (c) => { const t = c.latest('phq9')?.total ?? 0; return t >= 15 && t <= 19; },
      text: (c) => `PHQ-9 = ${c.latest('phq9').total} (15–19).` },
    { id: 'comorbid', level: 'info', routing: 'desirable', teamRule: true, source: `${KR_GAD}; ${KR_DEP}`,
      title: 'Сочетание тревожной и депрессивной симптоматики',
      when: (c) => (c.latest('phq9')?.total ?? 0) >= 10 && (c.latest('gad7')?.total ?? 0) >= 10,
      text: (c) => `PHQ-9 = ${c.latest('phq9').total}, GAD-7 = ${c.latest('gad7').total}.` },
    { id: 'recurrent', level: 'info', routing: 'desirable', teamRule: true, source: KR_DEP,
      title: 'Рекуррентное депрессивное расстройство',
      when: (c) => (c.patient.diagnoses || []).some((d) => d.code.startsWith('F33')),
      text: () => 'Повторные депрессивные эпизоды в анамнезе.' },
    { id: 'interaction', level: 'info', routing: null, teamRule: false, source: LABEL,
      title: 'Лекарственное взаимодействие',
      when: (c) => (c.therapy?.interactions.length ?? 0) > 0,
      text: (c) => c.therapy.interactions.map((i) => `${i.drugs.join(', ')} — ${i.text}`).join('; ') },
    { id: 'unknown_data', level: 'info', routing: null, teamRule: true, source: LABEL,
      title: 'Недостаточно данных для проверки противопоказаний',
      when: (c) => c.therapy?.eligible === null,
      text: (c) => `Нет данных: ${c.therapy.contraindications.filter((x) => x.status === 'unknown').map((x) => x.label).join('; ')}.` },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: `assets/rules.js`**

```js
(function (g) {
  const KK = g.KK;
  const ORDER = { critical: 0, important: 1, info: 2 };
  function buildContext(patient, events, nowIso) {
    const sorted = [...events].sort(KK.util.byDateAsc);
    const scales = { phq9: [], gad7: [], cssrs: [] };
    sorted.filter((e) => e.type === 'scale').forEach((e) => {
      (scales[e.payload.scaleId] = scales[e.payload.scaleId] || []).push(Object.assign({ at: e.at }, e.payload));
    });
    const plan = patient.plan || null;
    const drug = plan && KK.data.drugs[plan.drugId];
    const startIso = plan?.status === 'confirmed' ? plan.confirmedAt : null;
    return {
      patient, now: nowIso, events: sorted, scales,
      latest: (id) => scales[id]?.at(-1) || null,
      previous: (id) => scales[id]?.at(-2) || null,
      firstAfterStart: (id) => (scales[id] || []).find((r) => !startIso || new Date(r.at) >= new Date(KK.util.shiftDays(startIso, -3))) || null,
      therapy: drug ? KK.therapy.check(drug, patient) : null,
      pdc14: KK.adherence.pdc(sorted, plan, nowIso, 14),
      missedStreak: KK.adherence.missedStreak(sorted, plan, nowIso),
      daysOnTherapy: startIso ? KK.util.daysBetween(startIso, nowIso) : 0,
    };
  }
  function evaluate(ctx, rules = KK.data.rules) {
    const out = [];
    for (const r of rules) {
      let hit = false;
      try { hit = !!r.when(ctx); } catch (e) { hit = false; }
      if (hit) out.push({ ruleId: r.id, level: r.level, routing: r.routing, title: r.title, text: r.text(ctx), source: r.source, teamRule: r.teamRule });
    }
    return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  }
  function routing(signals) {
    if (signals.some((s) => s.routing === 'required')) return 'required';
    if (signals.some((s) => s.routing === 'desirable')) return 'desirable';
    return null;
  }
  KK.rules = { buildContext, evaluate, routing };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 5: Тесты зелёные**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add data/rules assets/rules.js tests/rules.test.js
git commit -m "feat(core): declarative alerting and psychiatrist-routing rules"
```

---

### Task 6: Парсер истории болезни

**Files:**
- Create: `assets/parser.js`
- Test: `tests/parser.test.js`

- [ ] **Step 1: Падающие тесты** (разные шаблоны записи — метрика кейса «обработка входных данных»)

`tests/parser.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const { parser } = globalThis.KK;

const T1 = `Пациентка К., 34 года. Диагноз: F41.1 Генерализованное тревожное расстройство.
Сопутствующие: ХБП С3а, СКФ (CKD-EPI) 52 мл/мин/1,73м2. Принимает: сертралин 50 мг утром, феназепам по требованию.
Эпилепсию отрицает. Беременность отрицает.`;

const T2 = `ЖАЛОБЫ: тревога, нарушение сна.
DS осн.: Расстройство адаптации (F43.2) после перенесённой COVID-19 (U09.9).
Терапия — Трамадол 50 мг при болях; лоразепам.
Лаб.: рСКФ — 88; цирроз печени, класс Child-Pugh B.
Возраст: 58 лет. Пол: муж.`;

const T3 = `Мужчина 17 лет, эпилепсия в анамнезе, получает вальпроевую кислоту.`;

test('T1: diagnoses, meds, eGFR, negations', () => {
  const r = parser.extract(T1);
  assert.deepEqual(r.diagnoses.map((d) => d.code), ['F41.1']);
  assert.deepEqual(r.meds.map((m) => m.name).sort(), ['Сертралин', 'Феназепам']);
  assert.equal(r.labs.egfr, 52);
  assert.equal(r.pregnant, false);
  assert.ok(!r.conditions.includes('epilepsy'));
  assert.equal(r.age, 34);
  assert.equal(r.sex, 'f');
});

test('T2: post-COVID flag, Child-Pugh, alt eGFR spelling, sex', () => {
  const r = parser.extract(T2);
  assert.deepEqual(r.diagnoses.map((d) => d.code), ['F43.2', 'U09.9']);
  assert.equal(r.postCovid, true);
  assert.equal(r.labs.egfr, 88);
  assert.equal(r.labs.childPugh, 'B');
  assert.equal(r.sex, 'm');
  assert.equal(r.age, 58);
  assert.deepEqual(r.meds.map((m) => m.name).sort(), ['Лоразепам', 'Трамадол']);
});

test('T3: epilepsy and minor', () => {
  const r = parser.extract(T3);
  assert.ok(r.conditions.includes('epilepsy'));
  assert.equal(r.age, 17);
  assert.equal(r.sex, 'm');
});

test('empty text → empty structure, no throw', () => {
  const r = parser.extract('');
  assert.deepEqual(r.diagnoses, []);
  assert.equal(r.labs.egfr, undefined);
});

test('spans returned for highlighting', () => {
  const r = parser.extract(T1);
  assert.ok(r.spans.length >= 4);
  for (const s of r.spans) assert.equal(T1.slice(s.start, s.end).length, s.end - s.start);
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test`
Expected: FAIL — `KK.parser` undefined.

- [ ] **Step 3: `assets/parser.js`**

Важно: в JS-регулярках без флага `u` метасимволы `\b` и `\w` не считают кириллицу «словом». Поэтому для русских слов используются явные классы `[а-яё]` и конструкции `(?:^|[^а-яё])` / `(?![а-яё])`. С флагом `i` класс `[а-яё]` ловит и заглавные.

```js
(function (g) {
  const KK = g.KK;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function negated(text, idx) {
    const before = text.slice(Math.max(0, idx - 25), idx);
    const after = text.slice(idx, idx + 40);
    return /(?:^|[^а-яё])(не|нет|без)\s*$/i.test(before) || /^\S*\s+(отрицает|исключен|не выявлен)/i.test(after);
  }
  function extract(text) {
    const src = String(text || '');
    const spans = [];
    const mark = (start, end, kind) => spans.push({ start, end, kind });
    const out = { diagnoses: [], meds: [], labs: {}, conditions: [], spans };

    const dx = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
    let m;
    while ((m = dx.exec(src))) {
      if (!out.diagnoses.some((d) => d.code === m[1])) {
        const tail = src.slice(m.index + m[1].length, m.index + m[1].length + 80).split(/[.\n;(]/)[0].trim();
        out.diagnoses.push({ code: m[1], text: tail });
      }
      mark(m.index, m.index + m[1].length, 'diagnosis');
    }

    const lower = src.toLowerCase();
    for (const key of Object.keys(KK.data.drugClasses)) {
      const i = lower.indexOf(key);
      if (i >= 0 && !out.meds.some((x) => x.name.toLowerCase() === key)) {
        out.meds.push({ name: cap(key), classes: KK.data.drugClasses[key] });
        mark(i, i + key.length, 'med');
      }
    }

    const egfr = /(?:р?скф|egfr|gfr)[^\d\n]{0,25}(\d{2,3})/i.exec(src);
    if (egfr) { out.labs.egfr = Number(egfr[1]); mark(egfr.index, egfr.index + egfr[0].length, 'lab'); }

    const cp = /(?:child[-\s]?pugh|чайлд[-\s]?пью)[^ABCАВС\n]{0,15}([ABCАВС])\b/i.exec(src);
    if (cp) {
      out.labs.childPugh = { 'А': 'A', 'В': 'B', 'С': 'C' }[cp[1].toUpperCase()] || cp[1].toUpperCase();
      mark(cp.index, cp.index + cp[0].length, 'lab');
    }

    const preg = /беременн[а-яё]*/i.exec(src);
    if (preg) { out.pregnant = !negated(src, preg.index) && !/беременност[а-яё]*\s+отрицает/i.test(src); mark(preg.index, preg.index + preg[0].length, 'condition'); }
    const lact = /лактаци[а-яё]*|грудн[а-яё]+\s+вскармливани[а-яё]*/i.exec(src);
    if (lact) out.lactating = !negated(src, lact.index);

    const epi = /эпилепси[а-яё]*/i.exec(src);
    if (epi) {
      mark(epi.index, epi.index + epi[0].length, 'condition');
      if (!negated(src, epi.index)) out.conditions.push('epilepsy');
    }
    if (/органическ[а-яё]+\s+(поражени|заболевани|расстройств)[а-яё]*/i.test(src)) out.conditions.push('organic_brain');
    if (/(?:^|[^а-яё])(ибс|гипертони[а-яё]*|аг|инфаркт[а-яё]*|хсн|аритми[а-яё]*)(?![а-яё])/i.test(src)) out.conditions.push('cvd');

    const age = /(\d{1,2})\s*(?:лет|года|год)(?![а-яё])/i.exec(src) || /возраст\D{0,5}(\d{1,2})/i.exec(src);
    if (age) out.age = Number(age[1]);

    if (/(пациентка|женщина|пол:\s*жен)/i.test(src)) out.sex = 'f';
    else if (/(пациент(?![а-яё])|мужчина|пол:\s*муж)/i.test(src)) out.sex = 'm';

    out.postCovid = /covid|ковид|u09\.9|u07\.1/i.test(src);
    if (/психотическ|галлюцинац|бредов|(?:^|[^а-яё])бред(?![а-яё])/i.test(src)) out.history = Object.assign(out.history || {}, { psychotic: true });
    if (/биполярн|f31/i.test(src)) out.history = Object.assign(out.history || {}, { bipolar: true });

    spans.sort((a, b) => a.start - b.start);
    return out;
  }
  KK.parser = { extract };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4a: Регрессионный тест на кириллические границы слов**

Добавить в `tests/parser.test.js`:
```js
test('Cyrillic word boundaries: hypertension, breastfeeding, "пациент" vs "пациентка"', () => {
  const r = parser.extract('Пациент 45 лет. Гипертоническая болезнь II ст.');
  assert.ok(r.conditions.includes('cvd'));
  assert.equal(r.sex, 'm');
  assert.equal(r.age, 45);
  assert.equal(parser.extract('Пациентка на грудном вскармливании').lactating, true);
});
```
Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/parser.js tests/parser.test.js
git commit -m "feat(core): rule-based case-history parser with highlight spans"
```

---

### Task 7: Клинические сценарии

**Files:**
- Create: `data/scenarios.js`
- Test: `tests/scenarios.test.js`

Каждый сценарий: `{ id, title, summary, patient, seed: [{ type, day (смещение от сегодня, ≤0), payload }] }`. Для шкал в seed передаются `answers`; хранилище при сбросе превращает их в результат `KK.scales.score`. Дозы — генератор `doses: { fromDay, toDay, skip: [дни] }`.

- [ ] **Step 1: Падающие тесты** — проверяют, что каждый сценарий даёт ровно ожидаемые сигналы

`tests/scenarios.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const NOW = '2026-10-19T12:00:00.000Z';

function eventsOf(s) { return KK.data.expandSeed(s.seed, NOW); }
function signals(s) { return KK.rules.evaluate(KK.rules.buildContext(s.patient, eventsOf(s), NOW)); }
const S = (id) => KK.data.scenarios.find((x) => x.id === id);

test('five scenarios with unique ids', () => {
  assert.equal(KK.data.scenarios.length, 5);
  assert.equal(new Set(KK.data.scenarios.map((s) => s.id)).size, 5);
});

test('S1 GAD at GP: eligible, no signals', () => {
  assert.equal(KK.therapy.check(KK.data.drugs.aviandr, S('s1').patient).eligible, true);
  assert.deepEqual(signals(S('s1')).map((x) => x.ruleId), []);
});

test('S2 on sertraline: interaction info only', () => {
  assert.deepEqual(signals(S('s2')).map((x) => x.ruleId), ['interaction']);
});

test('S3 eGFR 52: contraindication', () => {
  const ids = signals(S('s3')).map((x) => x.ruleId);
  assert.ok(ids.includes('contraindication'));
  assert.equal(KK.rules.routing(signals(S('s3'))), null);
});

test('S4 PHQ-9 21 item9>0: critical + required', () => {
  const sig = signals(S('s4'));
  assert.equal(sig[0].ruleId, 'si_phq9');
  assert.equal(KK.rules.routing(sig), 'required');
});

test('S5 post-COVID: indicated, improving, no signals', () => {
  const s = S('s5');
  assert.equal(KK.therapy.check(KK.data.drugs.aviandr, s.patient).indicated, true);
  assert.deepEqual(signals(s).map((x) => x.ruleId), []);
  const gad = eventsOf(s).filter((e) => e.type === 'scale' && e.payload.scaleId === 'gad7').map((e) => e.payload.total);
  assert.ok(gad[0] > gad.at(-1));
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test`
Expected: FAIL — `KK.data.expandSeed is not a function`.

- [ ] **Step 3: `data/scenarios.js`**

```js
(function (g) {
  const KK = g.KK;
  const base = (over) => Object.assign({
    pregnant: false, lactating: false, allergies: [], conditions: [], meds: [], history: {},
    labs: { egfr: 92, childPugh: 'none' },
  }, over);
  const checkins = (fromDay, toDay, f) => {
    const out = [];
    for (let d = fromDay; d <= toDay; d++) out.push({ type: 'checkin', day: d, payload: f(d) });
    return out;
  };

  KK.data.scenarios = [
    {
      id: 's1', title: 'ГТР у терапевта', summary: 'Первичное назначение, противопоказаний нет',
      patient: base({ id: 'p_anna', name: 'Анна Соколова', initials: 'АС', age: 34, sex: 'f',
        phone: '+7 900 000-00-01', inviteCode: 'KMP-4821',
        diagnoses: [{ code: 'F41.1', text: 'Генерализованное тревожное расстройство' }],
        plan: { drugId: 'aviandr', status: 'proposed', timesPerDay: 2 } }),
      seed: [
        { type: 'scale', day: -1, payload: { scaleId: 'gad7', answers: [2, 2, 3, 2, 1, 2, 2] } },
        { type: 'scale', day: -1, payload: { scaleId: 'phq9', answers: [1, 1, 1, 1, 0, 1, 1, 0, 0] } },
        ...checkins(-6, -1, (d) => ({ mood: 3, anxiety: 2, sleep: 2 })),
      ],
    },
    {
      id: 's2', title: 'Пациент на СИОЗС', summary: 'Сертралин: риск серотонинового синдрома, CYP2D6',
      patient: base({ id: 'p_sergey', name: 'Сергей Морозов', initials: 'СМ', age: 46, sex: 'm', inviteCode: 'KMP-1937',
        diagnoses: [{ code: 'F41.1', text: 'Генерализованное тревожное расстройство' }],
        meds: [{ name: 'Сертралин 50 мг', classes: ['ssri', 'serotonergic', 'cyp2d6_inhibitor'] }],
        plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: null, confirmedDay: -20, timesPerDay: 2 } }),
      seed: [
        { type: 'doses', fromDay: -20, toDay: -1, skip: [] },
        { type: 'scale', day: -20, payload: { scaleId: 'gad7', answers: [2, 2, 2, 2, 1, 1, 2] } },
        { type: 'scale', day: -2, payload: { scaleId: 'gad7', answers: [1, 1, 2, 1, 1, 1, 1] } },
        { type: 'scale', day: -2, payload: { scaleId: 'phq9', answers: [1, 1, 1, 1, 0, 0, 1, 0, 0] } },
        ...checkins(-6, -1, () => ({ mood: 3, anxiety: 3, sleep: 3 })),
      ],
    },
    {
      id: 's3', title: 'ХБП, СКФ 52', summary: 'Противопоказание по функции почек',
      patient: base({ id: 'p_galina', name: 'Галина Петрова', initials: 'ГП', age: 63, sex: 'f', inviteCode: 'KMP-5560',
        diagnoses: [{ code: 'F41.1', text: 'Генерализованное тревожное расстройство' }, { code: 'N18.3', text: 'ХБП С3а' }],
        conditions: ['cvd'], labs: { egfr: 52, childPugh: 'none' },
        plan: { drugId: 'aviandr', status: 'proposed', timesPerDay: 2 } }),
      seed: [
        { type: 'scale', day: -3, payload: { scaleId: 'gad7', answers: [2, 2, 2, 1, 1, 1, 2] } },
        { type: 'scale', day: -3, payload: { scaleId: 'phq9', answers: [1, 1, 1, 1, 0, 0, 1, 0, 0] } },
      ],
    },
    {
      id: 's4', title: 'Тревожно-депрессивное, суицидальные мысли', summary: 'PHQ-9 = 21, вопрос 9 положительный',
      patient: base({ id: 'p_dmitry', name: 'Дмитрий Ковалёв', initials: 'ДК', age: 29, sex: 'm', inviteCode: 'KMP-7302',
        diagnoses: [{ code: 'F41.1', text: 'Генерализованное тревожное расстройство' }],
        plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: null, confirmedDay: -14, timesPerDay: 2 } }),
      seed: [
        { type: 'doses', fromDay: -14, toDay: -1, skip: [-6] },
        { type: 'scale', day: -14, payload: { scaleId: 'phq9', answers: [2, 2, 2, 2, 1, 2, 2, 1, 0] } },
        { type: 'scale', day: -14, payload: { scaleId: 'gad7', answers: [2, 2, 2, 2, 1, 2, 2] } },
        { type: 'scale', day: 0, payload: { scaleId: 'phq9', answers: [3, 3, 2, 2, 2, 3, 2, 2, 2] } },
        ...checkins(-6, -1, (d) => ({ mood: d > -3 ? 1 : 2, anxiety: 4, sleep: 1 })),
      ],
    },
    {
      id: 's5', title: 'Тревога после COVID-19', summary: 'Расстройство адаптации, положительная динамика',
      patient: base({ id: 'p_olga', name: 'Ольга Лебедева', initials: 'ОЛ', age: 41, sex: 'f', inviteCode: 'KMP-2648', postCovid: true,
        diagnoses: [{ code: 'F43.2', text: 'Расстройство адаптации' }, { code: 'U09.9', text: 'Состояние после COVID-19' }],
        plan: { drugId: 'aviandr', status: 'confirmed', confirmedAt: null, confirmedDay: -21, timesPerDay: 2 } }),
      seed: [
        { type: 'doses', fromDay: -21, toDay: -1, skip: [] },
        { type: 'scale', day: -21, payload: { scaleId: 'gad7', answers: [2, 2, 2, 2, 1, 2, 2] } },
        { type: 'scale', day: -7, payload: { scaleId: 'gad7', answers: [2, 1, 2, 1, 1, 1, 1] } },
        { type: 'scale', day: -1, payload: { scaleId: 'gad7', answers: [1, 1, 2, 1, 1, 1, 1] } },
        { type: 'scale', day: -1, payload: { scaleId: 'phq9', answers: [1, 1, 1, 1, 0, 0, 0, 0, 0] } },
        { type: 'ae', day: -15, payload: { items: [{ id: 'somnolence', label: 'Сонливость', severity: 'mild' }] } },
        ...checkins(-13, -1, (d) => ({ mood: d > -7 ? 4 : 3, anxiety: d > -7 ? 2 : 3, sleep: 3 })),
      ],
    },
  ];

  // Превращает seed сценария в события с ISO-датами; шкалы — в результаты подсчёта.
  KK.data.expandSeed = function (seed, nowIso) {
    const out = [];
    const atDay = (day, hour) => {
      const d = new Date(KK.util.shiftDays(nowIso, day));
      if (hour != null) d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    for (const s of seed) {
      if (s.type === 'doses') {
        for (let d = s.fromDay; d <= s.toDay; d++) {
          if (s.skip.includes(d)) continue;
          out.push({ type: 'dose', at: atDay(d, 9), payload: { slot: 'утро', taken: true } });
          out.push({ type: 'dose', at: atDay(d, 21), payload: { slot: 'вечер', taken: true } });
        }
      } else if (s.type === 'scale') {
        out.push({ type: 'scale', at: atDay(s.day, s.day === 0 ? null : 10), payload: KK.scales.score(s.payload.scaleId, s.payload.answers) });
      } else {
        out.push({ type: s.type, at: atDay(s.day, s.day === 0 ? null : 20), payload: s.payload });
      }
    }
    return out.sort(KK.util.byDateAsc);
  };

  // Подставляет confirmedAt из confirmedDay относительно now (вызывает хранилище при сбросе и тесты).
  KK.data.materializePatient = function (patient, nowIso) {
    const p = JSON.parse(JSON.stringify(patient));
    if (p.plan && p.plan.confirmedDay != null) {
      p.plan.confirmedAt = KK.util.shiftDays(nowIso, p.plan.confirmedDay);
      delete p.plan.confirmedDay;
    }
    return p;
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

Внимание: `KK.scales` должен быть загружен до вызова `expandSeed` (вызов происходит во время выполнения, не при загрузке файла, — порядок в `tests/load.js` это допускает).

- [ ] **Step 4: Обновить тест — пациенты материализуются**

В `tests/scenarios.test.js` заменить функцию `signals`:
```js
function signals(s) {
  const p = KK.data.materializePatient(s.patient, NOW);
  return KK.rules.evaluate(KK.rules.buildContext(p, eventsOf(s), NOW));
}
```
и в тестах S1/S5 вызывать `KK.therapy.check(KK.data.drugs.aviandr, KK.data.materializePatient(S('s1').patient, NOW))`.

- [ ] **Step 5: Тесты зелёные**

Run: `npm test`
Expected: PASS. Если S2 даёт `comorbid`/`worsening` — значит ответы в seed поменялись; проверить суммы (S2: GAD-7 12 → 8, PHQ-9 5).

- [ ] **Step 6: Commit**

```bash
git add data/scenarios.js tests/scenarios.test.js
git commit -m "feat(core): five Aviandr clinical scenarios with expected signals"
```

---

### Task 8: Хранилище и связь «врач–пациент»

**Files:**
- Create: `assets/store.js`
- Test: `tests/store.test.js`

API (используется планами 2 и 3):
- `KK.createStore({ storage, clock })` → store; в браузере `KK.store = KK.createStore({ storage: localStorage, clock: () => new Date() })`.
- `store.reset()` — загружает все 5 сценариев; врач по умолчанию `{ id:'d1', name:'Елена Иванова', specialty:'терапевт', mode:'nonPsychiatrist' }`.
- `store.setActivePatient(id)`, `store.activePatientId()`.
- `store.patients()` → массив пациентов с вычисленными `signals`, `routing`, `openAlerts`, `pdc14`, `lastActivityAt`; отсортирован по срочности.
- `store.patient(id)`, `store.events(id, type?)`, `store.signals(id)`.
- `store.addEvent(patientId, type, payload)` → событие; пересчитывает правила; для новых сигналов уровня critical/important создаёт алерт.
- `store.alerts({ patientId?, open? })`, `store.markDelivered(alertId)`, `store.ackAlert(alertId, action)`.
- `store.confirm(patientId, action, details)` — единственная точка клинических действий (`confirm_plan`, `confirm_routing`, `change_plan`, `cancel_plan`, `off_label`), пишет аудит.
- `store.audit(patientId?)`, `store.messages(patientId)`, `store.sendMessage(patientId, from, text)`.
- `store.doctor()`, `store.setDoctor(patch)`.
- `store.importParsed(patientId, parsed)` — сливает данные парсера в профиль (с аудитом).
- `store.subscribe(fn)` → unsubscribe; fn вызывается при любом изменении в этой вкладке и при событии `storage` из другой.

- [ ] **Step 1: Падающие тесты**

`tests/store.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const NOW = new Date('2026-10-19T12:00:00.000Z');
const mk = () => { const s = KK.createStore({ storage: memStorage(), clock: () => NOW }); s.reset(); return s; };

test('reset loads 5 patients, sorted by urgency (S4 first)', () => {
  const s = mk();
  const ps = s.patients();
  assert.equal(ps.length, 5);
  assert.equal(ps[0].id, 'p_dmitry');
  assert.equal(ps[0].routing, 'required');
});

test('reset creates open alert for S4 critical signal', () => {
  const s = mk();
  const a = s.alerts({ patientId: 'p_dmitry', open: true });
  assert.ok(a.some((x) => x.ruleId === 'si_phq9' && x.level === 'critical'));
});

test('patient SOS creates critical alert visible to doctor', () => {
  const s = mk();
  s.addEvent('p_anna', 'sos', {});
  const a = s.alerts({ patientId: 'p_anna', open: true });
  assert.equal(a[0].ruleId, 'sos');
  assert.ok(a[0].dataAt);
});

test('same signal does not duplicate alert', () => {
  const s = mk();
  s.addEvent('p_anna', 'sos', {});
  s.addEvent('p_anna', 'checkin', { mood: 2, anxiety: 3, sleep: 2 });
  assert.equal(s.alerts({ patientId: 'p_anna' }).filter((x) => x.ruleId === 'sos').length, 1);
});

test('delivery and acknowledgement timestamps', () => {
  const s = mk();
  s.addEvent('p_anna', 'sos', {});
  const [a] = s.alerts({ patientId: 'p_anna', open: true });
  s.markDelivered(a.id);
  s.ackAlert(a.id, 'Позвонил пациенту');
  const after = s.alerts({ patientId: 'p_anna' }).find((x) => x.id === a.id);
  assert.ok(after.deliveredAt && after.ackAt);
  assert.equal(after.ackAction, 'Позвонил пациенту');
  assert.equal(s.alerts({ patientId: 'p_anna', open: true }).length, 0);
});

test('scale event from patient is scored by store', () => {
  const s = mk();
  const e = s.addEvent('p_anna', 'scale', { scaleId: 'phq9', answers: [3, 3, 3, 3, 3, 3, 3, 3, 1] });
  assert.equal(e.payload.total, 25);
  assert.equal(s.patient('p_anna').routing, 'required');
});

test('confirm_plan only via confirm(), with audit', () => {
  const s = mk();
  assert.equal(s.patient('p_anna').plan.status, 'proposed');
  s.confirm('p_anna', 'confirm_plan', {});
  const p = s.patient('p_anna');
  assert.equal(p.plan.status, 'confirmed');
  assert.ok(p.plan.confirmedAt);
  assert.equal(s.audit('p_anna').at(-1).action, 'confirm_plan');
});

test('confirm_plan refused when contraindicated unless off_label', () => {
  const s = mk();
  assert.throws(() => s.confirm('p_galina', 'confirm_plan', {}), /противопоказ/i);
  s.confirm('p_galina', 'off_label', { reason: 'решение врача' });
  s.confirm('p_galina', 'confirm_plan', {});
  assert.equal(s.patient('p_galina').plan.status, 'confirmed');
});

test('messages', () => {
  const s = mk();
  s.sendMessage('p_anna', 'patient', 'Можно перенести визит?');
  assert.equal(s.messages('p_anna').at(-1).text, 'Можно перенести визит?');
});

test('persistence across store instances on same storage', () => {
  const storage = memStorage();
  const a = KK.createStore({ storage, clock: () => NOW }); a.reset();
  a.addEvent('p_anna', 'sos', {});
  const b = KK.createStore({ storage, clock: () => NOW });
  assert.ok(b.alerts({ patientId: 'p_anna', open: true }).length === 1);
});

test('subscribe fires on change', () => {
  const s = mk();
  let n = 0; const off = s.subscribe(() => n++);
  s.addEvent('p_anna', 'checkin', { mood: 3, anxiety: 2, sleep: 3 });
  off();
  s.addEvent('p_anna', 'checkin', { mood: 3, anxiety: 2, sleep: 3 });
  assert.equal(n, 1);
});

test('importParsed merges labs and meds with audit', () => {
  const s = mk();
  s.importParsed('p_anna', KK.parser.extract('СКФ 48. Принимает трамадол.'));
  const p = s.patient('p_anna');
  assert.equal(p.labs.egfr, 48);
  assert.ok(p.meds.some((m) => m.name === 'Трамадол'));
  assert.equal(s.audit('p_anna').at(-1).action, 'import_history');
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test`
Expected: FAIL — `KK.createStore is not a function`.

- [ ] **Step 3: `assets/store.js`**

```js
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
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test`
Expected: PASS (все наборы).

- [ ] **Step 5: Commit**

```bash
git add assets/store.js tests/store.test.js
git commit -m "feat(core): localStorage store with doctor-patient link, alerts and audit"
```

---

### Task 9: Дизайн-токены, компоненты, адаптер Telegram

**Files:**
- Create: `assets/tokens.css`, `assets/ui.css`, `assets/tg.js`, `ui-kit.html`

- [ ] **Step 1: `assets/tokens.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=Manrope:wght@400;500;600&display=swap');

:root {
  --font-head: 'Lora', Georgia, serif;
  --font-body: 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --radius-s: 10px; --radius-m: 16px; --radius-l: 22px;
  --tap: 44px;
  --dur: 180ms;
}

/* Пациент — «Тихое утро» */
[data-role="patient"] {
  --bg: #F6F4EF; --surface: #FFFFFF; --surface-2: #EFECE5;
  --text: #2F3B37; --text-2: #5C6863; --text-3: #8A948F;
  --accent: #5F9C88; --accent-strong: #3F7A66; --accent-tint: #E7EFEA; --on-accent: #FFFFFF;
  --line: #E2DED5;
  --help: #A8603F; --help-tint: #F6E7DF;
  --scale-1: #DCE6E1; --scale-2: #C9DDD4; --scale-3: #A9CBBE; --scale-4: #86B6A5; --scale-5: #5F9C88;
  --chart: #5F9C88; --chart-2: #B9A06E;
  --fs: 17px;
}
/* Пациент — «Мягкие сумерки» */
[data-role="patient"][data-theme="dark"] {
  --bg: #1F2433; --surface: #2A3044; --surface-2: #323A55;
  --text: #E8EAF2; --text-2: #B4BAD0; --text-3: #8E96AD;
  --accent: #8491C4; --accent-strong: #B1B9DE; --accent-tint: #323A55; --on-accent: #1F2433;
  --line: #3A4260;
  --help: #E3A68A; --help-tint: #3D3340;
  --scale-1: #3A4260; --scale-2: #4B5683; --scale-3: #6371A6; --scale-4: #8491C4; --scale-5: #B1B9DE;
  --chart: #B1B9DE; --chart-2: #D9C08E;
}
@media (prefers-color-scheme: dark) {
  [data-role="patient"]:not([data-theme="light"]) {
    --bg: #1F2433; --surface: #2A3044; --surface-2: #323A55;
    --text: #E8EAF2; --text-2: #B4BAD0; --text-3: #8E96AD;
    --accent: #8491C4; --accent-strong: #B1B9DE; --accent-tint: #323A55; --on-accent: #1F2433;
    --line: #3A4260; --help: #E3A68A; --help-tint: #3D3340;
    --scale-1: #3A4260; --scale-2: #4B5683; --scale-3: #6371A6; --scale-4: #8491C4; --scale-5: #B1B9DE;
    --chart: #B1B9DE; --chart-2: #D9C08E;
  }
}

/* Врач — нейтральная плотная тема */
[data-role="doctor"] {
  --bg: #F4F5F7; --surface: #FFFFFF; --surface-2: #F0F2F5;
  --text: #1C2430; --text-2: #4A5565; --text-3: #7B8594;
  --accent: #2F6F8F; --accent-strong: #235770; --accent-tint: #E4EFF4; --on-accent: #FFFFFF;
  --line: #E1E4E9;
  --crit: #B42318; --crit-tint: #FEE4E2; --on-crit: #FFFFFF;
  --route: #6B3FA0; --route-tint: #F1EAFA; --on-route: #FFFFFF;
  --warn: #B54708; --warn-tint: #FEF0C7;
  --ok: #2E7D4F; --ok-tint: #E3F4EA;
  --chart: #2F6F8F; --chart-2: #B54708;
  --fs: 14px;
}
```

- [ ] **Step 2: `assets/ui.css`**

```css
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--text);font:400 var(--fs)/1.55 var(--font-body);-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--font-head);font-weight:500;margin:0;line-height:1.25}
[data-role="doctor"] h1,[data-role="doctor"] h2,[data-role="doctor"] h3{font-family:var(--font-body);font-weight:600}
h1{font-size:1.55em}h2{font-size:1.25em}h3{font-size:1.05em}
p{margin:0}
a{color:var(--accent-strong)}
.muted{color:var(--text-2)}.hint{color:var(--text-3);font-size:.85em}
.stack>*+*{margin-top:12px}.stack-l>*+*{margin-top:20px}
.row{display:flex;align-items:center;gap:12px}.row-between{display:flex;align-items:center;justify-content:space-between;gap:12px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:6px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}

.card{background:var(--surface);border-radius:var(--radius-m);padding:16px}
[data-role="doctor"] .card{border:1px solid var(--line);border-radius:12px}
.card--tint{background:var(--accent-tint)}
.card--help{background:var(--help-tint);color:var(--text)}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:var(--tap);padding:0 18px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:inherit;font-weight:500;cursor:pointer;transition:background var(--dur)}
.btn:hover{background:var(--surface-2)}
.btn--primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.btn--primary:hover{background:var(--accent-strong)}
.btn--ghost{background:transparent;border-color:transparent}
.btn--block{width:100%}
[data-role="doctor"] .btn{border-radius:8px;min-height:36px;padding:0 14px}
.btn--danger{background:var(--crit);border-color:var(--crit);color:var(--on-crit)}

.field{display:flex;flex-direction:column;gap:6px}
.field input,.field textarea,.field select{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;min-height:var(--tap)}
.field textarea{min-height:120px;resize:vertical}

/* Шкала чек-ина: 5 кругов */
.dots{display:flex;justify-content:space-between;gap:8px}
.dot{flex:1;aspect-ratio:1;max-width:52px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:transform var(--dur)}
.dot[data-v="1"]{background:var(--scale-1)}.dot[data-v="2"]{background:var(--scale-2)}.dot[data-v="3"]{background:var(--scale-3)}.dot[data-v="4"]{background:var(--scale-4)}.dot[data-v="5"]{background:var(--scale-5)}
.dot[aria-pressed="true"]{border-color:var(--text);transform:scale(1.08)}

/* Варианты ответа опросника */
.choice{display:block;width:100%;text-align:left;padding:14px 16px;min-height:var(--tap);border-radius:var(--radius-m);border:1px solid var(--line);background:var(--surface);font:inherit;color:var(--text);cursor:pointer}
.choice[aria-pressed="true"]{background:var(--accent-tint);border-color:var(--accent)}
.progress{display:flex;gap:4px}.progress i{flex:1;height:4px;border-radius:2px;background:var(--line)}.progress i.on{background:var(--accent)}

/* Мобильный каркас пациента */
.p-app{max-width:480px;margin:0 auto;min-height:100vh;padding:20px 16px 96px}
.tabbar{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:center;background:var(--surface);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom)}
.tabbar nav{display:flex;max-width:480px;width:100%}
.tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;min-height:56px;font-size:12px;color:var(--text-3);text-decoration:none}
.tabbar a[aria-current="page"]{color:var(--accent-strong)}
.tabbar svg{width:22px;height:22px}
.help-fab{position:fixed;right:16px;bottom:76px;display:flex;align-items:center;gap:8px;padding:10px 16px;min-height:var(--tap);border-radius:999px;background:var(--help-tint);color:var(--help);border:1px solid var(--help);font:inherit;font-weight:500;text-decoration:none}

/* Каркас врача */
.d-app{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:100vh}
.d-side{background:var(--surface);border-right:1px solid var(--line);padding:16px 12px;display:flex;flex-direction:column;gap:2px}
.d-side a{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;color:var(--text-2);text-decoration:none}
.d-side a[aria-current="page"]{background:var(--accent-tint);color:var(--accent-strong);font-weight:600}
.d-main{padding:20px 24px;min-width:0}
@media (max-width:900px){.d-app{grid-template-columns:1fr}.d-side{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--line)}}
.table{width:100%;border-collapse:collapse;background:var(--surface)}
.table th,.table td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.table th{font-size:12px;color:var(--text-3);font-weight:600;text-transform:none}
.table tr:hover td{background:var(--surface-2)}

/* Сигналы безопасности (врач). Различимы не только цветом: заливка vs контур + текст + иконка */
.badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
.badge--critical{background:var(--crit);color:var(--on-crit)}
.badge--required{background:var(--route);color:var(--on-route)}
.badge--desirable{background:transparent;color:var(--route);border:1.5px dashed var(--route)}
.badge--warn{background:var(--warn-tint);color:var(--warn)}
.badge--contra{background:var(--crit-tint);color:var(--crit);border:1.5px solid var(--crit)}
.badge--ok{background:var(--ok-tint);color:var(--ok)}
.badge--info{background:var(--surface-2);color:var(--text-2)}
.signal{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:var(--surface)}
.signal--critical{border-left:0;border:2px solid var(--crit);background:var(--crit-tint)}
.signal--required{border:2px solid var(--route);background:var(--route-tint)}
.signal--desirable{border:1.5px dashed var(--route)}
.signal--warn{border:1px solid var(--warn);background:var(--warn-tint)}
.signal .src{grid-column:2;font-size:12px;color:var(--text-3)}

/* Модальный критический алерт */
.modal-backdrop{position:fixed;inset:0;background:rgba(16,20,28,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50}
.modal{background:var(--surface);border-radius:14px;max-width:520px;width:100%;padding:20px;border-top:6px solid var(--crit)}
```

- [ ] **Step 3: `assets/tg.js`**

```js
(function (g) {
  const KK = g.KK;
  const tg = g.Telegram && g.Telegram.WebApp;
  KK.tg = {
    inside: !!(tg && tg.initData !== undefined && tg.platform && tg.platform !== 'unknown'),
    init() {
      const root = document.documentElement;
      let saved = null;
      try { saved = localStorage.getItem('kk:theme'); } catch (e) { saved = null; }
      if (saved) root.dataset.theme = saved;
      else if (this.inside) root.dataset.theme = tg.colorScheme === 'dark' ? 'dark' : 'light';
      if (this.inside) {
        tg.ready(); tg.expand();
        tg.onEvent('themeChanged', () => { if (!saved) root.dataset.theme = tg.colorScheme; });
      }
    },
    setTheme(theme) {
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('kk:theme', theme); } catch (e) { /* приватный режим */ }
    },
    backButton(onBack) {
      if (!this.inside) return;
      tg.BackButton.show(); tg.BackButton.onClick(onBack);
    },
    mainButton(text, onClick) {
      if (!this.inside) return false;
      tg.MainButton.setText(text); tg.MainButton.show(); tg.MainButton.onClick(onClick);
      return true;
    },
    haptic(kind) { if (this.inside && tg.HapticFeedback) tg.HapticFeedback.selectionChanged(kind); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

Подключение Telegram SDK на страницах пациента: `<script src="https://telegram.org/js/telegram-web-app.js"></script>` перед `assets/kk.js`. Вне Telegram скрипт безвреден (`platform === 'unknown'`).

- [ ] **Step 4: `ui-kit.html` — витрина для визуальной проверки**

```html
<!doctype html>
<html lang="ru" data-role="patient">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Компас — витрина компонентов</title>
<link rel="stylesheet" href="assets/tokens.css"><link rel="stylesheet" href="assets/ui.css">
</head>
<body>
<main class="p-app stack-l">
  <div class="row-between"><h1>Витрина</h1>
    <div class="row">
      <button class="btn" id="role">Роль: пациент</button>
      <button class="btn" id="theme">Тема</button>
    </div></div>
  <section class="card stack"><h2>Как вы сегодня?</h2>
    <div class="dots" role="group" aria-label="Настроение от 1 до 5">
      <button class="dot" data-v="1" aria-label="Очень тяжело" aria-pressed="false"></button>
      <button class="dot" data-v="2" aria-label="Тяжело" aria-pressed="false"></button>
      <button class="dot" data-v="3" aria-label="Средне" aria-pressed="true"></button>
      <button class="dot" data-v="4" aria-label="Хорошо" aria-pressed="false"></button>
      <button class="dot" data-v="5" aria-label="Очень хорошо" aria-pressed="false"></button>
    </div></section>
  <section class="card card--tint stack"><h3>Авиандр · 20 мг · утро</h3><button class="btn btn--primary">Отметить приём</button></section>
  <section class="stack"><button class="choice" aria-pressed="false">Ни разу</button><button class="choice" aria-pressed="true">Несколько дней</button>
    <div class="progress"><i class="on"></i><i class="on"></i><i></i><i></i></div></section>
  <section class="card card--help"><p>Если сейчас очень тяжело — помощь рядом.</p></section>
  <section class="stack" id="doctor-only">
    <div class="row" style="flex-wrap:wrap">
      <span class="badge badge--critical">Критично</span><span class="badge badge--required">Обязательно к психиатру</span>
      <span class="badge badge--desirable">Желательно к психиатру</span><span class="badge badge--warn">Взаимодействие</span>
      <span class="badge badge--contra">Противопоказание</span><span class="badge badge--ok">Нет противопоказаний</span>
    </div>
    <div class="signal signal--required"><span class="badge badge--required">Обязательно</span><b>Тяжёлая депрессивная симптоматика</b><span class="src">КР РОП 2024 (ID 301)</span></div>
    <div class="signal signal--desirable"><span class="badge badge--desirable">Желательно</span><b>Сочетание тревоги и депрессии</b><span class="src">Правило команды</span></div>
  </section>
</main>
<script>
  const root = document.documentElement;
  document.getElementById('theme').onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; };
  document.getElementById('role').onclick = (e) => {
    root.dataset.role = root.dataset.role === 'patient' ? 'doctor' : 'patient';
    e.target.textContent = 'Роль: ' + (root.dataset.role === 'patient' ? 'пациент' : 'врач');
  };
  document.querySelectorAll('.dot').forEach((d) => d.onclick = () => {
    document.querySelectorAll('.dot').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    d.setAttribute('aria-pressed', 'true');
  });
</script>
</body></html>
```

- [ ] **Step 5: Визуальная проверка**

Запустить превью `kompas` (preview_start name `kompas`), открыть `http://localhost:5180/ui-kit.html`.
Проверить: светлая и тёмная тема пациента читаемы; переключение роли на «врач» даёт нейтральную тему; плашки «Обязательно» (заливка) и «Желательно» (пунктирный контур) различимы в оттенках серого (DevTools → Rendering → Emulate vision deficiency: achromatopsia); ширина 375px без горизонтального скролла. Сделать скриншот.

- [ ] **Step 6: Контраст**

Через `javascript_tool` вычислить контраст `--text` к `--bg` и `--text-2` к `--surface` в обеих темах пациента и в теме врача — каждый ≥ 4.5:1. Если `--text-3` < 4.5 — использовать его только для текста ≥ 18px или подписей-необязательной информации (как сейчас).

- [ ] **Step 7: Commit**

```bash
git add assets/tokens.css assets/ui.css assets/tg.js ui-kit.html
git commit -m "feat(ui): design tokens (morning/dusk/doctor), components, Telegram adapter"
```

---

### Task 9b: Общие UI-хелперы `assets/ui.js`

**Files:**
- Create: `assets/ui.js`
- Modify: `tests/load.js` (добавить `'assets/ui.js'` в конец `FILES`)
- Test: `tests/ui.test.js`

- [ ] **Step 1: Падающие тесты**

`tests/ui.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const { ui } = globalThis.KK;

test('esc escapes html', () => {
  assert.equal(ui.esc('<b a="1">&</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&lt;/b&gt;');
});
test('plural ru', () => {
  const f = ['день', 'дня', 'дней'];
  assert.equal(ui.plural(1, f), 'день'); assert.equal(ui.plural(3, f), 'дня');
  assert.equal(ui.plural(11, f), 'дней'); assert.equal(ui.plural(22, f), 'дня'); assert.equal(ui.plural(25, f), 'дней');
});
test('fmtDate in Russian', () => {
  assert.match(ui.fmtDate('2026-10-19T09:00:00Z'), /19 октября/);
});
test('sparkline svg with one point per value', () => {
  const svg = ui.sparkline([10, 8, 6], { w: 120, h: 40, max: 21 });
  assert.match(svg, /^<svg/);
  assert.equal(svg.match(/<circle/g).length, 3);
});
test('lineChart handles empty series', () => {
  assert.match(ui.lineChart([], { max: 27 }), /Нет данных/);
});
test('lineChart ticks:false hides numeric axis', () => {
  const s = [{ label: 'Настроение', color: '#000', points: [{ at: '2026-10-01T09:00:00Z', v: 2 }, { at: '2026-10-10T09:00:00Z', v: 4 }] }];
  assert.match(ui.lineChart(s, { max: 5 }), /text-anchor="end" font-size="11" fill="var\(--text-3\)">5</);
  assert.doesNotMatch(ui.lineChart(s, { max: 5, ticks: false }), />5<\/text>/);
});
test('icon returns svg or empty for unknown', () => {
  assert.match(ui.icon('home'), /^<svg/);
  assert.equal(ui.icon('nope'), '');
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test` → FAIL (`KK.ui` undefined).

- [ ] **Step 3: `assets/ui.js`**

```js
(function (g) {
  const KK = g.KK;
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WEEK = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const P = {
    home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
    path: '<path d="M4 19c4 0 4-6 8-6s4 6 8 6M4 5c4 0 4 6 8 6s4-6 8-6"/>',
    book: '<path d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M5 16a4 4 0 0 1 4-4h9"/>',
    chat: '<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c.8-3.5 3.5-5 7-5s6.2 1.5 7 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.4 2.2 4 5"/>',
    pill: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="M9.5 8.5l5 7"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17v.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    leaf: '<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z"/><path d="M5 19l8-8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  };
  const ui = {
    esc: (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    param: (name) => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get(name) : null),
    plural(n, [one, few, many]) {
      const a = Math.abs(n) % 100, b = a % 10;
      if (a > 10 && a < 20) return many;
      if (b > 1 && b < 5) return few;
      if (b === 1) return one;
      return many;
    },
    fmtDate(iso) { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; },
    fmtWeekday(iso) { const d = new Date(iso); const w = WEEK[d.getDay()]; return w.charAt(0).toUpperCase() + w.slice(1); },
    fmtTime(iso) { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; },
    fmtDateTime(iso) { return `${ui.fmtDate(iso)}, ${ui.fmtTime(iso)}`; },
    greeting(date = new Date()) { const h = date.getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; },
    icon(name, size = 22) {
      if (!P[name]) return '';
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
    },
    sparkline(values, { w = 120, h = 36, max = 27, color = 'var(--chart)' } = {}) {
      if (!values.length) return '';
      const step = values.length > 1 ? (w - 8) / (values.length - 1) : 0;
      const pts = values.map((v, i) => [4 + i * step, h - 4 - (v / max) * (h - 8)]);
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2" points="${pts.map((p) => p.join(',')).join(' ')}"/>${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="${color}"/>`).join('')}</svg>`;
    },
    // series: [{ label, color, points: [{ at, v }] }]; bands: [{ from, to, color }] — фоновые зоны (только для врача)
    lineChart(series, { w = 560, h = 180, max = 27, bands = [], ariaLabel = 'График динамики', ticks = true } = {}) {
      const all = series.flatMap((s) => s.points);
      if (!all.length) return `<p class="hint">Нет данных за период</p>`;
      const t0 = Math.min(...all.map((p) => +new Date(p.at))), t1 = Math.max(...all.map((p) => +new Date(p.at)));
      const L = 28, R = 8, T = 8, B = 22;
      const x = (at) => L + (t1 === t0 ? (w - L - R) / 2 : ((+new Date(at) - t0) / (t1 - t0)) * (w - L - R));
      const y = (v) => T + (1 - v / max) * (h - T - B);
      const zones = bands.map((b) => `<rect x="${L}" y="${y(b.to)}" width="${w - L - R}" height="${y(b.from) - y(b.to)}" fill="${b.color}"/>`).join('');
      const tickSvg = !ticks ? '' : [0, Math.round(max / 2), max].map((v) => `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--text-3)">${v}</text>`).join('');
      const lines = series.map((s) => {
        const pts = s.points.map((p) => [x(p.at), y(p.v)]);
        return `<polyline fill="none" stroke="${s.color}" stroke-width="2.2" points="${pts.map((p) => p.join(',')).join(' ')}"/>` +
          pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${s.color}"><title>${ui.esc(s.label)}: ${s.points[i].v} · ${ui.fmtDate(s.points[i].at)}</title></circle>`).join('');
      }).join('');
      const xl = [t0, t1].map((t, i) => `<text x="${i ? w - R : L}" y="${h - 4}" text-anchor="${i ? 'end' : 'start'}" font-size="11" fill="var(--text-3)">${ui.fmtDate(new Date(t).toISOString())}</text>`).join('');
      return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${ui.esc(ariaLabel)}">${zones}${tickSvg}${lines}${xl}</svg>`;
    },
    mount(sel, html) { const el = document.querySelector(sel); if (el) el.innerHTML = html; return el; },
  };
  KK.ui = ui;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Тесты зелёные** — Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/ui.js tests/ui.test.js tests/load.js
git commit -m "feat(ui): shared helpers — escaping, Russian dates/plurals, icons, charts"
```

---

### Task 10: Лаунчер демо

**Files:**
- Create: `index.html`

- [ ] **Step 1: `index.html`**

```html
<!doctype html>
<html lang="ru" data-role="doctor">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Клинический компас — демо</title>
<link rel="stylesheet" href="assets/tokens.css"><link rel="stylesheet" href="assets/ui.css">
</head>
<body>
<main style="max-width:880px;margin:0 auto;padding:32px 16px" class="stack-l">
  <header class="stack">
    <h1>Клинический компас</h1>
    <p class="muted">Демо-прототип цифрового ассистента врача для ведения пациентов с тревожной и депрессивной симптоматикой. Данные вымышлены и хранятся только в этом браузере.</p>
  </header>
  <section class="card stack">
    <div class="row-between"><h2>Сценарии «Авиандр»</h2><button class="btn" id="reset">Сбросить демо</button></div>
    <table class="table"><thead><tr><th>Пациент</th><th>Сценарий</th><th>Сигналы</th><th></th></tr></thead><tbody id="rows"></tbody></table>
    <p class="hint">Совет: откройте «Пациент» и «Врач» в двух вкладках — данные, которые вводит пациент, сразу появятся у врача.</p>
  </section>
  <section class="row" style="flex-wrap:wrap">
    <a class="btn btn--primary" href="doctor/index.html">Открыть кабинет врача</a>
    <a class="btn" href="ui-kit.html">Витрина компонентов</a>
  </section>
</main>
<script src="assets/kk.js"></script>
<script src="data/scales.js"></script><script src="data/drugs/classes.js"></script><script src="data/drugs/aviandr.js"></script>
<script src="data/rules/core.js"></script><script src="data/scenarios.js"></script>
<script src="assets/scales.js"></script><script src="assets/therapy.js"></script><script src="assets/adherence.js"></script>
<script src="assets/rules.js"></script><script src="assets/parser.js"></script><script src="assets/store.js"></script>
<script>
  const s = KK.store;
  const scen = Object.fromEntries(KK.data.scenarios.map((x) => [x.patient.id, x]));
  const badge = (p) => p.openAlerts.some((a) => a.level === 'critical') ? '<span class="badge badge--critical">Критично</span>'
    : p.routing === 'required' ? '<span class="badge badge--required">Обязательно к психиатру</span>'
    : p.routing === 'desirable' ? '<span class="badge badge--desirable">Желательно</span>'
    : p.therapy?.eligible === false ? '<span class="badge badge--contra">Противопоказание</span>'
    : p.signals.length ? '<span class="badge badge--warn">Есть сигналы</span>' : '<span class="badge badge--ok">Стабильно</span>';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function render() {
    document.getElementById('rows').innerHTML = s.patients().map((p) => `
      <tr><td><b>${esc(p.name)}</b><br><span class="hint">${p.age} лет · ${esc(p.diagnoses[0].code)}</span></td>
      <td>${esc(scen[p.id].title)}<br><span class="hint">${esc(scen[p.id].summary)}</span></td>
      <td>${badge(p)}</td>
      <td><a class="btn" href="patient/index.html?p=${p.id}">Как пациент</a></td></tr>`).join('');
  }
  document.getElementById('reset').onclick = () => { s.reset(); render(); };
  s.subscribe(render);
  render();
</script>
</body></html>
```

Ссылки на `patient/index.html` и `doctor/index.html` будут вести на 404 до выполнения планов 2 и 3 — это ожидаемо.

- [ ] **Step 2: Проверка в браузере**

Открыть `http://localhost:5180/`. Ожидается 5 строк; первая — Дмитрий Ковалёв с «Критично»; Галина Петрова — «Противопоказание»; Сергей Морозов — «Есть сигналы»; Анна и Ольга — «Стабильно». Нажать «Сбросить демо» — список перерисовывается без ошибок в консоли (`read_console_messages`).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): demo launcher with scenario table and reset"
```

---

### Task 11: Обновить граф и итоговая проверка

- [ ] **Step 1:** `npm test` — все тесты зелёные, вывести число тестов.
- [ ] **Step 2:** `graphify update .` (по инструкции CLAUDE.md; если graphify недоступен в этой папке — пропустить с пометкой).
- [ ] **Step 3: Commit** (если graphify создал файлы — добавить `graphify-out/`).

---

## Контракт ядра (для планов 2 и 3)

**Порядок подключения скриптов на любой странице** (пути относительно корня; со страниц в `patient/`/`doctor/` — с префиксом `../`):
```
[patient only] https://telegram.org/js/telegram-web-app.js
assets/kk.js
data/scales.js  data/drugs/classes.js  data/drugs/aviandr.js  data/rules/core.js  data/scenarios.js
assets/scales.js  assets/therapy.js  assets/adherence.js  assets/rules.js  assets/parser.js  assets/store.js
assets/ui.js  assets/tg.js
```

**Хелперы `KK.ui`:** `esc, param, plural, fmtDate, fmtWeekday, fmtTime, fmtDateTime, greeting, icon(name,size), sparkline(values,opts), lineChart(series,opts), mount(sel,html)`. Иконки: `home path book chat user users pill heart bell alert check back file clipboard route settings upload leaf sun moon phone`.

**Объекты:**
- Пациент (вид из `store.patient(id)`): `{ id, name, initials, age, sex, diagnoses[{code,text}], meds[{name,classes}], labs{egfr,childPugh}, conditions[], history{}, plan{drugId,status:'proposed'|'confirmed'|'cancelled',confirmedAt,timesPerDay,offLabel?}, routingConfirmed?, inviteCode, signals[], routing, openAlerts[], therapy, pdc14, missedStreak, latest{phq9,gad7,cssrs}, lastActivityAt }`.
- Событие: `{ id, type: 'checkin'|'scale'|'dose'|'ae'|'sos'|'message', at, payload }`; payload чек-ина `{mood,anxiety,sleep}` (1–5), дозы `{slot,taken}`, НЯ `{items:[{id,label,severity:'mild'|'moderate'|'severe'}], note}`, шкалы — результат `KK.scales.score`.
- Сигнал: `{ ruleId, level, routing, title, text, source, teamRule }`.
- Алерт: `{ id, patientId, ruleId, level, routing, title, text, source, dataAt, createdAt, deliveredAt, ackAt, ackAction }`.
- Врач: `{ id, name, specialty, mode: 'nonPsychiatrist'|'psychiatrist' }`.
