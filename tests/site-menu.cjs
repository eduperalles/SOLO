const assert = require('node:assert/strict');
const {run,context,files,props}=require('./module-access.cjs');

// Mock DriveApp folder & photos
let photoSeq = 0;
const rootFolder = context.DriveApp.getFolderById();
rootFolder.getFoldersByName = name => ({ hasNext: () => false, next: () => null });
rootFolder.createFolder = name => ({
  getId: () => 'menu-photos-folder-id',
  createFile: (blob) => {
    const pId = `photo-${++photoSeq}`;
    const pFile = {
      getId: () => pId,
      getName: () => 'photo.png',
      setSharing: () => {},
      setTrashed: () => {}
    };
    files.set(pId, pFile);
    return pFile;
  },
  setSharing: () => {}
});
context.DriveApp.getFolderById = () => rootFolder;
context.MailApp = { getRemainingDailyQuota: () => 100, sendEmail: () => {} };
context.Utilities.base64Decode = str => Array.from(Buffer.from(str, 'base64'));
context.Utilities.formatDate = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'America/Sao_Paulo'}).format(new Date());
context.Utilities.newBlob = (bytes, mime, name) => ({
  getBytes: () => bytes,
  getContentType: () => mime,
  getName: () => name
});
run('setupClients()');

// 1. Consulta pública inicial de dados do menu do site
const initial = run('getSiteMenuData_()');
assert.ok(initial.config, 'Configuração retornada');
assert.equal(initial.config.ativo, true);
assert.equal(Array.isArray(initial.cards), true);

// 2. Permissão de módulo
assert.equal(run('access_(admin).site_menu'), true);
assert.equal(run('access_(operator).site_menu'), false);
assert.throws(()=>run("saveSiteMenuConfig_(operator, {menu_titulo:'X'})"), /permiss/);

// 3. Salvar configuração do menu como admin
run("saveSiteMenuConfig_(admin, {menu_titulo:'Eventos', secao_titulo:'Eventos & Celebrações', secao_subtitulo:'Experiências exclusivas', ativo:true})");
let config = run('readSiteMenuConfig_()');
assert.equal(config.menu_titulo, 'Eventos');
assert.equal(config.secao_titulo, 'Eventos & Celebrações');
assert.equal(config.ativo, '1');

// 4. Criação de Card com foto simulada
const cardInput = {
  titulo: 'Festa corporativa',
  descricao: 'Organizamos estações gourmet e experiências de charcutaria para sua empresa.',
  fotos: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='],
  ordem: '1',
  ativo: true
};

run(`var card = saveSiteCard_(admin, ${JSON.stringify(cardInput)}, 'create');`);
assert.equal(run('card.titulo'), 'Festa corporativa');
assert.equal(run('readSiteCards_().length'), 1);

// Consulta pública com card ativo
const publicData = run('getSiteMenuData_()');
assert.equal(publicData.config.menu_titulo, 'Eventos');
assert.equal(publicData.cards.length, 1);
assert.equal(publicData.cards[0].titulo, 'Festa corporativa');
assert.ok(publicData.cards[0].photos.length >= 1);

// 5. Atualização de Card
run(`card = saveSiteCard_(admin, {...card, titulo:'Festa Corporativa & Confraternização', ordem:'2'}, 'update');`);
assert.equal(run('readSiteCards_()[0].titulo'), 'Festa Corporativa & Confraternização');

// 6. Solicitação de Orçamento com cadastro automático de cliente
const initialClients = run('readClients_().length');
const budgetInput = {
  record: {
    card_id: run('card.id'),
    card_titulo: 'Festa Corporativa & Confraternização',
    nome: 'Mariana Silva Corporativo',
    email: 'mariana.eventos@empresa.com.br',
    whatsapp: '(19) 98888-1122',
    cidade: 'Campinas',
    data_evento: '2026-12-15',
    convidados: '80 pessoas',
    observacoes: 'Gostaríamos de opções vegetarianas também.'
  }
};

const budgetResult = run(`submitBudgetRequest_(${JSON.stringify(budgetInput)})`);
assert.equal(budgetResult.ok, true);
assert.ok(budgetResult.whatsapp_url.includes('5519993835111'));
assert.ok(budgetResult.whatsapp_url.includes('Mariana'));
assert.ok(budgetResult.whatsapp_url.includes('Festa%20Corporativa'));

// Verifica cadastro automático do cliente
const updatedClients = run('readClients_()');
assert.equal(updatedClients.length, initialClients + 1);
const registeredClient = updatedClients.find(c => c.email === 'mariana.eventos@empresa.com.br');
assert.ok(registeredClient, 'Cliente cadastrado automaticamente em clientes.csv');
assert.equal(registeredClient.nome, 'Mariana Silva Corporativo');
assert.equal(registeredClient.whatsapp, '19988881122');

// 7. Exclusão de Card
run('deleteSiteCard_(admin, card.id)');
assert.equal(run('readSiteCards_().length'), 0);
assert.equal(run('getSiteMenuData_().cards.length'), 0);

console.log('PASS: Site menu config, dynamic cards CRUD, budget request submission and automatic client registration.');
