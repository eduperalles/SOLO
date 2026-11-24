const DRIVE_FOLDER_ID_ = '1uDmZGpSEbeUq1PX_MvU-7nYW4Y4IpFva';
const USERS_COLUMNS_ = ['id','nome','email','senha_hash','salt','perfil','status','foto_arquivo_id','foto_atualizada_em','criado_em','atualizado_em'];
const FINANCE_COLUMNS_ = ['id','descricao','pessoa','categoria','valor','data_vencimento','data_pagamento','status','observacoes','criado_em','atualizado_em','cliente_id','pedido_id'];
const CLIENT_COLUMNS_ = ['id','nome','email','whatsapp','data_cadastro','criado_em','atualizado_em'];
const SUPPLIER_COLUMNS_ = ['id','fornecedor','email','whatsapp','endereco','cidade','uf','tipo_produto','observacoes','criado_em','atualizado_em'];
const PRODUCT_COLUMNS_ = ['quantidade','unidade_medida','id','nome','categoria','fornecedor_id','fornecedor_nome','preco_custo','preco_venda','margem_lucro','foto_arquivo_id','descricao','status','criado_em','atualizado_em'];
const COUPON_COLUMNS_ = ['id','codigo','desconto_valor','tipo','valor_minimo','cliente_id','cliente_nome','limite_usos','usos_atuais','validade','status','criado_em','atualizado_em'];
const MENU_CONFIG_COLUMNS_ = ['id','menu_titulo','secao_titulo','secao_subtitulo','ativo','atualizado_em'];
const MENU_CARD_COLUMNS_ = ['id','titulo','descricao','fotos_json','ordem','ativo','criado_em','atualizado_em'];
const ACCESS_COLUMNS_ = ['usuario_id','dashboard','users','clients','suppliers','products','kits','coupons','site_menu','orders','finance','atualizado_em','atualizado_por'];
const MODULES_ = [{id:'dashboard',name:'Visão geral'},{id:'users',name:'Usuários'},{id:'clients',name:'Clientes'},{id:'suppliers',name:'Fornecedores'},{id:'products',name:'Produtos'},{id:'kits',name:'Kits'},{id:'coupons',name:'Cupons'},{id:'site_menu',name:'Menu Site'},{id:'orders',name:'Pedidos'},{id:'finance',name:'Financeiro'},{id:'settings',name:'Configurações',adminOnly:true}];
const SESSION_SECONDS = 21600;
const HASH_ROUNDS = 10000;

function doGet(event) {
  const props = PropertiesService.getScriptProperties();
  const action = event && event.parameter && event.parameter.action;
  if (action === 'recordVisit' || action === 'getDailyVisits') {
    return json_({ ok: true, data: handleDailyVisits_(action === 'recordVisit') });
  }
  return json_({ok:true,data:{service:'SOLO admin API',configured:!!props.getProperty('USERS_FILE_ID'),moduleAccess:3,panelReads:1,kits:1,productMeasures:1,orders:!!props.getProperty('ORDERS_FILE_ID'),customerPortal:1,clients:!!props.getProperty('CLIENTS_FILE_ID'),suppliers:!!props.getProperty('SUPPLIERS_FILE_ID'),products:!!props.getProperty('PRODUCTS_FILE_ID'),coupons:!!props.getProperty('COUPONS_FILE_ID'),siteMenu:!!props.getProperty('MENU_CONFIG_FILE_ID'),settings:!!props.getProperty('SETTINGS_FILE_ID')}});
}

function doPost(event) {
  try {
    const request = JSON.parse(event && event.postData && event.postData.contents || '{}');
    return json_({ok:true,data:dispatch_(request)});
  } catch (error) {
    console.error(error);
    return json_({ok:false,message:publicError_(error)});
  }
}

function handleDailyVisits_(isRecord) {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
  const lock = LockService.getScriptLock();
  lock.tryLock(4000);
  try {
    const storedDate = props.getProperty('DAILY_VISITS_DATE') || '';
    let count = Number(props.getProperty('DAILY_VISITS_COUNT') || 0);
    if (storedDate !== today) {
      count = 0;
      props.setProperty('DAILY_VISITS_DATE', today);
      props.setProperty('DAILY_VISITS_COUNT', '0');
    }
    if (isRecord) {
      count += 1;
      props.setProperty('DAILY_VISITS_COUNT', String(count));
    }
    return { count: count, date: today };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

let PANEL_READ_MEMO_ = null;
function panelMemo_(key, read) {
  if (!PANEL_READ_MEMO_) return read();
  if (!Object.prototype.hasOwnProperty.call(PANEL_READ_MEMO_,key)) PANEL_READ_MEMO_[key] = read();
  return PANEL_READ_MEMO_[key];
}
function dispatch_(request) {
  const previous = PANEL_READ_MEMO_;
  PANEL_READ_MEMO_ = ['panelRead','panelBootstrap'].includes(request.action) ? {} : null;
  try { return dispatchAction_(request); } finally { PANEL_READ_MEMO_ = previous; }
}
function dispatchAction_(request, trustedActor) {
  const publicActions = ['login','placeOrder','requestCustomerCode','verifyCustomerCode','customerOrders','customerLogout','getSiteMenuData','submitBudgetRequest','validateCoupon','recordVisit','getDailyVisits'];
  const actor = trustedActor || (publicActions.includes(request.action) ? null : auth_(request.token));
  switch (request.action) {
    case 'getDashboardStats': return getDashboardStats_(actor);
    case 'getDriveInventory': return getDriveInventory_(actor);
    case 'panelRead': return panelRead_(actor,request.reads);
    case 'panelBootstrap': return panelBootstrap_(actor);
    case 'recordVisit': return handleDailyVisits_(true);
    case 'getDailyVisits': return handleDailyVisits_(false);
    case 'placeOrder': return placeOrder_(request);
    case 'validateCoupon': return validateCoupon_(request);
    case 'requestCustomerCode': return requestCustomerCode_(request);
    case 'verifyCustomerCode': return verifyCustomerCode_(request);
    case 'customerOrders': return customerOrders_(request);
    case 'customerLogout': return customerLogout_(request);
    case 'getSiteMenuData': return getSiteMenuData_();
    case 'submitBudgetRequest': return submitBudgetRequest_(request);
    case 'getSiteMenuAdmin': module_(actor, 'site_menu'); return getSiteMenuAdmin_();
    case 'saveSiteMenuConfig': return saveSiteMenuConfig_(actor, request.record || {});
    case 'saveSiteCard': return saveSiteCard_(actor, request.record || {}, request.operation || 'create');
    case 'deleteSiteCard': return deleteSiteCard_(actor, request.id);
    case 'listOrders': return listOrders_(actor);
    case 'retryOrder': module_(actor, 'orders'); return withLock_(() => { const rows=readOrders_(); const order=rows.find(row=>row.id===String(request.id || '')); if (!order) throw Error('Pedido não encontrado.'); if (order.status === 'excluindo') throw Error('Este pedido está com exclusão pendente. Tente excluí-lo novamente.'); if (order.status !== 'recebido') finishOrder_(order,rows); return {saved:true}; });
    case 'deleteOrder': return deleteOrder_(actor, request.id);
    case 'login': return login_(request);
    case 'logout': return logout_(request);
    case 'validateSession': return publicUser_(actor);
    case 'getModuleAccess': return getModuleAccess_(actor, request.id);
    case 'saveModuleAccess': return saveModuleAccess_(actor, request);
    case 'listUsers': module_(actor, 'users'); return readUsers_().map(adminUser_);
    case 'listClients': module_(actor, 'clients'); return readClients_();
    case 'createClient': return saveClient_(actor, request.record || {}, 'create');
    case 'updateClient': return saveClient_(actor, request.record || {}, 'update');
    case 'deleteClient': return deleteClient_(actor, request.id, request.version);
    case 'listSuppliers': module_(actor, 'suppliers'); return readSuppliers_();
    case 'createSupplier': return saveSupplier_(actor, request.record || {}, 'create');
    case 'updateSupplier': return saveSupplier_(actor, request.record || {}, 'update');
    case 'deleteSupplier': return deleteSupplier_(actor, request.id, request.version);
    case 'listKits': module_(actor, 'kits'); return readKits_();
    case 'listKitProducts': module_(actor, 'kits'); return readProducts_();
    case 'createKit': return saveKit_(actor, request.record || {}, 'create');
    case 'updateKit': return saveKit_(actor, request.record || {}, 'update');
    case 'deleteKit': return deleteKit_(actor, request.id, request.version);
    case 'listProducts': module_(actor, 'products'); return readProducts_();
    case 'createProduct': return saveProduct_(actor, request.record || {}, 'create');
    case 'updateProduct': return saveProduct_(actor, request.record || {}, 'update');
    case 'deleteProduct': return deleteProduct_(actor, request.id, request.version);
    case 'listCoupons': module_(actor, 'coupons'); return readCoupons_();
    case 'createCoupon': return saveCoupon_(actor, request.record || {}, 'create');
    case 'updateCoupon': return saveCoupon_(actor, request.record || {}, 'update');
    case 'deleteCoupon': return deleteCoupon_(actor, request.id, request.version);
    case 'getUserPhotos': return getUserPhotos_(actor, request.ids);
    case 'createUser': return saveUser_(actor, request.record || {}, 'create');
    case 'updateUser': return saveUser_(actor, request.record || {}, 'update');
    case 'deleteUser': return deleteUser_(actor, request.id);
    case 'getMyProfile': return ownProfile_(actor);
    case 'getMyProfilePhoto': return ownPhoto_(actor);
    case 'saveMyProfile': return saveMyProfile_(actor, request.record || {});
    case 'listFinanceReceivables': return listFinance_(actor, 'receivables');
    case 'saveFinanceReceivable': return saveFinance_(actor, 'receivables', request.record || {});
    case 'deleteFinanceReceivable': return deleteFinance_(actor, 'receivables', request.id);
    case 'listFinancePayables': return listFinance_(actor, 'payables');
    case 'saveFinancePayable': return saveFinance_(actor, 'payables', request.record || {});
    case 'deleteFinancePayable': return deleteFinance_(actor, 'payables', request.id);
    default: throw Error('Operação não reconhecida.');
  }
}

function setupSolo() {
  const props = PropertiesService.getScriptProperties();
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
  props.setProperty('DRIVE_FOLDER_ID', DRIVE_FOLDER_ID_);
  const files = folder.getFilesByName('usuarios.csv');
  const usersFile = files.hasNext() ? files.next() : folder.createFile('usuarios.csv', csv_(USERS_COLUMNS_, []), 'text/csv');
  props.setProperty('USERS_FILE_ID', usersFile.getId());
  const photos = folder.getFoldersByName('fotos-perfil');
  const photoFolder = photos.hasNext() ? photos.next() : folder.createFolder('fotos-perfil');
  props.setProperty('PHOTO_FOLDER_ID', photoFolder.getId());
  setupFinanceFiles_(folder, props);
  setupSettings();
  setupClients();

  const email = normalizeEmail_(props.getProperty('INITIAL_ADMIN_EMAIL'));
  const password = String(props.getProperty('INITIAL_ADMIN_PASSWORD') || '');
  if (!email) throw Error('Configure INITIAL_ADMIN_EMAIL nas propriedades do script e execute novamente.');
  withLock_(() => {
    const rows = readUsers_();
    const exists = rows.some(row => normalizeEmail_(row.email) === email);
    if (!exists && password.length < 4) throw Error('Configure INITIAL_ADMIN_PASSWORD nas propriedades do script para criar o administrador inicial.');
    if (!exists) {
      const salt = random_();
      rows.push({
        id: Utilities.getUuid(),
        nome: 'Administrador SOLO',
        email,
        senha_hash: passwordHash_(password, salt),
        salt,
        perfil: 'admin',
        status: 'ativo',
        foto_arquivo_id: '',
        foto_atualizada_em: '',
        criado_em: now_(),
        atualizado_em: now_()
      });
      saveUsers_(rows);
    }
  });
  props.deleteProperty('INITIAL_ADMIN_PASSWORD');
  return 'SOLO configurado; usuários, fotos e os dois CSVs financeiros estão na pasta do Drive.';
}

function setupSettings() {
  return withLock_(() => {
    const props = PropertiesService.getScriptProperties();
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
    const files = folder.getFilesByName('configuracoes.csv');
    const file = files.hasNext() ? files.next() : folder.createFile('configuracoes.csv', csv_(ACCESS_COLUMNS_, []), 'text/csv');
    props.setProperty('SETTINGS_FILE_ID', file.getId());
    return 'Configurações SOLO prontas; configuracoes.csv preservado na pasta do projeto.';
  });
}

function readAccess_() { return panelMemo_('access',()=>readAccessFresh_()); }
function readAccessFresh_() {
  const id = PropertiesService.getScriptProperties().getProperty('SETTINGS_FILE_ID');
  if (!id) throw Error('Configurações não inicializadas. Execute setupSettings.');
  const text = DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  const matrix = Utilities.parseCsv(text);
  const headers = matrix.shift() || [];
  if (ACCESS_COLUMNS_.filter(key => !['clients','suppliers','products','kits','coupons','site_menu','orders'].includes(key)).some(key => !headers.includes(key))) throw Error('Cabeçalho de configuracoes.csv inválido.');
  return matrix.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((key, index) => [key,row[index] || ''])));
}

