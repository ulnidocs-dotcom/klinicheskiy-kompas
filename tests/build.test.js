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
    assert.ok(['psych/index.html', 'psych/patient.js', 'patient/intake.html', 'assets/battery.js', 'data/cto.js'].every((f) => list.includes(f)));
    assert.ok(!list.some((f) => f.includes('_template')));
    for (const f of list.filter((x) => x.endsWith('.html'))) assert.doesNotMatch(fs.readFileSync(path.join(out, f), 'utf8'), /telegram\.org/, f);
    for (const f of list.filter((x) => x.endsWith('.html'))) assert.doesNotMatch(fs.readFileSync(path.join(out, f), 'utf8'), /st\.max\.ru/, f);
    assert.ok(!list.includes('assets/tg.js') && list.includes('assets/host.js'));
    assert.doesNotMatch(fs.readFileSync(path.join(out, 'doctor/profile.js'), 'utf8'), /confirm\(/);
    const k = fs.readFileSync(path.join(out, 'kompas.html'), 'utf8');
    assert.doesNotMatch(k, /<!doctype|<html|<head|<body/i);
    assert.match(k, /<title>Клинический компас<\/title>/);
    assert.match(k, /dataset\.role="doctor"/);
    assert.match(k, /assets\/theme\.js/);
    assert.ok(k.indexOf('dataset.role') < k.indexOf('class="launch"'));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('every page loads host.js, patient pages also load the MAX bridge, nobody loads tg.js', () => {
  const root = path.join(__dirname, '..');
  const pages = ['index.html', 'ui-kit.html', ...['patient', 'doctor', 'psych'].flatMap((d) =>
    fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`))];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(root, p), 'utf8');
    assert.doesNotMatch(html, /assets\/tg\.js/, p);
    assert.match(html, /assets\/host\.js/, p);
    if (p.startsWith('patient/')) assert.match(html, /<script src="https:\/\/st\.max\.ru\/js\/max-web-app\.js"><\/script>/, p);
  }
});
