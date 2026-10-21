# MAX-мессенджер и перенос данных на веб-платформу — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пациентская часть «Клинического компаса» работает как мини-приложение MAX (и Telegram, и в браузере), каждая отметка уходит через очередь синхронизации, пациент может перейти на сайт по одноразовому коду и скачать свои данные пакетом `kompas-bundle v1`; для сервера готов API-контракт и эталонная проверка `initData`.

**Architecture:** Новый адаптер `KK.host` (`assets/host.js`) прячет различия MAX / Telegram / браузера и заменяет `assets/tg.js`. Запись событий пациента идёт через `KK.sync` (`assets/sync.js`) — очередь с ключом идемпотентности поверх транспорта; в демо транспорт локальный (пишет в существующий `KK.store`). Стор получает каналы, коды переезда, согласия, `snapshot`/`restore`; поверх них `KK.bundle` (`assets/bundle.js`) делает экспорт и импорт. Сервер не пишется: контракт — `docs/api/openapi.yaml`, эталон проверки подписи — `tools/max-initdata.js`.

**Tech Stack:** ванильный JS ES2020 в классических скриптах (паттерн `(function (g) { … })(typeof window !== 'undefined' ? window : globalThis)`, общий неймспейс `KK`), Node 24 `node --test`, без сборки и зависимостей. Спек: `docs/superpowers/specs/2026-10-21-max-messenger-design.md`.

**Ветка:** `feat/max-messenger` (уже создана, спек закоммичен). Репозиторий: `C:\Users\user\Desktop\claude\klinicheskiy-kompas`, своя git-история, remote нет.

**Как запускать:**
- все тесты: `npm test` (это `node --test "tests/*.test.js"`); один файл: `node --test tests/host.test.js`;
- превью: сервер `node tools/serve.js` на `http://localhost:5180` (в Claude Code — `preview_start` с именем `kompas`).

**Правила кода в репозитории:** комментарии по-русски, коротко и только там, где неочевидно «почему»; тексты интерфейса для пациента — без баллов, без красного, без слов «тяжёлая/тяжело» в оценках (есть тесты на тексты); пользовательский ввод в HTML — только через `ui.esc`; `localStorage` всегда в `try/catch`.

---

## Карта файлов

| Файл | Что делает |
|---|---|
| Create `tools/max-initdata.js` | Эталонная проверка и подпись `initData` MAX (Node, `crypto`) |
| Create `assets/host.js` | `KK.host`, `KK.createHost`, `KK.hostDetect` — адаптер платформы |
| Delete `assets/tg.js` | Заменён `host.js` |
| Create `assets/sync.js` | `KK.createSync`, `KK.syncLocalTransport`, `KK.sync` — очередь отправки |
| Create `assets/bundle.js` | `KK.bundle.exportBundle/importBundle/fileName` |
| Create `data/bot-messages.js` | Шаблоны сообщений бота MAX (`KK.data.botMessages`) |
| Create `docs/api/openapi.yaml`, `docs/api/README.md` | API-контракт и описание бота |
| Modify `assets/store.js` | `clientId`/`channel` в событиях, каналы, коды переезда, согласия, `snapshot`/`restore` |
| Modify `assets/theme.js` | `KK.tg` → `KK.host` |
| Modify `assets/patient.js` | `KK.host`, привязка канала, строка статуса синхронизации |
| Modify `assets/doctor.js` | подписи действий журнала для каналов и импорта |
| Modify `patient/today.js`, `therapy.js`, `scale.js`, `help.js`, `intake.js` | запись через `KK.sync.submit`, `KK.host.haptic`, `guardClose` |
| Modify `patient/profile.js`, `patient/onboarding.js` | каналы, «Открыть на сайте», «Скачать мои данные», ввод кода, `startapp` |
| Modify `doctor/patient.js` | канал в ленте событий, кнопка «Экспорт данных» |
| Modify все `*.html` с `assets/tg.js` | подключить `host.js` (+ `sync.js`, `bundle.js`, скрипт MAX у пациента) |
| Modify `tools/build-artifact.js`, `tests/build.test.js` | вырезать скрипт MAX из ссылки-демо |
| Modify `tests/load.js` | загрузка новых модулей в Node |
| Modify `assets/patient.css` | стили строки синхронизации и кода переезда |
| Create tests | `tests/max-initdata.test.js`, `tests/host.test.js`, `tests/sync.test.js`, `tests/bundle.test.js`, `tests/api.test.js`; дополнения в `tests/store.test.js` |

---

### Task 1: Эталонная проверка `initData` MAX

**Files:**
- Create: `tools/max-initdata.js`
- Test: `tests/max-initdata.test.js`

Алгоритм по dev.max.ru/docs/webapps/validation: `secret = HMAC-SHA256(key="WebAppData", msg=BOT_TOKEN)`; из `initData` убрать `hash`; пары `key=value` (значения URL-декодированы) отсортировать по ключу и склеить через `\n`; `hex(HMAC-SHA256(secret, строка)) === hash`; `auth_date` не старше часа. Единица `auth_date` в документации не указана: значение больше `1e12` считаем миллисекундами, иначе секундами.

- [ ] **Step 1: Write the failing test**

`tests/max-initdata.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, sign, checkString } = require('../tools/max-initdata.js');

const TOKEN = 'test-bot-token';
const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
const fields = (over = {}) => Object.assign({
  auth_date: String(NOW / 1000 - 60),
  query_id: 'q-1',
  user: JSON.stringify({ id: 4242, first_name: 'Анна', language_code: 'ru' }),
  start_param: 'inv_KMP-1234',
}, over);

test('valid initData passes and returns the user and start_param', () => {
  const r = validate(sign(fields(), TOKEN), TOKEN, { now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.user.id, 4242);
  assert.equal(r.startParam, 'inv_KMP-1234');
});

test('field order does not matter', () => {
  const signed = sign(fields(), TOKEN);
  const params = [...new URLSearchParams(signed)].reverse();
  assert.equal(validate(new URLSearchParams(params).toString(), TOKEN, { now: NOW }).ok, true);
});

test('tampered field, foreign token and missing hash are rejected', () => {
  const signed = sign(fields(), TOKEN);
  assert.equal(validate(signed.replace('q-1', 'q-2'), TOKEN, { now: NOW }).reason, 'bad_hash');
  assert.equal(validate(signed, 'other-token', { now: NOW }).reason, 'bad_hash');
  assert.equal(validate(new URLSearchParams(fields()).toString(), TOKEN, { now: NOW }).reason, 'no_hash');
  assert.equal(validate('', TOKEN, { now: NOW }).reason, 'empty');
});

test('auth_date older than an hour is expired; milliseconds are understood', () => {
  assert.equal(validate(sign(fields({ auth_date: String(NOW / 1000 - 3601) }), TOKEN), TOKEN, { now: NOW }).reason, 'expired');
  assert.equal(validate(sign(fields({ auth_date: String(NOW - 60000) }), TOKEN), TOKEN, { now: NOW }).ok, true);
});

test('check string excludes hash, sorts keys and joins with newline', () => {
  assert.equal(checkString('b=2&hash=ff&a=1'), 'a=1\nb=2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/max-initdata.test.js`
Expected: FAIL — `Cannot find module '../tools/max-initdata.js'`.

- [ ] **Step 3: Write minimal implementation**

`tools/max-initdata.js`:

```js
// Эталонная проверка initData мини-приложения MAX (dev.max.ru/docs/webapps/validation) — для сверки серверной реализации.
// secret = HMAC-SHA256(key "WebAppData", msg токен бота); подпись = hex(HMAC-SHA256(secret, отсортированные пары без hash через \n)).
const crypto = require('node:crypto');

const MAX_AGE_SEC = 3600;
const SKEW_SEC = 60; // часы клиента могут спешить

function checkString(initData) {
  const pairs = [...new URLSearchParams(initData)].filter(([k]) => k !== 'hash');
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return pairs.map(([k, v]) => `${k}=${v}`).join('\n');
}
const secretKey = (botToken) => crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
const signature = (initData, botToken) => crypto.createHmac('sha256', secretKey(botToken)).update(checkString(initData)).digest('hex');

// Подписать поля (для тестов и локальной разработки): возвращает строку initData с hash.
function sign(fields, botToken) {
  const qs = new URLSearchParams(fields).toString();
  return `${qs}&hash=${signature(qs, botToken)}`;
}

function validate(initData, botToken, { now = Date.now(), maxAgeSec = MAX_AGE_SEC } = {}) {
  if (typeof initData !== 'string' || !initData) return { ok: false, reason: 'empty' };
  const params = new URLSearchParams(initData);
  const hash = (params.get('hash') || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: 'no_hash' };
  const expected = Buffer.from(signature(initData, botToken), 'hex');
  const got = Buffer.from(hash, 'hex');
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return { ok: false, reason: 'bad_hash' };
  const raw = Number(params.get('auth_date'));
  if (!Number.isFinite(raw) || raw <= 0) return { ok: false, reason: 'no_auth_date' };
  const authSec = raw > 1e12 ? raw / 1000 : raw; // единица в документации не указана
  const age = now / 1000 - authSec;
  if (age > maxAgeSec || age < -SKEW_SEC) return { ok: false, reason: 'expired' };
  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch (e) { return { ok: false, reason: 'bad_user' }; }
  return { ok: true, user, authDate: authSec, startParam: params.get('start_param'), chat: params.get('chat') };
}

module.exports = { validate, sign, checkString };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/max-initdata.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/max-initdata.js tests/max-initdata.test.js
git commit -m "feat(max): reference initData validator for the server contract"
```

