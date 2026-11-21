(() => {
  const API = window.SOLO_API_URL || '';
  const token = sessionStorage.getItem('solo_session');
  const workspace = document.querySelector('#workspace');
  const toastNode = document.querySelector('#toast');
  let user = JSON.parse(sessionStorage.getItem('solo_user') || 'null');
  let users = [];
  let clients = [];
  let suppliers = [];
  let products = [];
  let siteMenuConfig = { menu_titulo: 'Eventos', secao_titulo: 'Eventos & Celebrações', secao_subtitulo: '', ativo: '1' };
  let siteCards = [];
  let clientsTab = 'editor';
  let suppliersTab = 'editor';
  let productsTab = 'editor';
  let siteMenuTab = 'config';
  let editingClientId = '';
  let editingSupplierId = '';
  let editingProductId = '';
  let productPhoto = '';
  let editingCardId = '';
  let cardPhotos = [];
  let selectedAccess = null;
  let settingsTab = 'access';
  const canAccess = page => user?.access?.[page] === true;
  function paintAccess() {
    document.querySelectorAll('[data-page]').forEach(button => button.hidden = !canAccess(button.dataset.page));
    document.querySelector('#registrations-menu').hidden = !canAccess('users') && !canAccess('clients') && !canAccess('suppliers') && !canAccess('products') && !canAccess('site_menu');
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
  const money = value => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(Number(value) || 0);
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
  let dashboardData = { receivables: [], payables: [], clients: [], orders: [] };
  let dashFinanceYear = String(new Date().getFullYear());
  let dashFinanceType = 'all';
  let dashClientsYear = String(new Date().getFullYear());
  let dashClientsMonth = '';
  let dashOrdersYear = String(new Date().getFullYear());
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
      listSuppliers:'Carregando fornecedores',
      listProducts:'Carregando produtos',
      createProduct:'Salvando produto',
      updateProduct:'Salvando produto',
      deleteProduct:'Excluindo produto',
      listOrders:'Carregando pedidos',
      retryOrder:'Concluindo gravação do pedido',
      deleteOrder:'Excluindo pedido',
      createClient:'Salvando cliente',
      updateClient:'Salvando cliente',
      deleteClient:'Excluindo cliente',
      getSiteMenuAdmin:'Carregando Menu Site',
      saveSiteMenuConfig:'Salvando configurações do menu',
      saveSiteCard:'Salvando card',
      deleteSiteCard:'Excluindo card',
      createSupplier:'Salvando fornecedor',
      updateSupplier:'Salvando fornecedor',
      deleteSupplier:'Excluindo fornecedor',
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
    if (['users','clients','suppliers','products','site_menu'].includes(page)) {
      document.querySelector('#registrations-items').hidden = false;
      document.querySelector('#registrations-toggle').setAttribute('aria-expanded','true');
    }
    document.querySelector('#registrations-toggle').classList.toggle('active', ['users','clients','suppliers','products','site_menu'].includes(page));
    document.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    document.querySelector('#page-title').textContent = page === 'users' ? 'Usuários' : page === 'clients' ? 'Clientes' : page === 'suppliers' ? 'Fornecedores' : page === 'products' ? 'Produtos' : page === 'site_menu' ? 'Menu Site' : page === 'orders' ? 'Pedidos' : page === 'finance' ? 'Financeiro' : page === 'settings' ? 'Configurações' : 'Visão geral';
    document.querySelector('#sidebar').classList.remove('open');
    if (page === 'dashboard') void loadDashboardPage();
    else if (page === 'users') void loadUsersPage();
    else if (page === 'clients') void loadClientsPage();
    else if (page === 'suppliers') void loadSuppliersPage();
    else if (page === 'products') void loadProductsPage();
    else if (page === 'site_menu') void loadSiteMenuPage();
    else if (page === 'orders') void loadOrdersPage();
    else if (page === 'finance') void loadFinancePage();
    else if (page === 'settings') void loadSettingsPage();
  }
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.page)));

  function getUniqueYears(dateStrings) {
    const current = new Date().getFullYear();
    const years = new Set([String(current)]);
    dateStrings.forEach(str => {
      const y = String(str || '').slice(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
    });
    return Array.from(years).sort().reverse();
  }

  async function loadDashboardPage() {
    workspace.innerHTML = '<div class="workspace-state">Carregando visão geral…</div>';
    try {
      const promises = [];
      promises.push(api('listUsers').then(res => { users = res; }).catch(() => {}));
      if (canAccess('finance')) {
        promises.push(api('listFinanceReceivables').then(res => { dashboardData.receivables = res; }).catch(() => {}));
        promises.push(api('listFinancePayables').then(res => { dashboardData.payables = res; }).catch(() => {}));
      }
      if (canAccess('clients')) {
        promises.push(api('listClients').then(res => { dashboardData.clients = res; }).catch(() => {}));
      }
      if (canAccess('orders')) {
        promises.push(api('listOrders').then(res => { dashboardData.orders = res; }).catch(() => {}));
      }
      await Promise.all(promises);
      if (activePage === 'dashboard') renderDashboard();
    } catch (error) {
      if (activePage === 'dashboard') workspace.innerHTML = `<div class="workspace-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function dashFinanceCardMarkup() {
    const dates = [
      ...dashboardData.receivables.map(r => r.data_pagamento || r.data_vencimento || r.criado_em),
      ...dashboardData.payables.map(p => p.data_pagamento || p.data_vencimento || p.criado_em)
    ];
    const years = getUniqueYears(dates);
    const recs = dashboardData.receivables.filter(r => dashFinanceYear === 'all' || (r.data_pagamento || r.data_vencimento || r.criado_em || '').startsWith(dashFinanceYear));
    const pays = dashboardData.payables.filter(p => dashFinanceYear === 'all' || (p.data_pagamento || p.data_vencimento || p.criado_em || '').startsWith(dashFinanceYear));

    const recPaid = recs.filter(r => r.status === 'pago').reduce((s, r) => s + Number(r.valor || 0), 0);
    const recPending = recs.filter(r => r.status === 'pendente').reduce((s, r) => s + Number(r.valor || 0), 0);
    const payPaid = pays.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.valor || 0), 0);
    const payPending = pays.filter(p => p.status === 'pendente').reduce((s, p) => s + Number(p.valor || 0), 0);
    const balance = recPaid - payPaid;

    const bars = [];
    if (dashFinanceType === 'all' || dashFinanceType === 'received') {
      bars.push(['Recebido', recPaid, 'received']);
      bars.push(['A receber', recPending, 'pending']);
    }
    if (dashFinanceType === 'all' || dashFinanceType === 'paid') {
      bars.push(['Pago', payPaid, 'paid']);
      bars.push(['A pagar', payPending, 'overdue']);
    }
    const maxVal = Math.max(1, ...bars.map(b => b[1]));

    return `<section class="content-card dashboard-chart-card">
      <div class="card-head">
        <div>
          <h2>Recebimentos x Gastos</h2>
          <p>Comparativo anual financeiro</p>
        </div>
        <div class="card-filters">
          <select id="dash-finance-year" aria-label="Filtrar ano financeiro">
            <option value="all" ${dashFinanceYear === 'all' ? 'selected' : ''}>Todos os anos</option>
            ${years.map(y => `<option value="${y}" ${dashFinanceYear === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <select id="dash-finance-type" aria-label="Filtrar tipo financeiro">
            <option value="all" ${dashFinanceType === 'all' ? 'selected' : ''}>Todos</option>
            <option value="received" ${dashFinanceType === 'received' ? 'selected' : ''}>Recebimentos</option>
            <option value="paid" ${dashFinanceType === 'paid' ? 'selected' : ''}>Gastos</option>
          </select>
        </div>
      </div>
      <div class="dash-metric-pills">
        <div class="dash-metric-pill success"><span>Recebido</span><strong>${money(recPaid)}</strong></div>
        <div class="dash-metric-pill danger"><span>Pago</span><strong>${money(payPaid)}</strong></div>
        <div class="dash-metric-pill ${balance >= 0 ? 'success' : 'danger'}"><span>Saldo</span><strong>${money(balance)}</strong></div>
      </div>
      <div class="finance-bars" role="img" aria-label="Gráfico de recebimentos e gastos">
        ${bars.map(([label, val, type]) => `
          <div class="finance-bar-item">
            <div class="finance-bar-label"><span>${label}</span><strong>${money(val)}</strong></div>
            <div class="finance-bar-track"><span class="finance-bar ${type}" style="width:${Math.max(val ? 2 : 0, val / maxVal * 100)}%"></span></div>
          </div>
        `).join('')}
      </div>
    </section>`;
  }

  function dashClientsCardMarkup() {
    const dates = dashboardData.clients.map(c => c.data_cadastro || c.criado_em);
    const years = getUniqueYears(dates);
    const yearClients = dashboardData.clients.filter(c => dashClientsYear === 'all' || (c.data_cadastro || c.criado_em || '').startsWith(dashClientsYear));
    const filteredClients = dashClientsMonth ? yearClients.filter(c => (c.data_cadastro || c.criado_em || '').slice(5, 7) === dashClientsMonth) : yearClients;

    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const monthCounts = monthNames.map((name, i) => {
      const m = String(i + 1).padStart(2, '0');
      return yearClients.filter(c => (c.data_cadastro || c.criado_em || '').slice(5, 7) === m).length;
    });
    const maxCount = Math.max(1, ...monthCounts);

    return `<section class="content-card dashboard-chart-card">
      <div class="card-head">
        <div>
          <h2>Clientes cadastrados</h2>
          <p>Evolução por mês e ano</p>
        </div>
        <div class="card-filters">
          <select id="dash-clients-year" aria-label="Filtrar ano de clientes">
            <option value="all" ${dashClientsYear === 'all' ? 'selected' : ''}>Todos os anos</option>
            ${years.map(y => `<option value="${y}" ${dashClientsYear === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <select id="dash-clients-month" aria-label="Filtrar mês de clientes">
            <option value="" ${dashClientsMonth === '' ? 'selected' : ''}>Todos os meses</option>
            ${monthNames.map((m, i) => {
              const val = String(i + 1).padStart(2, '0');
              return `<option value="${val}" ${dashClientsMonth === val ? 'selected' : ''}>${val} - ${m}</option>`;
            }).join('')}
          </select>
        </div>
      </div>
      <div class="dash-metric-pills">
        <div class="dash-metric-pill gold"><span>No período</span><strong>${filteredClients.length} ${filteredClients.length === 1 ? 'cliente' : 'clientes'}</strong></div>
        <div class="dash-metric-pill"><span>Total geral</span><strong>${dashboardData.clients.length}</strong></div>
      </div>
      <div class="dash-mini-columns" role="img" aria-label="Gráfico de clientes cadastrados por mês">
        ${monthNames.map((name, i) => {
          const count = monthCounts[i];
          const m = String(i + 1).padStart(2, '0');
          const isSelected = dashClientsMonth === m;
          const height = Math.max(count ? 12 : 2, Math.round(count / maxCount * 100));
          return `<div class="dash-col-item ${isSelected ? 'highlight' : ''}" title="${name}: ${count} ${count === 1 ? 'cliente' : 'clientes'}">
            <span class="dash-col-val">${count || ''}</span>
            <div class="dash-col-track"><span class="dash-col-bar client" style="height:${height}%"></span></div>
            <span class="dash-col-label">${name}</span>
          </div>`;
        }).join('')}
      </div>
    </section>`;
  }

  function dashOrdersCardMarkup() {
    const dates = dashboardData.orders.map(o => o.data_pedido || o.criado_em);
    const years = getUniqueYears(dates);
    const yearOrders = dashboardData.orders.filter(o => dashOrdersYear === 'all' || (o.data_pedido || o.criado_em || '').startsWith(dashOrdersYear));
    const totalRev = yearOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const paidCount = yearOrders.filter(o => o.pagamento === 'pago').length;
    const openCount = yearOrders.filter(o => o.pagamento !== 'pago').length;

    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const orderCounts = monthNames.map((name, i) => {
      const m = String(i + 1).padStart(2, '0');
      return yearOrders.filter(o => (o.data_pedido || o.criado_em || '').slice(5, 7) === m).length;
    });
    const maxCount = Math.max(1, ...orderCounts);

    return `<section class="content-card dashboard-chart-card">
      <div class="card-head">
        <div>
          <h2>Pedidos pelo site</h2>
          <p>Volume anual de vendas online</p>
        </div>
        <div class="card-filters">
          <select id="dash-orders-year" aria-label="Filtrar ano de pedidos">
            <option value="all" ${dashOrdersYear === 'all' ? 'selected' : ''}>Todos os anos</option>
            ${years.map(y => `<option value="${y}" ${dashOrdersYear === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="dash-metric-pills">
        <div class="dash-metric-pill gold"><span>Pedidos</span><strong>${yearOrders.length}</strong></div>
        <div class="dash-metric-pill success"><span>Volume</span><strong>${money(totalRev)}</strong></div>
        <div class="dash-metric-pill"><span>Pagos / Abertos</span><strong>${paidCount} / ${openCount}</strong></div>
      </div>
      <div class="dash-mini-columns" role="img" aria-label="Gráfico de pedidos por mês">
        ${monthNames.map((name, i) => {
          const count = orderCounts[i];
          const height = Math.max(count ? 12 : 2, Math.round(count / maxCount * 100));
          return `<div class="dash-col-item" title="${name}: ${count} ${count === 1 ? 'pedido' : 'pedidos'}">
            <span class="dash-col-val">${count || ''}</span>
            <div class="dash-col-track"><span class="dash-col-bar order" style="height:${height}%"></span></div>
            <span class="dash-col-label">${name}</span>
          </div>`;
        }).join('')}
      </div>
    </section>`;
  }

  function bindDashboardFilters() {
    const container = document.querySelector('#dashboard-charts');
    if (!container) return;
    container.querySelector('#dash-finance-year')?.addEventListener('change', e => {
      dashFinanceYear = e.target.value;
      updateDashboardCharts();
    });
    container.querySelector('#dash-finance-type')?.addEventListener('change', e => {
      dashFinanceType = e.target.value;
      updateDashboardCharts();
    });
    container.querySelector('#dash-clients-year')?.addEventListener('change', e => {
      dashClientsYear = e.target.value;
      updateDashboardCharts();
    });
    container.querySelector('#dash-clients-month')?.addEventListener('change', e => {
      dashClientsMonth = e.target.value;
      updateDashboardCharts();
    });
    container.querySelector('#dash-orders-year')?.addEventListener('change', e => {
      dashOrdersYear = e.target.value;
      updateDashboardCharts();
    });
  }

  function updateDashboardCharts() {
    const container = document.querySelector('#dashboard-charts');
    if (!container) return;
    container.innerHTML = `
      ${dashFinanceCardMarkup()}
      ${dashClientsCardMarkup()}
      ${dashOrdersCardMarkup()}
    `;
    bindDashboardFilters();
  }

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
      <div class="dashboard-charts-grid" id="dashboard-charts">
        ${dashFinanceCardMarkup()}
        ${dashClientsCardMarkup()}
        ${dashOrdersCardMarkup()}
      </div>`;
    bindDashboardFilters();
  }

  const searchIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
  async function loadSettingsPage() {
    selectedAccess = null;
    workspace.innerHTML = '<div class="workspace-state">Carregando configurações…</div>';
    try {
      users = await api('listUsers');
      if (activePage !== 'settings') return;
      renderSettings();
    } catch (error) { if (activePage === 'settings') workspace.innerHTML = `<div class="workspace-state">${escapeHtml(error.message)}</div>`; }
  }
  function renderSettings() {
    workspace.innerHTML = `<div class="users-tabs" role="tablist" aria-label="Configurações">
      <button class="users-tab ${settingsTab === 'access' ? 'active' : ''}" type="button" role="tab" data-settings-tab="access" aria-selected="${settingsTab === 'access'}">Acessos</button>
      <button class="users-tab ${settingsTab === 'drive' ? 'active' : ''}" type="button" role="tab" data-settings-tab="drive" aria-selected="${settingsTab === 'drive'}">BD DRIVE</button>
    </div>
    <section class="content-card users-tab-panel" data-settings-panel="access" ${settingsTab === 'access' ? '' : 'hidden'}>
      <div class="card-head"><div><h2>Acessos por usuário</h2><p>Selecione um usuário pela lupa e defina os módulos disponíveis.</p></div></div>
      <div class="settings-content"><div class="field"><label for="access-user">Usuário selecionado</label>
        <div class="settings-selector"><input id="access-user" value="${selectedAccess ? `${escapeHtml(selectedAccess.user.nome)} — ${escapeHtml(selectedAccess.user.email)}` : ''}" placeholder="Selecione um usuário" readonly><button class="button" id="find-access-user" type="button" aria-label="Buscar usuário">${searchIcon}</button></div></div>
        <div id="access-editor" class="${selectedAccess ? '' : 'empty'}">${selectedAccess ? '' : 'Clique na lupa para escolher um usuário.'}</div>
      </div>
    </section>
    <section class="content-card users-tab-panel" data-settings-panel="drive" ${settingsTab === 'drive' ? '' : 'hidden'}>
      <div class="card-head"><div><h2>BD DRIVE — Banco de dados e infraestrutura</h2><p>Pasta do Google Drive com os arquivos CSV, configurações do Apps Script, Vercel e GitHub.</p></div>
        <a class="button button-drive" href="https://drive.google.com/drive/folders/1uDmZGpSEbeUq1PX_MvU-7nYW4Y4IpFva" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">📁</span> Abrir pasta no Google Drive</a>
      </div>
      <div class="settings-content">
        <h3 class="settings-subtitle">Arquivos do Banco de Dados (Google Drive)</h3>
        <p class="helper">Abaixo estão listados todos os arquivos e tabelas CSV armazenados na pasta raiz do projeto SOLO no Google Drive (ID: <code>1uDmZGpSEbeUq1PX_MvU-7nYW4Y4IpFva</code>):</p>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Tipo</th>
                <th>Descrição do conteúdo</th>
                <th>Propriedade de Script</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>usuarios.csv</b></td>
                <td><span class="badge">CSV</span></td>
                <td>Cadastro de usuários da equipe SOLO, perfis (Administrador/Operador), status e senhas criptografadas (PBKDF2/HMAC-SHA256).</td>
                <td><code>USERS_FILE_ID</code></td>
              </tr>
              <tr>
                <td><b>configuracoes.csv</b></td>
                <td><span class="badge">CSV</span></td>
                <td>Controle granular de permissões e acessos por módulo (Visão geral, Usuários, Clientes, Pedidos, Financeiro) para cada operador.</td>
                <td><code>SETTINGS_FILE_ID</code></td>
              </tr>
              <tr>
                <td><b>clientes.csv</b></td>
                <td><span class="badge">CSV</span></td>
                <td>Cadastro de clientes da SOLO com nome completo, e-mail, WhatsApp (com DDD) e data de cadastro.</td>
                <td><code>CLIENTS_FILE_ID</code></td>
              </tr>
              <tr>
                <td><b>fornecedores.csv</b></td>
                <td><span class="badge">CSV</span></td>
                <td>Cadastro de fornecedores da SOLO com fornecedor, e-mail, WhatsApp, endereço, cidade, UF, tipo de produto e observações.</td>
                <td><code>SUPPLIERS_FILE_ID</code></td>
              </tr>
              <tr>
                <td><b>produtos.csv</b></td>
                <td><span class="badge">CSV</span></td>
                <td>Cadastro de produtos amarrado a fornecedores, com preço de custo, preço de venda, cálculo de margem e fotos.</td>
                <td><code>PRODUCTS_FILE_ID</code></td>
              </tr>
              <tr>
                <td><b>fotos-produtos</b></td>
                <td><span class="badge">Pasta</span></td>
                <td>Pasta pública no Google Drive para armazenamento das fotos dos produtos do catálogo da SOLO.</td>
                <td><code>PRODUCTS_PHOTOS_FOLDER_ID</code></td>
              </tr>
              <tr>
                <td><b>menu_site_config.csv</b></td>
                <td><span class="badge">CSV</span></td>
                <td>Configurações do item de menu e seção dinâmica do site (título do menu, título da seção, subtítulo e status ativo).</td>
                <td><code>MENU_CONFIG_FILE_ID</code></td>
              </tr>
              <tr>
                <td><b>menu_site_cards.csv</b></td>
                <td><span class="badge">CSV</span></td>
                <td>Cards dinâmicos com título, descrição, galeria de fotos e ordem para apresentação no site.</td>
                <td><code>MENU_CARDS_FILE_ID</code></td>
              </tr>
              <tr>
                <td><b>fotos-menu-site</b></td>
                <td><span class="badge">Pasta</span></td>
                <td>Pasta pública no Google Drive para armazenamento das fotos (até 3 por card) dos cards dinâmicos do site.</td>
                <td><code>MENU_PHOTOS_FOLDER_ID</code></td>
              </tr>
              <tr>
                <td><b>pedidos.csv</b></td>
                <td><span class="badge">CSV</span></td>
                <td>Pedidos realizados pelo catálogo do site e portal do cliente, com itens JSON, valor total, entrega, chave de idempotência e hash.</td>
                <td><code>ORDERS_FILE_ID</code></td>
              </tr>
              <tr>
                <td><b>contas_receber.csv</b></td>
                <td><span class="badge">CSV</span></td>
                <td>Contas a receber do módulo financeiro, lançamentos avulsos e vínculos automáticos com pedidos recebidos.</td>
                <td><code>RECEIVABLES_FILE_ID</code></td>
              </tr>
              <tr>
                <td><b>contas_pagar.csv</b></td>
                <td><span class="badge">CSV</span></td>
                <td>Contas a pagar do módulo financeiro, fornecedores, categorias de despesas, datas de vencimento e pagamentos.</td>
                <td><code>PAYABLES_FILE_ID</code></td>
              </tr>
              <tr>
                <td><b>fotos-perfil</b></td>
                <td><span class="badge">Pasta</span></td>
                <td>Subpasta privada para armazenamento seguro das fotos de perfil dos usuários em formato PNG/JPEG recortadas.</td>
                <td><code>PHOTO_FOLDER_ID</code></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 class="settings-subtitle" style="margin-top:32px;">Configurações Técnicas de Infraestrutura</h3>
        <div class="infra-grid">
          <div class="infra-card">
            <div class="infra-card-header">
              <span class="infra-icon">⚡</span>
              <div>
                <h4>Google Apps Script (Backend)</h4>
                <small>API REST e regras de negócio</small>
              </div>
            </div>
            <div class="infra-card-body">
              <div class="infra-item"><label>Script ID</label><code>1A1B47HsMVtTwnIz4v2obinIrvKbfMAITYdOfLJ4mqFV0GYa3uhk6CyM3</code></div>
              <div class="infra-item"><label>Deployment ID (Ativo)</label><code>AKfycbzXCzGYjhvPc7djdz99wdXorNgxWoBeQf_S_V2VC0oqtgUvg-MJifCW7uDlY0SeiEfz</code></div>
              <div class="infra-item"><label>URL do Web App</label><a href="https://script.google.com/macros/s/AKfycbzXCzGYjhvPc7djdz99wdXorNgxWoBeQf_S_V2VC0oqtgUvg-MJifCW7uDlY0SeiEfz/exec" target="_blank" rel="noopener noreferrer" class="link-external">Abrir endpoint /exec ↗</a></div>
              <div class="infra-item"><label>Execução</label><span>Proprietário (eduperalles@gmail.com) · Acesso: Qualquer pessoa · V8</span></div>
            </div>
            <div class="infra-card-footer">
              <a class="tiny-button" href="https://script.google.com/home/projects/1A1B47HsMVtTwnIz4v2obinIrvKbfMAITYdOfLJ4mqFV0GYa3uhk6CyM3/edit" target="_blank" rel="noopener noreferrer">Abrir Editor do Apps Script ↗</a>
            </div>
          </div>

          <div class="infra-card">
            <div class="infra-card-header">
              <span class="infra-icon">▲</span>
              <div>
                <h4>Vercel (Hospedagem Frontend)</h4>
                <small>Deploy contínuo e CDN global</small>
              </div>
            </div>
            <div class="infra-card-body">
              <div class="infra-item"><label>Domínio Oficial</label><a href="https://soloatelie.com.br" target="_blank" rel="noopener noreferrer" class="link-external">soloatelie.com.br ↗</a></div>
              <div class="infra-item"><label>Domínio Vercel</label><a href="https://solo-blond.vercel.app" target="_blank" rel="noopener noreferrer" class="link-external">solo-blond.vercel.app ↗</a></div>
              <div class="infra-item"><label>Painel Administrativo</label><a href="https://soloatelie.com.br/admin/dashboard.html" target="_blank" rel="noopener noreferrer" class="link-external">soloatelie.com.br/admin/dashboard.html ↗</a></div>
              <div class="infra-item"><label>Gatilho de Deploy</label><span>Push automático na branch <code>main</code></span></div>
            </div>
            <div class="infra-card-footer">
              <a class="tiny-button" href="https://vercel.com" target="_blank" rel="noopener noreferrer">Acessar Console Vercel ↗</a>
            </div>
          </div>

          <div class="infra-card">
            <div class="infra-card-header">
              <span class="infra-icon">🐙</span>
              <div>
                <h4>GitHub (Repositório do Projeto)</h4>
                <small>Controle de versão e código-fonte</small>
              </div>
            </div>
            <div class="infra-card-body">
              <div class="infra-item"><label>Repositório</label><a href="https://github.com/eduperalles/SOLO" target="_blank" rel="noopener noreferrer" class="link-external">github.com/eduperalles/SOLO ↗</a></div>
              <div class="infra-item"><label>Branch Principal</label><code>main</code></div>
              <div class="infra-item"><label>Diretório Local</label><code>D:\\PERALLY\\CLIENTES\\SOLO</code></div>
              <div class="infra-item"><label>Visibilidade</label><span>Público / Vercel Production Integration</span></div>
            </div>
            <div class="infra-card-footer">
              <a class="tiny-button" href="https://github.com/eduperalles/SOLO" target="_blank" rel="noopener noreferrer">Abrir Repositório no GitHub ↗</a>
            </div>
          </div>
        </div>
      </div>
    </section>`;

    workspace.querySelectorAll('[data-settings-tab]').forEach(button => button.addEventListener('click', () => {
      settingsTab = button.dataset.settingsTab;
      workspace.querySelectorAll('[data-settings-tab]').forEach(tab => {
        const active = tab.dataset.settingsTab === settingsTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      workspace.querySelectorAll('[data-settings-panel]').forEach(panel => {
        panel.hidden = panel.dataset.settingsPanel !== settingsTab;
      });
    }));

    document.querySelector('#find-access-user')?.addEventListener('click', openUserPicker);
    if (selectedAccess) renderAccessEditor();
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
        const access = Object.fromEntries(['dashboard','users','clients','suppliers','products','site_menu','orders','finance'].map(key => [key,form.elements[key].checked]));
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
  const whatsappSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.11 6.84C8.94 6.84 8.66 6.9 8.42 7.16C8.18 7.42 7.5 8.06 7.5 9.36C7.5 10.66 8.45 11.92 8.58 12.09C8.71 12.26 10.42 14.91 13.06 16.05C15.25 17 15.7 16.82 16.18 16.78C16.66 16.73 17.73 16.14 17.95 15.52C18.17 14.91 18.17 14.38 18.11 14.28C18.05 14.18 17.88 14.11 17.62 13.98C17.36 13.85 16.08 13.22 15.84 13.13C15.61 13.05 15.44 13.01 15.27 13.27C15.1 13.53 14.61 14.11 14.46 14.28C14.31 14.46 14.16 14.48 13.9 14.35C13.64 14.22 12.8 13.95 11.81 13.07C11.04 12.38 10.52 11.53 10.37 11.27C10.22 11.01 10.35 10.87 10.48 10.74C10.6 10.62 10.74 10.43 10.88 10.28C11.02 10.12 11.07 10.01 11.16 9.84C11.24 9.67 11.2 9.52 11.14 9.39C11.07 9.26 10.58 8.06 10.38 7.57C10.18 7.09 9.98 7.15 9.83 7.15C9.69 7.14 9.52 7.14 9.35 7.14L9.11 6.84Z"/></svg>';
  function whatsappUrl(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '#';
    const number = digits.length === 10 || digits.length === 11 ? '55' + digits : digits;
    return `https://wa.me/${number}`;
  }
  async function loadOrdersPage() {
    workspace.innerHTML='<div class="workspace-state">Carregando pedidos…</div>';
    try {
      const orders=await api('listOrders');
      if(activePage !== 'orders')return;
      window.SoloOrderView.render(workspace,orders,{admin:true,onRetry:async id=>{try {await api('retryOrder',{id});await loadOrdersPage();toast('Gravação concluída.');}catch(error){toast(error.message,true);}},onDelete:async order=>{
        if(!confirm(`Excluir o pedido ${order.numero}?\n\nA conta a receber vinculada também será excluída, caso exista. Esta ação não pode ser desfeita.`))return;
        try {
          const result=await api('deleteOrder',{id:order.id});
          await loadOrdersPage();
          toast(result.receivableDeleted?'Pedido e conta a receber excluídos.':'Pedido excluído. Nenhuma conta a receber vinculada foi encontrada.');
        } catch(error) {
          await loadOrdersPage();
          toast(error.message,true);
        }
      }});
    }catch(error){if(activePage==='orders')workspace.innerHTML=`<div class="workspace-state">${escapeHtml(error.message)}</div>`;}
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
      <td>${escapeHtml(item.email)}</td><td><a class="whatsapp-cell-link" href="${escapeHtml(whatsappUrl(item.whatsapp))}" target="_blank" rel="noopener noreferrer" title="Falar no WhatsApp">${whatsappSvg}<span>${escapeHtml(formatWhatsapp(item.whatsapp))}</span></a></td><td>${escapeHtml(displayClientDate(item.data_cadastro))}</td>
      <td><div class="row-actions"><a class="tiny-button whatsapp" href="${escapeHtml(whatsappUrl(item.whatsapp))}" target="_blank" rel="noopener noreferrer" title="Falar com ${escapeHtml(item.nome)} no WhatsApp">${whatsappSvg} WhatsApp</a><button class="tiny-button" type="button" data-client-edit="${escapeHtml(item.id)}">Editar</button><button class="tiny-button danger" type="button" data-client-delete="${escapeHtml(item.id)}">Excluir</button></div></td>
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

  const UF_LIST = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  async function loadSuppliersPage() {
    workspace.innerHTML = '<div class="workspace-state">Carregando fornecedores…</div>';
    try {
      suppliers = await api('listSuppliers');
      if (activePage === 'suppliers') renderSuppliers();
    } catch (error) {
      if (activePage === 'suppliers') workspace.innerHTML = `<div class="workspace-state">${escapeHtml(error.message)}</div>`;
    }
  }
  function supplierRows(filter = '') {
    const query = filter.trim().toLocaleLowerCase('pt-BR');
    const digits = query.replace(/\D/g,'');
    const visible = suppliers.filter(item => `${item.fornecedor} ${item.email} ${formatWhatsapp(item.whatsapp)} ${item.cidade} ${item.uf} ${item.endereco} ${item.tipo_produto} ${item.observacoes}`.toLocaleLowerCase('pt-BR').includes(query) || (digits.length >= 3 && /^[+\d() .-]+$/.test(query) && item.whatsapp.includes(digits)));
    if (!visible.length) return '<div class="empty">Nenhum fornecedor encontrado.</div>';
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Fornecedor</th><th>Contato</th><th>Localização</th><th>Produto fornecido</th><th>Ações</th></tr></thead><tbody>${visible.map(item => `<tr>
      <td><b>${escapeHtml(item.fornecedor)}</b>${item.observacoes ? `<small class="order-contact" title="${escapeHtml(item.observacoes)}">${escapeHtml(item.observacoes.length > 55 ? item.observacoes.slice(0,52) + '…' : item.observacoes)}</small>` : ''}</td>
      <td>${escapeHtml(item.email)}<small class="order-contact"><a class="whatsapp-cell-link" href="${escapeHtml(whatsappUrl(item.whatsapp))}" target="_blank" rel="noopener noreferrer" title="Falar no WhatsApp">${whatsappSvg}<span>${escapeHtml(formatWhatsapp(item.whatsapp))}</span></a></small></td>
      <td><span>${escapeHtml(item.cidade ? `${item.cidade}/${item.uf}` : item.uf || '—')}</span><small class="order-contact">${escapeHtml(item.endereco || '—')}</small></td>
      <td><span class="badge">${escapeHtml(item.tipo_produto || 'Geral')}</span></td>
      <td><div class="row-actions"><a class="tiny-button whatsapp" href="${escapeHtml(whatsappUrl(item.whatsapp))}" target="_blank" rel="noopener noreferrer" title="Falar com ${escapeHtml(item.fornecedor)} no WhatsApp">${whatsappSvg} WhatsApp</a><button class="tiny-button" type="button" data-supplier-edit="${escapeHtml(item.id)}">Editar</button><button class="tiny-button danger" type="button" data-supplier-delete="${escapeHtml(item.id)}">Excluir</button></div></td>
    </tr>`).join('')}</tbody></table></div>`;
  }
  function renderSuppliers() {
    const current = suppliers.find(item => item.id === editingSupplierId);
    workspace.innerHTML = `<div class="users-tabs" role="tablist" aria-label="Cadastro de fornecedores">
      <button class="users-tab ${suppliersTab === 'editor' ? 'active' : ''}" type="button" role="tab" data-suppliers-tab="editor" aria-selected="${suppliersTab === 'editor'}">Cadastro / edição</button>
      <button class="users-tab ${suppliersTab === 'list' ? 'active' : ''}" type="button" role="tab" data-suppliers-tab="list" aria-selected="${suppliersTab === 'list'}">Fornecedores cadastrados <span>${suppliers.length}</span></button></div>
      <section class="content-card users-tab-panel" data-suppliers-panel="editor" ${suppliersTab === 'editor' ? '' : 'hidden'}>
        <div class="card-head"><div><h2>${current ? 'Editar fornecedor' : 'Cadastrar fornecedor'}</h2><p>Preencha os dados cadastrais do fornecedor de produtos ou insumos.</p></div></div>
        <form id="supplier-form" class="editor">
          <input type="hidden" name="id" value="${escapeHtml(current?.id || '')}">
          <input type="hidden" name="expected_updated_at" value="${escapeHtml(current?.atualizado_em || '')}">
          <div class="field full"><label for="supplier-name">Fornecedor / Razão social</label><input id="supplier-name" name="fornecedor" maxlength="180" minlength="2" value="${escapeHtml(current?.fornecedor || '')}" placeholder="Nome da empresa ou fornecedor" required></div>
          <div class="field"><label for="supplier-email">E-mail</label><input id="supplier-email" name="email" type="email" maxlength="254" autocomplete="email" value="${escapeHtml(current?.email || '')}" placeholder="fornecedor@exemplo.com.br" required></div>
          <div class="field"><label for="supplier-whatsapp">WhatsApp</label><input id="supplier-whatsapp" name="whatsapp" type="tel" maxlength="24" autocomplete="tel" placeholder="(11) 99999-9999" value="${escapeHtml(formatWhatsapp(current?.whatsapp || ''))}" required><small class="helper">Informe o DDD com 10 a 11 dígitos.</small></div>
          <div class="field full"><label for="supplier-product">Tipo de produto fornecido</label><input id="supplier-product" name="tipo_produto" maxlength="180" value="${escapeHtml(current?.tipo_produto || '')}" placeholder="Ex: Queijos artesanais, Frios, Pães, Embalagens" required></div>
          <div class="field full"><label for="supplier-address">Endereço</label><input id="supplier-address" name="endereco" maxlength="250" value="${escapeHtml(current?.endereco || '')}" placeholder="Rua, número, complemento, bairro"></div>
          <div class="field"><label for="supplier-city">Cidade</label><input id="supplier-city" name="cidade" maxlength="100" value="${escapeHtml(current?.cidade || '')}" placeholder="Cidade"></div>
          <div class="field"><label for="supplier-uf">UF</label><select id="supplier-uf" name="uf"><option value="">Selecione o estado</option>${UF_LIST.map(uf => `<option value="${uf}" ${(current?.uf || 'SP') === uf ? 'selected' : ''}>${uf}</option>`).join('')}</select></div>
          <div class="field full"><label for="supplier-notes">Observações</label><textarea id="supplier-notes" name="observacoes" rows="4" maxlength="10000" placeholder="Prazos de entrega, condições de pagamento, contatos de representantes…">${escapeHtml(current?.observacoes || '')}</textarea></div>
          <div class="form-actions"><button class="button button-secondary" type="reset">Limpar</button><button class="button" type="submit">Salvar fornecedor</button></div>
        </form></section>
      <section class="content-card users-tab-panel" data-suppliers-panel="list" ${suppliersTab === 'list' ? '' : 'hidden'}>
        <div class="card-head"><div><h2>Fornecedores cadastrados</h2><p>${suppliers.length} registros disponíveis</p></div><div class="toolbar"><input id="suppliers-search" aria-label="Buscar fornecedores" placeholder="Buscar fornecedores…"></div></div>
        <div id="suppliers-table">${supplierRows()}</div></section>`;
    const form = document.querySelector('#supplier-form');
    const search = document.querySelector('#suppliers-search');
    workspace.querySelectorAll('[data-suppliers-tab]').forEach(button => button.addEventListener('click', () => {
      suppliersTab = button.dataset.suppliersTab;
      workspace.querySelectorAll('[data-suppliers-tab]').forEach(tab => { const active = tab.dataset.suppliersTab === suppliersTab; tab.classList.toggle('active',active); tab.setAttribute('aria-selected',String(active)); });
      workspace.querySelectorAll('[data-suppliers-panel]').forEach(panel => panel.hidden = panel.dataset.suppliersPanel !== suppliersTab);
      if (suppliersTab === 'list') search.focus();
    }));
    form.elements.whatsapp.addEventListener('blur', event => {
      if (/^[+\d() .-]+$/.test(event.target.value)) event.target.value = formatWhatsapp(event.target.value);
    });
    form.addEventListener('reset', event => { event.preventDefault(); editingSupplierId = ''; renderSuppliers(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('[type="submit"]'); button.disabled = true;
      const record = Object.fromEntries(new FormData(form).entries());
      try {
        const saved = await api(record.id ? 'updateSupplier' : 'createSupplier', {record});
        const index = suppliers.findIndex(item => item.id === saved.id);
        if (index >= 0) suppliers[index] = saved; else suppliers.push(saved);
        editingSupplierId = ''; suppliersTab = 'list';
        if (activePage === 'suppliers') renderSuppliers();
        toast('Fornecedor salvo com sucesso.');
      } catch (error) { toast(error.message,true); }
      finally { button.disabled = false; }
    });
    search.addEventListener('input', () => { document.querySelector('#suppliers-table').innerHTML = supplierRows(search.value); bindSupplierActions(); });
    bindSupplierActions();
  }
  function bindSupplierActions() {
    workspace.querySelectorAll('[data-supplier-edit]').forEach(button => button.addEventListener('click', () => {
      editingSupplierId = button.dataset.supplierEdit; suppliersTab = 'editor'; renderSuppliers();
      workspace.querySelector('.content-card')?.scrollIntoView({behavior:'smooth'});
    }));
    workspace.querySelectorAll('[data-supplier-delete]').forEach(button => button.addEventListener('click', async () => {
      const selected = suppliers.find(item => item.id === button.dataset.supplierDelete);
      if (!selected || !confirm(`Excluir o fornecedor ${selected.fornecedor}?`)) return;
      button.disabled = true;
      try {
        await api('deleteSupplier', {id:selected.id,version:selected.atualizado_em});
        suppliers = suppliers.filter(item => item.id !== selected.id);
        if (editingSupplierId === selected.id) editingSupplierId = '';
        suppliersTab = 'list';
        if (activePage === 'suppliers') renderSuppliers();
        toast('Fornecedor excluído.');
      } catch (error) { button.disabled = false; toast(error.message,true); }
    }));
  }

  function calcProfitMargin(costVal, priceVal) {
    const cost = Number(parseCurrency(costVal)) || 0;
    const price = Number(parseCurrency(priceVal)) || 0;
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    return { cost, price, profit, margin };
  }

  function openSupplierPicker() {
    const dialog = document.createElement('dialog');
    dialog.className = 'user-picker';
    dialog.setAttribute('aria-labelledby','supplier-picker-title');
    dialog.innerHTML = `<div class="card-head"><h2 id="supplier-picker-title">Selecionar fornecedor</h2><button class="tiny-button" id="close-supplier-picker" type="button">Fechar</button></div>
      <div class="field"><label for="supplier-picker-search">Buscar por fornecedor, e-mail ou produto</label><input id="supplier-picker-search" type="search" placeholder="Digite para buscar…"></div><div id="supplier-picker-results" class="picker-results"></div>`;
    document.body.append(dialog);
    const search = dialog.querySelector('#supplier-picker-search');
    const results = dialog.querySelector('#supplier-picker-results');
    const render = () => {
      const query = search.value.trim().toLocaleLowerCase('pt-BR');
      const found = suppliers.filter(item => `${item.fornecedor} ${item.email} ${item.tipo_produto} ${item.cidade}`.toLocaleLowerCase('pt-BR').includes(query));
      results.innerHTML = found.length ? found.map(item => `<button type="button" class="picker-user" data-picker-supplier="${escapeHtml(item.id)}"><span><b>${escapeHtml(item.fornecedor)}</b><small>${escapeHtml(item.email || 'Sem e-mail')}${item.cidade ? ` · ${escapeHtml(item.cidade)}/${escapeHtml(item.uf)}` : ''}</small></span><span class="badge">${escapeHtml(item.tipo_produto || 'Fornecedor')}</span></button>`).join('') : '<div class="empty">Nenhum fornecedor encontrado.</div>';
    };
    search.addEventListener('input', render);
    results.addEventListener('click', event => {
      const button = event.target.closest('[data-picker-supplier]');
      if (!button) return;
      dialog.close();
      const selected = suppliers.find(s => s.id === button.dataset.pickerSupplier);
      if (!selected) return;
      const nameInput = document.querySelector('#prod-fornecedor-nome');
      const idInput = document.querySelector('#prod-fornecedor-id');
      if (nameInput) nameInput.value = selected.fornecedor;
      if (idInput) idInput.value = selected.id;
    });
    dialog.querySelector('#close-supplier-picker').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove(), {once:true});
    render(); dialog.showModal(); search.focus();
  }

  async function loadProductsPage() {
    workspace.innerHTML = '<div class="workspace-state">Carregando produtos…</div>';
    try {
      const [prodRes, supRes] = await Promise.all([
        api('listProducts').catch(() => []),
        api('listSuppliers').catch(() => [])
      ]);
      if (activePage !== 'products') return;
      products = prodRes || [];
      suppliers = supRes || [];
      renderProducts();
    } catch (error) {
      if (activePage === 'products') workspace.innerHTML = `<div class="workspace-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function productRows(filter = '') {
    const query = filter.trim().toLocaleLowerCase('pt-BR');
    const visible = products.filter(p => `${p.nome} ${p.categoria} ${p.fornecedor_nome} ${p.descricao}`.toLocaleLowerCase('pt-BR').includes(query));
    if (!visible.length) return '<div class="empty">Nenhum produto encontrado.</div>';
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Foto</th><th>Produto</th><th>Categoria</th><th>Fornecedor</th><th>Custo</th><th>Venda</th><th>Margem</th><th>Ações</th></tr></thead><tbody>${visible.map(p => {
      const thumb = p.foto_url ? `<img src="${escapeHtml(p.foto_url)}" alt="" class="table-product-thumb" onerror="this.style.display='none'">` : '<div class="table-product-thumb" style="display:grid;place-items:center;color:var(--muted);font-size:18px;">🏷</div>';
      const profit = p.preco_venda - p.preco_custo;
      const marginBadgeClass = p.margem_lucro >= 30 ? '' : p.margem_lucro > 0 ? 'gold' : 'inactive';
      return `<tr>
        <td>${thumb}</td>
        <td><b>${escapeHtml(p.nome)}</b>${p.descricao ? `<small class="order-contact" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.descricao)}</small>` : ''}</td>
        <td><span class="badge">${escapeHtml(p.categoria || 'Geral')}</span></td>
        <td>${escapeHtml(p.fornecedor_nome || '—')}</td>
        <td>${money(p.preco_custo)}</td>
        <td><b>${money(p.preco_venda)}</b></td>
        <td><span class="badge ${marginBadgeClass}" title="Lucro: ${money(profit)}">${p.margem_lucro.toFixed(1)}% <small>(${money(profit)})</small></span></td>
        <td><div class="row-actions"><button class="tiny-button" type="button" data-prod-edit="${escapeHtml(p.id)}">Editar</button><button class="tiny-button danger" type="button" data-prod-delete="${escapeHtml(p.id)}">Excluir</button></div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function renderProducts() {
    const current = products.find(p => p.id === editingProductId);
    const initialCost = current ? current.preco_custo : 0;
    const initialPrice = current ? current.preco_venda : 0;
    const initialCalc = calcProfitMargin(initialCost, initialPrice);
    if (editingProductId && current && !productPhoto && current.foto_url) {
      productPhoto = current.foto_url;
    }

    workspace.innerHTML = `<div class="users-tabs" role="tablist" aria-label="Cadastro de produtos">
      <button class="users-tab ${productsTab === 'editor' ? 'active' : ''}" type="button" role="tab" data-prods-tab="editor" aria-selected="${productsTab === 'editor'}">Cadastro / edição</button>
      <button class="users-tab ${productsTab === 'list' ? 'active' : ''}" type="button" role="tab" data-prods-tab="list" aria-selected="${productsTab === 'list'}">Produtos cadastrados <span>${products.length}</span></button>
    </div>

    <!-- PAINEL 1: CADASTRO / EDIÇÃO -->
    <section class="content-card users-tab-panel" data-prods-panel="editor" ${productsTab === 'editor' ? '' : 'hidden'}>
      <div class="card-head"><div><h2>${current ? 'Editar produto' : 'Cadastrar produto'}</h2><p>Preencha os dados do produto, vincule ao fornecedor e confira o cálculo automático da margem.</p></div></div>
      <form id="product-form" class="editor">
        <input type="hidden" name="id" value="${escapeHtml(current?.id || '')}">
        <input type="hidden" name="expected_updated_at" value="${escapeHtml(current?.atualizado_em || '')}">
        <input type="hidden" id="prod-fornecedor-nome" name="fornecedor_nome" value="${escapeHtml(current?.fornecedor_nome || '')}">
        
        <div class="field full"><label for="prod-nome">Nome do produto *</label><input id="prod-nome" name="nome" maxlength="180" minlength="2" value="${escapeHtml(current?.nome || '')}" placeholder="Ex: Tábua Brie com Favo de Mel" required></div>
        
        <div class="field"><label for="prod-categoria">Categoria</label><input id="prod-categoria" name="categoria" maxlength="100" value="${escapeHtml(current?.categoria || 'Geral')}" placeholder="Ex: Queijos, Frios, Cestas, Vinhos"></div>
        <div class="field"><label for="prod-fornecedor-nome">Fornecedor vinculado *</label>
          <div class="settings-selector"><input id="prod-fornecedor-nome" name="fornecedor_nome" value="${escapeHtml(current?.fornecedor_nome || '')}" placeholder="Clique na lupa para selecionar" readonly required><input type="hidden" id="prod-fornecedor-id" name="fornecedor_id" value="${escapeHtml(current?.fornecedor_id || '')}" required><button class="button" id="find-prod-supplier" type="button" aria-label="Buscar fornecedor">${searchIcon}</button></div>
        </div>

        <div class="field"><label for="prod-custo">Preço de Custo (R$) *</label><input id="prod-custo" name="preco_custo" type="text" inputmode="decimal" value="${escapeHtml(current ? maskCurrency(Number(current.preco_custo)*100) : '')}" placeholder="0,00" required><small class="helper">Valor pago ao fornecedor pelo produto ou insumo.</small></div>
        <div class="field"><label for="prod-venda">Preço de Venda (R$) *</label><input id="prod-venda" name="preco_venda" type="text" inputmode="decimal" value="${escapeHtml(current ? maskCurrency(Number(current.preco_venda)*100) : '')}" placeholder="0,00" required><small class="helper">Preço de venda cobrado do cliente final.</small></div>

        <!-- CÁLCULO AUTOMÁTICO DE MARGEM -->
        <div class="field full">
          <label>Cálculo Automático de Lucro e Margem</label>
          <div class="margin-preview-pills" id="margin-pills">
            <div class="dash-metric-pill"><span>Custo</span><strong id="margin-display-cost">${money(initialCalc.cost)}</strong></div>
            <div class="dash-metric-pill"><span>Venda</span><strong id="margin-display-price">${money(initialCalc.price)}</strong></div>
            <div class="dash-metric-pill ${initialCalc.profit >= 0 ? 'success' : 'danger'}"><span>Lucro Líquido</span><strong id="margin-display-profit">${money(initialCalc.profit)}</strong></div>
            <div class="dash-metric-pill ${initialCalc.margin >= 30 ? 'success' : initialCalc.margin > 0 ? 'gold' : 'danger'}"><span>Margem de Lucro</span><strong id="margin-display-margin">${initialCalc.margin.toFixed(1)}%</strong></div>
          </div>
        </div>

        <div class="field full">
          <label>Foto do Produto (Google Drive)</label>
          <div class="product-photo-row">
            <div id="prod-photo-preview">${productPhoto ? `<img src="${escapeHtml(productPhoto)}" alt="" class="product-photo-thumb">` : '<div class="product-photo-thumb" style="display:grid;place-items:center;color:var(--muted);font-size:24px;">📷</div>'}</div>
            <div>
              <button type="button" class="button button-secondary" id="btn-prod-photo-upload">Selecionar foto</button>
              ${productPhoto ? '<button type="button" class="tiny-button danger" id="btn-prod-photo-remove" style="margin-left:8px;">Remover foto</button>' : ''}
              <input type="file" id="prod-photo-input" accept="image/jpeg,image/png" style="display:none">
              <small class="helper" style="display:block;margin-top:6px;">A imagem será salva na pasta "fotos-produtos" do Google Drive.</small>
            </div>
          </div>
        </div>

        <div class="field full"><label for="prod-descricao">Descrição do produto</label><textarea id="prod-descricao" name="descricao" rows="3" maxlength="4000" placeholder="Ingredientes, peso, detalhes artesanais, modo de conservação…">${escapeHtml(current?.descricao || '')}</textarea></div>
        <div class="field full"><label class="access-module" style="margin:0;cursor:pointer;"><input type="checkbox" name="status" ${(current?.status || 'ativo') === 'ativo' ? 'checked' : ''}><span><b>Produto Ativo</b><small>Disponível para orçamentos e pedidos da SOLO.</small></span></label></div>

        <div class="form-actions"><button class="button button-secondary" type="reset">Limpar</button><button class="button" type="submit">Salvar produto</button></div>
      </form>
    </section>

    <!-- PAINEL 2: LISTA DE PRODUTOS -->
    <section class="content-card users-tab-panel" data-prods-panel="list" ${productsTab === 'list' ? '' : 'hidden'}>
      <div class="card-head"><div><h2>Produtos cadastrados</h2><p>${products.length} produtos disponíveis</p></div><div class="toolbar"><input id="prods-search" aria-label="Buscar produtos" placeholder="Buscar produtos…"></div></div>
      <div id="prods-table">${productRows()}</div>
    </section>`;

    bindProductActions();
  }

  function bindProductActions() {
    workspace.querySelectorAll('[data-prods-tab]').forEach(btn => btn.addEventListener('click', () => {
      productsTab = btn.dataset.prodsTab;
      workspace.querySelectorAll('[data-prods-tab]').forEach(tab => {
        const active = tab.dataset.prodsTab === productsTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      workspace.querySelectorAll('[data-prods-panel]').forEach(panel => {
        panel.hidden = panel.dataset.prodsPanel !== productsTab;
      });
      if (productsTab === 'list') document.querySelector('#prods-search')?.focus();
    }));

    // Atualização em tempo real de Lucro e Margem
    const costInput = document.querySelector('#prod-custo');
    const priceInput = document.querySelector('#prod-venda');
    const updateMarginPreview = () => {
      const calc = calcProfitMargin(costInput?.value, priceInput?.value);
      const costEl = document.querySelector('#margin-display-cost');
      const priceEl = document.querySelector('#margin-display-price');
      const profitEl = document.querySelector('#margin-display-profit');
      const marginEl = document.querySelector('#margin-display-margin');
      if (costEl) costEl.textContent = money(calc.cost);
      if (priceEl) priceEl.textContent = money(calc.price);
      if (profitEl) {
        profitEl.textContent = money(calc.profit);
        profitEl.parentElement.className = `dash-metric-pill ${calc.profit >= 0 ? 'success' : 'danger'}`;
      }
      if (marginEl) {
        marginEl.textContent = `${calc.margin.toFixed(1)}%`;
        marginEl.parentElement.className = `dash-metric-pill ${calc.margin >= 30 ? 'success' : calc.margin > 0 ? 'gold' : 'danger'}`;
      }
    };
    costInput?.addEventListener('input', event => {
      event.target.value = maskCurrency(event.target.value);
      updateMarginPreview();
    });
    priceInput?.addEventListener('input', event => {
      event.target.value = maskCurrency(event.target.value);
      updateMarginPreview();
    });

    document.querySelector('#find-prod-supplier')?.addEventListener('click', openSupplierPicker);

    // Upload de foto do produto
    const photoUploadBtn = document.querySelector('#btn-prod-photo-upload');
    const photoInput = document.querySelector('#prod-photo-input');
    const photoRemoveBtn = document.querySelector('#btn-prod-photo-remove');
    let photoDataUrl = '';
    let removePhotoFlag = false;

    photoUploadBtn?.addEventListener('click', () => photoInput?.click());
    photoInput?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      photoInput.value = '';
      try {
        photoDataUrl = await readAndResizeImage(file);
        removePhotoFlag = false;
        const preview = document.querySelector('#prod-photo-preview');
        if (preview) preview.innerHTML = `<img src="${photoDataUrl}" alt="" class="product-photo-thumb">`;
      } catch (err) {
        toast('Erro ao processar foto: ' + err.message, true);
      }
    });
    photoRemoveBtn?.addEventListener('click', () => {
      photoDataUrl = '';
      removePhotoFlag = true;
      const preview = document.querySelector('#prod-photo-preview');
      if (preview) preview.innerHTML = '<div class="product-photo-thumb" style="display:grid;place-items:center;color:var(--muted);font-size:24px;">📷</div>';
      photoRemoveBtn.remove();
    });

    const form = document.querySelector('#product-form');
    form?.addEventListener('reset', e => {
      e.preventDefault();
      editingProductId = '';
      productPhoto = '';
      renderProducts();
    });
    form?.addEventListener('submit', async e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      const fd = new FormData(form);
      const record = {
        id: fd.get('id') || '',
        expected_updated_at: fd.get('expected_updated_at') || '',
        nome: fd.get('nome'),
        categoria: fd.get('categoria'),
        fornecedor_id: fd.get('fornecedor_id'),
        fornecedor_nome: fd.get('fornecedor_nome'),
        preco_custo: parseCurrency(fd.get('preco_custo')),
        preco_venda: parseCurrency(fd.get('preco_venda')),
        descricao: fd.get('descricao'),
        status: fd.get('status') === 'on' ? 'ativo' : 'inativo'
      };
      if (photoDataUrl) record.foto_data_url = photoDataUrl;
      else if (removePhotoFlag) record.remove_photo = true;

      try {
        const saved = await api(record.id ? 'updateProduct' : 'createProduct', {record});
        const idx = products.findIndex(p => p.id === saved.id);
        if (idx >= 0) products[idx] = saved; else products.push(saved);
        editingProductId = '';
        productPhoto = '';
        productsTab = 'list';
        renderProducts();
        toast('Produto salvo com sucesso.');
      } catch (err) {
        toast(err.message, true);
      } finally {
        submitBtn.disabled = false;
      }
    });

    const search = document.querySelector('#prods-search');
    search?.addEventListener('input', () => {
      const table = document.querySelector('#prods-table');
      if (table) table.innerHTML = productRows(search.value);
      bindProductTableActions();
    });

    bindProductTableActions();
  }

  function bindProductTableActions() {
    workspace.querySelectorAll('[data-prod-edit]').forEach(btn => btn.addEventListener('click', () => {
      editingProductId = btn.dataset.prodEdit;
      const p = products.find(item => item.id === editingProductId);
      productPhoto = p?.foto_url || '';
      productsTab = 'editor';
      renderProducts();
      workspace.querySelector('.content-card')?.scrollIntoView({behavior:'smooth'});
    }));
    workspace.querySelectorAll('[data-prod-delete]').forEach(btn => btn.addEventListener('click', async () => {
      const selected = products.find(item => item.id === btn.dataset.prodDelete);
      if (!selected || !confirm(`Excluir o produto "${selected.nome}"?`)) return;
      btn.disabled = true;
      try {
        await api('deleteProduct', {id: selected.id, version: selected.atualizado_em});
        products = products.filter(p => p.id !== selected.id);
        if (editingProductId === selected.id) {
          editingProductId = '';
          productPhoto = '';
        }
        productsTab = 'list';
        renderProducts();
        toast('Produto excluído com sucesso.');
      } catch (err) {
        btn.disabled = false;
        toast(err.message, true);
      }
    }));
  }

  async function loadSiteMenuPage() {
    workspace.innerHTML = '<div class="workspace-state">Carregando Menu Site…</div>';
    try {
      const data = await api('getSiteMenuAdmin');
      if (activePage !== 'site_menu') return;
      siteMenuConfig = data.config || siteMenuConfig;
      siteCards = data.cards || [];
      renderSiteMenu();
    } catch (error) {
      if (activePage === 'site_menu') workspace.innerHTML = `<div class="workspace-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function siteCardRows(filter = '') {
    const query = filter.trim().toLocaleLowerCase('pt-BR');
    const visible = siteCards.filter(c => `${c.titulo} ${c.descricao}`.toLocaleLowerCase('pt-BR').includes(query));
    if (!visible.length) return '<div class="empty">Nenhum card cadastrado.</div>';
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Ordem</th><th>Fotos</th><th>Título</th><th>Descrição</th><th>Status</th><th>Ações</th></tr></thead><tbody>${visible.map(c => {
      const photos = c.photos || [];
      const thumbs = photos.length ? photos.map(p => `<img src="${escapeHtml(p.url)}" alt="" class="table-card-thumb" onerror="this.style.display='none'">`).join('') : '<span class="helper">Sem fotos</span>';
      return `<tr>
        <td><b>#${escapeHtml(c.ordem || '1')}</b></td>
        <td><div class="table-card-thumbs">${thumbs}</div></td>
        <td><b>${escapeHtml(c.titulo)}</b></td>
        <td><span class="table-subtext" style="max-width:280px;white-space:normal;">${escapeHtml(c.descricao.length > 90 ? c.descricao.slice(0,87) + '…' : c.descricao)}</span></td>
        <td><span class="badge ${c.ativo !== '0' ? '' : 'inactive'}">${c.ativo !== '0' ? 'Ativo' : 'Inativo'}</span></td>
        <td><div class="row-actions"><button class="tiny-button" type="button" data-site-card-edit="${escapeHtml(c.id)}">Editar</button><button class="tiny-button danger" type="button" data-site-card-delete="${escapeHtml(c.id)}">Excluir</button></div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function readAndResizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const maxW = 1200;
          const maxH = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            if (w / h > maxW / maxH) {
              h = Math.round(h * maxW / w);
              w = maxW;
            } else {
              w = Math.round(w * maxH / h);
              h = maxH;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderCardPhotoThumbs() {
    const list = document.querySelector('#card-photos-list');
    const addBtn = document.querySelector('#btn-add-card-photo');
    if (!list) return;
    list.innerHTML = cardPhotos.map((p, idx) => {
      const src = p.startsWith('data:') ? p : `https://drive.google.com/thumbnail?id=${p}&sz=w400`;
      return `<div class="card-photo-item">
        <img src="${escapeHtml(src)}" alt="Foto ${idx + 1}" onerror="this.style.display='none'">
        <button type="button" class="card-photo-remove" data-remove-photo="${idx}" title="Remover foto" aria-label="Remover foto">&times;</button>
      </div>`;
    }).join('');
    if (addBtn) {
      addBtn.disabled = cardPhotos.length >= 3;
      addBtn.textContent = `+ Adicionar foto (${cardPhotos.length}/3)`;
    }
    list.querySelectorAll('[data-remove-photo]').forEach(btn => btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removePhoto);
      cardPhotos.splice(idx, 1);
      renderCardPhotoThumbs();
    }));
  }

  function renderSiteMenu() {
    const currentCard = siteCards.find(c => c.id === editingCardId);
    if (editingCardId && currentCard && !cardPhotos.length && currentCard.photos) {
      cardPhotos = (currentCard.photos || []).map(p => p.id);
    }
    workspace.innerHTML = `<div class="users-tabs" role="tablist" aria-label="Menu do Site">
      <button class="users-tab ${siteMenuTab === 'config' ? 'active' : ''}" type="button" role="tab" data-site-menu-tab="config" aria-selected="${siteMenuTab === 'config'}">Configuração da Seção</button>
      <button class="users-tab ${siteMenuTab === 'card_editor' ? 'active' : ''}" type="button" role="tab" data-site-menu-tab="card_editor" aria-selected="${siteMenuTab === 'card_editor'}">${currentCard ? 'Editar Card' : 'Novo Card'}</button>
      <button class="users-tab ${siteMenuTab === 'card_list' ? 'active' : ''}" type="button" role="tab" data-site-menu-tab="card_list" aria-selected="${siteMenuTab === 'card_list'}">Cards Cadastrados <span>${siteCards.length}</span></button>
    </div>

    <section class="content-card users-tab-panel" data-site-menu-panel="config" ${siteMenuTab === 'config' ? '' : 'hidden'}>
      <div class="card-head"><div><h2>Configuração da Seção no Site</h2><p>Defina o nome do item no menu principal e os títulos da seção correspondente.</p></div></div>
      <form id="site-menu-config-form" class="editor" style="padding: 10px 0;">
        <div class="field"><label for="menu-titulo">Título no Menu Principal</label><input id="menu-titulo" name="menu_titulo" maxlength="50" minlength="2" value="${escapeHtml(siteMenuConfig.menu_titulo || 'Opção')}" placeholder="Ex: Eventos, Opção, etc." required><small class="helper">Aparece na barra de navegação do site entre Estação e Contato.</small></div>
        <div class="field"><label for="secao-titulo">Título da Seção na Página</label><input id="secao-titulo" name="secao_titulo" maxlength="100" minlength="2" value="${escapeHtml(siteMenuConfig.secao_titulo || 'Eventos & Celebrações')}" placeholder="Ex: Eventos Especiais" required><small class="helper">Título principal em destaque na seção do site.</small></div>
        <div class="field full"><label for="secao-subtitulo">Subtítulo / Descrição da Seção</label><input id="secao-subtitulo" name="secao_subtitulo" maxlength="300" value="${escapeHtml(siteMenuConfig.secao_subtitulo || '')}" placeholder="Ex: Experiências gastronômicas exclusivas para momentos memoráveis"><small class="helper">Frase descritiva abaixo do título da seção.</small></div>
        <div class="field full"><label class="access-module" style="margin:0;cursor:pointer;"><input type="checkbox" name="ativo" ${siteMenuConfig.ativo !== '0' ? 'checked' : ''}><span><b>Seção Ativa no Site</b><small>Quando ativada, a opção aparece no menu e a seção com os cards é exibida aos visitantes.</small></span></label></div>
        <div class="form-actions"><button class="button" type="submit">Salvar Configurações</button></div>
      </form>
    </section>

    <section class="content-card users-tab-panel" data-site-menu-panel="card_editor" ${siteMenuTab === 'card_editor' ? '' : 'hidden'}>
      <div class="card-head"><div><h2>${currentCard ? 'Editar Card' : 'Cadastrar Card'}</h2><p>Preencha os detalhes e fotos do card que será exibido nesta seção do site.</p></div></div>
      <form id="site-card-form" class="editor" style="padding: 10px 0;">
        <input type="hidden" name="id" value="${escapeHtml(currentCard?.id || '')}">
        <div class="field full"><label for="card-titulo">Título do Card</label><input id="card-titulo" name="titulo" maxlength="120" minlength="2" value="${escapeHtml(currentCard?.titulo || '')}" placeholder="Ex: Festa corporativa, Casamento, Aniversário" required></div>
        <div class="field full"><label for="card-descricao">Descrição do Card</label><textarea id="card-descricao" name="descricao" rows="4" maxlength="4000" placeholder="Explique o que a SOLO oferece nesta experiência..." required>${escapeHtml(currentCard?.descricao || '')}</textarea><small class="helper">Texto descritivo exibido no corpo do card.</small></div>
        <div class="field"><label for="card-ordem">Ordem de exibição</label><input id="card-ordem" name="ordem" type="number" min="1" max="99" value="${escapeHtml(currentCard?.ordem || '1')}" required></div>
        <div class="field"><label class="access-module" style="margin-top:28px;cursor:pointer;"><input type="checkbox" name="ativo" ${currentCard?.ativo !== '0' ? 'checked' : ''}><span><b>Card Ativo</b><small>Visível no site para orçamentos.</small></span></label></div>

        <div class="field full" style="margin-top:14px;">
          <label>Fotos do Card (Até 3 fotos)</label>
          <div class="card-photos-container">
            <div id="card-photos-list" class="card-photos-list"></div>
            <button type="button" class="button button-secondary" id="btn-add-card-photo" ${cardPhotos.length >= 3 ? 'disabled' : ''}>+ Adicionar foto (${cardPhotos.length}/3)</button>
            <input type="file" id="card-photo-file-input" accept="image/jpeg,image/png" style="display:none">
          </div>
          <small class="helper">As fotos são salvas na pasta "fotos-menu-site" do Google Drive e exibidas em carrossel no card.</small>
        </div>

        <div class="form-actions"><button class="button button-secondary" type="reset">Limpar</button><button class="button" type="submit">Salvar Card</button></div>
      </form>
    </section>

    <section class="content-card users-tab-panel" data-site-menu-panel="card_list" ${siteMenuTab === 'card_list' ? '' : 'hidden'}>
      <div class="card-head"><div><h2>Cards Cadastrados</h2><p>${siteCards.length} cards disponíveis</p></div><div class="toolbar"><input id="cards-search" aria-label="Buscar cards" placeholder="Buscar cards…"></div></div>
      <div id="cards-table">${siteCardRows()}</div>
    </section>`;

    bindSiteMenuActions();
    renderCardPhotoThumbs();
  }

  function bindSiteMenuActions() {
    workspace.querySelectorAll('[data-site-menu-tab]').forEach(btn => btn.addEventListener('click', () => {
      siteMenuTab = btn.dataset.siteMenuTab;
      workspace.querySelectorAll('[data-site-menu-tab]').forEach(tab => {
        const active = tab.dataset.siteMenuTab === siteMenuTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      workspace.querySelectorAll('[data-site-menu-panel]').forEach(panel => {
        panel.hidden = panel.dataset.siteMenuPanel !== siteMenuTab;
      });
    }));

    const configForm = document.querySelector('#site-menu-config-form');
    if (configForm) {
      configForm.addEventListener('submit', async event => {
        event.preventDefault();
        const btn = configForm.querySelector('[type="submit"]');
        btn.disabled = true;
        const formData = new FormData(configForm);
        const record = {
          menu_titulo: formData.get('menu_titulo'),
          secao_titulo: formData.get('secao_titulo'),
          secao_subtitulo: formData.get('secao_subtitulo'),
          ativo: formData.get('ativo') === 'on'
        };
        try {
          const saved = await api('saveSiteMenuConfig', {record});
          siteMenuConfig = saved;
          toast('Configurações do menu salvas com sucesso.');
        } catch (err) {
          toast(err.message, true);
        } finally {
          btn.disabled = false;
        }
      });
    }

    const cardForm = document.querySelector('#site-card-form');
    const photoFileInput = document.querySelector('#card-photo-file-input');
    const addPhotoBtn = document.querySelector('#btn-add-card-photo');

    if (addPhotoBtn && photoFileInput) {
      addPhotoBtn.addEventListener('click', () => photoFileInput.click());
      photoFileInput.addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        photoFileInput.value = '';
        if (cardPhotos.length >= 3) {
          toast('Limite de 3 fotos atingido.', true);
          return;
        }
        try {
          const dataUrl = await readAndResizeImage(file);
          cardPhotos.push(dataUrl);
          renderCardPhotoThumbs();
        } catch (err) {
          toast('Falha ao processar imagem: ' + err.message, true);
        }
      });
    }

    if (cardForm) {
      cardForm.addEventListener('reset', event => {
        event.preventDefault();
        editingCardId = '';
        cardPhotos = [];
        renderSiteMenu();
      });
      cardForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!cardForm.reportValidity()) return;
        const btn = cardForm.querySelector('[type="submit"]');
        btn.disabled = true;
        const formData = new FormData(cardForm);
        const record = {
          id: formData.get('id') || '',
          titulo: formData.get('titulo'),
          descricao: formData.get('descricao'),
          ordem: formData.get('ordem'),
          ativo: formData.get('ativo') === 'on',
          fotos: cardPhotos
        };
        try {
          const saved = await api('saveSiteCard', {record, operation: record.id ? 'update' : 'create'});
          const idx = siteCards.findIndex(c => c.id === saved.id);
          if (idx >= 0) siteCards[idx] = saved; else siteCards.push(saved);
          editingCardId = '';
          cardPhotos = [];
          siteMenuTab = 'card_list';
          void loadSiteMenuPage();
          toast('Card salvo com sucesso.');
        } catch (err) {
          toast(err.message, true);
        } finally {
          btn.disabled = false;
        }
      });
    }

    const search = document.querySelector('#cards-search');
    if (search) {
      search.addEventListener('input', () => {
        const table = document.querySelector('#cards-table');
        if (table) table.innerHTML = siteCardRows(search.value);
        bindSiteCardActions();
      });
    }

    bindSiteCardActions();
  }

  function bindSiteCardActions() {
    workspace.querySelectorAll('[data-site-card-edit]').forEach(btn => btn.addEventListener('click', () => {
      editingCardId = btn.dataset.siteCardEdit;
      const c = siteCards.find(item => item.id === editingCardId);
      cardPhotos = (c?.photos || []).map(p => p.id);
      siteMenuTab = 'card_editor';
      renderSiteMenu();
      workspace.querySelector('.content-card')?.scrollIntoView({behavior:'smooth'});
    }));
    workspace.querySelectorAll('[data-site-card-delete]').forEach(btn => btn.addEventListener('click', async () => {
      const selected = siteCards.find(item => item.id === btn.dataset.siteCardDelete);
      if (!selected || !confirm(`Excluir o card "${selected.titulo}"?`)) return;
      btn.disabled = true;
      try {
        await api('deleteSiteCard', {id: selected.id});
        siteCards = siteCards.filter(item => item.id !== selected.id);
        if (editingCardId === selected.id) {
          editingCardId = '';
          cardPhotos = [];
        }
        siteMenuTab = 'card_list';
        renderSiteMenu();
        toast('Card excluído com sucesso.');
      } catch (err) {
        btn.disabled = false;
        toast(err.message, true);
      }
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
        <td><span class="badge ${row.status === 'pago' ? '' : 'finance-pending'}">${row.status === 'pago' ? 'Pago' : 'Em aberto'}</span></td>
        <td><div class="row-actions"><button class="tiny-button" type="button" data-finance-edit="${escapeHtml(row.id)}">Editar</button><button class="tiny-button danger" type="button" data-finance-delete="${escapeHtml(row.id)}">Excluir</button></div></td>
      </tr>`).join('')}</tbody></table></div>`;
  }
  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '—';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
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
        <div><span>Total em aberto</span><strong>${money(financeRows[type].filter(row => row.status === 'pendente').reduce((sum, row) => sum + (Number(row.valor) || 0), 0))}</strong></div>
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
          <div class="field"><label for="finance-status">Status *</label><select id="finance-status" name="status"><option value="pendente" ${current?.status !== 'pago' ? 'selected' : ''}>Em aberto</option><option value="pago" ${current?.status === 'pago' ? 'selected' : ''}>Pago</option></select></div>
          <div class="field"><label for="finance-paid">Data do pagamento</label><input id="finance-paid" name="data_pagamento" type="date" value="${escapeHtml(current?.data_pagamento || '')}" ${current?.status === 'pago' ? '' : 'disabled'}></div>
          <div class="field full"><label for="finance-notes">Observações</label><textarea id="finance-notes" name="observacoes" maxlength="20000" rows="8">${escapeHtml(current?.observacoes || '')}</textarea></div>
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
      const firstPage = ['dashboard','orders','finance','users','clients','settings'].find(canAccess);
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
