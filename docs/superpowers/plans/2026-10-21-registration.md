# Регистрация и вход для всех ролей — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На сайте есть общий вход (пациент — телефон + код; специалист — почта + пароль + второй фактор), регистрация пациента по приглашению врача с подтверждением телефона, регистрация врача/психолога/администратора по приглашению клиники, восстановление доступа и кабинет администратора клиники — всё на мок-данных, с честными демо-плашками.

**Architecture:** Чистые помощники (`assets/auth.js`: телефон, почта, надёжность пароля, сессия вкладки) и данные клиники в сторе (`assets/store.js`: сотрудники, приглашения, одноразовые коды, ссылки восстановления). Общая оболочка страниц входа (`assets/authpage.js` + `assets/auth.css`: две колонки на компьютере, одна на телефоне). Новые страницы `auth/login`, `auth/invite`, `auth/recover`, `admin/index`; доработка `patient/onboarding` (шаг телефона, левая панель в браузере). Кабинеты врача и психолога показывают вошедшего и «Выйти».

**Tech Stack:** ванильный JS ES2020, классические скрипты, общий `KK`, Node 24 `node --test`. Спек: `docs/superpowers/specs/2026-10-21-registration-design.md`.

**Репозиторий:** `C:\Users\user\Desktop\claude\klinicheskiy-kompas`, ветку `feat/registration` создать от `master` в первой задаче. Тесты: `npm test` (сейчас 301). Превью: `http://localhost:5180`.

**Правила кода:** короткие русские комментарии там, где неочевидно «почему»; весь пользовательский и внешний текст в HTML — через `ui.esc`; `localStorage`/`sessionStorage` — в `try/catch`; файлы с CRLF править инструментом Edit; пациентские тексты спокойные (без баллов, «!», обещаний мгновенного ответа). Коммиты заканчиваются строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Карта файлов

| Файл | Ответственность |
|---|---|
| Create `assets/auth.js` | `KK.auth`: `normalizePhone`, `maskPhone`, `normalizeEmail`, `validEmail`, `passwordCheck`, `createSession`, `session`, `staff(role)` |
| Modify `assets/store.js` | `db.clinic` (сотрудники, приглашения, коды, восстановление), телефон пациента |
| Modify `data/scenarios.js` | демо-телефон Ольги для входа |
| Modify `assets/host.js` | `requestPhone()` — номер из MAX |
| Create `assets/authpage.js`, `assets/auth.css` | оболочка страниц входа: две колонки, демо-плашка, ошибки, роль/палитра |
| Create `auth/login.html`+`.js`, `auth/invite.html`+`.js`, `auth/recover.html`+`.js` | вход, принятие приглашения, восстановление |
| Create `admin/index.html`+`.js` | кабинет администратора клиники |
| Modify `patient/onboarding.html`/`.js` | шаг «Телефон», левая панель в браузере |
| Modify `assets/doctor.js`, `assets/psych.js`, `doctor/*.html`, `psych/*.html` | вошедший сотрудник, режим по специальности, «Выйти» |
| Modify `index.html` | карточка «Вход на сайт» |
| Modify `tools/build-artifact.js`, `tools/responsive-audit.js`, `tests/build.test.js` | новые папки в сборке и аудите |
| Modify `docs/api/openapi.yaml`, `tests/api.test.js` | эндпоинты входа и приглашений |
| Create tests | `tests/auth.test.js`, `tests/clinic.test.js`, `tests/pages.test.js` |

Порядок скриптов на новых страницах (нужен стор): `kk.js`, `data/scales.js`, `data/drugs/classes.js`, `data/drugs/aviandr.js`, `data/rules/core.js`, `data/scenarios.js`, `data/intake.js`, `assets/scales.js`, `assets/therapy.js`, `assets/adherence.js`, `assets/rules.js`, `assets/battery.js`, `assets/parser.js`, `assets/store.js`, `assets/ui.js`, `assets/host.js`, `assets/auth.js`, `assets/authpage.js`, затем скрипт страницы.

---

### Task 1: Помощники `KK.auth`

**Files:**
- Create: `assets/auth.js`
- Modify: `tests/load.js` (добавить `'assets/auth.js',` после `'assets/store.js',`)
- Test: `tests/auth.test.js`

- [ ] **Step 0: Ветка**

```bash
git checkout -b feat/registration
```

- [ ] **Step 1: Write the failing test** — `tests/auth.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const A = () => KK.auth;

test('russian mobile numbers are normalized to +7XXXXXXXXXX', () => {
  for (const raw of ['8 (912) 345-67-89', '+7 912 345 67 89', '79123456789', '9123456789']) assert.equal(A().normalizePhone(raw), '+79123456789', raw);
  for (const bad of ['', '12345', '+1 202 555 0100', '8 800 2000-12']) assert.equal(A().normalizePhone(bad), null, bad);
  assert.equal(A().maskPhone('+79123456789'), '+7 912 •••-••-89');
});

test('emails are trimmed, lowercased and validated', () => {
  assert.equal(A().normalizeEmail('  Elena.Ivanova@Clinic.Demo '), 'elena.ivanova@clinic.demo');
  assert.equal(A().validEmail('a@b.ru'), true);
  for (const bad of ['', 'a@b', 'a b@c.ru', '@c.ru']) assert.equal(A().validEmail(bad), false, bad);
});

test('password check: length, digits only, common, contains email', () => {
  assert.equal(A().passwordCheck('short1').ok, false);
  assert.equal(A().passwordCheck('12345678901').ok, false);
  assert.equal(A().passwordCheck('Qwerty1234!').ok, false);
  assert.equal(A().passwordCheck('elena.ivanova-2026', 'elena.ivanova@clinic.demo').ok, false);
  const good = A().passwordCheck('Тихий-сад-у-реки-7');
  assert.equal(good.ok, true);
  assert.match(good.hint, /Надёжный/);
});

test('session lives in the given storage and survives bad JSON', () => {
  const m = new Map();
  const s = A().createSession({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) });
  assert.equal(s.get(), null);
  s.set({ kind: 'staff', staffId: 'd1', role: 'doctor' });
  assert.deepEqual(s.get(), { kind: 'staff', staffId: 'd1', role: 'doctor' });
  m.set(A().SESSION_KEY, '{oops');
  assert.equal(s.get(), null);
  s.clear();
  assert.equal(m.has(A().SESSION_KEY), false);
});
```

- [ ] **Step 2: Run** `node --test tests/auth.test.js` → FAIL (`Cannot read properties of undefined (reading 'normalizePhone')`).

- [ ] **Step 3: Implement** — `assets/auth.js`:

```js
// Помощники входа и регистрации: телефон, почта, надёжность пароля, сессия вкладки.
// В демо пароли нигде не сохраняются: при регистрации и смене проверяется только их надёжность.
(function (g) {
  const KK = g.KK = g.KK || {};
  const SESSION_KEY = 'kk:session';
  const COMMON = ['1234567890', '0987654321', 'qwerty', 'password', 'йцукен', 'пароль', '1q2w3e', 'qazwsx'];

  // Российский мобильный: 8…, 7…, +7… или 10 цифр с 9 — в формат +7XXXXXXXXXX.
  function normalizePhone(raw) {
    const d = String(raw || '').replace(/\D/g, '');
    const ten = d.length === 11 && (d[0] === '8' || d[0] === '7') ? d.slice(1) : d.length === 10 ? d : null;
    return ten && ten[0] === '9' ? `+7${ten}` : null;
  }
  const maskPhone = (p) => (p ? `${p.slice(0, 2)} ${p.slice(2, 5)} •••-••-${p.slice(-2)}` : '');
  const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(e));

  function passwordCheck(pw, email = '') {
    const s = String(pw || '');
    const low = s.toLowerCase();
    const local = normalizeEmail(email).split('@')[0];
    if (s.length < 10) return { ok: false, hint: 'Не короче 10 символов' };
    if (/^\d+$/.test(s)) return { ok: false, hint: 'Добавьте буквы: пароль только из цифр легко подобрать' };
    if (COMMON.some((c) => low.includes(c))) return { ok: false, hint: 'Слишком простой пароль, выберите другой' };
    if (local.length >= 3 && low.includes(local)) return { ok: false, hint: 'Пароль не должен содержать вашу почту' };
    const kinds = [/[a-zа-яё]/, /[A-ZА-ЯЁ]/, /\d/, /[^A-Za-zА-Яа-яЁё\d]/].filter((r) => r.test(s)).length;
    return { ok: true, hint: kinds >= 3 || s.length >= 14 ? 'Надёжный пароль' : 'Подойдёт. Длиннее или с цифрами и знаками — надёжнее' };
  }

  function createSession(storage) {
    return {
      get() { try { return JSON.parse(storage.getItem(SESSION_KEY)) || null; } catch (e) { return null; } },
      set(s) { try { storage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* приватный режим */ } },
      clear() { try { storage.removeItem(SESSION_KEY); } catch (e) { /* приватный режим */ } },
    };
  }

  KK.auth = { SESSION_KEY, normalizePhone, maskPhone, normalizeEmail, validEmail, passwordCheck, createSession };
  const ss = (() => { try { return g.sessionStorage || null; } catch (e) { return null; } })();
  KK.auth.session = ss ? createSession(ss) : null;
  // Вошедший через сайт сотрудник нужной роли (активный) — для подписи кабинета и режима подсказок врача.
  KK.auth.staff = (role) => {
    const s = KK.auth.session && KK.auth.session.get();
    if (!s || s.kind !== 'staff' || (role && s.role !== role) || !KK.store || !KK.store.staffById) return null;
    const st = KK.store.staffById(s.staffId);
    return st && st.status === 'active' ? st : null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

Добавить `'assets/auth.js',` в `tests/load.js` после `'assets/store.js',`.

- [ ] **Step 4: Run** `node --test tests/auth.test.js` → PASS (4); `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add assets/auth.js tests/auth.test.js tests/load.js
git commit -m "feat(auth): phone, email, password and session helpers"
```

---

### Task 2: Данные клиники в сторе

**Files:**
- Modify: `assets/store.js` (константы после `const DRAFT_PREFIX…`; `reset()` ~стр. 66; методы `api` перед `subscribe`)
- Modify: `data/scenarios.js:77` (телефон Ольги)
- Test: `tests/clinic.test.js`

- [ ] **Step 1: Write the failing test** — `tests/clinic.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const NOW = new Date('2026-10-21T12:00:00.000Z');
function mk() {
  const t = { now: NOW };
  const s = KK.createStore({ storage: memStorage(), clock: () => t.now });
  s.reset();
  return { s, t, later: (ms) => { t.now = new Date(t.now.getTime() + ms); } };
}