function access_(user, rows) {
  if (user.perfil === 'admin') return {dashboard:true,users:true,clients:true,suppliers:true,products:true,kits:true,coupons:true,site_menu:true,orders:true,finance:true,settings:true};
  const row = (rows || readAccess_()).find(row => row.usuario_id === user.id);
  // Preserva o acesso anterior até o administrador configurar o usuário.
  return {dashboard:row ? row.dashboard === '1' : true,users:row ? row.users === '1' : false,clients:!!row && row.clients === '1',suppliers:!!row && row.suppliers === '1',products:!!row && row.products === '1',kits:!!row && row.kits === '1',coupons:!!row && row.coupons === '1',site_menu:!!row && row.site_menu === '1',orders:!!row && row.orders === '1',finance:row ? row.finance === '1' : true,settings:false};
}

function module_(actor, module) {
  if (!actor || !access_(actor)[module]) throw Error('Sem permissão para acessar este módulo.');
}

function getModuleAccess_(actor, id) {
  admin_(actor);
  const selected = readUsers_().find(row => row.id === String(id || ''));
  if (!selected) throw Error('Usuário não encontrado.');
  const rows = readAccess_();
  const row = rows.find(row => row.usuario_id === selected.id);
  return {user:publicUser_(selected),modules:MODULES_,access:access_(selected, rows),version:row ? row.atualizado_em : ''};
}

function saveModuleAccess_(actor, request) {
  admin_(actor);
  return withLock_(() => {
    const selected = readUsers_().find(row => row.id === String(request.id || ''));
    if (!selected) throw Error('Usuário não encontrado.');
    if (selected.perfil === 'admin') throw Error('Administradores mantêm acesso integral.');
    const input = request.access;
    if (!input || ['dashboard','finance','users'].some(key => typeof input[key] !== 'boolean') || Object.keys(input).some(key => !['dashboard','finance','users','clients','suppliers','products','kits','coupons','site_menu','orders'].includes(key)) || Object.values(input).some(value => typeof value !== 'boolean')) throw Error('Permissões inválidas.');
    const rows = readAccess_();
    const index = rows.findIndex(row => row.usuario_id === selected.id);
    if (String(request.version || '') !== (index < 0 ? '' : rows[index].atualizado_em)) throw Error('Permissões atualizadas por outra sessão. Selecione o usuário novamente.');
    const next = {kits:input.kits === undefined ? (index < 0 ? '0' : rows[index].kits || '0') : input.kits ? '1' : '0',orders:input.orders === undefined ? (index < 0 ? '0' : rows[index].orders || '0') : input.orders ? '1' : '0',usuario_id:selected.id,dashboard:input.dashboard ? '1' : '0',users:input.users ? '1' : '0',finance:input.finance ? '1' : '0',clients:input.clients === undefined ? (index < 0 ? '0' : rows[index].clients || '0') : input.clients ? '1' : '0',suppliers:input.suppliers === undefined ? (index < 0 ? '0' : rows[index].suppliers || '0') : input.suppliers ? '1' : '0',products:input.products === undefined ? (index < 0 ? '0' : rows[index].products || '0') : input.products ? '1' : '0',coupons:input.coupons === undefined ? (index < 0 ? '0' : rows[index].coupons || '0') : input.coupons ? '1' : '0',site_menu:input.site_menu === undefined ? (index < 0 ? '0' : rows[index].site_menu || '0') : input.site_menu ? '1' : '0',atualizado_em:now_(),atualizado_por:actor.id};
    if (index < 0) rows.push(next); else rows[index] = next;
    DriveApp.getFileById(PropertiesService.getScriptProperties().getProperty('SETTINGS_FILE_ID')).setContent(csv_(ACCESS_COLUMNS_, rows));
    return {access:access_(selected, rows),version:next.atualizado_em};
  });
}

function setupClients() {
  return withLock_(() => {
    const props = PropertiesService.getScriptProperties();
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
    const files = folder.getFilesByName('clientes.csv');
    const file = files.hasNext() ? files.next() : folder.createFile('clientes.csv', csv_(CLIENT_COLUMNS_, []), 'text/csv');
    props.setProperty('CLIENTS_FILE_ID', file.getId());
    const accessId = props.getProperty('SETTINGS_FILE_ID');
    if (accessId) {
      const rows = readAccess_();
      rows.forEach(row => { if (row.clients === undefined) row.clients = '0'; });
      DriveApp.getFileById(accessId).setContent(csv_(ACCESS_COLUMNS_, rows));
    }
    return 'Cadastro de clientes pronto; clientes.csv na pasta SOLO e permissões existentes preservadas.';
  });
}

function readClients_() {
  const id = PropertiesService.getScriptProperties().getProperty('CLIENTS_FILE_ID');
  if (!id) throw Error('Cadastro de clientes não configurado. Execute setupClients.');
  const text = DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  const matrix = Utilities.parseCsv(text);
  const headers = matrix.shift() || [];
  if (CLIENT_COLUMNS_.some(key => !headers.includes(key))) throw Error('Cabeçalho de clientes.csv inválido.');
  return matrix.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((key, index) => [key,row[index] || ''])));
}

function saveClientRows_(rows) {
  const id = PropertiesService.getScriptProperties().getProperty('CLIENTS_FILE_ID');
  if (!id) throw Error('Cadastro de clientes não configurado. Execute setupClients.');
  DriveApp.getFileById(id).setContent(csv_(CLIENT_COLUMNS_, rows));
}

function saveClient_(actor, input, operation) {
  module_(actor, 'clients');
  const id = String(input.id || '');
  const nome = String(input.nome || '').trim();
  const email = normalizeEmail_(input.email);
  const rawWhatsapp = String(input.whatsapp || '').trim();
  const whatsapp = rawWhatsapp.replace(/\D/g, '');
  const data = String(input.data_cadastro || '');
  if (nome.length < 2 || nome.length > 180) throw Error('Informe o nome completo do cliente (2 a 180 caracteres).');
  if (!validEmail_(email)) throw Error('Informe um e-mail válido.');
  if (!/^[+\d() .-]+$/.test(rawWhatsapp) || !/^\d{10,15}$/.test(whatsapp)) throw Error('Informe um WhatsApp válido com DDD (10 a 15 dígitos).');
  if (!isFinanceDate_(data)) throw Error('Informe uma data de cadastro válida.');
  return withLock_(() => {
    const rows = readClients_();
    const index = operation === 'update' ? rows.findIndex(row => row.id === id) : -1;
    const old = rows[index];
    if (operation === 'update' && !old) throw Error('Cliente não encontrado.');
    if (old && String(input.expected_updated_at || '') !== old.atualizado_em) throw Error('Cliente atualizado por outra sessão. Reabra o cadastro antes de salvar.');
    const stamp = now_();
    const record = {id:old ? old.id : Utilities.getUuid(),nome,email,whatsapp,data_cadastro:data,criado_em:old ? old.criado_em : stamp,atualizado_em:stamp};
    if (old) rows[index] = record; else rows.push(record);
    saveClientRows_(rows);
    return record;
  });
}

function deleteClient_(actor, id, version) {
  module_(actor, 'clients');
  return withLock_(() => {
    const rows = readClients_();
    const selected = rows.find(row => row.id === String(id || ''));
    if (!selected) throw Error('Cliente não encontrado.');
    if (String(version || '') !== selected.atualizado_em) throw Error('Cliente atualizado por outra sessão. Atualize a lista antes de excluir.');
    if (PropertiesService.getScriptProperties().getProperty('ORDERS_FILE_ID') && readOrders_().some(order => order.cliente_id === selected.id)) throw Error('Este cliente possui pedidos vinculados e não pode ser excluído.');
    saveClientRows_(rows.filter(row => row.id !== selected.id));
    return {deleted:true};
  });
}

function setupSuppliers() {
  return withLock_(() => {
    const file = getSuppliersFile_();
    const props = PropertiesService.getScriptProperties();
    props.setProperty('SUPPLIERS_FILE_ID', file.getId());
    const accessId = props.getProperty('SETTINGS_FILE_ID');
    if (accessId) {
      const rows = readAccess_();
      rows.forEach(row => { if (row.suppliers === undefined) row.suppliers = '0'; });
      DriveApp.getFileById(accessId).setContent(csv_(ACCESS_COLUMNS_, rows));
    }
    return 'Cadastro de fornecedores pronto; fornecedores.csv na pasta SOLO e permissões existentes preservadas.';
  });
}

function getSuppliersFile_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SUPPLIERS_FILE_ID');
  if (id) {
    try {
      return DriveApp.getFileById(id);
    } catch (_) {}
  }
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
  const files = folder.getFilesByName('fornecedores.csv');
  const file = files.hasNext() ? files.next() : folder.createFile('fornecedores.csv', csv_(SUPPLIER_COLUMNS_, []), 'text/csv');
  props.setProperty('SUPPLIERS_FILE_ID', file.getId());
  return file;
}

function readSuppliers_() {
  const file = getSuppliersFile_();
  const text = file.getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  const matrix = Utilities.parseCsv(text);
  const headers = matrix.shift() || [];
  if (SUPPLIER_COLUMNS_.some(key => !headers.includes(key))) throw Error('Cabeçalho de fornecedores.csv inválido.');
  return matrix.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((key, index) => [key,row[index] || ''])));
}

function saveSupplierRows_(rows) {
  const file = getSuppliersFile_();
  file.setContent(csv_(SUPPLIER_COLUMNS_, rows));
}

function saveSupplier_(actor, input, operation) {
  module_(actor, 'suppliers');
  const id = String(input.id || '');
  const fornecedor = String(input.fornecedor || '').trim();
  const email = normalizeEmail_(input.email);
  const rawWhatsapp = String(input.whatsapp || '').trim();
  const whatsapp = rawWhatsapp.replace(/\D/g, '');
  const endereco = String(input.endereco || '').trim();
  const cidade = String(input.cidade || '').trim();
  const uf = String(input.uf || '').trim().toUpperCase();
  const tipo_produto = String(input.tipo_produto || '').trim();
  const observacoes = String(input.observacoes || '').trim();

  if (fornecedor.length < 2 || fornecedor.length > 180) throw Error('Informe o nome do fornecedor (2 a 180 caracteres).');
  if (!validEmail_(email)) throw Error('Informe um e-mail válido.');
  if (!/^[+\d() .-]+$/.test(rawWhatsapp) || !/^\d{10,15}$/.test(whatsapp)) throw Error('Informe um WhatsApp válido com DDD (10 a 15 dígitos).');
  if (endereco.length > 250) throw Error('O endereço deve conter até 250 caracteres.');
  if (cidade.length > 100) throw Error('A cidade deve conter até 100 caracteres.');
  if (uf && !/^[A-Z]{2}$/.test(uf)) throw Error('Informe uma UF válida de 2 letras (ex: SP).');
  if (tipo_produto.length > 180) throw Error('O tipo de produto deve conter até 180 caracteres.');
  if (observacoes.length > 10000) throw Error('As observações devem conter até 10.000 caracteres.');

  return withLock_(() => {
    const rows = readSuppliers_();
    const index = operation === 'update' ? rows.findIndex(row => row.id === id) : -1;
    const old = rows[index];
    if (operation === 'update' && !old) throw Error('Fornecedor não encontrado.');
    if (old && String(input.expected_updated_at || '') !== old.atualizado_em) throw Error('Fornecedor atualizado por outra sessão. Reabra o cadastro antes de salvar.');
    const stamp = now_();
    const record = {id:old ? old.id : Utilities.getUuid(),fornecedor,email,whatsapp,endereco,cidade,uf,tipo_produto,observacoes,criado_em:old ? old.criado_em : stamp,atualizado_em:stamp};
    if (old) rows[index] = record; else rows.push(record);
    saveSupplierRows_(rows);
    return record;
  });
}

function deleteSupplier_(actor, id, version) {
  module_(actor, 'suppliers');
  return withLock_(() => {
    const rows = readSuppliers_();
    const selected = rows.find(row => row.id === String(id || ''));
    if (!selected) throw Error('Fornecedor não encontrado.');
    if (String(version || '') !== selected.atualizado_em) throw Error('Fornecedor atualizado por outra sessão. Atualize a lista antes de excluir.');
    saveSupplierRows_(rows.filter(row => row.id !== selected.id));
    return {deleted:true};
  });
}

function getProductsPhotosFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PRODUCTS_PHOTOS_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (_) {}
  }
  const root = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
  const folders = root.getFoldersByName('fotos-produtos');
  const folder = folders.hasNext() ? folders.next() : root.createFolder('fotos-produtos');
  try { folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  props.setProperty('PRODUCTS_PHOTOS_FOLDER_ID', folder.getId());
  return folder;
}

function getProductsFile_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PRODUCTS_FILE_ID');
  if (id) {
    try {
      return DriveApp.getFileById(id);
    } catch (_) {}
  }
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
  const files = folder.getFilesByName('produtos.csv');
  const file = files.hasNext() ? files.next() : folder.createFile('produtos.csv', csv_(PRODUCT_COLUMNS_, []), 'text/csv');
  props.setProperty('PRODUCTS_FILE_ID', file.getId());
  return file;
}

function readProducts_() {
  const file = getProductsFile_();
  const text = file.getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  if (!text.trim()) return [];
  const matrix = Utilities.parseCsv(text);
  const headers = matrix.shift() || [];
  if (PRODUCT_COLUMNS_.filter(key => !['quantidade','unidade_medida'].includes(key)).some(key => !headers.includes(key))) throw Error('Cabeçalho de produtos.csv inválido.');
  return matrix.filter(r => r.some(Boolean)).map(r => {
    const item = Object.fromEntries(headers.map((k, i) => [k, r[i] || '']));
    item.quantidade = Number(item.quantidade || 1);
    item.unidade_medida = item.unidade_medida || 'un';
    item.foto_url = item.foto_arquivo_id ? 'https://drive.google.com/thumbnail?id=' + item.foto_arquivo_id + '&sz=w800' : '';
    item.preco_custo = Number(item.preco_custo || 0);
    item.preco_venda = Number(item.preco_venda || 0);
    item.margem_lucro = Number(item.margem_lucro || 0);
    return item;
  });
}

function saveProductRows_(rows) {
  const file = getProductsFile_();
  file.setContent(csv_(PRODUCT_COLUMNS_, rows));
}

function saveProduct_(actor, input, operation) {
  module_(actor, 'products');
  const id = String(input.id || '');
  const nome = String(input.nome || '').trim();
  const categoria = String(input.categoria || 'Geral').trim();
  let quantidade = Number(String(input.quantidade ?? 1).replace(',', '.'));
  let unidade_medida = String(input.unidade_medida || 'un');
  if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 1000000) throw Error('Informe uma quantidade maior que zero e até 1.000.000.');
  if (!Object.prototype.hasOwnProperty.call(MEASURE_UNITS_,unidade_medida)) throw Error('Unidade de medida inválida.');
  const fornecedor_id = String(input.fornecedor_id || '').trim();
  const fornecedor_nome = String(input.fornecedor_nome || '').trim();
  const preco_custo = Number(String(input.preco_custo ?? '0').replace(',', '.'));
  const preco_venda = Number(String(input.preco_venda ?? '0').replace(',', '.'));
  const descricao = String(input.descricao || '').trim();
  const status = input.status === 'inativo' || input.status === false || input.status === '0' ? 'inativo' : 'ativo';

  if (nome.length < 2 || nome.length > 180) throw Error('Informe o nome do produto (2 a 180 caracteres).');
  if (!Number.isFinite(preco_venda) || preco_venda <= 0) throw Error('O preço de venda deve ser maior que zero.');
  if (!Number.isFinite(preco_custo) || preco_custo < 0) throw Error('O preço de custo não pode ser negativo.');
  if (categoria.length > 100) throw Error('A categoria deve conter até 100 caracteres.');
  if (descricao.length > 4000) throw Error('A descrição deve conter até 4.000 caracteres.');

  const lucro = preco_venda - preco_custo;
  const margem = preco_venda > 0 ? (lucro / preco_venda) * 100 : 0;
  const margem_lucro = margem.toFixed(2);

  return withLock_(() => {
    const rows = readProducts_();
    const index = operation === 'update' ? rows.findIndex(r => r.id === id) : -1;
    const old = rows[index];
    if (operation === 'update' && !old) throw Error('Produto não encontrado.');
    if (old && String(input.expected_updated_at || '') !== old.atualizado_em) throw Error('Produto atualizado por outra sessão. Reabra o cadastro antes de salvar.');
    if (old && input.quantidade === undefined) quantidade = old.quantidade || 1;
    if (old && input.unidade_medida === undefined) unidade_medida = old.unidade_medida || 'un';

    let foto_arquivo_id = old ? (old.foto_arquivo_id || '') : '';
    if (input.foto_data_url) {
      const decoded = decodePhoto_(input.foto_data_url);
      const folder = getProductsPhotosFolder_();
      const file = folder.createFile(Utilities.newBlob(decoded.bytes, decoded.mime, 'prod-' + Utilities.getUuid() + '.' + decoded.extension));
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
      if (old && old.foto_arquivo_id) {
        try { DriveApp.getFileById(old.foto_arquivo_id).setTrashed(true); } catch (_) {}
      }
      foto_arquivo_id = file.getId();
    } else if (input.remove_photo === true) {
      if (old && old.foto_arquivo_id) {
        try { DriveApp.getFileById(old.foto_arquivo_id).setTrashed(true); } catch (_) {}
      }
      foto_arquivo_id = '';
    }

    const stamp = now_();
    const record = {
      id: old ? old.id : Utilities.getUuid(),
      nome,
      categoria,
      fornecedor_id,
      fornecedor_nome,
      quantidade,
      unidade_medida,
      preco_custo: preco_custo.toFixed(2),
      preco_venda: preco_venda.toFixed(2),
      margem_lucro,
      foto_arquivo_id,
      descricao,
      status,
      criado_em: old ? old.criado_em : stamp,
      atualizado_em: stamp
    };

    if (old) rows[index] = record; else rows.push(record);
    saveProductRows_(rows);
    record.foto_url = foto_arquivo_id ? 'https://drive.google.com/thumbnail?id=' + foto_arquivo_id + '&sz=w800' : '';
    record.preco_custo = preco_custo;
    record.preco_venda = preco_venda;
    record.margem_lucro = Number(margem_lucro);
    return record;
  });
}

function deleteProduct_(actor, id, version) {
  module_(actor, 'products');
  return withLock_(() => {
    const rows = readProducts_();
    const selected = rows.find(r => r.id === String(id || ''));
    if (!selected) throw Error('Produto não encontrado.');
    if (String(version || '') !== selected.atualizado_em) throw Error('Produto atualizado por outra sessão. Atualize a lista antes de excluir.');

    if (readKits_().some(kit => kit.itens.some(item => item.produto_id === selected.id))) throw Error('Este produto compõe um kit. Remova-o dos kits antes de excluir.');

    if (selected.foto_arquivo_id) {
      try { DriveApp.getFileById(selected.foto_arquivo_id).setTrashed(true); } catch (_) {}
    }

    saveProductRows_(rows.filter(r => r.id !== selected.id));
    return {deleted: true};
  });
}

function getCouponsFile_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('COUPONS_FILE_ID');
  if (id) {
    try {
      return DriveApp.getFileById(id);
    } catch (_) {}
  }
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
  const files = folder.getFilesByName('cupons.csv');
  const file = files.hasNext() ? files.next() : folder.createFile('cupons.csv', csv_(COUPON_COLUMNS_, []), 'text/csv');
  props.setProperty('COUPONS_FILE_ID', file.getId());
  return file;
}

function readCoupons_() {
  const file = getCouponsFile_();
  const text = file.getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  if (!text.trim()) return [];
  const matrix = Utilities.parseCsv(text);
  const headers = matrix.shift() || [];
  if (COUPON_COLUMNS_.some(key => !headers.includes(key))) throw Error('Cabeçalho de cupons.csv inválido.');
  return matrix.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((k, i) => [k, r[i] || ''])));
}

function saveCouponRows_(rows) {
  const file = getCouponsFile_();
  file.setContent(csv_(COUPON_COLUMNS_, rows));
}

function couponDiscount_(coupon, subtotal) {
  const value = Math.max(0, Number(coupon.desconto_valor) || 0);
  const amount = coupon.tipo === 'percentual' ? subtotal * Math.min(100, value) / 100 : value;
  return Math.min(subtotal, Math.round(amount * 100) / 100);
}

function validateCoupon_(request) {
  const codigo = String(request.codigo || '').trim().toUpperCase();
  const subtotal = Math.max(0, Number(request.subtotal) || 0);
  if (!codigo) throw Error('Informe o código do cupom.');

  const coupons = readCoupons_();
  const coupon = coupons.find(c => c.codigo.trim().toUpperCase() === codigo);
  if (!coupon) throw Error('Cupom não encontrado.');
  if (coupon.status !== 'ativo') throw Error('Este cupom não está mais ativo.');

  const limit = Number(coupon.limite_usos || 1);
  const uses = Number(coupon.usos_atuais || 0);
  if (limit > 0 && uses >= limit) throw Error('Este cupom já atingiu o limite de utilizações.');

  const today = brazilDate_();
  if (coupon.validade && coupon.validade < today) throw Error('Este cupom expirou em ' + coupon.validade.split('-').reverse().join('/') + '.');

  const minVal = Number(coupon.valor_minimo || 0);
  if (minVal > 0 && subtotal < minVal) {
    const brl = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
    throw Error('Este cupom exige pedido mínimo de ' + brl(minVal) + '.');
  }

  const desconto = couponDiscount_(coupon, subtotal);
  const total = Math.max(0, subtotal - desconto);

  return {
    valid: true,
    codigo: coupon.codigo,
    tipo: coupon.tipo || 'valor_fixo',
    desconto_percentual: coupon.tipo === 'percentual' ? Number(coupon.desconto_valor) : null,
    desconto_valor: desconto,
    valor_minimo: minVal,
    total_com_desconto: total
  };
}

function saveCoupon_(actor, input, operation) {
  module_(actor, 'coupons');
  const id = String(input.id || '');
  let codigo = String(input.codigo || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!codigo) {
    codigo = ('SOLO-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6)).toUpperCase();
  }
  const desconto_valor = Math.max(0, Number(String(input.desconto_valor ?? '0').replace(',', '.')) || 0);
  const tipo = 'percentual';
  const valor_minimo = Math.max(0, Number(String(input.valor_minimo ?? '0').replace(',', '.')) || 0);
  const cliente_id = String(input.cliente_id || '').trim();
  const cliente_nome = String(input.cliente_nome || '').trim();
  const limite_usos = Math.max(1, Number(input.limite_usos) || 1);
  const validade = String(input.validade || '').trim();
  const status = input.status === 'inativo' || input.status === false ? 'inativo' : 'ativo';

  if (codigo.length < 3 || codigo.length > 30) throw Error('O código do cupom deve ter de 3 a 30 caracteres alfanuméricos.');
  if (!Number.isFinite(desconto_valor) || desconto_valor < 0.01 || desconto_valor > 100) throw Error('O desconto deve ser uma porcentagem entre 0,01% e 100%.');
  if (validade && !isFinanceDate_(validade)) throw Error('Informe uma data de validade válida.');

  return withLock_(() => {
    const rows = readCoupons_();
    const index = operation === 'update' ? rows.findIndex(r => r.id === id) : -1;
    const old = rows[index];
    if (operation === 'update' && !old) throw Error('Cupom não encontrado.');
    if (old && String(input.expected_updated_at || '') !== old.atualizado_em) throw Error('Cupom atualizado por outra sessão. Reabra o cadastro antes de salvar.');

    if (rows.some(r => r.id !== id && r.codigo.toUpperCase() === codigo)) {
      throw Error('Já existe um cupom cadastrado com este código.');
    }

    const stamp = now_();
    const record = {
      id: old ? old.id : Utilities.getUuid(),
      codigo,
      desconto_valor: desconto_valor.toFixed(2),
      tipo,
      valor_minimo: valor_minimo.toFixed(2),
      cliente_id,
      cliente_nome,
      limite_usos: String(limite_usos),
      usos_atuais: old ? String(old.usos_atuais || '0') : '0',
      validade,
      status,
      criado_em: old ? old.criado_em : stamp,
      atualizado_em: stamp
    };

    if (old) rows[index] = record; else rows.push(record);
    saveCouponRows_(rows);
    return record;
  });
}

function deleteCoupon_(actor, id, version) {
  module_(actor, 'coupons');
  return withLock_(() => {
    const rows = readCoupons_();
    const selected = rows.find(r => r.id === String(id || ''));
    if (!selected) throw Error('Cupom não encontrado.');
    if (String(version || '') !== selected.atualizado_em) throw Error('Cupom atualizado por outra sessão. Atualize a lista antes de excluir.');
    saveCouponRows_(rows.filter(r => r.id !== selected.id));
    return {deleted: true};
  });
}

function getMenuConfigFile_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('MENU_CONFIG_FILE_ID');
  if (id) {
    try {
      return DriveApp.getFileById(id);
    } catch (_) {}
  }
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
  const files = folder.getFilesByName('menu_site_config.csv');
  const file = files.hasNext() ? files.next() : folder.createFile('menu_site_config.csv', csv_(MENU_CONFIG_COLUMNS_, [{
    id: 'default',
    menu_titulo: 'Eventos',
    secao_titulo: 'Eventos & Celebrações',
    secao_subtitulo: 'Experiências gastronômicas exclusivas para momentos memoráveis',
    ativo: '1',
    atualizado_em: now_()
  }]), 'text/csv');
  props.setProperty('MENU_CONFIG_FILE_ID', file.getId());
  return file;
}

