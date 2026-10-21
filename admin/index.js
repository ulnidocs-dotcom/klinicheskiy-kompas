(function () {
  const { ui, store, auth } = KK;
  const ROLE = { doctor: 'Врач', psychologist: 'Клинический психолог', admin: 'Администратор' };
  const STATE = { pending: ['badge--info', 'приглашён'], expired: ['badge--warn', 'приглашение истекло'], revoked: ['badge--info', 'отозвано'] };
  const me = () => auth.staff('admin') || store.staffById('adm1');
  let flash = '';
  const inviteLink = (token) => new URL(`../auth/invite.html?token=${encodeURIComponent(token)}`, location.href).href;

  function side() {
    const m = me();
    ui.mount('#side', `
      <div class="d-brand">${ui.icon('route', 20)}<b>Компас</b><span class="dotrow" aria-hidden="true">· · ·· ····</span></div>
      <a href="index.html" aria-current="page">${ui.icon('users', 18)}<span>Сотрудники</span></a>
      <div class="d-me"><div class="d-me__who"><b>${ui.esc(m.name)}</b><span class="hint">администратор · ${ui.esc(store.clinicInfo().name)}</span>
        ${auth.session && auth.session.get() ? '<a class="hint" href="../auth/login.html?as=staff" data-logout>Выйти</a>' : ''}</div>
        ${KK.theme ? KK.theme.toggleHtml() : ''}</div>`);
  }
  function staffRow(s) {
    const self = s.id === me().id;
    return `<tr><td><b>${ui.esc(s.name)}</b><br><span class="hint">${ui.esc(s.email)}</span></td>
      <td>${ui.esc(ROLE[s.role])}${s.role === 'doctor' ? `<br><span class="hint">${ui.esc(s.specialty)}</span>` : ''}</td>
      <td>${s.status === 'active' ? '<span class="badge badge--ok">активен</span>' : '<span class="badge badge--warn">заблокирован</span>'}</td>
      <td>${s.role === 'admin' ? '—' : `<label class="row"><input type="checkbox" data-frmr="${ui.esc(s.id)}" ${s.frmrChecked ? 'checked' : ''}> проверено</label>`}</td>
      <td>${self ? '<span class="hint">это вы</span>' : `<button class="btn btn--ghost" data-block="${ui.esc(s.id)}">${s.status === 'active' ? 'Заблокировать' : 'Разблокировать'}</button>`}</td></tr>`;
  }
  function inviteRow(i) {
    const [cls, label] = STATE[i.state];
    return `<tr><td><b>${ui.esc(i.email)}</b><br><span class="hint">приглашение от ${ui.esc(ui.fmtDate(i.createdAt))}</span></td>
      <td>${ui.esc(ROLE[i.role])}</td><td><span class="badge ${cls}">${label}</span></td><td>—</td>
      <td><div class="row wrap">${i.state !== 'revoked' ? `<button class="btn btn--ghost" data-resend="${ui.esc(i.token)}">Отправить ещё раз</button>` : ''}
        ${i.state === 'pending' ? `<button class="btn btn--ghost" data-revoke="${ui.esc(i.token)}">Отозвать</button>` : ''}</div></td></tr>`;
  }
  function render() {
    const staff = store.staff();
    const invites = store.invites().filter((i) => i.state !== 'used').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    ui.preserveFocus(() => ui.mount('#app', `
      <div class="page-head"><h1>Сотрудники</h1></div>
      <section class="card stack" style="max-width:760px"><h2>Пригласить сотрудника</h2>
        <div class="row wrap" style="align-items:flex-end;gap:12px">
          <label class="field" style="flex:1 1 240px"><span class="hint">Рабочая почта</span><input id="inv-email" type="email"></label>
          <label class="field"><span class="hint">Роль</span><select id="inv-role">${Object.entries(ROLE).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
          <button class="btn btn--primary" data-invite>Пригласить</button></div>
        <p class="auth-err" id="err" role="alert"></p>
        ${flash ? `<p class="demo-note" role="status"><b>Демо:</b> письмо не отправляется. Ссылка приглашения: <a href="${ui.esc(flash)}">${ui.esc(flash)}</a></p>` : ''}
        <p class="hint">Ссылка действует 72 часа и подходит один раз. Перед приглашением врача проверьте его в Федеральном регистре медицинских работников (ФРМР).</p></section>
      <section class="card stack" style="margin-top:16px"><h2>Команда</h2>
        <table class="table admin-table"><thead><tr><th>Сотрудник</th><th>Роль</th><th>Статус</th><th>ФРМР</th><th></th></tr></thead>
          <tbody>${staff.map(staffRow).join('')}${invites.map(inviteRow).join('')}</tbody></table></section>`));
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-logout]')) { if (auth.session) auth.session.clear(); return; }
    if (e.target.closest('[data-invite]')) {
      try {
        const inv = store.inviteStaff(document.getElementById('inv-email').value, document.getElementById('inv-role').value, me().id);
        flash = inviteLink(inv.token);
      } catch (err) { document.getElementById('err').textContent = err.message; return; }
      render();
      return;
    }
    const rs = e.target.closest('[data-resend]');
    if (rs) { try { flash = inviteLink(store.resendInvite(rs.dataset.resend).token); } catch (err) { document.getElementById('err').textContent = err.message; } render(); return; }
    const rv = e.target.closest('[data-revoke]');
    if (rv) { store.revokeInvite(rv.dataset.revoke); render(); return; }
    const bl = e.target.closest('[data-block]');
    if (bl) { const s = store.staffById(bl.dataset.block); store.setStaff(s.id, { status: s.status === 'active' ? 'blocked' : 'active' }); render(); }
  });
  document.addEventListener('change', (e) => {
    const f = e.target.closest('[data-frmr]');
    if (f) { store.setStaff(f.dataset.frmr, { frmrChecked: f.checked }); render(); }
  });
  store.subscribe(() => { side(); render(); });
  side();
  render();
})();
