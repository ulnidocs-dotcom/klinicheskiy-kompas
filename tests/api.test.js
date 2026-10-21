const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./load');
const KK = globalThis.KK;

test('bot messages: no drug, diagnosis or scores on the lock screen; known button types', () => {
  const drugs = Object.values(KK.data.drugs).flatMap((d) => [d.name, d.inn]).filter(Boolean);
  for (const m of KK.data.botMessages) {
    for (const d of drugs) assert.ok(!m.text.toLowerCase().includes(d.toLowerCase()), `${m.id}: ${d}`);
    assert.doesNotMatch(m.text, /F\d\d|балл|PHQ|GAD|тревожн|депресс/i, m.id);
    for (const b of m.buttons) assert.ok(['callback', 'open_app'].includes(b.type), `${m.id}: ${b.type}`);
  }
  assert.deepEqual(KK.data.botMessages.map((m) => m.id), ['dose_reminder', 'checkin_reminder', 'doctor_reply']);
});

test('OpenAPI contract lists every endpoint from the spec', () => {
  const y = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi.yaml'), 'utf8');
  assert.match(y, /^openapi: 3\.1\.0/m);
  for (const p of ['/v1/auth/max:', '/v1/auth/telegram:', '/v1/invites/{token}:redeem:', '/v1/link-codes:', '/v1/link-codes:redeem:',
    '/v1/patients/{id}/channels:', '/v1/patients/{id}/channels/{channel}:', '/v1/patients/{id}/events:batch:', '/v1/patients/{id}/events:', '/v1/patients/{id}/export:', '/v1/max/webhook:']) {
    assert.ok(y.includes(`  ${p}`), p);
  }
});
