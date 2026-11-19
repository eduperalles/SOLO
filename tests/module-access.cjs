const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const files = new Map();
const props = new Map([['USERS_FILE_ID','users'],['RECEIVABLES_FILE_ID','receivables'],['PAYABLES_FILE_ID','payables']]);
function parseCsv(text) {
  const rows=[]; let row=[],value='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) { const c=text[i];
    if(c==='"') {if(quoted && text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(c===',' && !quoted){row.push(value);value='';}
    else if(c==='\n' && !quoted){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value='';}
    else value+=c;
  }
  row.push(value);rows.push(row);return rows;
}
function file(id,name,content) { const f={getId:()=>id,getName:()=>name,getBlob:()=>({getDataAsString:()=>content}),setContent:value=>{content=value;}};files.set(id,f);return f; }
let sequence=0;
const context=vm.createContext({console,Date,PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{parseCsv,getUuid:()=>`generated-${++sequence}`},DriveApp:{getFileById:id=>files.get(id),getFolderById:()=>({getFilesByName:name=>{let found=[...files.values()].filter(f=>f.getName()===name);return {hasNext:()=>found.length>0,next:()=>found.shift()};},createFile:(name,content)=>file(`file-${++sequence}`,name,content)})}});
vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),context);
function run(code){return vm.runInContext(code,context);}
file('users','usuarios.csv',run(`csv_(USERS_COLUMNS_, [{id:'admin',nome:'Admin',email:'admin@example.invalid',perfil:'admin',status:'ativo'}, {id:'operator',nome:'Operador',email:'operator@example.invalid',perfil:'operador',status:'ativo'}, {id:'other',nome:'Outro',email:'other@example.invalid',perfil:'operador',status:'ativo'}])`));
file('receivables','contas_receber.csv',run('csv_(FINANCE_COLUMNS_,[])'));
file('payables','contas_pagar.csv',run('csv_(FINANCE_COLUMNS_,[])'));
run(`var admin = readUsers_()[0]; var operator = readUsers_()[1];`);
run('setupSettings()');const settingsId=props.get('SETTINGS_FILE_ID');run('setupSettings()');assert.equal(props.get('SETTINGS_FILE_ID'),settingsId);
assert.equal(run('access_(operator).finance'),true);
assert.throws(()=>run('getModuleAccess_(operator,"admin")'),/administrador/);
run(`var saved = saveModuleAccess_(admin,{id:'operator',access:{dashboard:false,users:false,finance:false},version:''});`);
assert.equal(run('access_(operator).dashboard'),false);
for(const action of [`listFinance_(operator,'receivables')`,`saveFinance_(operator,'payables',{})`,`deleteFinance_(operator,'receivables','x')`,`saveUser_(operator,{},'create')`,`getUserPhotos_(operator,[])`])assert.throws(()=>run(action),/permiss/);
assert.throws(()=>run(`saveModuleAccess_(admin,{id:'operator',access:{dashboard:true,users:true,finance:true},version:''})`),/outra sess/);
assert.throws(()=>run(`saveModuleAccess_(admin,{id:'admin',access:{dashboard:false,users:false,finance:false},version:''})`),/integral/);
assert.throws(()=>run(`saveModuleAccess_(admin,{id:'operator',access:{dashboard:true,users:true,finance:true,settings:true},version:saved.version})`),/inv/);
run(`saved=saveModuleAccess_(admin,{id:'operator',access:{dashboard:true,users:true,finance:true},version:saved.version})`);
assert.equal(run(`listFinance_(operator,'receivables').length`),0);
assert.throws(()=>run(`saveUser_(operator,{id:'admin',nome:'Admin',email:'admin@example.invalid',perfil:'operador',status:'ativo'},'update')`),/administradores/);
assert.throws(()=>run(`saveUser_(operator,{id:'other',nome:'Outro',email:'other@example.invalid',perfil:'admin',status:'ativo'},'update')`),/administradores/);
assert.throws(()=>run(`deleteUser_(operator,'admin')`),/administradores/);
assert.throws(()=>run(`saveUser_(admin,{id:'admin',nome:'Admin',email:'admin@example.invalid',perfil:'operador',status:'ativo'},'update')`),/administrador ativo/);
assert.equal(run('publicUser_(operator).access.users'),true);
assert.equal(run(`getModuleAccess_(admin,'operator').version`),run('saved.version'));
assert.equal(files.get(settingsId).getBlob().getDataAsString().includes('"usuario_id"'),true);
console.log('PASS: CSV initialization/idempotence, defaults, permission persistence, immediate revocation, finance read/write/delete denial, user management guards, admin protection, optimistic concurrency, invalid grants.');
