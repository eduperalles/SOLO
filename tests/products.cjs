const assert = require('node:assert/strict');
const {run,context,files,props}=require('./module-access.cjs');

// Mock folder de fotos de produtos
let prodPhotoSeq = 0;
const rootFolder = context.DriveApp.getFolderById();
rootFolder.createFolder = name => ({
  getId: () => 'products-photos-folder-id',
  createFile: (blob) => {
    const pId = `prod-photo-${++prodPhotoSeq}`;
    const pFile = {
      getId: () => pId,
      getName: () => 'prod-photo.jpg',
      setSharing: () => {},
      setTrashed: () => {}
    };
    files.set(pId, pFile);
    return pFile;
  },
  setSharing: () => {}
});
context.DriveApp.getFolderById = () => rootFolder;
context.Utilities.base64Decode = str => Array.from(Buffer.from(str, 'base64'));
context.Utilities.newBlob = (bytes, mime, name) => ({
  getBytes: () => bytes,
  getContentType: () => mime,
  getName: () => name
});

// 1. Permissões de módulo
assert.equal(run('access_(admin).products'), true);
assert.equal(run('access_(operator).products'), false);
assert.throws(()=>run("saveProduct_(operator, {}, 'create')"), /permiss/);

// 2. Leitura inicial vazia
assert.equal(run('readProducts_().length'), 0);

// 3. Criação de produto com preço de custo x preço de venda e margem automática
const productInput = {
  nome: 'Tábua Brie com Mel e Nozes',
  categoria: 'Queijos Especiais',
  fornecedor_id: 'supplier-123',
  fornecedor_nome: 'Laticínios da Serra',
  preco_custo: '30.00',
  preco_venda: '60.00',
  descricao: 'Queijo brie selecionado servido com favo de mel puro e nozes crocantes.',
  status: 'ativo'
};

run(`var input = ${JSON.stringify(productInput)}; var prod = saveProduct_(admin, input, 'create');`);
assert.equal(run('prod.nome'), 'Tábua Brie com Mel e Nozes');
assert.equal(run('prod.fornecedor_id'), 'supplier-123');
assert.equal(run('prod.fornecedor_nome'), 'Laticínios da Serra');
assert.equal(run('prod.preco_custo'), 30);
assert.equal(run('prod.preco_venda'), 60);
// Lucro = 30, Margem = (30 / 60) * 100 = 50%
assert.equal(run('prod.margem_lucro'), 50);
assert.equal(run('readProducts_().length'), 1);

// 4. Validação de erros
for(const bad of [
  {nome:'x'},
  {preco_venda:0},
  {preco_venda:-10},
  {preco_custo:-5}
]){
  assert.throws(()=>run(`saveProduct_(admin,{...input,...${JSON.stringify(bad)}},'create')`));
}

// 5. Concorrência otimista
assert.throws(()=>run("saveProduct_(admin,{...prod,expected_updated_at:'stale'},'update')"), /outra sess/);

// 6. Atualização válida com recálculo de margem
// Custo 40, Venda 50 -> Lucro 10 -> Margem (10/50)*100 = 20%
run("prod = saveProduct_(admin,{...prod,preco_custo:'40.00',preco_venda:'50.00',expected_updated_at:prod.atualizado_em},'update');");
assert.equal(run('prod.preco_custo'), 40);
assert.equal(run('prod.preco_venda'), 50);
assert.equal(run('prod.margem_lucro'), 20);

// 7. Exclusão de produto
assert.throws(()=>run("deleteProduct_(admin,prod.id,'stale')"), /outra sess/);
run('deleteProduct_(admin,prod.id,prod.atualizado_em)');
assert.equal(run('readProducts_().length'), 0);
assert.throws(()=>run(`deleteProduct_(admin,'inexistente','')`), /encontrado/);

console.log('PASS: products CRUD, supplier linkage, cost vs sale price, auto profit margin calculation, concurrency and module access.');
