const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},setTimeout,clearTimeout,Date};vm.createContext(context);vm.runInContext(fs.readFileSync('assets/panel-api.js','utf8'),context);
(async()=>{
 const calls=[],updates=[];
 const client=context.window.SoloPanelApi.create({send:async(action,payload)=>{calls.push({action,payload});if(action==='panelRead')return {user:{id:'test'},results:payload.reads.map(read=>read.action==='listUsers' ? {ok:false,message:'Sem permissão'} : {ok:true,data:[read.action]})};return {saved:true};},onUser:user=>updates.push(user)});
 const first=client.request('listClients'),second=client.request('listClients'),third=client.request('listProducts');assert.equal(first,second);await Promise.all([first,second,third]);
 assert.equal(calls.length,1);assert.equal(calls[0].action,'panelRead');assert.equal(calls[0].payload.reads.length,2);assert.equal(updates.length,1);
 await assert.rejects(client.request('listUsers'),/permissão/);
 client.prime([{action:'listClients'}],[{ok:true,data:['bootstrap']}]);assert.equal((await client.request('listClients'))[0],'bootstrap');assert.equal(calls.length,2);
 await client.request('listClients');assert.equal(calls.length,3); // sem cache de dados persistente
 client.prime([{action:'listClients'}],[{ok:true,data:['stale']}]);await client.request('createClient',{record:{}});await client.request('listClients');assert.equal(calls.length,5);
 const source=fs.readFileSync('assets/panel.js','utf8');const startup=source.slice(source.indexOf('  async function start()'));
 assert.ok(startup.includes("api('panelBootstrap')"));assert.ok(!startup.includes("api('listUsers')"));assert.ok(!startup.includes('await loadOwnPhoto'));
 const navigation=source.slice(source.indexOf('  async function navigate('),source.indexOf("  document.querySelectorAll('[data-page]')"));assert.ok(!navigation.includes("api('validateSession')"));
 assert.ok(!fs.readFileSync('assets/loading.js','utf8').includes('setTimeout(resolve, 170)'));
 console.log('PASS: read coalescing/deduplication, permission errors, single-use bootstrap data, mutation invalidation, one critical startup request, nonblocking photo and no artificial delay.');
})().catch(error=>{console.error(error);process.exitCode=1;});
