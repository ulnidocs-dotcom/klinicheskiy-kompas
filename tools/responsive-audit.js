// Инструмент разработчика: проверка горизонтального переполнения всех страниц на узкой ширине.
// Запуск в браузере на любой странице прототипа: подключить скрипт и вызвать `await kkAudit(375)`.
(function (g) {
  const PAGES = [
    '/', '/ui-kit.html', '/variants.html',
    '/patient/index.html?p=p_olga', '/patient/path.html?p=p_olga', '/patient/therapy.html?p=p_olga',
    '/patient/chat.html?p=p_olga', '/patient/materials.html?p=p_olga', '/patient/material.html?p=p_olga&id=breathing',
    '/patient/help.html?p=p_olga', '/patient/profile.html?p=p_olga', '/patient/scale.html?p=p_olga&id=gad7',
    '/patient/intake.html?p=p_anna', '/patient/onboarding.html?p=p_anna', '/patient/onboarding.html?site=1&p=p_olga',
    '/doctor/index.html', '/doctor/patient.html?id=p_dmitry', '/doctor/assess.html?id=p_dmitry',
    '/doctor/therapy.html?id=p_galina', '/doctor/routing.html?id=p_dmitry', '/doctor/alerts.html',
    '/doctor/import.html?id=p_anna', '/doctor/messages.html?id=p_anna', '/doctor/materials.html', '/doctor/profile.html',
    '/psych/index.html', '/psych/patient.html?id=p_ilya', '/psych/materials.html', '/psych/profile.html',
  ];
  function describe(e) {
    const cls = typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '';
    return e.tagName.toLowerCase() + cls + (e.id ? '#' + e.id : '');
  }
  // Элемент считается «виновником», если он вылезает за ширину окна и не лежит внутри контейнера с собственной прокруткой.
  function scrollsInside(e, root) {
    for (let p = e.parentElement; p && p !== root; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
    }
    return false;
  }
  async function auditPage(url, width) {
    const f = document.createElement('iframe');
    f.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:800px;border:0;visibility:hidden`;
    document.body.appendChild(f);
    await new Promise((r) => { f.onload = r; f.src = url; });
    await new Promise((r) => setTimeout(r, 700));
    const d = f.contentDocument;
    const vw = d.documentElement.clientWidth;
    const sw = d.documentElement.scrollWidth;
    const offenders = [...d.body.querySelectorAll('*')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && !scrollsInside(e, d.body); })
      .filter((e) => ![...e.children].some((c) => c.getBoundingClientRect().right > vw + 1))
      .slice(0, 5).map((e) => `${describe(e)} → ${Math.round(e.getBoundingClientRect().right)}px`);
    const res = { url, vw, sw, overflow: sw > vw + 1, offenders, finalUrl: f.contentWindow.location.pathname };
    f.remove();
    return res;
  }
  g.kkAudit = async function (width = 375) {
    const out = [];
    for (const u of PAGES) out.push(await auditPage(u, width));
    return out.filter((r) => r.overflow || r.offenders.length);
  };
})(typeof window !== 'undefined' ? window : globalThis);
