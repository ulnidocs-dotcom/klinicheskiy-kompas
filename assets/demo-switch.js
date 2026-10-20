// ВРЕМЕННО (демо): плавающий переключатель «Пациент | Врач | Психолог» на всех страницах.
// Удаление: убрать этот файл и тег <script src="…assets/demo-switch.js"> из HTML.
(function (g) {
  const KK = g.KK;
  if (!KK || !KK.store || typeof document === 'undefined') return;
  const path = location.pathname;
  const inPatient = /\/patient\//.test(path);
  const inDoctor = /\/doctor\//.test(path);
  const inPsych = /\/psych\//.test(path);
  const base = inPatient || inDoctor || inPsych ? '../' : '';
  const params = new URLSearchParams(location.search);
  const known = (id) => !!(id && KK.store.patient(id));
  let pid = inDoctor || inPsych ? params.get('id') : params.get('p');
  if (!known(pid)) { try { pid = sessionStorage.getItem('kk:pid'); } catch (e) { pid = null; } }
  if (!known(pid)) pid = KK.store.activePatientId();

  const style = document.createElement('style');
  style.textContent = `
    .demo-switch{position:fixed;z-index:45;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:4px;border-radius:999px;background:var(--surface);border:1px solid var(--line);box-shadow:0 6px 24px rgba(0,0,0,.25);font:500 13px/1 var(--font-body, system-ui);bottom:calc(16px + env(safe-area-inset-bottom, 0px))}
    .demo-switch.over-tabs{bottom:calc(76px + env(safe-area-inset-bottom, 0px))}
    .demo-switch .tag{padding:0 8px 0 10px;color:var(--text-3);font-size:11px;letter-spacing:.06em;text-transform:uppercase}
    .demo-switch a{display:inline-flex;align-items:center;min-height:36px;padding:0 16px;border-radius:999px;color:var(--text);text-decoration:none}
    .demo-switch a[aria-current="page"]{background:var(--text);color:var(--bg)}
    .demo-switch a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}`;
  document.head.appendChild(style);

  const nav = document.createElement('nav');
  nav.className = 'demo-switch' + (document.querySelector('.tabbar') || inPatient ? ' over-tabs' : '');
  nav.setAttribute('aria-label', 'Демо: переключение кабинета');
  nav.innerHTML = `<span class="tag">Демо</span>
    <a href="${base}patient/index.html?p=${encodeURIComponent(pid)}" data-demo-role="patient" ${inPatient ? 'aria-current="page"' : ''}>Пациент</a>
    <a href="${base}doctor/patient.html?id=${encodeURIComponent(pid)}" ${inDoctor ? 'aria-current="page"' : ''}>Врач</a>
    <a href="${base}${KK.store.patient(pid)?.intake ? `psych/patient.html?id=${encodeURIComponent(pid)}` : 'psych/index.html'}" ${inPsych ? 'aria-current="page"' : ''}>Психолог</a>`;
  document.body.appendChild(nav);

  // Переход в кабинет пациента без онбординга — только для демо.
  nav.addEventListener('click', (e) => {
    if (e.target.closest('[data-demo-role="patient"]')) {
      try { localStorage.setItem(`kk:linked:${pid}`, 'true'); } catch (err) { /* приватный режим */ }
    }
  });
  // Пересчитать отступ, когда таб-бар дорисуется оболочкой.
  setTimeout(() => { if (document.querySelector('.tabbar')) nav.classList.add('over-tabs'); else if (!inPatient) nav.classList.remove('over-tabs'); }, 0);
})(typeof window !== 'undefined' ? window : globalThis);