function readSiteMenuConfig_() {
  const file = getMenuConfigFile_();
  const text = file.getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  const matrix = Utilities.parseCsv(text);
  const headers = matrix.shift() || [];
  if (MENU_CONFIG_COLUMNS_.some(key => !headers.includes(key))) throw Error('Cabeçalho de menu_site_config.csv inválido.');
  const row = matrix.find(r => r.some(Boolean));
  if (!row) {
    return {
      id: 'default',
      menu_titulo: 'Eventos',
      secao_titulo: 'Eventos & Celebrações',
      secao_subtitulo: 'Experiências gastronômicas exclusivas para momentos memoráveis',
      ativo: '1',
      atualizado_em: now_()
    };
  }
  return Object.fromEntries(headers.map((k, i) => [k, row[i] || '']));
}

function saveSiteMenuConfig_(actor, input) {
  module_(actor, 'site_menu');
  const menu_titulo = String(input.menu_titulo || '').trim() || 'Opção';
  const secao_titulo = String(input.secao_titulo || '').trim() || menu_titulo;
  const secao_subtitulo = String(input.secao_subtitulo || '').trim();
  const ativo = input.ativo === false || input.ativo === '0' ? '0' : '1';
  if (menu_titulo.length < 2 || menu_titulo.length > 50) throw Error('O título do menu deve conter de 2 a 50 caracteres.');
  if (secao_titulo.length < 2 || secao_titulo.length > 100) throw Error('O título da seção deve conter de 2 a 100 caracteres.');
  if (secao_subtitulo.length > 300) throw Error('O subtítulo da seção deve conter até 300 caracteres.');

  return withLock_(() => {
    const file = getMenuConfigFile_();
    const config = {
      id: 'default',
      menu_titulo,
      secao_titulo,
      secao_subtitulo,
      ativo,
      atualizado_em: now_()
    };
    file.setContent(csv_(MENU_CONFIG_COLUMNS_, [config]));
    return config;
  });
}

function getMenuCardsFile_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('MENU_CARDS_FILE_ID');
  if (id) {
    try {
      return DriveApp.getFileById(id);
    } catch (_) {}
  }
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
  const files = folder.getFilesByName('menu_site_cards.csv');
  const file = files.hasNext() ? files.next() : folder.createFile('menu_site_cards.csv', csv_(MENU_CARD_COLUMNS_, []), 'text/csv');
  props.setProperty('MENU_CARDS_FILE_ID', file.getId());
  return file;
}

function readSiteCards_() {
  const file = getMenuCardsFile_();
  const text = file.getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  if (!text.trim()) return [];
  const matrix = Utilities.parseCsv(text);
  const headers = matrix.shift() || [];
  if (MENU_CARD_COLUMNS_.some(key => !headers.includes(key))) throw Error('Cabeçalho de menu_site_cards.csv inválido.');
  return matrix.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((k, i) => [k, r[i] || ''])));
}

function saveSiteCards_(rows) {
  const file = getMenuCardsFile_();
  file.setContent(csv_(MENU_CARD_COLUMNS_, rows));
}

function getMenuPhotosFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('MENU_PHOTOS_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (_) {}
  }
  const root = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
  const folders = root.getFoldersByName('fotos-menu-site');
  const folder = folders.hasNext() ? folders.next() : root.createFolder('fotos-menu-site');
  try { folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  props.setProperty('MENU_PHOTOS_FOLDER_ID', folder.getId());
  return folder;
}

function saveSiteCard_(actor, input, operation) {
  module_(actor, 'site_menu');
  const id = String(input.id || '');
  const titulo = String(input.titulo || '').trim();
  const descricao = String(input.descricao || '').trim();
  const ordem = String(input.ordem || '1').trim();
  const ativo = input.ativo === false || input.ativo === '0' ? '0' : '1';
  const incomingPhotos = Array.isArray(input.fotos) ? input.fotos.slice(0, 3) : [];

  if (titulo.length < 2 || titulo.length > 120) throw Error('O título do card deve conter de 2 a 120 caracteres.');
  if (descricao.length < 2 || descricao.length > 4000) throw Error('A descrição do card deve conter de 2 a 4.000 caracteres.');

  return withLock_(() => {
    const rows = readSiteCards_();
    const index = operation === 'update' ? rows.findIndex(r => r.id === id) : -1;
    const old = rows[index];
    if (operation === 'update' && !old) throw Error('Card não encontrado.');

    let oldPhotoIds = [];
    if (old) {
      try { oldPhotoIds = JSON.parse(old.fotos_json || '[]'); } catch (_) {}
    }

    const folder = getMenuPhotosFolder_();
    const finalPhotoIds = [];

    incomingPhotos.forEach(p => {
      const photoStr = String(p || '').trim();
      if (!photoStr) return;
      if (photoStr.startsWith('data:image/')) {
        const decoded = decodePhoto_(photoStr);
        const file = folder.createFile(Utilities.newBlob(decoded.bytes, decoded.mime, 'card-' + Utilities.getUuid() + '.' + decoded.extension));
        try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
        finalPhotoIds.push(file.getId());
      } else if (/^[A-Za-z0-9_-]{20,}$/.test(photoStr)) {
        finalPhotoIds.push(photoStr);
      }
    });

    const removedIds = oldPhotoIds.filter(pid => !finalPhotoIds.includes(pid));
    removedIds.forEach(pid => {
      try { DriveApp.getFileById(pid).setTrashed(true); } catch (_) {}
    });

    const stamp = now_();
    const record = {
      id: old ? old.id : Utilities.getUuid(),
      titulo,
      descricao,
      fotos_json: JSON.stringify(finalPhotoIds),
      ordem: /^\d+$/.test(ordem) ? ordem : '1',
      ativo,
      criado_em: old ? old.criado_em : stamp,
      atualizado_em: stamp
    };

    if (old) rows[index] = record; else rows.push(record);
    saveSiteCards_(rows);
    return record;
  });
}

function deleteSiteCard_(actor, id) {
  module_(actor, 'site_menu');
  return withLock_(() => {
    const rows = readSiteCards_();
    const selected = rows.find(r => r.id === String(id || ''));
    if (!selected) throw Error('Card não encontrado.');

    let photoIds = [];
    try { photoIds = JSON.parse(selected.fotos_json || '[]'); } catch (_) {}
    photoIds.forEach(pid => {
      try { DriveApp.getFileById(pid).setTrashed(true); } catch (_) {}
    });

    saveSiteCards_(rows.filter(r => r.id !== selected.id));
    return {deleted: true};
  });
}

function getSiteMenuData_() {
  const config = readSiteMenuConfig_();
  const cards = readSiteCards_().filter(c => c.ativo !== '0').sort((a,b) => Number(a.ordem || 0) - Number(b.ordem || 0)).map(c => {
    let photoIds = [];
    try { photoIds = JSON.parse(c.fotos_json || '[]'); } catch (_) {}
    const photos = photoIds.map(id => ({
      id,
      url: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200'
    }));
    return {
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao,
      photos,
      ordem: Number(c.ordem || 0)
    };
  });
  return {
    config: {
      menu_titulo: config.menu_titulo || 'Opção',
      secao_titulo: config.secao_titulo || 'Opção',
      secao_subtitulo: config.secao_subtitulo || '',
      ativo: config.ativo !== '0'
    },
    cards
  };
}

function getSiteMenuAdmin_() {
  const config = readSiteMenuConfig_();
  const cards = readSiteCards_().sort((a,b) => Number(a.ordem || 0) - Number(b.ordem || 0)).map(c => {
    let photoIds = [];
    try { photoIds = JSON.parse(c.fotos_json || '[]'); } catch (_) {}
    const photos = photoIds.map(id => ({
      id,
      url: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w800'
    }));
    return {
      ...c,
      photos
    };
  });
  return {config, cards};
}

function submitBudgetRequest_(request) {
  const input = request.record || {};
  const cardTitulo = String(input.card_titulo || 'Opção').trim();
  const nome = String(input.nome || '').trim();
  const email = normalizeEmail_(input.email);
  const rawWhatsapp = String(input.whatsapp || '').trim();
  const whatsapp = rawWhatsapp.replace(/\D/g, '');
  const cidade = String(input.cidade || '').trim();
  const dataEvento = String(input.data_evento || '').trim();
  const convidados = String(input.convidados || '').trim();
  const observacoes = String(input.observacoes || '').trim();

  if (nome.length < 2 || nome.length > 180) throw Error('Informe seu nome completo.');
  if (!validEmail_(email)) throw Error('Informe um e-mail válido.');
  if (!/^[+\d() .-]+$/.test(rawWhatsapp) || !/^\d{10,15}$/.test(whatsapp)) throw Error('Informe um WhatsApp válido com DDD.');

  return withLock_(() => {
    const clients = readClients_();
    let client = clients.find(c => normalizeEmail_(c.email) === email || phoneKey_(c.whatsapp) === phoneKey_(whatsapp));
    const stamp = now_();
    if (!client) {
      client = {
        id: Utilities.getUuid(),
        nome,
        email,
        whatsapp,
        data_cadastro: brazilDate_(),
        criado_em: stamp,
        atualizado_em: stamp
      };
      clients.push(client);
      saveClientRows_(clients);
    }

    const subject = 'SOLO Ateliê — Solicitação de Orçamento: ' + cardTitulo;
    let body = 'Olá, equipe SOLO!\n\nUma nova solicitação de orçamento foi realizada pelo site:\n\n';
    body += '• Item / Interesse: ' + cardTitulo + '\n';
    body += '• Cliente: ' + nome + '\n';
    body += '• E-mail: ' + email + '\n';
    body += '• WhatsApp: ' + whatsapp + '\n';
    if (cidade) body += '• Local / Cidade: ' + cidade + '\n';
    if (dataEvento) body += '• Data prevista: ' + dataEvento + '\n';
    if (convidados) body += '• Número de convidados: ' + convidados + '\n';
    if (observacoes) body += '• Mensagem / Observações:\n' + observacoes + '\n';
    body += '\nData da solicitação: ' + stamp + '\n';

    const adminEmail = PropertiesService.getScriptProperties().getProperty('INITIAL_ADMIN_EMAIL') || 'eduperalles@gmail.com';
    try {
      if (MailApp.getRemainingDailyQuota() > 0) {
        MailApp.sendEmail({
          to: adminEmail,
          replyTo: email,
          subject,
          body,
          name: 'SOLO Ateliê — Orçamentos'
        });
      }
    } catch (err) {
      console.error('Erro ao enviar e-mail de orçamento:', err);
    }

    let waMsg = '*SOLO ATELIÊ - SOLICITAÇÃO DE ORÇAMENTO*\n';
    waMsg += '*INTERESSE:* ' + cardTitulo + '\n';
    waMsg += '-----------------------------------\n';
    waMsg += '*CLIENTE:* ' + nome + '\n';
    waMsg += '*E-MAIL:* ' + email + '\n';
    waMsg += '*TELEFONE:* ' + whatsapp + '\n';
    if (cidade) waMsg += '*CIDADE/LOCAL:* ' + cidade + '\n';
    if (dataEvento) waMsg += '*DATA PREVISTA:* ' + dataEvento + '\n';
    if (convidados) waMsg += '*CONVIDADOS:* ' + convidados + '\n';
    if (observacoes) waMsg += '*OBSERVAÇÕES:* ' + observacoes + '\n';
    waMsg += '-----------------------------------\n';
    waMsg += '_Enviado pelo formulário do site SOLO Ateliê._';

    const waUrl = 'https://wa.me/5519993835111?text=' + encodeURIComponent(waMsg);

    return {
      ok: true,
      message: 'Solicitação de orçamento enviada com sucesso! Você também pode continuar o atendimento pelo WhatsApp.',
      whatsapp_url: waUrl
    };
  });
}

