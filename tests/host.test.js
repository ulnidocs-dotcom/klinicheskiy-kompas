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
