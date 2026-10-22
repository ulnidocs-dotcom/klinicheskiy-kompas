// Дымовой прогон patient/chat.js без браузера: подменяем document/location и стор, жмём кнопки через обработчики.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./load');
const KK = globalThis.KK;
const root = path.join(__dirname, '..');

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function boot({ search = '', online = true, page = 'patient/chat.js' } = {}) {
  const store = KK.createStore({ storage: memStorage(), clock: () => new Date() });
  store.reset();
  const net = { online, broken: false };
  const local = KK.syncLocalTransport(store);
  const transport = { send(items) {
    if (!net.online) { const e = new Error('offline'); e.retryable = true; throw e; }
    if (net.broken && items.some((i) => i.type === 'message')) throw new Error('server error'); // сломана только отправка сообщений
    return local.send(items);
  } };
  const sync = KK.createSync({ storage: memStorage(), transport, schedule: () => 1 });
  const app = { innerHTML: '' };
  const fields = {};
  const handlers = {};
  const loc = { search, href: '' };
  globalThis.location = loc;
  globalThis.document = {
    activeElement: null,
    querySelector: (sel) => (sel === '#app' ? app : null),
    getElementById: (id) => (fields[id] = fields[id] || { id, value: '', focus() {}, setSelectionRange() {} }),
    addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
  };
  const toasts = [];
  const saved = { store: KK.store, sync: KK.sync, patientApp: KK.patientApp };
  KK.store = store; KK.sync = sync;
  KK.patientApp = { start: () => ({ pid: 'p_olga' }), toast: (t) => toasts.push(t), SYNC_PENDING: 'pending', phqAlertOpen: () => false };
  const run = () => new Function(fs.readFileSync(path.join(root, page), 'utf8'))();
  run();
  const fire = (type, target) => (handlers[type] || []).forEach((fn) => fn({ type, target, preventDefault() {} }));
  // Кнопка по data-атрибуту: closest возвращает объект с dataset только для своего селектора.
  const click = (attr, value) => {
    const key = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    fire('click', { closest: (sel) => (sel === `[data-${attr}]` ? { dataset: { [key]: value } } : null) });
  };
  const ask = (text) => { fields.ta = { id: 'ta', value: text }; fire('submit', { id: 'fa' }); };
  const restore = () => Object.assign(KK, saved);
  // Открыть другую страницу с тем же стором (экран помощи после кризиса).
  const open = (other, query) => { loc.search = query; page = other; for (const k of Object.keys(handlers)) delete handlers[k]; run(); };
  return { store, sync, net, app, loc, click, ask, toasts, restore, open };
}

test('chat page: assistant by default, label, topics, switch to doctor', () => {
  const p = boot();
  try {
    assert.match(p.app.innerHTML, /Ассистент, не врач\. Отвечает на частые вопросы по проверенным материалам\./);
    for (const t of ['Лечение', 'Побочные эффекты', 'Как пользоваться', 'Связь с врачом']) assert.ok(p.app.innerHTML.includes(`>${t}</button>`), t);
    p.click('topic', 'side');
    assert.match(p.app.innerHTML, /data-faq="side_common"/);
    p.click('faq', 'side_common');
    assert.match(p.app.innerHTML, /Источник: Инструкция по медицинскому применению/);
    assert.match(p.app.innerHTML, /Не помогло — спросить врача/);
    assert.equal(p.store.events('p_olga', 'assistant').length, 1);
    p.click('mode', 'doctor');
    assert.match(p.app.innerHTML, /Ваш врач/);
    assert.match(p.app.innerHTML, /id="t"/);
  } finally { p.restore(); }
});

test('chat page: «Не помогло» forwards the question to the doctor with the marker', () => {
  const p = boot({ search: '?mode=assistant' });
  try {
    p.ask('плохо сплю');
    assert.match(p.app.innerHTML, /Материал «Что помогает спать»/);
    assert.match(p.app.innerHTML, /href="material\.html\?id=sleep"/);
    const turn = p.store.events('p_olga', 'assistant')[0];
    p.click('ask', turn.id);
    const m = p.store.messages('p_olga').find((x) => x.text === 'плохо сплю');
    assert.equal(m.via, 'assistant');
    assert.equal(m.reason, 'not_helped');
    assert.match(p.app.innerHTML, /Передал вопрос врачу, он ответит в рабочее время/);
    assert.doesNotMatch(p.app.innerHTML, /Не помогло — спросить врача/);
    p.click('mode', 'doctor');
    assert.match(p.app.innerHTML, /Передано ассистентом/);
  } finally { p.restore(); }
});