test('demo clinic has an admin, a doctor and a psychologist, all active', () => {
  const { s } = mk();
  assert.deepEqual(s.staff().map((x) => [x.email, x.role, x.status]), [
    ['admin@clinic.demo', 'admin', 'active'], ['elena.ivanova@clinic.demo', 'doctor', 'active'], ['maria.belova@clinic.demo', 'psychologist', 'active']]);
  assert.equal(s.staffByEmail(' Elena.Ivanova@clinic.demo ').id, 'd1');
});

test('invite: 72 hours, single use, creates an active staff member', () => {
  const { s, later } = mk();
  const inv = s.inviteStaff('New.Doc@Clinic.Demo', 'doctor');
  assert.match(inv.token, /^[A-Za-z0-9]{24}$/);
  assert.deepEqual(s.inviteInfo(inv.token), { state: 'pending', email: 'new.doc@clinic.demo', role: 'doctor', clinic: 'Клиника «Демо»', expiresAt: inv.expiresAt });
  const st = s.acceptInvite(inv.token, { name: 'Пётр Орлов', specialty: 'психиатр', phone: '+79123456789' });
  assert.equal(st.status, 'active');
  assert.equal(st.specialty, 'психиатр');
  assert.equal(s.inviteInfo(inv.token).state, 'used');
  assert.throws(() => s.acceptInvite(inv.token, { name: 'Пётр Орлов', specialty: 'психиатр', phone: '+79123456789' }), (e) => e.reason === 'used');
  const late = s.inviteStaff('late@clinic.demo', 'psychologist');
  later(72 * 3600000 + 1);
  assert.equal(s.inviteInfo(late.token).state, 'expired');
  assert.throws(() => s.acceptInvite(late.token, { name: 'Ира Котова', phone: '+79123450000' }), (e) => e.reason === 'expired');
});

test('invite: resend replaces the token, revoke blocks it, active email is refused', () => {
  const { s } = mk();
  const a = s.inviteStaff('x@clinic.demo', 'psychologist');
  const b = s.resendInvite(a.token);
  assert.notEqual(a.token, b.token);
  assert.equal(s.inviteInfo(a.token).state, 'revoked');
  s.revokeInvite(b.token);
  assert.equal(s.inviteInfo(b.token).state, 'revoked');
  assert.throws(() => s.inviteStaff('elena.ivanova@clinic.demo', 'doctor'), /уже есть/);
  assert.throws(() => s.inviteStaff('not-an-email', 'doctor'), /почты/);
  assert.equal(s.inviteInfo('nope').state, 'unknown');
});

test('psychologist and admin invites get a fixed specialty', () => {
  const { s } = mk();
  const p = s.acceptInvite(s.inviteStaff('p@clinic.demo', 'psychologist').token, { name: 'Ира Котова', specialty: 'психиатр', phone: '+79123450000' });
  assert.equal(p.specialty, 'клинический психолог');
});

test('one-time code: 6 digits, 5 minutes, 5 attempts, burns after success', () => {
  const { s, later } = mk();
  const { code } = s.requestOtp('+79123456789', 'patient_login');
  assert.match(code, /^\d{6}$/);
  const wrong = code === '000000' ? '111111' : '000000';
  assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', wrong), /Осталось попыток: 4/);
  assert.equal(s.verifyOtp('+79123456789', 'patient_login', code), true);
  assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', code), (e) => e.reason === 'missing');
  const second = s.requestOtp('+79123456789', 'patient_login').code;
  for (let i = 0; i < 4; i++) assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', second === '000000' ? '111111' : '000000'));
  assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', second === '000000' ? '111111' : '000000'), (e) => e.reason === 'attempts');
  assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', second), (e) => e.reason === 'attempts');
  const third = s.requestOtp('+79123456789', 'patient_login').code;
  later(5 * 60000 + 1);
  assert.throws(() => s.verifyOtp('+79123456789', 'patient_login', third), (e) => e.reason === 'expired');
});

test('patient phone: one number per patient; demo Olga has a phone', () => {
  const { s } = mk();
  assert.equal(s.findPatientByPhone('+79000002648'), 'p_olga');
  s.setPatientPhone('p_anna', '+79123456789');
  assert.equal(s.findPatientByPhone('+79123456789'), 'p_anna');
  assert.throws(() => s.setPatientPhone('p_dmitry', '+79123456789'), (e) => e.reason === 'taken');
});

test('staff login check: blocked or unknown is refused with one neutral message', () => {
  const { s } = mk();
  assert.equal(s.staffLoginCheck('elena.ivanova@clinic.demo').id, 'd1');
  s.setStaff('d1', { status: 'blocked' });
  assert.throws(() => s.staffLoginCheck('elena.ivanova@clinic.demo'), /Не получилось войти/);
  assert.throws(() => s.staffLoginCheck('nobody@clinic.demo'), /Не получилось войти/);
  s.setStaff('psy1', { frmrChecked: false });
  assert.equal(s.staffById('psy1').frmrChecked, false);
  assert.throws(() => s.setStaff('psy1', { role: 'admin' }), /Нельзя изменить/);
});

test('password reset link: 30 minutes, single use, silent for unknown email', () => {
  const { s, later } = mk();
  assert.equal(s.createReset('nobody@clinic.demo'), null);
  const r = s.createReset('maria.belova@clinic.demo');
  assert.equal(s.resetInfo(r.token).staffId, 'psy1');
  assert.equal(s.completeReset(r.token).id, 'psy1');
  assert.equal(s.resetInfo(r.token), null);
  assert.throws(() => s.completeReset(r.token), /недействительна/);
  const r2 = s.createReset('maria.belova@clinic.demo');
  later(30 * 60000 + 1);
  assert.equal(s.resetInfo(r2.token), null);
});

