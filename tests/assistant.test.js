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
  'Забыл отметить самочувствие', 'Можно ли водить машину?', 'Сколько длится лечение?', 'Не могу дозвониться, визит отменили'];
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
  const sig = store.signals('p_olga').find((s) => s.ruleId === 'sos');
  assert.match(JSON.stringify(sig.inputs), /в чате с ассистентом/);
  assert.equal(KK.syncIsUrgent('sos', { source: 'assistant' }), true);
});

test('bot topics menu passes the lock-screen rules', () => {
  const t = KK.data.botMessages.find((x) => x.id === 'topics_menu');
  assert.ok(t);
  assert.deepEqual(t.buttons.filter((b) => b.type === 'callback').map((b) => b.text), ['Лечение', 'Побочные эффекты', 'Как пользоваться', 'Связь с врачом', 'Записаться на приём']);
});

test('doctor: forwarded marker only on assistant messages, with the reason', () => {
  const D = KK.doctorApp;
  assert.equal(D.viaLabel({ text: 'x' }), '');
  assert.match(D.viaLabel({ via: 'assistant', reason: 'treatment_change' }), /передано ассистентом · вопрос об изменении лечения/);
  assert.match(D.viaLabel({ via: 'assistant', reason: 'not_helped' }), /ответ ассистента не помог/);
  assert.match(D.viaLabel({ via: 'assistant' }), /передано ассистентом<\/span>/);
});

test('doctor: assistant transcript is collapsed by default, escaped, newest first, crisis highlighted', () => {
  const D = KK.doctorApp;
  const ev = [
    { id: 'e1', at: '2026-10-21T10:00:00.000Z', type: 'assistant', payload: { q: 'плохо сплю', kind: 'faq', entryId: 'sleep', reply: '' } },
    { id: 'e2', at: '2026-10-22T10:00:00.000Z', type: 'assistant', payload: { q: '<b>не хочу жить</b>', kind: 'crisis', entryId: null, reply: '' } },
  ];
  const html = D.assistantLog(ev);
  assert.match(html, /Переписка с ассистентом/);
  assert.match(html, /<details data-assistant-log>/);
  assert.match(D.assistantLog(ev, { open: true }), /<details data-assistant-log open>/);
  assert.match(html, /&lt;b&gt;не хочу жить/);
  assert.doesNotMatch(html, /<b>не хочу/);
  assert.ok(html.indexOf('не хочу жить') < html.indexOf('плохо сплю'));
  assert.match(html, /badge--critical/);
  assert.match(html, /Материал «Что помогает спать»/);
  assert.match(D.assistantLog([]), /не обращался к ассистенту/);
});

test('crisis: phrasings with inserted words and common variants are caught', () => {
  const A = globalThis.KK.assistant;
  for (const t of ['не хочу больше жить', 'Не хочу уже жить.', 'жить больше совсем не хочется', 'устала жить', 'не вижу больше смысла жить',
    'не хочу просыпаться', 'хочется уснуть и не проснуться', 'всем будет лучше без меня', 'лучше бы я умерла', 'хочу исчезнуть навсегда']) {
    assert.equal(A.answer(t, {}).kind, 'crisis', t);
  }
  for (const t of ['плохо сплю', 'не хочу пить таблетки утром', 'как жить с тревогой', 'устала на работе', 'хочу пропустить визит']) {
    assert.notEqual(A.answer(t, {}).kind, 'crisis', t);
  }
});

// ——— Ревью безопасности (C1/C2, I1–I4): каждая формулировка — отдельный случай ———
const CRISIS_REVIEW = [
  'наглоталась таблеток', 'выпила все таблетки', 'выпью всю пачку', 'приму всю упаковку', 'зачем мне жить', 'для чего жить',
  'мысли о смерти', 'думаю о смерти', 'желаю себе смерти', 'не хочу больше просыпаться', 'не хочетса жить', 'нехочу жить',
  'нехочется жить', 'не хочу жыть', 'хочу умиреть', 'суецид', 'хочу сдохнуть', 'лучше сдохнуть', 'скорей бы сдохнуть',
  'хочу себя убить', 'я себя порежу', 'я порезала руки', 'режу руки', 'я режусь', 'вскрою вены', 'вскрыть вены', 'бью себя',
  'прыгну с крыши', 'спрыгну с моста', 'шагну с крыши', 'выйду в окно', 'брошусь под машину', 'хочу броситься под поезд',
  'скорее бы умереть', 'умереть бы', 'я думала о том чтобы умереть', 'хочу покончить с этим', 'я хочу покончить', 'кончу с собой',
  'смысла жить больше нет', 'жизнь не имеет смысла', 'хочу исчезнуть', 'хочу не быть', 'меня не станет', 'скоро меня не будет',
  'прощайте всем', 'я больше не могу', 'сил больше нет',
];
test('crisis (review): stem-based, order-independent, typo-tolerant phrasings', () => {
  for (const t of CRISIS_REVIEW) {
    const r = A().answer(t);
    assert.equal(r.kind, 'crisis', t);
    assert.equal(r.entry, undefined, t);
  }
});
const NOT_CRISIS_REVIEW = ['плохо сплю', 'как жить с тревогой', 'устала на работе', 'хочу пропустить визит', 'не хочу пить таблетки утром',
  'сколько стоит парковка', 'боюсь смерти во время панической атаки', 'приняла все таблетки по схеме', 'меня не будет дома завтра',
  'выйду на балкон подышать', 'брошу курить', 'хочу умерить тревогу', 'случайно выпила три таблетки'];
