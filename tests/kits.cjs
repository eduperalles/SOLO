const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {run,context,files,props}=require('./module-access.cjs');
assert.equal(run('access_(admin).kits'),true);assert.equal(run('access_(operator).kits'),false);
assert.throws(()=>run("saveKit_(operator,{},'create')"),/permiss/);
const legacyColumns=run("PRODUCT_COLUMNS_.filter(k=>!['quantidade','unidade_medida'].includes(k))");
context.legacyColumns=legacyColumns;
run("getProductsFile_().setContent(csv_(legacyColumns,[{id:'legacy',nome:'Antigo',preco_custo:5,preco_venda:10,status:'ativo'}]))");
assert.equal(run('readProducts_()[0].quantidade'),1);assert.equal(run('readProducts_()[0].unidade_medida'),'un');
run("var queijo=saveProduct_(admin,{nome:'Queijo <Brie>',quantidade:1,unidade_medida:'kg',preco_custo:80,preco_venda:120},'create');var suco=saveProduct_(admin,{nome:'Suco',quantidade:1,unidade_medida:'l',preco_custo:10,preco_venda:20},'create');var caixa=saveProduct_(admin,{nome:'Embalagem',quantidade:1,unidade_medida:'un',preco_custo:5,preco_venda:10},'create');");
assert.equal(run('readProducts_().find(p=>p.id===queijo.id).quantidade'),1);
for(const patch of [{quantidade:0},{quantidade:-1},{quantidade:'abc'},{unidade_medida:'banana'},{preco_custo:'Infinity'},{preco_venda:'Infinity'}]) assert.throws(()=>run(`saveProduct_(admin,{...queijo,...${JSON.stringify(patch)}},'create')`));
run("var kitInput={titulo:'Kit Café & Afeto',descricao:'Montar com cuidado.\\nAdicionar um cartão.',itens:[{produto_id:queijo.id,quantidade:100,unidade_medida:'g'},{produto_id:suco.id,quantidade:250,unidade_medida:'ml'},{produto_id:caixa.id,quantidade:2,unidade_medida:'un'}],preco_custo:0.01,preco_venda:0.01};var kit=saveKit_(admin,kitInput,'create');");
assert.equal(run('kit.preco_custo'),20.5);assert.equal(run('kit.preco_venda'),37);assert.equal(run('kit.lucro'),16.5);assert.equal(run('kit.margem_lucro'),44.59);
assert.equal(run('readKits_()[0].itens[0].quantidade'),100);assert.equal(run('readKits_()[0].descricao'),run('kitInput.descricao'));
assert.throws(()=>run("deleteProduct_(admin,queijo.id,queijo.atualizado_em)"),/compõe um kit/);
assert.throws(()=>run("saveKit_(admin,{...kitInput,id:kit.id,expected_updated_at:'stale'},'update')"),/outra sess/);
for(const items of [[],[{produto_id:'missing',quantidade:1}],[{produto_id:run('queijo.id'),quantidade:0}],[{produto_id:run('queijo.id'),quantidade:1,unidade_medida:'ml'}],[{produto_id:run('queijo.id'),quantidade:1},{produto_id:run('queijo.id'),quantidade:1}]]) assert.throws(()=>run(`calculateKit_(${JSON.stringify(items)},readProducts_())`));
run("queijo=saveProduct_(admin,{...queijo,preco_custo:100,expected_updated_at:queijo.atualizado_em},'update')");
assert.equal(run('readKits_()[0].preco_custo'),20.5); // snapshot histórico
run("kit=saveKit_(admin,{...kitInput,id:kit.id,expected_updated_at:kit.atualizado_em},'update')");
assert.equal(run('kit.preco_custo'),22.5);
// Paridade exata do cálculo usado no navegador e no servidor.
const browser={window:{}};vm.createContext(browser);vm.runInContext(fs.readFileSync('assets/kit-tools.js','utf8'),browser);
const products=JSON.parse(run('JSON.stringify(readProducts_())'));
const items=JSON.parse(run('JSON.stringify(kitInput.itens)'));
assert.deepEqual(JSON.parse(JSON.stringify(browser.window.SoloKitTools.calculate(items,products))),JSON.parse(run('JSON.stringify(calculateKit_(kitInput.itens,readProducts_()))')));
assert.equal(run("calculateKit_([{produto_id:caixa.id,quantidade:1,unidade_medida:'dz'}],readProducts_()).preco_custo"),60);
// Foto: gravação e exclusão mantêm o vínculo sem modificar produtos.
let trashed=false;files.set('kit-photo',{setTrashed:()=>{trashed=true;}});
context.decodePhoto_=()=>({bytes:[1,2],mime:'image/png',extension:'png'});
context.getProductsPhotosFolder_=()=>({createFile:()=>({getId:()=>'kit-photo',setSharing(){}})});
context.Utilities.newBlob=()=>({});context.DriveApp.Access={ANYONE_WITH_LINK:'link'};context.DriveApp.Permission={VIEW:'view'};
run("kit=saveKit_(admin,{...kitInput,id:kit.id,expected_updated_at:kit.atualizado_em,foto_data_url:'test'},'update')");
assert.equal(run('kit.foto_arquivo_id'),'kit-photo');assert.ok(run('kit.foto_url').includes('kit-photo'));
// Permissões independentes: kits não dá acesso à alteração de produtos.
run("var grants=getModuleAccess_(admin,'operator');saveModuleAccess_(admin,{id:'operator',version:grants.version,access:{dashboard:true,users:false,finance:true,kits:true}})");
assert.equal(run('access_(operator).kits'),true);assert.equal(run('access_(operator).products'),false);
assert.throws(()=>run("saveProduct_(operator,queijo,'update')"),/permiss/);
assert.throws(()=>run("deleteKit_(operator,kit.id,'stale')"),/outra sess/);
run('deleteKit_(operator,kit.id,kit.atualizado_em)');assert.equal(run('readKits_().length'),0);assert.equal(trashed,true);
run('deleteProduct_(admin,queijo.id,queijo.atualizado_em)');
console.log('PASS: legacy product migration, units, conversions, authoritative costs, kit CRUD, snapshots, margin, photos, permissions, concurrency, linked-product guard and browser/server calculation parity.');

