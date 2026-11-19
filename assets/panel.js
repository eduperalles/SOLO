(() => {
  const API = window.SOLO_API_URL || '';
  const token = sessionStorage.getItem('solo_session');
  const workspace = document.querySelector('#workspace');
  const toastNode = document.querySelector('#toast');
  let user = JSON.parse(sessionStorage.getItem('solo_user') || 'null');
  let users = [];
  let activePage = 'dashboard';
  let editingId = '';
  let usersTab = 'editor';
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
    const response = await fetch(API, {
      method: 'POST',
      headers: {'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({action, token, ...payload})
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Falha ao processar a solicitação.');
    return result.data;
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

  function navigate(page) {
    if (page === 'users' && user?.perfil !== 'admin') return;
    activePage = page;
    document.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    document.querySelector('#page-title').textContent = page === 'users' ? 'Usuários' : 'Visão geral';
    document.querySelector('#sidebar').classList.remove('open');
    if (page === 'dashboard') renderDashboard();
    else void loadUsersPage();
  }
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.page)));

  function renderDashboard() {
    const admin = user?.perfil === 'admin';
    const userCount = admin ? users.length : 1;
    workspace.innerHTML = `
      <section class="welcome">
        ${avatarMarkup(user, '', profilePhoto)}
        <div><h2>Olá, ${escapeHtml(user?.nome || 'equipe SOLO')}.</h2><p>O painel está pronto para receber os próximos módulos do projeto.</p></div>
      </section>
      <div class="stats">
        <div class="stat"><span>Usuários cadastrados</span><strong>${userCount}</strong></div>
        <div class="stat"><span>Módulos ativos</span><strong>${admin ? 1 : 0}</strong></div>
        <div class="stat"><span>Próxima etapa</span><strong style="font-size:18px">Em definição</strong></div>
      </div>
      <section class="content-card">
        <div class="card-head"><div><h2>Visão inicial</h2><p>Nenhum módulo adicional foi habilitado nesta entrega.</p></div></div>
        <div class="empty">A administração de usuários já está disponível. Os demais módulos serão adicionados nos próximos passos.</div>
      </section>`;
  }

  async function loadUsersPage() {
    workspace.innerHTML = '<div class="workspace-state">Carregando usuários…</div>';
    try {
      users = await api('listUsers');
      renderUsers();
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
        <td><span class="user-cell">${avatarMarkup(item)}<b>${escapeHtml(item.nome)}</b></span></td>
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
        <div class="card-head"><div><h2>${current ? 'Editar usuário' : 'Cadastrar usuário'}</h2><p>Somente administradores podem criar ou alterar acessos.</p></div></div>
        <form id="user-form" class="editor">
          <input type="hidden" name="id" value="${escapeHtml(current?.id || '')}">
          <div class="field"><label for="user-form-name">Nome completo</label><input id="user-form-name" name="nome" maxlength="180" value="${escapeHtml(current?.nome || '')}" required></div>
          <div class="field"><label for="user-form-email">E-mail</label><input id="user-form-email" name="email" type="email" maxlength="254" value="${escapeHtml(current?.email || '')}" required></div>
          <div class="field"><label for="user-form-role">Perfil</label><select id="user-form-role" name="perfil" required><option value="operador" ${current?.perfil !== 'admin' ? 'selected' : ''}>Operador</option><option value="admin" ${current?.perfil === 'admin' ? 'selected' : ''}>Administrador</option></select></div>
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
        renderDashboard();
        if (activePage === 'users') renderUsers();
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
      if (user.perfil !== 'admin') document.querySelector('[data-page="users"]').hidden = true;
      if (user.perfil === 'admin') {
        try { users = await api('listUsers'); } catch (_) {}
      }
      await loadOwnPhoto();
      renderDashboard();
    } catch (_) {
      clearSession();
    }
  }
  void start();
})();