test('crisis (review): ordinary messages are not crisis', () => {
  for (const t of NOT_CRISIS_REVIEW) assert.notEqual(A().answer(t).kind, 'crisis', t);
});

const EMERGENCY = ['болит в груди', 'давит в груди', 'жжет в груди', 'болит сердце', 'задыхаюсь', 'не могу дышать', 'нечем дышать',
  'был обморок', 'теряю сознание', 'отек горла', 'отекло лицо', 'опухли губы', 'отек языка', 'судороги', 'начался приступ, трясёт',
  'сыпь по всему телу и отек', 'задыхаюсь от волнения', 'сердце болит и давит'];
test('emergency: 112 in the reply, forwarded to the doctor, checked right after crisis', () => {
  for (const t of EMERGENCY) {
    const r = A().answer(t);
    assert.equal(r.kind, 'emergency', t);
    assert.equal(r.reply, 'Это может быть опасно. Если сейчас тяжело дышать, болит в груди, отекает лицо или горло — звоните 112. Я передал сообщение врачу.', t);
    assert.equal(r.forward, true, t);
  }
  assert.equal(A().answer('не могу дышать, не хочу жить').kind, 'crisis');
  for (const t of ['сердце колотится', 'приступ паники', 'Как успокоиться с помощью дыхания?', 'кормлю грудью', 'кружится голова'])
    assert.notEqual(A().answer(t).kind, 'emergency', t);
  assert.ok(!KK.data.faq.entries.find((e) => e.id === 'breathing').keywords.some((k) => /сердце|задыха/.test(k)));
});

const CHANGE_REVIEW = ['пропустил прием что делать', 'пропустила вечерний прием', 'приняла утром дважды', 'случайно выпила три таблетки',
  'я не пью таблетки уже неделю', 'стало лучше можно не пить', 'можно принимать один раз в день', 'можно пить только вечером',
  'не принимаю лекарство', 'что делать если не выпила таблетку вечером', 'принимаю антидепрессант', 'можно пить с антидепрессантом',
  'после выпивки можно', 'можно вместе со снотворным', 'пью сертралин, можно вместе'];
test('treatment change (review): skipped, extra, fewer doses, combinations and alcohol are forwarded', () => {
  for (const t of CHANGE_REVIEW) {
    const r = A().answer(t);
    assert.equal(r.kind, 'treatment_change', t);
    assert.match(r.reply, /^Не меняйте схему сами/, t);
    assert.equal(r.forward, true, t);
  }
  for (const t of ['приняла утром дважды', 'случайно выпила три таблетки']) assert.match(A().answer(t).reply, /стало плохо — звоните 112/, t);
  for (const t of ['принимаю антидепрессант', 'можно пить с антидепрессантом', 'пью сертралин, можно вместе']) {
    const r = A().answer(t);
    assert.equal(r.entry.id, 'combination', t);
    assert.match(r.reply, /серотонинового синдрома/, t);
    assert.equal(r.entry.source.title, KK.data.drugs.aviandr.source);
  }
  assert.equal(A().answer('после выпивки можно').entry.id, 'alcohol');
  for (const t of ['Как отменить приём у врача?', 'сколько раз в день принимать', 'как успокоиться']) assert.notEqual(A().answer(t).kind, 'treatment_change', t);
});

test('pregnancy: answer from the instruction, «не меняйте лечение сами», forwarded', () => {
  for (const t of ['я беременна', 'беременность и лечение', 'кормлю грудью', 'планирую беременность', 'можно ли кормить, у меня грудное вскармливание']) {
    const r = A().answer(t);
    assert.equal(r.kind, 'pregnancy', t);
    assert.equal(r.entry.id, 'pregnancy', t);
    assert.match(r.reply, /не применяют при беременности/, t);
    assert.match(r.reply, /Не прекращайте и не меняйте лечение сами/, t);
    assert.equal(r.forward, true, t);
  }
});

test('unknown reply mentions 112; unsent() drops «Передал…» when the forward failed', () => {
  assert.match(A().TEXT.unknown, /если опасно сейчас — звоните 112/i);
  for (const r of [A().answer('Какая погода завтра?'), A().answer('Можно удвоить дозу?'), A().answer('болит в груди'), A().answer('я беременна')]) {
    const u = A().unsent(r.reply);
    assert.doesNotMatch(u, /Передал|передал/, r.kind);
    assert.match(u, /пока не передан/, r.kind);
  }
});

test('FAQ tie-breaks: the more specific entry wins', () => {
  assert.equal(A().answer('не помогает лекарство').entry.id, 'when_works');
  assert.equal(A().answer('тревога').entry.id, 'anxiety');
  assert.equal(A().answer('ты врач?').entry.id, 'who_answers');
});

test('doctor: kind and reason labels are own properties only', () => {
  const D = KK.doctorApp;
  assert.equal(D.viaLabel({ via: 'assistant', reason: 'constructor' }).includes('function'), false);
  const html = D.assistantLog([{ id: 'x', at: '2026-10-22T10:00:00.000Z', type: 'assistant', payload: { q: 'q', kind: 'toString', entryId: null } }]);
  assert.doesNotMatch(html, /function/);
  assert.match(D.assistantLog([{ id: 'y', at: '2026-10-22T10:00:00.000Z', type: 'assistant', payload: { q: 'болит в груди', kind: 'emergency' } }]), /badge--critical/);
});
