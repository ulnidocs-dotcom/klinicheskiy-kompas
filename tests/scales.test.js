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
