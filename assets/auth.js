// Помощники входа и регистрации: телефон, почта, надёжность пароля, сессия вкладки.
// В демо пароли нигде не сохраняются: при регистрации и смене проверяется только их надёжность.
(function (g) {
  const KK = g.KK = g.KK || {};
  const SESSION_KEY = 'kk:session';
  const COMMON = ['1234567890', '0987654321', 'qwerty', 'password', 'йцукен', 'пароль', '1q2w3e', 'qazwsx'];

  // Российский мобильный: 8…, 7…, +7… или 10 цифр с 9 — в формат +7XXXXXXXXXX.
  function normalizePhone(raw) {
    const d = String(raw || '').replace(/\D/g, '');
    const ten = d.length === 11 && (d[0] === '8' || d[0] === '7') ? d.slice(1) : d.length === 10 ? d : null;
    return ten && ten[0] === '9' ? `+7${ten}` : null;
  }
  const maskPhone = (p) => (p ? `${p.slice(0, 2)} ${p.slice(2, 5)} •••-••-${p.slice(-2)}` : '');
  const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(e));

  function passwordCheck(pw, email = '') {
    const s = String(pw || '');
    const low = s.toLowerCase();
    const local = normalizeEmail(email).split('@')[0];
    if (s.length < 10) return { ok: false, hint: 'Не короче 10 символов' };
    if (/^\d+$/.test(s)) return { ok: false, hint: 'Добавьте буквы: пароль только из цифр легко подобрать' };
    if (COMMON.some((c) => low.includes(c))) return { ok: false, hint: 'Слишком простой пароль, выберите другой' };
    if (local.length >= 3 && low.includes(local)) return { ok: false, hint: 'Пароль не должен содержать вашу почту' };
    const kinds = [/[a-zа-яё]/, /[A-ZА-ЯЁ]/, /\d/, /[^A-Za-zА-Яа-яЁё\d]/].filter((r) => r.test(s)).length;
    return { ok: true, hint: kinds >= 3 || s.length >= 14 ? 'Надёжный пароль' : 'Подойдёт. Длиннее или с цифрами и знаками — надёжнее' };
  }

  function createSession(storage) {
    return {
      get() { try { return JSON.parse(storage.getItem(SESSION_KEY)) || null; } catch (e) { return null; } },
      set(s) { try { storage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* приватный режим */ } },
      clear() { try { storage.removeItem(SESSION_KEY); } catch (e) { /* приватный режим */ } },
    };
  }

  KK.auth = { SESSION_KEY, normalizePhone, maskPhone, normalizeEmail, validEmail, passwordCheck, createSession };
  const ss = (() => { try { return g.sessionStorage || null; } catch (e) { return null; } })();
  KK.auth.session = ss ? createSession(ss) : null;
  // Вошедший через сайт сотрудник нужной роли (активный) — для подписи кабинета и режима подсказок врача.
  KK.auth.staff = (role) => {
    const s = KK.auth.session && KK.auth.session.get();
    if (!s || s.kind !== 'staff' || (role && s.role !== role) || !KK.store || !KK.store.staffById) return null;
    const st = KK.store.staffById(s.staffId);
    return st && st.status === 'active' ? st : null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
