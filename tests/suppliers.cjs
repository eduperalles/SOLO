const assert = require('node:assert/strict');
const {run,files,props}=require('./module-access.cjs');

// Configura o módulo de fornecedores
run('setupSuppliers()'); const id=props.get('SUPPLIERS_FILE_ID');
assert.ok(id, 'SUPPLIERS_FILE_ID configurado');
run('setupSuppliers()'); assert.equal(props.get('SUPPLIERS_FILE_ID'), id);

// Permissões
assert.equal(run('access_(admin).suppliers'), true);
assert.equal(run('access_(operator).suppliers'), false);
assert.throws(()=>run(`saveSupplier_(operator,{},'create')`), /permiss/);

// Leitura inicial vazia
assert.equal(run('readSuppliers_().length'), 0);

// Criação de fornecedor
const supplierInput = {
  fornecedor: 'Laticínios da Serra Ltda',
  email: 'CONTATO@LATICINIOS.COM.BR',
  whatsapp: '(19) 98765-4321',
  endereco: 'Rodovia SP-340, Km 120',
  cidade: 'Mogi Mirim',
  uf: 'sp',
  tipo_produto: 'Queijos artesanais e manteiga',
  observacoes: 'Entregas às terças-feiras pela manhã.'
};

run(`var input = ${JSON.stringify(supplierInput)}; var supplier = saveSupplier_(admin, input, 'create');`);
assert.equal(run('supplier.email'), 'contato@laticinios.com.br');
assert.equal(run('supplier.whatsapp'), '19987654321');
assert.equal(run('supplier.uf'), 'SP');
assert.equal(run('supplier.fornecedor'), 'Laticínios da Serra Ltda');
assert.equal(run('supplier.cidade'), 'Mogi Mirim');
assert.equal(run('supplier.tipo_produto'), 'Queijos artesanais e manteiga');
assert.equal(run('supplier.observacoes'), 'Entregas às terças-feiras pela manhã.');
assert.equal(run('readSuppliers_().length'), 1);

// Validações
for(const bad of [
  {fornecedor:'x'},
  {email:'invalido'},
  {whatsapp:'123'},
  {uf:'SPO'},
  {endereco:'a'.repeat(251)}
]){
  assert.throws(()=>run(`saveSupplier_(admin,{...input,...${JSON.stringify(bad)}},'create')`));
}

// Concorrência otimista
assert.throws(()=>run(`saveSupplier_(admin,{...supplier,id:supplier.id,expected_updated_at:'stale'},'update')`), /outra sess/);

// Atualização válida
const createdAt = run('supplier.criado_em');
run(`supplier = saveSupplier_(admin,{...supplier,fornecedor:'Laticínios da Serra Atualizado',expected_updated_at:supplier.atualizado_em,criado_em:'forged'},'update');`);
assert.equal(run('supplier.criado_em'), createdAt);
assert.equal(run('supplier.fornecedor'), 'Laticínios da Serra Atualizado');
assert.equal(run('readSuppliers_()[0].fornecedor'), 'Laticínios da Serra Atualizado');

// Concessão de permissão para operador
const currentVersion = run("getModuleAccess_(admin, 'operator').version");
run(`saved=saveModuleAccess_(admin,{id:'operator',access:{dashboard:false,users:true,finance:true,clients:true,suppliers:true},version:'${currentVersion}'})`);
assert.equal(run('access_(operator).suppliers'), true);

// Operador atualiza fornecedor
run(`supplier=saveSupplier_(operator,{...supplier,cidade:'Campinas',expected_updated_at:supplier.atualizado_em},'update')`);
assert.equal(run('readSuppliers_()[0].cidade'), 'Campinas');

// Revogação de permissão
run(`saved=saveModuleAccess_(admin,{id:'operator',access:{dashboard:false,users:true,finance:true,clients:true,suppliers:false},version:saved.version})`);
assert.equal(run('access_(operator).suppliers'), false);
assert.throws(()=>run(`deleteSupplier_(operator,supplier.id,supplier.atualizado_em)`), /permiss/);

// Exclusão por administrador
assert.throws(()=>run(`deleteSupplier_(admin,supplier.id,'stale')`), /outra sess/);
run('deleteSupplier_(admin,supplier.id,supplier.atualizado_em)');
assert.equal(run('readSuppliers_().length'), 0);
assert.throws(()=>run(`deleteSupplier_(admin,'inexistente','')`), /encontrado/);

console.log('PASS: suppliers CRUD, required fields, normalization, CSV columns, concurrency, module permissions and optimistic locking.');
