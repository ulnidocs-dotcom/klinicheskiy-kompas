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
  assert.deepEqual(ids, ['alcohol', 'cvd', 'elderly']);
});

test('C1: pregnancy/lactation true wins over sex; missing data → unknown', () => {
  const st = (mut) => { const p = base(); mut(p); return KK.therapy.check(drug(), p).contraindications.find((c) => c.id === 'pregnancy').status; };
  assert.equal(st((p) => { p.sex = 'm'; p.pregnant = true; }), 'present');
  assert.equal(st((p) => { p.pregnant = null; p.lactating = true; }), 'present');
  assert.equal(st((p) => { p.pregnant = true; p.lactating = undefined; }), 'present');
  assert.equal(st((p) => { delete p.sex; delete p.pregnant; delete p.lactating; }), 'unknown');
  assert.equal(st((p) => { p.sex = 'm'; delete p.pregnant; delete p.lactating; }), 'absent');
});