---

### Task 2: Адаптер платформы `KK.host`

**Files:**
- Create: `assets/host.js`
- Modify: `tests/load.js` (добавить `'assets/host.js'` после `'assets/ui.js'`)
- Test: `tests/host.test.js`

MAX: `window.WebApp` (скрипт `st.max.ru/js/max-web-app.js`) с непустой `initData`. Telegram: `window.Telegram.WebApp`, `platform !== 'unknown'`. Иначе `web`. Методы MAX `HapticFeedback` точно не описаны в документации — вызываем то, что есть.

- [ ] **Step 1: Write the failing test**

`tests/host.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

function fakeMax(over = {}) {
  const calls = [];
  const WebApp = Object.assign({
    initData: 'auth_date=1&hash=x', initDataUnsafe: { start_param: 'inv_KMP-1234' },
    BackButton: { show: () => calls.push('back.show'), onClick: (fn) => calls.push(['back.onClick', typeof fn]) },
    HapticFeedback: { impactOccurred: (s) => calls.push(['haptic', s]) },
    enableClosingConfirmation: () => calls.push('guard.on'), disableClosingConfirmation: () => calls.push('guard.off'),
    openLink: (u) => calls.push(['open', u]),
  }, over);
  return { win: { WebApp, location: { search: '' } }, calls };
}

test('detects MAX, Telegram and web', () => {
  assert.equal(KK.hostDetect(fakeMax().win), 'max');
  assert.equal(KK.hostDetect({ WebApp: { initData: '' } }), 'web');
  assert.equal(KK.hostDetect({ Telegram: { WebApp: { initData: '', platform: 'ios' } } }), 'telegram');
  assert.equal(KK.hostDetect({ Telegram: { WebApp: { initData: '', platform: 'unknown' } } }), 'web');
  assert.equal(KK.hostDetect(null), 'web');
});

test('MAX host maps back button, haptics, closing guard, links and start param', () => {
  const { win, calls } = fakeMax();
  const h = KK.createHost(win);
  assert.equal(h.platform, 'max');
  assert.equal(h.inside, true);
  h.backButton(() => {});
  h.haptic();
  h.guardClose(true); h.guardClose(false);
  h.openLink('https://example.ru/x');
  assert.deepEqual(calls, ['back.show', ['back.onClick', 'function'], ['haptic', 'light'], 'guard.on', 'guard.off', ['open', 'https://example.ru/x']]);
  assert.equal(h.startParam(), 'inv_KMP-1234');
  assert.equal(h.initData(), 'auth_date=1&hash=x');
  assert.equal(h.download('a.json', '{}'), false); // в MAX — текст с кнопкой «Скопировать»
});

test('web host is safe without any platform objects', () => {
  const h = KK.createHost({ location: { search: '?startapp=inv_KMP-9999' } });
  assert.equal(h.platform, 'web');
  assert.equal(h.inside, false);
  assert.doesNotThrow(() => { h.backButton(() => {}); h.haptic(); h.guardClose(true); h.init(); });
  assert.equal(h.startParam(), 'inv_KMP-9999');
  assert.equal(h.initData(), '');
  const nothing = KK.createHost(null);
  assert.doesNotThrow(() => { nothing.openLink('https://x.ru'); nothing.init(); });
  assert.equal(nothing.startParam(), null);
});

test('a throwing platform API never breaks the page', () => {
  const { win } = fakeMax({ BackButton: { show() { throw new Error('boom'); }, onClick() {} } });
  assert.doesNotThrow(() => KK.createHost(win).backButton(() => {}));
});

test('channel labels for the interface', () => {
  assert.equal(KK.host.LABELS.max, 'MAX');
  assert.equal(KK.host.LABELS.web, 'Сайт');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/host.test.js`
Expected: FAIL — `KK.hostDetect is not a function`.

- [ ] **Step 3: Write minimal implementation**

`assets/host.js`:

```js
// Адаптер платформы: MAX (window.WebApp), Telegram (window.Telegram.WebApp) или обычный браузер.
// Страницы пациента вызывают только KK.host — различия платформ здесь. Любой сбой API платформы глушится:
// вибрация или системная кнопка «Назад» не должны ломать экран.
(function (g) {
  const KK = g.KK = g.KK || {};
  const LABELS = { max: 'MAX', telegram: 'Telegram', web: 'Сайт', 'max-chat': 'чат MAX' };
  const safe = (fn) => { try { return fn(); } catch (e) { return undefined; } };

  function detect(win) {
    const max = win && win.WebApp;
    if (max && typeof max.initData === 'string' && max.initData) return 'max';
    const tg = win && win.Telegram && win.Telegram.WebApp;
    if (tg && tg.initData !== undefined && tg.platform && tg.platform !== 'unknown') return 'telegram';
    return 'web';
  }

  function createHost(win) {
    const platform = detect(win);
    const api = platform === 'max' ? win.WebApp : platform === 'telegram' ? win.Telegram.WebApp : null;
    const doc = win && win.document;
    const ls = () => safe(() => win.localStorage) || null;
    const themeKey = () => (KK.theme && typeof KK.theme.key === 'function' ? KK.theme.key() : 'kk:theme:patient');
    return {
      platform,
      inside: platform !== 'web',
      label: LABELS[platform],
      LABELS,
      // Тема: явный выбор пациента; в Telegram без выбора — тема клиента. У MAX тема в документации не описана.
      init() {
        if (!doc) return;
        const root = doc.documentElement;
        const saved = safe(() => ls().getItem(themeKey()));
        const explicit = saved === 'light' || saved === 'dark';
        if (explicit) root.dataset.theme = saved;
        if (platform !== 'telegram') return;
        safe(() => { api.ready(); api.expand(); });
        if (!explicit) root.dataset.theme = api.colorScheme === 'dark' ? 'dark' : 'light';
        safe(() => api.onEvent('themeChanged', () => { if (!explicit) root.dataset.theme = api.colorScheme; }));
      },
      setTheme(theme) {
        if (doc) doc.documentElement.dataset.theme = theme;
        safe(() => ls().setItem(themeKey(), theme));
      },
      backButton(onBack) {
        if (!api || !api.BackButton) return;
        safe(() => { api.BackButton.show(); api.BackButton.onClick(onBack); });
      },
      haptic() {
        const h = api && api.HapticFeedback;
        if (!h) return;
        safe(() => (typeof h.selectionChanged === 'function' ? h.selectionChanged() : h.impactOccurred('light')));
      },
      openLink(url) {
        if (api && typeof api.openLink === 'function') { safe(() => api.openLink(url)); return; }
        if (win && typeof win.open === 'function') safe(() => win.open(url, '_blank', 'noopener'));
      },
      startParam() {
        const fromApi = api && safe(() => api.initDataUnsafe && api.initDataUnsafe.start_param);
        if (fromApi) return String(fromApi);
        return safe(() => new URLSearchParams(win.location.search).get('startapp')) || null;
      },
      initData: () => (api && typeof api.initData === 'string' ? api.initData : ''),
      // Подтверждение закрытия мини-приложения на время анкеты. В браузере не включаем: окно «Покинуть сайт?»
      // мешало бы переходу на экран помощи, а ответы и так сохраняются в черновике.
      guardClose(on) {
        if (!api) return;
        safe(() => (on ? api.enableClosingConfirmation() : api.disableClosingConfirmation()));
      },
      // Скачать текстовый файл. false — платформа не умеет (MAX принимает только ссылку с сервера): покажите текст.
      download(name, text) {
        if (platform === 'max' || !doc || typeof win.Blob !== 'function' || !win.URL) return false;
        return safe(() => {
          const url = win.URL.createObjectURL(new win.Blob([text], { type: 'application/json' }));
          const a = doc.createElement('a');
          a.href = url; a.download = name;
          doc.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => win.URL.revokeObjectURL(url), 1000);
          return true;
        }) === true;
      },
    };
  }

  KK.hostDetect = detect;
  KK.createHost = createHost;
  KK.host = createHost(typeof window !== 'undefined' ? window : null);
})(typeof window !== 'undefined' ? window : globalThis);
```

