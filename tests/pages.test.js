const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const SCRIPTS = ['assets/store.js', 'assets/ui.js', 'assets/host.js', 'assets/auth.js', 'assets/authpage.js'];

// Страницы входа подключают стор, помощники и свою оболочку, а их скрипты синтаксически корректны.
function checkPage(html, js) {
  const h = read(html);
  for (const s of SCRIPTS) assert.match(h, new RegExp(`\\.\\./${s.replace('.', '\\.')}`), `${html}: ${s}`);
  assert.match(h, /assets\/auth\.css/, html);
  assert.match(h, new RegExp(`src="${path.basename(js)}"`), html);
  assert.doesNotThrow(() => new Function(read(js)), js);
}

test('login page is wired', () => checkPage('auth/login.html', 'auth/login.js'));

test('invite page is wired', () => checkPage('auth/invite.html', 'auth/invite.js'));
test('recover page is wired', () => checkPage('auth/recover.html', 'auth/recover.js'));

test('patient onboarding confirms the phone and uses the site layout in a browser', () => {
  const h = read('patient/onboarding.html');
  for (const s of ['assets/auth.css', 'assets/auth.js', 'assets/authpage.js']) assert.match(h, new RegExp(s.replace('.', '\.')), s);
  const js = read('patient/onboarding.js');
  assert.match(js, /requestOtp\(/);
  assert.match(js, /setPatientPhone\(/);
  assert.match(js, /KK\.host\.requestPhone\(/);
  assert.match(js, /authPage\.mount\(/);
  assert.doesNotThrow(() => new Function(js));
});
