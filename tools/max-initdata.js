// Эталонная проверка initData мини-приложения MAX (dev.max.ru/docs/webapps/validation) — для сверки серверной реализации.
// secret = HMAC-SHA256(key "WebAppData", msg токен бота); подпись = hex(HMAC-SHA256(secret, отсортированные пары без hash через \n)).
const crypto = require('node:crypto');

const MAX_AGE_SEC = 3600;
const SKEW_SEC = 60; // часы клиента могут спешить

function checkString(initData) {
  const pairs = [...new URLSearchParams(initData)].filter(([k]) => k !== 'hash');
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return pairs.map(([k, v]) => `${k}=${v}`).join('\n');
}
const secretKey = (botToken) => crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
const signature = (initData, botToken) => crypto.createHmac('sha256', secretKey(botToken)).update(checkString(initData)).digest('hex');

// Подписать поля (для тестов и локальной разработки): возвращает строку initData с hash.
function sign(fields, botToken) {
  const qs = new URLSearchParams(fields).toString();
  return `${qs}&hash=${signature(qs, botToken)}`;
}

function validate(initData, botToken, { now = Date.now(), maxAgeSec = MAX_AGE_SEC } = {}) {
  if (typeof initData !== 'string' || !initData) return { ok: false, reason: 'empty' };
  const params = new URLSearchParams(initData);
  const hash = (params.get('hash') || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: 'no_hash' };
  const expected = Buffer.from(signature(initData, botToken), 'hex');
  const got = Buffer.from(hash, 'hex');
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return { ok: false, reason: 'bad_hash' };
  const raw = Number(params.get('auth_date'));
  if (!Number.isFinite(raw) || raw <= 0) return { ok: false, reason: 'no_auth_date' };
  const authSec = raw > 1e12 ? raw / 1000 : raw; // единица в документации не указана
  const age = now / 1000 - authSec;
  if (age > maxAgeSec || age < -SKEW_SEC) return { ok: false, reason: 'expired' };
  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch (e) { return { ok: false, reason: 'bad_user' }; }
  return { ok: true, user, authDate: authSec, startParam: params.get('start_param'), chat: params.get('chat') };
}

module.exports = { validate, sign, checkString };