In `tests/load.js`, add `'assets/host.js',` right after `'assets/ui.js',` in the `FILES` array.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/host.test.js` → PASS, 5 tests. Then `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add assets/host.js tests/host.test.js tests/load.js
git commit -m "feat(host): platform adapter for MAX, Telegram and web"
```

---

### Task 3: Перевести страницы с `tg.js` на `host.js`, подключить скрипт MAX

**Files:**
- Modify: все HTML, где есть `assets/tg.js` (`index.html`, `ui-kit.html`, `doctor/*.html`, `psych/*.html`, `patient/*.html`, включая `_template.html`)
- Modify: `assets/theme.js:68`, `assets/patient.js:29,45`, `patient/today.js:70`, `patient/scale.js:57`, `patient/intake.js:184,207`
- Modify: `tools/build-artifact.js`, `tests/build.test.js`
- Delete: `assets/tg.js`

- [ ] **Step 1: Write the failing test** — в `tests/build.test.js` внутри существующего теста, сразу после строки с `assert.doesNotMatch(... /telegram\.org/, f);`, добавить проверку скрипта MAX:

```js
    for (const f of list.filter((x) => x.endsWith('.html'))) assert.doesNotMatch(fs.readFileSync(path.join(out, f), 'utf8'), /st\.max\.ru/, f);
    assert.ok(!list.includes('assets/tg.js') && list.includes('assets/host.js'));
```

Также новый тест в конце `tests/build.test.js`:

```js
test('every page loads host.js, patient pages also load the MAX bridge, nobody loads tg.js', () => {
  const root = path.join(__dirname, '..');
  const pages = ['index.html', 'ui-kit.html', ...['patient', 'doctor', 'psych'].flatMap((d) =>
    fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`))];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(root, p), 'utf8');
    assert.doesNotMatch(html, /assets\/tg\.js/, p);
    assert.match(html, /assets\/host\.js/, p);
    if (p.startsWith('patient/')) assert.match(html, /<script src="https:\/\/st\.max\.ru\/js\/max-web-app\.js"><\/script>/, p);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/build.test.js`
Expected: FAIL — pages still reference `assets/tg.js`.

- [ ] **Step 3: Implement**

1. Заменить подключение во всех HTML (Git Bash):

```bash
grep -rl --include=*.html 'assets/tg.js' index.html ui-kit.html patient doctor psych | xargs sed -i 's#<script src="\(\.\./\)\?assets/tg\.js"></script>#<script src="\1assets/host.js"></script>#'
```

2. В `patient/*.html` (включая `_template.html`) добавить мост MAX сразу после строки Telegram:

```bash
sed -i 's#<script src="https://telegram.org/js/telegram-web-app.js"></script>#&\n<script src="https://st.max.ru/js/max-web-app.js"></script>#' patient/*.html
```

Проверка: `grep -c "st.max.ru" patient/*.html` — по 1 в каждом файле; `grep -rl "assets/tg.js" --include=*.html index.html ui-kit.html patient doctor psych` — пусто.

3. `assets/theme.js` строка 68:

```js
      if (valid(v) && KK.host && typeof KK.host.setTheme === 'function') KK.host.setTheme(v);
```

4. `assets/patient.js`: строка 29 `KK.tg.init();` → `KK.host.init();`; строка 45 `if (back) KK.tg.backButton(...)` → `if (back) KK.host.backButton(() => { location.href = back; });`.

5. `patient/today.js:70`, `patient/scale.js:57`, `patient/intake.js:184` и `:207`: `KK.tg.haptic();` → `KK.host.haptic();`.

6. Защита от закрытия во время анкет:
   - `patient/scale.js`: сразу после строки `if (!ctx) return;` (в начале файла) добавить `KK.host.guardClose(true);`; в `finish()` первой строкой — `KK.host.guardClose(false);`.
   - `patient/intake.js`: в `render()` первой строкой — `KK.host.guardClose(!['intro', 'done'].includes(st.step));`; перед каждым `location.replace('help.html?from=intake')` — `KK.host.guardClose(false);`.

7. `tools/build-artifact.js`: рядом с `TG_SCRIPT` добавить

```js
const MAX_SCRIPT = /[ \t]*<script src="https:\/\/st\.max\.ru\/js\/max-web-app\.js"><\/script>\r?\n?/g;
```

в `transform` заменить строку для HTML на

```js
  if (rel.endsWith('.html')) text = text.replace(TG_SCRIPT, '').replace(MAX_SCRIPT, '');
```

и в шапке-комментарии дописать «и max-web-app.js».

8. Удалить `assets/tg.js`: `git rm assets/tg.js`. Проверка: `grep -rn "KK\.tg" assets patient doctor psych` — пусто.

- [ ] **Step 4: Run tests**

Run: `npm test` → все проходят (включая два обновлённых теста сборки).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(host): pages use KK.host instead of tg.js, patient pages load the MAX bridge"
```

---

### Task 4: Стор — идемпотентность, каналы, коды переезда, согласия, снимок

**Files:**
- Modify: `assets/store.js` (константы вверху; `addEvent` ~стр. 195; новые методы в объекте `api` перед `subscribe`)
- Modify: `assets/doctor.js:219-226` (`auditLabel`)
- Test: `tests/store.test.js` (дописать в конец)

- [ ] **Step 1: Write the failing tests** — в конец `tests/store.test.js`:

```js
test('addEvent with the same clientId does not duplicate and keeps the channel', () => {
  const s = mk();
  const a = s.addEvent('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 }, { clientId: 'cl_1', channel: 'max' });
  const b = s.addEvent('p_olga', 'checkin', { mood: 1, anxiety: 5, sleep: 1 }, { clientId: 'cl_1', channel: 'max' });
  assert.equal(a.id, b.id);
  assert.equal(s.events('p_olga').filter((e) => e.clientId === 'cl_1').length, 1);
  assert.equal(a.channel, 'max');
});

test('channels: link once, list active, unlink keeps history', () => {
  const s = mk();
  s.linkChannel('p_olga', 'max');
  s.linkChannel('p_olga', 'max');
  s.linkChannel('p_olga', 'web');
  assert.deepEqual(s.channels('p_olga').map((c) => c.channel), ['max', 'web']);
  const before = s.events('p_olga').length;
  assert.equal(s.unlinkChannel('p_olga', 'max'), true);
  assert.deepEqual(s.channels('p_olga').map((c) => c.channel), ['web']);
  assert.equal(s.events('p_olga').length, before);
  assert.throws(() => s.linkChannel('p_olga', 'icq'), /Неизвестный канал/);
});

test('link code: 6 digits, single use, expires in 10 minutes, links the web channel', () => {
  let now = NOW;
  const s = KK.createStore({ storage: memStorage(), clock: () => now });
  s.reset();
  const { code } = s.createLinkCode('p_olga');
  assert.match(code, /^\d{6}$/);
  assert.equal(s.redeemLinkCode(code, 'web'), 'p_olga');
  assert.ok(s.channels('p_olga').some((c) => c.channel === 'web'));
  assert.throws(() => s.redeemLinkCode(code), (e) => e.reason === 'used');
  const late = s.createLinkCode('p_olga').code;
  now = new Date(NOW.getTime() + 10 * 60000 + 1);
  assert.throws(() => s.redeemLinkCode(late), (e) => e.reason === 'expired');
  assert.throws(() => s.redeemLinkCode('000000'), (e) => e.reason === 'unknown');
});

test('consents are recorded with time and version', () => {
  const s = mk();
  s.recordConsents('p_olga', ['data_processing', 'doctor_access', 'not_emergency']);
  assert.deepEqual(s.patient('p_olga').consents.map((c) => c.kind), ['data_processing', 'doctor_access', 'not_emergency']);
  assert.equal(s.patient('p_olga').consents[0].version, '1');
});

test('snapshot and restore round-trip into a clean store without duplicates', () => {
  const s = mk();
  s.addEvent('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 }, { clientId: 'cl_9', channel: 'max' });
  const snap = s.snapshot('p_olga');
  const other = mk();
  const copy = JSON.parse(JSON.stringify(snap));
  copy.patient.id = 'p_moved';
  assert.equal(other.restore(copy), 'p_moved');
  assert.equal(other.events('p_moved').length, snap.events.length);
  other.restore(copy);
  assert.equal(other.events('p_moved').length, snap.events.length);
  assert.equal(other.patient('p_moved').name, 'Ольга Лебедева');
  assert.throws(() => other.restore({ patient: { id: '__proto__' } }), /без пациента/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/store.test.js`
Expected: FAIL — `s.linkChannel is not a function` и т. д.; первый тест падает на дубле.

- [ ] **Step 3: Implement**

В `assets/store.js` после `const BACKDATE_DAYS = 7;` добавить:

```js
  const CHANNELS = ['max', 'telegram', 'web'];
  const LINK_CODE_TTL = 10 * 60000; // код переезда на сайт: 10 минут, одно гашение
  const CONSENT_VERSION = '1';
```

В `addEvent` сразу после строки `if (!has(patientId)) throw new Error(\`Unknown patient ${patientId}\`);` вставить:

```js
        // Повтор из очереди синхронизации с тем же clientId не создаёт второе событие.
        if (opts && opts.clientId) {
          const dup = (db.events[patientId] || []).find((x) => x.clientId === String(opts.clientId));
          if (dup) return dup;
        }
```

и заменить строку `const e = { id: KK.util.uid('ev'), type, at, recordedAt: now, payload: p };` на:

```js
        const e = { id: KK.util.uid('ev'), type, at, recordedAt: now, payload: p };
        if (opts && opts.clientId) e.clientId = String(opts.clientId);
        if (opts && opts.channel) e.channel = String(opts.channel);
```

В объект `api` перед `subscribe(fn) {` вставить:

```js
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
        rec.usedAt = nowIso();
        write();
        api.linkChannel(rec.patientId, channel);
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
        if (typeof id !== 'string' || !id || id === '__proto__' || id === 'constructor' || id === 'prototype') throw new Error('Пакет без пациента');
        if (!has(id)) { db.patients[id] = Object.assign({}, patient); db.events[id] = []; }
        db.messages[id] = db.messages[id] || [];
        const list = db.events[id];
        const seen = new Set(list.flatMap((e) => [e.id, e.clientId].filter(Boolean)));
        for (const e of events) if (!seen.has(e.id) && !(e.clientId && seen.has(e.clientId))) list.push(Object.assign({}, e));
        list.sort((a, b) => new Date(a.at) - new Date(b.at));
        const msgIds = new Set(db.messages[id].map((m) => m.id));
        for (const m of messages) if (!msgIds.has(m.id)) db.messages[id].push(Object.assign({}, m));
        const auIds = new Set(db.audit.map((a) => a.id));
        for (const a of au) if (!auIds.has(a.id)) db.audit.push(Object.assign({}, a, { patientId: id }));
        syncAlerts(id, nowIso());
        write();
        return id;
      },
```

В `assets/doctor.js` в `auditLabel(a)` перед `return a.action;` добавить:

```js
      const CH = { max: 'MAX', telegram: 'Telegram', web: 'сайт' };
      if (a.action === 'channel_linked') return `Пациент подключил дневник: ${CH[a.details && a.details.channel] || ''}`;
      if (a.action === 'channel_unlinked') return `Пациент отключил дневник: ${CH[a.details && a.details.channel] || ''}`;
      if (a.action === 'consents_recorded') return 'Пациент дал согласия при подключении';
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/store.test.js` → PASS; `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add assets/store.js assets/doctor.js tests/store.test.js
git commit -m "feat(store): idempotent events, patient channels, site link codes, consents, snapshot/restore"
```

---

### Task 5: Очередь синхронизации `KK.sync`

**Files:**
- Create: `assets/sync.js`
- Modify: `tests/load.js` (добавить `'assets/sync.js'` после `'assets/host.js'`)
- Test: `tests/sync.test.js`

Контракт транспорта: `send(items) → [{ clientId, status: 'accepted' | 'rejected', event?, reason? }]`; сетевой сбой — исключение с `err.retryable = true` (тогда вся пачка остаётся в очереди). Локальный транспорт синхронный, поэтому `submit` в демо сразу возвращает сохранённое событие — вызывающий код страниц не меняет логику.

- [ ] **Step 1: Write the failing test**

`tests/sync.test.js`:

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
function setup({ online = true } = {}) {
  const store = KK.createStore({ storage: memStorage(), clock: () => NOW });
  store.reset();
  const local = KK.syncLocalTransport(store);
  const net = { online };
  const transport = { send(items) { if (!net.online) { const e = new Error('offline'); e.retryable = true; throw e; } return local.send(items); } };
  const timers = [];
  const storage = memStorage();
  const sync = KK.createSync({ storage, transport, channel: 'max', schedule: (fn, ms) => timers.push(ms) });
  return { store, sync, net, timers, storage, transport };
}

test('online submit stores the event with channel and clientId and returns it', () => {
  const { store, sync } = setup();
  const e = sync.submit('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 });
  assert.equal(e.channel, 'max');
  assert.ok(e.clientId);
  assert.ok(store.events('p_olga').some((x) => x.id === e.id));
  assert.equal(sync.pending(), 0);
});

test('offline submit is queued, survives a reload and is sent once on flush', () => {
  const { store, sync, net, timers, storage, transport } = setup({ online: false });
  const r = sync.submit('p_olga', 'dose', { slot: 'утро', taken: true });
  assert.equal(r.pending, true);
  assert.equal(sync.pending('p_olga'), 1);
  assert.deepEqual(timers, [2000]);
  const reloaded = KK.createSync({ storage, transport, channel: 'max', schedule: () => {} });
  assert.equal(reloaded.pending(), 1);
  const before = store.events('p_olga', 'dose').length;
  net.online = true;
  assert.deepEqual(reloaded.flush(), { sent: 1, pending: 0 });
  reloaded.flush();
  assert.equal(store.events('p_olga', 'dose').length, before + 1);
});

test('retry delay doubles up to 60 seconds', () => {
  const fns = []; const delays = [];
  const offline = { send() { const e = new Error('offline'); e.retryable = true; throw e; } };
  const sync = KK.createSync({ storage: memStorage(), transport: offline, schedule: (fn, ms) => { fns.push(fn); delays.push(ms); return fns.length; } });
  sync.submit('p_olga', 'dose', { slot: 'утро', taken: true });
  for (let i = 0; i < 6; i++) fns[i](); // каждый срабатывший таймер снова не может отправить
  assert.deepEqual(delays, [2000, 4000, 8000, 16000, 32000, 60000, 60000]);
});

test('SOS never waits in the queue: offline it throws so the page can say so', () => {
  const { sync } = setup({ online: false });
  assert.throws(() => sync.submit('p_olga', 'sos', { source: 'patient_button' }), (e) => e.offline === true);
  assert.equal(sync.pending(), 0);
});

test('a scale answer that raises a critical signal is urgent', () => {
  assert.equal(KK.syncIsUrgent('scale', { scaleId: 'phq9', answers: [0, 0, 0, 0, 0, 0, 0, 0, 1] }), true);
  assert.equal(KK.syncIsUrgent('scale', { scaleId: 'phq9', answers: [0, 0, 0, 0, 0, 0, 0, 0, 0] }), false);
  assert.equal(KK.syncIsUrgent('checkin', {}), false);
});

test('validation errors from the store reach the caller and are not queued', () => {
  const { sync } = setup();
  assert.throws(() => sync.submit('p_olga', 'dose', { slot: 'утро', taken: true }, { at: '2026-10-18T12:00:00.000Z' }), /Задним числом/);
  assert.equal(sync.pending(), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sync.test.js`
Expected: FAIL — `KK.syncLocalTransport is not a function`.

- [ ] **Step 3: Write minimal implementation**

`assets/sync.js`:

```js
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
```

In `tests/load.js`, add `'assets/sync.js',` right after `'assets/host.js',`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/sync.test.js` → PASS, 6 tests; `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add assets/sync.js tests/sync.test.js tests/load.js
git commit -m "feat(sync): outbox with idempotency keys, backoff and urgent bypass"
```

---

### Task 6: Страницы пациента пишут через `KK.sync`

**Files:**
- Modify: `patient/*.html` (подключить `sync.js`), `patient/today.js:88,267`, `patient/therapy.js:47,54`, `patient/scale.js:45`, `patient/help.js:40`, `patient/intake.js:150,159,168`
- Modify: `assets/patient.js` (строка статуса), `assets/patient.css`
- Test: `tests/patient.test.js` (дописать)

- [ ] **Step 1: Write the failing test** — в конец `tests/patient.test.js`:

```js
test('patient pages write events only through KK.sync', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '..', 'patient');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(dir, f), 'utf8'), /store\.addEvent\(/, f);
  }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    assert.match(fs.readFileSync(path.join(dir, f), 'utf8'), /assets\/sync\.js/, f);
  }
});

test('sync note text never promises delivery', () => {
  const t = KK.patientApp.SYNC_PENDING;
  assert.match(t, /отправится/);
  assert.doesNotMatch(t, /сразу|мгновенно/);
});
```

(Если в `tests/patient.test.js` ещё нет `require('./load')` и `const KK = globalThis.KK;` — они там есть, файл уже тестирует `KK.patientApp`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/patient.test.js`
Expected: FAIL — `store.addEvent(` найден в `today.js`.

- [ ] **Step 3: Implement**

1. Подключить `sync.js` после `host.js` во всех страницах пациента:

```bash
sed -i 's#<script src="../assets/host.js"></script>#<script src="../assets/host.js"></script><script src="../assets/sync.js"></script>#' patient/*.html
```

2. Заменить вызовы (сигнатура та же: `(patientId, type, payload, opts)`):

```bash
sed -i 's/store\.addEvent(/KK.sync.submit(/g' patient/today.js patient/therapy.js patient/scale.js patient/intake.js patient/help.js
```

3. `patient/help.js` — SOS без связи. Заменить обработчик строки 40:

```js
    if (e.target.closest('[data-sos]')) {
      try { KK.sync.submit(ctx.pid, 'sos', { source: 'patient_button' }); sent = true; failed = false; } catch (err) { failed = true; }
      render();
    }
```

рядом с `let sent = fromPhq || fromIntake;` добавить `let failed = false;`, а в разметке блока `tile aura aura--sand` перед кнопкой `data-sos` вывести при сбое:

```js
${failed ? '<p role="alert"><b>Сообщение не отправлено.</b> Нет связи. Если опасно сейчас — звоните 112.</p>' : ''}
```

(вставить в ветку `: \`` — перед `<p>Можно сообщить врачу…`).

4. `patient/scale.js` `finish()` и `patient/intake.js` (C-SSRS): результат может быть «в очереди» (`{ pending: true, payload }`) — код читает только `e.payload`, это работает. Но ответ, поднимающий критический сигнал, без связи бросает исключение (`err.offline`): тогда сразу экран помощи без слов «ответы переданы».
   - `patient/scale.js`, в `finish()` строку `const e = KK.sync.submit(ctx.pid, 'scale', { scaleId: id, answers });` заменить на:

```js
    let e;
    try { e = KK.sync.submit(ctx.pid, 'scale', { scaleId: id, answers }); } catch (err) {
      if (!err.offline) throw err;
      KK.host.guardClose(false);
      location.replace('help.html'); // экран помощи с 112 — без обещания, что ответы дошли
      return;
    }
```

   - `patient/intake.js`, в ветке C-SSRS строку `const e = KK.sync.submit(ctx.pid, 'scale', { scaleId: 'cssrs', answers: full, context: 'intake' });` заменить на:

```js
      let e;
      try { e = KK.sync.submit(ctx.pid, 'scale', { scaleId: 'cssrs', answers: full, context: 'intake' }); } catch (err) {
        if (!err.offline) throw err;
        KK.host.guardClose(false);
        location.replace('help.html');
        return;
      }
```

5. `assets/patient.js` — строка статуса. В объект `app` добавить константу и метод, а в `start()` — элемент в шапке:

```js
    SYNC_PENDING: 'Сохранено на телефоне, отправится при появлении связи',
    syncNote(pid) {
      const el = document.querySelector('.sync-note');
      if (!el || !KK.sync) return;
      const n = KK.sync.pending(pid);
      el.hidden = n === 0;
      el.textContent = n ? app.SYNC_PENDING : '';
    },
```

в `start()` строку `top.innerHTML = ...` заменить на

```js
      top.innerHTML = `<span class="brand" aria-hidden="true">Компас</span><span class="sync-note" role="status" hidden></span><div class="tools">${fab}${KK.theme ? KK.theme.toggleHtml() : ''}</div>`;
```

и перед `return { pid, ... }` добавить

```js
      if (KK.sync) { KK.sync.subscribe(() => app.syncNote(pid)); KK.sync.flush(); app.syncNote(pid); }
```

6. `assets/patient.css` — в конец:

```css
/* Строка «отправится при появлении связи»: спокойная, без тревожного цвета */
.p-top .sync-note{flex:1;min-width:0;font-size:12px;color:var(--text-2);text-align:center;overflow-wrap:anywhere}
```

- [ ] **Step 4: Run tests**

Run: `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(patient): write events through KK.sync, show pending note, SOS reports offline"
```

---

### Task 7: Пакет переноса `kompas-bundle v1`

**Files:**
- Create: `assets/bundle.js`
- Modify: `tests/load.js` (добавить `'assets/bundle.js'` после `'assets/sync.js'`)
- Test: `tests/bundle.test.js`

- [ ] **Step 1: Write the failing test**

`tests/bundle.test.js`:

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

test('export has the format, rules version, channels, consents and events but no secrets', () => {
  const s = mk();
  s.linkChannel('p_olga', 'max');
  s.recordConsents('p_olga', ['data_processing']);
  s.createLinkCode('p_olga');
  const b = KK.bundle.exportBundle(s, 'p_olga', NOW);
  assert.equal(b.format, 'kompas-bundle');
  assert.equal(b.version, 1);
  assert.equal(b.rulesVersion, '2026.10.1');
  assert.deepEqual(b.channels.map((c) => Object.keys(c).sort()), [['channel', 'linkedAt']]);
  assert.equal(b.consents[0].kind, 'data_processing');
  assert.ok(b.events.length > 0);
  const text = JSON.stringify(b);
  assert.doesNotMatch(text, /inviteCode|KMP-|linkCodes|fingerprint/);
});

test('import into another store gives the same events and plan; repeat import adds nothing', () => {
  const s = mk();
  s.addEvent('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 }, { clientId: 'cl_7', channel: 'max' });
  const b = KK.bundle.exportBundle(s, 'p_olga', NOW);
  const target = mk();
  const moved = JSON.parse(JSON.stringify(b));
  moved.patient.id = 'p_moved';
  assert.equal(KK.bundle.importBundle(target, JSON.stringify(moved)), 'p_moved');
  assert.equal(target.events('p_moved').length, b.events.length);
  assert.deepEqual(target.patient('p_moved').plan, s.patient('p_olga').plan);
  KK.bundle.importBundle(target, moved);
  assert.equal(target.events('p_moved').length, b.events.length);
});

test('unknown format or version is rejected without changes', () => {
  const s = mk();
  const before = s.patients().length;
  assert.throws(() => KK.bundle.importBundle(s, { format: 'other', version: 1 }), /не пакет/);
  assert.throws(() => KK.bundle.importBundle(s, { format: 'kompas-bundle', version: 2, patient: { id: 'x' }, events: [] }), /Версия пакета 2/);
  assert.throws(() => KK.bundle.importBundle(s, '{oops'), /прочитать/);
  assert.equal(s.patients().length, before);
});

test('file name is stable and safe', () => {
  assert.equal(KK.bundle.fileName('p_olga', NOW), 'kompas-p_olga-2026-10-19.json');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bundle.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'exportBundle')`.

