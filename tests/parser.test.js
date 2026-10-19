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
  assert.equal(r.sex, 'm');
  assert.equal(r.age, 45);
  assert.equal(parser.extract('Пациентка на грудном вскармливании').lactating, true);
});
