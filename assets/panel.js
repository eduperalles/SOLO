(() => {
  const API = window.SOLO_API_URL || '';
  const token = sessionStorage.getItem('solo_session');
  const workspace = document.querySelector('#workspace');
  const toastNode = document.querySelector('#toast');
  let user = JSON.parse(sessionStorage.getItem('solo_user') || 'null');
  let users = [];
  let clients = [];
  let clientsTab = 'editor';
  let editingClientId = '';
  let selectedAccess = null;
  const canAccess = page => user?.access?.[page] === true;
  function paintAccess() {
    document.querySelectorAll('[data-page]').forEach(button => button.hidden = !canAccess(button.dataset.page));
    document.querySelector('#registrations-menu').hidden = !canAccess('users') && !canAccess('clients');
  }
  let activePage = 'dashboard';
  let editingId = '';
  let usersTab = 'editor';
  let financeTab = 'dashboard';
  let financeSubTab = 'records';
  let financeMonth = '';
  let financeYear = String(new Date().getFullYear());
  let financeRows = {receivables:[], payables:[]};
  let editingFinanceId = '';
  const userPhotos = new Map();
  let profile = null;
  let profilePhoto = '';
  let image = null;
  let removePhoto = false;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const initials = name => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'S';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toLocaleUpperCase('pt-BR');
  };
  const toast = (message, error = false) => {
    toastNode.textContent = message;
    toastNode.classList.toggle('error', error);
    toastNode.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toastNode.classList.remove('show'), 3400);
  };
  async function api(action, payload = {}) {
    if (!API) throw new Error('API administrativa não configurada.');
    const titles = {
      validateSession:'Validando acesso',
      listUsers:'Carregando usuários',
      listClients:'Carregando clientes',
      createClient:'Salvando cliente',
      updateClient:'Salvando cliente',
      deleteClient:'Excluindo cliente',
      getModuleAccess:'Carregando permissões',
      saveModuleAccess:'Salvando permissões',
      listFinanceReceivables:'Carregando contas a receber',
      listFinancePayables:'Carregando contas a pagar'
    };
    const finishLoading = window.SoloLoading?.start(titles[action] || 'Salvando informações');
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: {'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify({action, token, ...payload})
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.message || 'Falha ao processar a solicitação.');
      await finishLoading?.();
      return result.data;
    } catch (error) {
      await finishLoading?.(false);
      throw error;
    }
  }
  const avatarMarkup = (person, className = '', photo = '') => `<span class="avatar ${className}">${photo
    ? `<img src="${escapeHtml(photo)}" alt="Foto de ${escapeHtml(person?.nome || 'usuário')}">`
    : escapeHtml(initials(person?.nome))}</span>`;
  function clearSession() {
    sessionStorage.removeItem('solo_session');
    sessionStorage.removeItem('solo_user');
    location.replace('../login.html');
  }
  async function logout() {
    try { await api('logout'); } catch (_) {}
    clearSession();
  }
  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', logout));
  document.querySelector('#registrations-toggle').addEventListener('click', event => {
    const button = event.currentTarget;
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    document.querySelector('#registrations-items').hidden = !expanded;
  });
  document.querySelector('#mobile-menu').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));

  function paintIdentity(photo = profilePhoto) {
    document.querySelector('#user-name').textContent = user?.nome || 'Usuário';
    document.querySelector('#user-avatar').innerHTML = photo
      ? `<img src="${escapeHtml(photo)}" alt="Foto de ${escapeHtml(user?.nome || 'usuário')}">`
      : escapeHtml(initials(user?.nome));
  }
  async function loadOwnPhoto() {
    if (!user?.has_photo) return '';
    const result = await api('getMyProfilePhoto');
    profilePhoto = String(result.photo_data_url || '');
    paintIdentity();
    return profilePhoto;
  }

  let navigationVersion = 0;
  async function navigate(page) {
    const version = ++navigationVersion;
    try { user = await api('validateSession'); paintAccess(); } catch (error) { toast(error.message, true); return; }
    if (version !== navigationVersion) return;
    if (!canAccess(page)) {
      workspace.innerHTML = '<div class="workspace-state">Sem permissão para acessar este módulo.</div>';
      return;
    }
    activePage = page;
    if (['users','clients'].includes(page)) {
      document.querySelector('#registrations-items').hidden = false;
      document.querySelector('#registrations-toggle').setAttribute('aria-expanded','true');
    }
    document.querySelector('#registrations-toggle').classList.toggle('active', ['users','clients'].includes(page));
    document.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    document.querySelector('#page-title').textContent = page === 'users' ? 'Usuários' : page === 'clients' ? 'Clientes' : page === 'finance' ? 'Financeiro' : page === 'settings' ? 'Configurações' : 'Visão geral';
    document.querySelector('#sidebar').classList.remove('open');
    if (page === 'dashboard') renderDashboard();
    else if (page === 'users') void loadUsersPage();
    else if (page === 'clients') void loadClientsPage();
    else if (page === 'finance') void loadFinancePage();
    else if (page === 'settings') void loadSettingsPage();
  }
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.page)));

  function renderDashboard() {
    const admin = user?.perfil === 'admin';
    const userCount = admin ? users.length : 1;
    workspace.innerHTML = `
      <section class="welcome">
        ${avatarMarkup(user, '', profilePhoto)}
        <div><h2>Olá, ${escapeHtml(user?.nome || 'equipe SOLO')}.</h2><p>Gerencie usuários, clientes e acompanhe o financeiro do SOLO.</p></div>
      </section>
      <div class="stats">
        <div class="stat"><span>Usuários cadastrados</span><strong>${userCount}</strong></div>
        <div class="stat"><span>Módulos ativos</span><strong>${Object.values(user?.access || {}).filter(Boolean).length}</strong></div>
        <div class="stat"><span>Próxima etapa</span><strong style="font-size:18px">Em definição</strong></div>
      </div>
      <section class="content-card">
        <div class="card-head"><div><h2>Visão inicial</h2><p>Cadastros e financeiro estão disponíveis.</p></div></div>
        <div class="empty">Use o menu lateral para cadastrar acessos ou organizar contas a receber e contas a pagar.</div>
      </section>`;
  }

  const searchIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
  async function loadSettingsPage() {
    selectedAccess = null;
    workspace.innerHTML = '<div class="workspace-state">Carregando configurações…</div>';
    try {
      users = await api('listUsers');
      if (activePage !== 'settings') return;
      workspace.innerHTML = `<section class="content-card">
        <div class="card-head"><div><h2>Acessos por usuário</h2><p>Selecione um usuário pela lupa e defina os módulos disponíveis.</p></div></div>
        <div class="settings-content"><div class="field"><label for="access-user">Usuário selecionado</label>
          <div class="settings-selector"><input id="access-user" value="" placeholder="Selecione um usuário" readonly><button class="button" id="find-access-user" type="button" aria-label="Buscar usuário">${searchIcon}</button></div></div>
          <div id="access-editor" class="empty">Clique na lupa para escolher um usuário.</div>
        </div></section>`;
      document.querySelector('#find-access-user').addEventListener('click', openUserPicker);
    } catch (error) { if (activePage === 'settings') workspace.innerHTML = `<div class="workspace-state">${escapeHtml(error.message)}</div>`; }
  }
  function openUserPicker() {
    const dialog = document.createElement('dialog');
    dialog.className = 'user-picker';
    dialog.setAttribute('aria-labelledby','picker-title');
    dialog.innerHTML = `<div class="card-head"><h2 id="picker-title">Selecionar usuário</h2><button class="tiny-button" id="close-picker" type="button">Fechar</button></div>
      <div class="field"><label for="access-search">Buscar por nome ou e-mail</label><input id="access-search" type="search" placeholder="Digite para buscar…"></div><div id="access-results" class="picker-results"></div>`;
    document.body.append(dialog);
    const search = dialog.querySelector('#access-search');
    const results = dialog.querySelector('#access-results');
    const render = () => {
      const query = search.value.trim().toLocaleLowerCase('pt-BR');
      const found = users.filter(item => `${item.nome} ${item.email}`.toLocaleLowerCase('pt-BR').includes(query));
      results.innerHTML = found.length ? found.map(item => `<button type="button" class="picker-user" data-access-user="${escapeHtml(item.id)}"><span><b>${escapeHtml(item.nome)}</b><small>${escapeHtml(item.email)}</small></span><span class="badge">${item.perfil === 'admin' ? 'Administrador' : 'Operador'} · ${item.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></button>`).join('') : '<div class="empty">Nenhum usuário encontrado.</div>';
    };
    search.addEventListener('input', render);
    results.addEventListener('click', async event => {
      const button = event.target.closest('[data-access-user]');
      if (!button) return;
      dialog.close();
      const editor = document.querySelector('#access-editor');
      selectedAccess = null;
      document.querySelector('#access-user').value = '';
      editor.innerHTML = '<div class="empty">Carregando acessos…</div>';
      try {
        const result = await api('getModuleAccess', {id:button.dataset.accessUser});
        if (activePage !== 'settings' || !editor.isConnected) return;
        selectedAccess = result;
        document.querySelector('#access-user').value = `${result.user.nome} — ${result.user.email}`;
        renderAccessEditor();
      } catch (error) { if (editor.isConnected) editor.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
    });
    dialog.querySelector('#close-picker').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove(), {once:true});
    render(); dialog.showModal(); search.focus();
  }
  function renderAccessEditor() {
    const current = selectedAccess;
    const admin = current.user.perfil === 'admin';
    const editor = document.querySelector('#access-editor');
    editor.className = '';
    editor.innerHTML = `<form id="access-form"><p class="helper">${admin ? 'Administradores possuem acesso integral a todos os módulos.' : 'Marque os módulos autorizados. As alterações valem na próxima consulta ao sistema.'}</p>
      <div class="access-modules">${current.modules.map(module => `<label class="access-module"><input type="checkbox" name="${escapeHtml(module.id)}" ${current.access[module.id] ? 'checked' : ''} ${admin || module.adminOnly ? 'disabled' : ''}><span><b>${escapeHtml(module.name)}</b><small>${module.adminOnly ? 'Exclusivo dos administradores' : module.id === 'users' ? 'Cadastro de operadores; administradores só podem ser alterados por administradores' : 'Acesso ao módulo'}</small></span></label>`).join('')}</div>
      <p id="access-message" role="status"></p><div class="form-actions"><button class="button" type="submit" ${admin ? 'disabled' : ''}>Salvar permissões</button></div></form>`;
    editor.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      const message = editor.querySelector('#access-message');
      button.disabled = true;
      try {
        const access = Object.fromEntries(['dashboard','users','clients','finance'].map(key => [key,form.elements[key].checked]));
        const saved = await api('saveModuleAccess', {id:current.user.id,access,version:current.version});
        current.access = saved.access; current.version = saved.version;
        message.textContent = 'Permissões salvas com sucesso.';
        toast('Permissões salvas com sucesso.');
      } catch (error) { message.textContent = error.message; toast(error.message, true); }
      finally { button.disabled = false; }
    });
  }

  const todayInBrazil = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const displayClientDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : '—';
  function formatWhatsapp(value) {
    const digits = String(value || '').replace(/\D/g,'');
    const national = digits.startsWith('55') && [12,13].includes(digits.length) ? digits.slice(2) : digits;
    const prefix = national !== digits ? '+55 ' : '';
    if (national.length === 11) return prefix + national.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    if (national.length === 10) return prefix + national.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    return digits;
  }
  async function loadClientsPage() {
    workspace.innerHTML = '<div class="workspace-state">Carregando clientes…</div>';
    try {
      clients = await api('listClients');
      if (activePage === 'clients') renderClients();
    } catch (error) {
      if (activePage === 'clients') workspace.innerHTML = `<div class="workspace-state">${escapeHtml(error.message)}</div>`;
    }
  }
  function clientRows(filter = '') {
    const query = filter.trim().toLocaleLowerCase('pt-BR');
    const digits = query.replace(/\D/g,'');
    const visible = clients.filter(item => `${item.nome} ${item.email} ${formatWhatsapp(item.whatsapp)} ${displayClientDate(item.data_cadastro)}`.toLocaleLowerCase('pt-BR').includes(query) || (digits.length >= 3 && /^[+\d() .-]+$/.test(query) && item.whatsapp.includes(digits)));
    if (!visible.length) return '<div class="empty">Nenhum cliente encontrado.</div>';
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Cliente</th><th>E-mail</th><th>WhatsApp</th><th>Data de cadastro</th><th>Ações</th></tr></thead><tbody>${visible.map(item => `<tr>
      <td><span class="user-cell">${avatarMarkup(item)}<b>${escapeHtml(item.nome)}</b></span></td>
      <td>${escapeHtml(item.email)}</td><td>${escapeHtml(formatWhatsapp(item.whatsapp))}</td><td>${escapeHtml(displayClientDate(item.data_cadastro))}</td>
      <td><div class="row-actions"><button class="tiny-button" type="button" data-client-edit="${escapeHtml(item.id)}">Editar</button><button class="tiny-button danger" type="button" data-client-delete="${escapeHtml(item.id)}">Excluir</button></div></td>
    </tr>`).join('')}</tbody></table></div>`;
  }
  function renderClients() {
    const current = clients.find(item => item.id === editingClientId);
    workspace.innerHTML = `<div class="users-tabs" role="tablist" aria-label="Cadastro de clientes">
      <button class="users-tab ${clientsTab === 'editor' ? 'active' : ''}" type="button" role="tab" data-clients-tab="editor" aria-selected="${clientsTab === 'editor'}">Cadastro / edição</button>
      <button class="users-tab ${clientsTab === 'list' ? 'active' : ''}" type="button" role="tab" data-clients-tab="list" aria-selected="${clientsTab === 'list'}">Clientes cadastrados <span>${clients.length}</span></button></div>
      <section class="content-card users-tab-panel" data-clients-panel="editor" ${clientsTab === 'editor' ? '' : 'hidden'}>
        <div class="card-head"><div><h2>${current ? 'Editar cliente' : 'Cadastrar cliente'}</h2><p>Preencha os dados do cliente para manter o cadastro atualizado.</p></div></div>
        <form id="client-form" class="editor">
          <input type="hidden" name="id" value="${escapeHtml(current?.id || '')}">
          <input type="hidden" name="expected_updated_at" value="${escapeHtml(current?.atualizado_em || '')}">
          <div class="field"><label for="client-name">Nome completo</label><input id="client-name" name="nome" maxlength="180" minlength="2" autocomplete="name" value="${escapeHtml(current?.nome || '')}" required></div>
          <div class="field"><label for="client-email">E-mail</label><input id="client-email" name="email" type="email" maxlength="254" autocomplete="email" value="${escapeHtml(current?.email || '')}" required></div>
          <div class="field"><label for="client-whatsapp">WhatsApp</label><input id="client-whatsapp" name="whatsapp" type="tel" maxlength="24" autocomplete="tel" placeholder="(11) 99999-9999" value="${escapeHtml(formatWhatsapp(current?.whatsapp || ''))}" required><small class="helper">Informe o DDD. Para números internacionais, inclua o código do país.</small></div>
          <div class="field"><label for="client-date">Data de cadastro</label><input id="client-date" name="data_cadastro" type="date" value="${escapeHtml(current?.data_cadastro || todayInBrazil())}" required></div>
          <div class="form-actions"><button class="button button-secondary" type="reset">Limpar</button><button class="button" type="submit">Salvar cliente</button></div>
        </form></section>
      <section class="content-card users-tab-panel" data-clients-panel="list" ${clientsTab === 'list' ? '' : 'hidden'}>
        <div class="card-head"><div><h2>Clientes cadastrados</h2><p>${clients.length} registros disponíveis</p></div><div class="toolbar"><input id="clients-search" aria-label="Buscar clientes" placeholder="Buscar clientes…"></div></div>
        <div id="clients-table">${clientRows()}</div></section>`;
    const form = document.querySelector('#client-form');
    const search = document.querySelector('#clients-search');
    workspace.querySelectorAll('[data-clients-tab]').forEach(button => button.addEventListener('click', () => {
      clientsTab = button.dataset.clientsTab;
      workspace.querySelectorAll('[data-clients-tab]').forEach(tab => { const active = tab.dataset.clientsTab === clientsTab; tab.classList.toggle('active',active); tab.setAttribute('aria-selected',String(active)); });
      workspace.querySelectorAll('[data-clients-panel]').forEach(panel => panel.hidden = panel.dataset.clientsPanel !== clientsTab);
      if (clientsTab === 'list') search.focus();
    }));
    form.elements.whatsapp.addEventListener('blur', event => {
      if (/^[+\d() .-]+$/.test(event.target.value)) event.target.value = formatWhatsapp(event.target.value);
    });
    form.addEventListener('reset', event => { event.preventDefault(); editingClientId = ''; renderClients(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('[type="submit"]'); button.disabled = true;
      const record = Object.fromEntries(new FormData(form).entries());
      try {
        const saved = await api(record.id ? 'updateClient' : 'createClient', {record});
        const index = clients.findIndex(item => item.id === saved.id);
        if (index >= 0) clients[index] = saved; else clients.push(saved);
        editingClientId = ''; clientsTab = 'list';
        if (activePage === 'clients') renderClients();
        toast('Cliente salvo com sucesso.');
      } catch (error) { toast(error.message,true); }
      finally { button.disabled = false; }
    });
    search.addEventListener('input', () => { document.querySelector('#clients-table').innerHTML = clientRows(search.value); bindClientActions(); });
    bindClientActions();
  }
  function bindClientActions() {
    workspace.querySelectorAll('[data-client-edit]').forEach(button => button.addEventListener('click', () => {
      editingClientId = button.dataset.clientEdit; clientsTab = 'editor'; renderClients();
      workspace.querySelector('.content-card')?.scrollIntoView({behavior:'smooth'});
    }));
    workspace.querySelectorAll('[data-client-delete]').forEach(button => button.addEventListener('click', async () => {
      const selected = clients.find(item => item.id === button.dataset.clientDelete);
      if (!selected || !confirm(`Excluir o cliente ${selected.nome}?`)) return;
      button.disabled = true;
      try {
        await api('deleteClient', {id:selected.id,version:selected.atualizado_em});
        clients = clients.filter(item => item.id !== selected.id);
        if (editingClientId === selected.id) editingClientId = '';
        clientsTab = 'list';
        if (activePage === 'clients') renderClients();
        toast('Cliente excluído.');
      } catch (error) { button.disabled = false; toast(error.message,true); }
    }));
  }

  async function loadUsersPage() {
    workspace.innerHTML = '<div class="workspace-state">Carregando usuários…</div>';
    try {
      users = await api('listUsers');
      renderUsers();
      void hydrateUserPhotos(users);
    } catch (error) {
      workspace.innerHTML = `<div class="workspace-state">${escapeHtml(error.message)}</div>`;
      if (/sessão|session|autentic/i.test(error.message)) clearSession();
    }
  }
  function userRows(filter = '') {
    const query = filter.trim().toLocaleLowerCase('pt-BR');
    const visible = users.filter(item => `${item.nome} ${item.email} ${item.perfil} ${item.status}`.toLocaleLowerCase('pt-BR').includes(query));
    if (!visible.length) return '<div class="empty">Nenhum usuário encontrado.</div>';
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Usuário</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead><tbody>${visible.map(item => `
      <tr>
        <td><span class="user-cell">${avatarMarkup(item, '', userPhotos.get(item.id) || (item.id === user?.id ? profilePhoto : ''))}<b>${escapeHtml(item.nome)}</b></span></td>
        <td>${escapeHtml(item.email)}</td>
        <td>${item.perfil === 'admin' ? 'Administrador' : 'Operador'}</td>
        <td><span class="badge ${item.status === 'ativo' ? '' : 'inactive'}">${item.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></td>
        <td><div class="row-actions"><button class="tiny-button" type="button" data-edit="${escapeHtml(item.id)}">Editar</button><button class="tiny-button danger" type="button" data-delete="${escapeHtml(item.id)}" ${item.id === user.id ? 'disabled title="Não é possível excluir o usuário atual"' : ''}>Excluir</button></div></td>
      </tr>`).join('')}</tbody></table></div>`;
  }
  function renderUsers() {
    const current = users.find(item => item.id === editingId);
    workspace.innerHTML = `
      <div class="users-tabs" role="tablist" aria-label="Cadastro de usuários">
        <button class="users-tab ${usersTab === 'editor' ? 'active' : ''}" type="button" role="tab" data-users-tab="editor" aria-selected="${usersTab === 'editor'}">Cadastro / edição</button>
        <button class="users-tab ${usersTab === 'list' ? 'active' : ''}" type="button" role="tab" data-users-tab="list" aria-selected="${usersTab === 'list'}">Usuários cadastrados <span>${users.length}</span></button>
      </div>
      <section class="content-card users-tab-panel" data-users-panel="editor" ${usersTab === 'editor' ? '' : 'hidden'}>
        <div class="card-head"><div><h2>${current ? 'Editar usuário' : 'Cadastrar usuário'}</h2><p>Gerencie os cadastros permitidos para seu acesso.</p></div></div>
        <form id="user-form" class="editor">
          <input type="hidden" name="id" value="${escapeHtml(current?.id || '')}">
          <div class="field"><label for="user-form-name">Nome completo</label><input id="user-form-name" name="nome" maxlength="180" value="${escapeHtml(current?.nome || '')}" required></div>
          <div class="field"><label for="user-form-email">E-mail</label><input id="user-form-email" name="email" type="email" maxlength="254" value="${escapeHtml(current?.email || '')}" required></div>
          <div class="field"><label for="user-form-role">Perfil</label><select id="user-form-role" name="perfil" required><option value="operador" ${current?.perfil !== 'admin' ? 'selected' : ''}>Operador</option><option value="admin" ${user.perfil !== 'admin' ? 'disabled' : ''} ${current?.perfil === 'admin' ? 'selected' : ''}>Administrador</option></select></div>
          <div class="field"><label for="user-form-status">Status</label><select id="user-form-status" name="status" required><option value="ativo" ${current?.status !== 'inativo' ? 'selected' : ''}>Ativo</option><option value="inativo" ${current?.status === 'inativo' ? 'selected' : ''}>Inativo</option></select></div>
          <div class="field full"><label for="user-form-password">${current ? 'Nova senha (opcional)' : 'Senha'}</label><div class="password-field"><input id="user-form-password" name="senha" type="password" minlength="4" maxlength="12" autocomplete="new-password" ${current ? '' : 'required'}><button class="password-toggle" type="button" data-password-toggle aria-label="Mostrar senha">◉</button></div><small class="helper">Entre 4 e 12 caracteres.</small></div>
          <div class="form-actions"><button class="button button-secondary" type="reset">Limpar</button><button class="button" type="submit">Salvar usuário</button></div>
        </form>
      </section>
      <section class="content-card users-tab-panel" data-users-panel="list" ${usersTab === 'list' ? '' : 'hidden'}>
        <div class="card-head"><div><h2>Usuários cadastrados</h2><p>${users.length} registros disponíveis</p></div><div class="toolbar"><input id="users-search" aria-label="Buscar usuários" placeholder="Buscar usuários…"></div></div>
        <div id="users-table">${userRows()}</div>
      </section>`;
    bindUserPage();
  }
  function bindUserPage() {
    const form = document.querySelector('#user-form');
    const search = document.querySelector('#users-search');
    const password = form.querySelector('[name="senha"]');
    workspace.querySelectorAll('[data-users-tab]').forEach(button => button.addEventListener('click', () => {
      usersTab = button.dataset.usersTab;
      workspace.querySelectorAll('[data-users-tab]').forEach(tab => {
        const active = tab.dataset.usersTab === usersTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      workspace.querySelectorAll('[data-users-panel]').forEach(panel => panel.hidden = panel.dataset.usersPanel !== usersTab);
      if (usersTab === 'list') search.focus();
    }));
    form.querySelector('[data-password-toggle]').addEventListener('click', event => {
      password.type = password.type === 'password' ? 'text' : 'password';
      event.currentTarget.setAttribute('aria-label', password.type === 'text' ? 'Ocultar senha' : 'Mostrar senha');
    });
    form.addEventListener('reset', event => {
      event.preventDefault();
      editingId = '';
      renderUsers();
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      const record = Object.fromEntries(new FormData(form).entries());
      const action = record.id ? 'updateUser' : 'createUser';
      try {
        const saved = await api(action, {record});
        const index = users.findIndex(item => item.id === saved.id);
        if (index >= 0) users[index] = saved;
        else users.push(saved);
        editingId = '';
        usersTab = 'list';
        renderUsers();
        toast('Usuário salvo com sucesso.');
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
    search.addEventListener('input', () => {
      document.querySelector('#users-table').innerHTML = userRows(search.value);
      bindTableActions();
    });
    bindTableActions();
  }
  function bindTableActions() {
    workspace.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
      editingId = button.dataset.edit;
      usersTab = 'editor';
      renderUsers();
      workspace.querySelector('.content-card')?.scrollIntoView({behavior:'smooth'});
    }));
    workspace.querySelectorAll('[data-delete]:not(:disabled)').forEach(button => button.addEventListener('click', async () => {
      const selected = users.find(item => item.id === button.dataset.delete);
      if (!selected || !confirm(`Excluir o usuário ${selected.nome}?`)) return;
      button.disabled = true;
      try {
        await api('deleteUser', {id:selected.id});
        users = users.filter(item => item.id !== selected.id);
        usersTab = 'list';
        renderUsers();
        toast('Usuário excluído.');
      } catch (error) {
        button.disabled = false;
        toast(error.message, true);
      }
    }));
  }

  async function loadFinancePage() {
    workspace.innerHTML = '<div class="workspace-state">Carregando módulo financeiro…</div>';
    try {
      const [receivables, payables] = await Promise.all([
        api('listFinanceReceivables'),
        api('listFinancePayables')
      ]);
      financeRows = {receivables, payables};
      renderFinance();
    } catch (error) {
      workspace.innerHTML = `<div class="workspace-state">${escapeHtml(error.message)}</div>`;
      if (/sessão|session|autentic/i.test(error.message)) clearSession();
    }
  }

  const money = value => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(Number(value) || 0);
  const financeLabel = type => type === 'receivables' ? 'Contas a receber' : 'Contas a pagar';
  const financePersonLabel = type => type === 'receivables' ? 'Cliente / responsável' : 'Fornecedor / beneficiário';
  function hydrateUserPhotos(list) {
    const ids = list.filter(item => item.has_photo && !userPhotos.has(item.id)).map(item => item.id).slice(0, 50);
    if (!ids.length) return Promise.resolve();
    return api('getUserPhotos', {ids}).then(result => {
      Object.entries(result.photos || {}).forEach(([id, photo]) => {
        if (photo.photo_data_url) userPhotos.set(id, photo.photo_data_url);
      });
      if (activePage === 'users') {
        const search = document.querySelector('#users-search');
        const table = document.querySelector('#users-table');
        if (table) table.innerHTML = userRows(search?.value || '');
        bindTableActions();
      }
    }).catch(() => {});
  }
  function financeRowsMarkup(type, query = '', month = '', year = '') {
    const search = query.trim().toLocaleLowerCase('pt-BR');
    const rows = financeRows[type].filter(row => {
      const date = String(row.status === 'pago' ? row.data_pagamento : row.data_vencimento);
      return `${row.descricao} ${row.pessoa} ${row.categoria} ${row.status}`.toLocaleLowerCase('pt-BR').includes(search)
        && (!year || date.startsWith(year))
        && (!month || date.slice(5, 7) === month);
    });
    if (!rows.length) return '<div class="empty">Nenhum lançamento financeiro encontrado.</div>';
    return `<div class="data-table-wrap"><table class="data-table finance-table"><thead><tr><th>Descrição</th><th>${financePersonLabel(type)}</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows.map(row => `
      <tr>
        <td><b>${escapeHtml(row.descricao)}</b>${row.categoria ? `<small class="table-subtext">${escapeHtml(row.categoria)}</small>` : ''}</td>
        <td>${escapeHtml(row.pessoa || '—')}</td>
        <td><strong>${money(row.valor)}</strong></td>
        <td>${escapeHtml(formatDate(row.data_vencimento))}</td>
        <td><span class="badge ${row.status === 'pago' ? '' : 'finance-pending'}">${row.status === 'pago' ? 'Pago' : 'Pendente'}</span></td>
        <td><div class="row-actions"><button class="tiny-button" type="button" data-finance-edit="${escapeHtml(row.id)}">Editar</button><button class="tiny-button danger" type="button" data-finance-delete="${escapeHtml(row.id)}">Excluir</button></div></td>
      </tr>`).join('')}</tbody></table></div>`;
  }
  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '—';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  function parseCurrency(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    return (Number(digits) / 100).toFixed(2);
  }
  function maskCurrency(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    return new Intl.NumberFormat('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}).format(Number(digits) / 100);
  }
  function financeMonthOptions(selected = financeMonth) {
    const names = ['Todos os meses','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return names.map((name, index) => `<option value="${index ? String(index).padStart(2,'0') : ''}" ${selected === (index ? String(index).padStart(2,'0') : '') ? 'selected' : ''}>${name}</option>`).join('');
  }
  function financeYearOptions() {
    const current = new Date().getFullYear();
    const years = new Set([current, ...financeRows.receivables.concat(financeRows.payables).map(row => Number(String(row.data_vencimento || row.data_pagamento).slice(0,4))).filter(Boolean)]);
    return [...years].sort((a,b) => b-a).map(year => `<option value="${year}" ${String(year) === financeYear ? 'selected' : ''}>${year}</option>`).join('');
  }
  function financeDashboardMarkup() {
    const rows = [...financeRows.receivables, ...financeRows.payables];
    const periodRows = rows.filter(row => {
      const date = String(row.status === 'pago' ? row.data_pagamento : row.data_vencimento);
      return (!financeYear || date.startsWith(financeYear)) && (!financeMonth || date.slice(5,7) === financeMonth);
    });
    const receivables = periodRows.filter((_, index) => index < financeRows.receivables.length && financeRows.receivables.includes(_));
    const payables = periodRows.filter((_, index) => financeRows.payables.includes(_));
    const receivePending = receivables.filter(row => row.status === 'pendente').reduce((sum,row) => sum + Number(row.valor), 0);
    const receivePaid = receivables.filter(row => row.status === 'pago').reduce((sum,row) => sum + Number(row.valor), 0);
    const payPending = payables.filter(row => row.status === 'pendente').reduce((sum,row) => sum + Number(row.valor), 0);
    const payPaid = payables.filter(row => row.status === 'pago').reduce((sum,row) => sum + Number(row.valor), 0);
    const values = [receivePaid, receivePending, payPaid, payPending];
    const max = Math.max(1, ...values);
    const bars = [
      ['Recebido', receivePaid, 'received'],
      ['A receber', receivePending, 'pending'],
      ['Pago', payPaid, 'paid'],
      ['A pagar', payPending, 'overdue']
    ];
    const balance = receivePaid - payPaid;
    return `
      <section class="finance-period">
        <label>Mês<select id="finance-dashboard-month">${financeMonthOptions()}</select></label>
        <label>Ano<select id="finance-dashboard-year">${financeYearOptions()}</select></label>
      </section>
      <div class="stats finance-stats">
        <div class="stat"><span>Saldo realizado</span><strong class="${balance < 0 ? 'negative-value' : ''}">${money(balance)}</strong></div>
        <div class="stat"><span>Total a receber</span><strong>${money(receivePending)}</strong></div>
        <div class="stat"><span>Total a pagar</span><strong>${money(payPending)}</strong></div>
      </div>
      <section class="content-card finance-chart-card">
        <div class="card-head"><div><h2>Visão financeira</h2><p>Valores do período selecionado.</p></div></div>
        <div class="finance-bars" role="img" aria-label="Gráfico dos valores realizados e pendentes">
          ${bars.map(([label,value,type]) => `<div class="finance-bar-item"><div class="finance-bar-label"><span>${label}</span><strong>${money(value)}</strong></div><div class="finance-bar-track"><span class="finance-bar ${type}" style="width:${Math.max(value ? 2 : 0, value/max*100)}%"></span></div></div>`).join('')}
        </div>
      </section>
      <section class="content-card">
        <div class="card-head"><div><h2>Fluxo por categoria</h2><p>Receitas e despesas cadastradas no período.</p></div></div>
        ${categoryChartMarkup(receivables, payables)}
      </section>`;
  }
  function categoryChartMarkup(receivables, payables) {
    const totals = new Map();
    receivables.forEach(row => { const key=row.categoria || 'Sem categoria'; totals.set(key,(totals.get(key)||0)+Number(row.valor)); });
    payables.forEach(row => { const key=row.categoria || 'Sem categoria'; totals.set(key,(totals.get(key)||0)-Number(row.valor)); });
    const entries=[...totals].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,6);
    if (!entries.length) return '<div class="empty">Cadastre lançamentos para visualizar o fluxo por categoria.</div>';
    const max=Math.max(1,...entries.map(([,value])=>Math.abs(value)));
    return `<div class="category-chart">${entries.map(([name,value])=>`<div><span>${escapeHtml(name)}</span><i><b class="${value<0?'negative':''}" style="width:${Math.abs(value)/max*100}%"></b></i><strong>${money(value)}</strong></div>`).join('')}</div>`;
  }
  function renderFinance() {
    if (financeTab === 'dashboard') {
      workspace.innerHTML = `${financeMainTabs()}${financeDashboardMarkup()}`;
      bindFinance();
      return;
    }
    const current = financeRows[financeTab].find(row => row.id === editingFinanceId);
    const type = financeTab;
    workspace.innerHTML = `
      ${financeMainTabs()}
      <section class="content-card finance-summary">
        <div><span>Total pendente</span><strong>${money(financeRows[type].filter(row => row.status === 'pendente').reduce((sum, row) => sum + (Number(row.valor) || 0), 0))}</strong></div>
        <div><span>Total pago</span><strong>${money(financeRows[type].filter(row => row.status === 'pago').reduce((sum, row) => sum + (Number(row.valor) || 0), 0))}</strong></div>
        <div><span>Lançamentos</span><strong>${financeRows[type].length}</strong></div>
      </section>
      <div class="users-tabs finance-subtabs" role="tablist" aria-label="${financeLabel(type)}">
        <button class="users-tab ${financeSubTab === 'records' ? 'active' : ''}" type="button" role="tab" data-finance-subtab="records" aria-selected="${financeSubTab === 'records'}">Registros</button>
        <button class="users-tab ${financeSubTab === 'register' ? 'active' : ''}" type="button" role="tab" data-finance-subtab="register" aria-selected="${financeSubTab === 'register'}">Cadastro</button>
      </div>
      <section class="content-card" data-finance-panel="register" ${financeSubTab === 'register' ? '' : 'hidden'}>
        <div class="card-head"><div><h2>${current ? 'Editar lançamento' : `Nova ${type === 'receivables' ? 'conta a receber' : 'conta a pagar'}`}</h2><p>${financeLabel(type)}.</p></div></div>
        <form id="finance-form" class="editor" novalidate>
          <input type="hidden" name="id" value="${escapeHtml(current?.id || '')}">
          <div class="field"><label for="finance-description">Descrição *</label><input id="finance-description" name="descricao" maxlength="180" value="${escapeHtml(current?.descricao || '')}" required></div>
          <div class="field"><label for="finance-person">${financePersonLabel(type)}</label><input id="finance-person" name="pessoa" maxlength="180" value="${escapeHtml(current?.pessoa || '')}"></div>
          <div class="field"><label for="finance-category">Categoria</label><input id="finance-category" name="categoria" maxlength="120" value="${escapeHtml(current?.categoria || '')}" placeholder="Ex.: Serviços, fornecedores"></div>
          <div class="field"><label for="finance-value">Valor (R$) *</label><input id="finance-value" name="valor" type="text" inputmode="decimal" value="${escapeHtml(current ? maskCurrency(Number(current.valor)*100) : '')}" placeholder="0,00" required></div>
          <div class="field"><label for="finance-due">Vencimento *</label><input id="finance-due" name="data_vencimento" type="date" value="${escapeHtml(current?.data_vencimento || '')}" required></div>
          <div class="field"><label for="finance-status">Status *</label><select id="finance-status" name="status"><option value="pendente" ${current?.status !== 'pago' ? 'selected' : ''}>Pendente</option><option value="pago" ${current?.status === 'pago' ? 'selected' : ''}>Pago</option></select></div>
          <div class="field"><label for="finance-paid">Data do pagamento</label><input id="finance-paid" name="data_pagamento" type="date" value="${escapeHtml(current?.data_pagamento || '')}" ${current?.status === 'pago' ? '' : 'disabled'}></div>
          <div class="field full"><label for="finance-notes">Observações</label><textarea id="finance-notes" name="observacoes" maxlength="2000" rows="3">${escapeHtml(current?.observacoes || '')}</textarea></div>
          <div class="form-actions"><button class="button button-secondary" type="reset">Limpar</button><button class="button" type="submit">Salvar lançamento</button></div>
        </form>
      </section>
      <section class="content-card" data-finance-panel="records" ${financeSubTab === 'records' ? '' : 'hidden'}>
        <div class="card-head"><div><h2>${financeLabel(type)}</h2><p>Registros sincronizados com o CSV privado do Drive.</p></div><div class="toolbar finance-filters"><input id="finance-search" aria-label="Buscar lançamentos" placeholder="Buscar lançamentos…"><select id="finance-filter-month" aria-label="Filtrar por mês">${financeMonthOptions()}</select><select id="finance-filter-year" aria-label="Filtrar por ano"><option value="">Todos os anos</option>${financeYearOptions()}</select></div></div>
        <div id="finance-table">${financeRowsMarkup(type,'',financeMonth,financeYear)}</div>
      </section>`;
    bindFinance();
  }
  function financeMainTabs() {
    return `<div class="users-tabs finance-tabs" role="tablist" aria-label="Módulo financeiro">
      <button class="users-tab ${financeTab === 'dashboard' ? 'active' : ''}" type="button" role="tab" data-finance-tab="dashboard" aria-selected="${financeTab === 'dashboard'}">Dashboard</button>
      <button class="users-tab ${financeTab === 'receivables' ? 'active' : ''}" type="button" role="tab" data-finance-tab="receivables" aria-selected="${financeTab === 'receivables'}">Contas a receber <span>${financeRows.receivables.length}</span></button>
      <button class="users-tab ${financeTab === 'payables' ? 'active' : ''}" type="button" role="tab" data-finance-tab="payables" aria-selected="${financeTab === 'payables'}">Contas a pagar <span>${financeRows.payables.length}</span></button>
    </div>`;
  }
  function bindFinance() {
    workspace.querySelectorAll('[data-finance-tab]').forEach(button => button.addEventListener('click', () => {
      financeTab = button.dataset.financeTab;
      editingFinanceId = '';
      renderFinance();
    }));
    const dashboardMonth = document.querySelector('#finance-dashboard-month');
    const dashboardYear = document.querySelector('#finance-dashboard-year');
    if (dashboardMonth) dashboardMonth.addEventListener('change', event => { financeMonth = event.target.value; renderFinance(); });
    if (dashboardYear) dashboardYear.addEventListener('change', event => { financeYear = event.target.value; renderFinance(); });
    const form = document.querySelector('#finance-form');
    if (!form) return;
    const status = form.querySelector('[name="status"]');
    const paid = form.querySelector('[name="data_pagamento"]');
    const value = form.querySelector('[name="valor"]');
    const search = document.querySelector('#finance-search');
    const monthFilter = document.querySelector('#finance-filter-month');
    const yearFilter = document.querySelector('#finance-filter-year');
    workspace.querySelectorAll('[data-finance-subtab]').forEach(button => button.addEventListener('click', () => {
      financeSubTab = button.dataset.financeSubtab;
      workspace.querySelectorAll('[data-finance-subtab]').forEach(tab => {
        const active = tab.dataset.financeSubtab === financeSubTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      workspace.querySelectorAll('[data-finance-panel]').forEach(panel => panel.hidden = panel.dataset.financePanel !== financeSubTab);
    }));
    value.addEventListener('input', event => event.target.value = maskCurrency(event.target.value));
    status.addEventListener('change', () => {
      paid.disabled = status.value !== 'pago';
      if (status.value !== 'pago') paid.value = '';
      else if (!paid.value) paid.value = new Date().toISOString().slice(0,10);
    });
    form.addEventListener('reset', event => {
      event.preventDefault();
      editingFinanceId = '';
      renderFinance();
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      const record = Object.fromEntries(new FormData(form).entries());
      record.valor = parseCurrency(record.valor);
      try {
        const isReceivable = financeTab === 'receivables';
        const saved = await api(isReceivable ? 'saveFinanceReceivable' : 'saveFinancePayable', {record});
        const index = financeRows[financeTab].findIndex(row => row.id === saved.id);
        if (index >= 0) financeRows[financeTab][index] = saved;
        else financeRows[financeTab].push(saved);
        editingFinanceId = '';
        financeSubTab = 'records';
        renderFinance();
        toast('Lançamento financeiro salvo.');
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
    search.addEventListener('input', () => {
      document.querySelector('#finance-table').innerHTML = financeRowsMarkup(financeTab, search.value, financeMonth, financeYear);
      bindFinanceTableActions();
    });
    monthFilter.addEventListener('change', event => {
      financeMonth = event.target.value;
      document.querySelector('#finance-table').innerHTML = financeRowsMarkup(financeTab, search.value, financeMonth, financeYear);
      bindFinanceTableActions();
    });
    yearFilter.addEventListener('change', event => {
      financeYear = event.target.value;
      document.querySelector('#finance-table').innerHTML = financeRowsMarkup(financeTab, search.value, financeMonth, financeYear);
      bindFinanceTableActions();
    });
    bindFinanceTableActions();
  }
  function bindFinanceTableActions() {
    workspace.querySelectorAll('[data-finance-edit]').forEach(button => button.addEventListener('click', () => {
      editingFinanceId = button.dataset.financeEdit;
      financeSubTab = 'register';
      renderFinance();
      document.querySelector('#finance-form')?.scrollIntoView({behavior:'smooth'});
    }));
    workspace.querySelectorAll('[data-finance-delete]').forEach(button => button.addEventListener('click', async () => {
      const selected = financeRows[financeTab].find(row => row.id === button.dataset.financeDelete);
      if (!selected || !confirm(`Excluir "${selected.descricao}"?`)) return;
      button.disabled = true;
      try {
        await api(financeTab === 'receivables' ? 'deleteFinanceReceivable' : 'deleteFinancePayable', {id:selected.id});
        financeRows[financeTab] = financeRows[financeTab].filter(row => row.id !== selected.id);
        renderFinance();
        toast('Lançamento excluído.');
      } catch (error) {
        button.disabled = false;
        toast(error.message, true);
      }
    }));
  }

  function createProfileDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'profile-dialog';
    dialog.innerHTML = `
      <form id="profile-form" class="dialog-form">
        <header class="dialog-heading"><div><p class="eyebrow">Minha conta</p><h2>Alterar perfil</h2><p class="helper">Atualize seus dados e a foto usada no painel.</p></div><button class="tiny-button" type="button" data-profile-close aria-label="Fechar">×</button></header>
        <p id="profile-message" class="dialog-message" role="status"></p>
        <section class="profile-photo">
          <div class="avatar" id="profile-current">${escapeHtml(initials(user?.nome))}</div>
          <div><label for="profile-photo">Escolher foto</label><input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp"><p class="helper">JPEG, PNG ou WebP de até 10 MB.</p><button class="tiny-button" id="remove-photo" type="button">Remover foto</button></div>
        </section>
        <section id="crop-area" hidden>
          <canvas id="crop-canvas" width="512" height="512" aria-label="Prévia do recorte"></canvas>
          <label>Zoom<input id="crop-zoom" type="range" min="1" max="3" step=".01" value="1"></label>
          <label>Posição horizontal<input id="crop-x" type="range" min="0" max="100" value="50"></label>
          <label>Posição vertical<input id="crop-y" type="range" min="0" max="100" value="50"></label>
        </section>
        <div class="profile-grid">
          <div class="field"><label for="profile-name">Nome completo *</label><input id="profile-name" name="nome" maxlength="180" required></div>
          <div class="field"><label for="profile-email">E-mail *</label><input id="profile-email" name="email" type="email" maxlength="254" required></div>
          <div class="field"><label for="profile-current-password">Senha atual</label><div class="password-field"><input id="profile-current-password" type="password" autocomplete="current-password"><button class="password-toggle" type="button" data-password-toggle aria-label="Mostrar senha">◉</button></div><small class="helper">Necessária para alterar e-mail ou senha.</small></div>
          <div class="field"><label for="profile-new-password">Nova senha (opcional)</label><div class="password-field"><input id="profile-new-password" name="senha" type="password" minlength="4" maxlength="12" autocomplete="new-password"><button class="password-toggle" type="button" data-password-toggle aria-label="Mostrar senha">◉</button></div></div>
        </div>
        <footer class="dialog-actions"><button class="button button-secondary" type="button" data-profile-close>Cancelar</button><button class="button" id="profile-save" type="submit">Salvar perfil</button></footer>
      </form>`;
    document.body.append(dialog);
    dialog.querySelectorAll('[data-password-toggle]').forEach(button => button.addEventListener('click', () => {
      const input = button.previousElementSibling;
      input.type = input.type === 'password' ? 'text' : 'password';
    }));
    dialog.querySelectorAll('[data-profile-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    bindProfile(dialog);
    return dialog;
  }
  function bindProfile(dialog) {
    const form = dialog.querySelector('#profile-form');
    const message = dialog.querySelector('#profile-message');
    const cropArea = dialog.querySelector('#crop-area');
    const canvas = dialog.querySelector('#crop-canvas');
    const context = canvas.getContext('2d');
    const zoom = dialog.querySelector('#crop-zoom');
    const posX = dialog.querySelector('#crop-x');
    const posY = dialog.querySelector('#crop-y');
    const draw = () => {
      if (!image) return;
      const side = Math.min(image.naturalWidth, image.naturalHeight) / Number(zoom.value);
      const x = (image.naturalWidth - side) * Number(posX.value) / 100;
      const y = (image.naturalHeight - side) * Number(posY.value) / 100;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, 512, 512);
      context.drawImage(image, x, y, side, side, 0, 0, 512, 512);
    };
    [zoom, posX, posY].forEach(input => input.addEventListener('input', draw));
    dialog.querySelector('#profile-photo').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw Error('Escolha uma imagem JPEG, PNG ou WebP de até 10 MB.');
        const source = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(Error('Não foi possível ler a imagem.'));
          reader.readAsDataURL(file);
        });
        const loaded = new Image();
        loaded.src = source;
        await loaded.decode();
        if (!loaded.naturalWidth || loaded.naturalWidth * loaded.naturalHeight > 40000000) throw Error('Escolha uma foto de até 40 megapixels.');
        image = loaded;
        removePhoto = false;
        cropArea.hidden = false;
        zoom.value = '1';
        posX.value = posY.value = '50';
        draw();
        message.textContent = 'Ajuste o recorte e salve para enviar a foto.';
      } catch (error) {
        image = null;
        cropArea.hidden = true;
        event.target.value = '';
        message.textContent = error.message;
        message.classList.add('error');
      }
    });
    dialog.querySelector('#remove-photo').addEventListener('click', () => {
      image = null;
      removePhoto = true;
      cropArea.hidden = true;
      dialog.querySelector('#profile-photo').value = '';
      dialog.querySelector('#profile-current').textContent = 'Sem foto';
      message.classList.remove('error');
      message.textContent = 'A foto será removida ao salvar.';
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!profile || !form.reportValidity()) return;
      const record = {
        nome: dialog.querySelector('#profile-name').value,
        email: dialog.querySelector('#profile-email').value,
        senha: dialog.querySelector('#profile-new-password').value,
        current_password: dialog.querySelector('#profile-current-password').value,
        expected_updated_at: profile.updated_at,
        remove_photo: removePhoto
      };
      if ((record.email.toLocaleLowerCase('pt-BR') !== profile.email.toLocaleLowerCase('pt-BR') || record.senha) && !record.current_password) {
        message.textContent = 'Informe a senha atual para alterar o e-mail ou a senha.';
        message.classList.add('error');
        return;
      }
      if (image) {
        record.foto_data_url = canvas.toDataURL('image/jpeg', .86);
        if (record.foto_data_url.length > 400100) record.foto_data_url = canvas.toDataURL('image/jpeg', .62);
        if (record.foto_data_url.length > 400100) {
          message.textContent = 'A imagem ficou muito grande. Escolha outra foto.';
          message.classList.add('error');
          return;
        }
      }
      const save = dialog.querySelector('#profile-save');
      save.disabled = true;
      message.classList.remove('error');
      message.textContent = 'Salvando seu perfil…';
      try {
        const result = await api('saveMyProfile', {record});
        user = result.user;
        sessionStorage.setItem('solo_user', JSON.stringify(user));
        profilePhoto = record.foto_data_url || (removePhoto ? '' : profilePhoto);
        paintIdentity();
        dialog.close();
        paintAccess();
        void navigate(activePage);
        toast('Perfil atualizado com sucesso.');
      } catch (error) {
        message.textContent = error.message;
        message.classList.add('error');
      } finally {
        save.disabled = false;
      }
    });
  }

  const profileDialog = createProfileDialog();
  document.querySelector('#open-profile').addEventListener('click', async () => {
    const form = profileDialog.querySelector('#profile-form');
    form.reset();
    image = null;
    removePhoto = false;
    profile = null;
    profileDialog.querySelector('#crop-area').hidden = true;
    const message = profileDialog.querySelector('#profile-message');
    message.classList.remove('error');
    message.textContent = 'Carregando seu perfil…';
    profileDialog.showModal();
    try {
      profile = await api('getMyProfile');
      profileDialog.querySelector('#profile-name').value = profile.nome || '';
      profileDialog.querySelector('#profile-email').value = profile.email || '';
      const current = profileDialog.querySelector('#profile-current');
      current.innerHTML = profilePhoto
        ? `<img src="${escapeHtml(profilePhoto)}" alt="Foto de ${escapeHtml(profile.nome)}">`
        : escapeHtml(initials(profile.nome));
      message.textContent = '';
    } catch (error) {
      message.classList.add('error');
      message.textContent = error.message;
    }
  });

  async function start() {
    if (!token || !API) return clearSession();
    try {
      user = await api('validateSession');
      sessionStorage.setItem('solo_user', JSON.stringify(user));
      paintIdentity();
      paintAccess();
      if (user.perfil === 'admin') {
        try { users = await api('listUsers'); } catch (_) {}
      }
      await loadOwnPhoto();
      const firstPage = ['dashboard','finance','users','clients','settings'].find(canAccess);
      if (firstPage) navigate(firstPage);
      else {
        document.querySelector('#page-title').textContent = 'Acesso restrito';
        workspace.innerHTML = '<div class="workspace-state">Nenhum módulo liberado. Solicite acesso ao administrador. Seu perfil continua disponível no canto superior.</div>';
      }
    } catch (_) {
      clearSession();
    }
  }
  void start();
})();