- [ ] **Step 3: Write minimal implementation**

`assets/bundle.js`:

```js
// Пакет переноса kompas-bundle v1: переезд пациента между платформами и выдача данных пациенту (152-ФЗ).
// В пакете нет кода приглашения, внешних id каналов, кодов переезда и алертов (алерты пересчитываются из событий).
(function (g) {
  const KK = g.KK = g.KK || {};
  const FORMAT = 'kompas-bundle';
  const VERSION = 1;
  const PRIVATE_KEYS = ['inviteCode', 'channels', 'consents'];

  function exportBundle(store, patientId, now = new Date()) {
    const s = store.snapshot(patientId);
    const patient = Object.fromEntries(Object.entries(s.patient).filter(([k]) => !PRIVATE_KEYS.includes(k)));
    return {
      format: FORMAT,
      version: VERSION,
      exportedAt: now.toISOString(),
      rulesVersion: KK.data && KK.data.rulesVersion ? KK.data.rulesVersion.id : null,
      patient,
      channels: (s.patient.channels || []).filter((c) => !c.revokedAt).map((c) => ({ channel: c.channel, linkedAt: c.linkedAt })),
      consents: (s.patient.consents || []).map((c) => ({ kind: c.kind, at: c.at, version: c.version })),
      events: s.events,
      messages: s.messages,
      decisions: s.audit.map((a) => ({ id: a.id, kind: a.action, at: a.at, by: a.actor, details: a.details || {} })),
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
    return store.restore({ patient, events: b.events, messages: b.messages || [], audit });
  }

  KK.bundle = {
    FORMAT,
    VERSION,
    exportBundle,
    importBundle,
    fileName: (pid, now = new Date()) => `kompas-${String(pid).replace(/[^A-Za-z0-9_-]/g, '')}-${now.toISOString().slice(0, 10)}.json`,
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

In `tests/load.js`, add `'assets/bundle.js',` right after `'assets/sync.js',`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/bundle.test.js` → PASS, 4 tests; `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add assets/bundle.js tests/bundle.test.js tests/load.js
git commit -m "feat(bundle): kompas-bundle v1 export and import without secrets"
```