test('an old store without clinic data gets the demo clinic lazily', () => {
  const storage = memStorage();
  const s1 = KK.createStore({ storage, clock: () => NOW });
  s1.reset();
  const raw = JSON.parse(storage.getItem('kk:v1'));
  delete raw.clinic;
  storage.setItem('kk:v1', JSON.stringify(raw));
  const s2 = KK.createStore({ storage, clock: () => NOW });
  assert.equal(s2.staff().length, 3);
});
```

- [ ] **Step 2: Run** `node --test tests/clinic.test.js` → FAIL (`s.staff is not a function`).

- [ ] **Step 3: Implement**

`data/scenarios.js` строка 77: в `base({ id: 'p_olga', … })` добавить поле `phone: '+79000002648',` (после `inviteCode: 'KMP-2648',`).

`assets/store.js` — после `const DRAFT_PREFIX = 'kk:intake-draft:';`:

```js
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
```

В `reset()` в объект `db = { … inbox: [] }` добавить поле `clinic: seedClinic(now),`.

Внутри `createStore` после `function pushEvent(...) {...}` добавить:

```js
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
```

В объект `api` перед `subscribe(fn) {`:

```js
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
      findPatientByPhone: (phone) => (need(), Object.keys(db.patients).find((id) => db.patients[id].phone === phone) || null),
      setPatientPhone(id, phone) {
        need();
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
        r.usedAt = nowIso();
        write();
        return api.staffById(r.staffId);
      },
```

Важно: `clinic()` при ленивом создании меняет `db` без `write()` — это нормально, запись произойдёт при первой изменяющей операции; при чтении данные одинаковые.

- [ ] **Step 4: Run** `node --test tests/clinic.test.js` → PASS (9); `npm test` → все проходят. Если тест «phone» падает из-за `PROFILE_KEYS`/алертов — телефон в `PROFILE_KEYS` не добавлять.

- [ ] **Step 5: Commit**

```bash
git add assets/store.js data/scenarios.js tests/clinic.test.js
git commit -m "feat(store): clinic staff, invites, one-time codes, password reset, patient phone"
```

---

### Task 3: Номер телефона из MAX

**Files:**
- Modify: `assets/host.js` (новый метод в объекте `createHost`)
- Test: `tests/host.test.js` (дописать)

- [ ] **Step 1: Write the failing test** — в конец `tests/host.test.js`:

```js
test('requestPhone: MAX contact via callback or promise, otherwise null', async () => {
  const viaCb = KK.createHost({ WebApp: { initData: 'a=1', requestContact: (cb) => cb({ phone: '+7 912 345-67-89' }) } });
  assert.equal(await viaCb.requestPhone(), '+7 912 345-67-89');
  const viaPromise = KK.createHost({ WebApp: { initData: 'a=1', requestContact: () => Promise.resolve({ contact: { phone_number: '79123456789' } }) } });
  assert.equal(await viaPromise.requestPhone(), '79123456789');
  const refused = KK.createHost({ WebApp: { initData: 'a=1', requestContact: () => Promise.reject(new Error('no')) } });
  assert.equal(await refused.requestPhone(), null);
  assert.equal(await KK.createHost({ location: { search: '' } }).requestPhone(), null);
});
```

- [ ] **Step 2: Run** `node --test tests/host.test.js` → FAIL (`requestPhone is not a function`).

- [ ] **Step 3: Implement** — в `assets/host.js` над `function createHost(win)` добавить:

```js
  // Ответ requestContact в документации MAX не описан: ищем номер в строке или в типичных полях объекта.
  function pickPhone(v) {
    if (typeof v === 'string') return /\d{10}/.test(v.replace(/\D/g, '')) ? v : null;
    if (!v || typeof v !== 'object') return null;
    return pickPhone(v.phone) || pickPhone(v.phone_number) || pickPhone(v.contact) || null;
  }
```

и в объект, который возвращает `createHost`, после `initData: …,`:

```js
      // Номер телефона из мессенджера по согласию пользователя. Нет API, отказ или нет ответа 15 с — null:
      // тогда пациент вводит номер вручную.
      requestPhone() {
        if (!api || typeof api.requestContact !== 'function') return Promise.resolve(null);
        return new Promise((resolve) => {
          let settled = false;
          const finish = (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(pickPhone(v)); } };
          const timer = setTimeout(() => finish(null), 15000);
          try {
            const r = api.requestContact((v) => finish(v));
            if (r && typeof r.then === 'function') r.then(finish, () => finish(null));
          } catch (e) { finish(null); }
        });
      },
```

- [ ] **Step 4: Run** `node --test tests/host.test.js` → PASS; `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add assets/host.js tests/host.test.js
git commit -m "feat(host): request the phone number from MAX with manual fallback"
```

---

### Task 4: Оболочка страниц входа и страница «Вход»

**Files:**
- Create: `assets/authpage.js`, `assets/auth.css`, `auth/login.html`, `auth/login.js`
- Test: `tests/pages.test.js`

- [ ] **Step 1: Write the failing test** — `tests/pages.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const SCRIPTS = ['assets/store.js', 'assets/ui.js', 'assets/host.js', 'assets/auth.js', 'assets/authpage.js'];

// Страницы входа подключают стор, помощники и свою оболочку, а их скрипты синтаксически корректны.
function checkPage(html, js) {
  const h = read(html);
  for (const s of SCRIPTS) assert.match(h, new RegExp(`\\.\\./${s.replace('.', '\\.')}`), `${html}: ${s}`);
  assert.match(h, /assets\/auth\.css/, html);
  assert.match(h, new RegExp(`src="${path.basename(js)}"`), html);
  assert.doesNotThrow(() => new Function(read(js)), js);
}