function setupFinanceFiles_(folder, props) {
  [
    {key:'RECEIVABLES_FILE_ID', name:'contas_receber.csv'},
    {key:'PAYABLES_FILE_ID', name:'contas_pagar.csv'}
  ].forEach(table => {
    const files = folder.getFilesByName(table.name);
    const file = files.hasNext() ? files.next() : folder.createFile(table.name, csv_(FINANCE_COLUMNS_, []), 'text/csv');
    props.setProperty(table.key, file.getId());
  });
}

function financeFileId_(type) {
  const key = type === 'receivables' ? 'RECEIVABLES_FILE_ID' : type === 'payables' ? 'PAYABLES_FILE_ID' : '';
  const id = key && PropertiesService.getScriptProperties().getProperty(key);
  if (!id) throw Error('Módulo financeiro não configurado. Execute setupSolo novamente.');
  return id;
}

function readFinance_(type) { return panelMemo_('finance:'+type,()=>readFinanceFresh_(type)); }
function readFinanceFresh_(type) {
  const text = DriveApp.getFileById(financeFileId_(type)).getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  if (!text.trim()) return [];
  const matrix = Utilities.parseCsv(text);
  const headers = matrix.shift().map(String);
  if (FINANCE_COLUMNS_.filter(column => !['cliente_id','pedido_id'].includes(column)).some(column => !headers.includes(column))) throw Error('Cabeçalho financeiro inválido.');
  return matrix.filter(row => row.some(value => value !== '')).map(row => {
    const record = {};
    headers.forEach((header, index) => record[header] = row[index] || '');
    return record;
  });
}

function saveFinanceRows_(type, rows) {
  DriveApp.getFileById(financeFileId_(type)).setContent(csv_(FINANCE_COLUMNS_, rows));
}

function listFinance_(actor, type) {
  module_(actor, 'finance');
  return readFinance_(type).map(record => ({...record, valor:Number(record.valor) || 0}));
}

function saveFinance_(actor, type, input) {
  module_(actor, 'finance');
  const id = String(input.id || '');
  const descricao = String(input.descricao || '').trim();
  const pessoa = String(input.pessoa || '').trim();
  const categoria = String(input.categoria || '').trim();
  const observacoes = String(input.observacoes || '').trim();
  const amount = Number(String(input.valor ?? '').replace(',', '.'));
  const due = String(input.data_vencimento || '');
  const paid = String(input.data_pagamento || '');
  const status = String(input.status || 'pendente');
  if (descricao.length < 2 || descricao.length > 180 || pessoa.length > 180 || categoria.length > 120 || observacoes.length > 20000) {
    throw Error('Revise descrição, pessoa, categoria e observações.');
  }
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 999999999) throw Error('Informe um valor válido maior que zero.');
  if (!['pendente','pago'].includes(status)) throw Error('Status financeiro inválido.');
  if (!isFinanceDate_(due) || (paid && !isFinanceDate_(paid))) throw Error('Informe datas financeiras válidas.');
  if (status === 'pago' && !paid) throw Error('Informe a data de pagamento para uma conta paga.');
  if (status === 'pendente' && paid) throw Error('Remova a data de pagamento de uma conta pendente.');
  return withLock_(() => {
    const rows = readFinance_(type);
    const old = id ? rows.find(row => row.id === id) : null;
    if (id && !old) throw Error('Registro financeiro não encontrado.');
    const record = {
      id:old ? old.id : Utilities.getUuid(),
      cliente_id:old ? old.cliente_id || '' : '',
      pedido_id:old ? old.pedido_id || '' : '',
      descricao,
      pessoa,
      categoria,
      valor:amount.toFixed(2),
      data_vencimento:due,
      data_pagamento:status === 'pago' ? paid : '',
      status,
      observacoes,
      criado_em:old ? old.criado_em : now_(),
      atualizado_em:now_()
    };
    if (old) rows[rows.findIndex(row => row.id === id)] = record;
    else rows.push(record);
    saveFinanceRows_(type, rows);
    return {...record, valor:amount};
  });
}

function deleteFinance_(actor, type, id) {
  module_(actor, 'finance');
  return withLock_(() => {
    const rows = readFinance_(type);
    const selected = rows.find(row => row.id === String(id));
    if (!selected) throw Error('Registro financeiro não encontrado.');
    saveFinanceRows_(type, rows.filter(row => row.id !== selected.id));
    return {deleted:true};
  });
}

function isFinanceDate_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}

function login_(request) {
  const email = normalizeEmail_(request.email);
  const password = String(request.password || '');
  if (!email || password.length > 128) throw Error('Informe e-mail e senha válidos.');
  const cache = CacheService.getScriptCache();
  const failureKey = 'fail:' + digest_(email);
  const failures = Number(cache.get(failureKey) || 0);
  if (failures >= 8) throw Error('Muitas tentativas. Aguarde alguns minutos.');
  const user = readUsers_().find(row => normalizeEmail_(row.email) === email);
  const valid = user && constantTime_(passwordHash_(password, user.salt), user.senha_hash);
  if (!valid) {
    cache.put(failureKey, String(failures + 1), 900);
    throw Error('E-mail ou senha inválidos.');
  }
  if (user.status !== 'ativo') throw Error('Acesso inativo. Fale com o administrador.');
  cache.remove(failureKey);
  const token = random_() + random_();
  cache.put('session:' + digest_(token), user.id, SESSION_SECONDS);
  return {token, expiresIn: SESSION_SECONDS, user: publicUser_(user)};
}

function logout_(request) {
  CacheService.getScriptCache().remove('session:' + digest_(request.token || ''));
  return {loggedOut:true};
}

function auth_(token) {
  if (!token) throw Error('Sessão inválida. Entre novamente.');
  const id = CacheService.getScriptCache().get('session:' + digest_(String(token)));
  if (!id) throw Error('Sessão expirada. Entre novamente.');
  const user = readUsers_().find(row => row.id === id);
  if (!user || user.status !== 'ativo') throw Error('Sessão inválida ou acesso inativo.');
  return user;
}

function admin_(actor) {
  if (!actor || actor.perfil !== 'admin') throw Error('Acesso exclusivo do administrador.');
}

function saveUser_(actor, input, operation) {
  module_(actor, 'users');
  return withLock_(() => {
    const rows = readUsers_();
    const id = String(input.id || '');
    const old = operation === 'update' ? rows.find(row => row.id === id) : null;
    if (operation === 'update' && !old) throw Error('Usuário não encontrado.');
    const clean = validateUser_(input, rows, id);
    if (actor.perfil !== 'admin' && (clean.perfil !== 'operador' || old && old.perfil === 'admin')) throw Error('Somente administradores podem gerenciar administradores.');
    if (old && old.perfil === 'admin' && old.status === 'ativo' && (clean.perfil !== 'admin' || clean.status !== 'ativo') && rows.filter(row => row.perfil === 'admin' && row.status === 'ativo').length <= 1) throw Error('Mantenha ao menos um administrador ativo.');
    if (operation === 'create') {
      const salt = random_();
      const user = {
        id: Utilities.getUuid(),
        nome: clean.nome,
        email: clean.email,
        senha_hash: passwordHash_(clean.senha, salt),
        salt,
        perfil: clean.perfil,
        status: clean.status,
        foto_arquivo_id: '',
        foto_atualizada_em: '',
        criado_em: now_(),
        atualizado_em: now_()
      };
      rows.push(user);
      saveUsers_(rows);
      return adminUser_(user);
    }
    if (old.id === actor.id && clean.status !== 'ativo') throw Error('Não é possível inativar a própria conta.');
    const user = {...old, nome: clean.nome, email: clean.email, perfil: clean.perfil, status: clean.status, atualizado_em: now_()};
    if (clean.senha) {
      user.salt = random_();
      user.senha_hash = passwordHash_(clean.senha, user.salt);
    }
    rows[rows.findIndex(row => row.id === id)] = user;
    saveUsers_(rows);
    return adminUser_(user);
  });
}

function deleteUser_(actor, id) {
  module_(actor, 'users');
  return withLock_(() => {
    const rows = readUsers_();
    const old = rows.find(row => row.id === String(id));
    if (!old) throw Error('Usuário não encontrado.');
    if (actor.perfil !== 'admin' && old.perfil === 'admin') throw Error('Somente administradores podem gerenciar administradores.');
    if (old.id === actor.id) throw Error('Não é possível excluir o usuário atual.');
    if (rows.filter(row => row.perfil === 'admin' && row.status === 'ativo').length === 1 && old.perfil === 'admin' && old.status === 'ativo') {
      throw Error('Mantenha ao menos um administrador ativo.');
    }
    if (old.foto_arquivo_id) try { photoFile_(old).setTrashed(true); } catch (_) {}
    saveUsers_(rows.filter(row => row.id !== old.id));
    return {deleted:true};
  });
}

function ownProfile_(actor) {
  return {nome:actor.nome, email:actor.email, has_photo:!!actor.foto_arquivo_id, photo_version:actor.foto_atualizada_em || '', updated_at:actor.atualizado_em};
}

function ownPhoto_(actor) {
  const file = photoFile_(actor);
  if (!file) return {photo_data_url:'', version:''};
  const blob = file.getBlob();
  const mime = blob.getContentType();
  const bytes = blob.getBytes();
  if (!['image/jpeg','image/png'].includes(mime) || bytes.length > 300000) throw Error('Foto de perfil inválida.');
  return {photo_data_url:'data:' + mime + ';base64,' + Utilities.base64Encode(bytes), version:actor.foto_atualizada_em || ''};
}

function saveMyProfile_(actor, input) {
  if (Object.keys(input).some(key => !['nome','email','senha','current_password','foto_data_url','remove_photo','expected_updated_at'].includes(key))) {
    throw Error('Você pode alterar somente os dados do seu próprio perfil.');
  }
  return withLock_(() => {
    const rows = readUsers_();
    const index = rows.findIndex(row => row.id === actor.id);
    const old = rows[index];
    if (!old) throw Error('Usuário não encontrado.');
    if (String(input.expected_updated_at || '') !== old.atualizado_em) throw Error('Seu cadastro foi atualizado. Reabra o perfil antes de salvar.');
    const next = {...old, nome:String(input.nome || '').trim(), email:normalizeEmail_(input.email)};
    if (next.nome.length < 2 || next.nome.length > 180 || !validEmail_(next.email)) throw Error('Revise nome e e-mail.');
    if (rows.some(row => row.id !== old.id && normalizeEmail_(row.email) === next.email)) throw Error('E-mail já cadastrado.');
    const password = String(input.senha || '');
    const requiresCurrent = !!password || next.email !== normalizeEmail_(old.email);
    if (requiresCurrent && !constantTime_(passwordHash_(String(input.current_password || ''), old.salt), old.senha_hash)) {
      throw Error('Informe a senha atual para alterar o e-mail ou a senha.');
    }
    if (password && (password.length < 4 || password.length > 12)) throw Error('A nova senha deve conter de 4 a 12 caracteres.');
    let created = null;
    try {
      if (input.foto_data_url) {
        const photo = decodePhoto_(input.foto_data_url);
        const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('PHOTO_FOLDER_ID'));
        created = folder.createFile(Utilities.newBlob(photo.bytes, photo.mime, 'perfil-' + old.id + '-' + Utilities.getUuid() + '.' + photo.extension));
        next.foto_arquivo_id = created.getId();
        next.foto_atualizada_em = now_();
      } else if (input.remove_photo === true) {
        next.foto_arquivo_id = '';
        next.foto_atualizada_em = now_();
      }
      if (password) {
        next.salt = random_();
        next.senha_hash = passwordHash_(password, next.salt);
      }
      next.atualizado_em = now_();
      rows[index] = next;
      saveUsers_(rows);
    } catch (error) {
      if (created) try { created.setTrashed(true); } catch (_) {}
      throw error;
    }
    if (old.foto_arquivo_id && old.foto_arquivo_id !== next.foto_arquivo_id) try { photoFile_(old).setTrashed(true); } catch (_) {}
    return {user:publicUser_(next)};
  });
}

function validateUser_(input, rows, currentId) {
  const name = String(input.nome || '').trim();
  const email = normalizeEmail_(input.email);
  const role = String(input.perfil || '');
  const status = String(input.status || '');
  const password = String(input.senha || '');
  if (name.length < 2 || name.length > 180 || !validEmail_(email)) throw Error('Revise nome e e-mail.');
  if (!['admin','operador'].includes(role) || !['ativo','inativo'].includes(status)) throw Error('Perfil ou status inválido.');
  if (rows.some(row => row.id !== currentId && normalizeEmail_(row.email) === email)) throw Error('E-mail já cadastrado.');
  if ((!currentId || password) && (password.length < 4 || password.length > 12)) throw Error('A senha deve conter de 4 a 12 caracteres.');
  return {nome:name, email, perfil:role, status, senha:password};
}