---

### Task 8: Пациент — каналы, переезд на сайт, скачивание данных, приглашение по ссылке

**Files:**
- Modify: `patient/profile.html`, `patient/onboarding.html` (подключить `bundle.js` после `sync.js`)
- Modify: `assets/patient.js` (`link`, привязка текущего канала)
- Modify: `patient/profile.js`, `patient/onboarding.js`, `assets/patient.css`
- Test: `tests/patient.test.js` (дописать)

- [ ] **Step 1: Write the failing test** — в конец `tests/patient.test.js`:

```js
test('invite code is read from the MAX start parameter', () => {
  assert.equal(KK.patientApp.inviteFromStart('inv_KMP-7302'), 'KMP-7302');
  assert.equal(KK.patientApp.inviteFromStart('inv_kmp-7302'), 'KMP-7302');
  assert.equal(KK.patientApp.inviteFromStart('other'), null);
  assert.equal(KK.patientApp.inviteFromStart(null), null);
});

test('site move copy is calm and does not mention scores', () => {
  for (const t of KK.patientApp.MOVE_COPY) {
    assert.doesNotMatch(t, /балл|тяж|!/i, t);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/patient.test.js`
Expected: FAIL — `KK.patientApp.inviteFromStart is not a function`.

- [ ] **Step 3: Implement**