test('chat page: treatment change and unknown are forwarded at once; offline shows «ждёт отправки»', () => {
  const p = boot({ search: '?mode=assistant' });
  try {
    p.ask('Можно удвоить дозу?');
    assert.match(p.app.innerHTML, /Не меняйте схему сами/);
    assert.equal(p.store.messages('p_olga').find((x) => x.text === 'Можно удвоить дозу?').reason, 'treatment_change');
    p.net.online = false;
    p.ask('Какая погода завтра?');
    assert.match(p.app.innerHTML, /Вопрос ждёт отправки и уйдёт врачу, когда появится связь/);
    assert.equal(p.sync.queued('p_olga').filter((q) => q.type === 'message').length, 1);
  } finally { p.restore(); }
});

test('chat page: crisis raises SOS from the assistant and opens the help screen', () => {
  const p = boot({ search: '?mode=assistant' });
  try {
    p.ask('я не хочу жить');
    const sos = p.store.events('p_olga', 'sos').at(-1);
    assert.equal(p.loc.href, `help.html?from=assistant&sos=${sos.id}`);
    assert.equal(sos.payload.source, 'assistant');
    p.open('patient/help.js', `?from=assistant&sos=${sos.id}`);
    assert.match(p.app.innerHTML, /Сообщение отправлено врачу/);
    assert.match(p.app.innerHTML, /tel:112/);
    // Другой или чужой id SOS — «отправлено» не показываем.
    p.open('patient/help.js', '?from=assistant&sos=ev_other');
    assert.doesNotMatch(p.app.innerHTML, /Сообщение отправлено врачу/);
    assert.ok(p.store.alerts({ patientId: 'p_olga', open: true }).some((a) => a.ruleId === 'sos'));
    assert.equal(p.store.messages('p_olga').filter((m) => m.via === 'assistant').length, 0);
  } finally { p.restore(); }
});

test('chat page: offline crisis goes to help with failed=1 and «не отправлено»', () => {
  const p = boot({ search: '?mode=assistant', online: false });
  try {
    p.ask('хочу сдохнуть');
    assert.equal(p.loc.href, 'help.html?from=assistant&failed=1');
    assert.equal(p.store.events('p_olga', 'sos').length, 0);
    p.open('patient/help.js', '?from=assistant&failed=1');
    assert.ok(p.app.innerHTML.includes('Сообщение не отправлено.</b> Нет связи. Если опасно сейчас — звоните 112.'));
    assert.doesNotMatch(p.app.innerHTML, /Сообщение отправлено врачу/);
  } finally { p.restore(); }
});

test('chat page: emergency shows a 112 button and forwards; a failed forward never says «Передал»', () => {
  const p = boot({ search: '?mode=assistant' });
  try {
    p.ask('болит в груди');
    assert.match(p.app.innerHTML, /href="tel:112"/);
    assert.equal(p.store.messages('p_olga').find((m) => m.text === 'болит в груди').reason, 'emergency');
    p.net.broken = true;
    p.ask('Какая погода завтра?');
    const last = p.store.events('p_olga', 'assistant').at(-1);
    assert.doesNotMatch(last.payload.reply, /Передал/);
    assert.match(p.app.innerHTML, /data-ask="/);
    p.net.broken = false;
    p.click('ask', last.id);
    const m = p.store.messages('p_olga').find((x) => x.text === 'Какая погода завтра?');
    assert.equal(m.ref, last.payload.ref);
  } finally { p.restore(); }
});

test('chat page: same question twice — each turn tracks its own forward by ref', () => {
  const p = boot({ search: '?mode=assistant' });
  try {
    p.ask('плохо сплю');
    p.ask('плохо сплю');
    const [a, b] = p.store.events('p_olga', 'assistant');
    p.click('ask', a.id);
    assert.equal((p.app.innerHTML.match(/Не помогло — спросить врача/g) || []).length, 1);
    assert.match(p.app.innerHTML, new RegExp(`data-ask="${b.id}"`));
  } finally { p.restore(); }
});

test('pages that show the assistant load its data', () => {
  const chat = fs.readFileSync(path.join(root, 'patient/chat.html'), 'utf8');
  const card = fs.readFileSync(path.join(root, 'doctor/patient.html'), 'utf8');
  for (const h of [chat, card]) {
    for (const s of ['data/materials.js', 'data/faq.js', 'assets/assistant.js']) assert.ok(h.includes(`../${s}`), s);
    assert.ok(h.indexOf('data/materials.js') < h.indexOf('data/faq.js'));
    assert.ok(h.indexOf('data/drugs/aviandr.js') < h.indexOf('data/faq.js'));
  }
  for (const f of ['patient/help.js', 'doctor/patient.js', 'doctor/messages.js']) assert.doesNotThrow(() => new Function(fs.readFileSync(path.join(root, f), 'utf8')), f);
});