test('login page is wired', () => checkPage('auth/login.html', 'auth/login.js'));
```

- [ ] **Step 2: Run** `node --test tests/pages.test.js` → FAIL (ENOENT `auth/login.html`).

- [ ] **Step 3: Implement**

`assets/authpage.js`:

```js
// Оболочка страниц входа, приглашения и восстановления: на компьютере — две колонки (о сервисе и форма),
// на телефоне — одна. Демо-плашка честно показывает код или ссылку, которые в настоящей версии придут по SMS или почте.
(function (g) {
  const KK = g.KK;
  const POINTS = ['Данные хранятся на серверах в России', 'Доступ — только у ваших лечащих специалистов', 'Вход с подтверждением по коду'];
  const ui = () => KK.ui;
  KK.authPage = {
    POINTS,
    layout(html) {
      return `<div class="auth"><aside class="auth__aside">
          <a class="auth__brand" href="../index.html">${ui().icon('route', 20)}<b>Компас</b></a>
          <div class="auth__pitch"><h2>Дневник самочувствия и кабинет специалиста</h2>
            <ul>${POINTS.map((p) => `<li>${ui().icon('check', 16)}<span>${ui().esc(p)}</span></li>`).join('')}</ul></div>
          <span class="hint auth__foot">Демо-прототип. Данные вымышлены</span></aside>
        <section class="auth__main"><div class="stack">${html}</div></section></div>`;
    },
    mount(html) { ui().mount('#app', KK.authPage.layout(html)); },
    demoNote: (text) => `<p class="demo-note" role="status"><b>Демо:</b> ${ui().esc(text)}</p>`,
    err: (id = 'err') => `<p class="auth-err" id="${id}" role="alert"></p>`,
    showErr(text, id = 'err') { const el = document.getElementById(id); if (el) el.textContent = text; },
    // Палитра: пациентская — спокойная, для специалистов — щадящая глаза (data-role управляет токенами).
    setRole(role) { document.documentElement.dataset.role = role; if (KK.theme) KK.theme.apply(); },
    staffHome: (s) => (s.role === 'doctor' ? '../doctor/index.html' : s.role === 'psychologist' ? '../psych/index.html' : '../admin/index.html'),
    // Enter в поле нажимает основную кнопку формы.
    enterSubmits(selector) {
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !e.target.matches('input')) return;
        const b = document.querySelector(selector);
        if (b) { e.preventDefault(); b.click(); }
      });
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

`assets/auth.css`:

```css
/* Страницы входа: одна колонка на телефоне, две — от 900 px (о сервисе слева, форма справа). */
.auth{display:grid;grid-template-columns:1fr;min-height:100dvh;background:var(--bg)}
.auth__aside{display:flex;flex-direction:column;gap:12px;padding:20px 16px 0}
.auth__brand{display:inline-flex;align-items:center;gap:8px;color:var(--text);text-decoration:none}
.auth__pitch,.auth__foot{display:none}
.auth__pitch ul{list-style:none;padding:0;margin:20px 0 0;display:grid;gap:12px}
.auth__pitch li{display:flex;gap:10px;align-items:flex-start;color:var(--text-2)}
.auth__main{padding:16px 16px 48px;max-width:460px;width:100%;margin:0 auto;box-sizing:border-box}
.auth__main h1{font-size:28px;font-weight:400;letter-spacing:-.01em;margin:0}
@media (min-width:900px){
  .auth{grid-template-columns:minmax(340px,42%) 1fr}
  .auth__aside{background:var(--surface-2);padding:40px 48px;justify-content:space-between}
  .auth__pitch,.auth__foot{display:block}
  .auth__pitch h2{font-size:34px;font-weight:300;letter-spacing:-.02em;line-height:1.15;margin:0}
  .auth__main{align-self:center;padding:48px}
}
.auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:12px;background:var(--surface-2)}
.auth-tabs button{min-height:40px;border:0;border-radius:9px;background:transparent;color:var(--text-2);font:inherit;cursor:pointer}
.auth-tabs button[aria-pressed="true"]{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgb(0 0 0 / .08)}
.demo-note{font-size:13px;line-height:1.45;background:var(--accent-tint);color:var(--accent-strong);border-radius:10px;padding:8px 12px;margin:0;overflow-wrap:anywhere}
.auth-err{color:var(--crit-ink,var(--text));font-size:14px;min-height:1.2em;margin:0}
.auth-step{font-size:13px;color:var(--text-3);margin:0}
.pw-hint{font-size:13px;color:var(--text-2);margin:0}
```

`auth/login.html`:

```html
<!doctype html>
<html lang="ru" data-role="patient">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Вход · Компас</title>
<link rel="stylesheet" href="../assets/tokens.css"><link rel="stylesheet" href="../assets/ui.css"><link rel="stylesheet" href="../assets/auth.css">
<script src="../assets/theme.js"></script>
</head>
<body>
<main id="app"></main>
<script src="../assets/kk.js"></script>
<script src="../data/scales.js"></script><script src="../data/drugs/classes.js"></script><script src="../data/drugs/aviandr.js"></script>
<script src="../data/rules/core.js"></script><script src="../data/scenarios.js"></script><script src="../data/intake.js"></script>
<script src="../assets/scales.js"></script><script src="../assets/therapy.js"></script><script src="../assets/adherence.js"></script>
<script src="../assets/rules.js"></script><script src="../assets/battery.js"></script><script src="../assets/parser.js"></script><script src="../assets/store.js"></script>
<script src="../assets/ui.js"></script><script src="../assets/host.js"></script><script src="../assets/auth.js"></script><script src="../assets/authpage.js"></script>
<script src="login.js"></script>
</body>
</html>
```

`auth/login.js`:

```js
(function () {
  const { ui, store, auth, authPage: A } = KK;
  const st = { tab: ui.param('as') === 'staff' ? 'staff' : 'patient', step: 'start', phone: '', email: '', staffId: null, staffPhone: '', demo: '' };
  const STAFF_EMAILS = 'elena.ivanova@clinic.demo, maria.belova@clinic.demo, admin@clinic.demo';

  function patientView() {
    if (st.step === 'code') return `
      <h1>Код из SMS</h1><p class="muted">Отправили на ${ui.esc(auth.maskPhone(st.phone))}</p>
      ${A.demoNote(`код ${st.demo}. В настоящей версии он придёт по SMS`)}
      <label class="field"><span class="hint">Код</span><input id="code" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>
      ${A.err()}
      <button class="btn btn--primary btn--block" data-verify>Войти</button>
      <button class="btn btn--ghost btn--block" data-back>Изменить номер</button>`;
    return `
      <h1>Вход для пациента</h1>
      <p class="muted">По номеру телефона, который вы подтвердили при подключении дневника.</p>
      <label class="field"><span class="hint">Телефон</span><input id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${ui.esc(st.phone)}"></label>
      ${A.demoNote('номер Ольги из демо-сценария: +7 900 000-26-48')}
      ${A.err()}
      <button class="btn btn--primary btn--block" data-send>Получить код</button>
      <p class="hint">Нет дневника? Подключение — по приглашению врача: <a href="../patient/onboarding.html?p=p_anna">ввести код приглашения</a>.</p>`;
  }
  function staffView() {
    if (st.step === 'code') return `
      <h1>Подтверждение входа</h1><p class="muted">Код отправлен на ${ui.esc(auth.maskPhone(st.staffPhone))}</p>
      ${A.demoNote(`код ${st.demo}. В настоящей версии он придёт по SMS или в приложение-аутентификатор`)}
      <label class="field"><span class="hint">Код</span><input id="code" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>
      ${A.err()}
      <button class="btn btn--primary btn--block" data-verify>Войти</button>
      <button class="btn btn--ghost btn--block" data-back>Назад</button>`;
    return `
      <h1>Вход для специалиста</h1>
      <p class="muted">Для врачей, психологов и администраторов клиники.</p>
      <label class="field"><span class="hint">Рабочая почта</span><input id="email" type="email" autocomplete="username" value="${ui.esc(st.email)}"></label>
      <label class="field"><span class="hint">Пароль</span><input id="pw" type="password" autocomplete="current-password"></label>
      ${A.demoNote(`пароль не проверяется. Почты для входа: ${STAFF_EMAILS}`)}
      ${A.err()}
      <button class="btn btn--primary btn--block" data-login>Продолжить</button>
      <p class="hint">Нет аккаунта? Специалистов подключает администратор клиники — ссылка-приглашение придёт на рабочую почту.</p>`;
  }
  function render() {
    A.setRole(st.tab === 'staff' ? 'doctor' : 'patient');
    A.mount(`
      <div class="auth-tabs" role="group" aria-label="Кто входит">
        <button type="button" data-tab="patient" aria-pressed="${st.tab === 'patient'}">Я пациент</button>
        <button type="button" data-tab="staff" aria-pressed="${st.tab === 'staff'}">Я специалист</button></div>
      ${st.tab === 'staff' ? staffView() : patientView()}
      <p class="hint"><a href="recover.html?as=${st.tab}">Не могу войти</a></p>`);
    const first = document.querySelector('#app input');
    if (first) first.focus();
  }
  const code = () => document.getElementById('code').value;

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { st.tab = tab.dataset.tab; st.step = 'start'; render(); return; }
    if (e.target.closest('[data-back]')) { st.step = 'start'; render(); return; }
    if (e.target.closest('[data-send]')) {
      const phone = auth.normalizePhone(document.getElementById('phone').value);
      if (!phone) { A.showErr('Проверьте номер: нужен российский мобильный, например +7 900 000-00-00'); return; }
      // Код отправляем на любой номер: есть ли дневник, выясняется только после подтверждения владения номером.
      st.phone = phone; st.demo = store.requestOtp(phone, 'patient_login').code; st.step = 'code'; render();
      return;
    }
    if (e.target.closest('[data-verify]') && st.tab === 'patient') {
      try { store.verifyOtp(st.phone, 'patient_login', code()); } catch (err) { A.showErr(err.message); return; }
      const pid = store.findPatientByPhone(st.phone);
      if (!pid) { A.showErr('Этот номер не привязан к дневнику. Подключитесь по коду приглашения врача'); return; }
      auth.session.set({ kind: 'patient', patientId: pid });
      try { localStorage.setItem(`kk:linked:${pid}`, 'true'); } catch (err) { /* приватный режим */ }
      location.href = `../patient/index.html?p=${encodeURIComponent(pid)}`;
      return;
    }
    if (e.target.closest('[data-login]')) {
      st.email = auth.normalizeEmail(document.getElementById('email').value);
      if (!auth.validEmail(st.email) || !document.getElementById('pw').value) { A.showErr('Введите рабочую почту и пароль'); return; }
      let s;
      try { s = store.staffLoginCheck(st.email); } catch (err) { A.showErr(err.message); return; }
      st.staffId = s.id; st.staffPhone = s.phone; st.demo = store.requestOtp(s.id, 'staff_mfa').code; st.step = 'code'; render();
      return;
    }
    if (e.target.closest('[data-verify]') && st.tab === 'staff') {
      try { store.verifyOtp(st.staffId, 'staff_mfa', code()); } catch (err) { A.showErr(err.message); return; }
      const s = store.staffById(st.staffId);
      if (!s || s.status !== 'active') { A.showErr('Не получилось войти. Проверьте почту или обратитесь к администратору клиники'); return; }
      auth.session.set({ kind: 'staff', staffId: s.id, role: s.role });
      location.href = A.staffHome(s);
    }
  });
  A.enterSubmits('[data-send],[data-verify],[data-login]');
  render();
})();
```

- [ ] **Step 4: Run** `node --test tests/pages.test.js` → PASS; `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add assets/authpage.js assets/auth.css auth/login.html auth/login.js tests/pages.test.js
git commit -m "feat(auth): sign-in page for patients and staff with two-column site layout"
```

---

### Task 5: Принятие приглашения клиники

**Files:**
- Create: `auth/invite.html`, `auth/invite.js`
- Test: `tests/pages.test.js` (дописать)

- [ ] **Step 1: Write the failing test** — в конец `tests/pages.test.js`:

```js
test('invite page is wired', () => checkPage('auth/invite.html', 'auth/invite.js'));
```

- [ ] **Step 2: Run** `node --test tests/pages.test.js` → FAIL (ENOENT).

- [ ] **Step 3: Implement**

`auth/invite.html` — копия `auth/login.html` с отличиями: `<html lang="ru" data-role="doctor">`, `<title>Приглашение · Компас</title>`, последний скрипт `<script src="invite.js"></script>`.

`auth/invite.js`:

```js
(function () {
  const { ui, store, auth, authPage: A } = KK;
  const token = ui.param('token') || '';
  const info = store.inviteInfo(token);
  const ROLE = { doctor: 'врач', psychologist: 'клинический психолог', admin: 'администратор клиники' };
  const SPECS = ['терапевт', 'врач общей практики', 'невролог', 'кардиолог', 'эндокринолог', 'психиатр', 'психотерапевт'];
  const STEPS = ['invite', 'profile', 'password', 'mfa', 'oath'];
  const st = { step: info.state === 'pending' ? 'invite' : 'bad', name: '', specialty: SPECS[0], phone: '', pwOk: false, demo: '', oath: false };
  A.setRole('doctor');

  const stepLine = () => `<p class="auth-step">Шаг ${STEPS.indexOf(st.step) + 1} из ${STEPS.length}</p>`;
  function view() {
    if (st.step === 'bad') return `<h1>Приглашение недоступно</h1><p class="muted">${ui.esc(store.inviteText(info.state))}</p>
      <a class="btn btn--block" href="login.html?as=staff">Ко входу</a>`;
    if (st.step === 'invite') return `${stepLine()}<h1>Приглашение в «Компас»</h1>
      <p class="muted">${ui.esc(info.clinic)} приглашает вас как ${ui.esc(ROLE[info.role])}.</p>
      <dl class="kv"><dt>Рабочая почта</dt><dd>${ui.esc(info.email)}</dd><dt>Действует до</dt><dd>${ui.esc(ui.fmtDateTime(info.expiresAt))}</dd></dl>
      <button class="btn btn--primary btn--block" data-next>Начать</button>`;
    if (st.step === 'profile') return `${stepLine()}<h1>О вас</h1>
      <label class="field"><span class="hint">Фамилия и имя</span><input id="name" autocomplete="name" value="${ui.esc(st.name)}"></label>
      ${info.role === 'doctor' ? `<label class="field"><span class="hint">Специальность</span><select id="spec">${SPECS.map((s) => `<option ${s === st.specialty ? 'selected' : ''}>${ui.esc(s)}</option>`).join('')}</select></label>
        <p class="hint">Для психиатра и психотерапевта кабинет компактный; для остальных специальностей — с подсказками к шкалам и маршрутизации.</p>`
        : `<p class="muted">Специальность: ${ui.esc(ROLE[info.role])}</p>`}
      <label class="field"><span class="hint">Мобильный телефон — для кода при входе</span><input id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${ui.esc(st.phone)}"></label>
      ${A.err()}<button class="btn btn--primary btn--block" data-profile>Дальше</button>`;
    if (st.step === 'password') return `${stepLine()}<h1>Пароль</h1>
      <p class="muted">Не короче 10 символов. Лучше фраза из нескольких слов.</p>
      <label class="field"><span class="hint">Пароль</span><input id="pw" type="password" autocomplete="new-password"></label>
      <p class="pw-hint" id="pwh" aria-live="polite"></p>
      <label class="field"><span class="hint">Ещё раз</span><input id="pw2" type="password" autocomplete="new-password"></label>
      ${A.demoNote('пароль нигде не сохраняется, проверяется только его надёжность')}
      ${A.err()}<button class="btn btn--primary btn--block" data-password>Дальше</button>`;
    if (st.step === 'mfa') return `${stepLine()}<h1>Подтверждение телефона</h1>
      <p class="muted">Код отправлен на ${ui.esc(auth.maskPhone(st.phone))}. Он понадобится при каждом входе.</p>
      ${A.demoNote(`код ${st.demo}. В настоящей версии он придёт по SMS`)}
      <label class="field"><span class="hint">Код</span><input id="code" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>
      ${A.err()}<button class="btn btn--primary btn--block" data-mfa>Подтвердить</button>
      <button class="btn btn--ghost btn--block" data-resend>Отправить код ещё раз</button>`;
    return `${stepLine()}<h1>Обязательство</h1>
      <div class="card"><label class="check"><input type="checkbox" id="oath" ${st.oath ? 'checked' : ''}>
        <span>Обязуюсь соблюдать врачебную тайну (ст. 13 Федерального закона № 323-ФЗ) и правила обработки персональных данных пациентов (152-ФЗ), не передавать доступ к кабинету другим лицам.</span></label></div>
      ${A.err()}<button class="btn btn--primary btn--block" data-finish>Завершить регистрацию</button>`;
  }
  function render() { A.mount(view()); const f = document.querySelector('#app input'); if (f) f.focus(); }
  function sendCode() { st.demo = store.requestOtp(`invite:${token}`, 'invite_mfa').code; }

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'pw') return;
    const r = auth.passwordCheck(e.target.value, info.email);
    document.getElementById('pwh').textContent = e.target.value ? r.hint : '';
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'oath') st.oath = e.target.checked; });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) { st.step = 'profile'; render(); return; }
    if (e.target.closest('[data-profile]')) {
      st.name = document.getElementById('name').value.trim();
      const spec = document.getElementById('spec');
      if (spec) st.specialty = spec.value;
      const phone = auth.normalizePhone(document.getElementById('phone').value);
      if (st.name.length < 3) { A.showErr('Укажите фамилию и имя'); return; }
      if (!phone) { A.showErr('Проверьте номер: нужен российский мобильный, например +7 900 000-00-00'); return; }
      st.phone = phone; st.step = 'password'; render();
      return;
    }
    if (e.target.closest('[data-password]')) {
      const pw = document.getElementById('pw').value;
      const r = auth.passwordCheck(pw, info.email);
      if (!r.ok) { A.showErr(r.hint); return; }
      if (pw !== document.getElementById('pw2').value) { A.showErr('Пароли не совпадают'); return; }
      sendCode(); st.step = 'mfa'; render();
      return;
    }
    if (e.target.closest('[data-resend]')) { sendCode(); render(); return; }
    if (e.target.closest('[data-mfa]')) {
      try { store.verifyOtp(`invite:${token}`, 'invite_mfa', document.getElementById('code').value); } catch (err) { A.showErr(err.message); return; }
      st.step = 'oath'; render();
      return;
    }
    if (e.target.closest('[data-finish]')) {
      if (!st.oath) { A.showErr('Подтвердите обязательство, чтобы завершить регистрацию'); return; }
      let s;
      try { s = store.acceptInvite(token, { name: st.name, specialty: st.specialty, phone: st.phone }); } catch (err) { A.showErr(err.message); return; }
      auth.session.set({ kind: 'staff', staffId: s.id, role: s.role });
      location.href = A.staffHome(s);
    }
  });
  A.enterSubmits('[data-next],[data-profile],[data-password],[data-mfa]');
  render();
})();
```

- [ ] **Step 4: Run** `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add auth/invite.html auth/invite.js tests/pages.test.js
git commit -m "feat(auth): accept a clinic invitation — profile, password, second factor, confidentiality pledge"
```

---

### Task 6: Восстановление доступа

**Files:**
- Create: `auth/recover.html`, `auth/recover.js`
- Test: `tests/pages.test.js` (дописать)

- [ ] **Step 1: Write the failing test** — в конец `tests/pages.test.js`:

```js
test('recover page is wired', () => checkPage('auth/recover.html', 'auth/recover.js'));
```

- [ ] **Step 2: Run** → FAIL (ENOENT).

- [ ] **Step 3: Implement**

`auth/recover.html` — копия `auth/login.html` с отличиями: `<title>Восстановление доступа · Компас</title>`, последний скрипт `<script src="recover.js"></script>` (роль страницы выставляет скрипт).

`auth/recover.js`:

```js
(function () {
  const { ui, store, auth, authPage: A } = KK;
  const resetToken = ui.param('reset');
  const st = { as: ui.param('as') === 'patient' ? 'patient' : 'staff', step: resetToken ? 'mfa' : 'start', link: '', demo: '', info: null };
  if (resetToken) { st.as = 'staff'; st.info = store.resetInfo(resetToken); if (!st.info) st.step = 'bad'; }
  A.setRole(st.as === 'patient' ? 'patient' : 'doctor');

  function view() {
    if (st.as === 'patient') return `<h1>Не получается войти</h1>
      <p class="muted">У пациента нет пароля: вход — по коду из SMS на ваш номер.</p>
      <a class="btn btn--primary btn--block" href="login.html">Войти по номеру телефона</a>
      <p class="hint">Если номер сменился, попросите лечащего врача выдать новое приглашение — история дневника сохранится.</p>`;
    if (st.step === 'bad') return `<h1>Ссылка недействительна</h1>
      <p class="muted">Она уже использована или прошло больше 30 минут.</p><a class="btn btn--block" href="recover.html">Запросить ещё раз</a>`;
    if (st.step === 'start') return `<h1>Восстановление доступа</h1>
      <p class="muted">Укажите рабочую почту — пришлём ссылку для смены пароля.</p>
      <label class="field"><span class="hint">Рабочая почта</span><input id="email" type="email" autocomplete="username"></label>
      ${A.err()}<button class="btn btn--primary btn--block" data-send>Отправить ссылку</button>
      <p class="hint">Почту сменили или аккаунт заблокирован — обратитесь к администратору клиники.</p>`;
    if (st.step === 'sent') return `<h1>Проверьте почту</h1>
      <p class="muted">Если такая почта есть в клинике, на неё отправлена ссылка. Она действует 30 минут.</p>
      ${st.link ? `<p class="demo-note" role="status"><b>Демо:</b> письмо не отправляется. Ссылка: <a href="${ui.esc(st.link)}">${ui.esc(st.link)}</a></p>` : ''}`;
    if (st.step === 'mfa') return `<h1>Подтверждение</h1>
      <p class="muted">Код отправлен на ${ui.esc(auth.maskPhone(st.info.phone))}.</p>
      ${A.demoNote(`код ${st.demo}. В настоящей версии он придёт по SMS`)}
      <label class="field"><span class="hint">Код</span><input id="code" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>
      ${A.err()}<button class="btn btn--primary btn--block" data-mfa>Подтвердить</button>`;
    if (st.step === 'password') return `<h1>Новый пароль</h1>
      <label class="field"><span class="hint">Пароль</span><input id="pw" type="password" autocomplete="new-password"></label>
      <p class="pw-hint" id="pwh" aria-live="polite"></p>
      <label class="field"><span class="hint">Ещё раз</span><input id="pw2" type="password" autocomplete="new-password"></label>
      ${A.demoNote('пароль нигде не сохраняется, проверяется только его надёжность')}
      ${A.err()}<button class="btn btn--primary btn--block" data-save>Сохранить</button>`;
    return `<h1>Пароль обновлён</h1><p class="muted">Войдите с новым паролем.</p>
      <a class="btn btn--primary btn--block" href="login.html?as=staff">Ко входу</a>`;
  }
  function render() { A.mount(view()); const f = document.querySelector('#app input'); if (f) f.focus(); }
  if (st.step === 'mfa') st.demo = store.requestOtp(`reset:${st.info.staffId}`, 'reset_mfa').code;

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'pw') return;
    document.getElementById('pwh').textContent = e.target.value ? auth.passwordCheck(e.target.value, st.info.email).hint : '';
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-send]')) {
      const email = auth.normalizeEmail(document.getElementById('email').value);
      if (!auth.validEmail(email)) { A.showErr('Проверьте адрес почты'); return; }
      const r = store.createReset(email);
      st.link = r ? new URL(`recover.html?reset=${encodeURIComponent(r.token)}`, location.href).href : '';
      st.step = 'sent'; render();
      return;
    }
    if (e.target.closest('[data-mfa]')) {
      try { store.verifyOtp(`reset:${st.info.staffId}`, 'reset_mfa', document.getElementById('code').value); } catch (err) { A.showErr(err.message); return; }
      st.step = 'password'; render();
      return;
    }
    if (e.target.closest('[data-save]')) {
      const pw = document.getElementById('pw').value;
      const r = auth.passwordCheck(pw, st.info.email);
      if (!r.ok) { A.showErr(r.hint); return; }
      if (pw !== document.getElementById('pw2').value) { A.showErr('Пароли не совпадают'); return; }
      try { store.completeReset(resetToken); } catch (err) { A.showErr(err.message); return; }
      st.step = 'done'; render();
    }
  });
  A.enterSubmits('[data-send],[data-mfa],[data-save]');
  render();
})();
```

- [ ] **Step 4: Run** `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add auth/recover.html auth/recover.js tests/pages.test.js
git commit -m "feat(auth): access recovery — patient by phone, staff by email link and second factor"
```

---

### Task 7: Онбординг пациента — шаг «Телефон» и вид на сайте

**Files:**
- Modify: `patient/onboarding.html`, `patient/onboarding.js`
- Test: `tests/pages.test.js` (дописать)

- [ ] **Step 1: Write the failing test** — в конец `tests/pages.test.js`:

```js
test('patient onboarding confirms the phone and uses the site layout in a browser', () => {
  const h = read('patient/onboarding.html');
  for (const s of ['assets/auth.css', 'assets/auth.js', 'assets/authpage.js']) assert.match(h, new RegExp(s.replace('.', '\\.')), s);
  const js = read('patient/onboarding.js');
  assert.match(js, /requestOtp\(/);
  assert.match(js, /setPatientPhone\(/);
  assert.match(js, /KK\.host\.requestPhone\(/);
  assert.match(js, /authPage\.mount\(/);
  assert.doesNotThrow(() => new Function(js));
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

1. `patient/onboarding.html`: в `<head>` после `patient.css` добавить `<link rel="stylesheet" href="../assets/auth.css">`; после `<script src="../assets/bundle.js"></script>` добавить `<script src="../assets/auth.js"></script><script src="../assets/authpage.js"></script>`.

2. `patient/onboarding.js` (читать текущий файл перед правкой):
   - в `state` добавить поля: `phone: (p.phone || ''), phoneSent: false, demo: ''`;
   - в `view()` перед последним `return` (согласия) вставить ветку шага `'phone'`:

```js
    if (step === 'phone') return `
      <section class="stack-l" style="padding-top:6vh">
        <h1>Ваш телефон</h1>
        <p class="muted">По нему вы будете входить в дневник на сайте. Номер увидят только ваши лечащие специалисты.</p>
        ${KK.host.platform === 'max' ? '<button class="btn btn--block" data-contact>Поделиться номером из MAX</button>' : ''}
        <label class="field"><span class="hint">Мобильный телефон</span>
          <input id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${ui.esc(state.phone)}"></label>
        ${state.phoneSent ? `${KK.authPage.demoNote(`код ${state.demo}. В настоящей версии он придёт по SMS`)}
          <label class="field"><span class="hint">Код из SMS</span><input id="otp" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label>` : ''}
        <p class="hint" id="err" role="alert"></p>
        <button class="btn btn--pill btn--block" ${state.phoneSent ? 'data-phone-verify>Подтвердить' : 'data-phone-send>Получить код'}</button>
        ${helpLink}
      </section>`;
```

   - в обработчике `[data-check]` заменить `step = 2; render();` на `step = 'phone'; render();`;
   - в обработчик кликов добавить:

```js
    if (e.target.closest('[data-contact]')) {
      KK.host.requestPhone().then((raw) => {
        const n = KK.auth.normalizePhone(raw);
        if (n) { state.phone = n; render(); } else document.getElementById('err').textContent = 'Номер не получен. Введите его вручную.';
      });
      return;
    }
    if (e.target.closest('[data-phone-send]')) {
      const n = KK.auth.normalizePhone(document.getElementById('phone').value);
      if (!n) { document.getElementById('err').textContent = 'Проверьте номер: нужен российский мобильный, например +7 900 000-00-00'; return; }
      const owner = store.findPatientByPhone(n);
      if (owner && owner !== ctx.pid) { document.getElementById('err').textContent = 'Этот номер уже привязан к дневнику. Войдите по номеру телефона'; return; }
      state.phone = n; state.demo = store.requestOtp(n, 'patient_register').code; state.phoneSent = true; render();
      return;
    }
    if (e.target.closest('[data-phone-verify]')) {
      try {
        store.verifyOtp(state.phone, 'patient_register', document.getElementById('otp').value);
        store.setPatientPhone(ctx.pid, state.phone);
      } catch (err) { document.getElementById('err').textContent = err.message; return; }
      step = 2; render();
      return;
    }
```

   - если пользователь меняет номер в поле после отправки кода, код должен запрашиваться заново: в существующий обработчик `input` (или новый) добавить `if (e.target.id === 'phone' && state.phoneSent) { state.phoneSent = false; render(); }` — **без** потери фокуса не обойтись, поэтому вместо перерисовки просто сбросить флаг и спрятать поле кода: `state.phoneSent = false; const o = document.getElementById('otp'); if (o) o.closest('label').remove();` и поменять кнопку: `const b = document.querySelector('[data-phone-verify]'); if (b) { b.removeAttribute('data-phone-verify'); b.setAttribute('data-phone-send', ''); b.textContent = 'Получить код'; }`;
   - `render()` заменить на:

```js
  // В браузере онбординг показан в раскладке сайта (о сервисе слева), в мессенджере — полноэкранно.
  function render() {
    if (KK.host.platform === 'web' && KK.authPage) KK.authPage.mount(view());
    else ui.mount('#app', view());
  }
```

- [ ] **Step 4: Run** `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add patient/onboarding.html patient/onboarding.js tests/pages.test.js
git commit -m "feat(onboarding): confirm the patient's phone by code; site layout in a browser"
```

---

### Task 8: Кабинет администратора клиники

**Files:**
- Create: `admin/index.html`, `admin/index.js`
- Test: `tests/pages.test.js` (дописать)

- [ ] **Step 1: Write the failing test** — в конец `tests/pages.test.js`:

```js
test('admin page is wired', () => checkPage('admin/index.html', 'admin/index.js'));
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`admin/index.html`:

```html
<!doctype html>
<html lang="ru" data-role="doctor">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Сотрудники · Компас</title>
<link rel="stylesheet" href="../assets/tokens.css"><link rel="stylesheet" href="../assets/ui.css"><link rel="stylesheet" href="../assets/doctor.css"><link rel="stylesheet" href="../assets/auth.css">
<script src="../assets/theme.js"></script>
</head>
<body>
<div class="d-app"><aside class="d-side" id="side"></aside><main class="d-main" id="app"></main></div>
<script src="../assets/kk.js"></script>
<script src="../data/scales.js"></script><script src="../data/drugs/classes.js"></script><script src="../data/drugs/aviandr.js"></script>
<script src="../data/rules/core.js"></script><script src="../data/scenarios.js"></script><script src="../data/intake.js"></script>
<script src="../assets/scales.js"></script><script src="../assets/therapy.js"></script><script src="../assets/adherence.js"></script>
<script src="../assets/rules.js"></script><script src="../assets/battery.js"></script><script src="../assets/parser.js"></script><script src="../assets/store.js"></script>
<script src="../assets/ui.js"></script><script src="../assets/host.js"></script><script src="../assets/auth.js"></script><script src="../assets/authpage.js"></script>
<script src="index.js"></script>
<script src="../assets/demo-switch.js"></script>
</body>
</html>
```

`admin/index.js`:

```js
(function () {
  const { ui, store, auth } = KK;
  const ROLE = { doctor: 'Врач', psychologist: 'Клинический психолог', admin: 'Администратор' };
  const STATE = { pending: ['badge--info', 'приглашён'], expired: ['badge--warn', 'приглашение истекло'], revoked: ['badge--info', 'отозвано'] };
  const me = () => auth.staff('admin') || store.staffById('adm1');
  let flash = '';
  const inviteLink = (token) => new URL(`../auth/invite.html?token=${encodeURIComponent(token)}`, location.href).href;

  function side() {
    const m = me();
    ui.mount('#side', `
      <div class="d-brand">${ui.icon('route', 20)}<b>Компас</b><span class="dotrow" aria-hidden="true">· · ·· ····</span></div>
      <a href="index.html" aria-current="page">${ui.icon('users', 18)}<span>Сотрудники</span></a>
      <div class="d-me"><div class="d-me__who"><b>${ui.esc(m.name)}</b><span class="hint">администратор · ${ui.esc(store.clinicInfo().name)}</span>
        ${auth.session && auth.session.get() ? '<a class="hint" href="../auth/login.html?as=staff" data-logout>Выйти</a>' : ''}</div>
        ${KK.theme ? KK.theme.toggleHtml() : ''}</div>`);
  }
  function staffRow(s) {
    const self = s.id === me().id;
    return `<tr><td><b>${ui.esc(s.name)}</b><br><span class="hint">${ui.esc(s.email)}</span></td>
      <td>${ui.esc(ROLE[s.role])}${s.role === 'doctor' ? `<br><span class="hint">${ui.esc(s.specialty)}</span>` : ''}</td>
      <td>${s.status === 'active' ? '<span class="badge badge--ok">активен</span>' : '<span class="badge badge--warn">заблокирован</span>'}</td>
      <td>${s.role === 'admin' ? '—' : `<label class="row"><input type="checkbox" data-frmr="${ui.esc(s.id)}" ${s.frmrChecked ? 'checked' : ''}> проверено</label>`}</td>
      <td>${self ? '<span class="hint">это вы</span>' : `<button class="btn btn--ghost" data-block="${ui.esc(s.id)}">${s.status === 'active' ? 'Заблокировать' : 'Разблокировать'}</button>`}</td></tr>`;
  }
  function inviteRow(i) {
    const [cls, label] = STATE[i.state];
    return `<tr><td><b>${ui.esc(i.email)}</b><br><span class="hint">приглашение от ${ui.esc(ui.fmtDate(i.createdAt))}</span></td>
      <td>${ui.esc(ROLE[i.role])}</td><td><span class="badge ${cls}">${label}</span></td><td>—</td>
      <td><div class="row wrap">${i.state !== 'revoked' ? `<button class="btn btn--ghost" data-resend="${ui.esc(i.token)}">Отправить ещё раз</button>` : ''}
        ${i.state === 'pending' ? `<button class="btn btn--ghost" data-revoke="${ui.esc(i.token)}">Отозвать</button>` : ''}</div></td></tr>`;
  }
  function render() {
    const staff = store.staff();
    const invites = store.invites().filter((i) => i.state !== 'used').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    ui.preserveFocus(() => ui.mount('#app', `
      <div class="page-head"><h1>Сотрудники</h1></div>
      <section class="card stack" style="max-width:760px"><h2>Пригласить сотрудника</h2>
        <div class="row wrap" style="align-items:flex-end;gap:12px">
          <label class="field" style="flex:1 1 240px"><span class="hint">Рабочая почта</span><input id="inv-email" type="email"></label>
          <label class="field"><span class="hint">Роль</span><select id="inv-role">${Object.entries(ROLE).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
          <button class="btn btn--primary" data-invite>Пригласить</button></div>
        <p class="auth-err" id="err" role="alert"></p>
        ${flash ? `<p class="demo-note" role="status"><b>Демо:</b> письмо не отправляется. Ссылка приглашения: <a href="${ui.esc(flash)}">${ui.esc(flash)}</a></p>` : ''}
        <p class="hint">Ссылка действует 72 часа и подходит один раз. Перед приглашением врача проверьте его в Федеральном регистре медицинских работников (ФРМР).</p></section>
      <section class="card stack" style="margin-top:16px"><h2>Команда</h2>
        <table class="table"><thead><tr><th>Сотрудник</th><th>Роль</th><th>Статус</th><th>ФРМР</th><th></th></tr></thead>
          <tbody>${staff.map(staffRow).join('')}${invites.map(inviteRow).join('')}</tbody></table></section>`));
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-logout]')) { if (auth.session) auth.session.clear(); return; }
    if (e.target.closest('[data-invite]')) {
      try {
        const inv = store.inviteStaff(document.getElementById('inv-email').value, document.getElementById('inv-role').value, me().id);
        flash = inviteLink(inv.token);
      } catch (err) { document.getElementById('err').textContent = err.message; return; }
      render();
      return;
    }
    const rs = e.target.closest('[data-resend]');
    if (rs) { try { flash = inviteLink(store.resendInvite(rs.dataset.resend).token); } catch (err) { document.getElementById('err').textContent = err.message; } render(); return; }
    const rv = e.target.closest('[data-revoke]');
    if (rv) { store.revokeInvite(rv.dataset.revoke); render(); return; }
    const bl = e.target.closest('[data-block]');
    if (bl) { const s = store.staffById(bl.dataset.block); store.setStaff(s.id, { status: s.status === 'active' ? 'blocked' : 'active' }); render(); }
  });
  document.addEventListener('change', (e) => {
    const f = e.target.closest('[data-frmr]');
    if (f) { store.setStaff(f.dataset.frmr, { frmrChecked: f.checked }); render(); }
  });
  store.subscribe(() => { side(); render(); });
  side();
  render();
})();
```

- [ ] **Step 4: Run** `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add admin/index.html admin/index.js tests/pages.test.js
git commit -m "feat(admin): clinic administrator — invite staff, resend or revoke, block, FRMR mark"
```

---

### Task 9: Кабинеты знают вошедшего, лаунчер, сборка

**Files:**
- Modify: `assets/doctor.js` (`mode`, `renderSide`, обработчик «Выйти» в `start`), `assets/psych.js` (`renderSide`)
- Modify: все `doctor/*.html` и `psych/*.html` (подключить `auth.js` после `host.js`)
- Modify: `index.html` (карточка «Вход»), `tools/build-artifact.js`, `tests/build.test.js`, `tools/responsive-audit.js`
- Test: `tests/doctor.test.js` (дописать)

- [ ] **Step 1: Write the failing test** — в конец `tests/doctor.test.js`:

```js
test('signed-in doctor: side panel and hint mode follow the session', () => {
  const mem = new Map();
  const ss = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const hadStore = KK.store; const hadSession = KK.auth.session;
  KK.store = KK.createStore({ storage: memStorage(), clock: () => new Date('2026-10-21T12:00:00Z') });
  KK.store.reset();
  KK.auth.session = KK.auth.createSession(ss);
  try {
    assert.equal(D().mode(), 'nonPsychiatrist');
    const s = KK.store.acceptInvite(KK.store.inviteStaff('psy.doc@clinic.demo', 'doctor').token, { name: 'Пётр Орлов', specialty: 'психиатр', phone: '+79123456789' });
    KK.auth.session.set({ kind: 'staff', staffId: s.id, role: 'doctor' });
    assert.equal(D().mode(), 'psychiatrist');
    assert.equal(D().me().name, 'Пётр Орлов');
    KK.store.setStaff(s.id, { status: 'blocked' });
    assert.equal(D().me().name, 'Елена Иванова');
  } finally { KK.store = hadStore; KK.auth.session = hadSession; }
});
```

(`memStorage` и `D` уже определены в этом файле.)

- [ ] **Step 2: Run** `node --test tests/doctor.test.js` → FAIL (`D(...).me is not a function`).

- [ ] **Step 3: Implement**

1. `assets/doctor.js`:
   - заменить `mode: () => KK.store.doctor().mode,` на:

```js
    // Кто сейчас в кабинете: вошедший через сайт врач (активный) или демо-врач стора.
    me() {
      const d = KK.store.doctor();
      const s = KK.auth && typeof KK.auth.staff === 'function' ? KK.auth.staff('doctor') : null;
      return s ? { id: d.id, name: s.name, specialty: s.specialty, mode: app.modeFor(s.specialty), signedIn: true } : Object.assign({}, d, { signedIn: false });
    },
    mode: () => app.me().mode,
```

   - в `renderSide()` заменить `const doc = KK.store.doctor();` на `const doc = app.me();`, а в разметке `d-me__who` после `<span class="hint">…режим…</span>` добавить `${doc.signedIn ? '<a class="hint" href="../auth/login.html?as=staff" data-logout>Выйти</a>' : ''}`;
   - в `start()` внутрь существующего обработчика `document.addEventListener('click', (ev) => {` первой строкой добавить: `if (ev.target.closest('[data-logout]') && KK.auth && KK.auth.session) KK.auth.session.clear();`.

2. `assets/psych.js` `renderSide()`: заменить `const psy = KK.store.psychologist();` на

```js
      const signed = KK.auth && typeof KK.auth.staff === 'function' ? KK.auth.staff('psychologist') : null;
      const psy = signed || KK.store.psychologist();
```

и после `<span class="hint">${esc(psy.specialty)}</span>` добавить `${signed ? '<a class="hint" href="../auth/login.html?as=staff" data-logout>Выйти</a>' : ''}`.

3. Подключить `auth.js` в кабинетах:

```bash
sed -i 's#<script src="../assets/host.js"></script>#&<script src="../assets/auth.js"></script>#' doctor/*.html psych/*.html
```

Проверка: `grep -L "assets/auth.js" doctor/*.html psych/*.html` — пусто.

4. `index.html` — в `<section class="doors">` после карточки психолога:

```html
    <div class="door aura aura--sand"><span class="label">Сайт · вход, регистрация по приглашению, администратор клиники</span><h2>Вход</h2>
      <div class="row wrap"><a class="btn btn--pill" href="auth/login.html">Открыть вход на сайт</a><a class="btn" href="admin/index.html">Администратор</a></div></div>
```

5. `tools/build-artifact.js`: в списке папок `['assets', 'data', 'patient', 'doctor', 'psych']` добавить `'auth', 'admin'`; в шапке-комментарии упомянуть `auth/**`, `admin/**`.

6. `tests/build.test.js`: в первом тесте добавить `assert.ok(['auth/login.html', 'auth/invite.js', 'auth/recover.js', 'admin/index.js', 'assets/auth.css', 'assets/authpage.js'].every((f) => list.includes(f)));`. В тесте «every page loads host.js…» расширить список папок до `['patient', 'doctor', 'psych', 'auth', 'admin']`.

7. `tools/responsive-audit.js`: в `PAGES` добавить `'/auth/login.html', '/auth/login.html?as=staff', '/auth/recover.html', '/admin/index.html',`.

- [ ] **Step 4: Run** `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): cabinets show the signed-in staff and sign out; launcher card; build includes auth and admin"
```

---

### Task 10: API-контракт входа и приглашений

**Files:**
- Modify: `docs/api/openapi.yaml`, `docs/api/README.md`, `tests/api.test.js`

- [ ] **Step 1: Write the failing test** — в конец `tests/api.test.js`:

```js
test('OpenAPI contract has sign-in, invitations and recovery', () => {
  const y = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi.yaml'), 'utf8');
  for (const p of ['/v1/auth/otp:', '/v1/auth/otp:verify:', '/v1/auth/login:', '/v1/auth/mfa:verify:', '/v1/auth/recover:', '/v1/auth/recover:complete:',
    '/v1/staff-invites:', '/v1/staff-invites/{token}:', '/v1/staff-invites/{token}:accept:', '/v1/staff-invites/{token}:resend:', '/v1/staff/{id}:']) {
    // Путь целиком на своей строке: '/v1/auth/otp:' не должен засчитываться за счёт '/v1/auth/otp:verify:'; файл может быть с CRLF.
    assert.match(y, new RegExp(`^  ${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?$`, 'm'), p);
  }
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — в `docs/api/openapi.yaml` в раздел `paths:` (перед `components:`) добавить:

```yaml
  /v1/auth/otp:
    post:
      summary: Запросить одноразовый код (6 цифр, 5 минут) на телефон — вход и регистрация пациента
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [phone, purpose], properties: { phone: { type: string, pattern: '^\+7\d{10}$' }, purpose: { type: string, enum: [patient_login, patient_register] } } }
      responses:
        '202': { description: Код отправлен (ответ одинаковый для любого номера) }
        '429': { description: Слишком много запросов с номера или адреса }
  /v1/auth/otp:verify:
    post:
      summary: Проверить код; не больше 5 попыток, после успеха код сгорает
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [phone, purpose, code], properties: { phone: { type: string }, purpose: { type: string }, code: { type: string, pattern: '^\d{6}$' } } }
      responses:
        '200': { description: Сессия пациента или подтверждение телефона, content: { application/json: { schema: { $ref: '#/components/schemas/Session' } } } }
        '400': { description: 'Код неверный (с числом оставшихся попыток), истёк или попытки исчерпаны' }
  /v1/auth/login:
    post:
      summary: Вход специалиста — почта и пароль; ответ требует второй фактор
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [email, password], properties: { email: { type: string, format: email }, password: { type: string } } }
      responses:
        '200': { description: 'Нужен второй фактор', content: { application/json: { schema: { type: object, properties: { mfaToken: { type: string } } } } } }
        '401': { description: 'Одинаковый ответ для неверной пары, неизвестной почты и заблокированного сотрудника' }
  /v1/auth/mfa:verify:
    post:
      summary: Второй фактор специалиста
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [mfaToken, code], properties: { mfaToken: { type: string }, code: { type: string, pattern: '^\d{6}$' } } }
      responses:
        '200': { description: Сессия специалиста, content: { application/json: { schema: { $ref: '#/components/schemas/Session' } } } }
        '400': { description: Код неверный или истёк }
  /v1/auth/recover:
    post:
      summary: Ссылка восстановления на рабочую почту (30 минут, одно использование)
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [email], properties: { email: { type: string, format: email } } }
      responses:
        '202': { description: Ответ одинаковый, есть такая почта или нет }
  /v1/auth/recover:complete:
    post:
      summary: Новый пароль по ссылке после второго фактора
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [token, code, password], properties: { token: { type: string }, code: { type: string }, password: { type: string, minLength: 10 } } }
      responses:
        '204': { description: Пароль обновлён, остальные сессии сотрудника завершены }
        '410': { description: Ссылка недействительна }
  /v1/staff-invites:
    post:
      summary: Пригласить сотрудника (только администратор клиники)
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [email, role], properties: { email: { type: string, format: email }, role: { type: string, enum: [doctor, psychologist, admin] } } }
      responses:
        '201': { description: Приглашение создано, письмо отправлено (72 часа, одно использование) }
        '409': { description: Сотрудник с этой почтой уже есть }
  /v1/staff-invites/{token}:
    get:
      summary: Сведения о приглашении (клиника, роль, почта, срок, состояние)
      security: []
      parameters: [{ name: token, in: path, required: true, schema: { type: string } }]
      responses:
        '200': { description: 'Состояние: pending, expired, used, revoked' }
        '404': { description: Не найдено }
    delete:
      summary: Отозвать приглашение
      parameters: [{ name: token, in: path, required: true, schema: { type: string } }]
      responses:
        '204': { description: Отозвано }
  /v1/staff-invites/{token}:accept:
    post:
      summary: Принять приглашение — профиль, пароль (хранится только хэш Argon2id), подтверждённый телефон, обязательство
      security: []
      parameters: [{ name: token, in: path, required: true, schema: { type: string } }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, phone, password, otp, pledge]
              properties:
                name: { type: string }
                specialty: { type: string }
                phone: { type: string }
                password: { type: string, minLength: 10 }
                otp: { type: string }
                pledge: { const: true }
      responses:
        '200': { description: Сессия нового сотрудника, content: { application/json: { schema: { $ref: '#/components/schemas/Session' } } } }
        '410': { description: Приглашение истекло, использовано или отозвано }
  /v1/staff-invites/{token}:resend:
    post:
      summary: Отправить ещё раз — новый токен и срок, старый перестаёт работать
      parameters: [{ name: token, in: path, required: true, schema: { type: string } }]
      responses:
        '201': { description: Новое приглашение }
  /v1/staff/{id}:
    patch:
      summary: Администратор меняет статус (active/blocked) и отметку проверки по ФРМР
      parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, properties: { status: { type: string, enum: [active, blocked] }, frmrChecked: { type: boolean } }, additionalProperties: false }
      responses:
        '200': { description: Обновлено }
