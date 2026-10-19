const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

test('namespace exists', () => {
  assert.equal(typeof KK, 'object');
  assert.equal(typeof KK.data, 'object');
});

test('daysBetween counts whole days', () => {
  assert.equal(KK.util.daysBetween('2026-10-01T09:00:00Z', '2026-10-19T08:00:00Z'), 17);
  assert.equal(KK.util.daysBetween('2026-10-19T08:00:00Z', '2026-10-19T20:00:00Z'), 0);
});

test('shiftDays returns ISO shifted by n days', () => {
  assert.equal(KK.util.shiftDays('2026-10-19T09:00:00.000Z', -3), '2026-10-16T09:00:00.000Z');
});

test('dayKey returns local YYYY-MM-DD', () => {
  assert.match(KK.util.dayKey('2026-10-19T09:00:00.000Z'), /^\d{4}-\d{2}-\d{2}$/);
});
