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

test('Cyrillic word boundaries: hypertension, breastfeeding, "пациент" vs "пациентка"', () => {
  const r = parser.extract('Пациент 45 лет. Гипертоническая болезнь II ст.');
  assert.ok(r.conditions.includes('cvd'));
  assert.equal(r.sex, undefined);
  assert.equal(r.age, 45);
  assert.equal(parser.extract('Пациентка на грудном вскармливании').lactating, true);
});

// --- review fixes ---
test('C1: «пациент» alone does not set sex', () => {
  assert.equal(parser.extract('Пациент 34 года, беременность 10 недель.').sex, undefined);
  assert.equal(parser.extract('Пациент 34 года, беременность 10 недель.').pregnant, true);
  assert.equal(parser.extract('Женщина 50 лет').sex, 'f');
  assert.equal(parser.extract('Пол: жен.').sex, 'f');
});

test('C2: age ignores years and durations', () => {
  assert.equal(parser.extract('Болеет с 2021 года. Пациентка 17 лет.').age, 17);
  assert.equal(parser.extract('Беспокоит в течение 3 лет. Пациентка 34 года.').age, 34);
  assert.equal(parser.extract('Тревога около 2 лет. Женщина 45 лет.').age, 45);
  assert.equal(parser.extract('Впервые 5 лет назад. Мужчина 40 лет.').age, 40);
  assert.equal(parser.extract('Возраст: 58').age, 58);
});

test('C3: eGFR skips formula year, accepts plausible range', () => {
  assert.equal(parser.extract('СКФ (CKD-EPI 2021) 45 мл/мин').labs.egfr, 45);
  assert.equal(parser.extract('СКФ 2021').labs.egfr, undefined);
  assert.equal(parser.extract('СКФ 8 мл/мин').labs.egfr, 8);
});

test('I1: Child-Pugh in Cyrillic and with "класс/class"', () => {
  assert.equal(parser.extract('Цирроз, Чайлд-Пью А').labs.childPugh, 'A');
  assert.equal(parser.extract('Цирроз, Чайлд-Пью В.').labs.childPugh, 'B');
  assert.equal(parser.extract('Child-Pugh класс B').labs.childPugh, 'B');
  assert.equal(parser.extract('Child-Pugh class C').labs.childPugh, 'C');
});

test('I4: postCovid left undefined when not mentioned', () => {
  assert.equal(parser.extract('СКФ 90').postCovid, undefined);
  assert.equal(parser.extract('После COVID-19').postCovid, true);
});

test('I6: negation forms', () => {
  assert.equal(parser.extract('Отрицает беременность').pregnant, false);
  assert.equal(parser.extract('Беременность: нет').pregnant, false);
  assert.equal(parser.extract('Нет беременности').pregnant, false);
  assert.equal(parser.extract('Беременность не исключена').pregnant, true);
  assert.ok(!parser.extract('Эпилепсия — нет').conditions.includes('epilepsy'));
  assert.ok(!parser.extract('Без эпилепсии в анамнезе').conditions.includes('epilepsy'));
  assert.ok(!parser.extract('Эпилепсия не выявлена').conditions.includes('epilepsy'));
  const r = parser.extract('Органическое поражение ЦНС исключено. Психотических симптомов нет.');
  assert.ok(!r.conditions.includes('organic_brain'));
  assert.ok(!r.history?.psychotic);
  assert.ok(parser.extract('Органическое поражение головного мозга').conditions.includes('organic_brain'));
  assert.ok(parser.extract('Органическое поражение ЦНС').conditions.includes('organic_brain'));
  assert.ok(!parser.extract('Биполярное расстройство отрицает').history?.bipolar);
  assert.ok(!parser.extract('ИБС — нет').conditions.includes('cvd'));
  assert.equal(parser.extract('Лактация: нет').lactating, false);
  assert.ok(parser.extract('Эпилепсия с детства').conditions.includes('epilepsy'));
});

test('meds: longest match wins, cancelled meds skipped', () => {
  assert.deepEqual(parser.extract('Эсциталопрам 10 мг').meds.map((m) => m.name), ['Эсциталопрам']);
  assert.deepEqual(parser.extract('Сертралин отменён месяц назад. Принимает феназепам.').meds.map((m) => m.name), ['Феназепам']);
});

test('ICD: B12 vitamin is not a diagnosis; dotted and chapter codes are', () => {
  assert.deepEqual(parser.extract('Витамин B12 в норме').diagnoses, []);
  assert.deepEqual(parser.extract('F32 и I10, A15.0').diagnoses.map((d) => d.code), ['F32', 'I10', 'A15.0']);
});
