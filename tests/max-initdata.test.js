const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, sign, checkString } = require('../tools/max-initdata.js');

const TOKEN = 'test-bot-token';
const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
const fields = (over = {}) => Object.assign({
  auth_date: String(NOW / 1000 - 60),
  query_id: 'q-1',
  user: JSON.stringify({ id: 4242, first_name: 'Анна', language_code: 'ru' }),
  start_param: 'inv_KMP-1234',
}, over);

test('valid initData passes and returns the user and start_param', () => {
  const r = validate(sign(fields(), TOKEN), TOKEN, { now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.user.id, 4242);
  assert.equal(r.startParam, 'inv_KMP-1234');
});

test('field order does not matter', () => {
  const signed = sign(fields(), TOKEN);
  const params = [...new URLSearchParams(signed)].reverse();
  assert.equal(validate(new URLSearchParams(params).toString(), TOKEN, { now: NOW }).ok, true);
});

test('tampered field, foreign token and missing hash are rejected', () => {
  const signed = sign(fields(), TOKEN);
  assert.equal(validate(signed.replace('q-1', 'q-2'), TOKEN, { now: NOW }).reason, 'bad_hash');
  assert.equal(validate(signed, 'other-token', { now: NOW }).reason, 'bad_hash');
  assert.equal(validate(new URLSearchParams(fields()).toString(), TOKEN, { now: NOW }).reason, 'no_hash');
  assert.equal(validate('', TOKEN, { now: NOW }).reason, 'empty');
});

test('auth_date older than an hour is expired; milliseconds are understood', () => {
  assert.equal(validate(sign(fields({ auth_date: String(NOW / 1000 - 3601) }), TOKEN), TOKEN, { now: NOW }).reason, 'expired');
  assert.equal(validate(sign(fields({ auth_date: String(NOW - 60000) }), TOKEN), TOKEN, { now: NOW }).ok, true);
});

test('check string excludes hash, sorts keys and joins with newline', () => {
  assert.equal(checkString('b=2&hash=ff&a=1'), 'a=1\nb=2');
});
