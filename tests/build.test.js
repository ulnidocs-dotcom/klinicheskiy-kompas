const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('../tools/build-artifact.js');

test('build-artifact: copies pages without templates/telegram, patches confirm, writes kompas.html', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kompas-art-'));
  try {
    const list = build(out);
    assert.ok(!list.includes('index.html') && !list.includes('kompas.html'));
    assert.ok(list.includes('assets/theme.js') && list.includes('patient/index.html') && list.includes('doctor/profile.js'));
    assert.ok(!list.some((f) => f.includes('_template')));
    for (const f of list.filter((x) => x.endsWith('.html'))) assert.doesNotMatch(fs.readFileSync(path.join(out, f), 'utf8'), /telegram\.org/, f);
    assert.doesNotMatch(fs.readFileSync(path.join(out, 'doctor/profile.js'), 'utf8'), /confirm\(/);
    const k = fs.readFileSync(path.join(out, 'kompas.html'), 'utf8');
    assert.doesNotMatch(k, /<!doctype|<html|<head|<body/i);
    assert.match(k, /<title>Клинический компас<\/title>/);
    assert.match(k, /dataset\.role="doctor"/);
    assert.match(k, /assets\/theme\.js/);
    assert.ok(k.indexOf('dataset.role') < k.indexOf('class="launch"'));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
