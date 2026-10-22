// Инструмент разработчика: проверка выравнивания текста на всех страницах.
// Запуск в браузере на любой странице прототипа: подключить скрипт и вызвать `await kkTextAudit(375)`.
// Ищет: текст кнопки не по центру по вертикали, кнопки с разорванной подписью, текст, который не помещается
// в свой блок, флажок/радио не на уровне первой строки подписи, поля формы разной высоты в одном ряду.
(function (g) {
  const PAGES = [
    '/', '/auth/demo.html', '/auth/login.html', '/auth/login.html?as=staff', '/auth/recover.html', '/admin/index.html',
    '/patient/index.html?p=p_olga', '/patient/path.html?p=p_olga', '/patient/therapy.html?p=p_olga',
    '/patient/chat.html?p=p_olga', '/patient/chat.html?p=p_olga&mode=assistant', '/patient/materials.html?p=p_olga',
    '/patient/material.html?p=p_olga&id=breathing', '/patient/help.html?p=p_olga', '/patient/profile.html?p=p_olga',
    '/patient/scale.html?p=p_olga&id=gad7', '/patient/intake.html?p=p_anna', '/patient/onboarding.html?p=p_anna',
    '/patient/onboarding.html?site=1&p=p_olga', '/patient/previsit.html?p=p_sergey',
    '/doctor/index.html', '/doctor/patient.html?id=p_dmitry', '/doctor/patient.html?id=p_olga', '/doctor/assess.html?id=p_dmitry',
    '/doctor/therapy.html?id=p_galina', '/doctor/routing.html?id=p_dmitry', '/doctor/alerts.html',
    '/doctor/import.html?id=p_anna', '/doctor/messages.html?id=p_anna', '/doctor/materials.html', '/doctor/profile.html',
    '/psych/index.html', '/psych/patient.html?id=p_ilya', '/psych/materials.html', '/psych/profile.html',
  ];
  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const label = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''} «${(e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)}»`;
  // Прямоугольник текста внутри элемента (по текстовым узлам).
  function textRect(el, d) {
    const r = d.createRange();
    const rects = [];
    const walker = d.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.textContent.trim()) continue;
      r.selectNodeContents(n);
      for (const x of r.getClientRects()) if (x.width > 0) rects.push(x);
    }
    if (!rects.length) return null;
    return { top: Math.min(...rects.map((x) => x.top)), bottom: Math.max(...rects.map((x) => x.bottom)), lines: new Set(rects.map((x) => Math.round(x.top))).size };
  }
  function checkDoc(d, w) {
    const out = [];
    for (const b of d.querySelectorAll('button, .btn, .chip, .badge, a.help-call, .seg button, .choice, .auth-tabs button')) {
      if (!visible(b) || b.closest('[hidden]')) continue;
      const br = b.getBoundingClientRect();
      const tr = textRect(b, d);
      if (!tr) continue;
      const cs = getComputedStyle(b);
      const pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
      const inner = { top: br.top + pt + parseFloat(cs.borderTopWidth), bottom: br.bottom - pb - parseFloat(cs.borderBottomWidth) };
      const off = (tr.top + tr.bottom) / 2 - (inner.top + inner.bottom) / 2;
      // Флекс-контейнеры с иконкой/несколькими строками (карточки-выбор) проверяем только на крупный сдвиг.
      const tol = b.classList.contains('choice') || b.classList.contains('help-call') ? 8 : 3;
      if (Math.abs(off) > tol && br.height < 90) out.push(`текст не по центру (${off.toFixed(1)}px): ${label(b)}`);
      if (tr.lines > 1 && br.height < 70 && !b.classList.contains('choice') && !b.classList.contains('help-call') && (b.innerText || '').trim().length < 40) out.push(`подпись в ${tr.lines} строки: ${label(b)}`);
    }
    for (const e of d.querySelectorAll('body *')) {
      if (!visible(e) || e.children.length) continue;
      const s = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && s.overflowX === 'hidden' && s.textOverflow !== 'ellipsis' && (e.innerText || '').trim()) out.push(`текст обрезан: ${label(e)}`);
    }
    for (const lab of d.querySelectorAll('label')) {
      const box = lab.querySelector('input[type=checkbox], input[type=radio]');
      if (!box || !visible(lab)) continue;
      const tr = textRect(lab, d);
      if (!tr) continue;
      const br = box.getBoundingClientRect();
      const firstLineMid = tr.top + Math.min(tr.bottom - tr.top, parseFloat(getComputedStyle(lab).lineHeight) || 20) / 2;
      const off = (br.top + br.bottom) / 2 - firstLineMid;
      if (Math.abs(off) > 6) out.push(`флажок не на уровне текста (${off.toFixed(1)}px): ${label(lab)}`);
    }
    for (const row of d.querySelectorAll('.row')) {
      const ctrls = [...row.children].filter((c) => visible(c) && c.matches('button, .btn, input:not([type=checkbox]):not([type=radio]), select'));
      if (ctrls.length < 2) continue;
      const hs = ctrls.map((c) => Math.round(c.getBoundingClientRect().height));
      const tops = ctrls.map((c) => Math.round(c.getBoundingClientRect().top));
      if (new Set(tops).size === 1 && Math.max(...hs) - Math.min(...hs) > 4) out.push(`разная высота кнопок/полей в ряду: ${ctrls.map((c) => label(c) + ' ' + Math.round(c.getBoundingClientRect().height)).join(' | ')}`);
    }
    return [...new Set(out)].slice(0, 12);
  }
  async function auditPage(url, width) {
    const f = document.createElement('iframe');
    f.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:900px;border:0;visibility:hidden`;
    document.body.appendChild(f);
    await new Promise((r) => { f.onload = r; f.src = url; });
    await new Promise((r) => setTimeout(r, 600));
    let issues;
    try { issues = checkDoc(f.contentDocument, width); } catch (e) { issues = [`ошибка проверки: ${e.message}`]; }
    const res = { url, final: f.contentWindow.location.pathname + f.contentWindow.location.search, issues };
    f.remove();
    return res;
  }
  g.kkTextAudit = async function (width = 375, pages = PAGES) {
    const out = [];
    for (const u of pages) { const r = await auditPage(u, width); if (r.issues.length) out.push(r); }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
