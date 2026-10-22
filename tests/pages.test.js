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

test('admin page is wired', () => checkPage('admin/index.html', 'admin/index.js'));

test('demo hub page is wired and covers every cabinet', () => {
  checkPage('auth/demo.html', 'auth/demo.js');
  const js = read('auth/demo.js');
  for (const role of ['patient', 'doctor', 'psychologist', 'admin']) assert.match(js, new RegExp(`id: '${role}'`), role);
  assert.match(read('index.html'), /auth\/demo\.html/);
});

test('login page takes the phone or email from the link', () => {
  const js = read('auth/login.js');
  assert.match(js, /ui\.param\('phone'\)/);
  assert.match(js, /ui\.param\('email'\)/);
});

test('previsit page explains itself instead of silently redirecting; demo hub offers the questionnaire', () => {
  const pv = read('patient/previsit.js');
  assert.doesNotMatch(pv, /if \(!assignment\) \{ location\.replace/);
  assert.match(pv, /data-demo-send/);
  const demo = read('auth/demo.js');
  assert.match(demo, /data-previsit="fill"/);
  assert.match(demo, /demoResetRegistration/);
  assert.match(read('assets/patient.js'), /registered\(pid\)/);
});

test('messenger bot demo page is wired and linked from the demo', () => {
  const h = read('patient/bot.html');
  for (const s of ['assets/sync.js', 'assets/assistant.js', 'data/bot-messages.js', 'data/faq.js', 'assets/bot.css', 'st.max.ru']) assert.ok(h.includes(s), s);
  const js = read('patient/bot.js');
  assert.doesNotThrow(() => new Function(js));
  assert.match(js, /channel: 'max-chat'/);
  assert.doesNotMatch(js, /store\.addEvent\(/);
  assert.match(read('auth/demo.js'), /patient\/bot\.html/);
  assert.match(read('index.html'), /patient\/bot\.html/);
});
