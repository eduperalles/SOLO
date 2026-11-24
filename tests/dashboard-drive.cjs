const assert=require('node:assert/strict');const {run,context,files}=require('./module-access.cjs');
const stats=run('getDashboardStats_(admin)');assert.equal(stats.users,3);assert.equal(stats.kits,0);assert.equal(stats.products,0);assert.equal(stats.modules,11);
run("var dashGrant=getModuleAccess_(admin,'operator');saveModuleAccess_(admin,{id:'operator',version:dashGrant.version,access:{dashboard:true,users:false,finance:true,kits:false,products:false}})");
const restricted=run('getDashboardStats_(operator)');assert.equal(restricted.users,null);assert.equal(restricted.kits,null);assert.equal(restricted.products,null);
assert.throws(()=>run('getDriveInventory_(operator)'),/administrador/);
files.get('users').getSize=()=>321;files.get('receivables').getSize=()=>2048;
const originalFolder=context.DriveApp.getFolderById;context.DriveApp.getFolderById=id=>({...originalFolder(id),getFiles:()=>{const rows=[files.get('users'),files.get('receivables'),{getName:()=>'foto.jpg'},{getName:()=>'indisponivel.csv',getId:()=>'unreadable',getSize:()=>{throw Error('unavailable');}}];return{hasNext:()=>rows.length>0,next:()=>rows.shift()};}});
const inventory=run('getDriveInventory_(admin)');assert.equal(inventory.length,3);assert.equal(inventory.find(row=>row.name==='usuarios.csv').bytes,321);assert.equal(inventory.find(row=>row.name==='usuarios.csv').property,'USERS_FILE_ID');assert.equal(inventory.find(row=>row.name==='contas_receber.csv').bytes,2048);assert.equal(inventory.find(row=>row.name==='indisponivel.csv').bytes,null);
console.log('PASS: dashboard counts and permission filtering; Drive inventory exact sizes, script-property association, CSV-only scope, unavailable sizes and admin restriction.');