function decodePhoto_(value) {
  const match = String(value || '').match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || value.length > 400100) throw Error('Envie uma foto JPEG ou PNG de até 300 KB após o recorte.');
  const bytes = Utilities.base64Decode(match[2]);
  const unsigned = bytes.map(byte => (byte + 256) % 256);
  const png = unsigned.slice(0,8).join(',') === '137,80,78,71,13,10,26,10';
  const jpeg = unsigned[0] === 255 && unsigned[1] === 216 && unsigned[2] === 255;
  if (!bytes.length || bytes.length > 300000 || (match[1] === 'image/png' ? !png : !jpeg)) throw Error('Arquivo de foto inválido.');
  return {bytes, mime:match[1], extension:png ? 'png' : 'jpg'};
}

function photoFile_(user) {
  if (!user.foto_arquivo_id) return null;
  const folderId = PropertiesService.getScriptProperties().getProperty('PHOTO_FOLDER_ID');
  const file = DriveApp.getFileById(user.foto_arquivo_id);
  const parents = file.getParents();
  let allowed = false;
  while (parents.hasNext()) if (parents.next().getId() === folderId) allowed = true;
  if (!allowed || file.isTrashed()) throw Error('Foto de perfil indisponível. Envie uma nova foto.');
  return file;
}

function readUsers_() { return panelMemo_('users',()=>readUsersFresh_()); }
function readUsersFresh_() {
  const id = PropertiesService.getScriptProperties().getProperty('USERS_FILE_ID');
  if (!id) throw Error('Drive ainda não configurado. Execute setupSolo.');
  const text = DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  if (!text.trim()) return [];
  const matrix = Utilities.parseCsv(text);
  const headers = matrix.shift().map(String);
  if (USERS_COLUMNS_.some(column => !headers.includes(column))) throw Error('Cabeçalho de usuarios.csv inválido.');
  return matrix.filter(row => row.some(value => value !== '')).map(row => {
    const user = {};
    headers.forEach((header, index) => user[header] = row[index] || '');
    return user;
  });
}

function saveUsers_(rows) {
  const id = PropertiesService.getScriptProperties().getProperty('USERS_FILE_ID');
  if (!id) throw Error('CSV de usuários não configurado.');
  DriveApp.getFileById(id).setContent(csv_(USERS_COLUMNS_, rows));
}

function csv_(headers, rows) {
  const quote = value => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  return '\uFEFF' + [headers.map(quote).join(','), ...rows.map(row => headers.map(key => quote(row[key])).join(','))].join('\r\n');
}

function publicUser_(user) {
  return {id:user.id,nome:user.nome,email:user.email,perfil:user.perfil,status:user.status,access:access_(user),has_photo:!!user.foto_arquivo_id,photo_version:user.foto_atualizada_em || '',atualizado_em:user.atualizado_em};
}

function adminUser_(user) {
  return publicUser_(user);
}

function getUserPhotos_(actor, rawIds) {
  module_(actor, 'users');
  const ids = [...new Set((Array.isArray(rawIds) ? rawIds : []).map(id => String(id || '').trim()).filter(Boolean))].slice(0, 50);
  const photos = {};
  if (!ids.length) return {photos};
  const rows = readUsers_();
  ids.forEach(id => {
    const user = rows.find(row => row.id === id);
    if (!user || !user.foto_arquivo_id) return;
    try {
      const blob = photoFile_(user).getBlob();
      const bytes = blob.getBytes();
      const mime = blob.getContentType();
      if (!['image/jpeg','image/png'].includes(mime) || bytes.length > 300000) return;
      photos[id] = {
        photo_data_url:'data:' + mime + ';base64,' + Utilities.base64Encode(bytes),
        version:user.foto_atualizada_em || ''
      };
    } catch (_) {}
  });
  return {photos};
}

function json_(value) {
  const text = JSON.stringify(value).replace(/[^\x00-\x7F]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4,'0'));
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function publicError_(error) {
  const message = String(error && error.message || 'Falha ao processar a solicitação.');
  return message.length > 300 ? 'Falha ao processar a solicitação.' : message;
}

function withLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return callback(); } finally { lock.releaseLock(); }
}

function normalizeEmail_(value) { return String(value || '').trim().toLowerCase(); }
function validEmail_(value) { return value.length <= 254 && /^\S+@\S+\.\S+$/.test(value); }
function now_() { return new Date().toISOString(); }
function random_() { return Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'').slice(0,8); }
function digest_(value) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)).replace(/=+$/,''); }
function passwordHash_(password, salt) {
  let hash = Utilities.newBlob(salt + '\0' + password).getBytes();
  const key = Utilities.newBlob(salt).getBytes();
  for (let index = 0; index < HASH_ROUNDS; index++) hash = Utilities.computeHmacSha256Signature(hash, key);
  return Utilities.base64EncodeWebSafe(hash);
}
function constantTime_(first, second) {
  const a = String(first || '');
  const b = String(second || '');
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length,b.length); index++) difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  return difference === 0;
}

const ORDER_CATALOG_ = [{"id":101,"nome":"SOLO Afeto","centavos":3000,"slogan":""},{"id":102,"nome":"SOLO Essencial","centavos":5600,"slogan":""},{"id":103,"nome":"SOLO Conexão","centavos":9800,"slogan":""},{"id":104,"nome":"SOLO Celebração","centavos":22000,"slogan":""},{"id":105,"nome":"SOLO Alvorada","centavos":6000,"slogan":""},{"id":106,"nome":"SOLO Harmonia","centavos":19500,"slogan":""},{"id":107,"nome":"SOLO Melodia","centavos":8500,"slogan":""},{"id":108,"nome":"SOLO Love","centavos":15000,"slogan":""},{"id":109,"nome":"SOLO Prisma","centavos":11000,"slogan":""},{"id":110,"nome":"SOLO Legado","centavos":20000,"slogan":""},{"id":111,"nome":"SOLO Broto","centavos":5700,"slogan":""},{"id":112,"nome":"SOLO Colheita","centavos":7300,"slogan":""},{"id":113,"nome":"SOLO Essência","centavos":4800,"slogan":""},{"id":114,"nome":"SOLO Especial","centavos":14000,"slogan":""},{"id":201,"nome":"Pão Italiano (100g)","centavos":399,"slogan":""},{"id":202,"nome":"Pão Australiano (100g)","centavos":399,"slogan":""},{"id":203,"nome":"Mini Pão Francês","centavos":380,"slogan":""},{"id":204,"nome":"Queijo Brie (20g)","centavos":400,"slogan":""},{"id":205,"nome":"Queijo Gorgonzola (30g)","centavos":550,"slogan":""},{"id":206,"nome":"Queijo Gouda c/ervas (40g)","centavos":500,"slogan":""},{"id":207,"nome":"Queijo Provolone (20g)","centavos":350,"slogan":""},{"id":208,"nome":"Queijo Provolone c/orégano (40g)","centavos":550,"slogan":""},{"id":209,"nome":"Queijo Emmental (40g)","centavos":550,"slogan":""},{"id":210,"nome":"Palito Queijo Mussarela Condimentado (20g)","centavos":700,"slogan":""},{"id":211,"nome":"Queijo Minas Especial (30g)","centavos":600,"slogan":""},{"id":212,"nome":"Bolacha de Queijo Coalho Desidratado (40g)","centavos":1150,"slogan":""},{"id":213,"nome":"Bolacha de Provolone Desidratado (40g)","centavos":1150,"slogan":""},{"id":300,"nome":"Salame Italiano (40g)","centavos":1750,"slogan":""},{"id":301,"nome":"Copa Duroc (40g)","centavos":2000,"slogan":""},{"id":302,"nome":"Lonza Duroc (40g)","centavos":2000,"slogan":""},{"id":303,"nome":"Presunto Cru - Fiocco (40g)","centavos":2000,"slogan":""},{"id":304,"nome":"Lombo Defumado (40g)","centavos":1450,"slogan":""},{"id":305,"nome":"Salame Jabuticaba (40g)","centavos":1150,"slogan":""},{"id":400,"nome":"Geléia de Pimenta (50g)","centavos":1160,"slogan":""},{"id":401,"nome":"Torradas simples (7 Unid.)","centavos":400,"slogan":""},{"id":402,"nome":"Biscoito de Linhaça com Alho (30g)","centavos":450,"slogan":""},{"id":403,"nome":"Mel - favo (50g)","centavos":700,"slogan":""},{"id":404,"nome":"Mix de Nuts (40g)","centavos":600,"slogan":""},{"id":405,"nome":"Castanha de Caju (40g)","centavos":450,"slogan":""},{"id":406,"nome":"Milho com Mostarda (30g)","centavos":800,"slogan":""},{"id":407,"nome":"Chips de Beterraba (30g)","centavos":500,"slogan":""},{"id":408,"nome":"Chips de Abóbora (30g)","centavos":500,"slogan":""},{"id":409,"nome":"Chips de Banana Picante (30g)","centavos":450,"slogan":""},{"id":410,"nome":"Chips de Jaca (30g)","centavos":750,"slogan":""},{"id":411,"nome":"Macadamia com sal (30g)","centavos":600,"slogan":""},{"id":412,"nome":"Damasco (30g)","centavos":700,"slogan":""},{"id":413,"nome":"Tâmara sem caroço (30g)","centavos":500,"slogan":""},{"id":218,"nome":"Coração de Pelúcia","centavos":1500,"slogan":""},{"id":219,"nome":"Ursinho de Pelúcia","centavos":1200,"slogan":""}];

// Pedidos do site e acesso isolado dos clientes.
const ORDER_COLUMNS_ = ['id','numero','chave_idempotencia','payload_hash','cliente_id','nome','email','whatsapp','itens_json','total','entrega','endereco','cep','observacoes','mensagem','status','conta_receber_id','data_pedido','criado_em','atualizado_em','cupom_codigo','desconto','subtotal'];

function setupOrders() {
  return withLock_(() => {
    const props = PropertiesService.getScriptProperties();
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
    const files = folder.getFilesByName('pedidos.csv');
    const file = files.hasNext() ? files.next() : folder.createFile('pedidos.csv', csv_(ORDER_COLUMNS_, []), 'text/csv');
    props.setProperty('ORDERS_FILE_ID', file.getId());
    const rows = readAccess_();
    rows.forEach(row => { if (row.orders === undefined) row.orders = '0'; });
    DriveApp.getFileById(props.getProperty('SETTINGS_FILE_ID')).setContent(csv_(ACCESS_COLUMNS_, rows));
    // Confere autorização de e-mail sem enviar mensagens durante a configuração.
    MailApp.getRemainingDailyQuota();
    return 'Pedidos e acesso dos clientes configurados no SOLO.';
  });
}

