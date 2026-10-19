(function () {
  const { ui, store, doctorApp: D } = KK;
  D.start({ nav: 'profile' });
  const SPECS = ['терапевт', 'врач общей практики', 'невролог', 'кардиолог', 'эндокринолог', 'психиатр', 'психотерапевт'];
  function render() {
    const d = store.doctor();
    ui.mount('#app', `
      <div class="page-head"><h1>Профиль</h1></div>
      <section class="card stack" style="max-width:560px">
        <label class="field"><span class="hint">ФИО</span><input id="name" value="${ui.esc(d.name)}"></label>
        <label class="field"><span class="hint">Специальность</span><select id="spec">${SPECS.map((s) => `<option ${s === d.specialty ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <p class="hint">Режим: <b>${d.mode === 'psychiatrist' ? 'специалист — компактно, без пояснений' : 'с подсказками — пояснения к шкалам и шагам маршрутизации'}</b>. Определяется специальностью.</p>
        <label class="row"><input type="checkbox" id="sound" ${d.sound === false ? '' : 'checked'}> Звук критических алертов</label>
        <div class="row"><button class="btn btn--primary" data-save>Сохранить</button><span class="hint" id="msg" role="status"></span></div>
      </section>
      <section class="card stack" style="max-width:560px;margin-top:16px"><h2>Демо</h2>
        <p class="hint">Сброс вернёт 5 сценариев в исходное состояние на этом устройстве.</p>
        <button class="btn" data-reset>Сбросить демо-данные</button></section>`);
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-save]')) {
      const spec = document.getElementById('spec').value;
      store.setDoctor({ name: document.getElementById('name').value.trim() || 'Врач', specialty: spec, mode: D.modeFor(spec), sound: document.getElementById('sound').checked });
      render(); document.getElementById('msg').textContent = 'Сохранено';
    }
    if (e.target.closest('[data-reset]') && confirm('Сбросить демо-данные?')) {
      try { D.demoDeviceKeys(Object.keys(localStorage)).forEach((k) => localStorage.removeItem(k)); } catch (err) { /* приватный режим */ }
      store.reset(); location.href = 'index.html';
    }
  });
  render();
})();