1. Подключить пакет на двух страницах:

```bash
sed -i 's#<script src="../assets/sync.js"></script>#&<script src="../assets/bundle.js"></script>#' patient/profile.html patient/onboarding.html
```

2. `assets/patient.js` — в объект `app`:

```js
    // Ссылка врача в MAX: max.ru/<бот>?startapp=inv_KMP-7302 → код приглашения KMP-7302 (в демо код = токен).
    inviteFromStart: (sp) => { const m = /^inv_([A-Za-z]{3}-\d{4})$/.exec(sp || ''); return m ? m[1].toUpperCase() : null; },
    MOVE_COPY: [
      'Открыть дневник на сайте',
      'Откройте на компьютере адрес ниже и введите код. Код действует 10 минут и подходит один раз.',
      'История отметок останется прежней.',
      'У меня есть код из приложения',
      'Введите шесть цифр, которые показаны в приложении в разделе «Профиль».',
    ],
```

`link(pid)` заменить на привязку и текущего канала:

```js
    link(pid) {
      LS.set(`kk:linked:${pid}`, true);
      try { KK.store.linkChannel(pid, KK.host.platform); } catch (e) { /* канал уже есть или стор недоступен */ }
    },
```

В `start()` после проверки `requireLink` добавить (демо-пациенты, подключённые до появления каналов, получают текущий канал):

```js
      if (app.linked(pid) && KK.store.channels(pid).length === 0) { try { KK.store.linkChannel(pid, KK.host.platform); } catch (e) { /* */ } }
```

3. `patient/onboarding.js`:
   - после `const state = {...}` добавить предзаполнение из ссылки MAX и режим сайта:

```js
  const fromLink = patientApp.inviteFromStart(KK.host.startParam());
  if (fromLink) state.code = fromLink;
  const C = patientApp.MOVE_COPY;
  if (ui.param('site') === '1') step = 'site';
```

   - в `view()` первой веткой:

```js
    if (step === 'site') return `
      <section class="stack-l" style="padding-top:8vh">
        <h1>${ui.esc(C[3])}</h1>
        <p class="muted">${ui.esc(C[4])}</p>
        <label class="field"><span class="hint">Код</span>
          <input id="site-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label>
        <p class="hint" id="err" role="alert"></p>
        <button class="btn btn--pill btn--block" data-redeem>Продолжить</button>
        ${helpLink}
      </section>`;
```

   - в ветке `step === 1` после кнопки `data-check` добавить ссылку `<button class="btn btn--ghost btn--block" data-site>${ui.esc(C[3])}</button>`;
   - в обработчик кликов:

```js
    if (e.target.closest('[data-site]')) { step = 'site'; render(); return; }
    if (e.target.closest('[data-redeem]')) {
      const code = document.getElementById('site-code').value.replace(/\D/g, '');
      try {
        const pid = store.redeemLinkCode(code, 'web');
        try { localStorage.setItem(`kk:linked:${pid}`, 'true'); } catch (err) { /* приватный режим */ }
        location.href = `index.html?p=${encodeURIComponent(pid)}`;
      } catch (err) { document.getElementById('err').textContent = err.message; }
      return;
    }
```

   - в ветке `[data-done]` перед `patientApp.link(ctx.pid);` добавить `store.recordConsents(ctx.pid, ['data_processing', 'doctor_access', 'not_emergency']);`.

4. `patient/profile.js` — состояние и разметка. После `if (!ctx) return;` добавить:

```js
  const C = app.MOVE_COPY;
  let linkCode = null; let exported = '';
  const siteUrl = () => new URL('onboarding.html?site=1', location.href).href;
```

В `render()` перед строкой `const theme = ...` добавить `const chans = store.channels(p.id);`, а секцию «Данные» заменить на:

```js
        <section class="card stack"><p class="q-title">Где открыт дневник</p>
          ${chans.map((c) => `<div class="row-between"><span>${ui.esc(KK.host.LABELS[c.channel] || c.channel)}${c.channel === KK.host.platform ? ' <span class="hint">· здесь</span>' : ''}</span>${c.channel !== KK.host.platform ? `<button class="btn btn--ghost" data-unlink="${ui.esc(c.channel)}">Отключить</button>` : ''}</div>`).join('') || '<p class="hint">Пока нигде</p>'}
          <button class="btn btn--block" data-move>${ui.esc(C[0])}</button>
          ${linkCode ? `<div class="move-code stack" role="status"><p>${ui.esc(C[1])}</p><p class="hint">${ui.esc(siteUrl())}</p>
            <p class="link-code" aria-label="Код ${linkCode.code.split('').join(' ')}">${linkCode.code}</p><p class="hint">${ui.esc(C[2])}</p>
            <button class="btn btn--ghost" data-open-site>Открыть ссылку</button></div>` : ''}</section>
        <section class="card stack"><p class="q-title">Данные</p>
          <p class="hint">Ваши отметки видит только ваш лечащий врач. Вы можете отозвать согласие, написав врачу.</p>
          <button class="btn btn--block" data-export>Скачать мои данные</button>
          ${exported ? `<p class="hint">Здесь файл не скачивается. Скопируйте текст и сохраните его.</p><textarea class="bundle-text" readonly rows="6">${ui.esc(exported)}</textarea><button class="btn btn--ghost" data-copy>Скопировать</button>` : ''}</section>
```

В обработчик кликов (в начало):

```js
    if (e.target.closest('[data-move]')) { linkCode = store.createLinkCode(ctx.pid); render(); return; }
    if (e.target.closest('[data-open-site]')) { KK.host.openLink(siteUrl()); return; }
    const un = e.target.closest('[data-unlink]');
    if (un) { store.unlinkChannel(ctx.pid, un.dataset.unlink); render(); return; }
    if (e.target.closest('[data-export]')) {
      const text = JSON.stringify(KK.bundle.exportBundle(store, ctx.pid), null, 2);
      if (KK.host.download(KK.bundle.fileName(ctx.pid), text)) app.toast('Файл сохранён'); else { exported = text; render(); }
      return;
    }
    if (e.target.closest('[data-copy]')) {
      const ta = document.querySelector('.bundle-text');
      ta.select();
      (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => app.toast('Скопировано'), () => app.toast('Выделите текст и скопируйте вручную'));
      return;
    }
```

5. `assets/patient.css` — в конец:

```css
.move-code{background:var(--surface-2);border-radius:14px;padding:12px 14px}
.link-code{font-size:32px;font-weight:300;letter-spacing:.18em;font-variant-numeric:tabular-nums;margin:0}
.bundle-text{width:100%;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:8px}
```

- [ ] **Step 4: Run tests**

Run: `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(patient): channels in profile, move to site by one-time code, download my data, invite from MAX link"
```

---

### Task 9: Кабинет врача — канал в ленте и экспорт

**Files:**
- Modify: `doctor/patient.html` (подключить `bundle.js` после `host.js`), `doctor/patient.js`
- Test: `tests/doctor.test.js` (дописать)

- [ ] **Step 1: Write the failing test** — в конец `tests/doctor.test.js`:

```js
test('channel label for the event feed', () => {
  assert.equal(D().channelLabel({ channel: 'max' }), ' · MAX');
  assert.equal(D().channelLabel({ channel: 'max-chat' }), ' · чат MAX');
  assert.equal(D().channelLabel({}), '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/doctor.test.js`
Expected: FAIL — `D(...).channelLabel is not a function`.

- [ ] **Step 3: Implement**

1. `assets/doctor.js` — в объект `app` (рядом с `auditLabel`):

