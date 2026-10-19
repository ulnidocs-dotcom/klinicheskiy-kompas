const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolvePath } = require('../tools/serve.js');
const root = path.join(__dirname, '..');

test('serve: path inside root resolves', () => {
  assert.equal(resolvePath(root, '/index.html').file, path.join(root, 'index.html'));
});

test('serve: sibling directory with root as prefix is rejected', () => {
  const sibling = '/../' + path.basename(root) + '-evil/secret.txt';
  assert.equal(resolvePath(root, sibling).status, 403);
  assert.equal(resolvePath(root, '/../../etc/passwd').status, 403);
});

test('serve: malformed percent-encoding → 400, not a crash', () => {
  assert.equal(resolvePath(root, '/%E0%A4%A').status, 400);
});
