(() => {
  const reads = new Set(['getDashboardStats','getDriveInventory','validateSession','listUsers','listClients','listSuppliers','listProducts','listKits','listKitProducts','listCoupons','listOrders','listFinanceReceivables','listFinancePayables','getSiteMenuAdmin','getModuleAccess','getMyProfile','getMyProfilePhoto','getUserPhotos']);
  function create({send,onUser=()=>{}}) {
    const pending=new Map(), primed=new Map(); let queue=[], timer=null;
    const key=(action,payload)=>JSON.stringify([action,payload]);
    const unpack=result=>{if(!result || !result.ok)throw new Error(result?.message || 'Falha ao processar a solicitação.');return result.data;};
    async function flush() {
      timer=null; const batch=queue.splice(0,20);
      try {
        const response=await send('panelRead',{reads:batch.map(item=>({action:item.action,payload:item.payload}))});
        onUser(response.user);
        if(!Array.isArray(response.results) || response.results.length!==batch.length)throw new Error('Resposta de consulta incompleta.');
        batch.forEach((item,index)=>{try{item.resolve(unpack(response.results[index]));}catch(error){item.reject(error);}});
      }catch(error){batch.forEach(item=>item.reject(error));}
      finally{batch.forEach(item=>pending.delete(item.key));if(queue.length && !timer)timer=setTimeout(flush,0);}
    }
    return {
      prime(actions,results) {actions.forEach((item,i)=>primed.set(key(item.action,item.payload || {}),{result:results[i],expires:Date.now()+5000}));},
      request(action,payload={}) {
        if(!reads.has(action)) {
          primed.clear();
          return send(action,payload);
        }
        const id=key(action,payload), ready=primed.get(id);primed.delete(id);
        if(ready && ready.expires>=Date.now()) {try{return Promise.resolve(unpack(ready.result));}catch(error){return Promise.reject(error);}}
        if(pending.has(id))return pending.get(id);
        const promise=new Promise((resolve,reject)=>queue.push({key:id,action,payload,resolve,reject}));
        pending.set(id,promise);if(!timer)timer=setTimeout(flush,0);
        return promise;
      }
    };
  }
  window.SoloPanelApi={create};
})();