```js
    // Откуда пришла отметка — для ленты событий; события без канала (демо-история) без подписи.
    channelLabel: (e) => {
      const L = { max: 'MAX', 'max-chat': 'чат MAX', telegram: 'Telegram', web: 'сайт' };
      return e && L[e.channel] ? ` · ${L[e.channel]}` : '';
    },
```

2. `doctor/patient.html`: `sed -i 's#<script src="../assets/host.js"></script>#&<script src="../assets/bundle.js"></script>#' doctor/patient.html`.

3. `doctor/patient.js`:
   - в ленте событий (строка с `<ul class="feed">${feed.map(...)`) заменить `<time>${ui.fmtDateTime(e.at)}</time>` на `<time>${ui.fmtDateTime(e.at)}${ui.esc(D.channelLabel(e))}</time>`;
   - в ряд кнопок после `<a class="btn btn--ghost" href="messages.html?id=${id}">Написать пациенту</a>` добавить `<button class="btn btn--ghost" data-export>Экспорт данных</button>`;
   - обработчик клика в конце файла (перед финальным вызовом отрисовки):

```js
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-export]');
    if (!b) return;
    const text = JSON.stringify(KK.bundle.exportBundle(store, id), null, 2);
    // Диалоги в песочнице ссылки-демо заблокированы — сообщаем на самой кнопке.
    if (!KK.host.download(KK.bundle.fileName(id), text)) b.textContent = 'Скачивание недоступно в этом окне';
  });
```

- [ ] **Step 4: Run tests**

Run: `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(doctor): event channel in the feed and patient data export"
```

---

### Task 10: Шаблоны бота MAX и API-контракт

**Files:**
- Create: `data/bot-messages.js`, `docs/api/openapi.yaml`, `docs/api/README.md`
- Modify: `tests/load.js` (добавить `'data/bot-messages.js'` после `'data/cto.js'`)
- Test: `tests/api.test.js`

- [ ] **Step 1: Write the failing test**

`tests/api.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./load');
const KK = globalThis.KK;

test('bot messages: no drug, diagnosis or scores on the lock screen; known button types', () => {
  const drugs = Object.values(KK.data.drugs).flatMap((d) => [d.name, d.inn]).filter(Boolean);
  for (const m of KK.data.botMessages) {
    for (const d of drugs) assert.ok(!m.text.toLowerCase().includes(d.toLowerCase()), `${m.id}: ${d}`);
    assert.doesNotMatch(m.text, /F\d\d|балл|PHQ|GAD|тревожн|депресс/i, m.id);
    for (const b of m.buttons) assert.ok(['callback', 'open_app'].includes(b.type), `${m.id}: ${b.type}`);
  }
  assert.deepEqual(KK.data.botMessages.map((m) => m.id), ['dose_reminder', 'checkin_reminder', 'doctor_reply']);
});

test('OpenAPI contract lists every endpoint from the spec', () => {
  const y = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi.yaml'), 'utf8');
  assert.match(y, /^openapi: 3\.1\.0/m);
  for (const p of ['/v1/auth/max:', '/v1/auth/telegram:', '/v1/invites/{token}:redeem:', '/v1/link-codes:', '/v1/link-codes:redeem:',
    '/v1/patients/{id}/channels:', '/v1/patients/{id}/channels/{channel}:', '/v1/patients/{id}/events:batch:', '/v1/patients/{id}/events:', '/v1/patients/{id}/export:', '/v1/max/webhook:']) {
    assert.ok(y.includes(`  ${p}`), p);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/api.test.js`
Expected: FAIL — `KK.data.botMessages` undefined.

- [ ] **Step 3: Implement**

`data/bot-messages.js`:

```js
// Сообщения бота MAX в чате (сервер вне демо). Уведомление видно на заблокированном экране:
// без названия препарата, диагноза и баллов. Кнопки: callback (событие message_callback на сервер) и open_app (мини-приложение).
(function (g) {
  g.KK.data.botMessages = [
    { id: 'dose_reminder', when: 'по плану приёма: утро и вечер', text: 'Время принять лекарство по назначению врача.',
      buttons: [{ type: 'callback', text: 'Принял', payload: 'dose_taken' }, { type: 'open_app', text: 'Открыть дневник' }] },
    { id: 'checkin_reminder', when: 'раз в день во время, которое выбрал пациент', text: 'Как вы сегодня? Это займёт минуту.',
      buttons: [{ type: 'open_app', text: 'Отметить' }] },
    { id: 'doctor_reply', when: 'новое сообщение врача', text: 'Врач ответил вам.',
      buttons: [{ type: 'open_app', text: 'Открыть переписку' }] },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
```

`docs/api/openapi.yaml`:

```yaml
openapi: 3.1.0
info:
  title: Клинический компас — API платформы
  version: 0.1.0
  description: |
    Контракт сервера для мини-приложений MAX и Telegram и веб-кабинетов. Сервер — источник истины.
    Пациент видит только свои данные; врач и психолог — пациентов по связи care_relations.
    Спек: docs/superpowers/specs/2026-10-21-max-messenger-design.md.
servers:
  - url: https://api.example.ru
security:
  - session: []
paths:
  /v1/auth/max:
    post:
      summary: Вход из мини-приложения MAX
      description: |
        Сервер проверяет initData: secret = HMAC-SHA256(key "WebAppData", msg BOT_TOKEN);
        подпись = hex(HMAC-SHA256(secret, пары без hash, отсортированные по ключу, через \n)); auth_date не старше 3600 с.
        initDataUnsafe не используется. Эталон: tools/max-initdata.js.
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [initData], properties: { initData: { type: string } } }
      responses:
        '200': { description: Сессия, content: { application/json: { schema: { $ref: '#/components/schemas/Session' } } } }
        '401': { description: Неверная подпись или устаревшая auth_date }
  /v1/auth/telegram:
    post:
      summary: Вход из Telegram Mini App (та же схема, ключ по правилам Telegram)
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [initData], properties: { initData: { type: string } } }
      responses:
        '200': { description: Сессия, content: { application/json: { schema: { $ref: '#/components/schemas/Session' } } } }
        '401': { description: Неверная подпись }
  /v1/invites/{token}:redeem:
    post:
      summary: Погасить приглашение врача (startapp=inv_<token>), привязать канал
      parameters:
        - { name: token, in: path, required: true, schema: { type: string, pattern: '^[A-Za-z0-9_-]{8,64}$' } }
      responses:
        '200': { description: Канал привязан, content: { application/json: { schema: { $ref: '#/components/schemas/Channel' } } } }
        '410': { description: Приглашение использовано или истекло (72 часа) }
  /v1/link-codes:
    post:
      summary: Создать код переезда на сайт (6 цифр, 10 минут, одно гашение)
      responses:
        '201':
          description: Код
          content:
            application/json:
              schema: { type: object, properties: { code: { type: string, pattern: '^\d{6}$' }, expiresAt: { type: string, format: date-time } } }
  /v1/link-codes:redeem:
    post:
      summary: Погасить код на сайте — привязать веб-канал к тому же пациенту
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [code], properties: { code: { type: string, pattern: '^\d{6}$' } } }
      responses:
        '200': { description: Сессия веб-кабинета, content: { application/json: { schema: { $ref: '#/components/schemas/Session' } } } }
        '404': { description: Код не найден }
        '410': { description: Код использован или истёк }
        '429': { description: Слишком много попыток с одного адреса }
  /v1/patients/{id}/channels:
    get:
      summary: Подключённые каналы пациента
      parameters: [{ $ref: '#/components/parameters/PatientId' }]
      responses:
        '200': { description: Каналы, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Channel' } } } } }
  /v1/patients/{id}/channels/{channel}:
    delete:
      summary: Отключить канал (история остаётся)
      parameters:
        - { $ref: '#/components/parameters/PatientId' }
        - { name: channel, in: path, required: true, schema: { $ref: '#/components/schemas/ChannelName' } }
      responses:
        '204': { description: Отключён }
  /v1/patients/{id}/events:batch:
    post:
      summary: Пакет событий из очереди клиента; повтор с тем же clientId не создаёт дубль
      parameters: [{ $ref: '#/components/parameters/PatientId' }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [events], properties: { events: { type: array, maxItems: 100, items: { $ref: '#/components/schemas/EventIn' } } } }
      responses:
        '200':
          description: Результат по каждому событию
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    clientId: { type: string }
                    status: { type: string, enum: [accepted, duplicate, rejected] }
                    reason: { type: string }
                    event: { $ref: '#/components/schemas/Event' }
  /v1/patients/{id}/events:
    get:
      summary: События после отметки времени (кабинеты, второй канал пациента)
      parameters:
        - { $ref: '#/components/parameters/PatientId' }
        - { name: since, in: query, schema: { type: string, format: date-time } }
      responses:
        '200': { description: События, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Event' } } } } }
  /v1/patients/{id}/export:
    get:
      summary: Пакет kompas-bundle v1 (переезд, право пациента на свои данные)
      parameters: [{ $ref: '#/components/parameters/PatientId' }]
      responses:
        '200': { description: Пакет, content: { application/json: { schema: { $ref: '#/components/schemas/Bundle' } } } }
  /v1/max/webhook:
    post:
      summary: Обновления бота MAX (message_callback от кнопки «Принял», bot_started)
      description: Подписка через POST /subscriptions Bot API MAX. Типы обновлений сверить с dev.max.ru/docs-api.
      security: [{ webhookSecret: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, additionalProperties: true }
      responses:
        '200': { description: Принято }
components:
  securitySchemes:
    session: { type: http, scheme: bearer }
    webhookSecret: { type: apiKey, in: header, name: X-Webhook-Secret }
  parameters:
    PatientId: { name: id, in: path, required: true, schema: { type: string } }
  schemas:
    ChannelName: { type: string, enum: [max, telegram, web] }
    Channel:
      type: object
      properties:
        channel: { $ref: '#/components/schemas/ChannelName' }
        linkedAt: { type: string, format: date-time }
    Session:
      type: object
      properties:
        token: { type: string }
        patientId: { type: [string, 'null'], description: null — пациент ещё не привязан, нужен код приглашения }
        expiresAt: { type: string, format: date-time }
    EventIn:
      type: object
      required: [clientId, type, payload]
      properties:
        clientId: { type: string, maxLength: 64 }
        type: { type: string, enum: [checkin, dose, scale, ae, sos, intake_form, cto] }
        at: { type: string, format: date-time, description: только для checkin, не раньше 7 дней }
        channel: { type: string, enum: [max, max-chat, telegram, web] }
        payload: { type: object, additionalProperties: true }
    Event:
      allOf:
        - $ref: '#/components/schemas/EventIn'
        - type: object
          properties:
            id: { type: string }
            recordedAt: { type: string, format: date-time }
    Bundle:
      type: object
      required: [format, version, patient, events]
      properties:
        format: { const: kompas-bundle }
        version: { const: 1 }
        exportedAt: { type: string, format: date-time }
        rulesVersion: { type: string }
        patient: { type: object, additionalProperties: true }
        channels: { type: array, items: { $ref: '#/components/schemas/Channel' } }
        consents: { type: array, items: { type: object, properties: { kind: { type: string }, at: { type: string }, version: { type: string } } } }
        events: { type: array, items: { $ref: '#/components/schemas/Event' } }
        messages: { type: array, items: { type: object } }
        decisions: { type: array, items: { type: object } }
```

