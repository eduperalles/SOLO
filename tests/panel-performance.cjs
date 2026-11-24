const assert=require('node:assert/strict');
const {run,context,files,props}=require('./module-access.cjs');
context.MailApp={getRemainingDailyQuota:()=>100};context.testActorId='admin';run('auth_=()=>readUsers_().find(row=>row.id===testActorId); setupClients(); setupOrders();');
let reads=new Map();for(const [id,file] of files){const getBlob=file.getBlob;file.getBlob=()=>{reads.set(id,(reads.get(id)||0)+1);return getBlob();};}
const settingsId=props.get('SETTINGS_FILE_ID');
const baseline=()=>{for(const action of ['validateSession','listUsers','validateSession','listUsers','listFinanceReceivables','listFinancePayables','listClients','listOrders'])run(`dispatch_({action:'${action}'})`);};
baseline();const before={users:reads.get('users')||0,access:reads.get(settingsId)||0,receivables:reads.get('receivables')||0};reads.clear();
const bootstrap=run("dispatch_({action:'panelBootstrap'})");
assert.equal(bootstrap.page,'dashboard');assert.equal(bootstrap.user.perfil,'admin');assert.equal(bootstrap.results.length,5);assert.ok(bootstrap.results.every(result=>result.ok));
assert.equal(reads.get('users'),1);assert.equal(reads.get('receivables'),1);assert.ok((reads.get(settingsId)||0)<=1);const optimized={users:reads.get('users'),access:reads.get(settingsId)||0,receivables:reads.get('receivables')};
assert.ok(!JSON.stringify(bootstrap).includes('senha_hash'));assert.ok(!JSON.stringify(bootstrap).includes('salt'));
assert.equal(run('PANEL_READ_MEMO_'),null);
// Cada requisição usa a versão ATUAL das permissões. Sem cache entre chamadas.
run("var beforeGrant=getModuleAccess_(admin,'operator');saveModuleAccess_(admin,{id:'operator',version:beforeGrant.version,access:{dashboard:true,finance:true,users:false,kits:false}})");context.testActorId='operator';
const financeOnly=run("dispatch_({action:'panelRead',reads:[{action:'listFinanceReceivables'},{action:'listUsers'},{action:'listKits'}]})");
assert.equal(financeOnly.results[0].ok,true);assert.equal(financeOnly.results[1].ok,false);assert.equal(financeOnly.results[2].ok,false);
run("var currentGrant=getModuleAccess_(admin,'operator');saveModuleAccess_(admin,{id:'operator',version:currentGrant.version,access:{dashboard:false,finance:false,users:false,kits:true}})");
const afterRevocation=run("dispatch_({action:'panelRead',reads:[{action:'listFinanceReceivables'},{action:'listKits'}]})");
assert.equal(afterRevocation.user.access.finance,false);assert.equal(afterRevocation.results[0].ok,false);assert.equal(afterRevocation.results[1].ok,true);
assert.equal(run("dispatch_({action:'panelBootstrap'}).page"),'kits');
assert.throws(()=>run("dispatch_({action:'panelRead',reads:[{action:'deleteUser'}]})"),/inválida/);
assert.throws(()=>run("dispatch_({action:'panelRead',reads:[]})"),/inválida/);
const overwrite=run("dispatch_({action:'panelRead',reads:[{action:'validateSession',payload:{action:'deleteUser',id:'admin'}}]})");assert.equal(overwrite.results[0].data.id,'operator');
const oldAuth=context.auth_;context.auth_=()=>{throw Error('Sessão expirada');};assert.throws(()=>run("dispatch_({action:'panelRead',reads:[{action:'listKits'}]})"),/Sessão/);context.auth_=oldAuth;
console.log('PASS: batched permissions, immediate revocation, role isolation, read allowlist, payload action override, session expiry, safe DTOs and request-only memoization.');
console.log(JSON.stringify({baseline:before,bootstrap:optimized,criticalRequestsBefore:8,criticalRequestsAfter:1}));
