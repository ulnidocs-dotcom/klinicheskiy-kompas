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

test('I8: double tap on the same slot counts once', () => {
  const doses = [];
  for (let d = 1; d <= 7; d++) doses.push(dose(d, 'утро'), dose(d, 'утро'));
  assert.equal(adherence.pdc(doses, plan(30), NOW, 7), 0.5);
});

test('pdc is null on the confirmation day (no full day yet)', () => {
  assert.equal(adherence.pdc([], plan(0), NOW, 14), null);
});
