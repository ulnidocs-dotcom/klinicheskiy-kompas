const test = require('node:test');
const assert = require('node:assert/strict');
require('./load');
const KK = globalThis.KK;

function fakeMax(over = {}) {
  const calls = [];
  const WebApp = Object.assign({
    initData: 'auth_date=1&hash=x', initDataUnsafe: { start_param: 'inv_KMP-1234' },
    BackButton: { show: () => calls.push('back.show'), onClick: (fn) => calls.push(['back.onClick', typeof fn]) },
    HapticFeedback: { impactOccurred: (s) => calls.push(['haptic', s]) },
    enableClosingConfirmation: () => calls.push('guard.on'), disableClosingConfirmation: () => calls.push('guard.off'),
    openLink: (u) => calls.push(['open', u]),
  }, over);
  return { win: { WebApp, location: { search: '' } }, calls };
}

test('detects MAX, Telegram and web', () => {
  assert.equal(KK.hostDetect(fakeMax().win), 'max');
  assert.equal(KK.hostDetect({ WebApp: { initData: '' } }), 'web');
  assert.equal(KK.hostDetect({ Telegram: { WebApp: { initData: '', platform: 'ios' } } }), 'telegram');
  assert.equal(KK.hostDetect({ Telegram: { WebApp: { initData: '', platform: 'unknown' } } }), 'web');
  assert.equal(KK.hostDetect(null), 'web');
});

test('MAX host maps back button, haptics, closing guard, links and start param', () => {
  const { win, calls } = fakeMax();
  const h = KK.createHost(win);
  assert.equal(h.platform, 'max');
  assert.equal(h.inside, true);
  h.backButton(() => {});
  h.haptic();
  h.guardClose(true); h.guardClose(false);
  h.openLink('https://example.ru/x');
  assert.deepEqual(calls, ['back.show', ['back.onClick', 'function'], ['haptic', 'light'], 'guard.on', 'guard.off', ['open', 'https://example.ru/x']]);
  assert.equal(h.startParam(), 'inv_KMP-1234');
  assert.equal(h.initData(), 'auth_date=1&hash=x');
  assert.equal(h.download('a.json', '{}'), false); // в MAX — текст с кнопкой «Скопировать»
});

test('web host is safe without any platform objects', () => {
  const h = KK.createHost({ location: { search: '?startapp=inv_KMP-9999' } });
  assert.equal(h.platform, 'web');
  assert.equal(h.inside, false);
  assert.doesNotThrow(() => { h.backButton(() => {}); h.haptic(); h.guardClose(true); h.init(); });
  assert.equal(h.startParam(), 'inv_KMP-9999');
  assert.equal(h.initData(), '');
  const nothing = KK.createHost(null);
  assert.doesNotThrow(() => { nothing.openLink('https://x.ru'); nothing.init(); });
  assert.equal(nothing.startParam(), null);
});

test('a throwing platform API never breaks the page', () => {
  const { win } = fakeMax({ BackButton: { show() { throw new Error('boom'); }, onClick() {} } });
  assert.doesNotThrow(() => KK.createHost(win).backButton(() => {}));
});

test('channel labels for the interface', () => {
  assert.equal(KK.host.LABELS.max, 'MAX');
  assert.equal(KK.host.LABELS.web, 'Сайт');
});

test('patient start() resets the closing guard; scale.js enables it only after the scale is known', () => {
  const fs = require('node:fs');
  const read = (f) => fs.readFileSync(require('node:path').join(__dirname, '..', f), 'utf8');
  const p = read('assets/patient.js');
  assert.ok(p.indexOf('KK.host.init();') < p.indexOf('KK.host.guardClose(false);'));
  assert.ok(p.indexOf('KK.host.guardClose(false);') < p.indexOf('const pid = app.pid();'));
  const s = read('patient/scale.js');
  assert.ok(s.indexOf("if (!def) {") < s.indexOf('KK.host.guardClose(true);'));
});

function webWin(frameElement) {
  const doc = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  const win = { document: doc, Blob: function () {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, location: { search: '' } };
  win.top = win;
  if (frameElement !== undefined) {
    win.top = {};
    Object.defineProperty(win, 'frameElement', { get() { if (frameElement === 'throw') throw new Error('cross-origin'); return frameElement; } });
  }
  return win;
}

test('download works in a plain page and in an iframe that allows downloads', () => {
  assert.equal(KK.createHost(webWin()).download('a.json', '{}'), true);
  const ok = { getAttribute: (n) => (n === 'sandbox' ? 'allow-scripts allow-downloads' : null) };
  assert.equal(KK.createHost(webWin(ok)).download('a.json', '{}'), true);
  assert.equal(KK.createHost(webWin({ getAttribute: () => null })).download('a.json', '{}'), true);
});

test('download returns false in a sandboxed iframe or one we cannot inspect', () => {
  const sb = { getAttribute: (n) => (n === 'sandbox' ? 'allow-scripts allow-same-origin' : null) };
  assert.equal(KK.createHost(webWin(sb)).download('a.json', '{}'), false);
  assert.equal(KK.createHost(webWin('throw')).download('a.json', '{}'), false);
});

test('requestPhone: MAX contact via callback or promise, otherwise null', async () => {
  const viaCb = KK.createHost({ WebApp: { initData: 'a=1', requestContact: (cb) => cb({ phone: '+7 912 345-67-89' }) } });
  assert.equal(await viaCb.requestPhone(), '+7 912 345-67-89');
  const viaPromise = KK.createHost({ WebApp: { initData: 'a=1', requestContact: () => Promise.resolve({ contact: { phone_number: '79123456789' } }) } });
  assert.equal(await viaPromise.requestPhone(), '79123456789');
  const refused = KK.createHost({ WebApp: { initData: 'a=1', requestContact: () => Promise.reject(new Error('no')) } });
  assert.equal(await refused.requestPhone(), null);
  assert.equal(await KK.createHost({ location: { search: '' } }).requestPhone(), null);
});
