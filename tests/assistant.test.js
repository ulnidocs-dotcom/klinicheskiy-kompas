const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;
const A = () => KK.assistant;

test('normalize: lowercase, ё→е, punctuation stripped; stems are the first 5 letters of words with 4+ letters', () => {
  assert.equal(A().normalize('Ёлки-Палки, ЧТО это?!'), 'елки палки что это');
  assert.deepEqual(A().stems('Сонливость и головокружение'), ['сонли', 'головокружение'.slice(0, 5)]);
  assert.deepEqual(A().stems('плохо сплю'), ['плохо', 'сплю']);
});

const CRISIS = [
  'Я не хочу жить',
  'Жить не хочется совсем',
  'думаю покончить с собой',
  'Хочу умереть.',
  'мысли о суициде',
  'Иногда думаю о самоубийстве',
  'хочу выпить все таблетки сразу',
  'я режу себя',
  'хочу причинить себе вред',
  'не вижу смысла жить',
  'Лучше бы меня не было',
  'Хочу уйти из жизни',
  'убить себя',
];
test('crisis phrasings are caught first and never answered from the FAQ', () => {
  for (const t of CRISIS) {
    const r = A().answer(t);
    assert.equal(r.kind, 'crisis', t);
    assert.equal(r.entry, undefined, t);
    assert.match(r.reply, /112/, t);
    assert.equal(r.forward, false, t);
  }
});

const NOT_CRISIS = ['плохо сплю', 'Мне тревожно', 'Как жить с тревогой', 'устал от лечения', 'не хочу пить таблетки', 'болит голова',
  'Когда подействует лекарство', 'Сегодня тяжёлый день', 'Мне очень плохо, кружится голова'];
test('ordinary complaints are not flagged as crisis', () => {
  for (const t of NOT_CRISIS) assert.notEqual(A().answer(t).kind, 'crisis', t);
});

const CHANGE = [
  'Можно бросить пить таблетки?',
  'Забыла выпить утреннюю таблетку, можно выпить две вечером?',
  'Хочу отменить лекарство',
  'Можно удвоить дозу?',
  'можно принимать половину таблетки',
  'Хочу уменьшить дозу',
  'Мне стало лучше, можно перестать принимать препарат?',
  'Можно пропустить приём лекарства перед праздником?',
  'Можно ли выпить вина во время лечения?',
  'совмещать с алкоголем можно?',
  'не хочу принимать Авиандр',
  'Хочу поменять препарат на другой',
];
test('treatment-change questions: «Не меняйте схему сами» and forwarded to the doctor', () => {
  for (const t of CHANGE) {
    const r = A().answer(t);
    assert.equal(r.kind, 'treatment_change', t);
    assert.match(r.reply, /^Не меняйте схему сами/, t);
    assert.match(r.reply, /ответит в рабочее время/, t);
    assert.equal(r.forward, true, t);
  }
});

test('alcohol question also quotes the instruction', () => {
  const r = A().answer('Можно ли пить пиво на лечении?');
  assert.equal(r.kind, 'treatment_change');
  assert.equal(r.entry.id, 'alcohol');
  assert.match(r.reply, /алкогол/);
  assert.equal(r.entry.source.kind, 'drug');
});

const NOT_CHANGE = ['Как принимать лекарство?', 'Когда подействует лечение?', 'Как отменить приём у врача?', 'Хочу перенести визит',
  'Забыл отметить самочувствие', 'Можно ли водить машину?', 'Сколько длится лечение?'];
test('neutral treatment questions are not flagged as a change of treatment', () => {
  for (const t of NOT_CHANGE) assert.notEqual(A().answer(t).kind, 'treatment_change', t);
});

const FAQ = [
  ['Как принимать лекарство?', 'how_take'],
  ['Когда подействует лечение?', 'when_works'],
  ['Какие бывают побочные эффекты?', 'side_common'],
  ['побочка', 'side_common'],
  ['Можно ли водить машину?', 'driving'],
  ['плохо сплю', 'sleep'],
  ['не могу уснуть', 'sleep'],
  ['Как отметить самочувствие в дневнике?', 'checkin'],
  ['Когда ответит врач?', 'reply_time'],
  ['Как успокоиться, помогите с дыханием', 'breathing'],
  ['Хочется спать днём и кружится голова', 'side_sleepy'],
  ['Можно ли принимать обезболивающее вместе с ним?', 'other_meds'],
  ['Как перенести визит?', 'reschedule'],
  ['Сколько длится лечение?', 'duration'],
];
test('FAQ: free-text questions find the expected entry with its source', () => {
  for (const [q, id] of FAQ) {
    const r = A().answer(q);
    assert.equal(r.kind, 'faq', q);
    assert.equal(r.entry.id, id, q);
    assert.equal(r.reply, r.entry.a, q);
    assert.ok(r.source && r.source.length > 5, q);
    assert.equal(r.forward, false, q);
  }
});

test('unknown questions go to the doctor', () => {
  for (const q of ['Какая погода завтра?', 'Где ближайшая аптека', 'У меня болит спина уже неделю, что делать', '', '   ']) {
    const r = A().answer(q);
    assert.equal(r.kind, 'unknown', q);
    assert.match(r.reply, /Передал вопрос врачу, он ответит в рабочее время/, q);
    assert.equal(r.forward, true, q);
  }
});