function readOrders_() {
  const id = PropertiesService.getScriptProperties().getProperty('ORDERS_FILE_ID');
  if (!id) throw Error('Pedidos ainda não configurados.');
  const matrix = Utilities.parseCsv(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, ''));
  const headers = matrix.shift() || [];
  if (ORDER_COLUMNS_.filter(key => !['cupom_codigo','desconto','subtotal'].includes(key)).some(key => !headers.includes(key))) throw Error('Cabeçalho de pedidos.csv inválido.');
  return matrix.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((key,index) => [key,row[index] || ''])));
}
function saveOrders_(rows) {
  DriveApp.getFileById(PropertiesService.getScriptProperties().getProperty('ORDERS_FILE_ID')).setContent(csv_(ORDER_COLUMNS_, rows));
}
function brazilDate_() { return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd'); }
function phoneKey_(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits;
}
function cleanOrder_(input) {
  const nome = String(input.nome || '').trim();
  const email = normalizeEmail_(input.email);
  const whatsapp = phoneKey_(input.whatsapp);
  const entrega = String(input.entrega || '');
  const endereco = entrega === 'entrega' ? String(input.endereco || '').trim() : '';
  const cep = entrega === 'entrega' ? String(input.cep || '').replace(/\D/g, '') : '';
  const observacoes = String(input.observacoes || '').trim();
  if (nome.length < 2 || nome.length > 180 || !validEmail_(email) || !/^\d{10,11}$/.test(whatsapp)) throw Error('Revise nome completo, e-mail e WhatsApp com DDD.');
  if (!['retirada','entrega'].includes(entrega) || entrega === 'entrega' && (endereco.length < 5 || endereco.length > 500 || !/^\d{8}$/.test(cep))) throw Error('Revise a forma de entrega, o endereço e o CEP.');
  if (observacoes.length > 2000 || !Array.isArray(input.itens) || !input.itens.length || input.itens.length > 49) throw Error('Revise os itens e observações do pedido.');
  const seen = new Set();
  const itens = input.itens.map(item => {
    const product = ORDER_CATALOG_.find(product => product.id === Number(item.id));
    const quantidade = Number(item.quantidade);
    if (!product || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99 || seen.has(product.id)) throw Error('Item ou quantidade inválida. Atualize o carrinho.');
    seen.add(product.id);
    return {id:product.id,nome:product.nome,slogan:product.slogan,quantidade,valor_unitario:product.centavos / 100,total:product.centavos * quantidade / 100};
  }).sort((a,b) => a.id-b.id);
  const centavos = itens.reduce((sum,item) => sum + Math.round(item.valor_unitario*100)*item.quantidade,0);
  if (centavos < 3000 || centavos > 99999999) throw Error('O pedido mínimo é R$ 30,00. Revise o total do carrinho.');
  const subtotalBrl = centavos / 100;

  const cupomRaw = String(input.cupom_codigo || '').trim().toUpperCase();
  let cupom_codigo = '';
  let desconto = 0;
  if (cupomRaw) {
    try {
      const coupons = readCoupons_();
      const coupon = coupons.find(c => c.codigo.trim().toUpperCase() === cupomRaw);
      if (coupon && coupon.status === 'ativo') {
        const limit = Number(coupon.limite_usos || 1);
        const uses = Number(coupon.usos_atuais || 0);
        const today = brazilDate_();
        const minVal = Number(coupon.valor_minimo || 0);
        if ((limit <= 0 || uses < limit) && (!coupon.validade || coupon.validade >= today) && (minVal <= 0 || subtotalBrl >= minVal)) {
          cupom_codigo = coupon.codigo;
          desconto = couponDiscount_(coupon, subtotalBrl);
        }
      }
    } catch (_) {}
  }
  const finalTotal = Math.max(0, subtotalBrl - desconto);
  return {nome,email,whatsapp,entrega,endereco,cep,observacoes,itens,subtotal:subtotalBrl,cupom_codigo,desconto,total:finalTotal};
}
function orderMessage_(order) {
  const brl = value => 'R$ ' + Number(value).toFixed(2).replace('.', ',');
  let message = '*SOLO ATELIÊ - NOVO PEDIDO*\n*PEDIDO:* ' + order.numero + '\n-----------------------------------\n';
  message += '*CLIENTE:* ' + order.nome + '\n*E-MAIL:* ' + order.email + '\n*TELEFONE:* ' + order.whatsapp + '\n';
  message += order.entrega === 'entrega' ? '*ENTREGA:* Delivery\n*ENDEREÇO:* ' + order.endereco + '\n*CEP:* ' + order.cep + '\n' : '*RETIRADA:* Em mãos (Jd. Chapadão)\n';
  message += '-----------------------------------\n*ITENS DO PEDIDO:*\n\n';
  JSON.parse(order.itens_json).forEach(item => {
    message += '[ ' + item.quantidade + 'x ] *' + item.nome + '*\n';
    if (item.slogan) message += '_' + item.slogan + '_\n';
    message += '       ' + brl(item.total) + '\n';
  });
  if (order.desconto && Number(order.desconto) > 0) {
    message += '\n*SUBTOTAL:* ' + brl(order.subtotal || (Number(order.total) + Number(order.desconto))) + '\n';
    message += '*CUPOM:* ' + order.cupom_codigo + ' (- ' + brl(order.desconto) + ')\n';
  }
  if (order.observacoes) message += '\n*OBSERVAÇÕES:*\n' + order.observacoes + '\n';
  return message + '\n-----------------------------------\n*TOTAL A PAGAR: ' + brl(order.total) + '*\n-----------------------------------\n_Aguardo confirmação, valor do frete e chave PIX. Frete a confirmar pela loja._';
}
function finishOrder_(order, orders) {
  const clients = readClients_();
  if (!clients.some(client => client.id === order.cliente_id)) {
    clients.push({id:order.cliente_id,nome:order.nome,email:order.email,whatsapp:order.whatsapp,data_cadastro:order.data_pedido,criado_em:order.criado_em,atualizado_em:order.criado_em});
    saveClientRows_(clients);
  }
  const finance = readFinance_('receivables');
  if (!finance.some(row => row.id === order.conta_receber_id)) {
    finance.push({id:order.conta_receber_id,descricao:'Pedido ' + order.numero,pessoa:order.nome,categoria:'Pedidos do site',valor:Number(order.total).toFixed(2),data_vencimento:order.data_pedido,data_pagamento:'',status:'pendente',observacoes:order.mensagem,cliente_id:order.cliente_id,pedido_id:order.id,criado_em:order.criado_em,atualizado_em:order.criado_em});
    saveFinanceRows_('receivables', finance);
  }
  if (order.cupom_codigo) {
    try {
      const coupons = readCoupons_();
      const cIdx = coupons.findIndex(c => c.codigo.trim().toUpperCase() === String(order.cupom_codigo).trim().toUpperCase());
      if (cIdx >= 0) {
        const c = coupons[cIdx];
        const newUses = Number(c.usos_atuais || 0) + 1;
        c.usos_atuais = String(newUses);
        const limit = Number(c.limite_usos || 1);
        if (limit > 0 && newUses >= limit) c.status = 'utilizado';
        c.atualizado_em = now_();
        saveCouponRows_(coupons);
      }
    } catch (e) {
      console.error('Erro ao atualizar uso do cupom:', e);
    }
  }
  order.status = 'recebido'; order.atualizado_em = now_();
  saveOrders_(orders);
}
function placeOrder_(request) {
  const key = String(request.idempotency_key || '');
  if (!/^[a-zA-Z0-9-]{20,80}$/.test(key)) throw Error('Identificador de pedido inválido. Atualize a página.');
  const input = cleanOrder_(request.record || {});
  // Não usa preços ou nomes enviados pelo navegador como fonte do financeiro.
  const fingerprint = digest_(JSON.stringify({...input,itens:input.itens.map(item => ({id:item.id,quantidade:item.quantidade}))}));
  return withLock_(() => {
    const orders = readOrders_();
    let order = orders.find(row => row.chave_idempotencia === key);
    if (order && order.payload_hash !== fingerprint) throw Error('Este envio já pertence a outro pedido. Reabra a finalização.');
    if (order && order.status === 'excluindo') throw Error('Este pedido está com exclusão pendente. Fale com a loja.');
    if (!order) {
      const today = brazilDate_();
      if (orders.filter(row => row.whatsapp === input.whatsapp && row.criado_em.slice(0,10) === today).length >= 20) throw Error('Limite de pedidos atingido. Fale com a loja.');
      const clients = readClients_();
      const matches = clients.filter(row => normalizeEmail_(row.email) === input.email || phoneKey_(row.whatsapp) === input.whatsapp);
      if (matches.length > 1 || matches.length === 1 && (normalizeEmail_(matches[0].email) !== input.email || phoneKey_(matches[0].whatsapp) !== input.whatsapp)) throw Error('Os contatos informados precisam coincidir com seu cadastro. Confira e-mail e WhatsApp ou fale com a loja.');
      const stamp = now_(); const id = Utilities.getUuid();
      order = {id,numero:'SOLO-' + today.replace(/-/g,'') + '-' + id.replace(/-/g,'').slice(0,8).toUpperCase(),chave_idempotencia:key,payload_hash:fingerprint,cliente_id:matches.length ? matches[0].id : Utilities.getUuid(),nome:input.nome,email:input.email,whatsapp:input.whatsapp,itens_json:JSON.stringify(input.itens),total:input.total.toFixed(2),entrega:input.entrega,endereco:input.endereco,cep:input.cep,observacoes:input.observacoes,mensagem:'',status:'processando',conta_receber_id:Utilities.getUuid(),data_pedido:today,criado_em:stamp,atualizado_em:stamp,cupom_codigo:input.cupom_codigo || '',desconto:(input.desconto || 0).toFixed(2),subtotal:(input.subtotal || input.total).toFixed(2)};
      order.mensagem = orderMessage_(order);
      orders.push(order); saveOrders_(orders); // Journal persistente permite retomar gravações interrompidas.
    }
    if (order.status !== 'recebido') finishOrder_(order, orders);
    return {id:order.id,numero:order.numero,total:Number(order.total),mensagem:order.mensagem,whatsapp_url:'https://wa.me/5519993835111?text=' + encodeURIComponent(order.mensagem)};
  });
}
function orderView_(order, finance) {
  const receivable = finance.find(row => row.id === order.conta_receber_id);
  return {id:order.id,numero:order.numero,cliente_id:order.cliente_id,nome:order.nome,email:order.email,whatsapp:order.whatsapp,itens:JSON.parse(order.itens_json),total:Number(order.total),entrega:order.entrega,endereco:order.endereco,cep:order.cep,observacoes:order.observacoes,mensagem:order.mensagem,status:order.status,pagamento:receivable && receivable.status === 'pago' ? 'pago' : 'em_aberto',criado_em:order.criado_em};
}
function listOrders_(actor) {
  module_(actor, 'orders');
  const finance = readFinance_('receivables');
  return readOrders_().sort((a,b) => b.criado_em.localeCompare(a.criado_em)).map(order => orderView_(order, finance));
}
function deleteOrder_(actor, id) {
  module_(actor, 'orders');
  return withLock_(() => {
    const orders = readOrders_();
    const order = orders.find(row => row.id === String(id || ''));
    if (!order) throw Error('Pedido não encontrado.');
    const finance = readFinance_('receivables');
    if (order.conta_receber_id && finance.some(row => row.id === order.conta_receber_id && row.pedido_id && row.pedido_id !== order.id)) {
      throw Error('O vínculo da conta a receber pertence a outro pedido. Verifique o financeiro antes de excluir.');
    }
    const remaining = finance.filter(row => row.pedido_id !== order.id && !(order.conta_receber_id && row.id === order.conta_receber_id));
    if (order.status !== 'excluindo') {
      order.status = 'excluindo';
      order.atualizado_em = now_();
      saveOrders_(orders);
    }
    try {
      if (remaining.length !== finance.length) saveFinanceRows_('receivables', remaining);
      saveOrders_(orders.filter(row => row.id !== order.id));
    } catch (error) {
      console.error(error);
      throw Error('Exclusão incompleta. Tente excluir o pedido novamente para concluir.');
    }
    return {deleted:true,receivableDeleted:remaining.length !== finance.length};
  });
}
function requestCustomerCode_(request) {
  const identifier = String(request.identifier || '').trim().toLowerCase();
  if (identifier.length > 254 || identifier.length < 5) throw Error('Informe seu e-mail ou WhatsApp com DDD.');
  const response = {message:'Se os dados estiverem cadastrados, um código será enviado ao e-mail do seu cadastro. Ele vale por 10 minutos.'};
  return withLock_(() => {
    const cache = CacheService.getScriptCache();
    const key = 'customer-code:' + digest_(identifier.includes('@') ? identifier : phoneKey_(identifier));
    if (cache.get(key + ':cooldown')) return response;
    const clients = readClients_().filter(row => identifier.includes('@') ? normalizeEmail_(row.email) === identifier : phoneKey_(row.whatsapp) === phoneKey_(identifier));
    cache.put(key + ':cooldown','1',60);
    if (clients.length !== 1 || !validEmail_(clients[0].email)) return response;
    const client = clients[0];
    const clientKey = 'customer-code-client:' + client.id;
    if (cache.get(clientKey + ':cooldown')) return response;
    const code = String(parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,8),16) % 1000000).padStart(6,'0');
    const challenge = {id:client.id,email:normalizeEmail_(client.email),phone:phoneKey_(client.whatsapp),hash:digest_(client.id + ':' + code),attempts:0,expires:Date.now()+600000};
    cache.put(clientKey,JSON.stringify(challenge),600);
    cache.put(clientKey + ':cooldown','1',60);
    if (MailApp.getRemainingDailyQuota() < 1) throw Error('Envio de código temporariamente indisponível. Tente novamente mais tarde.');
    MailApp.sendEmail({to:client.email,subject:'Seu código de acesso — SOLO Ateliê',body:'Seu código para acessar os pedidos do SOLO é: ' + code + '\n\nVálido por 10 minutos. Não compartilhe este código. Se não solicitou o acesso, ignore esta mensagem.',name:'SOLO Ateliê Artesanal'});
    return response;
  });
}
function verifyCustomerCode_(request) {
  return withLock_(() => {
    const identifier = String(request.identifier || '').trim().toLowerCase();
    const code = String(request.code || '');
    const error = () => { throw Error('Código inválido ou expirado. Solicite um novo código.'); };
    if (identifier.length > 254 || !/^\d{6}$/.test(code)) return error();
    const clients = readClients_().filter(row => identifier.includes('@') ? normalizeEmail_(row.email) === identifier : phoneKey_(row.whatsapp) === phoneKey_(identifier));
    if (clients.length !== 1) return error();
    const client = clients[0]; const cache = CacheService.getScriptCache();
    const key = 'customer-code-client:' + client.id;
    const challenge = JSON.parse(cache.get(key) || 'null');
    if (!challenge || challenge.attempts >= 5 || challenge.expires < Date.now()) return error();
    challenge.attempts += 1; cache.put(key,JSON.stringify(challenge),Math.max(1,Math.ceil((challenge.expires-Date.now())/1000)));
    if (challenge.email !== normalizeEmail_(client.email) || challenge.phone !== phoneKey_(client.whatsapp) || !constantTime_(challenge.hash,digest_(client.id + ':' + code))) return error();
    cache.remove(key);
    const token = random_() + random_();
    cache.put('customer-session:' + digest_(token),JSON.stringify({id:client.id,email:challenge.email,phone:challenge.phone}),SESSION_SECONDS);
    return {token,user:{nome:client.nome},expiresIn:SESSION_SECONDS};
  });
}
function customerAuth_(token) {
  const saved = token && CacheService.getScriptCache().get('customer-session:' + digest_(String(token)));
  const session = JSON.parse(saved || 'null');
  const client = session && readClients_().find(row => row.id === session.id);
  if (!client || normalizeEmail_(client.email) !== session.email || phoneKey_(client.whatsapp) !== session.phone) throw Error('Sessão do cliente expirada. Entre novamente.');
  return client;
}
function customerOrders_(request) {
  const client = customerAuth_(request.token);
  const finance = readFinance_('receivables');
  return {cliente:{nome:client.nome},pedidos:readOrders_().filter(order => order.cliente_id === client.id && order.status === 'recebido').sort((a,b) => b.criado_em.localeCompare(a.criado_em)).map(order => orderView_(order,finance))};
}
function customerLogout_(request) {
  CacheService.getScriptCache().remove('customer-session:' + digest_(String(request.token || '')));
  return {loggedOut:true};
}
// Quantidade cadastrada corresponde aos preços do produto. Conversões apenas na mesma dimensão.
const MEASURE_UNITS_ = {g:['mass',1],kg:['mass',1000],mg:['mass',0.001],l:['volume',1000],ml:['volume',1],un:['unit',1],dz:['unit',12],pct:['package',1],cx:['box',1],m:['length',100],cm:['length',1]};
const KIT_COLUMNS_ = ['id','titulo','descricao','foto_arquivo_id','itens_json','preco_custo','preco_venda','lucro','margem_lucro','criado_em','atualizado_em'];
function getKitsFile_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('KITS_FILE_ID');
  if (id) return DriveApp.getFileById(id);
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_);
  const found = folder.getFilesByName('kits.csv');
  const file = found.hasNext() ? found.next() : folder.createFile('kits.csv',csv_(KIT_COLUMNS_,[]),'text/csv');
  props.setProperty('KITS_FILE_ID',file.getId());
  return file;
}
function kitView_(row) {
  return {...row,itens:JSON.parse(row.itens_json || '[]'),preco_custo:Number(row.preco_custo),preco_venda:Number(row.preco_venda),lucro:Number(row.lucro),margem_lucro:Number(row.margem_lucro),foto_url:row.foto_arquivo_id ? 'https://drive.google.com/thumbnail?id='+encodeURIComponent(row.foto_arquivo_id)+'&sz=w1200' : ''};
}
function readKits_() {
  const text = getKitsFile_().getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/,'');
  if (!text.trim()) return [];
  const matrix = Utilities.parseCsv(text), headers = matrix.shift() || [];
  if (KIT_COLUMNS_.some(key => !headers.includes(key))) throw Error('Cabeçalho de kits.csv inválido.');
  return matrix.filter(row=>row.some(Boolean)).map(row=>kitView_(Object.fromEntries(headers.map((key,i)=>[key,row[i] || '']))));
}
function calculateKit_(items, products) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw Error('Adicione de 1 a 100 produtos ao kit.');
  const seen = new Set();
  const cents = value => Math.round((value + Number.EPSILON)*100);
  const lines = items.map(input => {
    const product = products.find(p=>p.id === String(input.produto_id || ''));
    if (!product || product.status !== 'ativo') throw Error('Produto não encontrado ou inativo. Atualize a composição do kit.');
    if (seen.has(product.id)) throw Error('Produto repetido. Ajuste a quantidade na mesma linha.');
    seen.add(product.id);
    const quantidade = Number(String(input.quantidade ?? '').replace(',','.'));
    const unit = String(input.unidade_medida || product.unidade_medida || 'un');
    const baseUnit = product.unidade_medida || 'un';
    const a = MEASURE_UNITS_[unit], b = MEASURE_UNITS_[baseUnit];
    if (!a || !b || a[0] !== b[0]) throw Error('Unidade incompatível com a quantidade cadastrada do produto.');
    const baseQuantity = Number(product.quantidade || 1);
    if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 1000000 || !Number.isFinite(baseQuantity) || baseQuantity <= 0) throw Error('Quantidade inválida na composição do kit.');
    const factor = quantidade*a[1]/(baseQuantity*b[1]);
    const custo = cents(Number(product.preco_custo)*factor)/100;
    const venda = cents(Number(product.preco_venda)*factor)/100;
    if (![custo,venda].every(Number.isFinite) || Math.max(custo,venda) > 99999999) throw Error('Valor da composição excede o limite.');
    return {produto_id:product.id,nome:product.nome,quantidade,unidade_medida:unit,quantidade_base:baseQuantity,unidade_base:baseUnit,preco_custo:Number(product.preco_custo),preco_venda:Number(product.preco_venda),custo,venda};
  });
  const cost = lines.reduce((sum,item)=>sum+cents(item.custo),0)/100;
  const sale = lines.reduce((sum,item)=>sum+cents(item.venda),0)/100;
  const profit = cents(sale-cost)/100;
  return {itens:lines,preco_custo:cost,preco_venda:sale,lucro:profit,margem_lucro:sale > 0 ? Math.round(profit/sale*10000)/100 : 0};
}
function saveKit_(actor,input,operation) {
  module_(actor,'kits');
  const titulo = String(input.titulo || '').trim(), descricao = String(input.descricao || '').trim();
  if (titulo.length < 2 || titulo.length > 180) throw Error('Informe o título do kit (2 a 180 caracteres).');
  if (descricao.length > 4000) throw Error('A descrição deve conter até 4.000 caracteres.');
  return withLock_(()=>{
    const rows = readKits_(), index = operation === 'update' ? rows.findIndex(row=>row.id === String(input.id || '')) : -1;
    const old = rows[index];
    if (operation === 'update' && !old) throw Error('Kit não encontrado.');
    if (old && String(input.expected_updated_at || '') !== old.atualizado_em) throw Error('Kit atualizado por outra sessão. Reabra o cadastro antes de salvar.');
    const calculated = calculateKit_(input.itens,readProducts_());
    // Foto anterior só é descartada depois que o novo registro está salvo.
    let photo = old ? old.foto_arquivo_id : '', created = null;
    if (input.foto_data_url) {
      const decoded = decodePhoto_(input.foto_data_url);
      created = getProductsPhotosFolder_().createFile(Utilities.newBlob(decoded.bytes,decoded.mime,'kit-'+Utilities.getUuid()+'.'+decoded.extension));
      try { created.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW); } catch (_) {}
      photo = created.getId();
    } else if (input.remove_photo === true) photo = '';
    const stamp = now_();
    const row = {id:old ? old.id : Utilities.getUuid(),titulo,descricao,foto_arquivo_id:photo,itens_json:JSON.stringify(calculated.itens),preco_custo:calculated.preco_custo.toFixed(2),preco_venda:calculated.preco_venda.toFixed(2),lucro:calculated.lucro.toFixed(2),margem_lucro:calculated.margem_lucro.toFixed(2),criado_em:old ? old.criado_em : stamp,atualizado_em:stamp};
    if (old) rows[index]=row; else rows.push(row);
    try { getKitsFile_().setContent(csv_(KIT_COLUMNS_,rows)); }
    catch (error) { if (created) try {created.setTrashed(true);} catch (_) {} throw error; }
    if (old && old.foto_arquivo_id && old.foto_arquivo_id !== photo) try {DriveApp.getFileById(old.foto_arquivo_id).setTrashed(true);} catch (_) {}
    return kitView_(row);
  });
}
function deleteKit_(actor,id,version) {
  module_(actor,'kits');
  return withLock_(()=>{
    const rows=readKits_(), selected=rows.find(row=>row.id === String(id || ''));
    if (!selected) throw Error('Kit não encontrado.');
    if (String(version || '') !== selected.atualizado_em) throw Error('Kit atualizado por outra sessão. Atualize a lista antes de excluir.');
    getKitsFile_().setContent(csv_(KIT_COLUMNS_,rows.filter(row=>row.id !== selected.id)));
    if (selected.foto_arquivo_id) try {DriveApp.getFileById(selected.foto_arquivo_id).setTrashed(true);} catch (_) {}
    return {deleted:true};
  });
}

