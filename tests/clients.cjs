const assert = require('node:assert/strict');
const {run,files,props}=require('./module-access.cjs');
// Simula configuracoes.csv anterior ao módulo Clientes.
run(`DriveApp.getFileById(PropertiesService.getScriptProperties().getProperty('SETTINGS_FILE_ID')).setContent(csv_(ACCESS_COLUMNS_.filter(key=>key!=='clients'),[{usuario_id:'operator',dashboard:'0',users:'1',finance:'1',atualizado_em:'legacy-version',atualizado_por:'admin'}]))`);
assert.equal(run('access_(operator).clients'),false);
run('setupClients()'); const id=props.get('CLIENTS_FILE_ID');
run('setupClients()');assert.equal(props.get('CLIENTS_FILE_ID'),id);
assert.equal(run('access_(operator).dashboard'),false);
assert.equal(run('access_(operator).users'),true);
assert.equal(run(`getModuleAccess_(admin,'operator').version`),'legacy-version');
assert.equal(run('access_(admin).clients'),true);
assert.equal(run('readClients_().length'),0);
assert.throws(()=>run(`saveClient_(operator,{},'create')`),/permiss/);
run(`var clientInput = {nome:'Cliente "Teste", Completo',email:'CLIENTE@example.invalid',whatsapp:'(11) 99999-9999',data_cadastro:'2026-11-19'};var client = saveClient_(admin,clientInput,'create');`);
assert.equal(run('client.email'),'cliente@example.invalid');
assert.equal(run('client.whatsapp'),'11999999999');
assert.equal(run('readClients_()[0].nome'),'Cliente "Teste", Completo');
for(const bad of [{nome:'x'},{email:'invalido'},{whatsapp:'123'},{whatsapp:'abc11999999999'},{data_cadastro:'2026-02-30'}]){
 assert.throws(()=>run(`saveClient_(admin,{...clientInput,...${JSON.stringify(bad)}},'create')`));
}
assert.throws(()=>run(`saveClient_(admin,{...client,id:client.id,expected_updated_at:'stale'},'update')`),/outra sess/);
run(`var createdAt=client.criado_em; client=saveClient_(admin,{...client,nome:'Cliente Atualizado',expected_updated_at:client.atualizado_em,criado_em:'forged'},'update');`);
assert.equal(run('client.criado_em'),run('createdAt'));
assert.equal(run('readClients_()[0].nome'),'Cliente Atualizado');
assert.throws(()=>run(`deleteClient_(admin,client.id,'stale')`),/outra sess/);
run(`saved=saveModuleAccess_(admin,{id:'operator',access:{dashboard:false,users:true,finance:true,clients:true},version:'legacy-version'})`);
assert.equal(run('access_(operator).clients'),true);
// Clientes concedido é preservado ao salvar por uma aba antiga sem a chave clients.
run(`saved=saveModuleAccess_(admin,{id:'operator',access:{dashboard:false,users:true,finance:true},version:saved.version})`);
assert.equal(run('access_(operator).clients'),true);
run(`client=saveClient_(operator,{...client,nome:'Cliente do Operador',expected_updated_at:client.atualizado_em},'update')`);
run(`saved=saveModuleAccess_(admin,{id:'operator',access:{dashboard:false,users:true,finance:true,clients:false},version:saved.version})`);
assert.throws(()=>run(`deleteClient_(operator,client.id,client.atualizado_em)`),/permiss/);
run('deleteClient_(admin,client.id,client.atualizado_em)');
assert.equal(run('readClients_().length'),0);
assert.throws(()=>run(`deleteClient_(admin,'inexistente','')`),/encontrado/);
console.log('PASS: clients CRUD, required fields, normalization, CSV quotes, invalid dates, concurrent edits/deletion, immutable creation timestamp, permission defaults/grants/revocation, legacy settings migration and old-tab compatibility.');