`docs/api/README.md`:

```markdown
# API платформы «Клинический компас»

Контракт — [openapi.yaml](openapi.yaml) (OpenAPI 3.1). Сервер в демо не реализован; клиентская часть уже работает по этой модели:
очередь `assets/sync.js` (clientId — ключ идемпотентности), каналы и коды переезда в `assets/store.js`, пакет `assets/bundle.js`.

## Вход из MAX
1. Мини-приложение отправляет `WebApp.initData` на `POST /v1/auth/max`.
2. Сервер проверяет подпись по dev.max.ru/docs/webapps/validation. Эталон с тестами — `tools/max-initdata.js`.
3. Без привязки (`patientId: null`) пациент вводит код приглашения или открывает ссылку врача `https://max.ru/<бот>?startapp=inv_<токен>`.
   Токен одноразовый, 72 часа, без персональных данных.

## Переезд на сайт
`POST /v1/link-codes` (из мини-приложения) → 6 цифр на 10 минут → `POST /v1/link-codes:redeem` на сайте → веб-канал у того же пациента.
Ограничить попытки гашения с одного адреса (ответ 429).

## Бот в чате MAX
Тексты и кнопки — `data/bot-messages.js` (проверяются тестом: без препарата, диагноза и баллов).
Bot API: `https://platform-api2.max.ru`, заголовок `Authorization: <token>`, `POST /messages`, клавиатура — вложение `inline_keyboard`.
Кнопка «Принял» (`callback`) приходит событием `message_callback` на `/v1/max/webhook` и создаёт событие `dose` с `channel: max-chat`.
Типы кнопок и событий сверить с официальной документацией перед реализацией.

## Хранение и доступ
Сервер и база — в РФ (152-ФЗ). Токен бота — только на сервере. Пациент видит только себя; врач и психолог — по `care_relations`.
```

In `tests/load.js`, add `'data/bot-messages.js',` right after `'data/cto.js',`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/api.test.js` → PASS; `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add data/bot-messages.js docs/api tests/api.test.js tests/load.js
git commit -m "docs(api): OpenAPI contract, MAX bot message templates"
```

---

### Task 11: Проверка в браузере, README, публикация

**Files:**
- Modify: `README.md` (раздел «MAX и перенос данных»)
- Modify: `tools/responsive-audit.js` (добавить страницу `'/patient/onboarding.html?site=1&p=p_olga'`)

- [ ] **Step 1: Полный прогон тестов**

Run: `npm test`
Expected: все тесты проходят, 0 fail.

- [ ] **Step 2: Браузер, режим «сайт»** (сервер `kompas`, `http://localhost:5180`):
  - на главной нажать «Сбросить демо»;
  - открыть `patient/profile.html?p=p_olga`: виден блок «Где открыт дневник» с «Сайт · здесь»; «Открыть дневник на сайте» показывает 6 цифр и адрес; «Скачать мои данные» скачивает `kompas-p_olga-<дата>.json`;
  - во второй вкладке открыть `patient/onboarding.html?site=1`, ввести код → открывается дневник Ольги; повторный ввод того же кода → «Этот код уже использован…»;
  - отметить самочувствие на `patient/index.html?p=p_olga` → в `doctor/patient.html?id=p_olga` в ленте событий время с подписью «· сайт»; кнопка «Экспорт данных» скачивает пакет;
  - консоль без ошибок (`read_console_messages` с `onlyErrors`).

- [ ] **Step 3: Браузер, имитация MAX.** Открыть `patient/index.html?p=p_olga`, в консоли выполнить:

```js
window.WebApp = { initData: 'auth_date=1&hash=x', initDataUnsafe: { start_param: 'inv_KMP-2648' }, BackButton: { show() {}, onClick() {} }, HapticFeedback: { impactOccurred() {} }, enableClosingConfirmation() {}, disableClosingConfirmation() {}, openLink(u) { console.log('openLink', u); } };
KK.host = KK.createHost(window);
KK.sync = KK.createSync({ storage: localStorage, transport: KK.syncLocalTransport(KK.store), channel: KK.host.platform });
KK.sync.submit('p_olga', 'checkin', { mood: 4, anxiety: 2, sleep: 3 }).channel;
```

Expected: `'max'`; в кабинете врача у новой отметки подпись «· MAX»; `KK.host.download('a.json','{}')` → `false`.

- [ ] **Step 4: Адаптивность.** Добавить в `PAGES` файла `tools/responsive-audit.js` строку `'/patient/onboarding.html?site=1&p=p_olga',`, в браузере подключить скрипт и выполнить `await kkAudit(320)`, `await kkAudit(375)`, `await kkAudit(768)` — каждый возвращает `[]`.

- [ ] **Step 5: README.** Добавить раздел:

```markdown
## MAX и перенос данных на сайт

Пациентская часть открывается в MAX (мост `st.max.ru/js/max-web-app.js`), Telegram и обычном браузере — различия в `assets/host.js`.
Отметки уходят через очередь `assets/sync.js`; без связи они ждут на устройстве, SOS без связи сообщает «не отправлено».
В профиле пациента — «Открыть дневник на сайте» (одноразовый код на 10 минут) и «Скачать мои данные» (пакет `kompas-bundle v1`).
Контракт сервера — `docs/api/`, эталон проверки подписи MAX — `tools/max-initdata.js`.
Чтобы открыть демо внутри MAX, разместите его по HTTPS и подключите мини-приложение в кабинете организации на платформе MAX.
```

- [ ] **Step 6: Commit**

```bash
git add README.md tools/responsive-audit.js
git commit -m "docs: MAX and data transfer section, audit covers the site code page"
```

- [ ] **Step 7: Слить и опубликовать.** `git checkout master && git merge --ff-only feat/max-messenger`; собрать `node tools/build-artifact.js <папка>` и опубликовать `kompas.html` с изменёнными файлами по прежней ссылке https://claude.ai/artifact/EVC1BfiboTRR9sNefYorPP (новые файлы: `assets/host.js`, `assets/sync.js`, `assets/bundle.js`, `data/bot-messages.js`; удалённый `assets/tg.js` передать как `null`).