```

В `docs/api/README.md` добавить раздел:

```markdown
## Регистрация и вход
Пациент: только по приглашению врача; телефон подтверждается кодом (`/v1/auth/otp`, `/v1/auth/otp:verify`), вход на сайте — тем же кодом.
Специалисты: приглашение администратора (`/v1/staff-invites`), принятие с паролем, телефоном второго фактора и обязательством о врачебной тайне; вход — `/v1/auth/login` + `/v1/auth/mfa:verify`; восстановление — `/v1/auth/recover`.
Сервер: пароли — только хэш Argon2id; коды и токены — криптостойкий генератор; ограничение попыток по номеру, почте и адресу; ответы не раскрывают, существует ли номер или почта.
Экраны демо: `auth/login.html`, `auth/invite.html`, `auth/recover.html`, `admin/index.html`, шаг «Телефон» в `patient/onboarding.html`.
```

- [ ] **Step 4: Run** `npm test` → все проходят.

- [ ] **Step 5: Commit**

```bash
git add docs/api tests/api.test.js
git commit -m "docs(api): sign-in, staff invitations and recovery endpoints"
```

---

### Task 11: Проверка в браузере и публикация

- [ ] **Step 1:** `npm test` — все проходят.
- [ ] **Step 2: Браузер** (`http://localhost:5180`, «Сбросить демо» на главной):
  - `auth/login.html` при 1280 px — две колонки; при 375 px — одна. Пациент: `+7 900 000-26-48` → код из плашки → открывается дневник Ольги. Неверный код → «Осталось попыток: 4».
  - Вкладка «Я специалист»: `elena.ivanova@clinic.demo` + любой пароль → код → кабинет врача, в боковой панели «Елена Иванова» и «Выйти»; «Выйти» → страница входа.
  - `admin/index.html`: пригласить `new.doc@clinic.demo` как врача → ссылка в плашке → открыть → пройти шаги (специальность «психиатр», пароль, код, обязательство) → кабинет врача в режиме специалиста с именем нового врача. Повторное открытие ссылки → «Это приглашение уже использовано…». В админке «Заблокировать» нового врача → вход им → «Не получилось войти…».
  - `auth/recover.html`: почта `maria.belova@clinic.demo` → ссылка → код → новый пароль → «Пароль обновлён».
  - `patient/onboarding.html?p=p_anna`: код `KMP-…` из подсказки → шаг «Телефон» → код → согласия → дневник; на 1280 px слева панель о сервисе.
  - Консоль без ошибок.
- [ ] **Step 3:** аудит переполнения `kkAudit(320)`, `kkAudit(375)`, `kkAudit(768)` — `[]`.
- [ ] **Step 4:** README: в раздел «MAX и перенос данных» или новый «Регистрация и вход» — 3–4 строки со ссылками на страницы.
- [ ] **Step 5:** слить `feat/registration` в `master` (`--ff-only`), собрать `node tools/build-artifact.js <папка>`, опубликовать по ссылке https://claude.ai/artifact/EVC1BfiboTRR9sNefYorPP новые и изменённые файлы.
