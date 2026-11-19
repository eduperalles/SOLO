const DRIVE_FOLDER_ID_ = '1uDmZGpSEbeUq1PX_MvU-7nYW4Y4IpFva';
const USERS_COLUMNS_ = ['id','nome','email','senha_hash','salt','perfil','status','foto_arquivo_id','foto_atualizada_em','criado_em','atualizado_em'];
const FINANCE_COLUMNS_ = ['id','descricao','pessoa','categoria','valor','data_vencimento','data_pagamento','status','observacoes','criado_em','atualizado_em'];
const SESSION_SECONDS = 21600;
const HASH_ROUNDS = 10000;

function doGet() {
  const props = PropertiesService.getScriptProperties();
  return json_({ok:true,data:{service:'SOLO admin API',configured:!!props.getProperty('USERS_FILE_ID')}});
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

function dispatch_(request) {
  const publicActions = ['login'];
  const actor = publicActions.includes(request.action) ? null : auth_(request.token);
  switch (request.action) {
    case 'login': return login_(request);
    case 'logout': return logout_(request);
    case 'validateSession': return publicUser_(actor);
    case 'listUsers': admin_(actor); return readUsers_().map(adminUser_);
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

function readFinance_(type) {
  const text = DriveApp.getFileById(financeFileId_(type)).getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  if (!text.trim()) return [];
  const matrix = Utilities.parseCsv(text);
  const headers = matrix.shift().map(String);
  if (FINANCE_COLUMNS_.some(column => !headers.includes(column))) throw Error('Cabeçalho financeiro inválido.');
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
  if (!actor) throw Error('Sessão inválida. Entre novamente.');
  return readFinance_(type).map(record => ({...record, valor:Number(record.valor) || 0}));
}

function saveFinance_(actor, type, input) {
  if (!actor) throw Error('Sessão inválida. Entre novamente.');
  const id = String(input.id || '');
  const descricao = String(input.descricao || '').trim();
  const pessoa = String(input.pessoa || '').trim();
  const categoria = String(input.categoria || '').trim();
  const observacoes = String(input.observacoes || '').trim();
  const amount = Number(String(input.valor ?? '').replace(',', '.'));
  const due = String(input.data_vencimento || '');
  const paid = String(input.data_pagamento || '');
  const status = String(input.status || 'pendente');
  if (descricao.length < 2 || descricao.length > 180 || pessoa.length > 180 || categoria.length > 120 || observacoes.length > 2000) {
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
  if (!actor) throw Error('Sessão inválida. Entre novamente.');
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
  admin_(actor);
  return withLock_(() => {
    const rows = readUsers_();
    const id = String(input.id || '');
    const old = operation === 'update' ? rows.find(row => row.id === id) : null;
    if (operation === 'update' && !old) throw Error('Usuário não encontrado.');
    const clean = validateUser_(input, rows, id);
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
  admin_(actor);
  return withLock_(() => {
    const rows = readUsers_();
    const old = rows.find(row => row.id === String(id));
    if (!old) throw Error('Usuário não encontrado.');
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

function readUsers_() {
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
  return {id:user.id,nome:user.nome,email:user.email,perfil:user.perfil,status:user.status,has_photo:!!user.foto_arquivo_id,photo_version:user.foto_atualizada_em || '',atualizado_em:user.atualizado_em};
}

function adminUser_(user) {
  return publicUser_(user);
}

function getUserPhotos_(actor, rawIds) {
  admin_(actor);
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