const panelSource=fs.readFileSync('assets/panel.js','utf8');
const calcSource=panelSource.slice(panelSource.indexOf('  function calcProfitMargin('),panelSource.indexOf('  function openSupplierPicker('));
const calcContext={parseCurrency:value=>(Number(String(value).replace(/\D/g,''))/100).toFixed(2)};vm.createContext(calcContext);vm.runInContext(calcSource,calcContext);
assert.equal(vm.runInContext('calcProfitMargin(80,120).cost',calcContext),80);
assert.equal(vm.runInContext("calcProfitMargin('80,00','120,00').price",calcContext),120);
assert.equal((panelSource.match(/id="prod-fornecedor-nome"/g)||[]).length,1);
console.log('PASS: product monetary preview in edit mode and unique supplier field.');
// O relatório escapa os textos e mantém os valores registrados.
vm.runInContext(fs.readFileSync('assets/kits.js','utf8'),browser);
const escapeHtml=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const report=browser.window.SoloKits.reportHtml({titulo:'Kit <script>alert(1)</script>',descricao:'Teste & montagem',atualizado_em:'2026-11-24T10:00:00Z',foto_url:'/solo_afeto.jpg',itens:[{nome:'Queijo <Brie>',quantidade:100,unidade_medida:'g',quantidade_base:1,unidade_base:'kg',preco_custo:80,preco_venda:120,custo:8,venda:12}],preco_custo:8,preco_venda:12,lucro:4,margem_lucro:33.33},{e:escapeHtml,money:value=>'R$ '+Number(value).toFixed(2)});
assert.ok(report.includes('Kit &lt;script&gt;'));assert.ok(!report.includes('<script>'));assert.ok(report.includes('Queijo &lt;Brie&gt;'));assert.ok(report.includes('100 g'));assert.ok(report.includes('A4 landscape'));assert.ok(report.includes('R$ 8.00'));assert.ok(report.includes('Foto') || report.includes('img src'));
console.log('PASS: printable report escaping, photo, composition, quantities and totals.');

run("var compatibility=saveProduct_(admin,{nome:'Compatibilidade',quantidade:500,unidade_medida:'g',preco_custo:10,preco_venda:20},'create');var oldPayload={...compatibility,expected_updated_at:compatibility.atualizado_em};delete oldPayload.quantidade;delete oldPayload.unidade_medida;compatibility=saveProduct_(admin,oldPayload,'update');");
assert.equal(run('compatibility.quantidade'),500);assert.equal(run('compatibility.unidade_medida'),'g');
console.log('PASS: older product forms preserve the registered quantity and unit.');
