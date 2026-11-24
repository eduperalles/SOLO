(() => {
  function createMonitor({refresh,onState=()=>{},onOrders=()=>{},isBusy=()=>false,now=()=>Date.now(),setTimer=setInterval,clearTimer=clearInterval,interval=15000}) {
    let page='',due=0,running=false,generation=0,error='',baseline=false;const seen=new Set();
    const emit=()=>onState({page,remaining:Math.max(0,Math.ceil((due-now())/1000)),busy:running,error});
    async function tick(force=false) {
      if(!['dashboard','orders'].includes(page))return;
      if(running){emit();return;}
      if(!force && now()<due){emit();return;}
      if(isBusy()){due=now()+1000;emit();return;}
      const current=page,version=generation;running=true;error='';emit();
      try{await refresh(current);}catch(err){if(version===generation)error=err.message || 'Falha na atualização';}
      finally{running=false;if(version===generation)due=now()+interval;emit();}
    }
    const timer=setTimer(()=>{void tick();},1000);
    return {
      setPage(next){if(next===page)return;page=next;generation++;due=now()+interval;error='';emit();},
      observeOrders(orders){if(page!=='orders' || !Array.isArray(orders))return [];const fresh=baseline ? orders.filter(order=>!seen.has(String(order.id))) : [];orders.forEach(order=>seen.add(String(order.id)));baseline=true;if(fresh.length)onOrders(fresh);return fresh;},
      tick,
      dispose(){page='';generation++;clearTimer(timer);emit();}
    };
  }
  const e=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount({refresh,isBusy}) {
    const bar=document.querySelector('#live-panel-bar');let audio=null,sound=false,dialog=null;const pending=new Map();
    bar.innerHTML='<span class="live-indicator" aria-hidden="true"></span><span id="live-countdown" aria-live="off"></span><button type="button" class="tiny-button" id="live-refresh">Atualizar agora</button><button type="button" class="tiny-button" id="live-sound">Ativar som</button>';
    const label=bar.querySelector('#live-countdown'),soundButton=bar.querySelector('#live-sound');
    function beep(){if(!sound || !audio || audio.state!=='running')return;try{[740,880,1046].forEach((frequency,index)=>{const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+index*.18;oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.13,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.16);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.18);});}catch(_){}}
    soundButton.onclick=async()=>{if(sound){sound=false;soundButton.textContent='Ativar som';return;}try{const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)throw Error('Áudio não disponível neste navegador');audio=audio || new Audio();await audio.resume();sound=audio.state==='running';soundButton.textContent=sound ? 'Som ativado · silenciar' : 'Ativar som';beep();}catch(error){soundButton.textContent='Som indisponível';soundButton.title=error.message;}};
    function notify(orders) {
      orders.forEach(order=>pending.set(String(order.id),order));beep();
      if(!dialog){dialog=document.createElement('dialog');dialog.className='new-orders-dialog';dialog.setAttribute('aria-labelledby','new-orders-title');dialog.innerHTML='<div class="card-head"><div><p class="eyebrow">Painel de pedidos · SOLO</p><h2 id="new-orders-title"></h2></div><button type="button" class="button" id="new-orders-close">Fechar</button></div><div id="new-orders-content"></div>';document.body.append(dialog);dialog.querySelector('#new-orders-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{pending.clear();dialog.remove();dialog=null;},{once:true});}
      dialog.querySelector('#new-orders-title').textContent=`${pending.size} ${pending.size===1 ? 'novo pedido recebido' : 'novos pedidos recebidos'}`;
      dialog.querySelector('#new-orders-content').innerHTML=[...pending.values()].map(order=>`<article class="new-order-card"><div><h3>${e(order.numero)}</h3><strong>${Number(order.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div><p>${e(order.nome)} · ${e(new Date(order.criado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))}</p><ul>${(order.itens || []).map(item=>`<li>${e(item.quantidade)} × ${e(item.nome)}</li>`).join('')}</ul><details><summary>Informações completas do pedido</summary><pre>${e(order.mensagem || '')}</pre></details></article>`).join('');
      if(!dialog.open)dialog.showModal();
    }
    const monitor=createMonitor({refresh,isBusy,onOrders:notify,onState:state=>{bar.hidden=!['dashboard','orders'].includes(state.page);soundButton.hidden=state.page!=='orders';label.textContent=state.busy ? 'Atualizando dados…' : `${state.error ? 'Falha na atualização. ' : ''}Atualiza em ${state.remaining}s`;label.title=state.error || 'Atualização automática a cada 15 segundos, sem recarregar o navegador.';bar.querySelector('#live-refresh').disabled=state.busy;}});
    bar.querySelector('#live-refresh').onclick=()=>{void monitor.tick(true);};
    return monitor;
  }
  window.SoloLivePanel={createMonitor,mount};
})();
