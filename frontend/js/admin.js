/*
 * Administração de usuários (ADMIN) e painel "Jovens online" (ADMIN e GESTÃO).
 * Depende do app.js (window.PondeApp).
 */
(function () {
  'use strict';
  const { $, api, toast, dialog, escapeHtml, timeAgo, focusYoung, META } = window.PondeApp;
  const ROLE = { ADMIN: 'Administrador', GESTAO: 'Gestão', JOVEM: 'Jovem Aprendiz' };
  const STATUS = { ATIVO: ['Ativo', 'ok'], PENDENTE: ['Aguardando aprovação', 'warn'], INATIVO: ['Desativado', 'off'], RECUSADO: ['Recusado', 'bad'] };
  const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();
  const icons = () => window.lucide && window.lucide.createIcons && window.lucide.createIcons();
  const post = (path, body, method = 'POST') => api(path, { method, body: body ? JSON.stringify(body) : undefined });

  /* =====================  GERENCIAR USUÁRIOS  ===================== */
  let users = [];
  const filters = { q: '', role: '', status: '' };

  async function loadAdmin() {
    try {
      users = (await api('/api/users')).users;
      renderAdmin();
    } catch (error) { toast(error.message, 'error'); }
  }

  function renderAdmin() {
    const count = (fn) => users.filter(fn).length;
    $('adm-total').textContent = users.length;
    $('adm-active').textContent = count((u) => u.status === 'ATIVO');
    $('adm-pending').textContent = count((u) => u.status === 'PENDENTE');
    $('adm-online').textContent = count((u) => u.online);
    renderQueues();
    renderUsersTable();
    icons();
  }

  function renderQueues() {
    const pending = users.filter((u) => u.status === 'PENDENTE');
    const resets = users.filter((u) => u.resetRequestedAt && u.status !== 'RECUSADO');
    $('adm-queues').hidden = !pending.length && !resets.length;
    $('adm-pending-box').hidden = !pending.length;
    $('adm-pending-list').innerHTML = pending.map((u) => `<div class="queue-item"><div class="avatar">${initial(u.nome)}</div><div class="queue-main"><strong>${escapeHtml(u.nome)}</strong><span>${escapeHtml(u.email)} · ${escapeHtml(u.cargo || 'Cargo não informado')}</span>${u.justificativa ? `<em>“${escapeHtml(u.justificativa)}”</em>` : ''}<small>Pediu acesso ${timeAgo(u.createdAt)}</small></div><div class="queue-actions"><button class="btn-mini ok" data-act="approve" data-id="${u.id}">Aprovar</button><button class="btn-mini bad" data-act="reject" data-id="${u.id}">Recusar</button></div></div>`).join('');
    $('adm-reset-box').hidden = !resets.length;
    $('adm-reset-list').innerHTML = resets.map((u) => `<div class="queue-item"><div class="avatar">${initial(u.nome)}</div><div class="queue-main"><strong>${escapeHtml(u.nome)}</strong><span>${escapeHtml(u.email)}</span><small>Pediu nova senha ${timeAgo(u.resetRequestedAt)}</small></div><div class="queue-actions">${u.principal ? '<small>Use “npm run admin:reset”</small>' : `<button class="btn-mini" data-act="reset" data-id="${u.id}">Definir senha temporária</button>`}</div></div>`).join('');
  }

  function filteredUsers() {
    const q = filters.q.trim().toLowerCase();
    return users.filter((u) => (!q || `${u.nome} ${u.email} ${u.cargo || ''}`.toLowerCase().includes(q)) && (!filters.role || u.role === filters.role) && (!filters.status || u.status === filters.status));
  }

  function renderUsersTable() {
    const rows = filteredUsers();
    $('adm-count').textContent = `${rows.length} de ${users.length} conta(s)`;
    $('table-admin-users').innerHTML = rows.length ? rows.map((u) => {
      const [label, tone] = STATUS[u.status] || [u.status, 'off'];
      const locked = u.principal || u.role === 'ADMIN';
      const roleCell = locked ? `<span class="role-pill admin">${ROLE[u.role]}</span>` : `<select class="role-select" data-act="role" data-id="${u.id}" aria-label="Perfil de ${escapeHtml(u.nome)}"><option value="JOVEM" ${u.role === 'JOVEM' ? 'selected' : ''}>Jovem Aprendiz</option><option value="GESTAO" ${u.role === 'GESTAO' ? 'selected' : ''}>Gestão</option></select>`;
      const actions = [`<button class="icon-btn" data-act="edit" data-id="${u.id}" title="Editar dados"><i data-lucide="pencil"></i></button>`];
      if (!locked) {
        actions.push(`<button class="icon-btn" data-act="reset" data-id="${u.id}" title="Redefinir senha"><i data-lucide="key-round"></i></button>`);
        if (u.status === 'ATIVO') actions.push(`<button class="icon-btn" data-act="deactivate" data-id="${u.id}" title="Desativar acesso"><i data-lucide="user-x"></i></button>`);
        else if (u.status === 'INATIVO' || u.status === 'RECUSADO') actions.push(`<button class="icon-btn" data-act="activate" data-id="${u.id}" title="Reativar acesso"><i data-lucide="user-check"></i></button>`);
        else if (u.status === 'PENDENTE') actions.push(`<button class="icon-btn ok" data-act="approve" data-id="${u.id}" title="Aprovar"><i data-lucide="check"></i></button>`);
        actions.push(`<button class="icon-btn danger" data-act="remove" data-id="${u.id}" title="Remover"><i data-lucide="trash-2"></i></button>`);
      }
      return `<tr><td class="px-4 py-3"><div class="user-cell"><div class="avatar">${initial(u.nome)}<span class="presence-dot ${u.online ? 'is-on' : ''}"></span></div><div><div class="font-semibold text-slate-800">${escapeHtml(u.nome)}${u.resetRequestedAt ? ' <span class="tag-reset" title="Pediu nova senha">senha?</span>' : ''}</div><div class="text-xs text-slate-400">${escapeHtml(u.email)}${u.cargo ? ' · ' + escapeHtml(u.cargo) : ''}</div></div></div></td><td class="px-4 py-3">${roleCell}</td><td class="px-4 py-3"><span class="status-pill ${tone}">${label}</span></td><td class="px-4 py-3 font-semibold">${u.pesquisas}</td><td class="px-4 py-3 text-xs text-slate-500">${u.online ? '<span class="live-text">Online agora</span>' : timeAgo(u.lastSeenAt || u.lastLoginAt)}</td><td class="px-4 py-3"><div class="row-actions">${actions.join('')}</div></td></tr>`;
    }).join('') : '<tr><td colspan="6" class="px-4 py-10 text-center text-slate-400">Nenhuma conta encontrada com esses filtros.</td></tr>';
    icons();
  }

  const byId = (id) => users.find((u) => u.id === Number(id));
  const done = async (message) => { toast(message, 'success'); await loadAdmin(); };

  async function onAction(act, id) {
    const u = byId(id);
    if (!u) return;
    if (act === 'approve') { await post(`/api/users/${u.id}/approve`); return done(`Acesso de ${u.nome} aprovado.`); }
    if (act === 'reject') return confirmBox({ title: 'Recusar solicitação?', text: `${u.nome} não poderá entrar no sistema.`, label: 'Recusar', danger: true, run: async () => { await post(`/api/users/${u.id}/reject`); await done('Solicitação recusada.'); } });
    if (act === 'activate') { await post(`/api/users/${u.id}/status`, { status: 'ATIVO' }, 'PATCH'); return done('Acesso reativado.'); }
    if (act === 'deactivate') return confirmBox({ title: 'Desativar acesso?', text: `${u.nome} será desconectado(a) e não poderá entrar até ser reativado(a). O histórico de pesquisas é preservado.`, label: 'Desativar', danger: true, run: async () => { await post(`/api/users/${u.id}/status`, { status: 'INATIVO' }, 'PATCH'); await done('Conta desativada.'); } });
    if (act === 'remove') return confirmBox({ title: 'Remover usuário?', text: `Se ${u.nome} já tiver pesquisas coletadas, a conta será apenas desativada para preservar o histórico. Caso contrário, será excluída.`, label: 'Remover', danger: true, run: async () => { const r = await api(`/api/users/${u.id}`, { method: 'DELETE' }); await done(r.message); } });
    if (act === 'reset') return confirmBox({ title: 'Redefinir senha?', text: `Será gerada uma senha temporária para ${u.nome}. Ele(a) será desconectado(a) e precisará criar uma nova senha no próximo acesso.`, label: 'Gerar senha temporária', run: async () => { const r = await post(`/api/users/${u.id}/reset-password`); await loadAdmin(); showTempPassword(u, r.temporaryPassword); } });
    if (act === 'edit') return editUser(u);
  }

  function confirmBox({ title, text, label, danger, run }) {
    dialog({ title, icon: danger ? 'triangle-alert' : 'key-round', tone: danger ? 'red' : 'teal', body: `<p class="dlg-text">${escapeHtml(text)}</p>`, actions: [{ label: 'Cancelar' }, { label, kind: danger ? 'danger' : 'primary', onClick: async () => { await run(); } }] });
  }

  function showTempPassword(u, password) {
    const d = dialog({
      title: 'Senha temporária gerada', icon: 'key-round', dismissible: false,
      body: `<p class="dlg-text">Entregue esta senha a <strong>${escapeHtml(u.nome)}</strong>. Ela <strong>só aparece agora</strong> e deve ser trocada no primeiro acesso.</p><div class="temp-pass"><code id="temp-pass-value">${escapeHtml(password)}</code><button type="button" class="btn-mini" id="temp-pass-copy">Copiar</button></div>`,
      actions: [{ label: 'Concluir', kind: 'primary' }]
    });
    d.box.querySelector('#temp-pass-copy').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(password); e.target.textContent = 'Copiado!'; } catch { toast('Copie manualmente a senha exibida.', 'info'); }
    });
  }

  function editUser(u) {
    dialog({
      title: 'Editar dados', icon: 'pencil',
      body: `<label class="dlg-label" for="eu-nome">Nome</label><input id="eu-nome" class="field" value="${escapeHtml(u.nome)}"><label class="dlg-label" for="eu-email">E-mail</label><input id="eu-email" type="email" class="field" value="${escapeHtml(u.email)}" ${u.role === 'ADMIN' ? 'disabled' : ''}><label class="dlg-label" for="eu-cargo">Cargo / função</label><input id="eu-cargo" class="field" value="${escapeHtml(u.cargo || '')}" maxlength="120">`,
      actions: [{ label: 'Cancelar' }, { label: 'Salvar', kind: 'primary', onClick: async ({ box }) => {
        const body = { nome: box.querySelector('#eu-nome').value, cargo: box.querySelector('#eu-cargo').value };
        if (u.role !== 'ADMIN') body.email = box.querySelector('#eu-email').value;
        await post(`/api/users/${u.id}`, body, 'PATCH'); await done('Dados atualizados.');
      } }]
    });
  }

  function newUser() {
    const d = dialog({
      title: 'Novo usuário', icon: 'user-plus',
      body: `<label class="dlg-label" for="nu-nome">Nome completo</label><input id="nu-nome" class="field"><label class="dlg-label" for="nu-email">E-mail</label><input id="nu-email" type="email" class="field"><label class="dlg-label" for="nu-role">Perfil</label><select id="nu-role" class="field"><option value="JOVEM">Jovem Aprendiz</option><option value="GESTAO">Gestão</option></select><label class="dlg-label" for="nu-cargo">Cargo / função (opcional)</label><input id="nu-cargo" class="field"><label class="dlg-label" for="nu-senha">Senha inicial</label><div class="inline-row"><input id="nu-senha" class="field" type="text" autocomplete="off" placeholder="Mínimo de 6 caracteres"><button type="button" class="btn-light" id="nu-gen">Gerar</button></div><p class="dlg-hint">Anote a senha para entregar ao usuário. Ele poderá alterá-la em “Alterar senha”.</p>`,
      actions: [{ label: 'Cancelar' }, { label: 'Criar usuário', kind: 'primary', onClick: async ({ box }) => {
        const v = (id) => box.querySelector(id).value.trim();
        if (v('#nu-senha').length < 6) { toast('A senha precisa ter pelo menos 6 caracteres.', 'error'); return false; }
        await post('/api/users', { nome: v('#nu-nome'), email: v('#nu-email'), role: v('#nu-role'), cargo: v('#nu-cargo'), senha: box.querySelector('#nu-senha').value });
        await done('Usuário criado.');
      } }]
    });
    d.box.querySelector('#nu-gen').addEventListener('click', () => {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      const bytes = crypto.getRandomValues(new Uint32Array(10));
      d.box.querySelector('#nu-senha').value = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
    });
  }

  /* =====================  JOVENS ONLINE  ===================== */
  let presence = null;
  let presenceTimer = null;
  const pf = { q: '', mode: 'all' };

  async function loadPresence(silent) {
    try {
      presence = await api(`/api/presence/online?date=${window.PondeApp.today()}`);
      renderPresence();
    } catch (error) { if (!silent) toast(error.message, 'error'); }
  }
  function startPresence() {
    stopPresence();
    loadPresence(false);
    presenceTimer = setInterval(() => { if (document.visibilityState === 'visible') loadPresence(true); }, 15000);
  }
  function stopPresence() { if (presenceTimer) clearInterval(presenceTimer); presenceTimer = null; }

  function renderPresence() {
    if (!presence) return;
    const s = presence.summary;
    $('on-online').textContent = s.jovensOnline;
    $('on-total').textContent = `de ${s.jovensTotal} jovem(ns) ativo(s)`;
    $('on-today').textContent = s.collectedToday;
    $('on-goal').textContent = s.jovensTotal ? `${Math.round((s.collectedToday / (s.jovensTotal * META)) * 100)}% da meta somada` : '—';
    $('on-updated').textContent = `Atualizado às ${new Date(presence.serverTime).toLocaleTimeString('pt-BR')}`;
    const q = pf.q.trim().toLowerCase();
    const list = presence.people.filter((p) => (!q || `${p.nome} ${p.email}`.toLowerCase().includes(q)) && (pf.mode === 'all' || (pf.mode === 'online' && p.online) || (pf.mode === 'offline' && !p.online) || (pf.mode === 'collecting' && p.todayCount > 0)));
    document.querySelectorAll('#on-filters [data-mode]').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === pf.mode));
    const badge = $('nav-badge-online');
    if (badge) { badge.textContent = s.jovensOnline; badge.classList.toggle('hidden-force', !s.jovensOnline); }
    $('on-grid').innerHTML = list.length ? list.map((p) => {
      const pct = p.role === 'JOVEM' ? Math.min(100, Math.round((p.todayCount / META) * 100)) : 0;
      return `<article class="person-card ${p.online ? 'is-online' : ''}"><div class="person-top"><div class="avatar big">${initial(p.nome)}<span class="presence-dot ${p.online ? 'is-on' : ''}"></span></div><div class="person-id"><strong>${escapeHtml(p.nome)}</strong><span>${ROLE[p.role]}${p.cargo ? ' · ' + escapeHtml(p.cargo) : ''}</span></div></div><div class="person-status ${p.online ? 'live' : ''}">${p.online ? '<i></i> Online agora' : 'Visto ' + timeAgo(p.lastSeenAt).replace('nunca acessou', 'nunca')}</div>${p.role === 'JOVEM' ? `<div class="person-progress"><div class="pp-head"><span>Hoje</span><strong>${p.todayCount} / ${META}</strong></div><div class="mini-bar big"><span style="width:${pct}%"></span></div></div><button class="btn-mini" data-focus="${p.id}">Ver desempenho</button>` : ''}</article>`;
    }).join('') : '<p class="empty-note">Ninguém corresponde a este filtro agora.</p>';
  }

  /* =====================  Ligações  ===================== */
  document.addEventListener('DOMContentLoaded', () => {
    $('adm-new').addEventListener('click', newUser);
    $('adm-search').addEventListener('input', (e) => { filters.q = e.target.value; renderUsersTable(); });
    $('adm-role').addEventListener('change', (e) => { filters.role = e.target.value; renderUsersTable(); });
    $('adm-status').addEventListener('change', (e) => { filters.status = e.target.value; renderUsersTable(); });
    $('view-admin').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (btn && btn.tagName === 'BUTTON') onAction(btn.dataset.act, btn.dataset.id).catch((err) => toast(err.message, 'error'));
    });
    $('view-admin').addEventListener('change', async (e) => {
      if (e.target.dataset.act !== 'role') return;
      try { await post(`/api/users/${e.target.dataset.id}/role`, { role: e.target.value }, 'PATCH'); await done('Perfil atualizado.'); }
      catch (err) { toast(err.message, 'error'); loadAdmin(); }
    });
    $('on-search').addEventListener('input', (e) => { pf.q = e.target.value; renderPresence(); });
    $('on-filters').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) { pf.mode = b.dataset.mode; renderPresence(); } });
    $('on-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-focus]'); if (b) focusYoung(b.dataset.focus); });
  });

  window.PondeAdmin = { load: loadAdmin };
  window.PondeOnline = { load: startPresence, stop: stopPresence };
  const previousAfterLogin = window.PondeHooks.afterLogin;
  window.PondeHooks.afterLogin = (result) => {
    if (previousAfterLogin) previousAfterLogin(result);
    // Gestão e administrador veem o contador de jovens online no menu mesmo fora da tela.
    if (result.user.role !== 'JOVEM') loadPresence(true);
  };
})();