// Leituras agrupadas: autenticação e permissões atuais em toda requisição.
const PANEL_READ_ACTIONS_ = ['getDashboardStats','getDriveInventory','validateSession','listUsers','listClients','listSuppliers','listProducts','listKits','listKitProducts','listCoupons','listOrders','listFinanceReceivables','listFinancePayables','getSiteMenuAdmin','getModuleAccess','getMyProfile','getMyProfilePhoto','getUserPhotos'];
function panelRead_(actor, reads) {
  if (!Array.isArray(reads) || !reads.length || reads.length > 20 || reads.some(read=>!read || !PANEL_READ_ACTIONS_.includes(read.action))) throw Error('Consulta agrupada inválida.');
  const user = publicUser_(actor);
  const results = reads.map(read=>{
    try { return {ok:true,data:dispatchAction_({...(read.payload || {}),action:read.action},actor)}; }
    catch(error) { return {ok:false,message:publicError_(error)}; }
  });
  return {user,results};
}
function panelBootstrap_(actor) {
  const grants=access_(actor);
  const page=['dashboard','orders','finance','users','clients','suppliers','products','kits','coupons','site_menu','settings'].find(key=>grants[key]) || '';
  const actions=[];
  if(page==='dashboard') {
    actions.push('getDashboardStats');
    if(grants.finance) actions.push('listFinanceReceivables','listFinancePayables');
    if(grants.clients) actions.push('listClients');
    if(grants.orders) actions.push('listOrders');
  } else {
    const pages={orders:['listOrders'],finance:['listFinanceReceivables','listFinancePayables'],users:['listUsers'],clients:['listClients'],suppliers:['listSuppliers'],products:['listProducts',...(grants.suppliers ? ['listSuppliers'] : [])],kits:['listKits','listKitProducts'],coupons:['listCoupons',...(grants.clients ? ['listClients'] : [])],site_menu:['getSiteMenuAdmin'],settings:['listUsers']};
    actions.push(...(pages[page] || []));
  }
  const reads=actions.map(action=>({action}));
  const result=reads.length ? panelRead_(actor,reads) : {user:publicUser_(actor),results:[]};
  return {...result,page,reads};
}

function getDashboardStats_(actor) {
  module_(actor,'dashboard');
  const grants=access_(actor);
  return {users:grants.users ? readUsers_().length : null,kits:grants.kits ? readKits_().length : null,products:grants.products ? readProducts_().length : null,modules:Object.values(grants).filter(Boolean).length};
}
function getDriveInventory_(actor) {
  admin_(actor);
  const props=PropertiesService.getScriptProperties();
  const keys=['USERS_FILE_ID','SETTINGS_FILE_ID','CLIENTS_FILE_ID','SUPPLIERS_FILE_ID','PRODUCTS_FILE_ID','KITS_FILE_ID','COUPONS_FILE_ID','MENU_CONFIG_FILE_ID','MENU_CARDS_FILE_ID','ORDERS_FILE_ID','RECEIVABLES_FILE_ID','PAYABLES_FILE_ID'];
  const propertyById={};keys.forEach(key=>{const id=props.getProperty(key);if(id)propertyById[id]=key;});
  const files=DriveApp.getFolderById(DRIVE_FOLDER_ID_).getFiles(), rows=[];
  while(files.hasNext()) {
    const file=files.next(), name=file.getName();
    if(!/\.csv$/i.test(name)) continue;
    let bytes=null;try{bytes=Number(file.getSize());}catch(_){}
    rows.push({name,property:propertyById[file.getId()] || '',bytes,status:bytes===null ? 'unavailable' : 'ok'});
  }
  return rows.sort((a,b)=>a.name.localeCompare(b.name));
}