test('answer accepts an injected FAQ base through ctx', () => {
  const faq = [{ id: 'x', topic: 'howto', q: 'Тест', a: 'Ответ', keywords: ['зебра полосатая'], source: { kind: 'service', title: 'Правила сервиса' } }];
  assert.equal(A().answer('полосатая зебра', { faq }).entry.id, 'x');
  assert.equal(A().answer('Как принимать лекарство?', { faq }).kind, 'unknown');
});

test('byId and topic lists cover every entry', () => {
  const F = KK.data.faq;
  assert.deepEqual(F.topics.map((t) => t.label), ['Лечение', 'Побочные эффекты', 'Как пользоваться', 'Связь с врачом']);
  for (const t of F.topics) assert.ok(A().topicEntries(t.id).length >= 3, t.id);
  for (const e of F.entries) assert.equal(A().byId(e.id), e);
  assert.equal(A().byId('nope'), null);
});

test('FAQ base: 15–25 entries, unique ids, each with a source and keywords that match its own question', () => {
  const F = KK.data.faq.entries;
  assert.ok(F.length >= 15 && F.length <= 25, String(F.length));
  assert.equal(new Set(F.map((e) => e.id)).size, F.length);
  const topics = new Set(KK.data.faq.topics.map((t) => t.id).concat('self'));
  for (const e of F) {
    assert.ok(topics.has(e.topic), e.id);
    assert.ok(['material', 'drug', 'service'].includes(e.source.kind), e.id);
    assert.ok(e.source.title, e.id);
    if (e.source.kind === 'material') assert.ok(KK.data.materials.some((m) => m.id === e.source.materialId), e.id);
    if (e.source.kind === 'drug') assert.equal(e.source.title, KK.data.drugs.aviandr.source, e.id);
    assert.ok(e.keywords.length >= 3, e.id);
    const r = A().answer(e.q);
    assert.ok(r.kind !== 'faq' || r.entry.id === e.id, `${e.id}: «${e.q}» → ${r.entry && r.entry.id}`);
  }
});

test('copy rules: calm texts without scores, «!» or promises of a fast reply; every patient text', () => {
  const T = A().TEXT;
  const texts = KK.data.faq.entries.flatMap((e) => [e.q, e.a]).concat(Object.values(T));
  for (const t of texts) {
    assert.doesNotMatch(t, /!/, t);
    assert.doesNotMatch(t, /балл|PHQ|GAD|F\d\d/i, t);
    assert.doesNotMatch(t, /скоро ответит|быстро ответит|сразу ответит|в течение (часа|\d)|немедленно ответит/i, t);
  }
  assert.equal(T.label, 'Ассистент, не врач. Отвечает на частые вопросы по проверенным материалам.');
});

test('side-effect answers list only reactions from the instruction', () => {
  const drug = KK.data.drugs.aviandr;
  const common = drug.adverseEvents.filter((a) => a.freq === 'часто').map((a) => a.label.split(/[ ,(]/)[0].toLowerCase());
  const a = A().byId('side_common').a.toLowerCase();
  for (const w of common) assert.ok(a.includes(w), w);
});

test('forwarded message is stored with the assistant marker; old messages stay plain', () => {
  const m = new Map();
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const store = KK.createStore({ storage, clock: () => new Date('2026-10-22T10:00:00.000Z') });
  store.reset();
  const local = KK.syncLocalTransport(store);
  local.send([{ clientId: 'cl_a', patientId: 'p_olga', type: 'message', payload: { text: 'Можно удвоить дозу?', via: 'assistant', reason: 'treatment_change' }, opts: {}, channel: 'web' }]);
  local.send([{ clientId: 'cl_b', patientId: 'p_olga', type: 'message', payload: { text: 'Обычное' }, opts: {}, channel: 'web' }]);
  const msgs = store.messages('p_olga');
  const fw = msgs.find((x) => x.clientId === 'cl_a');
  assert.equal(fw.via, 'assistant');
  assert.equal(fw.reason, 'treatment_change');
  const plain = msgs.find((x) => x.clientId === 'cl_b');
  assert.equal(plain.via, undefined);
  assert.equal(plain.reason, undefined);
  // неизвестные метки не сохраняются
  const odd = store.sendMessage('p_olga', 'patient', 'x', { via: 'bot', reason: '<script>' });
  assert.equal(odd.via, undefined);
  assert.equal(odd.reason, undefined);
});

test('assistant turns are events: kept in the store and do not raise signals; crisis SOS from the assistant is critical', () => {
  const m = new Map();
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const store = KK.createStore({ storage, clock: () => new Date('2026-10-22T10:00:00.000Z') });
  store.reset();
  const before = store.alerts({ patientId: 'p_olga', open: true }).length;
  const r = A().answer('плохо сплю');
  store.addEvent('p_olga', 'assistant', A().turn('плохо сплю', r));
  const ev = store.events('p_olga', 'assistant');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].payload.kind, 'faq');
  assert.equal(ev[0].payload.entryId, 'sleep');
  assert.equal(store.alerts({ patientId: 'p_olga', open: true }).length, before);
  store.addEvent('p_olga', 'sos', { source: 'assistant' });
  assert.ok(store.alerts({ patientId: 'p_olga', open: true }).some((a) => a.ruleId === 'sos' && a.level === 'critical'));
  assert.equal(KK.syncIsUrgent('sos', { source: 'assistant' }), true);
});

test('bot topics menu passes the lock-screen rules', () => {
  const t = KK.data.botMessages.find((x) => x.id === 'topics_menu');
  assert.ok(t);
  assert.deepEqual(t.buttons.filter((b) => b.type === 'callback').map((b) => b.text), ['Лечение', 'Побочные эффекты', 'Как пользоваться', 'Связь с врачом']);
});
